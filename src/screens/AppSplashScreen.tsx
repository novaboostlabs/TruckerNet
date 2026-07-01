import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';

// Premium launch animation — React Native Animated on the native thread (60fps,
// no Reanimated/worklets dependency so it runs in Expo Go and every build).
// Understated: no spin/bounce/flash. Beats:
//   1. trailer/graph "draws" in left→right (a cover panel wipes off)  700ms ease-out
//   2. teal + amber light bars glow in (soft bloom)                   500ms  @200ms
//   3. subtle metallic shimmer sweeps the body                        750ms  @350ms
//   4. hold                                                           300ms
//   5. crossfade the whole splash out                                 400ms  → onDone
// Total ≈ 1.75s. RootNavigator renders the next screen underneath, so it fades
// in beneath this overlay (crossfades into the dashboard for returning users).
//
// The supplied logo is a single flattened PNG (truck + graph + both light bars in
// one image), so the "graph draw" is a left→right wipe of the whole mark and the
// bar glow is a soft bloom aligned to the baked-in bars. Per-element control
// (graph stroke drawing alone, bars igniting independently, shimmer masked to the
// truck body) would need the logo as layers/SVG.

const LOGO = require('../../assets/truck-logo-1024.png');
const BG   = '#0A0A0B';       // matches the logo's own background so the wipe edge is invisible
const SIZE = 210;

const TEAL  = '#00C896';
const AMBER = '#E5A021';

interface Props { onDone: () => void; }

export default function AppSplashScreen({ onDone }: Props) {
  const cover   = useRef(new Animated.Value(0)).current; // 0→SIZE cover slides right (wipe reveal)
  const glow    = useRef(new Animated.Value(0)).current; // 0→1 light-bar glow fade-in
  const shimmer = useRef(new Animated.Value(0)).current; // 0→1 shimmer sweep progress
  const exit    = useRef(new Animated.Value(1)).current; // 1→0 whole-screen crossfade

  useEffect(() => {
    Animated.parallel([
      // 1. wipe reveal: bg-colored cover panel slides right, uncovering left→right
      Animated.timing(cover, {
        toValue: SIZE, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      // 2. soft teal/amber glow blooms in
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(glow, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      // 3. subtle metallic shimmer sweeps across
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(shimmer, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
      // 4 + 5. hold, then crossfade the splash out
      Animated.sequence([
        Animated.delay(1350),
        Animated.timing(exit, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => { if (finished) onDone(); });

    // Failsafe: never strand the user on the splash if a callback is dropped.
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1], outputRange: [-SIZE * 0.6, SIZE * 1.1],
  });
  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1], outputRange: [0, 0.12, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: exit }]}>
      <View style={styles.logoBox}>
        {/* Soft light-bar glow bloom (behind the logo), fades in */}
        <Animated.View style={[styles.glowTeal, { opacity: glow }]}  pointerEvents="none" />
        <Animated.View style={[styles.glowAmber, { opacity: glow }]} pointerEvents="none" />

        {/* Logo */}
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />

        {/* Metallic shimmer sweep (clipped to the logo box) */}
        <Animated.View
          style={[styles.shimmer, { opacity: shimmerOpacity, transform: [{ translateX: shimmerTranslate }, { skewX: '-18deg' }] }]}
          pointerEvents="none"
        />

        {/* Wipe cover: starts over the whole logo, slides right to reveal left→right */}
        <Animated.View
          style={[styles.cover, { transform: [{ translateX: cover }] }]}
          pointerEvents="none"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  logoBox:   { width: SIZE, height: SIZE, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logo:      { width: SIZE, height: SIZE },

  cover: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: SIZE,
    backgroundColor: BG,
  },
  shimmer: {
    position: 'absolute', top: -SIZE * 0.5, height: SIZE * 2, width: SIZE * 0.26,
    backgroundColor: '#FFFFFF',
  },

  // Soft colored blooms aligned to the logo's baked-in bars (teal upper, amber lower).
  glowTeal: {
    position: 'absolute',
    left: SIZE * 0.14, right: SIZE * 0.14, top: SIZE * 0.20, height: 6, borderRadius: 6,
    backgroundColor: 'rgba(0,200,150,0.30)',
    shadowColor: TEAL, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
  },
  glowAmber: {
    position: 'absolute',
    left: SIZE * 0.14, right: SIZE * 0.14, bottom: SIZE * 0.16, height: 6, borderRadius: 6,
    backgroundColor: 'rgba(229,160,33,0.30)',
    shadowColor: AMBER, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
  },
});
