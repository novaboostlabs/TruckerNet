import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface Props {
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  /** Width of the active (stretched) dot; inactive is `size`. Default 22. */
  activeWidth?: number;
  /** Diameter of the inactive dot. Default 7. */
  size?: number;
}

/**
 * A pager dot that smoothly stretches + tints when it becomes active, instead
 * of snapping. RN Animated (width/color animate on the JS thread — trivial for
 * a single small view, no perf concern) so there's no runtime dependency risk
 * on this launch-critical walkthrough screen.
 */
export default function PagerDot({
  active, activeColor, inactiveColor, activeWidth = 22, size = 7,
}: Props) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? 1 : 0,
      duration: 260,
      useNativeDriver: false, // width + backgroundColor aren't native-drivable
    }).start();
  }, [active, anim]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: [size, activeWidth] });
  const backgroundColor = anim.interpolate({ inputRange: [0, 1], outputRange: [inactiveColor, activeColor] });

  return <Animated.View style={{ height: size, borderRadius: size / 2, width, backgroundColor }} />;
}
