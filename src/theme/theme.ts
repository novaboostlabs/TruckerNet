// ─────────────────────────────────────────────────────────────
// TruckerNet Design System v2
// Inspired by Linear, Ramp, Mercury, Stripe Dashboard
// Premium fintech — dark mode, green profit accent
// ─────────────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds
  background:     '#080808',   // near-black base
  surface:        '#111111',   // card surface
  surfaceHigh:    '#181818',   // elevated surface (modals, inputs)
  surfacePress:   '#1E1E1E',   // pressed state

  // Borders
  borderSubtle:   '#1A1A1A',   // barely visible dividers
  border:         '#242424',   // standard card borders
  borderStrong:   '#333333',   // focused inputs, active states

  // Text
  textPrimary:    '#F0EDE8',   // warm white — primary
  textSecondary:  '#5A5A5A',   // muted labels
  textTertiary:   '#3A3A3A',   // very muted, placeholders

  // Accents
  primary:        '#00C896',   // profit green — positive numbers, CTAs
  primaryDim:     '#00C89618', // green tint for backgrounds
  primaryMid:     '#00C89640', // green for borders on active states
  secondary:      '#E8A020',   // amber — secondary CTAs, warnings (use sparingly)
  secondaryDim:   '#E8A02015', // amber tint

  // Semantic
  danger:         '#EF4444',   // below break-even, errors
  dangerDim:      '#EF444415', // danger tint
  success:        '#00C896',   // alias of primary
} as const;

export const FontSize = {
  heroLarge:    52,   // Dashboard break-even hero
  hero:         44,   // Primary metric numbers
  cardNumber:   32,   // Card-level numbers
  title:        28,   // Screen titles
  subtitle:     20,   // Section titles
  body:         16,   // Standard body text
  label:        14,   // Field labels, metadata
  caption:      12,   // Legal, timestamps
  micro:        11,   // ALL-CAPS section headers
} as const;

export const FontFamily = {
  regular:      'Inter_400Regular',
  medium:       'Inter_500Medium',
  semiBold:     'Inter_600SemiBold',
  bold:         'Inter_700Bold',
} as const;

export const Spacing = {
  screenH:      24,   // horizontal screen padding
  screenV:      20,   // vertical screen padding
  cardPad:      20,   // card internal padding
  gap:          12,   // standard gap between elements
  gapLarge:     20,   // larger gap
  section:      32,   // between screen sections
} as const;

export const Radius = {
  sm:     8,
  md:     12,
  lg:     16,
  xl:     20,
  pill:   100,
} as const;

// Reusable card style
export const Card = {
  backgroundColor: Colors.surface,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: Radius.lg,
  padding: Spacing.cardPad,
} as const;

// Section header (ALL CAPS label above a section)
export const SectionLabel = {
  fontSize:       FontSize.micro,
  fontFamily:     FontFamily.semiBold,
  color:          Colors.textSecondary,
  textTransform:  'uppercase' as const,
  letterSpacing:  1.5,
  marginBottom:   10,
} as const;

// Input field
export const InputField = {
  backgroundColor:  Colors.surfaceHigh,
  borderWidth:      1,
  borderColor:      Colors.border,
  borderRadius:     Radius.md,
  paddingHorizontal: 16,
  paddingVertical:  16,
  fontFamily:       FontFamily.regular,
  fontSize:         FontSize.body,
  color:            Colors.textPrimary,
} as const;
