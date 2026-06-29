import React, { useEffect, useRef, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../theme/theme';
import { useTheme } from '../theme/ThemeContext';
import * as haptics from '../lib/haptics';
import { capture } from '../lib/analytics';

interface Props {
  visible: boolean;
  netPay: number;
  onDismiss: () => void;
}

/**
 * One-time celebration shown after the driver logs their very first load — the
 * "aha" moment where they see their true net pay for the first time. Doubles as
 * a nudge to keep logging every load and expense so the numbers stay accurate.
 * Fired once ever, gated by the `first_load_celebrated` setting (see AddLoadScreen).
 */
export default function FirstLoadCelebration({ visible, netPay, onDismiss }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const scale   = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      haptics.success();
      capture('first_load_celebrated', { net_pay: netPay });
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale,   { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.9);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  const net = `$${Math.round(netPay).toLocaleString('en-US')}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={40} color={Colors.primary} />
          </View>

          <Text style={styles.title}>{t('firstLoad.title')}</Text>

          <Text style={styles.netLabel}>{t('firstLoad.netLabel')}</Text>
          <Text style={styles.net}>{net}</Text>

          <Text style={styles.subtitle}>{t('firstLoad.subtitle')}</Text>

          <View style={styles.accuracyRow}>
            <Ionicons name="pulse-outline" size={16} color={Colors.secondary} />
            <Text style={styles.accuracy}>{t('firstLoad.accuracy')}</Text>
          </View>

          <TouchableOpacity style={styles.cta} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{t('firstLoad.cta')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000C0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenH,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primaryMid,
    paddingHorizontal: Spacing.cardPad,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  badge: {
    width: 64, height: 64, borderRadius: Radius.md,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: FontFamily.monoBold,
    fontSize: FontSize.subtitle,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: -0.4,
  },
  netLabel: {
    fontFamily: FontFamily.monoSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  net: {
    fontFamily: FontFamily.monoBold,
    fontSize: FontSize.heroLarge,
    color: Colors.primary,
    marginBottom: 16,
    letterSpacing: -2,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 22,
  },
  accuracy: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  cta: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.onPrimary,
  },
});
