import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Radius, ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { BrokerCheckResult } from '../lib/brokerCheck';

/**
 * FMCSA authority verification result, shown under the MC-number field.
 * Objective facts only (authority status / OOS / record existence) — the
 * copy never says "scam", it says "verify before booking".
 */
export default function BrokerCheckCard({ result }: { result: BrokerCheckResult }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();

  const v = result.verdict;
  const color =
    v === 'verified' ? Colors.primary :
    v === 'caution'  ? Colors.danger :
    Colors.secondary; // not_found → amber "verify first"

  const icon: React.ComponentProps<typeof Ionicons>['name'] =
    v === 'verified' ? 'shield-checkmark' :
    v === 'caution'  ? 'alert-circle' :
    'help-circle';

  const title =
    v === 'verified' ? t('addLoad.brokerCheck.verified') :
    v === 'caution'  ? t('addLoad.brokerCheck.caution') :
    t('addLoad.brokerCheck.notFound');

  const detail =
    v === 'verified'
      ? (result.legalName ?? '')
      : v === 'caution'
        ? [
            result.legalName,
            result.oosDate ? t('addLoad.brokerCheck.oos', { date: result.oosDate }) : null,
            result.allowedToOperate === 'N' ? t('addLoad.brokerCheck.notAllowed') : null,
            result.statusCode === 'I' ? t('addLoad.brokerCheck.inactive') : null,
          ].filter(Boolean).join(' · ')
        : t('addLoad.brokerCheck.notFoundHint');

  return (
    <View style={[styles.card, { borderColor: color + '50' }]}>
      <Ionicons name={icon} size={16} color={color} style={{ marginTop: 1 }} />
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color }]}>{title}</Text>
        {!!detail && <Text style={styles.detail}>{detail}</Text>}
        <Text style={styles.source}>{t('addLoad.brokerCheck.source')}</Text>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderWidth: 1,
    borderRadius: Radius.md, padding: 14, marginTop: 10,
  },
  textWrap: { flex: 1 },
  title:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, marginBottom: 2 },
  detail:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 17 },
  source:   { fontFamily: FontFamily.monoRegular, fontSize: 10, color: Colors.textTertiary, marginTop: 5, letterSpacing: 0.4 },
});
