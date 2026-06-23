import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  Colors, FontFamily, FontSize, Spacing, Radius,
} from '../theme/theme';
import { useSubscription } from '../contexts/SubscriptionContext';

// What triggered the paywall — tailors the headline so the upsell speaks to
// exactly the value the user just reached for. Maps to paywall.reason.* keys.
export type PaywallReason =
  | 'generic'
  | 'fairMarket'
  | 'loadLimit'
  | 'history'
  | 'ifta'
  | 'export';

const URL_TERMS   = 'https://truckernet.novaboostlabs.co/terms';
const URL_PRIVACY = 'https://truckernet.novaboostlabs.co/privacy';

const PRICE_MONTHLY = '$34.99';
const PRICE_ANNUAL  = '$297.99';

const FEATURES: { icon: React.ComponentProps<typeof Ionicons>['name']; key: string }[] = [
  { icon: 'pricetags-outline',  key: 'fairMarket' },
  { icon: 'infinite-outline',   key: 'unlimitedLoads' },
  { icon: 'calendar-outline',   key: 'history' },
  { icon: 'document-text-outline', key: 'ifta' },
  { icon: 'sync-outline',       key: 'sync' },
  { icon: 'stats-chart-outline', key: 'analytics' },
];

interface Props {
  onClose: () => void;
  reason?: PaywallReason;
}

export default function PaywallScreen({ onClose, reason = 'generic' }: Props) {
  const { t } = useTranslation();
  const { isPro, purchase, restore } = useSubscription();
  const [plan, setPlan] = useState<'annual' | 'monthly'>('annual');
  const [busy, setBusy] = useState(false);

  const reasonText =
    reason === 'generic'
      ? t('paywall.subtitleGeneric')
      : t(`paywall.reason.${reason}`);

  async function handlePurchase() {
    setBusy(true);
    const { error } = await purchase(plan);
    setBusy(false);
    if (error) {
      // Mock-first: products aren't live yet, so surface the honest message.
      Alert.alert(t('paywall.comingSoonTitle'), error);
      return;
    }
    onClose();
  }

  async function handleRestore() {
    const { error } = await restore();
    Alert.alert(
      error ? t('paywall.comingSoonTitle') : t('paywall.restoredTitle'),
      error ?? t('paywall.restoredBody'),
    );
    if (!error) onClose();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Close */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <Ionicons name="close" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Crown badge */}
        <View style={styles.crownWrap}>
          <View style={styles.crownCircle}>
            <Ionicons name="diamond" size={26} color={Colors.secondary} />
          </View>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>{t('paywall.badge')}</Text>
          </View>
        </View>

        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.subtitle}>{reasonText}</Text>

        {/* Already Pro short-circuit (e.g. mock toggle on) */}
        {isPro && (
          <View style={styles.alreadyProCard}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            <Text style={styles.alreadyProText}>{t('paywall.alreadyPro')}</Text>
          </View>
        )}

        {/* Feature list */}
        <View style={styles.featureCard}>
          {FEATURES.map((f, i) => (
            <View key={f.key} style={[styles.featureRow, i > 0 && styles.featureDivider]}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={18} color={Colors.primary} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{t(`paywall.features.${f.key}`)}</Text>
                <Text style={styles.featureSub}>{t(`paywall.features.${f.key}Sub`)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plan picker */}
        <PlanOption
          selected={plan === 'annual'}
          onPress={() => setPlan('annual')}
          title={t('paywall.planAnnual')}
          price={PRICE_ANNUAL}
          unit={t('paywall.perYear')}
          sublabel={t('paywall.annualMonthly')}
          badge={t('paywall.saveBadge')}
        />
        <PlanOption
          selected={plan === 'monthly'}
          onPress={() => setPlan('monthly')}
          title={t('paywall.planMonthly')}
          price={PRICE_MONTHLY}
          unit={t('paywall.perMonth')}
        />

        {/* Trial note */}
        <View style={styles.trialNote}>
          <Ionicons name="gift-outline" size={15} color={Colors.primary} />
          <Text style={styles.trialNoteText}>{t('paywall.trialBadge')}</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.cta, busy && styles.ctaDisabled]}
          onPress={handlePurchase}
          activeOpacity={0.85}
          disabled={busy}
        >
          <Text style={styles.ctaText}>{t('paywall.ctaTrial')}</Text>
        </TouchableOpacity>
        <Text style={styles.ctaSub}>
          {t('paywall.ctaThen', {
            price: plan === 'annual'
              ? `${PRICE_ANNUAL}${t('paywall.perYear')}`
              : `${PRICE_MONTHLY}${t('paywall.perMonth')}`,
          })}
        </Text>

        {/* Restore */}
        <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>{t('paywall.restore')}</Text>
        </TouchableOpacity>

        {/* Legal */}
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

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Plan option card ─────────────────────────────────────────────────────────

interface PlanOptionProps {
  selected: boolean;
  onPress: () => void;
  title: string;
  price: string;
  unit: string;
  sublabel?: string;
  badge?: string;
}

function PlanOption({ selected, onPress, title, price, unit, sublabel, badge }: PlanOptionProps) {
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
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{badge}</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  closeBtn: {
    position: 'absolute',
    top: 52, right: Spacing.screenH,
    zIndex: 10,
    width: 36, height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  content: {
    paddingHorizontal: Spacing.screenH,
    paddingTop: 36,
    alignItems: 'center',
  },

  // Crown
  crownWrap: { alignItems: 'center', marginBottom: 18 },
  crownCircle: {
    width: 64, height: 64,
    borderRadius: 32,
    backgroundColor: Colors.secondaryDim,
    borderWidth: 1, borderColor: Colors.secondary + '40',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  proBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  proBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.micro,
    color: Colors.background,
    letterSpacing: 1.5,
  },

  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.title,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },

  alreadyProCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1, borderColor: Colors.primaryMid,
    borderRadius: Radius.md,
    paddingVertical: 12, paddingHorizontal: 16,
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  alreadyProText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.primary,
  },

  // Features
  featureCard: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.cardPad,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13,
  },
  featureDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  featureIcon: {
    width: 34, height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  featureSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },

  // Plan options
  plan: {
    alignSelf: 'stretch',
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  planSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryDim,
  },
  radio: {
    width: 22, height: 22,
    borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioDot: {
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  planInfo: { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  planBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  planBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.micro,
    color: Colors.background,
    letterSpacing: 0.5,
  },
  planSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  planPriceWrap: { alignItems: 'flex-end' },
  planPrice: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.subtitle,
    color: Colors.textPrimary,
  },
  planUnit: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },

  // Trial note
  trialNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 6, marginBottom: 16,
  },
  trialNoteText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.primary,
  },

  // CTA
  cta: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.background,
  },
  ctaSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },

  // Restore
  restoreBtn: { paddingVertical: 14, marginTop: 4 },
  restoreText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },

  // Legal
  legal: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.micro,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  legalLink: {
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
