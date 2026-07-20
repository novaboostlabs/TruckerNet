import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Radius, ThemeColors } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import { UnloggedMilesInsight } from '../db/database';

interface Props {
  insight: UnloggedMilesInsight;
  /** Opens Add Load so the nudge is one tap from being acted on. */
  onLogLoad: () => void;
  onDismiss: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * "You drove more than you logged." Only the odometer knows the truck's real
 * mileage, so this is the one place the app can tell a driver their records are
 * incomplete — which matters because unlogged miles quietly distort break-even,
 * profit per load, AND the IFTA report they file.
 */
export default function UnloggedMilesBanner({ insight, onLogLoad, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="map-outline" size={17} color={Colors.secondary} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>
            {t('dashboard.unloggedTitle', { miles: fmt(insight.gapMiles) })}
          </Text>
          <Text style={styles.sub}>
            {t('dashboard.unloggedSub', {
              odometer: fmt(insight.odometerMiles),
              logged:   fmt(insight.loggedMiles),
            })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={t('common.dismiss')}
        >
          <Ionicons name="close" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.why}>{t('dashboard.unloggedWhy')}</Text>

      <TouchableOpacity style={styles.cta} onPress={onLogLoad} activeOpacity={0.85}>
        <Ionicons name="add-circle-outline" size={15} color={Colors.secondary} />
        <Text style={styles.ctaText}>{t('dashboard.unloggedCta')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  banner: {
    backgroundColor: Colors.secondaryDim,
    borderWidth: 1, borderColor: Colors.secondary + '40',
    borderRadius: Radius.md, padding: 14, marginBottom: 16,
  },
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.secondary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  text:  { flex: 1 },
  title: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textPrimary, marginBottom: 2 },
  sub:   { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, lineHeight: 17 },
  why:   {
    fontFamily: FontFamily.regular, fontSize: FontSize.caption,
    color: Colors.textSecondary, lineHeight: 17, marginTop: 10, marginLeft: 44,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, marginLeft: 44,
  },
  ctaText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.secondary },
});
