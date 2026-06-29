// ─────────────────────────────────────────────────────────────
// TruckerNet Design System v3 — Freight Terminal, light + dark
// ─────────────────────────────────────────────────────────────
//
// Two palettes with identical keys. Components read the active palette via
// `useTheme()` (see ThemeContext) and rebuild their styles when it changes.
// `Colors` is exported as the DARK palette so any not-yet-themed module keeps
// working (and stays dark) — the migration is safe to do screen by screen.

export const darkColors = {
  // Backgrounds
  background:   '#080808',
  surface:      '#222222',
  surfaceHigh:  '#2C2C2C',
  surfacePress: '#333333',

  // Borders
  borderSubtle: '#2A2A2A',
  border:       '#3C3C3C',
  borderStrong: '#505050',

  // Text
  textPrimary:   '#F0EDE8',
  textSecondary: '#767676',
  textTertiary:  '#4A4A4A',

  // Accents
  primary:     '#00C896',
  primaryDim:  '#00C89614',
  primaryMid:  '#00C89635',
  primaryGlow: '#00C89625',
  onPrimary:   '#06281E',   // text/icon ON a primary fill

  secondary:    '#E8A020',
  secondaryDim: '#E8A02012',
  // Vivid amber for accent BARS (fills, not text) — stays bright in both modes.
  accentBar:    '#E8A020',

  danger:    '#EF4444',
  dangerDim: '#EF444412',
  success:   '#00C896',

  labelColor:  '#606060',
  // Grid background line (Freight Terminal motif)
  grid:        'rgba(130, 150, 150, 0.16)',
  // App-chrome surfaces that were previously hardcoded
  chrome:      '#0A0A0B',
};

export type ThemeColors = typeof darkColors;

export const lightColors: ThemeColors = {
  background:   '#F4F4F1',
  surface:      '#FFFFFF',
  surfaceHigh:  '#F4F4EF',
  surfacePress: '#E7E7E1',

  // Bolder borders so cards/inputs read clearly against the light background.
  borderSubtle: '#D2D2C9',
  border:       '#ACACA0',
  borderStrong: '#8C8C80',

  textPrimary:   '#101012',
  textSecondary: '#6A6A64',
  textTertiary:  '#A6A69E',

  // Deeper teal so it stays legible as text/borders on white.
  primary:     '#0A8F6C',
  primaryDim:  '#0A8F6C14',
  primaryMid:  '#0A8F6C40',
  primaryGlow: '#0A8F6C20',
  onPrimary:   '#FFFFFF',

  secondary:    '#B07215',   // deeper amber for legibility as TEXT on white
  secondaryDim: '#E8A02018',
  accentBar:    '#F0A41C',   // vivid amber for underline bars on white

  danger:    '#DC2626',
  dangerDim: '#DC262610',
  success:   '#0A8F6C',

  labelColor:  '#86867E',
  grid:        'rgba(18, 55, 50, 0.14)',
  chrome:      '#FFFFFF',
};

// Backwards-compatible default (dark). Unconverted modules import this and
// render correctly in dark mode until they're migrated to useTheme().
export const Colors = darkColors;

export const FontSize = {
  heroLarge:  52,
  hero:       44,
  cardNumber: 32,
  title:      28,
  subtitle:   20,
  body:       16,
  label:      14,
  caption:    12,
  micro:      11,
} as const;

export const FontFamily = {
  regular:      'Inter_400Regular',
  medium:       'Inter_500Medium',
  semiBold:     'Inter_600SemiBold',
  bold:         'Inter_700Bold',
  monoRegular:  'JetBrainsMono_400Regular',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
  monoBold:     'JetBrainsMono_700Bold',
} as const;

export const Spacing = {
  screenH:  24,
  screenV:  20,
  cardPad:  20,
  gap:      12,
  gapLarge: 20,
  section:  28,
} as const;

export const Radius = {
  sm:   6,
  md:   12,
  lg:   16,
  xl:   20,
  pill: 100,
} as const;

// Themed section-label helper. Spread it as `...sectionLabel(Colors)` inside a
// makeStyles(Colors) block so ALL-CAPS labels pick up the active theme.
export const sectionLabel = (c: ThemeColors) => ({
  fontSize:      FontSize.micro,
  fontFamily:    FontFamily.monoSemiBold,
  color:         c.labelColor,
  textTransform: 'uppercase' as const,
  letterSpacing: 1.8,
  marginBottom:  10,
});

// Static SectionLabel (dark) kept for not-yet-migrated screens.
export const SectionLabel = sectionLabel(darkColors);
