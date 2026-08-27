import { KAWAII } from './tokens'

// "Splash" — the Kawaii Wellness mascot, a friendly water drop. Reused
// wherever the app needs an empty/loading/success state instead of a
// generic icon or spinner. Face rules per spec: two dot eyes + one curved
// mouth path, happy = upward curve, tired = flat/zig-zag, sad = downward
// curve, plus optional blush.
export type MascotExpression = 'happy' | 'neutral' | 'sad' | 'tired'

const MOUTHS: Record<MascotExpression, string> = {
  happy: 'M26 40q6 7 12 0',
  neutral: 'M27 41h10',
  sad: 'M26 43q6 -7 12 0',
  tired: 'M25 41l4 -2 4 2 4 -2 4 2',
}

export function Splash({ expression = 'happy', size = 72, animate = true, color = KAWAII.mintDeep }: { expression?: MascotExpression; size?: number; animate?: boolean; color?: string }) {
  const blush = expression === 'happy' || expression === 'neutral'
  return (
    <svg data-kawaii-mascot width={size} height={size} viewBox="0 0 64 64"
      style={animate ? { animation: 'kawaiiFloat 3s ease-in-out infinite' } : undefined}>
      <path d="M32 6C20 22 12 32 12 41a20 20 0 0 0 40 0c0-9-8-19-20-35Z" fill={color} stroke={KAWAII.ink} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="24" cy="36" r="2.6" fill={KAWAII.ink} />
      <circle cx="40" cy="36" r="2.6" fill={KAWAII.ink} />
      <path d={MOUTHS[expression]} fill="none" stroke={KAWAII.ink} strokeWidth="2.2" strokeLinecap="round" />
      {blush && (
        <>
          <ellipse cx="18" cy="40" rx="3.4" ry="2.2" fill={KAWAII.coral} opacity="0.55" />
          <ellipse cx="46" cy="40" rx="3.4" ry="2.2" fill={KAWAII.coral} opacity="0.55" />
        </>
      )}
      <ellipse cx="24" cy="20" rx="4" ry="6" fill="#fff" opacity="0.35" />
    </svg>
  )
}
