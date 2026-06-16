// ─────────────────────────────────────────────────────────────
// TruckerNet Design System v2.1 — Polish pass
// ─────────────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds — increased contrast between levels
  background:     '#080808',   // true near-black
  surface:        '#161616',   // cards — noticeably lighter than bg
  surfaceHigh:    '#1E1E1E',   // inputs, elevated elements
  surfacePress:   '#252525',   // pressed state

  // Borders — more visible
  borderSubtle:   '#202020',   // faint separators
  border:         '#2E2E2E',   // standard card borders (was #242424)
  borderStrong:   '#3E3E3E',   // focused inputs, active chips

  // Text — secondary brightened ~25%
  textPrimary:    '#F0EDE8',   // warm white
  textSecondary:  '#767676',   // was #5A5A5A — 25% brighter
  textTertiary:   '#4A4A4A',   // placeholders, very muted

  // Accents
  primary:        '#00C896',   // profit green
  primaryDim:     '#00C89614', // very subtle green tint
  primaryMid:     '#00C89635', // green border/ring
  primaryGlow:    '#00C89625', // tab bar active glow

  secondary:      '#E8A020',   // amber — use sparingly
  secondaryDim:   '#E8A02012',

  // Semantic
  danger:         '#EF4444',
  dangerDim:      '#EF444412',
  success:        '#00C896',

  // Section label color — brighter than secondary text
  labelColor:     '#606060',   // dedicated color for ALL CAPS labels
} as const;

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
  regular:  'Inter_400Regular',
  medium:   'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold:     'Inter_700Bold',
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

export const Card = {
  backgroundColor: Colors.surface,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: Radius.lg,
  padding: Spacing.cardPad,
} as const;

export const SectionLabel = {
  fontSize:      FontSize.micro,
  fontFamily:    FontFamily.semiBold,
  color:         Colors.labelColor,
  textTransform: 'uppercase' as const,
  letterSpacing: 1.8,
  marginBottom:  10,
} as const;

export const InputField = {
  backgroundColor:   Colors.surfaceHigh,
  borderWidth:       1,
  borderColor:       Colors.border,
  borderRadius:      Radius.md,
  paddingHorizontal: 16,
  paddingVertical:   16,
  fontFamily:        FontFamily.regular,
  fontSize:          FontSize.body,
  color:             Colors.textPrimary,
} as const;
