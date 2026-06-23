import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Radius } from '../theme/theme';

/**
 * Pro-gated fair-market row shown to free users in place of the actual
 * fair-market $ range (Check Load + Add Load). Tapping it opens the paywall.
 * The break-even verdict stays free — only this "what it SHOULD pay" benchmark
 * is gated. Strong "am I being lowballed?" upsell hook.
 */
export default function FairMarketLock({ onUpgrade }: { onUpgrade: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.lock} onPress={onUpgrade} activeOpacity={0.7}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={14} color={Colors.secondary} />
      </View>
      <Text style={styles.text}>{t('paywall.fairMarketLock')}</Text>
      <Ionicons name="chevron-forward" size={15} color={Colors.secondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.secondaryDim,
    borderWidth: 1,
    borderColor: Colors.secondary + '30',
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 26, height: 26,
    borderRadius: Radius.sm,
    backgroundColor: Colors.secondary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.secondary,
    lineHeight: 18,
  },
});
