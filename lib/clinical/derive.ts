// Derivations behind the dashboard and patient workspace.
//
// Everything here is computed from real rows. Where the mockups show a field
// the schema has no source for (program name, allergies on a Compass patient,
// "next session"), these return null and the UI renders an explicit dash —
// this is a clinical tool, so an invented number is worse than a blank.

export type ToolState = 'ok' | 'stale' | 'empty'

/** Anything touched within 30 days reads as current; older reads as stale. */
const STALE_AFTER_DAYS = 30

export function toolState(lastTouched: string | null | undefined): ToolState {
  if (!lastTouched) return 'empty'
  return daysSince(lastTouched) > STALE_AFTER_DAYS ? 'stale' : 'ok'
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = daysSince(iso)
  if (d <= 0) {
    const hrs = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
    return hrs <= 0 ? 'just now' : `${hrs}h ago`
  }
  return `${d}d ago`
}

export function initials(name: string | null | undefined): string {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null
  const b = new Date(dob)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Adherence ────────────────────────────────────────────────────────
// roadmaps.weekly_schedule is an array of weeks, each with an `actions`
// array. A check-in row is one (week_number, action_index, date) the patient
// ticked. Adherence per week = distinct actions ticked / actions planned.

export type WeekRow = { week_number?: number; actions?: unknown[]; focus_theme?: string }
export type Checkin = { week_number: number; action_index: number; checkin_date: string }

export type Adherence = {
  weeks: { week: number; planned: number; done: number; pct: number }[]
  overallPct: number | null
  currentWeek: number | null
  totalWeeks: number
  focusTheme: string | null
}

export function computeAdherence(
  weeklySchedule: unknown,
  checkins: Checkin[],
  roadmapCreatedAt: string | null
): Adherence {
  const schedule: WeekRow[] = Array.isArray(weeklySchedule) ? (weeklySchedule as WeekRow[]) : []
  const totalWeeks = schedule.length

  // Elapsed weeks since the roadmap was generated, clamped to the plan length.
  let currentWeek: number | null = null
  if (roadmapCreatedAt && totalWeeks > 0) {
    const elapsed = Math.floor(daysSince(roadmapCreatedAt) / 7) + 1
    currentWeek = Math.min(Math.max(elapsed, 1), totalWeeks)
  }

  const weeks = schedule.map((w, i) => {
    const weekNo = typeof w.week_number === 'number' ? w.week_number : i + 1
    const planned = Array.isArray(w.actions) ? w.actions.length : 0
    const done = new Set(
      checkins.filter((c) => c.week_number === weekNo).map((c) => c.action_index)
    ).size
    return {
      week: weekNo,
      planned,
      done: Math.min(done, planned || done),
      pct: planned > 0 ? Math.round((Math.min(done, planned) / planned) * 100) : 0,
    }
  })

  // Only weeks that have actually come around count toward the headline —
  // future weeks aren't misses.
  const elapsedWeeks = weeks.filter((w) => currentWeek === null || w.week <= currentWeek)
  const planned = elapsedWeeks.reduce((s, w) => s + w.planned, 0)
  const done = elapsedWeeks.reduce((s, w) => s + w.done, 0)

  return {
    weeks,
    overallPct: planned > 0 ? Math.round((done / planned) * 100) : null,
    currentWeek,
    totalWeeks,
    focusTheme:
      currentWeek !== null
        ? (schedule[currentWeek - 1]?.focus_theme ?? null)
        : null,
  }
}
