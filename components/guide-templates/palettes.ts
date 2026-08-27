import { KAWAII_PALETTE } from '@/lib/kawaii/tokens'

export type PaletteTokens = {
  bg: string; paper: string; ink: string; inkSoft: string
  accent: string; accentSoft: string; rule: string; muted: string; green: string; greenDeep: string
}
// A handful of coach-selectable looks — "green"/"greenDeep" stay in a green
// family across every palette (used for done/success states throughout, so
// swapping them would make checkmarks read wrong), while "accent" carries
// each palette's actual personality.
export const PALETTES: Record<string, PaletteTokens> = {
  classic: {
    bg: '#F7EEE1', paper: '#FBF5EA', ink: '#2C2418', inkSoft: '#4A4034',
    accent: '#B1512E', accentSoft: '#E7DAC0', rule: '#D8C6A4', muted: '#948A76', green: '#538A22', greenDeep: '#2F5214',
  },
  sage: {
    bg: '#F7F3EA', paper: '#FFFFFF', ink: '#2B2B28', inkSoft: '#4F5A4A',
    accent: '#C17A52', accentSoft: '#F3E2D3', rule: '#E4DDCD', muted: '#6B6A63', green: '#4F6F52', greenDeep: '#2E4530',
  },
  ocean: {
    bg: '#EFF5F3', paper: '#FFFFFF', ink: '#1F2E2B', inkSoft: '#3F5450',
    accent: '#2F6E73', accentSoft: '#D9EDEE', rule: '#CFE3E1', muted: '#6D8481', green: '#3F7D4A', greenDeep: '#265130',
  },
  berry: {
    bg: '#FBF1EE', paper: '#FFFFFF', ink: '#2B2220', inkSoft: '#5C453F',
    accent: '#8C4B5A', accentSoft: '#F1DCE0', rule: '#E8D3CC', muted: '#8F7A75', green: '#4C7A4F', greenDeep: '#2C4A2E',
  },
  kawaii: KAWAII_PALETTE,
}
export const PALETTE_LIST: { id: string; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'sage', label: 'Sage' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'berry', label: 'Berry' },
  { id: 'kawaii', label: 'Kawaii' },
]
