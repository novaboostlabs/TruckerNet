import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

// Premium launch animation (Reanimated, UI-thread, 60fps). Understated —
// no spin/bounce/flash. Beats:
//   1. trailer/graph "draws" in left→right          700ms  ease-out
//   2. teal + amber light bars glow in (soft)        500ms  (starts @200ms)
//   3. subtle metallic shimmer sweeps the body       750ms  (starts @350ms)
//   4. hold                                           300ms
//   5. crossfade the whole splash out                400ms  → onDone
// Total ≈ 1.75s. The screen underneath (RootNavigator) shows through during the
// crossfade, so the first real screen fades in beneath this overlay.
//
// NOTE: the supplied logo is a single flattened PNG (truck + graph + both light
// bars in one image), so the "graph draw" is a left→right wipe of the whole mark
// and the bar glow is a soft bloom aligned to the baked-in bars. For pixel-exact
// per-element control (graph stroke drawing on its own, each bar lighting
// independently, shimmer masked to only the truck body) we'd need the logo as
// layers or SVG — see the note handed back with this change.

const LOGO = require('../../assets/truck-logo-1024.png');
const BG   = '#0A0A0B';       // matches the logo's own background so the wipe edge is invisible
const SIZE = 210;

const TEAL  = '#00C896';
const AMBER = '#E5A021';

interface Props { onDone: () => void; }

export default function AppSplashScreen({ onDone }: Props) {
  const reveal  = useSharedValue(0);  // 0→1 left-to-right wipe
  const glow    = useSharedValue(0);  // 0→1 light-bar glow fade-in
  const shimmer = useSharedValue(0);  // 0→1 shimmer sweep progress
  const exit    = useSharedValue(1);  // 1→0 whole-screen crossfade

  useEffect(() => {
    const EASE_OUT = Easing.out(Easing.cubic);

    reveal.value  = withTiming(1, { duration: 700, easing: EASE_OUT });
    glow.value    = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
    shimmer.value = withDelay(350, withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }));
    exit.value    = withDelay(
      1350,
      withTiming(0, { duration: 400, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );

    // Failsafe: never strand the user on the splash if a frame callback is dropped.
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  const rootStyle   = useAnimatedStyle(() => ({ opacity: exit.value }));
  const revealStyle = useAnimatedStyle(() => ({ width: SIZE * reveal.value }));
  const glowStyle   = useAnimatedStyle(() => ({ opacity: glow.value }));
  const shimmerStyle = useAnimatedStyle(() => ({
    // fade the shimmer in and back out across the sweep so it never "sits" on screen
    opacity: 0.12 * Math.sin(Math.PI * shimmer.value),
    transform: [
      { translateX: -SIZE * 0.6 + shimmer.value * SIZE * 1.7 },
      { skewX: '-18deg' },
    ],
  }));

  return (
    <Animated.View style={[styles.container, rootStyle]}>
      <View style={styles.logoBox}>
        {/* Soft light-bar glow bloom (behind the logo), fades in */}
        <Animated.View style={[styles.glowTeal, glowStyle]}  pointerEvents="none" />
        <Animated.View style={[styles.glowAmber, glowStyle]} pointerEvents="none" />

        {/* Left→right reveal wrapper (anchored left; width animates 0→SIZE) */}
        <Animated.View style={[styles.revealWrap, revealStyle]}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          {/* Metallic shimmer sweep, clipped to the logo bounds */}
          <Animated.View style={[styles.shimmer, shimmerStyle]} pointerEvents="none" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  logoBox:   { width: SIZE, height: SIZE, alignItems: 'flex-start', justifyContent: 'center' },
  revealWrap:{ height: SIZE, overflow: 'hidden' },
  logo:      { width: SIZE, height: SIZE },

  shimmer: {
    position: 'absolute',
    top: -SIZE * 0.5,
    height: SIZE * 2,
    width: SIZE * 0.26,
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
