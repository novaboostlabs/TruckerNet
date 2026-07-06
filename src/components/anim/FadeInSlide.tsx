import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Stagger delay before this element animates in, in ms. */
  delay?: number;
  /** Starting vertical offset in px (positive = slides up into place). Default 14. */
  offsetY?: number;
  /** Timing duration in ms (default 480). */
  duration?: number;
  /**
   * Change this to replay the entrance (e.g. the active walkthrough slide index).
   * When it changes the element re-runs its fade+slide from the start.
   */
  replayKey?: string | number;
}

/**
 * Declarative entrance: fades + slides content into place, with an optional
 * per-item `delay` so a group can stagger in.
 *
 * Deliberately built on React Native's Animated (native driver: opacity +
 * transform run on the UI thread, 60fps, no jank) rather than Moti/Reanimated —
 * this ships on launch-critical screens (walkthrough, dashboard, break-even
 * reveal) and RN Animated is guaranteed identical in Expo Go and production.
 * Isolated here so the whole app's entrance feel is one component and can be
 * upgraded to a richer engine later once verified on-device.
 */
export default function FadeInSlide({
  children, style, delay = 0, offsetY = 14, duration = 480, replayKey,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
