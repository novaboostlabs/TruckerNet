import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  /** Override margins/alignment per placement. */
  style?: StyleProp<ViewStyle>;
  /** Width of the accent bar (default 48). */
  width?: number;
  /** Height of the accent bar (default 4). */
  height?: number;
}

/**
 * Short vivid-amber underline accent — the Freight Terminal tertiary signal.
 * Sits under big headlines to warm up the palette. Uses the bright `accentBar`
 * colour (a fill, legible in both themes), not the text-tuned `secondary`.
 */
export default function AccentRule({ style, width = 48, height = 4 }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[{ height, borderRadius: 2, backgroundColor: colors.accentBar, width }, style]}
      pointerEvents="none"
    />
  );
}
