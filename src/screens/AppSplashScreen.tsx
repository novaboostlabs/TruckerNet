import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, FontFamily, FontSize } from '../theme/theme';

interface Props { onDone: () => void; }

export default function AppSplashScreen({ onDone }: Props) {
  const logoScale  = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity  = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo springs in
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      // Wordmark fades up 150ms later
      Animated.timing(textOpacity, { toValue: 1, duration: 300, delay: 50, useNativeDriver: true }),
      // Tagline fades in
      Animated.timing(tagOpacity,  { toValue: 1, duration: 250, useNativeDriver: true }),
      // Hold for a beat then fade the whole screen out
      Animated.delay(600),
      Animated.timing(exitOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []); // eslint-disable-line

  return (
    <Animated.View style={[styles.container, { opacity: exitOpacity }]}>
      {/* Logo mark — amber diamond with "TN" */}
      <Animated.View style={[
        styles.logoWrap,
        { opacity: logoOpacity, transform: [{ scale: logoScale }] },
      ]}>
        <View style={styles.diamond}>
          <Text style={styles.diamondText}>TN</Text>
        </View>
        <View style={styles.amberLine} />
      </Animated.View>

      {/* Wordmark */}
      <Animated.Text style={[styles.wordmark, { opacity: textOpacity }]}>
        TruckerNet
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
        Know your real number.
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },

  logoWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },

  diamond: {
    width: 80,
    height: 80,
    backgroundColor: Colors.secondary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },

  diamondText: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    color: Colors.background,
    transform: [{ rotate: '-45deg' }],
    letterSpacing: 1,
  },

  amberLine: {
    width: 48,
    height: 2,
    backgroundColor: Colors.secondary,
    borderRadius: 1,
    marginTop: 18,
    opacity: 0.5,
  },

  wordmark: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 10,
  },

  tagline: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
});
