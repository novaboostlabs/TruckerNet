import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

/**
 * Freight Terminal aesthetic grid background overlay.
 * Subtle repeating grid pattern (28px cells) suggesting precision/data.
 * Line colour follows the active theme.
 */
export default function GridBackground() {
  const { width, height } = Dimensions.get('window');
  const { colors } = useTheme();

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={width} height={height} style={styles.svg}>
        <Defs>
          <Pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="0" x2="0" y2="28" stroke={colors.grid} strokeWidth="1" />
            <Line x1="0" y1="0" x2="28" y2="0" stroke={colors.grid} strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width={width} height={height} fill="url(#grid)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  svg: {
    position: 'absolute',
  },
});
