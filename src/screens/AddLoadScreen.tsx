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
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { getDateLocale } from '../lib/i18n';
import {
  calcBreakEven, saveLoad, getPersonalLaneHistory, LaneHistory, LoadExpenseInsert,
  getIncomeGoal, getWeekPnL, getMonthPnL, getSetting, setSetting, getLoadCount, localDateISO,
} from '../db/database';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePaywall } from '../contexts/PaywallContext';
import { canLogLoadFree } from '../lib/gating';
import * as haptics from '../lib/haptics';
import FreeUsageMeter from '../components/FreeUsageMeter';
import { pushLoads } from '../lib/sync/loadsSync';
import { uploadBolPhoto } from '../lib/storage';
import { ocrBOL, pickImage } from '../lib/ocr';
import { getFairMarketRate, LoadType } from '../utils/marketRates';
import AddressAutocomplete from '../components/AddressAutocomplete';
import FairMarketLock from '../components/FairMarketLock';
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';
import { getRouteData, geocodeAddress, AddressSuggestion, extractCity, suggestionState } from '../lib/mapbox';
import { splitRouteByState } from '../lib/stateSplit';
import { planFuelStops } from '../lib/fuelOptimizer';
import FuelStopCard from '../components/FuelStopCard';
import { maybeContributeLoadRate, getCommunityRate, CommunityRate, CommunityTier } from '../lib/rateReports';
import { getBrokerScorecard, BrokerScorecard } from '../lib/brokerScorecard';
import BrokerScorecardCard from '../components/BrokerScorecardCard';
// Broker Check (FMCSA authority verification + name search) is shelved for v1 —
// its real value (crowdsourced payment behavior) needs user volume. The code
// lives on the `feat/broker-name-search` branch + src/lib/brokerCheck.ts for a
// post-launch revival. Intentionally not wired in here.
import { scheduleLoadReminder, cancelLoadReminder, checkAndNotifyGoalMilestone, checkAndNotifyStreak, scheduleIdleNudge } from '../lib/notifications';
import { capture } from '../lib/analytics';

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
  brokerName?:  string;
  brokerMC?:    string;
  /** ISO date (YYYY-MM-DD) to log the load on — set when adding from a
   *  selected day in the History calendar. Defaults to today. */
  date?:        string;
}

const LOAD_TYPES: LoadType[] = [
  'dry_van', 'reefer', 'flatbed', 'step_deck', 'intermodal',
  'tanker', 'hazmat', 'rgn', 'power_only', 'auto_transport',
];

// Lifecycle order: Upcoming → In Progress → Completed. ("Cancelled" was removed
// from the picker — deleting the load covers that case; legacy rows still render.)
const STATUSES = ['upcoming', 'in_progress', 'completed'] as const;
type LoadStatus = typeof STATUSES[number];

const STATUS_I18N: Record<LoadStatus, string> = {
  completed:   'completed',
  upcoming:    'upcoming',
  in_progress: 'inProgress',
};

interface StateMileRow { state: string; miles: string; }

interface Props {
  onClose: () => void;
  onSaved?: () => void;
  // Fired once, the first time this driver ever logs a load — lets the parent
  // surface the "your first true net pay" celebration. Passes the load's net pay.
  onFirstLoad?: (netPay: number) => void;
  prefill?: AddLoadPrefill;
}

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function cap(raw: string, max: number): string {
  const n = parseFloat(raw);
  return (!isNaN(n) && n > max) ? String(max) : raw;
}

// Maps a community-data confidence tier to its i18n label key.
function tierKey(tier: CommunityTier): string {
  return tier === 'exact'    ? 'rateInsights.tierExact'
       : tier === 'corridor' ? 'rateInsights.tierCorridor'
       :                        'rateInsights.tierNational';
}

// Maps the driver's saved profile equipment (ProfileSetupScreen values) to a
// LoadType, so Add Load defaults to the rig they actually run.
const PROFILE_EQUIP_TO_LOADTYPE: Record<string, LoadType> = {
  dryVan:     'dry_van',
  flatbed:    'flatbed',
  reefer:     'reefer',
  boxTruck:   'dry_van',       // closest fair-market analogue
  stepDeck:   'step_deck',
  tanker:     'tanker',
  intermodal: 'intermodal',
  carHauler:  'auto_transport',
};

function defaultLoadTypeFromProfile(): LoadType {
  const eq = getSetting('profile_equipment_type') ?? '';
  return PROFILE_EQUIP_TO_LOADTYPE[eq] ?? 'dry_van';
}

export default function AddLoadScreen({ onClose, onSaved, onFirstLoad, prefill }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
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
  // Flips when the driver touches the rows — saved so IFTA knows the split was
  // human-verified rather than an automatic route estimate.
  const stateEdited      = useRef(false);

  // ── Load date (defaults to today, or the History-calendar day that opened
  //    this sheet; the arrows still adjust it) ──
  const [loadDate, setLoadDate] = useState(() => prefill?.date ?? localDateISO());

  function shiftLoadDate(days: number) {
    const d = new Date(loadDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    const iso = localDateISO(d);
    if (iso <= localDateISO()) setLoadDate(iso);
  }

  const isToday = loadDate === localDateISO();
  const loadDateDisplay = new Date(loadDate + 'T12:00:00').toLocaleDateString(getDateLocale(), {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  // ── Load details ──
  const [grossPay, setGrossPay] = useState(prefill?.grossPay ?? '');
  const [loadType, setLoadType] = useState<LoadType>(prefill?.loadType ?? defaultLoadTypeFromProfile());
  // Smart default: coming from Check Load ("Accept & Log" always carries the
  // pay) means the driver just took this load → Upcoming. Logging directly —
  // including onto a past History-calendar day — usually means a finished run.
  const [status,   setStatus]   = useState<LoadStatus>(prefill?.grossPay ? 'upcoming' : 'completed');
  const [backhaul, setBackhaul] = useState(prefill?.backhaul ?? false);
  // Deadhead = empty/unpaid reposition leg. Miles still count for IFTA, so it's
  // savable with $0 gross (the gross requirement is waived when this is on).
  const [deadhead, setDeadhead] = useState(false);

  // ── Load expenses (scale, toll, lumper, etc.) ──
  const [loadExpenses, setLoadExpenses] = useState<{ id: string; label: string; amount: string; category: string }[]>([]);

  function addExpense(category: string, defaultLabel: string, defaultAmount = '') {
    setLoadExpenses(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      // "Other" starts blank so the name placeholder invites typing — the label
      // being editable wasn't discoverable when it arrived pre-filled.
      label: category === 'other' ? '' : defaultLabel,
      amount: defaultAmount,
      category,
    }]);
  }

  function updateExpense(id: string, field: 'label' | 'amount', value: string) {
    setLoadExpenses(prev => prev.map(e =>
      e.id === id ? { ...e, [field]: field === 'amount' ? cap(value, 50000) : value } : e
    ));
  }

  function removeExpense(id: string) {
    setLoadExpenses(prev => prev.filter(e => e.id !== id));
  }

  const expensesTotal = loadExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  // ── Optional fields ──
  const [weight,      setWeight]      = useState('');
  const [bolNumber,   setBolNumber]   = useState('');
  const [bolPhotoUri, setBolPhotoUri] = useState<string | null>(null);
  const [brokerName,  setBrokerName]  = useState(prefill?.brokerName ?? '');
  const [brokerMC,    setBrokerMC]    = useState(prefill?.brokerMC ?? '');
  const [notes,       setNotes]       = useState('');
  // Broker info carried over from Check Load lands in the optional section —
  // open it so the driver can see their data made the trip.
  const [showOptional, setShowOptional] = useState(!!(prefill?.brokerName || prefill?.brokerMC));

  // ── Broker scorecard ──
  const [brokerScorecard,   setBrokerScorecard]   = useState<BrokerScorecard | null>(null);
  const [brokerSCLoading,   setBrokerSCLoading]   = useState(false);

  useEffect(() => {
    const name = brokerName.trim();
    const mc   = brokerMC.trim();
    if (name.length < 2 && mc.length < 2) { setBrokerScorecard(null); return; }
    const timer = setTimeout(async () => {
      setBrokerSCLoading(true);
      try { setBrokerScorecard(await getBrokerScorecard(name, mc)); }
      catch { setBrokerScorecard(null); }
      finally { setBrokerSCLoading(false); }
    }, 600);
    return () => clearTimeout(timer);
  }, [brokerName, brokerMC]);

  // ── Modal open state ──
  const [typeOpen, setTypeOpen] = useState(false);

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
        // Fresh auto-split replaces whatever was there — no longer hand-edited.
        stateEdited.current = false;

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
        const pState = suggestionState(pickupSel);
        const dState = suggestionState(deliverySel);
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
    return getPersonalLaneHistory({
      pickupLat: pickupSel.lat, pickupLng: pickupSel.lng,
      deliveryLat: deliverySel.lat, deliveryLng: deliverySel.lng,
      originState: suggestionState(pickupSel),
      destState:   suggestionState(deliverySel),
      equipment:   loadType,
    });
  }, [pickupSel, deliverySel, loadType]);

  useEffect(() => {
    if (!pickupSel || !deliverySel) { setCommunityRate(null); return; }
    const orig = suggestionState(pickupSel);
    const dest = suggestionState(deliverySel);
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
  const netPay    = gross - fuelCost - fixedCost - expensesTotal;
  const netRPM    = loadMi > 0 ? netPay / loadMi  : 0;
  const grossRPM  = loadMi > 0 ? gross  / loadMi  : 0;

  // Origin/dest states feed regional market strength into the fair estimate.
  const fairOrigin = pickupSel   ? suggestionState(pickupSel)   : undefined;
  const fairDest   = deliverySel ? suggestionState(deliverySel) : undefined;
  const fair = hasInputs ? getFairMarketRate(loadMi, loadType, gross, fairOrigin, fairDest) : null;

  const verdictColor =
    !breakEvenRPM         ? Colors.textSecondary :
    netRPM >= breakEvenRPM * 1.15 ? Colors.primary :
    netRPM >= breakEvenRPM        ? Colors.secondary :
                                    Colors.danger;

  const stateMilesTotal = stateMiles.reduce((s, r) => s + (parseFloat(r.miles) || 0), 0);
  const stateMilesDiff  = loadMi > 0 ? Math.abs(Math.round(stateMilesTotal) - Math.round(loadMi)) : 0;

  // Tax-adjusted fuel-stop plan for the on-route states (null for 1-state routes).
  const fuelPlan = useMemo(
    () => planFuelStops(
      stateMiles
        .map(r => ({ state: r.state, miles: parseFloat(r.miles) || 0 }))
        .filter(r => r.state.length === 2 && r.miles > 0)
    ),
    [stateMiles]
  );

  function updateStateRow(idx: number, field: 'state' | 'miles', value: string) {
    stateEdited.current = true;
    setStateMiles(prev => prev.map((r, i) =>
      i === idx
        ? { ...r, [field]: field === 'state' ? value.toUpperCase().slice(0, 2) : cap(value, 15000) }
        : r
    ));
  }

  function addStateRow() {
    stateEdited.current = true;
    setStateMiles(prev => [...prev, { state: '', miles: '' }]);
  }

  function removeStateRow(idx: number) {
    stateEdited.current = true;
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

      capture('bol_scan_used', {
        source,
        fields_extracted: [
          pickupAddress ? 'pickup' : null,
          deliveryAddress ? 'delivery' : null,
          weightLbs != null ? 'weight' : null,
          bolNumber ? 'bol_number' : null,
          brokerName ? 'broker' : null,
        ].filter(Boolean),
      });
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
    // Deadhead legs are unpaid by definition — miles alone are enough to save
    // (the miles still need to reach IFTA). Every other load needs gross + miles.
    if (!loadMi || (!gross && !deadhead)) {
      Alert.alert(t('addLoad.missingInfoTitle'), t('addLoad.missingInfo'));
      return;
    }
    // Free tier caps at 15 loads/month — the 16th opens the paywall instead.
    if (!isPro && !canLogLoadFree()) {
      capture('load_limit_hit');
      presentPaywall('loadLimit');
      return;
    }
    setSaving(true);
    try {
      // First load this driver has ever logged — the "aha" moment. Capture it
      // before the save so the count is still 0; gate with a once-ever flag.
      const isFirstEver =
        getLoadCount() === 0 && getSetting('first_load_celebrated') !== 'true';

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

      const validExpenses: LoadExpenseInsert[] = loadExpenses
        .filter(e => (parseFloat(e.amount) || 0) > 0)
        .map(e => ({
          // Unnamed rows fall back to the localized category name, never the raw key.
          label: e.label.trim() || t(`addLoad.expCat.${e.category}`),
          category: e.category,
          amount: parseFloat(e.amount),
        }));

      const savedLoadId = saveLoad(
        {
          date:            loadDate,
          pickup_address:  pLabel,
          pickup_city:     extractCity(pLabel),
          pickup_state:    suggestionState(pickupSel, pLabel),
          delivery_address: dLabel,
          delivery_city:   extractCity(dLabel),
          delivery_state:  suggestionState(deliverySel, dLabel),
          // Coordinates (when picked from autocomplete) power the nearby-lane history.
          pickup_lat:      pickupSel?.lat ?? null,
          pickup_lng:      pickupSel?.lng ?? null,
          delivery_lat:    deliverySel?.lat ?? null,
          delivery_lng:    deliverySel?.lng ?? null,
          equipment_type:  loadType,
          total_miles:     loadMi,
          gross_pay:       gross,
          is_backhaul:     backhaul ? 1 : 0,
          is_deadhead:     deadhead ? 1 : 0,
          status,
          benchmark_fair_pay_min: fair?.minTotal,
          benchmark_fair_pay_max: fair?.maxTotal,
          fuel_cost_for_load:  fuelCost,
          fixed_cost_for_load: fixedCost,
          additional_costs:    expensesTotal,
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
        validStateMiles.map(r => ({
          state: r.state,
          miles: parseFloat(r.miles),
          is_manually_edited: stateEdited.current ? 1 : 0,
        })),
        validExpenses,
      );

      capture('load_added', {
        status,
        load_type:    loadType,
        miles:        loadMi,
        gross_pay:    gross,
        net_pay:      netPay,
        is_backhaul:  backhaul,
        has_expenses: validExpenses.length > 0,
        has_bol_photo: !!bolPhotoUri,
        verdict,
      });

      // Schedule/cancel load reminder notification based on status.
      if (status === 'in_progress') {
        scheduleLoadReminder(savedLoadId).catch(() => {});
      } else {
        cancelLoadReminder(savedLoadId).catch(() => {});
      }

      // Anonymously contribute rate data to the community pool — idempotent, fires
      // once when a load first becomes completed (never double-counts on re-save).
      maybeContributeLoadRate(savedLoadId);

      if (status === 'completed') {
        // Check if this load pushed the driver past a goal milestone.
        const goal = getIncomeGoal();
        if (goal) {
          const pnl = goal.period === 'weekly' ? getWeekPnL() : getMonthPnL();
          checkAndNotifyGoalMilestone(pnl.net, goal).catch(() => {});
        }
      }

      // Back up to the cloud (local-first; no-op for guests).
      if (user) pushLoads(user.id);

      // Fire the one-time first-load celebration after a successful save.
      if (isFirstEver) {
        setSetting('first_load_celebrated', 'true');
        onFirstLoad?.(netPay);
      }

      haptics.success();
      // Check streak milestone and reschedule idle nudge after every completed load.
      if (status === 'completed') {
        checkAndNotifyStreak().catch(() => {});
      }
      scheduleIdleNudge().catch(() => {});
      onSaved?.();
      onClose();
    } catch {
      haptics.error();
      Alert.alert(t('addLoad.saveErrorTitle'), t('addLoad.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('addLoad.eyebrow')}</Text>
            <Text style={styles.title}>{t('addLoad.title')}</Text>
            <AccentRule style={{ marginTop: 8 }} />
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>

          {/* ── Free-tier usage (renders nothing for Pro) ── */}
          <FreeUsageMeter compact />

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
            {isPro && (
              <Text style={styles.sectionHint}>{milesAuto ? t('addLoad.autoCalculated') : t('addLoad.editState')}</Text>
            )}
          </View>

          {/* State rows — Pro only. Free users see a gate card.
              State mileage still auto-calculates in state and saves to DB
              regardless of plan, so upgrading reveals already-populated IFTA data. */}
          {isPro ? (
            <>
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
            </>
          ) : (
            <TouchableOpacity
              style={styles.stateMileageGate}
              activeOpacity={0.85}
              onPress={() => presentPaywall('ifta')}
            >
              <View style={styles.stateMileageGateLock}>
                <Ionicons name="map-outline" size={18} color={Colors.secondary} />
              </View>
              <Text style={styles.stateMileageGateTitle}>{t('addLoad.stateMileageLockTitle')}</Text>
              <Text style={styles.stateMileageGateSub}>{t('addLoad.stateMileageLockBody')}</Text>
              <View style={styles.stateMileageGateCta}>
                <Text style={styles.stateMileageGateCtaText}>{t('addLoad.stateMileageLockCta')}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Where to Fuel — tax-adjusted stop recommendation (all plans:
                 this is the word-of-mouth hook; the IFTA table stays gated) ── */}
          {fuelPlan && (
            <View style={{ marginTop: 16 }}>
              <FuelStopCard plan={fuelPlan} />
            </View>
          )}

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
              <>
                <View style={styles.fairRow}>
                  <Text style={styles.fairLabel}>{t('addLoad.fairMarket')}</Text>
                  {/* Real driver data leads when available; model becomes the estimate. */}
                  <Text style={styles.fairValue}>
                    {communityRate
                      ? t('addLoad.fairMarketRange', { min: money(communityRate.lowPay), max: money(communityRate.highPay) })
                      : t('addLoad.fairMarketRange', { min: money(fair.minTotal), max: money(fair.maxTotal) })}
                    {!communityRate && !communityLoading ? ` ${t(fair.confidence === 'low' ? 'rateInsights.estRough' : 'rateInsights.estTag')}` : ''}
                  </Text>
                </View>
                {communityRate && (
                  <Text style={styles.fairEstLine}>
                    {t(fair.confidence === 'low' ? 'rateInsights.estRough' : 'rateInsights.estTag')} {t('addLoad.fairMarketRange', { min: money(fair.minTotal), max: money(fair.maxTotal) })}
                  </Text>
                )}
              </>
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
                      {t(tierKey(communityRate.tier), { count: communityRate.count })} · ${money(communityRate.lowPay)}–${money(communityRate.highPay)}
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
                  {personalHistory.count >= 2 && gross > 0 && Math.abs(gross - personalHistory.avgPay) >= 1 && (
                    <View style={[styles.usualPill, { backgroundColor: gross >= personalHistory.avgPay ? Colors.primaryDim : Colors.secondaryDim }]}>
                      <Ionicons
                        name={gross >= personalHistory.avgPay ? 'trending-up' : 'trending-down'}
                        size={13}
                        color={gross >= personalHistory.avgPay ? Colors.primary : Colors.secondary}
                      />
                      <Text style={[styles.usualPillText, { color: gross >= personalHistory.avgPay ? Colors.primary : Colors.secondary }]}>
                        {t(gross >= personalHistory.avgPay ? 'rateInsights.aboveUsual' : 'rateInsights.belowUsual', { amount: `$${money(Math.abs(gross - personalHistory.avgPay))}` })}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* ── Load Deductions ── */}
          <View style={styles.sectionDivider} />
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.fieldLabel}>{t('addLoad.deductions')}</Text>
            <Text style={styles.sectionHint}>{t('addLoad.deductionsHint')}</Text>
          </View>

          {/* Quick-add chips */}
          <View style={styles.expenseChips}>
            {[
              { cat: 'scale',     label: t('addLoad.expCat.scale'),     amt: '11' },
              { cat: 'lumper',    label: t('addLoad.expCat.lumper'),     amt: '' },
              { cat: 'toll',      label: t('addLoad.expCat.toll'),       amt: '' },
              { cat: 'detention', label: t('addLoad.expCat.detention'),  amt: '' },
              { cat: 'other',     label: t('addLoad.expCat.other'),      amt: '' },
            ].map(({ cat, label, amt }) => (
              <TouchableOpacity
                key={cat}
                style={styles.expenseChip}
                onPress={() => addExpense(cat, label, amt)}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={13} color={Colors.textSecondary} />
                <Text style={styles.expenseChipText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Expense rows — pencil icon marks the name as editable */}
          {loadExpenses.map((exp) => (
            <View key={exp.id} style={styles.expenseRow}>
              <Ionicons name="pencil-outline" size={13} color={Colors.textTertiary} />
              <TextInput
                style={styles.expenseLabelInput}
                value={exp.label}
                onChangeText={(v) => updateExpense(exp.id, 'label', v)}
                placeholder={t('addLoad.expLabelPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                autoFocus={exp.category === 'other' && exp.label === ''}
              />
              <View style={styles.expenseAmountWrap}>
                <Text style={styles.expenseDollar}>$</Text>
                <TextInput
                  style={styles.expenseAmountInput}
                  value={exp.amount}
                  onChangeText={(v) => updateExpense(exp.id, 'amount', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              <TouchableOpacity onPress={() => removeExpense(exp.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          ))}

          {expensesTotal > 0 && (
            <View style={styles.expenseTotalRow}>
              <Text style={styles.expenseTotalLabel}>{t('addLoad.deductionsTotal')}</Text>
              <Text style={styles.expenseTotalValue}>-${money(expensesTotal)}</Text>
            </View>
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

          {/* ── Status — inline segmented control, defaults set, one tap to change ── */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('addLoad.status')}</Text>
          <View style={styles.statusSeg}>
            {STATUSES.map((s) => {
              const sel = s === status;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusSegBtn, sel && styles.statusSegBtnActive]}
                  onPress={() => setStatus(s)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.statusSegText, sel && styles.statusSegTextActive]} numberOfLines={1}>
                    {t(`addLoad.statuses.${STATUS_I18N[s]}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {status !== 'completed' && (
            <Text style={styles.statusHint}>
              {status === 'in_progress' ? t('addLoad.statusHintActive') : t('addLoad.statusHintUpcoming')}
            </Text>
          )}

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

          {/* ── Deadhead toggle (empty miles — savable with $0 gross for IFTA) ── */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>{t('addLoad.deadhead')}</Text>
              <Text style={styles.toggleHint}>{t('addLoad.deadheadHint')}</Text>
            </View>
            <Switch
              value={deadhead}
              onValueChange={setDeadhead}
              trackColor={{ false: Colors.surfaceHigh, true: Colors.primaryMid }}
              thumbColor={deadhead ? Colors.primary : Colors.textTertiary}
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

              {/* Broker Check (FMCSA) shelved for v1 — see brokerCheck.ts note. */}

              {/* Broker scorecard — appears when broker info is entered */}
              {(brokerScorecard || brokerSCLoading) && (
                <BrokerScorecardCard scorecard={brokerScorecard} loading={brokerSCLoading} />
              )}

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
                <TouchableOpacity onPress={() => setLoadDate(localDateISO())} activeOpacity={0.7}>
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
              <ActivityIndicator color={Colors.onPrimary} />
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

    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.screenH, paddingTop: 12, paddingBottom: 16,
  },
  eyebrow: { ...sectionLabel(Colors), marginBottom: 4 },
  title:   { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary },
  closeBtn: {
    width: 38, height: 38, borderRadius: Radius.pill,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 20 },

  fieldLabel: { ...sectionLabel(Colors), marginBottom: 10 },
  addrHint:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 8 },

  milesLabelRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  milesBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  milesBadgeText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.textSecondary },

  routeErrorRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  routeErrorText: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.secondary, flex: 1 },

  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 14,
  },
  dollarSign:  { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.subtitle, color: Colors.textSecondary, marginRight: 6 },
  bigInput:    { flex: 1, fontFamily: FontFamily.monoBold, fontSize: 28, color: Colors.textPrimary, padding: 0 },
  inputSuffix: { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textSecondary },

  inputCardSm: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 14,
  },
  inputSm: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary, padding: 0 },

  sectionDivider:   { height: 1, backgroundColor: Colors.borderSubtle, marginVertical: 22 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionHint:      { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stateInput: {
    width: 54, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 12,
    fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary,
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
  stateTotalText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption },

  // State mileage gate card (free users) — standard card, no absolute positioning
  stateMileageGate: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 22,
    paddingHorizontal: Spacing.cardPad,
    alignItems: 'center',
    marginTop: 4,
  },
  stateMileageGateLock: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.secondaryDim,
    borderWidth: 1, borderColor: Colors.secondary + '40',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  stateMileageGateTitle: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.body,
    color: Colors.textPrimary, marginBottom: 4, textAlign: 'center',
  },
  stateMileageGateSub: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 17, marginBottom: 14, maxWidth: 260,
  },
  stateMileageGateCta: {
    backgroundColor: Colors.secondary, borderRadius: Radius.pill,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  stateMileageGateCtaText: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.onPrimary,
  },

  fairLockWrap: { marginTop: 10 },

  scanBolBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, paddingVertical: 15,
    marginBottom: 16,
  },
  scanBolBtnDisabled: { opacity: 0.6 },
  scanBolText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.primary },
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
  fairValue: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.textPrimary },
  fairEstLine: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textTertiary, textAlign: 'right', marginTop: 3 },

  // Load expense styles
  expenseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  expenseChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.border,
  },
  expenseChipText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.textSecondary },
  expenseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  expenseLabelInput: {
    flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.label,
    color: Colors.textPrimary, padding: 0,
  },
  expenseAmountWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  expenseDollar: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  expenseAmountInput: {
    width: 70, fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label,
    color: Colors.textPrimary, textAlign: 'right', padding: 0,
  },
  expenseTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4,
  },
  expenseTotalLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  expenseTotalValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.label, color: Colors.danger },

  insightCard: {
    marginTop: 8, padding: 12, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  insightTitle: { fontFamily: FontFamily.medium, fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightValue: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textPrimary },
  usualPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8,
  },
  usualPillText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, letterSpacing: 0.2 },
  insightLoader: { alignSelf: 'flex-start', marginTop: 2 },

  netPreview: {
    backgroundColor: Colors.surface, borderWidth: 2, borderRadius: Radius.md,
    padding: Spacing.cardPad, marginTop: 14, alignItems: 'center',
  },
  netPreviewLabel: { ...sectionLabel(Colors), marginBottom: 8 },
  netPreviewValue: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.cardNumber,
    lineHeight: 40, letterSpacing: -0.5, marginBottom: 4,
  },
  netPreviewSub: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 16,
  },
  dropdownText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },

  // Status segmented control
  statusSeg: {
    flexDirection: 'row', gap: 8,
  },
  statusSegBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 13, paddingHorizontal: 6,
  },
  statusSegBtnActive: {
    backgroundColor: Colors.primaryDim, borderColor: Colors.primary,
  },
  statusSegText:       { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.textSecondary },
  statusSegTextActive: { color: Colors.primary },
  statusHint: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 8, lineHeight: 17 },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14, marginTop: 18,
  },
  toggleText:  { flex: 1, marginRight: 12 },
  toggleLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2 },
  toggleHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  optionalToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 16, marginTop: 4,
  },
  optionalToggleText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },

  textField: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary,
  },
  textArea: { minHeight: 80, paddingTop: 14 },

  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 6,
  },
  dateArrow:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  dateCenter: { flex: 1, alignItems: 'center', gap: 3 },
  dateText:   { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  dateTodayBadge: {
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2,
  },
  dateTodayBadgeText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, color: Colors.primary },
  dateTodayLink:      { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.primary },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17, marginTop: 28,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  saveBtnDisabled:     { backgroundColor: Colors.surfaceHigh, shadowOpacity: 0, elevation: 0 },
  saveBtnText:         { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.onPrimary },
  saveBtnTextDisabled: { color: Colors.textTertiary },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.screenH, paddingTop: 10, paddingBottom: 36,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 14,
  },
  modalTitle:  { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 12 },
  modalScroll: { maxHeight: 380 },
  typeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16, borderRadius: Radius.md, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  typeOptionActive:     { backgroundColor: Colors.primaryDim, borderColor: Colors.primaryMid },
  typeOptionText:       { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary },
  typeOptionTextActive: { fontFamily: FontFamily.monoSemiBold, color: Colors.primary },
});
