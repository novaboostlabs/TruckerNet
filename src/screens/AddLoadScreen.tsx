import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Modal, Pressable,
  ActivityIndicator, Switch, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-get-random-values';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel } from '../theme/theme';
import { getDateLocale } from '../lib/i18n';
import { calcBreakEven, saveLoad, getPersonalLaneHistory, LaneHistory } from '../db/database';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePaywall } from '../contexts/PaywallContext';
import { canLogLoadFree } from '../lib/gating';
import { pushLoads } from '../lib/sync/loadsSync';
import { uploadBolPhoto } from '../lib/storage';
import { ocrBOL, pickImage } from '../lib/ocr';
import { getFairMarketRate, LoadType } from '../utils/marketRates';
import AddressAutocomplete from '../components/AddressAutocomplete';
import FairMarketLock from '../components/FairMarketLock';
import { getRouteData, geocodeAddress, AddressSuggestion } from '../lib/mapbox';
import { splitRouteByState } from '../lib/stateSplit';
import { contributeRateReport, getCommunityRate, CommunityRate } from '../lib/rateReports';
import { scheduleLoadReminder, cancelLoadReminder } from '../lib/notifications';

export interface AddLoadPrefill {
  grossPay?:    string;
  miles?:       string;
  pickupText?:  string;
  deliveryText?: string;
  pickupSel?:   AddressSuggestion | null;
  deliverySel?: AddressSuggestion | null;
  loadType?:    LoadType;
  backhaul?:    boolean;
  milesAuto?:   boolean;
}

const LOAD_TYPES: LoadType[] = [
  'dry_van', 'reefer', 'flatbed', 'step_deck', 'intermodal',
  'tanker', 'hazmat', 'rgn', 'power_only', 'auto_transport',
];

const STATUSES = ['completed', 'upcoming', 'in_progress', 'cancelled'] as const;
type LoadStatus = typeof STATUSES[number];

const STATUS_I18N: Record<LoadStatus, string> = {
  completed:   'completed',
  upcoming:    'upcoming',
  in_progress: 'inProgress',
  cancelled:   'cancelled',
};

interface StateMileRow { state: string; miles: string; }

interface Props {
  onClose: () => void;
  onSaved?: () => void;
  prefill?: AddLoadPrefill;
}

function extractState(label: string): string {
  const m = label.match(/,\s*([A-Z]{2})(?:\s+\d{5}[-\d]*)?(?:,|\s*$)/);
  return m?.[1] ?? '';
}

function extractCity(label: string): string {
  const clean = label.replace(/,?\s*United States\s*$/i, '').trim();
  const parts = clean.split(',').map(s => s.trim());
  for (let i = 0; i < parts.length; i++) {
    if (/^[A-Z]{2}(?:\s+\d{5})?$/.test(parts[i])) {
      return parts[i - 1] ?? '';
    }
  }
  return parts[parts.length - 2] ?? '';
}

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function cap(raw: string, max: number): string {
  const n = parseFloat(raw);
  return (!isNaN(n) && n > max) ? String(max) : raw;
}

export default function AddLoadScreen({ onClose, onSaved, prefill }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const { present: presentPaywall } = usePaywall();

  // ── Route inputs ──
  const [pickup,      setPickup]      = useState(prefill?.pickupText   ?? '');
  const [delivery,    setDelivery]    = useState(prefill?.deliveryText ?? '');
  const [pickupSel,   setPickupSel]   = useState<AddressSuggestion | null>(prefill?.pickupSel   ?? null);
  const [deliverySel, setDeliverySel] = useState<AddressSuggestion | null>(prefill?.deliverySel ?? null);
  const [miles,       setMiles]       = useState(prefill?.miles    ?? '');
  const [milesAuto,   setMilesAuto]   = useState(prefill?.milesAuto ?? false);
  const [routing,     setRouting]     = useState(false);
  const [routeError,  setRouteError]  = useState(false);

  // ── State mileage ──
  const [stateMiles,     setStateMiles]     = useState<StateMileRow[]>([{ state: '', miles: '' }]);
  const stateInitialized = useRef(false);

  // ── Load date (defaults to today; user can go back to backlog past loads) ──
  const [loadDate, setLoadDate] = useState(() => new Date().toISOString().split('T')[0]);

  function shiftLoadDate(days: number) {
    const d = new Date(loadDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().split('T')[0];
    if (iso <= new Date().toISOString().split('T')[0]) setLoadDate(iso);
  }

  const isToday = loadDate === new Date().toISOString().split('T')[0];
  const loadDateDisplay = new Date(loadDate + 'T12:00:00').toLocaleDateString(getDateLocale(), {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  // ── Load details ──
  const [grossPay, setGrossPay] = useState(prefill?.grossPay ?? '');
  const [loadType, setLoadType] = useState<LoadType>(prefill?.loadType ?? 'dry_van');
  const [status,   setStatus]   = useState<LoadStatus | null>(null);
  const [backhaul, setBackhaul] = useState(prefill?.backhaul ?? false);

  // ── Optional fields ──
  const [weight,      setWeight]      = useState('');
  const [bolNumber,   setBolNumber]   = useState('');
  const [bolPhotoUri, setBolPhotoUri] = useState<string | null>(null);
  const [brokerName,  setBrokerName]  = useState('');
  const [brokerMC,    setBrokerMC]    = useState('');
  const [notes,       setNotes]       = useState('');
  const [showOptional, setShowOptional] = useState(false);

  // ── Modal open state ──
  const [typeOpen,   setTypeOpen]   = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const [saving, setSaving] = useState(false);

  // ── BOL scan (Claude vision → autofill) ──
  const [bolScanning, setBolScanning] = useState(false);
  const [bolScanned,  setBolScanned]  = useState(false);

  // Auto-route when both endpoints are geocoded — also auto-splits by state
  useEffect(() => {
    if (!pickupSel || !deliverySel) return;
    const ctrl = new AbortController();
    let cancelled = false;
    setRouting(true);
    setRouteError(false);
    stateInitialized.current = false;

    getRouteData(pickupSel, deliverySel, ctrl.signal)
      .then(({ miles: mi, geometry }) => {
        if (cancelled) return;
        setMiles(String(Math.round(mi)));
        setMilesAuto(true);
        stateInitialized.current = true;

        // Auto-split by state using the actual route geometry
        if (geometry.length >= 2) {
          const split = splitRouteByState(geometry);
          if (split.length > 0) {
            setStateMiles(split.map(s => ({
              state: s.state,
              miles: String(Math.round(s.miles)),
            })));
            return;
          }
        }

        // Fallback to address-based 50/50 split if geometry split fails
        const pState = extractState(pickupSel.label);
        const dState = extractState(deliverySel.label);
        const totalMi = Math.round(mi);
        if (!pState && !dState) {
          setStateMiles([{ state: '', miles: String(totalMi) }]);
        } else if (!dState || pState === dState) {
          setStateMiles([{ state: pState, miles: String(totalMi) }]);
        } else {
          const half = Math.round(totalMi / 2);
          setStateMiles([
            { state: pState, miles: String(half) },
            { state: dState, miles: String(totalMi - half) },
          ]);
        }
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return;
        setRouteError(true);
      })
      .finally(() => { if (!cancelled) setRouting(false); });
    return () => { cancelled = true; ctrl.abort(); };
  }, [pickupSel, deliverySel]);

  const { breakEvenRPM, fuelCPM, fixedCPM } = useMemo(() => calcBreakEven(), []);

  // ── Community + personal lane rate insights ──
  const [communityRate,    setCommunityRate]    = useState<CommunityRate | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);

  const personalHistory = useMemo<LaneHistory | null>(() => {
    if (!pickupSel || !deliverySel) return null;
    return getPersonalLaneHistory(
      extractState(pickupSel.label),
      extractState(deliverySel.label),
      loadType,
    );
  }, [pickupSel, deliverySel, loadType]);

  useEffect(() => {
    if (!pickupSel || !deliverySel) { setCommunityRate(null); return; }
    const orig = extractState(pickupSel.label);
    const dest = extractState(deliverySel.label);
    const mi   = parseFloat(miles) || 0;
    if (!orig || !dest || mi <= 0) { setCommunityRate(null); return; }

    setCommunityLoading(true);
    getCommunityRate(orig, dest, loadType, mi)
      .then(r  => setCommunityRate(r))
      .catch(() => setCommunityRate(null))
      .finally(() => setCommunityLoading(false));
  }, [pickupSel, deliverySel, loadType, miles]);

  const gross   = parseFloat(grossPay) || 0;
  const loadMi  = parseFloat(miles)    || 0;
  const hasInputs = gross > 0 && loadMi > 0;

  const fuelCost  = loadMi * fuelCPM;
  const fixedCost = loadMi * fixedCPM;
  const netPay    = gross - fuelCost - fixedCost;
  const netRPM    = loadMi > 0 ? netPay / loadMi  : 0;
  const grossRPM  = loadMi > 0 ? gross  / loadMi  : 0;

  const fair = hasInputs ? getFairMarketRate(loadMi, loadType, gross) : null;

  const verdictColor =
    !breakEvenRPM         ? Colors.textSecondary :
    netRPM >= breakEvenRPM * 1.15 ? Colors.primary :
    netRPM >= breakEvenRPM        ? Colors.secondary :
                                    Colors.danger;

  const stateMilesTotal = stateMiles.reduce((s, r) => s + (parseFloat(r.miles) || 0), 0);
  const stateMilesDiff  = loadMi > 0 ? Math.abs(Math.round(stateMilesTotal) - Math.round(loadMi)) : 0;

  function updateStateRow(idx: number, field: 'state' | 'miles', value: string) {
    setStateMiles(prev => prev.map((r, i) =>
      i === idx
        ? { ...r, [field]: field === 'state' ? value.toUpperCase().slice(0, 2) : cap(value, 15000) }
        : r
    ));
  }

  function addStateRow() {
    setStateMiles(prev => [...prev, { state: '', miles: '' }]);
  }

  function removeStateRow(idx: number) {
    setStateMiles(prev => prev.filter((_, i) => i !== idx));
  }

  function resetPickup() {
    setPickupSel(null);
    setMilesAuto(false);
    stateInitialized.current = false;
  }

  function resetDelivery() {
    setDeliverySel(null);
    setMilesAuto(false);
    stateInitialized.current = false;
  }

  async function runBolScan(source: 'camera' | 'library') {
    const uri = await pickImage(source);
    if (uri === 'permission') {
      Alert.alert(t('addLoad.photo.permissionTitle'), t('addLoad.photo.permissionMsg'));
      return;
    }
    if (!uri) return; // cancelled

    // The scanned image doubles as the attached BOL proof photo.
    setBolPhotoUri(uri);
    setShowOptional(true);
    setBolScanning(true);
    try {
      const res = await ocrBOL(uri);
      if (!res.ok) {
        const k = res.error === 'not_configured' ? 'notAvailable' : 'failed';
        Alert.alert(t(`addLoad.scanBol.${k}Title`), t(`addLoad.scanBol.${k}Msg`));
        return;
      }
      const { pickupAddress, deliveryAddress, weightLbs, bolNumber, brokerName } = res.data;

      if (weightLbs != null) setWeight(String(Math.round(weightLbs)));
      if (bolNumber)  setBolNumber(bolNumber);
      if (brokerName) setBrokerName(brokerName);

      // Geocode the addresses so the existing auto-route + state-split effect
      // fires. Falls back to plain text (user picks from autocomplete) if a
      // geocode misses.
      const [pSug, dSug] = await Promise.all([
        pickupAddress   ? geocodeAddress(pickupAddress)   : Promise.resolve(null),
        deliveryAddress ? geocodeAddress(deliveryAddress) : Promise.resolve(null),
      ]);
      if (pickupAddress)   { setPickup(pSug?.label ?? pickupAddress);     if (pSug) setPickupSel(pSug); }
      if (deliveryAddress) { setDelivery(dSug?.label ?? deliveryAddress); if (dSug) setDeliverySel(dSug); }

      setBolScanned(true);
    } catch {
      Alert.alert(t('addLoad.scanBol.failedTitle'), t('addLoad.scanBol.failedMsg'));
    } finally {
      setBolScanning(false);
    }
  }

  function handleScanBol() {
    Alert.alert(
      t('addLoad.scanBol.chooseTitle'),
      t('addLoad.photo.chooseMessage'),
      [
        { text: t('addLoad.photo.takePhoto'),     onPress: () => runBolScan('camera') },
        { text: t('addLoad.photo.chooseLibrary'), onPress: () => runBolScan('library') },
        { text: t('common.cancel'),               style: 'cancel' },
      ],
    );
  }

  async function pickBolPhoto(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('addLoad.photo.permissionTitle'), t('addLoad.photo.permissionMsg'));
      return;
    }
    const res = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets[0]?.uri) setBolPhotoUri(res.assets[0].uri);
  }

  function handleAttachPhoto() {
    Alert.alert(
      t('addLoad.photo.chooseTitle'),
      t('addLoad.photo.chooseMessage'),
      [
        { text: t('addLoad.photo.takePhoto'),     onPress: () => pickBolPhoto('camera') },
        { text: t('addLoad.photo.chooseLibrary'), onPress: () => pickBolPhoto('library') },
        { text: t('common.cancel'),               style: 'cancel' },
      ],
    );
  }

  async function handleSave() {
    if (!gross || !loadMi) {
      Alert.alert(t('addLoad.missingInfoTitle'), t('addLoad.missingInfo'));
      return;
    }
    if (!status) {
      Alert.alert(t('addLoad.missingInfoTitle'), t('addLoad.missingStatus'));
      return;
    }
    // Free tier caps at 15 loads/month — the 16th opens the paywall instead.
    if (!isPro && !canLogLoadFree()) {
      presentPaywall('loadLimit');
      return;
    }
    setSaving(true);
    try {
      const pLabel = pickupSel?.label  ?? pickup;
      const dLabel = deliverySel?.label ?? delivery;

      const hasBreakEven = breakEvenRPM > 0;
      const verdict: string | undefined = hasBreakEven
        ? (netRPM >= breakEvenRPM * 1.15 ? 'green' : netRPM >= breakEvenRPM ? 'amber' : 'red')
        : undefined;

      const validStateMiles = stateMiles.filter(
        r => r.state.length === 2 && parseFloat(r.miles) > 0
      );

      // Upload the BOL photo to cloud storage (proof of delivery). For a signed-in
      // user we store the public URL; for guests / failed upload we fall back to
      // the local URI so it at least shows this session.
      let bolPhotoUrl = '';
      if (bolPhotoUri) {
        const uploaded = user ? await uploadBolPhoto(user.id, bolPhotoUri) : null;
        bolPhotoUrl = uploaded ?? bolPhotoUri;
      }

      const savedLoadId = saveLoad(
        {
          date:            loadDate,
          pickup_address:  pLabel,
          pickup_city:     extractCity(pLabel),
          pickup_state:    extractState(pLabel),
          delivery_address: dLabel,
          delivery_city:   extractCity(dLabel),
          delivery_state:  extractState(dLabel),
          equipment_type:  loadType,
          total_miles:     loadMi,
          gross_pay:       gross,
          is_backhaul:     backhaul ? 1 : 0,
          status,
          benchmark_fair_pay_min: fair?.minTotal,
          benchmark_fair_pay_max: fair?.maxTotal,
          fuel_cost_for_load:  fuelCost,
          fixed_cost_for_load: fixedCost,
          net_pay:             netPay,
          gross_rate_per_mile: grossRPM,
          net_rate_per_mile:   netRPM,
          verdict,
          weight_lbs:   parseFloat(weight) || 0,
          bol_number:   bolNumber,
          bol_photo_url: bolPhotoUrl,
          broker_name:  brokerName,
          broker_mc:    brokerMC,
          notes,
        },
        validStateMiles.map(r => ({ state: r.state, miles: parseFloat(r.miles) }))
      );

      // Schedule/cancel load reminder notification based on status.
      if (status === 'in_progress') {
        scheduleLoadReminder(savedLoadId).catch(() => {});
      } else {
        cancelLoadReminder(savedLoadId).catch(() => {});
      }

      // Anonymously contribute rate data to the community pool (completed loads only).
      if (status === 'completed') {
        const orig = extractState(pLabel);
        const dest = extractState(dLabel);
        contributeRateReport({ originState: orig, destState: dest, loadType, miles: loadMi, totalPay: gross }).catch(() => {});
      }

      // Back up to the cloud (local-first; no-op for guests).
      if (user) pushLoads(user.id);
      onSaved?.();
      onClose();
    } catch {
      Alert.alert(t('addLoad.saveErrorTitle'), t('addLoad.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('addLoad.eyebrow')}</Text>
            <Text style={styles.title}>{t('addLoad.title')}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>

          {/* ── Scan BOL to autofill ── */}
          <TouchableOpacity
            style={[styles.scanBolBtn, bolScanning && styles.scanBolBtnDisabled]}
            onPress={handleScanBol}
            disabled={bolScanning}
            activeOpacity={0.85}
          >
            <Ionicons name={bolScanning ? 'hourglass-outline' : 'scan-outline'} size={18} color={Colors.primary} />
            <Text style={styles.scanBolText}>
              {bolScanning ? t('addLoad.scanBol.scanning') : t('addLoad.scanBol.button')}
            </Text>
          </TouchableOpacity>
          {bolScanned && !bolScanning && (
            <View style={styles.scanBolHint}>
              <Ionicons name="checkmark-circle" size={15} color={Colors.primary} />
              <Text style={styles.scanBolHintText}>{t('addLoad.scanBol.hint')}</Text>
            </View>
          )}

          {/* ── Pickup ── */}
          <Text style={styles.fieldLabel}>{t('addLoad.pickup')}</Text>
          <AddressAutocomplete
            value={pickup}
            onChangeText={(v) => { setPickup(v); if (pickupSel) resetPickup(); }}
            onSelect={setPickupSel}
            placeholder={t('addLoad.pickupPlaceholder')}
            icon="ellipse-outline"
          />

          {/* ── Delivery ── */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('addLoad.delivery')}</Text>
          <AddressAutocomplete
            value={delivery}
            onChangeText={(v) => { setDelivery(v); if (deliverySel) resetDelivery(); }}
            onSelect={setDeliverySel}
            placeholder={t('addLoad.deliveryPlaceholder')}
            icon="location"
            iconColor={Colors.primary}
          />
          <Text style={styles.addrHint}>{t('addLoad.pickupEncourage')}</Text>

          {/* ── Miles ── */}
          <View style={styles.milesLabelRow}>
            <Text style={styles.fieldLabel}>{t('addLoad.milesCol')}</Text>
            {routing ? (
              <View style={styles.milesBadge}>
                <ActivityIndicator size="small" color={Colors.textSecondary} />
                <Text style={styles.milesBadgeText}>{t('addLoad.calculating')}</Text>
              </View>
            ) : milesAuto ? (
              <View style={styles.milesBadge}>
                <Ionicons name="navigate" size={12} color={Colors.primary} />
                <Text style={[styles.milesBadgeText, { color: Colors.primary }]}>{t('checkLoad.autoMiles')}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.bigInput}
              value={miles}
              onChangeText={(v) => {
                setMiles(cap(v, 15000));
                setMilesAuto(false);
                stateInitialized.current = false;
              }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.inputSuffix}>mi</Text>
          </View>
          {routeError && (
            <View style={styles.routeErrorRow}>
              <Ionicons name="warning-outline" size={14} color={Colors.secondary} />
              <Text style={styles.routeErrorText}>{t('addLoad.routeError')}</Text>
            </View>
          )}

          {/* ── State mileage ── */}
          <View style={styles.sectionDivider} />
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.fieldLabel}>{t('addLoad.stateMileage')}</Text>
            <Text style={styles.sectionHint}>{milesAuto ? t('addLoad.autoCalculated') : t('addLoad.editState')}</Text>
          </View>

          {stateMiles.map((row, idx) => (
            <View key={idx} style={styles.stateRow}>
              <TextInput
                style={styles.stateInput}
                value={row.state}
                onChangeText={(v) => updateStateRow(idx, 'state', v)}
                placeholder="TX"
                placeholderTextColor={Colors.textTertiary}
                maxLength={2}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.stateMilesInput}
                value={row.miles}
                onChangeText={(v) => updateStateRow(idx, 'miles', v)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.stateMilesLabel}>mi</Text>
              {stateMiles.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeStateRow(idx)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="remove-circle" size={20} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <View style={styles.stateFooter}>
            <TouchableOpacity style={styles.addStateBtn} onPress={addStateRow}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.addStateBtnText}>{t('addLoad.addState')}</Text>
            </TouchableOpacity>
            {loadMi > 0 && stateMilesTotal > 0 && (
              <View style={[styles.stateTotalPill, stateMilesDiff < 2 ? styles.stateTotalOk : styles.stateTotalWarn]}>
                <Text style={[styles.stateTotalText, stateMilesDiff < 2 ? { color: Colors.primary } : { color: Colors.secondary }]}>
                  {stateMilesDiff < 2
                    ? `${Math.round(stateMilesTotal)} mi ✓`
                    : `${Math.round(stateMilesTotal)} / ${Math.round(loadMi)} mi`}
                </Text>
              </View>
            )}
          </View>

          {/* ── Gross pay ── */}
          <View style={styles.sectionDivider} />
          <Text style={styles.fieldLabel}>{t('addLoad.grossPay')}</Text>
          <View style={styles.inputCard}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.bigInput}
              value={grossPay}
              onChangeText={(v) => setGrossPay(cap(v, 100000))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          {fair && (
            isPro ? (
              <View style={styles.fairRow}>
                <Text style={styles.fairLabel}>{t('addLoad.fairMarket')}</Text>
                <Text style={styles.fairValue}>
                  {t('addLoad.fairMarketRange', { min: money(fair.minTotal), max: money(fair.maxTotal) })}
                </Text>
              </View>
            ) : (
              <View style={styles.fairLockWrap}>
                <FairMarketLock onUpgrade={() => presentPaywall('fairMarket')} />
              </View>
            )
          )}

          {/* ── Lane insights (community + personal history) ── */}
          {(pickupSel && deliverySel) && (
            <>
              {isPro && (communityLoading || communityRate) && (
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <Ionicons name="people-outline" size={13} color={Colors.primary} />
                    <Text style={styles.insightTitle}>{t('rateInsights.communityTitle')}</Text>
                  </View>
                  {communityLoading ? (
                    <ActivityIndicator size="small" color={Colors.textTertiary} style={styles.insightLoader} />
                  ) : communityRate ? (
                    <Text style={styles.insightValue}>
                      {t('rateInsights.communityCount', { count: communityRate.count })} · ${money(communityRate.lowPay)}–${money(communityRate.highPay)}
                    </Text>
                  ) : null}
                </View>
              )}
              {personalHistory && (
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                    <Text style={styles.insightTitle}>{t('rateInsights.historyTitle')}</Text>
                  </View>
                  <Text style={styles.insightValue}>
                    {personalHistory.count === 1
                      ? t('rateInsights.historyOne', { pay: money(personalHistory.lastPay), date: personalHistory.lastDate })
                      : t('rateInsights.historyMulti', { count: personalHistory.count, avg: money(personalHistory.avgPay), last: money(personalHistory.lastPay) })}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Net pay preview */}
          {hasInputs && (
            <View style={[styles.netPreview, { borderColor: verdictColor }]}>
              <Text style={styles.netPreviewLabel}>{t('addLoad.netPayPreview')}</Text>
              <Text style={[styles.netPreviewValue, { color: netPay >= 0 ? Colors.primary : Colors.danger }]}>
                {netPay < 0 ? '-' : ''}${money(Math.abs(netPay))}
              </Text>
              <Text style={styles.netPreviewSub}>
                ${grossRPM.toFixed(3)}/mi gross · ${netRPM.toFixed(3)}/mi net
              </Text>
            </View>
          )}

          {/* ── Load type ── */}
          <View style={styles.sectionDivider} />
          <Text style={styles.fieldLabel}>{t('addLoad.loadType')}</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setTypeOpen(true)} activeOpacity={0.8}>
            <Text style={styles.dropdownText}>{t(`addLoad.loadTypes.${loadType}`)}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>

          {/* ── Status ── */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('addLoad.status')}</Text>
          <TouchableOpacity style={[styles.dropdown, !status && styles.dropdownPlaceholder]} onPress={() => setStatusOpen(true)} activeOpacity={0.8}>
            <Text style={[styles.dropdownText, !status && styles.dropdownPlaceholderText]}>
              {status ? t(`addLoad.statuses.${STATUS_I18N[status]}`) : t('addLoad.statusPlaceholder')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>

          {/* ── Backhaul toggle ── */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>{t('addLoad.backhaul')}</Text>
              <Text style={styles.toggleHint}>{t('checkLoad.backhaulHint')}</Text>
            </View>
            <Switch
              value={backhaul}
              onValueChange={setBackhaul}
              trackColor={{ false: Colors.surfaceHigh, true: Colors.primaryMid }}
              thumbColor={backhaul ? Colors.primary : Colors.textTertiary}
            />
          </View>

          {/* ── Optional details ── */}
          <TouchableOpacity
            style={styles.optionalToggle}
            onPress={() => setShowOptional(v => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showOptional ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.optionalToggleText}>
              {showOptional ? t('addLoad.hideDetails') : t('addLoad.addDetails')}
            </Text>
          </TouchableOpacity>

          {showOptional && (
            <>
              <Text style={styles.fieldLabel}>{t('addLoad.weight')}</Text>
              <View style={styles.inputCardSm}>
                <TextInput
                  style={styles.inputSm}
                  value={weight}
                  onChangeText={(v) => setWeight(cap(v, 80000))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textTertiary}
                />
                <Text style={styles.inputSuffix}>lbs</Text>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('addLoad.bol')}</Text>
              <TextInput
                style={styles.textField}
                value={bolNumber}
                onChangeText={setBolNumber}
                placeholder="e.g. BOL-12345"
                placeholderTextColor={Colors.textTertiary}
              />

              {/* BOL photo attach */}
              {bolPhotoUri ? (
                <View style={styles.bolPhotoRow}>
                  <Image source={{ uri: bolPhotoUri }} style={styles.bolThumb} />
                  <View style={styles.bolPhotoInfo}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                    <Text style={styles.bolPhotoText}>{t('addLoad.photo.attached')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setBolPhotoUri(null)} activeOpacity={0.7} style={styles.bolRemoveBtn}>
                    <Text style={styles.bolRemoveText}>{t('addLoad.photo.remove')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.bolAttachBtn} onPress={handleAttachPhoto} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.bolAttachText}>{t('addLoad.photo.attach')}</Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('addLoad.broker')}</Text>
              <TextInput
                style={[styles.textField, { marginBottom: 10 }]}
                value={brokerName}
                onChangeText={setBrokerName}
                placeholder={t('addLoad.brokerName')}
                placeholderTextColor={Colors.textTertiary}
              />
              <TextInput
                style={styles.textField}
                value={brokerMC}
                onChangeText={setBrokerMC}
                placeholder={t('addLoad.brokerMC')}
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('addLoad.notes')}</Text>
              <TextInput
                style={[styles.textField, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('addLoad.notesPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </>
          )}

          {/* ── Date ── */}
          <View style={styles.sectionDivider} />
          <Text style={styles.fieldLabel}>{t('addLoad.date')}</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateArrow} onPress={() => shiftLoadDate(-1)} activeOpacity={0.6}>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.dateCenter}>
              <Text style={styles.dateText}>{loadDateDisplay}</Text>
              {isToday ? (
                <View style={styles.dateTodayBadge}>
                  <Text style={styles.dateTodayBadgeText}>{t('addLoad.today')}</Text>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setLoadDate(new Date().toISOString().split('T')[0])} activeOpacity={0.7}>
                  <Text style={styles.dateTodayLink}>{t('addLoad.backToToday')}</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.dateArrow} onPress={() => shiftLoadDate(1)} disabled={isToday} activeOpacity={0.6}>
              <Ionicons name="chevron-forward" size={20} color={isToday ? Colors.textTertiary : Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ── Save ── */}
          <TouchableOpacity
            style={[styles.saveBtn, (!hasInputs || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasInputs || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={hasInputs ? Colors.background : Colors.textTertiary} />
                <Text style={[styles.saveBtnText, !hasInputs && styles.saveBtnTextDisabled]}>
                  {t('addLoad.saveLoad')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Load type dropdown ── */}
      <Modal visible={typeOpen} transparent animationType="fade" onRequestClose={() => setTypeOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTypeOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('addLoad.loadType')}</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {LOAD_TYPES.map((type) => {
                const sel = type === loadType;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, sel && styles.typeOptionActive]}
                    onPress={() => { setLoadType(type); setTypeOpen(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeOptionText, sel && styles.typeOptionTextActive]}>
                      {t(`addLoad.loadTypes.${type}`)}
                    </Text>
                    {sel && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Status dropdown ── */}
      <Modal visible={statusOpen} transparent animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setStatusOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('addLoad.status')}</Text>
            {STATUSES.map((s) => {
              const sel = s === status;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.typeOption, sel && styles.typeOptionActive]}
                  onPress={() => { setStatus(s); setStatusOpen(false); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.typeOptionText, sel && styles.typeOptionTextActive]}>
                    {t(`addLoad.statuses.${STATUS_I18N[s]}`)}
                  </Text>
                  {sel && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.screenH, paddingTop: 12, paddingBottom: 16,
  },
  eyebrow: { ...SectionLabel, marginBottom: 4 },
  title:   { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary },
  closeBtn: {
    width: 38, height: 38, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 20 },

  fieldLabel: { ...SectionLabel, marginBottom: 10 },
  addrHint:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 8 },

  milesLabelRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  milesBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  milesBadgeText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.textSecondary },

  routeErrorRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  routeErrorText: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.secondary, flex: 1 },

  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 18, paddingVertical: 14,
  },
  dollarSign:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.subtitle, color: Colors.textSecondary, marginRight: 6 },
  bigInput:    { flex: 1, fontFamily: FontFamily.bold, fontSize: 28, color: Colors.textPrimary, padding: 0 },
  inputSuffix: { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textSecondary },

  inputCardSm: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 18, paddingVertical: 14,
  },
  inputSm: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary, padding: 0 },

  sectionDivider:   { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 22 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionHint:      { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stateInput: {
    width: 54, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 12,
    fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary,
    textAlign: 'center',
  },
  stateMilesInput: {
    flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary,
  },
  stateMilesLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textSecondary, width: 20 },

  stateFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  addStateBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addStateBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary },

  stateTotalPill: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  stateTotalOk:   { backgroundColor: Colors.primaryDim },
  stateTotalWarn: { backgroundColor: Colors.secondaryDim },
  stateTotalText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.caption },

  fairLockWrap: { marginTop: 10 },

  scanBolBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, paddingVertical: 15,
    marginBottom: 16,
  },
  scanBolBtnDisabled: { opacity: 0.6 },
  scanBolText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.primary },
  scanBolHint: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: -8, marginBottom: 18, paddingHorizontal: 2,
  },
  scanBolHintText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 17 },

  bolAttachBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 10,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
    borderRadius: Radius.md, paddingVertical: 13,
  },
  bolAttachText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  bolPhotoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 10,
  },
  bolThumb: { width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: Colors.surface },
  bolPhotoInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bolPhotoText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textPrimary },
  bolRemoveBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  bolRemoveText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.danger },
  fairRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, padding: 14, backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  fairLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary },
  fairValue: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textPrimary },

  insightCard: {
    marginTop: 8, padding: 12, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  insightTitle: { fontFamily: FontFamily.medium, fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightValue: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textPrimary },
  insightLoader: { alignSelf: 'flex-start', marginTop: 2 },

  netPreview: {
    backgroundColor: Colors.surface, borderWidth: 2, borderRadius: Radius.lg,
    padding: Spacing.cardPad, marginTop: 14, alignItems: 'center',
  },
  netPreviewLabel: { ...SectionLabel, marginBottom: 8 },
  netPreviewValue: {
    fontFamily: FontFamily.bold, fontSize: FontSize.cardNumber,
    lineHeight: 40, letterSpacing: -0.5, marginBottom: 4,
  },
  netPreviewSub: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 18, paddingVertical: 16,
  },
  dropdownText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  dropdownPlaceholder: { borderColor: Colors.border },
  dropdownPlaceholderText: { fontFamily: FontFamily.regular, color: Colors.textTertiary },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 14, marginTop: 18,
  },
  toggleText:  { flex: 1, marginRight: 12 },
  toggleLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  toggleHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  optionalToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 16, marginTop: 4,
  },
  optionalToggleText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },

  textField: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary,
  },
  textArea: { minHeight: 80, paddingTop: 14 },

  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingVertical: 10, paddingHorizontal: 6,
  },
  dateArrow:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  dateCenter: { flex: 1, alignItems: 'center', gap: 3 },
  dateText:   { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  dateTodayBadge: {
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2,
  },
  dateTodayBadgeText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.caption, color: Colors.primary },
  dateTodayLink:      { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.primary },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17, marginTop: 28,
  },
  saveBtnDisabled:     { backgroundColor: Colors.surfaceHigh },
  saveBtnText:         { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background },
  saveBtnTextDisabled: { color: Colors.textTertiary },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.screenH, paddingTop: 10, paddingBottom: 36,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 14,
  },
  modalTitle:  { fontFamily: FontFamily.bold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 12 },
  modalScroll: { maxHeight: 380 },
  typeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16, borderRadius: Radius.md, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  typeOptionActive:     { backgroundColor: Colors.primaryDim, borderColor: Colors.primaryMid },
  typeOptionText:       { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary },
  typeOptionTextActive: { fontFamily: FontFamily.semiBold, color: Colors.primary },
});
