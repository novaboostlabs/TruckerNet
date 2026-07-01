import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Launch screen. The SAME image is the native static splash (app.json), so when
// this JS layer mounts and hides the native splash, the handoff is invisible —
// then a subtle metallic shimmer sweeps across and the whole thing crossfades
// into the app. React Native Animated (native thread, 60fps) — no Reanimated /
// worklets dependency. Understated: no spin/bounce/flash. ~1.8s total.

const SPLASH = require('../../assets/splash-screen.png');
const { width: W, height: H } = Dimensions.get('window');

interface Props { onDone: () => void; }

export default function AppSplashScreen({ onDone }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current; // 0→1 shimmer sweep
  const exit    = useRef(new Animated.Value(1)).current; // 1→0 crossfade out

  useEffect(() => {
    // The identical image is already showing as the native splash, so hiding it
    // now reveals this animatable JS layer with no visible seam.
    SplashScreen.hideAsync().catch(() => {});

    Animated.sequence([
      Animated.delay(250),
      Animated.timing(shimmer, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(300), // hold
      Animated.timing(exit, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) onDone(); });

    // Failsafe: never strand the user on the splash if a callback is dropped.
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.5, W * 1.2] });
  const shimmerOpacity   = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.10, 0] });

  return (
    <Animated.View style={[styles.container, { opacity: exit }]}>
      <Image source={SPLASH} style={styles.image} resizeMode="cover" />
      <Animated.View
        style={[styles.shimmer, { opacity: shimmerOpacity, transform: [{ translateX: shimmerTranslate }, { skewX: '-18deg' }] }]}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0B' },
  image:     { ...StyleSheet.absoluteFillObject, width: W, height: H },
  shimmer:   { position: 'absolute', top: -H * 0.25, height: H * 1.5, width: W * 0.22, backgroundColor: '#FFFFFF' },
});
