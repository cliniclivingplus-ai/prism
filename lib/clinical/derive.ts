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

// ── Daily Health Check-in heatmap ──────────────────────────────────────
// Same roadmap_checkins table as adherence above, but the Daily Health
// Check-in items use the sentinel week_number 0 with a stable item_id
// (see lib/dailyChecklist.ts and the checkins route) instead of
// action_index — a patient ticking off some subset of that day's items,
// which is exactly the "3 of 6 today, 5 of 6 tomorrow" pattern a coach
// wants to see at a glance, not just a single adherence percentage.

export type ChecklistItemLite = { id: string; text: string }
export type ChecklistCheckin = { item_id: string | null; week_number: number; checkin_date: string }

export type ChecklistHeatmapDay = {
  date: string // YYYY-MM-DD
  checked: Set<string> // item ids checked this day
  pct: number // checked.size / items.length, 0 when items.length is 0
}

export type ChecklistHeatmap = {
  items: ChecklistItemLite[]
  days: ChecklistHeatmapDay[]
}

// Capped rather than showing the whole plan history — a coach scanning
// for a recent pattern doesn't need six months of squares, and an
// unbounded width breaks the layout on a long-running plan.
const HEATMAP_MAX_DAYS = 28

// checkin_date is written elsewhere (todayISO() in every guide template,
// the checkins routes) as new Date().toISOString().slice(0, 10) — pure
// UTC. Building "today" or "N days ago" via local-time Date methods
// (setHours(0,0,0,0), getDate()/setDate()) and only converting to UTC at
// the last step silently drifts by a day whenever the server's local
// timezone isn't UTC (exactly the bug DashboardClient.tsx's todayISO()
// comment already warns about) — so every date computed here stays a UTC
// day-string end to end, never a local-time Date object.
function utcDateFromISODate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00Z`)
}
function addUTCDays(dateOnly: string, delta: number): string {
  const d = utcDateFromISODate(dateOnly)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function computeChecklistHeatmap(
  items: ChecklistItemLite[],
  checkins: ChecklistCheckin[],
  roadmapCreatedAt: string | null
): ChecklistHeatmap {
  if (items.length === 0) return { items, days: [] }

  const today = new Date().toISOString().slice(0, 10)
  const created = roadmapCreatedAt ? roadmapCreatedAt.slice(0, 10) : null

  const checkedByDate = new Map<string, Set<string>>()
  let earliestCheckin: string | null = null
  for (const c of checkins) {
    if (c.week_number !== 0 || !c.item_id) continue
    if (!checkedByDate.has(c.checkin_date)) checkedByDate.set(c.checkin_date, new Set())
    checkedByDate.get(c.checkin_date)!.add(c.item_id)
    if (!earliestCheckin || c.checkin_date < earliestCheckin) earliestCheckin = c.checkin_date
  }

  // The window starts at the roadmap's creation date by default — a blank
  // square before that would misread as "skipped" rather than "not yet a
  // thing." But the date picker on the patient's own checklist has no
  // floor (a coach or patient can log a catch-up entry for any earlier
  // date), so real data can exist before that default floor too — when it
  // does, the window opens back to cover it instead of silently hiding it.
  const floor = earliestCheckin && (!created || earliestCheckin < created) ? earliestCheckin : created
  const daysSinceFloor = floor
    ? Math.floor((utcDateFromISODate(today).getTime() - utcDateFromISODate(floor).getTime()) / 86_400_000) + 1
    : HEATMAP_MAX_DAYS
  const span = Math.max(1, Math.min(HEATMAP_MAX_DAYS, daysSinceFloor))

  const days: ChecklistHeatmapDay[] = []
  for (let i = span - 1; i >= 0; i--) {
    const date = addUTCDays(today, -i)
    const checked = checkedByDate.get(date) ?? new Set<string>()
    days.push({ date, checked, pct: Math.round((checked.size / items.length) * 100) })
  }

  return { items, days }
}
