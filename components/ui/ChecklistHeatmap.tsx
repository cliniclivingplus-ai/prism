import type { ChecklistHeatmap as ChecklistHeatmapData } from '@/lib/clinical/derive'

// Two rows of information, same day columns:
// 1. "Consistency" strip — one cell per day, shaded by % of that day's
//    checklist completed. This is the at-a-glance answer to "how
//    consistent are they" — a run of pale cells reads as a slump
//    immediately, without doing arithmetic.
// 2. The per-item matrix underneath — same columns, one row per checklist
//    item — answers the next question a coach actually has: which item is
//    the one that keeps slipping (a lone empty column down one row, while
//    the rest of that day is filled in, versus that item being skipped
//    for a run of days).
// Server-rendered, no interactivity — this is a read-only report.
export default function ChecklistHeatmap({ data }: { data: ChecklistHeatmapData }) {
  if (data.items.length === 0 || data.days.length === 0) {
    return (
      <p className="m-0 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
        No Daily Health Check-in exists for this roadmap yet.
      </p>
    )
  }

  const cell = 15
  const gap = 3

  function pctColor(pct: number): string {
    if (pct <= 0) return 'var(--line-soft)'
    // Interpolates the brand teal's opacity rather than switching palettes —
    // reads as one continuous scale, not a handful of discrete buckets.
    const alpha = 0.18 + (pct / 100) * 0.72
    return `color-mix(in srgb, var(--teal-700) ${Math.round(alpha * 100)}%, var(--paper-raised))`
  }

  function dayLabel(date: string): string {
    // date is a UTC day-string (see computeChecklistHeatmap) — parse as
    // UTC too, so the label can't drift a day off in a non-UTC timezone.
    const d = new Date(`${date}T00:00:00Z`)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 10, minWidth: '100%' }}>
        {/* Consistency strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 108, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)' }}>
            Daily consistency
          </div>
          <div style={{ display: 'flex', gap }}>
            {data.days.map((day) => (
              <div
                key={day.date}
                title={`${dayLabel(day.date)} — ${day.checked.size} of ${data.items.length} done (${day.pct}%)`}
                style={{ width: cell, height: cell, borderRadius: 3, background: pctColor(day.pct), border: '1px solid var(--line-soft)' }}
              />
            ))}
          </div>
        </div>

        {/* Per-item matrix */}
        {data.items.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              title={item.text}
              style={{ width: 108, flexShrink: 0, fontSize: 11, color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {item.text}
            </div>
            <div style={{ display: 'flex', gap }}>
              {data.days.map((day) => {
                const checked = day.checked.has(item.id)
                return (
                  <div
                    key={day.date}
                    title={`${dayLabel(day.date)} — ${item.text}: ${checked ? 'done' : 'not done'}`}
                    style={{
                      width: cell, height: cell, borderRadius: 3,
                      background: checked ? 'var(--teal-700)' : 'var(--line-soft)',
                      border: '1px solid var(--line-soft)',
                    }}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* Date axis — first/last labels only (a label per column would be
            unreadable at this cell size). Too few columns for both to fit
            side by side without colliding (a brand-new plan might only
            have a single day yet), so below a width threshold this shows
            one centered label instead of two overlapping ones. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 108, flexShrink: 0 }} />
          <div style={{ position: 'relative', width: data.days.length * (cell + gap) - gap, height: 14 }}>
            {data.days.length * (cell + gap) < 90 ? (
              <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
                {data.days.length === 1 ? dayLabel(data.days[0].date) : `${dayLabel(data.days[0].date)} – ${dayLabel(data.days[data.days.length - 1].date)}`}
              </span>
            ) : (
              <>
                <span style={{ position: 'absolute', left: 0, fontSize: 10, color: 'var(--ink-faint)' }}>{dayLabel(data.days[0].date)}</span>
                <span style={{ position: 'absolute', right: 0, fontSize: 10, color: 'var(--ink-faint)' }}>{dayLabel(data.days[data.days.length - 1].date)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
