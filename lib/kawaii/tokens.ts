// "Kawaii Wellness" design system — LP Compass / LP Trailmix.
// Raw token values from the design spec, plus a palette shaped to slot
// straight into DashboardClient.tsx's existing PaletteTokens (the same
// 10-key shape its other 4 coach-selectable themes already use), so
// picking "Kawaii" from the theme swatch picker just works.

export const KAWAII = {
  mint: '#CFF5E7',
  mintDeep: '#8FE3C7',
  coral: '#FF8C74',
  coralDeep: '#F26A50',
  sun: '#FFD166',
  lav: '#B8A9F2',
  ink: '#0E4B44',
  cream: '#FFFBF3',
  card: '#FFFFFF',
  shadow: '0 10px 24px rgba(14,75,68,0.10)',
  radiusCard: 22,
  radiusPill: 20,
  fontHeading: "'Fredoka', sans-serif",
  fontBody: "'Quicksand', sans-serif",
} as const

// Matches DashboardClient.tsx's local `PaletteTokens` type structurally
// (bg/paper/ink/inkSoft/accent/accentSoft/rule/muted/green/greenDeep) —
// not imported directly to avoid a circular dependency between the
// template and this shared module.
export const KAWAII_PALETTE = {
  bg: KAWAII.cream,
  paper: KAWAII.card,
  ink: KAWAII.ink,
  inkSoft: '#3A6B63',
  accent: KAWAII.coral,
  accentSoft: KAWAII.mint,
  rule: '#E3F7EF',
  muted: '#6B948B',
  green: KAWAII.mintDeep,
  greenDeep: '#3F9B7F',
}
