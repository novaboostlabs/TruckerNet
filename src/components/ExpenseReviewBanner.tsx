import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Radius, ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { StaleCategoryAlert } from '../db/database';

interface Props {
  alerts: StaleCategoryAlert[];   // category-specific alerts (may be empty)
  daysSince: number | null;       // flat global timer fallback
  onPress: () => void;
}

// Human-readable category names — short enough to fit in a subtitle line.
const CAT_NAME: Record<string, string> = {
  insurance:   'Insurance',
  truck:       'Truck payment',
  eld:         'ELD',
  loadboard:   'Load board',
  maintenance: 'Maintenance',
  parking:     'Parking',
  other:       'Other',
};

export default function ExpenseReviewBanner({ alerts, daysSince, onPress }: Props) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  // Build the subtitle: name the stale categories if known, otherwise fall back.
  const sub = useMemo(() => {
    if (alerts.length > 0) {
      const names = [...new Set(alerts.map((a) => CAT_NAME[a.category] ?? a.label))];
      const listed = names.slice(0, 3).join(', ') + (names.length > 3 ? ' & more' : '');
      return `${listed} may need updating`;
    }
    if (daysSince === null) return t('expenses.reviewBannerNever');
    return t('expenses.reviewBannerDays', { count: daysSince });
  }, [alerts, daysSince, t]);

  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.iconWrap}>
        <Ionicons name="refresh-outline" size={17} color={Colors.secondary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{t('expenses.reviewBannerTitle')}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.secondary} />
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.secondaryDim,
    borderWidth: 1, borderColor: Colors.secondary + '40',
    borderRadius: Radius.md,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 14,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: Radius.sm,
    backgroundColor: Colors.secondary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  text: { flex: 1 },
  title: {
    fontFamily: FontFamily.monoSemiBold,
    fontSize: FontSize.body,
    color: Colors.secondary,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.secondary + 'CC',
    lineHeight: 16,
  },
});
