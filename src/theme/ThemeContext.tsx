import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { darkColors, lightColors, ThemeColors } from './theme';
import { getSetting, setSetting } from '../db/database';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;            // the user's choice
  setMode: (m: ThemeMode) => void;
  colors: ThemeColors;       // the ACTIVE palette (resolves 'system')
  isDark: boolean;
}

const SETTING_KEY = 'theme_mode';

function readSavedMode(): ThemeMode {
  const v = getSetting(SETTING_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  setMode: () => {},
  colors: darkColors,
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readSavedMode());
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(() => Appearance.getColorScheme());

  // Track the OS appearance so 'system' mode reacts live.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    return () => sub.remove();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { setSetting(SETTING_KEY, m); } catch { /* non-fatal */ }
  }, []);

  const isDark = mode === 'system' ? systemScheme !== 'light' : mode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const value = useMemo(() => ({ mode, setMode, colors, isDark }), [mode, setMode, colors, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
