// Chart primitives transcribed from design-reference/clp-patient-workspace.html.
// All pure SVG/CSS — no chart library, matching the mockups exactly.

export function Ring({
  pct,
  color = 'var(--teal-600)',
  track = 'var(--teal-100)',
  size = 104,
}: {
  pct: number
  color?: string
  track?: string
  size?: number
}) {
  const r = 40
  const circumference = 2 * Math.PI * r // 251.2 in the mockup
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * circumference

  return (
    <svg width={size} height={size} viewBox="0 0 104 104" role="img" aria-label={`${pct}%`}>
      <circle cx="52" cy="52" r={r} fill="none" stroke={track} strokeWidth="10" />
      <circle
        cx="52" cy="52" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${filled.toFixed(2)} ${circumference.toFixed(2)}`}
        strokeLinecap="round"
        transform="rotate(-90 52 52)"
      />
    </svg>
  )
}

export function WeeklyBars({
  weeks,
  currentWeek,
}: {
  weeks: { week: number; pct: number }[]
  currentWeek: number | null
}) {
  if (!weeks.length) {
    return (
      <p className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
        No weekly schedule on this roadmap.
      </p>
    )
  }
  return (
    <div className="mt-1.5 flex h-24 items-end gap-2">
      {weeks.map((w) => {
        const isCurrent = currentWeek === w.week
        return (
          <div key={w.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(w.pct, 2)}%`,
                background: isCurrent ? 'var(--teal-600)' : 'var(--teal-100)',
              }}
              title={`Week ${w.week} — ${w.pct}%`}
            />
            <div className="font-mono-clp text-[9.5px]" style={{ color: 'var(--ink-faint)' }}>
              W{w.week}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const DONUT_COLORS = ['#538A22', '#1F6E63', '#C9A227', '#B5533C', '#DDD3BE']

export function Donut({
  slices,
  size = 120,
}: {
  slices: { name: string; value: number }[]
  size?: number
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total <= 0) return null

  const r = 46
  const circumference = 2 * Math.PI * r // 288.9 in the mockup

  // Arc lengths and their cumulative start offsets, computed up front rather
  // than by mutating a counter inside the render loop.
  const arcs = slices.reduce<{ name: string; len: number; offset: number }[]>((acc, s) => {
    const prev = acc[acc.length - 1]
    const offset = prev ? prev.offset + prev.len : 0
    acc.push({ name: s.name, len: (s.value / total) * circumference, offset })
    return acc
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-[22px]">
      <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Composition">
        <g transform="rotate(-90 60 60)">
          {arcs.map((a, i) => (
            <circle
              key={a.name}
              cx="60" cy="60" r={r} fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="16"
              strokeDasharray={`${a.len.toFixed(2)} ${circumference.toFixed(2)}`}
              strokeDashoffset={`${(-a.offset).toFixed(2)}`}
            />
          ))}
        </g>
      </svg>
      <div className="flex flex-col gap-2">
        {slices.map((s, i) => (
          <div key={s.name} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-soft)' }}>
            <span
              className="h-[9px] w-[9px] flex-shrink-0 rounded-sm"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="capitalize">{s.name}</span> — {((s.value / total) * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  )
}

export function RangeBar({
  name,
  value,
  position,
  labels = ['Low', 'Moderate', 'High'],
}: {
  name: string
  value: string
  position: number | null
  labels?: [string, string, string] | string[]
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="min-w-0 truncate font-semibold" style={{ color: 'var(--ink)' }} title={name}>
          {name}
        </span>
        <span className="font-mono-clp flex-shrink-0" style={{ color: 'var(--ink-soft)' }}>{value}</span>
      </div>
      <div
        className="relative h-2 rounded"
        style={{
          background:
            'linear-gradient(90deg,#EFD9A8 0 20%, var(--pista-100) 20% 75%, #E7C2B4 75% 100%)',
        }}
      >
        {position !== null && (
          <div
            className="absolute w-[3px] rounded-sm"
            style={{ left: `${position}%`, top: -3, height: 14, background: 'var(--ink)' }}
          />
        )}
      </div>
      <div
        className="font-mono-clp mt-1 flex justify-between text-[9.5px]"
        style={{ color: 'var(--ink-faint)' }}
      >
        {labels.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  )
}

export function BarTrack({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-[3px]" style={{ background: 'var(--line-soft)' }}>
      <div className="h-full rounded-[3px]" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}
