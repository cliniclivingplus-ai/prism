// interpret/route.ts generates weekly_schedule (one entry per week: focus_theme,
// cause, actions[], milestone). The Client Guide's roadmap page is always a
// fixed 12-month / 4-quarter structure (Months 1-3, 4-6, 7-9, 10-12) — that's
// the template's own framing, independent of how many weeks a given coaching
// cycle actually generated. Weeks are mapped into their real quarter by
// week_number (~4 weeks/month); a quarter with no generated weeks yet is
// rendered as "not yet planned" rather than inventing content for it.
export type WeeklyPlan = {
  week_number: number
  focus_theme: string
  cause: string
  actions: string[]
  // Optional day-by-day escalation of `actions` — 7 entries (Sunday through
  // Saturday), each a same-length array of that day's short, progressively
  // harder version of every action above. Absent on roadmaps generated
  // before this existed; those keep showing the same `actions` every day,
  // exactly as before — this is additive, never a breaking change.
  days?: string[][]
  milestone?: string
  // Free text the coach types/pastes for this specific week — not AI-generated.
  // Finalized in the wellness-guide preview before the PDF is generated.
  food_menu?: string
}

export type RoadmapQuarter = {
  label: string
  monthRange: string
  macroGoal: string
  microGoals: string[]
  successLooksLike: string
  planned: boolean
}

const QUARTERS = [
  { label: 'Quarter 1', monthRange: 'Months 1–3', weekStart: 1, weekEnd: 12 },
  { label: 'Quarter 2', monthRange: 'Months 4–6', weekStart: 13, weekEnd: 24 },
  { label: 'Quarter 3', monthRange: 'Months 7–9', weekStart: 25, weekEnd: 36 },
  { label: 'Quarter 4', monthRange: 'Months 10–12', weekStart: 37, weekEnd: 48 },
] as const

export function reshapeRoadmapIntoQuarters(weeklySchedule: WeeklyPlan[] | null | undefined): RoadmapQuarter[] {
  const weeks = Array.isArray(weeklySchedule) ? [...weeklySchedule].sort((a, b) => a.week_number - b.week_number) : []

  return QUARTERS.map((q) => {
    const chunk = weeks.filter((w) => w.week_number >= q.weekStart && w.week_number <= q.weekEnd)
    if (chunk.length === 0) {
      return {
        label: q.label,
        monthRange: q.monthRange,
        macroGoal: 'Not yet planned, will be scoped with your coach in a future cycle.',
        microGoals: [],
        successLooksLike: '',
        planned: false,
      }
    }
    const last = chunk[chunk.length - 1]
    return {
      label: q.label,
      monthRange: q.monthRange,
      macroGoal: last.focus_theme,
      microGoals: chunk.flatMap((w) => w.actions ?? []).slice(0, 2),
      successLooksLike: last.milestone || 'Rechecked with your coach at the end of this quarter.',
      planned: true,
    }
  })
}

// Finer-grained than a quarter — one entry per calendar month (4 weeks each),
// carrying the raw weeks so both the PDF's monthly roadmap boxes and the
// coach-facing week-by-week editor in the wellness-guide preview can read
// (and, in the editor's case, write) each week's goals/food menu individually
// instead of only ever seeing a 12-week quarter blended into one summary.
export type MonthGroup = {
  quarterLabel: string
  monthLabel: string
  monthNumber: number // 1-12, absolute across the whole plan
  weekStart: number
  weekEnd: number
  weeks: WeeklyPlan[]
  planned: boolean
}

const MONTHS: { quarterLabel: string; monthLabel: string; monthNumber: number; weekStart: number; weekEnd: number }[] =
  Array.from({ length: 12 }, (_, i) => {
    const monthNumber = i + 1
    return {
      quarterLabel: QUARTERS[Math.floor(i / 3)].label,
      monthLabel: `Month ${monthNumber}`,
      monthNumber,
      weekStart: i * 4 + 1,
      weekEnd: i * 4 + 4,
    }
  })

export function reshapeRoadmapIntoMonths(weeklySchedule: WeeklyPlan[] | null | undefined): MonthGroup[] {
  const weeks = Array.isArray(weeklySchedule) ? [...weeklySchedule].sort((a, b) => a.week_number - b.week_number) : []
  return MONTHS.map((m) => {
    const chunk = weeks.filter((w) => w.week_number >= m.weekStart && w.week_number <= m.weekEnd).map(withDayFloor)
    return { ...m, weeks: chunk, planned: chunk.length > 0 }
  })
}

// Deterministic floor for `days` — roadmaps generated before day-by-day
// escalation existed (or ones whose AI response omitted it) have `days`
// missing or malformed, so every template's own `week.days?.[dayIndex] ??
// week.actions ?? []` read silently falls back to repeating the same 3
// flat `actions` on every day of the week. Applying the same synthesis
// used at generation time (interpret/route.ts) here too — at read time,
// for every template — means an older roadmap gets the identical
// day-by-day framing a freshly generated one would, without an AI call and
// without ever inventing a new action: each day is just that week's own
// real action, reframed with a progression marker.
const DAY_PROGRESS_MARKERS = [
  'Day 1, starting today',
  'Day 2, keep going',
  'Day 3, building the habit',
  'Day 4, building the habit',
  'Day 5, almost there',
  'Day 6, almost there',
  'Day 7, fully in place',
]
function firstSentence(text: string): string {
  const cut = text.split(/(?<=[.!])\s/)[0] || text
  return cut.length > 70 ? cut.slice(0, 67) + '…' : cut
}
export function buildDayProgression(actions: string[]): string[][] {
  return DAY_PROGRESS_MARKERS.map((marker) => actions.map((a) => `${marker}: ${firstSentence(a)}`))
}
export function hasValidDays(week: { days?: unknown }, actionCount: number): boolean {
  const days = week.days
  return Array.isArray(days) && days.length === 7 && days.every((d) => Array.isArray(d) && d.length === actionCount && d.every((x) => typeof x === 'string' && x.trim()))
}
function withDayFloor(w: WeeklyPlan): WeeklyPlan {
  const actions = w.actions ?? []
  if (actions.length === 0 || hasValidDays(w, actions.length)) return w
  return { ...w, days: buildDayProgression(actions) }
}
