// "Kawaii Wellness" hand-built icon set — flat shapes, rounded 2-3px
// strokes, no gradients. Every icon here is a self-contained inline SVG,
// replacing lucide-react one-for-one: same export name, same
// { size, color } call shape as the lucide icon it stands in for, so a
// consuming file only ever needs to change its import source, never its
// call sites. Kept on a 24x24 grid (lucide's own grid) since these are
// functional UI glyphs, not character illustrations — the mascot and any
// future named illustration icons (HydrationIcon, SleepIcon, etc.) get
// their own larger 64x64 treatment in Mascot.tsx instead.

export type IconProps = { size?: number; color?: string; strokeWidth?: number; className?: string; style?: React.CSSProperties; opacity?: number | string }
export type IconComponent = (props: IconProps) => React.ReactElement

function Base({ size = 24, color = 'currentColor', strokeWidth = 2.4, className, style, opacity, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={style} opacity={opacity}>
      {children}
    </svg>
  )
}

export const CheckCircle2: IconComponent = (p) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5 10.8 15.3 16 9.5" /></Base>
)
export const Circle: IconComponent = (p) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /></Base>
)
export const MapPin: IconComponent = (p) => (
  <Base {...p}><path d="M12 21c4-4.5 7-8.2 7-11.5A7 7 0 0 0 5 9.5C5 12.8 8 16.5 12 21Z" /><circle cx="12" cy="9.5" r="2.4" /></Base>
)
export const Utensils: IconComponent = (p) => (
  <Base {...p}><path d="M7 3v7a1.5 1.5 0 0 0 3 0V3M8.5 10V21M18 3c-1.7 0-3 2-3 5s1.3 5 3 5v8" /></Base>
)
export const Pill: IconComponent = (p) => (
  <Base {...p}><rect x="3.5" y="9" width="17" height="6.4" rx="3.2" transform="rotate(-35 12 12)" /><path d="M9.5 9.8 14.5 14.2" /></Base>
)
export const ShoppingCart: IconComponent = (p) => (
  <Base {...p}><path d="M3 4h2.2l1.9 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L20 8H6" /><circle cx="9.5" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></Base>
)
export const HeartPulse: IconComponent = (p) => (
  <Base {...p}><path d="M12 20c-5-3.4-9-7-9-11a4.6 4.6 0 0 1 9-1.6A4.6 4.6 0 0 1 21 9c0 4-4 7.6-9 11Z" /><path d="M6 11h2.2l1.3-2.4 1.6 4 1.3-2.2H15" /></Base>
)
export const HelpCircle: IconComponent = (p) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.5a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.2 1-1.2 2" /><circle cx="12" cy="17" r="0.6" fill={p.color || 'currentColor'} /></Base>
)
export const Phone: IconComponent = (p) => (
  <Base {...p}><path d="M5 4.5c0-.8.7-1.5 1.5-1.5H9l1.5 4-2 1.6c1 2.4 2.9 4.3 5.3 5.3l1.6-2 4 1.5v2.5c0 .8-.7 1.5-1.5 1.5C10.6 20.9 3.1 13.4 5 4.5Z" /></Base>
)
export const X: IconComponent = (p) => (
  <Base {...p}><path d="M6 6 18 18M18 6 6 18" /></Base>
)
export const ChefHat: IconComponent = (p) => (
  <Base {...p}><path d="M7.5 12a3.5 3.5 0 0 1 1-6.7 3.5 3.5 0 0 1 6.9-1 3.5 3.5 0 0 1 3.6 5.8c1 .5 1.6 1.6 1.6 2.9a3 3 0 0 1-3 3H8.4a3 3 0 0 1-.9-5.9Z" /><path d="M8 15v5.5h8V15" /></Base>
)
export const Download: IconComponent = (p) => (
  <Base {...p}><path d="M12 3v12M7.5 11 12 15.5 16.5 11" /><path d="M4.5 18.5V20a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" /></Base>
)
export const Sparkles: IconComponent = (p) => (
  <Base {...p} strokeWidth={p.strokeWidth ?? 2}>
    <path d="M11 3c.5 2.7 1.3 3.5 4 4-2.7.5-3.5 1.3-4 4-.5-2.7-1.3-3.5-4-4 2.7-.5 3.5-1.3 4-4Z" fill={p.color || 'currentColor'} stroke="none" />
    <path d="M18 14c.3 1.6.8 2.1 2.4 2.4-1.6.3-2.1.8-2.4 2.4-.3-1.6-.8-2.1-2.4-2.4 1.6-.3 2.1-.8 2.4-2.4Z" fill={p.color || 'currentColor'} stroke="none" />
  </Base>
)
export const Star: IconComponent = (p) => (
  <Base {...p}><path d="M12 3.5 14.4 9.3 20.5 9.9 15.9 14 17.3 20 12 16.8 6.7 20 8.1 14 3.5 9.9 9.6 9.3Z" /></Base>
)
export const Save: IconComponent = (p) => (
  <Base {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></Base>
)
export const Check: IconComponent = (p) => (
  <Base {...p}><path d="M5 12.5 9.5 17 19 7" /></Base>
)
export const Loader2: IconComponent = (p) => (
  <Base {...p}><path d="M12 3a9 9 0 1 0 9 9" /></Base>
)
export const ExternalLink: IconComponent = (p) => (
  <Base {...p}><path d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /><path d="M14 4h6v6M10 14 20 4" /></Base>
)
export const Flame: IconComponent = (p) => (
  <Base {...p}><path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" /></Base>
)
export const CalendarCheck: IconComponent = (p) => (
  <Base {...p}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" /><path d="M8.5 14 10.7 16.2 15.5 11.3" /></Base>
)
export const Target: IconComponent = (p) => (
  <Base {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.8" /><circle cx="12" cy="12" r="1.2" fill={p.color || 'currentColor'} stroke="none" /></Base>
)
export const TrendingUp: IconComponent = (p) => (
  <Base {...p}><path d="M3.5 16 9 10.5 13 14.5 20.5 7" /><path d="M15 7h5.5v5.5" /></Base>
)
export const ChevronDown: IconComponent = (p) => (
  <Base {...p}><path d="M6 9.5 12 15.5 18 9.5" /></Base>
)
export const ChevronRight: IconComponent = (p) => (
  <Base {...p}><path d="M9.5 6 15.5 12 9.5 18" /></Base>
)
export const Video: IconComponent = (p) => (
  <Base {...p}><rect x="3" y="6.5" width="12.5" height="11" rx="2.5" /><path d="M15.5 10.3 21 7.5v9l-5.5-2.8Z" /></Base>
)
export const MessageCircle: IconComponent = (p) => (
  <Base {...p}><path d="M4 12a8 8 0 1 1 3.5 6.6L4 20l1.3-3.6A7.9 7.9 0 0 1 4 12Z" /></Base>
)
export const Users: IconComponent = (p) => (
  <Base {...p}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><path d="M16 8.7a2.7 2.7 0 1 1 0 5.4" /><path d="M15.5 14.7c2.2.4 3.9 2.3 4 5.3" /></Base>
)
export const Activity: IconComponent = (p) => (
  <Base {...p}><path d="M3 12h4l2-7 4 14 2-7h6" /></Base>
)
export const Stethoscope: IconComponent = (p) => (
  <Base {...p}><path d="M6 3.5v5a4 4 0 0 0 8 0v-5" /><path d="M10 12.5v2a5 5 0 0 0 10 0v-1.7" /><circle cx="20.3" cy="11.3" r="1.4" /><path d="M6 3.5H4.5M14 3.5h1.5" /></Base>
)
export const Plus: IconComponent = (p) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
)
export const Trash2: IconComponent = (p) => (
  <Base {...p}><path d="M4.5 7h15M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M18.5 7l-.8 12a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.5 7" /><path d="M10 11v6M14 11v6" /></Base>
)
export const Eye: IconComponent = (p) => (
  <Base {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></Base>
)
export const EyeOff: IconComponent = (p) => (
  <Base {...p}><path d="M4 4l16 16" /><path d="M9.9 5.6A10.7 10.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.5 15.5 0 0 1-3.3 4M6.3 7.3C4 8.9 2.5 12 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6" /><path d="M9.6 14.4a2.8 2.8 0 0 1 4-4" /></Base>
)
export const Moon: IconComponent = (p) => (
  <Base {...p}><path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a7 7 0 0 0 9.5 9.5Z" /></Base>
)
export const Droplet: IconComponent = (p) => (
  <Base {...p}><path d="M12 3.5c3.2 4.2 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 2.8-6.8 6-11Z" /></Base>
)
export const Brain: IconComponent = (p) => (
  <Base {...p}><path d="M9.5 4.5a2.6 2.6 0 0 0-2.6 2.6v.4A3 3 0 0 0 5 10.2a3 3 0 0 0 1.3 4.9A2.8 2.8 0 0 0 9 18.8a2.6 2.6 0 0 0 3-2.6V7a2.6 2.6 0 0 0-2.5-2.5Z" /><path d="M14.5 4.5a2.6 2.6 0 0 1 2.6 2.6v.4A3 3 0 0 1 19 10.2a3 3 0 0 1-1.3 4.9 2.8 2.8 0 0 1-2.7 3.7 2.6 2.6 0 0 1-3-2.6V7a2.6 2.6 0 0 1 2.5-2.5Z" /></Base>
)
export const Sun: IconComponent = (p) => (
  <Base {...p}><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2.3M12 19.2v2.3M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.4 19.6 6 18M18 6l1.6-1.6" /></Base>
)
export const Footprints: IconComponent = (p) => (
  <Base {...p}><path d="M7 5.5a2.3 2.3 0 0 1 2.3 2.3c0 2-.5 2.3-.5 4.2a1.8 1.8 0 0 1-3.6 0c0-2.5.8-2.5.8-4.2A2.3 2.3 0 0 1 7 5.5Z" />
    <path d="M17 11.5a2.3 2.3 0 0 1 2.3 2.3c0 2-.5 2.3-.5 4.2a1.8 1.8 0 0 1-3.6 0c0-2.5.8-2.5.8-4.2a2.3 2.3 0 0 1 1-1.8Z" />
    <circle cx="5.2" cy="6" r="0.9" fill={p.color || 'currentColor'} stroke="none" /><circle cx="19.4" cy="12" r="0.9" fill={p.color || 'currentColor'} stroke="none" /></Base>
)
export const Smartphone: IconComponent = (p) => (
  <Base {...p}><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" /></Base>
)
export const LinkIcon: IconComponent = (p) => (
  <Base {...p}><path d="M9.5 14.5 14.5 9.5" /><path d="M12 6.5 13.5 5A4 4 0 1 1 19 10.5L17.5 12" /><path d="M12 17.5 10.5 19A4 4 0 1 1 5 13.5L6.5 12" /></Base>
)
