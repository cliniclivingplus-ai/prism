'use client'

// Shared visualization primitives — originally built for VitalsTemplate
// (src/app/dashboard/[roadmapId]/VitalsTemplate.tsx), factored out here so
// the AI-generated consultation-checklist feature (src/lib/blocks/*) uses
// the exact same, already-verified components instead of a duplicate copy.
import type { CSSProperties } from 'react'
import { Quote } from 'lucide-react'
import { renderMarkdownBold } from '@/lib/renderMarkdownBold'

export const DEFAULT_WHEEL_COLORS = ['#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
export const DEFAULT_TRACK_COLOR = '#E5E9F0'
export const DEFAULT_ACCENT = '#2563EB'
export const DEFAULT_ACCENT_SOFT = '#EFF4FF'
export const DEFAULT_LINE = '#E5E9F0'
export const DEFAULT_CARD_BG = '#FFFFFF'

// A single circular stat ring, always driven by a real 0-100 value —
// never a fabricated or estimated number.
export function Ring({ pct, size = 132, thickness = 12, color = DEFAULT_ACCENT, trackColor = DEFAULT_TRACK_COLOR, children }: { pct: number; size?: number; thickness?: number; color?: string; trackColor?: string; children?: React.ReactNode }) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * clamped) / 100} style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(.2,.8,.3,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToXY(cx, cy, r, endAngle)
  const end = polarToXY(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}
function arcLength(r: number, startAngle: number, endAngle: number) {
  return r * ((endAngle - startAngle) * Math.PI) / 180
}

// The "functional medicine wheel" — each segment sized equally, filled
// clockwise by its own real pct (0-100). Never a fabricated metric.
export function Wheel({ segments, size = 220, thickness = 16, selectedIndex, onSelect, colors = DEFAULT_WHEEL_COLORS, trackColor = DEFAULT_TRACK_COLOR }: { segments: { label: string; pct: number }[]; size?: number; thickness?: number; selectedIndex?: number | null; onSelect?: (i: number) => void; colors?: string[]; trackColor?: string }) {
  const n = segments.length
  if (n === 0) return null
  const gap = n > 1 ? 5 : 0
  const slice = 360 / n
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const start = i * slice + gap / 2
        const end = (i + 1) * slice - gap / 2
        const len = arcLength(r, start, end)
        const pct = Math.max(0, Math.min(100, seg.pct))
        const color = colors[i % colors.length]
        const active = selectedIndex === i
        return (
          <g key={i} onClick={() => onSelect?.(i)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <path d={describeArc(cx, cy, r, start, end)} stroke={trackColor} strokeWidth={thickness} fill="none" strokeLinecap="round" />
            <path d={describeArc(cx, cy, r, start, end)} stroke={color} strokeWidth={active ? thickness + 5 : thickness} fill="none" strokeLinecap="round"
              strokeDasharray={`${len * pct / 100} ${len}`} style={{ transition: 'stroke-dasharray 0.6s ease, stroke-width 0.2s ease' }} />
          </g>
        )
      })}
    </svg>
  )
}

export function Card({ id, hidden, children, style, background = DEFAULT_CARD_BG, borderColor = DEFAULT_LINE, onClick, selected }: { id?: string; hidden?: boolean; children: React.ReactNode; style?: CSSProperties; background?: string; borderColor?: string; onClick?: () => void; selected?: boolean }) {
  return (
    <div id={id} onClick={onClick} style={{
      background, border: `1px solid ${selected ? DEFAULT_ACCENT : borderColor}`, borderRadius: 20, padding: '1.75rem 1.9rem', marginBottom: 16,
      boxShadow: selected ? '0 0 0 3px rgba(37,99,235,0.15)' : '0 1px 2px rgba(17,24,39,0.03)',
      cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
      ...(hidden ? { display: 'none' } : {}), ...style,
    }}>
      {children}
    </div>
  )
}

// A proportional pie/donut — unlike Wheel (equal segments each independently
// filled 0-100%), this is a real chart: each slice's ANGLE is proportional
// to its own share of the total. Only ever fed real numbers a coach typed
// or a patient's own tracked data — never fabricated.
export function PieChart({ data, size = 180, thickness = 28, colors = DEFAULT_WHEEL_COLORS }: { data: { label: string; value: number }[]; size?: number; thickness?: number; colors?: string[] }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0)
  if (total <= 0) return null
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  let cursor = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const share = Math.max(0, d.value) / total
        const start = cursor * 360
        const end = (cursor + share) * 360
        cursor += share
        if (share <= 0) return null
        return (
          <path key={i} d={describeArc(cx, cy, r, start, end)} stroke={colors[i % colors.length]} strokeWidth={thickness} fill="none" strokeLinecap={data.length === 1 ? 'round' : 'butt'} />
        )
      })}
    </svg>
  )
}

// Founder's note / coach's note / "your why" / any goal statement — the
// real, unedited text stays completely intact; this only changes HOW it's
// presented (a large photo-forward quote, not a paragraph block).
export function PullQuote({ photo, initials, name, role, quote, quoteIsItalic, accentColor = DEFAULT_ACCENT, accentSoft = DEFAULT_ACCENT_SOFT, borderColor = DEFAULT_LINE, showAvatar = true }: { photo?: string | null; initials?: string; name?: string; role?: string; quote: string; quoteIsItalic?: boolean; accentColor?: string; accentSoft?: string; borderColor?: string; showAvatar?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {showAvatar && (
        <div style={{ width: 84, height: 84, borderRadius: 22, flexShrink: 0, background: photo ? `url(${photo}) center/cover` : accentColor, border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, fontWeight: 800 }}>
          {!photo && initials}
        </div>
      )}
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <Quote size={26} color={accentSoft} fill={accentSoft} style={{ marginBottom: 6 }} />
        <p style={{ fontSize: '1.15rem', lineHeight: 1.5, color: '#111827', fontWeight: 500, fontStyle: quoteIsItalic ? 'italic' : 'normal', margin: name || role ? '0 0 14px' : 0 }}>{renderMarkdownBold(quote)}</p>
        {name && <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{name}</div>}
        {role && <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 1 }}>{role}</div>}
      </div>
    </div>
  )
}
