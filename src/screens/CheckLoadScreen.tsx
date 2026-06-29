import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Switch, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, SectionLabel, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { calcBreakEven, getPersonalLaneHistory, LaneHistory } from '../db/database';
import {
  getFairMarketRate, calcDeadheadCost, LoadType,
} from '../utils/marketRates';
import AddressAutocomplete from '../components/AddressAutocomplete';
import FairMarketLock from '../components/FairMarketLock';
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePaywall } from '../contexts/PaywallContext';
import { getRouteMiles, AddressSuggestion } from '../lib/mapbox';
import { AddLoadPrefill } from './AddLoadScreen';
import { getCommunityRate, CommunityRate, CommunityTier } from '../lib/rateReports';
import { capture } from '../lib/analytics';
import * as haptics from '../lib/haptics';
import { getBrokerScorecard, BrokerScorecard } from '../lib/brokerScorecard';
import BrokerScorecardCard from '../components/BrokerScorecardCard';

// Maps a community-data confidence tier to its i18n label key.
function tierKey(tier: CommunityTier): string {
  return tier === 'exact'    ? 'rateInsights.tierExact'
       : tier === 'corridor' ? 'rateInsights.tierCorridor'
       :                        'rateInsights.tierNational';
}

interface Props {
  onClose: () => void;
  onLogLoad?: (prefill: AddLoadPrefill) => void;
}

const LOAD_TYPES: LoadType[] = [
  'dry_van', 'reefer', 'flatbed', 'step_deck', 'intermodal',
  'tanker', 'hazmat', 'rgn', 'power_only', 'auto_transport',
];

type Verdict = 'green' | 'amber' | 'red';

function money(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function extractState(label: string): string {
  const m = label.match(/,\s*([A-Z]{2})(?:\s+\d{5}[-\d]*)?(?:,|\s*$)/);
  return m?.[1] ?? '';
}

export default function CheckLoadScreen({ onClose, onLogLoad }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const { isPro } = useSubscription();
  const { present: presentPaywall } = usePaywall();

  const [pay, setPay]           = useState('');
  const [miles, setMiles]       = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [brokerMC,   setBrokerMC]   = useState('');
  const [brokerScorecard, setBrokerScorecard] = useState<BrokerScorecard | null>(null);
  const [brokerSCLoading, setBrokerSCLoading] = useState(false);

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

  function cap(raw: string, max: number): string {
    const n = parseFloat(raw);
    return (!isNaN(n) && n > max) ? String(max) : raw;
  }
  const [milesAuto, setMilesAuto] = useState(false);   // miles came from routing, not manual entry
  const [pickup, setPickup]     = useState('');
  const [delivery, setDelivery] = useState('');
  const [pickupSel, setPickupSel]     = useState<AddressSuggestion | null>(null);
  const [deliverySel, setDeliverySel] = useState<AddressSuggestion | null>(null);
  const [routing, setRouting]     = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [loadType, setLoadType] = useState<LoadType>('dry_van');
  const [typeOpen, setTypeOpen] = useState(false);
  const [backhaul, setBackhaul] = useState(false);

  // ── Community + personal lane rate insights ──
  const [communityRate,    setCommunityRate]    = useState<CommunityRate | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);

  const personalHistory = useMemo<LaneHistory | null>(() => {
    if (!pickupSel || !deliverySel) return null;
    return getPersonalLaneHistory({
      pickupLat: pickupSel.lat, pickupLng: pickupSel.lng,
      deliveryLat: deliverySel.lat, deliveryLng: deliverySel.lng,
      originState: extractState(pickupSel.label),
      destState:   extractState(deliverySel.label),
      equipment:   loadType,
    });
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

  // When both endpoints are geocoded, auto-fill miles from the driving route.
  useEffect(() => {
    if (!pickupSel || !deliverySel) return;
    const ctrl = new AbortController();
    let cancelled = false;
    setRouting(true);
    setRouteError(false);
    getRouteMiles(pickupSel, deliverySel, ctrl.signal)
      .then((mi) => {
        if (cancelled) return;
        setMiles(String(Math.round(mi)));
        setMilesAuto(true);
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return;
        console.error('[TruckerNet] Route calculation failed:', err?.message ?? err);
        setRouteError(true);
      })
      .finally(() => { if (!cancelled) setRouting(false); });
    return () => { cancelled = true; ctrl.abort(); };
  }, [pickupSel, deliverySel]);

  // Break-even is fixed for the session (derived from saved expenses + fuel + miles).
  const { breakEvenRPM, fuelCPM, fixedCPM } = useMemo(() => calcBreakEven(), []);

  const grossPay  = parseFloat(pay)   || 0;
  const loadMiles = parseFloat(miles) || 0;
  const hasInputs = grossPay > 0 && loadMiles > 0;

  const fuelCost  = loadMiles * fuelCPM;
  const fixedCost = loadMiles * fixedCPM;
  const netPay    = grossPay - fuelCost - fixedCost;
  const netRPM    = loadMiles > 0 ? netPay / loadMiles : 0;
  const deltaRPM  = netRPM - breakEvenRPM;

  const hasBreakEven = breakEvenRPM > 0;

  let verdict: Verdict = 'red';
  if (hasBreakEven) {
    if (netRPM >= breakEvenRPM * 1.15)   verdict = 'green';
    else if (netRPM > breakEvenRPM)      verdict = 'amber';
    else                                 verdict = 'red';
  } else {
    verdict = netPay > 0 ? 'green' : 'red';
  }

  const isBackhaulRescue = backhaul && verdict === 'red';

  // Pass origin/dest states (when both endpoints are geocoded) so the fair-market
  // estimate reflects regional market strength, not just miles + equipment.
  const fairOrigin = pickupSel   ? extractState(pickupSel.label)   : undefined;
  const fairDest   = deliverySel ? extractState(deliverySel.label) : undefined;
  const fair = hasInputs ? getFairMarketRate(loadMiles, loadType, grossPay, fairOrigin, fairDest) : null;
  const deadheadCost = calcDeadheadCost(loadMiles, fuelCPM, fixedCPM);

  const verdictColor =
    isBackhaulRescue ? Colors.secondary :
    verdict === 'green' ? Colors.primary :
    verdict === 'amber' ? Colors.secondary :
    Colors.danger;

  const verdictLabel =
    isBackhaulRescue ? t('checkLoad.result.backhaul') :
    verdict === 'red' ? t('checkLoad.result.notWorthIt') :
    t('checkLoad.result.worthIt');

  const verdictIcon: React.ComponentProps<typeof Ionicons>['name'] =
    isBackhaulRescue ? 'swap-horizontal' :
    verdict === 'red' ? 'close-circle' :
    'checkmark-circle';

  // Fire a haptic the moment a verdict first appears so the driver feels it.
  const prevHasInputs = React.useRef(false);
  useEffect(() => {
    if (hasInputs && !prevHasInputs.current) {
      haptics.verdict(verdict);
    }
    prevHasInputs.current = hasInputs;
  }, [hasInputs, verdict]);

  function handleClose() {
    if (hasInputs) {
      capture('check_load_used', {
        verdict, load_type: loadType, miles: loadMiles,
        gross_pay: grossPay, net_pay: netPay, is_backhaul: backhaul,
      });
    }
    onClose();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('checkLoad.title').toUpperCase()}</Text>
            <Text style={styles.title}>{t('checkLoad.subtitle')}</Text>
            <AccentRule style={{ marginTop: 8 }} />
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>

          {/* Load pay */}
          <Text style={styles.fieldLabel}>{t('checkLoad.loadPay')}</Text>
          <View style={styles.inputCard}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.bigInput}
              value={pay}
              onChangeText={(v) => setPay(cap(v, 100000))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          {/* Pickup */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('checkLoad.pickup')}</Text>
          <AddressAutocomplete
            value={pickup}
            onChangeText={(v) => { setPickup(v); if (pickupSel) { setPickupSel(null); setMilesAuto(false); } }}
            onSelect={setPickupSel}
            placeholder={t('checkLoad.addressPlaceholder')}
            icon="ellipse-outline"
          />

          {/* Delivery */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('checkLoad.delivery')}</Text>
          <AddressAutocomplete
            value={delivery}
            onChangeText={(v) => { setDelivery(v); if (deliverySel) { setDeliverySel(null); setMilesAuto(false); } }}
            onSelect={setDeliverySel}
            placeholder={t('checkLoad.addressPlaceholder')}
            icon="location"
            iconColor={Colors.primary}
          />
          <Text style={styles.addrHint}>{t('checkLoad.addressEncourage')}</Text>

          {/* Miles — auto-filled from the route, still editable as an override */}
          <View style={styles.milesLabelRow}>
            <Text style={styles.fieldLabel}>{t('common.miles').toUpperCase()}</Text>
            {routing ? (
              <View style={styles.milesBadge}>
                <ActivityIndicator size="small" color={Colors.textSecondary} />
                <Text style={styles.milesBadgeText}>{t('checkLoad.calculating')}</Text>
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
              onChangeText={(v) => { setMiles(cap(v, 15000)); setMilesAuto(false); }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.inputSuffix}>mi</Text>
          </View>
          {routeError && (
            <View style={styles.routeErrorRow}>
              <Ionicons name="warning-outline" size={14} color={Colors.secondary} />
              <Text style={styles.routeErrorText}>Couldn't auto-calculate — enter miles manually above.</Text>
            </View>
          )}

          {/* Load type */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('checkLoad.loadType')}</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setTypeOpen(true)} activeOpacity={0.8}>
            <Text style={styles.dropdownText}>{t(`addLoad.loadTypes.${loadType}`)}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.primary} />
          </TouchableOpacity>

          {/* Broker (optional) */}
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('addLoad.broker')} <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.brokerInput}
            value={brokerName}
            onChangeText={setBrokerName}
            placeholder={t('addLoad.brokerName')}
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="done"
            autoCorrect={false}
          />
          {(brokerScorecard || brokerSCLoading) && (
            <BrokerScorecardCard scorecard={brokerScorecard} loading={brokerSCLoading} />
          )}

          {/* Backhaul toggle */}
          <View style={[styles.toggleCard, { marginTop: 18 }]}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>{t('checkLoad.backhaul')}</Text>
              <Text style={styles.toggleHint}>{t('checkLoad.backhaulHint')}</Text>
            </View>
            <Switch
              value={backhaul}
              onValueChange={setBackhaul}
              trackColor={{ false: Colors.surfaceHigh, true: Colors.primaryMid }}
              thumbColor={backhaul ? Colors.primary : Colors.textTertiary}
            />
          </View>

          {/* ── Personal lane history (shown as soon as both endpoints are known) ── */}
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
              {personalHistory.count >= 2 && grossPay > 0 && Math.abs(grossPay - personalHistory.avgPay) >= 1 && (
                <View style={[styles.usualPill, { backgroundColor: grossPay >= personalHistory.avgPay ? Colors.primaryDim : Colors.secondaryDim }]}>
                  <Ionicons
                    name={grossPay >= personalHistory.avgPay ? 'trending-up' : 'trending-down'}
                    size={13}
                    color={grossPay >= personalHistory.avgPay ? Colors.primary : Colors.secondary}
                  />
                  <Text style={[styles.usualPillText, { color: grossPay >= personalHistory.avgPay ? Colors.primary : Colors.secondary }]}>
                    {t(grossPay >= personalHistory.avgPay ? 'rateInsights.aboveUsual' : 'rateInsights.belowUsual', { amount: `$${money(Math.abs(grossPay - personalHistory.avgPay))}` })}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Result ── */}
          {hasInputs && (
            <View style={[styles.resultCard, { borderColor: verdictColor }]}>
              <View style={styles.verdictRow}>
                <Ionicons name={verdictIcon} size={20} color={verdictColor} />
                <Text style={[styles.verdictLabel, { color: verdictColor }]}>{verdictLabel}</Text>
              </View>

              <Text style={styles.netLabel}>{t('checkLoad.result.netPay')}</Text>
              <Text style={[styles.netValue, { color: netPay >= 0 ? Colors.primary : Colors.danger }]}>
                {netPay < 0 ? '-' : ''}${money(Math.abs(netPay))}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>{t('checkLoad.result.ratePerMile')}</Text>
                  <Text style={styles.statValue}>${netRPM.toFixed(3)}</Text>
                </View>
                <View style={styles.statSep} />
                <View style={styles.statCell}>
                  <Text style={styles.statLabel}>{t('checkLoad.result.breakEven')}</Text>
                  <Text style={styles.statValue}>{hasBreakEven ? `$${breakEvenRPM.toFixed(3)}` : '—'}</Text>
                </View>
              </View>

              {hasBreakEven && (
                <View style={[styles.deltaPill, { backgroundColor: deltaRPM >= 0 ? Colors.primaryDim : Colors.dangerDim }]}>
                  <Ionicons
                    name={deltaRPM >= 0 ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={deltaRPM >= 0 ? Colors.primary : Colors.danger}
                  />
                  <Text style={[styles.deltaText, { color: deltaRPM >= 0 ? Colors.primary : Colors.danger }]}>
                    {deltaRPM >= 0
                      ? t('checkLoad.result.aboveBreakEven', { amount: `$${Math.abs(deltaRPM).toFixed(3)}` })
                      : t('checkLoad.result.belowBreakEven', { amount: `$${Math.abs(deltaRPM).toFixed(3)}` })}
                  </Text>
                </View>
              )}

              {/* Backhaul reframe */}
              {isBackhaulRescue && (
                <View style={styles.backhaulNote}>
                  <Ionicons name="information-circle" size={16} color={Colors.secondary} />
                  <Text style={styles.backhaulText}>
                    {t('checkLoad.result.deadheadSaving', { amount: `$${money(deadheadCost)}` })}
                  </Text>
                </View>
              )}

              {/* Fair market — Pro-gated. Free users see the upgrade lock;
                  the break-even verdict above stays free + unlimited. */}
              {fair && (
                isPro ? (
                  <>
                    {/* When real driver data exists it leads as the headline; the
                        seeded model is shown as a labeled estimate beneath it. */}
                    {communityRate ? (
                      <>
                        <View style={styles.fairRow}>
                          <Text style={styles.fairLabel}>
                            {t('checkLoad.result.fairMarket', { type: t(`addLoad.loadTypes.${loadType}`) })}
                          </Text>
                          <Text style={styles.fairValue}>
                            ${money(communityRate.lowPay)}–${money(communityRate.highPay)}
                          </Text>
                        </View>
                        <View style={styles.communityRow}>
                          <Ionicons name="people-outline" size={13} color={Colors.primary} />
                          <Text style={styles.communityText}>
                            {t(tierKey(communityRate.tier), { count: communityRate.count })}
                          </Text>
                        </View>
                        <Text style={styles.estLine}>
                          {t(fair.confidence === 'low' ? 'rateInsights.estRough' : 'rateInsights.estTag')} ${money(fair.minTotal)}–${money(fair.maxTotal)}
                        </Text>
                      </>
                    ) : (
                      <View style={styles.fairRow}>
                        <Text style={styles.fairLabel}>
                          {t('checkLoad.result.fairMarket', { type: t(`addLoad.loadTypes.${loadType}`) })}
                        </Text>
                        <Text style={styles.fairValue}>
                          ${money(fair.minTotal)}–${money(fair.maxTotal)}
                          {communityLoading ? '' : ` ${t(fair.confidence === 'low' ? 'rateInsights.estRough' : 'rateInsights.estTag')}`}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.fairLockWrap}>
                    <FairMarketLock onUpgrade={() => presentPaywall('fairMarket')} />
                  </View>
                )
              )}

              {!hasBreakEven && (
                <Text style={styles.setupNote}>{t('checkLoad.noBreakEven')}</Text>
              )}
            </View>
          )}

          {/* Log this load */}
          <TouchableOpacity
            style={[styles.logBtn, !hasInputs && styles.logBtnDisabled]}
            onPress={() => {
              onLogLoad?.({
                grossPay:    pay,
                miles:       miles,
                milesAuto,
                pickupText:  pickup,
                deliveryText: delivery,
                pickupSel,
                deliverySel,
                loadType,
                backhaul,
              });
              onClose();
            }}
            disabled={!hasInputs}
            activeOpacity={0.85}
          >
            <Text style={[styles.logBtnText, !hasInputs && styles.logBtnTextDisabled]}>
              {t('checkLoad.result.logLoad')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={hasInputs ? Colors.background : Colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeTextBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.closeTextBtnLabel}>{t('checkLoad.result.close')}</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Load type dropdown */}
      <Modal
        visible={typeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTypeOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setTypeOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('checkLoad.loadType')}</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {LOAD_TYPES.map((type) => {
                const selected = type === loadType;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, selected && styles.typeOptionActive]}
                    onPress={() => { setLoadType(type); setTypeOpen(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeOptionText, selected && styles.typeOptionTextActive]}>
                      {t(`addLoad.loadTypes.${type}`)}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
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
  eyebrow: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 4 },
  title:   { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, maxWidth: 260, letterSpacing: -0.4 },
  closeBtn: {
    width: 38, height: 38, borderRadius: Radius.sm,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: Spacing.screenH, paddingBottom: 20 },

  fieldLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 10 },
  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 14,
  },
  dollarSign:  { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.subtitle, color: Colors.textSecondary, marginRight: 6 },
  bigInput:    { flex: 1, fontFamily: FontFamily.monoBold, fontSize: 28, color: Colors.textPrimary, padding: 0 },
  inputSuffix: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.body, color: Colors.textSecondary },

  addrHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 8 },

  milesLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18,
  },
  milesBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  milesBadgeText: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary, letterSpacing: 0.3 },

  routeErrorRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  routeErrorText: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.secondary, flex: 1 },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 16,
  },
  dropdownText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },

  // Load type dropdown sheet
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.screenH, paddingTop: 10, paddingBottom: 36,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 14,
  },
  modalTitle:  { fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary, marginBottom: 12, letterSpacing: -0.4 },
  modalScroll: { maxHeight: 380 },
  typeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16, borderRadius: Radius.sm, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  typeOptionActive:     { backgroundColor: Colors.primaryDim, borderColor: Colors.primaryMid },
  typeOptionText:       { fontFamily: FontFamily.medium, fontSize: FontSize.body, color: Colors.textPrimary },
  typeOptionTextActive: { fontFamily: FontFamily.semiBold, color: Colors.primary },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
  },
  toggleText:  { flex: 1, marginRight: 12 },
  toggleLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: 2, letterSpacing: -0.3 },
  toggleHint:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  resultCard: {
    backgroundColor: Colors.surface, borderWidth: 2, borderRadius: Radius.md,
    padding: Spacing.cardPad, marginTop: 24,
  },
  verdictRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  verdictLabel: { fontFamily: FontFamily.monoBold, fontSize: FontSize.body, letterSpacing: -0.3 },

  netLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, marginBottom: 6 },
  netValue: { fontFamily: FontFamily.monoBold, fontSize: FontSize.heroLarge, lineHeight: 56, letterSpacing: -2, marginBottom: 16 },

  statsRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statCell:  { flex: 1 },
  statSep:   { width: 1, height: 32, backgroundColor: Colors.border, marginHorizontal: 16 },
  statLabel: { ...sectionLabel(Colors), fontFamily: FontFamily.monoSemiBold, fontSize: 10, marginBottom: 4 },
  statValue: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.subtitle, color: Colors.textPrimary },

  deltaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7,
  },
  deltaText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label },

  backhaulNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.surfaceHigh, borderRadius: Radius.md,
    padding: 12, marginTop: 14,
  },
  backhaulText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textPrimary, lineHeight: 20 },

  fairLockWrap: {
    marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  fairRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
  },
  fairLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, flex: 1, marginRight: 12 },
  fairValue: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary },

  communityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  communityText: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.primary },
  estLine: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textTertiary, marginTop: 4 },

  insightCard: {
    marginTop: 16, padding: 12, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  insightTitle: { fontFamily: FontFamily.monoSemiBold, fontSize: 11, color: Colors.labelColor, textTransform: 'uppercase', letterSpacing: 1 },
  insightValue: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textPrimary },
  optional: { fontFamily: FontFamily.regular, fontSize: FontSize.micro, color: Colors.textTertiary, letterSpacing: 0.5 },
  brokerInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary,
  },
  usualPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8,
  },
  usualPillText: { fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.caption, letterSpacing: 0.2 },

  setupNote: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 14, lineHeight: 18 },

  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17, marginTop: 24,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  logBtnDisabled:     { backgroundColor: Colors.surfaceHigh, shadowOpacity: 0, elevation: 0 },
  logBtnText:         { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },
  logBtnTextDisabled: { color: Colors.textTertiary },

  closeTextBtn:      { alignItems: 'center', paddingVertical: 16 },
  closeTextBtnLabel: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.body, color: Colors.textSecondary },
});
