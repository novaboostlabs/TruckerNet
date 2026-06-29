import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StyleSheet as RNStyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize } from '../theme/theme';

interface Props { onDone: () => void; }

export default function AppSplashScreen({ onDone }: Props) {
  // ── Radar rings (3, staggered) ───────────────────────────────────────────
  const ring1Scale   = useRef(new Animated.Value(0.15)).current;
  const ring1Opacity = useRef(new Animated.Value(0.7)).current;
  const ring2Scale   = useRef(new Animated.Value(0.15)).current;
  const ring2Opacity = useRef(new Animated.Value(0.7)).current;
  const ring3Scale   = useRef(new Animated.Value(0.15)).current;
  const ring3Opacity = useRef(new Animated.Value(0.7)).current;

  // ── Glow behind logo ─────────────────────────────────────────────────────
  const glowOpacity = useRef(new Animated.Value(0)).current;

  // ── Logo ─────────────────────────────────────────────────────────────────
  const logoScale   = useRef(new Animated.Value(0.25)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // ── Amber accent bar ─────────────────────────────────────────────────────
  const accentOpacity = useRef(new Animated.Value(0)).current;
  const accentScale   = useRef(new Animated.Value(0.3)).current;

  // ── Wordmark ─────────────────────────────────────────────────────────────
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY       = useRef(new Animated.Value(22)).current;

  // ── Tagline ───────────────────────────────────────────────────────────────
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY       = useRef(new Animated.Value(14)).current;

  // ── Exit ─────────────────────────────────────────────────────────────────
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const ring = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 4.0, duration: 950, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.65, duration: 80,  useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0,    duration: 870, useNativeDriver: true }),
          ]),
        ]),
      ]);

    Animated.parallel([
      // Rings burst out — staggered by 160ms each
      ring(ring1Scale, ring1Opacity, 0),
      ring(ring2Scale, ring2Opacity, 160),
      ring(ring3Scale, ring3Opacity, 320),

      // Glow pulses softly behind the logo
      Animated.sequence([
        Animated.delay(280),
        Animated.timing(glowOpacity, { toValue: 0.22, duration: 350, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.1,  duration: 500, useNativeDriver: true }),
      ]),

      // Logo springs in out of the ring burst
      Animated.sequence([
        Animated.delay(220),
        Animated.parallel([
          Animated.spring(logoScale, {
            toValue: 1, tension: 95, friction: 6, useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        ]),
      ]),

      // Amber accent bar snaps in
      Animated.sequence([
        Animated.delay(520),
        Animated.parallel([
          Animated.timing(accentOpacity, { toValue: 1,   duration: 180, useNativeDriver: true }),
          Animated.spring(accentScale,   { toValue: 1, tension: 130, friction: 7, useNativeDriver: true }),
        ]),
      ]),

      // Wordmark rises up
      Animated.sequence([
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(wordmarkOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.spring(wordmarkY, { toValue: 0, tension: 110, friction: 8, useNativeDriver: true }),
        ]),
      ]),

      // Tagline rises up
      Animated.sequence([
        Animated.delay(780),
        Animated.parallel([
          Animated.timing(taglineOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(taglineY, { toValue: 0, tension: 110, friction: 8, useNativeDriver: true }),
        ]),
      ]),

      // Hold then fade out
      Animated.sequence([
        Animated.delay(1650),
        Animated.timing(exitOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
  }, []); // eslint-disable-line

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>

      {/* ── Radar rings layer (absolute, centered) ── */}
      {[
        { scale: ring1Scale, opacity: ring1Opacity },
        { scale: ring2Scale, opacity: ring2Opacity },
        { scale: ring3Scale, opacity: ring3Opacity },
      ].map((ring, i) => (
        <Animated.View
          key={i}
          style={[RNStyleSheet.absoluteFillObject, styles.ringLayer, { opacity: ring.opacity }]}
        >
          <Animated.View style={[styles.ring, { transform: [{ scale: ring.scale }] }]} />
        </Animated.View>
      ))}

      {/* ── Glow (absolute, centered) ── */}
      <Animated.View style={[RNStyleSheet.absoluteFillObject, styles.ringLayer, { opacity: glowOpacity }]}>
        <View style={styles.glow} />
      </Animated.View>

      {/* ── Content ── */}
      <View style={styles.content}>

        {/* Logo — teal diamond */}
        <Animated.View style={[
          styles.logoWrap,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}>
          <View style={styles.diamond}>
            <Text style={styles.diamondText}>TN</Text>
          </View>
        </Animated.View>

        {/* Amber accent bar — just a sliver */}
        <Animated.View style={[
          styles.accentBar,
          { opacity: accentOpacity, transform: [{ scaleX: accentScale }] },
        ]} />

        {/* Wordmark */}
        <Animated.Text style={[
          styles.wordmark,
          { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }] },
        ]}>
          TruckerNet
        </Animated.Text>

        {/* Tagline — amber period for the "tiny bit of amber" */}
        <Animated.View style={[
          styles.taglineRow,
          { opacity: taglineOpacity, transform: [{ translateY: taglineY }] },
        ]}>
          <Text style={styles.tagline}>Know your real number</Text>
          <Text style={styles.taglinePeriod}>.</Text>
        </Animated.View>

      </View>
    </Animated.View>
  );
}

const RING_SIZE = 170;
const GLOW_SIZE = 144;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Rings ──────────────────────────────────────────────────────────────────
  ringLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width:  RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },

  // ── Glow ───────────────────────────────────────────────────────────────────
  glow: {
    width:  GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 20,
  },

  // ── Content ────────────────────────────────────────────────────────────────
  content: {
    alignItems: 'center',
  },

  // ── Logo ───────────────────────────────────────────────────────────────────
  logoWrap: {
    marginBottom: 0,
  },
  diamond: {
    width: 82,
    height: 82,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 16,
  },
  diamondText: {
    fontFamily: FontFamily.monoBold,
    fontSize: 26,
    color: Colors.background,
    transform: [{ rotate: '-45deg' }],
    letterSpacing: 1.5,
  },

  // ── Amber accent ───────────────────────────────────────────────────────────
  accentBar: {
    width: 36,
    height: 2.5,
    backgroundColor: Colors.secondary,   // amber — just a sliver
    borderRadius: 2,
    marginTop: 20,
    marginBottom: 22,
  },

  // ── Wordmark ───────────────────────────────────────────────────────────────
  wordmark: {
    fontFamily: FontFamily.monoBold,
    fontSize: 30,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 10,
  },

  // ── Tagline ────────────────────────────────────────────────────────────────
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tagline: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  taglinePeriod: {
    fontFamily: FontFamily.monoBold,
    fontSize: FontSize.body,
    color: Colors.secondary,   // amber period — the one accent touch
  },
});
