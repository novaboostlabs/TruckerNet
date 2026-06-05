// Central design system — all colors, typography, spacing, and reusable card styles.
// Import from here instead of hardcoding values anywhere in the app.

export const Colors = {
  background: '#0F0F0F',
  surface: '#1A1A1A',
  border: '#2A2A2A',
  textPrimary: '#F0EDE8',
  textSecondary: '#8A8780',
  accent: '#E8A020',   // diesel amber — CTAs, positive numbers, active states
  danger: '#D94F3D',   // below break-even, negative values
  success: '#4CAF82',  // above break-even, positive values
} as const;

export const FontSize = {
  heroNumber: 44,
  cardNumber: 30,
  sectionHeader: 12,
  body: 15,
  label: 13,
} as const;

export const FontFamily = {
  regular: 'Inter_400Regular',
  semiBold: 'Inter_600SemiBold',
} as const;

export const Spacing = {
  screenH: 20,   // horizontal padding on all screens
  cardPadding: 16,
  gap: 12,
  sectionGap: 24,
} as const;

export const CardStyle = {
  backgroundColor: Colors.surface,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 12,
  padding: Spacing.cardPadding,
} as const;

export const SectionHeaderStyle = {
  fontSize: FontSize.sectionHeader,
  fontFamily: FontFamily.regular,
  color: Colors.textSecondary,
  textTransform: 'uppercase' as const,
  letterSpacing: 1.5,
  marginBottom: 8,
} as const;
