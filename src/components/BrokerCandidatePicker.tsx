import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Radius, ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { BrokerCandidate } from '../lib/brokerCheck';

/**
 * "Is this your broker?" disambiguation list shown when a NAME search returns
 * FMCSA matches and no MC number has been entered yet. We never auto-pick —
 * the driver confirms which entity is theirs, then exact verification runs on
 * that entity. Each row shows enough to tell near-identical names apart.
 */
export default function BrokerCandidatePicker({
  candidates,
  loading,
  onPick,
}: {
  candidates: BrokerCandidate[];
  loading:    boolean;
  onPick:     (c: BrokerCandidate) => void;
}) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={Colors.textSecondary} />
        <Text style={styles.loadingText}>{t('addLoad.brokerPick.searching')}</Text>
      </View>
    );
  }

  if (candidates.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('addLoad.brokerPick.title')}</Text>
      {candidates.map((c, i) => (
        <TouchableOpacity
          key={c.dotNumber}
          style={[styles.row, i < candidates.length - 1 && styles.rowBorder]}
          activeOpacity={0.7}
          onPress={() => onPick(c)}
        >
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>
              {c.dbaName && c.dbaName !== c.legalName ? `${c.dbaName} (${c.legalName})` : c.legalName}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[c.city && c.state ? `${c.city}, ${c.state}` : c.state, `DOT ${c.dotNumber}`]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      ))}
      <Text style={styles.footer}>{t('addLoad.brokerPick.footer')}</Text>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginTop: 10 },
  loadingText: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: 14, marginTop: 10,
  },
  title: {
    fontFamily: FontFamily.monoSemiBold, fontSize: 10, color: Colors.labelColor,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle },
  rowText:   { flex: 1 },
  name:      { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textPrimary, marginBottom: 2 },
  meta:      { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.textSecondary },
  footer:    { fontFamily: FontFamily.regular, fontSize: 11, color: Colors.textTertiary, marginTop: 8, lineHeight: 15 },
});
