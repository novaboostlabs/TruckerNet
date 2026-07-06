import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle, StyleProp, GestureResponderEvent } from 'react-native';

interface Props extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale at the bottom of the press (default 0.96). */
  activeScale?: number;
}

/**
 * A Pressable that scales down slightly while held, then springs back — the
 * tactile "give" that makes buttons and cards feel physical. Pairs with the
 * haptics already fired on press. RN Animated + native driver, so the scale
 * runs on the UI thread (no jank) and there's no new dependency.
 */
export default function PressableScale({
  children, style, activeScale = 0.96, onPressIn, onPressOut, ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function handleIn(e: GestureResponderEvent) {
    Animated.spring(scale, { toValue: activeScale, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    onPressIn?.(e);
  }
  function handleOut(e: GestureResponderEvent) {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 8 }).start();
    onPressOut?.(e);
  }

  return (
    <Pressable onPressIn={handleIn} onPressOut={handleOut} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
