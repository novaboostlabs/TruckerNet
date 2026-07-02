import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Spacing, Radius, ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { capture } from '../lib/analytics';
import GridBackground from '../components/GridBackground';
import AccentRule from '../components/AccentRule';
import { getValueMissedStats, ValueMissedStats } from '../db/database';

export type PaywallReason =
  | 'generic'
  | 'fairMarket'
  | 'loadLimit'
  | 'history'
  | 'ifta'
  | 'export'
  | 'analytics';

const URL_TERMS   = 'https://truckernet.novaboostlabs.co/terms';
const URL_PRIVACY = 'https://truckernet.novaboostlabs.co/privacy';

// Fallbacks only — real prices come live from RevenueCat (see useSubscription).
// Used in Expo Go / before offerings load so the screen never renders blank.
const FALLBACK_MONTHLY = { priceString: '$34.99',  price: 34.99 };
const FALLBACK_ANNUAL  = { priceString: '$297.99', price: 297.99 };

// Format a derived amount (per-month equivalent, savings) reusing the currency
// symbol/placement of a store-provided localized price string, so $/€/£ all work
// without depending on Intl currency support in Hermes.
function priceLike(template: string, amount: number): string {
  const m = template.match(/^(\D*)([\d.,]+)(\D*)$/);
  if (!m) return `$${amount.toFixed(2)}`;
  return `${m[1]}${amount.toFixed(2)}${m[3]}`;
}

type FeatureKey = 'fairMarket' | 'unlimitedLoads' | 'history' | 'ifta' | 'sync' | 'analytics';

interface Feature {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  key: FeatureKey;
}

const ALL_FEATURES: Feature[] = [
  { icon: 'pricetags-outline',     key: 'fairMarket' },
  { icon: 'infinite-outline',      key: 'unlimitedLoads' },
  { icon: 'calendar-outline',      key: 'history' },
  { icon: 'document-text-outline', key: 'ifta' },
  { icon: 'sync-outline',          key: 'sync' },
  { icon: 'stats-chart-outline',   key: 'analytics' },
];

// Per-reason config: which i18n title key + which feature to surface first.
const REASON_CONFIG: Record<PaywallReason, {
  titleKey: string;
  heroIcon: React.ComponentProps<typeof Ionicons>['name'];
  highlight: FeatureKey;
}> = {
  generic:    { titleKey: 'paywall.title',              heroIcon: 'diamond',             highlight: 'fairMarket' },
  fairMarket: { titleKey: 'paywall.titleFairMarket',    heroIcon: 'pricetags-outline',   highlight: 'fairMarket' },
  loadLimit:  { titleKey: 'paywall.titleLoadLimit',     heroIcon: 'infinite-outline',    highlight: 'unlimitedLoads' },
  history:    { titleKey: 'paywall.titleHistory',       heroIcon: 'calendar-outline',    highlight: 'history' },
  ifta:       { titleKey: 'paywall.titleIfta',          heroIcon: 'map-outline',         highlight: 'ifta' },
  export:     { titleKey: 'paywall.titleExport',        heroIcon: 'download-outline',    highlight: 'ifta' },
  analytics:  { titleKey: 'paywall.titleAnalytics',     heroIcon: 'stats-chart-outline', highlight: 'analytics' },
};

interface Props {
  onClose: () => void;
  reason?: PaywallReason;
}

export default function PaywallScreen({ onClose, reason = 'generic' }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const { isPro, purchase, restore, pricing, trialEligible } = useSubscription();
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual');
  const [busy, setBusy] = useState(false);

  const config = REASON_CONFIG[reason];

  // Value-missed stats — computed once when the paywall opens.
  // Only shown for fairMarket and loadLimit reasons where we have real numbers.
  const valueMissed = useMemo<ValueMissedStats | null>(() => {
    if (reason !== 'fairMarket' && reason !== 'loadLimit' && reason !== 'generic') return null;
    const stats = getValueMissedStats(30); // last 30 days
    return stats.lowballCount > 0 ? stats : null;
  }, [reason]);

  // Live store prices with safe fallbacks.
  const monthly = pricing.monthly ?? FALLBACK_MONTHLY;
  const annual  = pricing.annual  ?? FALLBACK_ANNUAL;

  // Derived figures, computed from the real numbers — never hardcoded.
  const annualPerMonth = priceLike(annual.priceString, annual.price / 12);
  const savingsPct     = monthly.price > 0
    ? Math.round((1 - annual.price / (monthly.price * 12)) * 100)
    : 0;

  // Only promise a free trial when the selected plan is actually eligible.
  const trialOnPlan = plan === 'annual' ? trialEligible.annual : trialEligible.monthly;

  // Put the triggered feature first, then the rest in original order.
  const features = useMemo(() => {
    const highlighted = ALL_FEATURES.find(f => f.key === config.highlight)!;
    const rest = ALL_FEATURES.filter(f => f.key !== config.highlight);
    return [highlighted, ...rest];
  }, [config.highlight]);

  const subtitle = reason === 'generic'
    ? t('paywall.subtitleGeneric')
    : t(`paywall.reason.${reason}`);

  async function handlePurchase() {
    capture('upgrade_tapped', { plan, reason });
    setBusy(true);
    const { error } = await purchase(plan);
    setBusy(false);
    if (error) {
      Alert.alert(t('paywall.purchaseFailedTitle'), error);
      return;
    }
    capture('subscription_purchased', { plan, reason });
    onClose();
  }

  async function handleRestore() {
    const { error } = await restore();
    Alert.alert(
      error ? t('paywall.purchaseFailedTitle') : t('paywall.restoredTitle'),
      error ?? t('paywall.restoredBody'),
    );
    if (!error) {
      capture('subscription_restored');
      onClose();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GridBackground />
      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => { capture('paywall_dismissed', { reason }); onClose(); }} activeOpacity={0.7}>
        <Ionicons name="close" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={styles.heroWrap}>
          <View style={styles.heroIconCircle}>
            <Ionicons name={config.heroIcon} size={28} color={Colors.secondary} />
          </View>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>{t('paywall.badge')}</Text>
          </View>
        </View>

        <Text style={styles.title}>{t(config.titleKey)}</Text>
        <AccentRule style={{ marginTop: 10, marginBottom: 14 }} />

        {/* Value-missed callout — replaces generic subtitle when we have real numbers */}
        {valueMissed ? (
          <View style={styles.valueMissedCard}>
            <Text style={styles.valueMissedNumber}>
              ${valueMissed.estimatedLost.toLocaleString('en-US')}
            </Text>
            <Text style={styles.valueMissedLabel}>
              {t('paywall.valueMissed', {
                count: valueMissed.lowballCount,
                amount: `$${valueMissed.estimatedLost.toLocaleString('en-US')}`,
              })}
            </Text>
          </View>
        ) : (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}

        {/* Already Pro short-circuit */}
        {isPro && (
          <View style={styles.alreadyProCard}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.alreadyProText}>{t('paywall.alreadyPro')}</Text>
          </View>
        )}

        {/* ── Feature list — highlighted feature appears first ── */}
        <View style={styles.featureCard}>
          {features.map((f, i) => {
            const isHighlight = f.key === config.highlight;
            return (
              <View
                key={f.key}
                style={[
                  styles.featureRow,
                  i > 0 && styles.featureDivider,
                  isHighlight && styles.featureRowHighlight,
                ]}
              >
                <View style={[styles.featureIcon, isHighlight && styles.featureIconHighlight]}>
                  <Ionicons
                    name={f.icon}
                    size={18}
                    color={isHighlight ? Colors.secondary : Colors.primary}
                  />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, isHighlight && styles.featureTitleHighlight]}>
                    {t(`paywall.features.${f.key}`)}
                  </Text>
                  <Text style={styles.featureSub}>{t(`paywall.features.${f.key}Sub`)}</Text>
                </View>
                {isHighlight && (
                  <View style={styles.featureNewBadge}>
                    <Text style={styles.featureNewBadgeText}>{t('paywall.unlocks')}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── ROI callout ── */}
        <View style={styles.roiCard}>
          <Ionicons name="trending-up-outline" size={15} color={Colors.primary} />
          <Text style={styles.roiText}>{t('paywall.roi')}</Text>
        </View>

        {/* ── Plan picker ── */}
        <PlanOption
          selected={plan === 'annual'}
          onPress={() => setPlan('annual')}
          title={t('paywall.planAnnual')}
          price={annual.priceString}
          unit={t('paywall.perYear')}
          sublabel={t('paywall.annualMonthly', { price: annualPerMonth })}
          badge={t('paywall.bestValue')}
          savingsBadge={savingsPct > 0 ? t('paywall.saveBadge', { pct: savingsPct }) : undefined}
        />
        <PlanOption
          selected={plan === 'monthly'}
          onPress={() => setPlan('monthly')}
          title={t('paywall.planMonthly')}
          price={monthly.priceString}
          unit={t('paywall.perMonth')}
        />

        {/* ── Trial note (only when the selected plan still offers a trial) ── */}
        {trialOnPlan && (
          <View style={styles.trialNote}>
            <Ionicons name="gift-outline" size={15} color={Colors.primary} />
            <Text style={styles.trialNoteText}>{t('paywall.trialBadge')}</Text>
          </View>
        )}

        {/* ── CTA ── */}
        <TouchableOpacity
          style={[styles.cta, busy && styles.ctaDisabled]}
          onPress={handlePurchase}
          activeOpacity={0.85}
          disabled={busy}
        >
          <Text style={styles.ctaText}>
            {busy
              ? t('common.loading')
              : trialOnPlan ? t('paywall.ctaTrial') : t('paywall.ctaSubscribe')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.ctaSub}>
          {(() => {
            const price = plan === 'annual'
              ? `${annual.priceString}${t('paywall.perYear')}`
              : `${monthly.priceString}${t('paywall.perMonth')}`;
            return trialOnPlan
              ? t('paywall.ctaThen', { price })
              : t('paywall.ctaPriceLine', { price });
          })()}
        </Text>

        {/* ── Trust strip ── */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.trustText}>{t('paywall.secure')}</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="close-circle-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.trustText}>{t('paywall.cancelAnytime')}</Text>
          </View>
        </View>

        {/* ── Restore + Legal ── */}
        <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>{t('paywall.restore')}</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          {t('paywall.legal')}{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(URL_TERMS)}>
            {t('settings.terms')}
          </Text>
          {' · '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(URL_PRIVACY)}>
            {t('settings.privacy')}
          </Text>
        </Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Plan option ──────────────────────────────────────────────────────────────

interface PlanOptionProps {
  selected:      boolean;
  onPress:       () => void;
  title:         string;
  price:         string;
  unit:          string;
  sublabel?:     string;
  badge?:        string;   // "BEST VALUE"
  savingsBadge?: string;   // "SAVE $122"
}

function PlanOption({ selected, onPress, title, price, unit, sublabel, badge, savingsBadge }: PlanOptionProps) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <TouchableOpacity
      style={[styles.plan, selected && styles.planSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={styles.planInfo}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planTitle}>{title}</Text>
          {badge && (
            <View style={styles.planBestValue}>
              <Text style={styles.planBestValueText}>{badge}</Text>
            </View>
          )}
          {savingsBadge && (
            <View style={styles.planSavings}>
              <Text style={styles.planSavingsText}>{savingsBadge}</Text>
            </View>
          )}
        </View>
        {sublabel && <Text style={styles.planSub}>{sublabel}</Text>}
      </View>
      <View style={styles.planPriceWrap}>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planUnit}>{unit}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.background },

  closeBtn: {
    position: 'absolute', top: 52, right: Spacing.screenH, zIndex: 10,
    width: 36, height: 36, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  content: {
    paddingHorizontal: Spacing.screenH,
    paddingTop: 40,
    alignItems: 'center',
  },

  // Hero
  heroWrap:       { alignItems: 'center', marginBottom: 20 },
  heroIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.secondaryDim,
    borderWidth: 1.5, borderColor: Colors.secondary + '50',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 18, elevation: 6,
  },
  proBadge: {
    backgroundColor: Colors.secondary, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  proBadgeText: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.micro,
    color: Colors.onPrimary, letterSpacing: 2,
  },

  title: {
    fontFamily: FontFamily.monoBold, fontSize: 26,
    color: Colors.textPrimary, textAlign: 'center',
    marginBottom: 8, letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.regular, fontSize: FontSize.body,
    color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: 28, paddingHorizontal: 8,
  },

  // Value-missed callout — replaces subtitle when real lowball data exists.
  valueMissedCard: {
    backgroundColor: Colors.dangerDim, borderWidth: 1, borderColor: Colors.danger + '40',
    borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 14,
    alignItems: 'center', marginBottom: 28,
  },
  valueMissedNumber: {
    fontFamily: FontFamily.monoBold, fontSize: 36, color: Colors.danger,
    letterSpacing: -1, marginBottom: 6,
  },
  valueMissedLabel: {
    fontFamily: FontFamily.regular, fontSize: FontSize.body,
    color: Colors.textSecondary, textAlign: 'center', lineHeight: 20,
  },

  alreadyProCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 16,
    alignSelf: 'stretch', marginBottom: 20,
  },
  alreadyProText: {
    fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.label, color: Colors.primary,
  },

  // Feature list
  featureCard: {
    alignSelf: 'stretch', backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.cardPad,
    marginBottom: 16, overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13,
  },
  featureRowHighlight: {
    backgroundColor: Colors.secondaryDim + '60',
    marginHorizontal: -Spacing.cardPad,
    paddingHorizontal: Spacing.cardPad,
    borderLeftWidth: 3, borderLeftColor: Colors.secondary,
  },
  featureDivider: { borderTopWidth: 1, borderTopColor: Colors.borderSubtle },
  featureIcon: {
    width: 34, height: 34, borderRadius: Radius.sm,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center', justifyContent: 'center',
  },
  featureIconHighlight: { backgroundColor: Colors.secondaryDim },
  featureText: { flex: 1 },
  featureTitle: {
    fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body,
    color: Colors.textPrimary, marginBottom: 2,
  },
  featureTitleHighlight: { color: Colors.secondary },
  featureSub: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary,
  },
  featureNewBadge: {
    backgroundColor: Colors.secondary, borderRadius: Radius.sm,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  featureNewBadgeText: {
    fontFamily: FontFamily.monoBold, fontSize: 9,
    color: Colors.onPrimary, letterSpacing: 0.5, textTransform: 'uppercase',
  },

  // ROI callout
  roiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'stretch',
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 24,
  },
  roiText: {
    flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.label,
    color: Colors.primary, lineHeight: 18,
  },

  // Plan options
  plan: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, padding: 16, marginBottom: 10,
  },
  planSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.primary },
  planInfo:     { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  planTitle: {
    fontFamily: FontFamily.monoSemiBold, fontSize: FontSize.body, color: Colors.textPrimary,
  },
  planBestValue: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  planBestValueText: {
    fontFamily: FontFamily.monoBold, fontSize: 9,
    color: Colors.onPrimary, letterSpacing: 0.8,
  },
  planSavings: {
    backgroundColor: Colors.secondaryDim, borderRadius: Radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.secondary + '40',
  },
  planSavingsText: {
    fontFamily: FontFamily.monoBold, fontSize: 9, color: Colors.secondary, letterSpacing: 0.5,
  },
  planSub: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.textSecondary, marginTop: 3,
  },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.subtitle, color: Colors.textPrimary,
  },
  planUnit: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary,
  },

  // Trial note
  trialNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 20,
  },
  trialNoteText: {
    fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.primary,
  },

  // CTA
  cta: {
    alignSelf: 'stretch', backgroundColor: Colors.primary,
    borderRadius: Radius.md, paddingVertical: 18, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    fontFamily: FontFamily.monoBold, fontSize: FontSize.body, color: Colors.onPrimary,
  },
  ctaSub: {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.textSecondary, textAlign: 'center', marginTop: 10,
  },

  // Trust strip
  trustStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 4,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: {
    fontFamily: FontFamily.regular, fontSize: FontSize.micro, color: Colors.textTertiary,
  },
  trustDot: {
    width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.textTertiary,
  },

  // Restore / Legal
  restoreBtn: { paddingVertical: 14, marginTop: 4 },
  restoreText: {
    fontFamily: FontFamily.medium, fontSize: FontSize.label,
    color: Colors.textSecondary, textDecorationLine: 'underline',
  },
  legal: {
    fontFamily: FontFamily.regular, fontSize: FontSize.micro,
    color: Colors.textTertiary, textAlign: 'center', lineHeight: 16, paddingHorizontal: 12,
  },
  legalLink: { color: Colors.textSecondary, textDecorationLine: 'underline' },
});
