import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, TextStyle, StyleProp } from 'react-native';

interface Props {
  /** Target numeric value to animate to. */
  value: number;
  /** Formats the (interpolated) number into the displayed string. */
  format: (n: number) => string;
  style?: StyleProp<TextStyle>;
  /** Animation length in ms (default 900). */
  duration?: number;
  /** Delay before the count-up starts, in ms (default 0). */
  delay?: number;
  /**
   * Starting value for the FIRST count-up on mount (e.g. 0 to count up from
   * zero). Omit to render the initial value statically and only animate when
   * `value` later changes — ideal for a figure that ticks up as data updates.
   */
  from?: number;
  /** Skip the animation and render the final value immediately. */
  immediate?: boolean;
  numberOfLines?: number;
}

/**
 * A number that counts up (or down) to its target instead of snapping — the
 * single most "expensive-feeling" animation for a numbers-forward app.
 *
 * Deliberately built on React Native's Animated (not Reanimated/Moti): driving
 * a text value needs a JS-thread listener anyway, and this keeps the highest-
 * impact animation dependency-free and identical in Expo Go and production.
 * An easeOut curve makes it decelerate into the final figure, which reads as
 * "settling on the real number."
 */
export default function AnimatedNumber({
  value, format, style, duration = 900, delay = 0, from, immediate = false, numberOfLines,
}: Props) {
  const initial = from ?? value;
  const anim = useRef(new Animated.Value(initial)).current;
  const prev = useRef(initial);
  const [display, setDisplay] = useState(() => format(initial));

  useEffect(() => {
    if (immediate) { setDisplay(format(value)); anim.setValue(value); prev.current = value; return; }
    if (value === prev.current) return; // no change → nothing to animate

    const id = anim.addListener(({ value: v }) => setDisplay(format(v)));
    const animation = Animated.timing(anim, {
      toValue: value,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // we read the value on the JS thread to format text
    });
    animation.start(() => { prev.current = value; });

    return () => { anim.removeListener(id); animation.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, immediate]);

  return <Text style={style} numberOfLines={numberOfLines}>{display}</Text>;
}
