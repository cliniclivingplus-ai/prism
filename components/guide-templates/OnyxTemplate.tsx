'use client'

// A fourth, read-only patient-facing presentation of the exact same
// GuideData Classic/Almanac/Pulse use — same real data, a fourth visual
// language: a near-black, understated-premium clinic look (hairline gold
// borders, sharp corners, Cormorant Garamond serif numerals against clean
// Inter body text). Centerpiece is a "signature bar", a thin gold rule that
// fills to the patient's real tracked adherence with the percentage set in
// large serif type above it — grounded in the same goalsDone /
// totalActionsInPlan number "Track your progress" shows, just a quieter,
// more editorial read than Almanac's tree or Pulse's ring. A coach always
// edits content in the Classic editor regardless of which template is
// picked; this component never runs in editable mode.
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  HeartPulse, Utensils, Pill, Phone, CalendarCheck, HelpCircle, ChefHat, MapPin, ChevronDown, ChevronRight, X, Download,
  CheckCircle2, Circle, Sparkles, Star, ShoppingCart, Video, MessageCircle, Activity, Stethoscope, Users, Flame, Target, TrendingUp,
  Moon, Droplet, Brain, Sun, Footprints, Smartphone, Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react'
import type { GuideData, DayMealSlot } from '@/lib/pdf/ClientGuideDocument'
import { parseNutritionistGuidelines } from '@/lib/pdf/parseNutritionistGuidelines'
import { selectRecipesForPatient } from '@/lib/pdf/matchRecipes'
import { reshapeRoadmapIntoMonths, type WeeklyPlan } from '@/lib/pdf/reshapeRoadmap'
import { getSlotRecipes } from '@/lib/pdf/weekRecipes'
import { renderMarkdownBold } from '@/lib/renderMarkdownBold'
import { splitRecipeLines } from '@/lib/recipeText'
import { GROCERY_CATEGORIES } from '@/lib/foodPlates'
import { buildGroceryList, type GroceryCategory } from '@/lib/groceryList'
import { matchGuideImageDistinct } from '@/lib/pdf/matchGuideImage'
import { buildInlineExportScript } from '@/lib/pdf/inlineExportScript'
import { CanvasBlocksSection } from './CanvasBlocksSection'
import { toBlockTheme } from '@/lib/blocks/BlockRenderer'
import { splitIntoPeriods, parseScheduleLines } from '@/lib/periodBullets'
import { type ChecklistItem } from '@/lib/dailyChecklist'

const LIFESTYLE_PERIODS = ['Morning', 'Afternoon', 'Evening']
const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner']

const DAY_MEAL_SLOTS: DayMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']
const SLOT_LABELS: Record<DayMealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks', dessert: 'Desserts' }
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const CARE_ICON_MAP: Record<string, LucideIcon> = {
  coaching: Star, video: Video, phone: Phone, chat: MessageCircle, nutrition: Utensils,
  labs: Activity, wellness: HeartPulse, clinical: Stethoscope, group: Users, followup: CalendarCheck,
}

function shiftDateISO(dateISO: string, deltaDays: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Roadmaps don't store an explicit start date, so a week's "Sunday" is
// anchored to the real calendar Sunday of the week the roadmap was created
// in — Week 2's Monday is then just +7 days +1 from that same anchor. This
// is what makes each DAY_LABELS tab (and its checkbox) a genuine, distinct
// calendar date instead of every day silently sharing today's checkin.
function weekSundayISO(createdAtISO: string): string {
  const dateOnly = createdAtISO.slice(0, 10)
  const d = new Date(`${dateOnly}T00:00:00Z`)
  return shiftDateISO(dateOnly, -d.getUTCDay())
}
function dateForWeekDay(createdAtISO: string, weekNumber: number, dayIndex: number): string {
  return shiftDateISO(weekSundayISO(createdAtISO), (weekNumber - 1) * 7 + dayIndex)
}

// Real, current local time, not a fabricated detail — just a quieter way to
// say "hi" than a static greeting.
function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

type Checkin = { week_number: number; action_index: number | null; checkin_date: string; item_id?: string | null; item_text_snapshot?: string | null }

function parseBullets(text: string): string[] {
  return (text || '')
    .split(/\n|(?=•)/)
    .map((s) => s.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean)
}

function splitKV(bullet: string): { k: string | null; v: string } {
  const m = bullet.match(/^([^:]{2,30}):\s*(.+)$/)
  return m ? { k: m[1].trim(), v: m[2].trim() } : { k: null, v: bullet }
}

const LIFESTYLE_ICON_RULES: [RegExp, LucideIcon][] = [
  [/\b(sleep|bedtime|wind[- ]down|rest)\b/i, Moon],
  [/\b(water|hydrat|fluid)\b/i, Droplet],
  [/\b(walk|step|exercise|movement|activity|stretch|workout)\b/i, Footprints],
  [/\b(stress|cortisol|relax|breath|meditat|mindful|anxiety)\b/i, Brain],
  [/\b(meal|eat|food|breakfast|lunch|dinner|snack|diet|protein|fiber|sugar)\b/i, Utensils],
  [/\b(screen|phone|device|scroll)\b/i, Smartphone],
  [/\b(sun|morning|light|wake)\b/i, Sun],
]
function iconForBullet(text: string): LucideIcon {
  for (const [pattern, Icon] of LIFESTYLE_ICON_RULES) if (pattern.test(text)) return Icon
  return HeartPulse
}

const ONYX = {
  bg: '#101114', card: '#17181C', border: 'rgba(255,255,255,0.08)',
  ink: '#F4F2EC', inkSoft: '#C9C7C0', muted: '#8A8A8E',
  accent: '#C9A44C', accentSoft: 'rgba(201,164,76,0.12)', accentDeep: '#E0BD70', onAccent: '#14151A',
  warn: '#D9776B',
}

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap'
const SERIF = "'Cormorant Garamond', serif"

const TOC_ITEMS: { label: string; id: string }[] = [
  { label: 'Daily health check-in', id: 'checkin' },
  { label: 'Founder’s note', id: 'founder' },
  { label: 'Meet your coach', id: 'coach' },
  { label: 'Your care team', id: 'careteam' },
  { label: 'How to use this guide', id: 'howto' },
  { label: 'Daily lifestyle guidelines', id: 'lifestyle' },
  { label: 'Breakfast, lunch & dinner', id: 'meals' },
  { label: 'Daily schedule', id: 'schedule' },
  { label: 'Your roadmap', id: 'roadmap' },
  { label: 'Nutrition guidelines', id: 'nutrition' },
  { label: 'Grocery list', id: 'grocery' },
  { label: 'Supplements', id: 'supplements' },
  { label: 'Services', id: 'services' },
  { label: 'Track your progress', id: 'track' },
  { label: 'When to reach us', id: 'reach' },
  { label: 'FAQ', id: 'faq' },
]

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: ONYX.accent, display: 'block', marginBottom: 10 }}>
      {children}
    </span>
  )
}

function SecTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <span style={{ color: ONYX.accent, display: 'flex' }}>{icon}</span>
      <h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, margin: 0, color: ONYX.ink }}>{children}</h2>
    </div>
  )
}

function Card({ id, hidden, children, style }: { id?: string; hidden?: boolean; children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div id={id} style={{
      background: ONYX.card, border: `1px solid ${ONYX.border}`, borderRadius: 4, padding: '1.75rem 1.9rem', marginBottom: 14,
      ...(hidden ? { display: 'none' } : {}), ...style,
    }}>
      {children}
    </div>
  )
}

function KVGrid({ items, showIcons }: { items: string[]; showIcons?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: showIcons ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 18 }}>
      {items.map((bullet, i) => {
        const { k, v } = splitKV(bullet)
        const Icon = showIcons ? iconForBullet(bullet) : null
        return (
          <div key={i} style={{ border: `1px solid ${ONYX.border}`, borderRadius: 2, padding: '12px 14px', background: ONYX.bg, display: 'flex', gap: Icon ? 14 : 0, alignItems: 'center' }}>
            {Icon && (
              <div style={{ width: 30, height: 30, borderRadius: 2, background: ONYX.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={14} color={ONYX.accent} />
              </div>
            )}
            <div>
              {k && <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.accent, marginBottom: 4 }}>{k}</span>}
              <span style={{ fontSize: '0.9rem', lineHeight: 1.5, color: ONYX.inkSoft }}>{renderMarkdownBold(v)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// The centerpiece visual: a thin gold rule that fills to the patient's real
// tracked adherence (goalsDone / totalActionsInPlan, the same number "Track
// your progress" shows) with the percentage set large in serif type above
// it — a quiet, editorial read in place of Almanac's tree or Pulse's ring,
// grounded in the exact same real number either of those would show.
function SignatureBar({ pct, goalsDone, totalActionsInPlan }: { pct: number; goalsDone: number; totalActionsInPlan: number }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 500, color: ONYX.ink }}><span data-pct-text>{pct}</span><span style={{ fontSize: 20, color: ONYX.accent }}>%</span></span>
        {totalActionsInPlan > 0 && <span style={{ fontSize: 11, color: ONYX.muted, letterSpacing: '0.06em' }}><span data-goals-done>{goalsDone}</span> / {totalActionsInPlan} GOALS TRACKED</span>}
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
        <div data-bar-fill style={{ position: 'absolute', left: 0, top: 0, height: 1, width: `${pct}%`, background: ONYX.accent }} />
        <div data-bar-dot style={{ position: 'absolute', left: `${pct}%`, top: -3, width: 7, height: 7, borderRadius: '50%', background: ONYX.accent, transform: 'translateX(-50%)' }} />
      </div>
    </div>
  )
}

export default function OnyxTemplate({ shareToken, data, initialCheckins }: { shareToken: string; data: GuideData; initialCheckins: Checkin[] }) {
  const firstName = data.patient.full_name?.split(' ')[0] || 'there'
  const coachFirst = data.coach?.full_name?.split(' ')[0] || 'your coach'
  const hiddenSections = data.hiddenSections ?? []
  const isHidden = (id: string) => hiddenSections.includes(id)
  const parsed = useMemo(() => parseNutritionistGuidelines(data.roadmap.nutritionist_guidelines), [data.roadmap.nutritionist_guidelines])
  const lifestyleBullets = useMemo(() => parseBullets(data.roadmap.lifestyle_guidelines), [data.roadmap.lifestyle_guidelines])

  const months = useMemo(() => reshapeRoadmapIntoMonths(data.roadmap.weekly_schedule).filter((m) => m.planned), [data.roadmap.weekly_schedule])

  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins)

  const weekMealMatches = useMemo(() => selectRecipesForPatient(
    { primaryConcern: data.patient.primary_concern || '', dietProtocol: parsed.dietProtocol },
    data.recipeBank, 5
  ), [data.patient.primary_concern, parsed.dietProtocol, data.recipeBank])

  const [openMonth, setOpenMonth] = useState<number | null>(null)
  const [openWeek, setOpenWeek] = useState<number | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(false)

  const today = todayISO()
  const progress = useMemo(() => {
    const dateSet = new Set(checkins.map((c) => c.checkin_date))
    let streak = 0
    let cursor = dateSet.has(today) ? today : shiftDateISO(today, -1)
    while (dateSet.has(cursor)) { streak++; cursor = shiftDateISO(cursor, -1) }
    const doneKeys = new Set(checkins.map((c) => `${c.week_number}:${c.action_index}`))
    // A week with a real day-by-day breakdown (WeeklyPlan.days) tracks
    // completion per real calendar day instead of "done on any day counts"
    // — each of the 7 days is a genuinely different task now, so a checkin
    // only counts if it actually falls on that day's own real date. A
    // legacy week (no `days`) keeps the old date-agnostic counting exactly
    // as before, so older roadmaps' numbers never change underneath them.
    const weekStats = (w: WeeklyPlan) => {
      if (w.days && w.days.length > 0) {
        const validDates = new Set(DAY_LABELS.map((_, i) => dateForWeekDay(data.createdAt, w.week_number, i)))
        const perDay = w.days[0]?.length ?? w.actions?.length ?? 0
        const total = w.days.reduce((n, d) => n + d.length, 0)
        const done = checkins.filter((c) => c.week_number === w.week_number && c.action_index != null && c.action_index < perDay && validDates.has(c.checkin_date)).length
        return { total, done }
      }
      const total = w.actions?.length ?? 0
      const done = (w.actions ?? []).filter((_, i) => doneKeys.has(`${w.week_number}:${i}`)).length
      return { total, done }
    }
    const monthStats = months.map((m) => {
      const stats = m.weeks.map(weekStats)
      const total = stats.reduce((n, s) => n + s.total, 0)
      const done = stats.reduce((n, s) => n + s.done, 0)
      return { monthNumber: m.monthNumber, monthLabel: m.monthLabel, doneActions: done, totalActions: total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
    })
    const bestMonth = monthStats.reduce<typeof monthStats[number] | null>((best, m) => (m.doneActions > 0 && m.pct > (best?.pct ?? -1) ? m : best), null)
    return { streak, totalDaysLogged: dateSet.size, monthStats, bestMonth }
  }, [checkins, months, today, data.createdAt])

  // Derived from the exact same per-month totals "Track your progress"
  // shows (never recomputed separately) — the "goals accomplished" stat can
  // never silently disagree with it.
  const totalActionsInPlan = progress.monthStats.reduce((n, m) => n + m.totalActions, 0)
  const goalsDone = progress.monthStats.reduce((n, m) => n + m.doneActions, 0)
  const adherencePct = totalActionsInPlan > 0 ? Math.round((goalsDone / totalActionsInPlan) * 100) : 0

  const checkedSet = useMemo(() => new Set(checkins.map((c) => (c.item_id ? `0:item:${c.item_id}:${c.checkin_date}` : `${c.week_number}:${c.action_index}:${c.checkin_date}`))), [checkins])

  const checklistItems: ChecklistItem[] = data.dailyChecklistItems || []
  const [checkinDate, setCheckinDate] = useState(today)
  const checkinDoneCount = checklistItems.filter((it) => checkedSet.has(`0:item:${it.id}:${checkinDate}`)).length
  const checkinAllDone = checklistItems.length > 0 && checkinDoneCount === checklistItems.length
  const checkinNoneDone = checkinDoneCount === 0

  async function toggleChecklistItem(itemId: string, itemText: string, date: string) {
    const key = `0:item:${itemId}:${date}`
    const wasChecked = checkedSet.has(key)
    const entry: Checkin = { week_number: 0, action_index: null, checkin_date: date, item_id: itemId, item_text_snapshot: itemText }
    const revert = () => setCheckins((prev) => wasChecked
      ? [...prev, entry]
      : prev.filter((c) => !(c.week_number === 0 && c.item_id === itemId && c.checkin_date === date)))
    setCheckins((prev) => wasChecked
      ? prev.filter((c) => !(c.week_number === 0 && c.item_id === itemId && c.checkin_date === date))
      : [...prev, entry])
    try {
      const r = await fetch(`/api/share/roadmap/${shareToken}/checkins`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_number: 0, item_id: itemId, item_text: itemText, date }),
      })
      if (!r.ok) revert()
    } catch { revert() }
  }

  const [metricsCache, setMetricsCache] = useState<Record<string, { water?: number; energy?: number; mood?: string }>>(data.dailyMetrics || {})
  const todayMetrics = metricsCache[checkinDate] || {}
  const [moodDraft, setMoodDraft] = useState(todayMetrics.mood || '')
  useEffect(() => { setMoodDraft(metricsCache[checkinDate]?.mood || '') }, [checkinDate, metricsCache])
  async function saveMetric(field: 'water' | 'energy' | 'mood', value: number | string) {
    setMetricsCache((prev) => ({ ...prev, [checkinDate]: { ...prev[checkinDate], [field]: value } }))
    try {
      await fetch(`/api/share/roadmap/${shareToken}/daily-metrics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: checkinDate, [field]: value }),
      })
    } catch { /* best-effort */ }
  }
  function adjustWater(delta: number) {
    saveMetric('water', Math.max(0, (metricsCache[checkinDate]?.water ?? 0) + delta))
  }
  function adjustEnergy(delta: number) {
    saveMetric('energy', Math.max(0, Math.min(10, (metricsCache[checkinDate]?.energy ?? 0) + delta)))
  }

  const lifestyleByPeriod = useMemo(() => splitIntoPeriods(data.dailyLifestyleGuidelines, LIFESTYLE_PERIODS), [data.dailyLifestyleGuidelines])
  const mealsByPeriod = useMemo(() => splitIntoPeriods(data.mealGuidelines, MEAL_PERIODS), [data.mealGuidelines])
  const dailyScheduleText = data.dailySchedule || ''

  // `date` is the specific day-tab's own real calendar date (see
  // dateForWeekDay above), not always today — each day tracks independently.
  async function toggleGoal(weekNumber: number, actionIndex: number, date: string) {
    const key = `${weekNumber}:${actionIndex}:${date}`
    const wasChecked = checkedSet.has(key)
    const revert = () => setCheckins((prev) => wasChecked
      ? [...prev, { week_number: weekNumber, action_index: actionIndex, checkin_date: date }]
      : prev.filter((c) => !(c.week_number === weekNumber && c.action_index === actionIndex && c.checkin_date === date)))
    setCheckins((prev) => wasChecked
      ? prev.filter((c) => !(c.week_number === weekNumber && c.action_index === actionIndex && c.checkin_date === date))
      : [...prev, { week_number: weekNumber, action_index: actionIndex, checkin_date: date }])
    try {
      const r = await fetch(`/api/share/roadmap/${shareToken}/checkins`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_number: weekNumber, action_index: actionIndex, date }),
      })
      if (!r.ok) revert()
    } catch {
      revert()
    }
  }

  const [openGroceryMonth, setOpenGroceryMonth] = useState<number | null>(null)
  const [openGroceryWeek, setOpenGroceryWeek] = useState<number | null>(null)
  const [aiGroceryCache, setAiGroceryCache] = useState<Record<number, GroceryCategory[]>>({})

  const [boughtItems, setBoughtItems] = useState<Set<string>>(new Set())
  const groceryStorageKey = `clp-grocery-${shareToken}`
  useEffect(() => {
    try {
      const raw = localStorage.getItem(groceryStorageKey)
      if (raw) setBoughtItems(new Set(JSON.parse(raw)))
    } catch { /* ignore */ }
  }, [groceryStorageKey])
  function toggleBought(key: string) {
    setBoughtItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem(groceryStorageKey, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  // The regex cleanup in groceryList.ts is instant but rule-based — an AI
  // pass catches what fixed rules can't (spelling variants, oddly-worded
  // duplicates, better categorization, and instruction text that leaked
  // into the ingredients field from two-column source PDFs). Fetched lazily
  // per week (only once, cached) so opening a week's list is never blocked
  // on it — the regex-based list shows immediately and this quietly
  // replaces it when ready, or stays as-is if the call fails.
  useEffect(() => {
    if (openGroceryWeek == null || data.groceryListOverride || aiGroceryCache[openGroceryWeek]) return
    const weekRecipes = getSlotRecipes(openGroceryWeek, DAY_MEAL_SLOTS, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank, 'Picked for your plan.').flatMap((s) => s.matches).map((mm) => mm.recipe)
    const candidateItems = buildGroceryList(weekRecipes).flatMap((cat) => cat.items.map((name) => ({ name, category: cat.head })))
    if (candidateItems.length === 0) return
    let cancelled = false
    fetch('/api/share/grocery-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: candidateItems }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j || !Array.isArray(j.categories) || j.categories.length === 0) return
        setAiGroceryCache((prev) => ({ ...prev, [openGroceryWeek]: j.categories }))
      })
      .catch(() => { /* keep the regex-based list on failure */ })
    return () => { cancelled = true }
  }, [openGroceryWeek, data.groceryListOverride, aiGroceryCache, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank])

  const [openService, setOpenService] = useState<number | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [founderOpen, setFounderOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)

  const superfoodPick = useMemo(() =>
    weekMealMatches.snack[0] || weekMealMatches.breakfast[0] || weekMealMatches.dinner[0] || weekMealMatches.lunch[0] || weekMealMatches.dessert[0] || null,
    [weekMealMatches])
  const superfoodImage = useMemo(() => {
    if (!superfoodPick) return null
    if (superfoodPick.recipe.image_url) return { id: superfoodPick.recipe.id, image_url: superfoodPick.recipe.image_url, label: superfoodPick.recipe.name, tags: superfoodPick.recipe.tags }
    return matchGuideImageDistinct(`${superfoodPick.recipe.name} ${superfoodPick.recipe.tags.join(' ')}`, data.imageBank, new Set())
  }, [data.imageBank, superfoodPick])

  // Downloads exactly what's rendered — every collapsible block in this
  // template is always mounted (just `display:none` when closed, never
  // conditionally unmounted) specifically so a DOM clone captures the whole
  // plan regardless of what happened to be open at download time, then a
  // shared vanilla-JS "offline brain" (src/lib/pdf/inlineExportScript.ts,
  // same one Almanac and Pulse use) makes month/week/recipe/grocery/goal
  // toggles work with zero network calls once opened as a local file.
  function downloadDashboard() {
    const root = document.getElementById('onyx-export-root')
    if (!root) return
    const clone = root.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[data-no-export]').forEach((el) => el.remove())
    clone.querySelectorAll('[data-hidden-section]').forEach((el) => el.remove())
    clone.querySelectorAll('[data-month-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleMonth('${el.getAttribute('data-month-trigger')}')`))
    clone.querySelectorAll('[data-week-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleWeek('${el.getAttribute('data-week-trigger')}')`))
    clone.querySelectorAll('[data-day-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleDay('${el.getAttribute('data-day-trigger')}', this)`))
    clone.querySelectorAll('[data-slot-trigger]').forEach((el) => el.setAttribute('onclick', `clpOpenSlot('${el.getAttribute('data-slot-trigger')}')`))
    clone.querySelectorAll('[data-slot-back]').forEach((el) => el.setAttribute('onclick', 'clpCloseSlot()'))
    clone.querySelectorAll('[data-recipe-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleRecipe('${el.getAttribute('data-recipe-trigger')}')`))
    clone.querySelectorAll('[data-grocery-month-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleGroceryMonth('${el.getAttribute('data-grocery-month-trigger')}')`))
    clone.querySelectorAll('[data-grocery-week-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleGroceryWeek('${el.getAttribute('data-grocery-week-trigger')}')`))
    clone.querySelectorAll('[data-meal-trigger]').forEach((el) => el.setAttribute('onclick', `clpSetMealTab('${el.getAttribute('data-meal-trigger')}')`))
    clone.querySelectorAll('[data-faq-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleFaq('${el.getAttribute('data-faq-trigger')}')`))
    clone.querySelectorAll('[data-care-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleCare('${el.getAttribute('data-care-trigger')}')`))
    clone.querySelectorAll('[data-toc-trigger]').forEach((el) => el.setAttribute('onclick', 'clpToggleToc()'))
    clone.querySelectorAll('[data-toc-link]').forEach((el) => el.setAttribute('onclick', 'clpCloseToc()'))
    clone.querySelectorAll('[data-toc-panel]').forEach((el) => ((el as HTMLElement).style.display = 'none'))
    clone.querySelectorAll('[data-founder-trigger]').forEach((el) => el.setAttribute('onclick', 'clpToggleFounder()'))
    clone.querySelectorAll('[data-founder-body]').forEach((el) => ((el as HTMLElement).style.display = 'none'))
    clone.querySelectorAll('[data-coach-trigger]').forEach((el) => el.setAttribute('onclick', 'clpToggleCoach()'))
    clone.querySelectorAll('[data-coach-body]').forEach((el) => ((el as HTMLElement).style.display = 'none'))
    clone.querySelectorAll('[data-goal-toggle]').forEach((el) => {
      const key = (el.getAttribute('data-goal-toggle') || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      el.setAttribute('onclick', `toggleGoalExport('${key}', this)`)
    })
    clone.querySelectorAll('[data-grocery-item]').forEach((el) => {
      const key = (el.getAttribute('data-grocery-item') || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      el.setAttribute('onclick', `toggleGroceryItemExport('${key}', this)`)
    })
    clone.querySelectorAll('[style*="position: sticky"]').forEach((el) => ((el as HTMLElement).style.position = 'static'))

    const monthsData = months.map((m) => ({ monthNumber: m.monthNumber, monthLabel: m.monthLabel, weeks: m.weeks.map((w) => ({ week_number: w.week_number, totalActions: w.days?.length ? w.days.reduce((n, d) => n + d.length, 0) : (w.actions?.length ?? 0) })) }))
    const script = buildInlineExportScript({
      shareToken, monthsData,
      colors: { ink: ONYX.ink, inkSoft: ONYX.inkSoft, muted: ONYX.muted, accent: ONYX.accent, accentSoft: ONYX.accentSoft, border: ONYX.border, onAccent: ONYX.onAccent },
    })
    const title = (data.patient?.full_name || 'Your') + "'s Plan, Living Plus"
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title.replace(/</g, '&lt;')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="${FONT_LINK}" rel="stylesheet">
<style>body{margin:0;background:${ONYX.bg};}</style>
</head>
<body>${clone.outerHTML}
<script>${script}</script>
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(data.patient?.full_name || 'client').replace(/\s+/g, '-')}-plan.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // No visible download button on the patient-facing page — a patient just
  // tracks live here. A coach can still pull an offline copy for themselves
  // from the patient's page in the app, which links here with ?download=1
  // to trigger this same download automatically, no button needed.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('download') === '1') {
      downloadDashboard()
      window.history.replaceState(null, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div id="onyx-export-root" style={{ background: ONYX.bg, minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: ONYX.ink, WebkitFontSmoothing: 'antialiased' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={FONT_LINK} rel="stylesheet" />
      <a href={`/roadmaps/${shareToken}/edit`} data-no-export style={{ display: 'none' }} />

      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(16,17,20,0.92)', backdropFilter: 'blur(6px)', borderBottom: `1px solid ${ONYX.border}` }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${ONYX.accent}`, color: ONYX.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontWeight: 600, fontSize: 11 }}>LP</div>
            <span style={{ fontSize: 12, fontWeight: 500, color: ONYX.inkSoft, letterSpacing: '0.03em' }}>CLINIC LIVING PLUS</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button data-toc-trigger onClick={() => setTocOpen((v) => !v)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 2, border: `1px solid ${ONYX.border}`, background: 'transparent', color: ONYX.inkSoft, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                Jump to section <ChevronDown size={12} style={{ transform: tocOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              <div data-toc-panel style={{ display: tocOpen ? 'grid' : 'none', position: 'absolute', top: '100%', right: 0, marginTop: 6, gridTemplateColumns: 'repeat(2, minmax(150px, 1fr))', gap: '2px 10px', background: ONYX.bg, border: `1px solid ${ONYX.border}`, borderRadius: 2, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: '70vh', overflowY: 'auto', zIndex: 31 }}>
                {TOC_ITEMS.filter((item) => !isHidden(item.id)).map((item) => (
                  <a key={item.id} data-toc-link href={`#${item.id}`} onClick={() => setTocOpen(false)}
                    style={{ fontSize: 12, fontWeight: 500, color: ONYX.muted, textDecoration: 'none', padding: '7px 9px', borderRadius: 2, whiteSpace: 'nowrap' }}>{item.label}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* Hero */}
        <Card style={{ padding: '2rem', border: '1px solid rgba(201,164,76,0.25)' }}>
          <Eyebrow>{greeting()}, {firstName}</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 500, color: ONYX.ink, marginBottom: 4 }}>Here is your plan</div>
          <div style={{ fontSize: 13, color: ONYX.muted, marginBottom: 24 }}>{data.goalLabel}</div>
          <SignatureBar pct={adherencePct} goalsDone={goalsDone} totalActionsInPlan={totalActionsInPlan} />
        </Card>

        {/* Daily Health Check-in — same feature as the Week-family templates,
            ported here read-only. */}
        <Card id="checkin" hidden={isHidden('checkin')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <SecTitle icon={<CheckCircle2 size={18} />}>Daily Health Check-in</SecTitle>
            <input type="date" value={checkinDate} onChange={(e) => setCheckinDate(e.target.value)}
              style={{ fontSize: 12.5, background: ONYX.bg, border: `1px solid ${ONYX.border}`, padding: '8px 11px', borderRadius: 4, color: ONYX.ink, fontWeight: 600 }} />
          </div>

          {checklistItems.length > 0 && (
            <p style={{ fontSize: 12.5, color: ONYX.accent, fontWeight: 600, margin: '8px 0 12px' }}>
              {checkinAllDone
                ? 'Everything checked off for today — nice work.'
                : checkinNoneDone
                ? 'Nothing logged yet today — tap an item below to check in.'
                : `${checkinDoneCount} of ${checklistItems.length} done so far today.`}
            </p>
          )}

          {checklistItems.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 12 }}>
              {checklistItems.map((item) => {
                const checked = checkedSet.has(`0:item:${item.id}:${checkinDate}`)
                return (
                  <div key={item.id} onClick={() => toggleChecklistItem(item.id, item.text, checkinDate)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', borderRadius: 4, cursor: 'pointer', border: `1px solid ${checked ? ONYX.accent : ONYX.border}`, background: checked ? ONYX.accentSoft : ONYX.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                      {checked
                        ? <CheckCircle2 size={17} color={ONYX.accent} style={{ flexShrink: 0 }} />
                        : <Circle size={17} style={{ flexShrink: 0, opacity: 0.4 }} />}
                      <span style={{ fontSize: 13, fontWeight: 500, color: checked ? ONYX.accent : ONYX.ink, textDecoration: checked ? 'line-through' : 'none' }}>{item.text}</span>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: checked ? ONYX.accent : ONYX.accentSoft, color: checked ? ONYX.onAccent : ONYX.accent, flexShrink: 0 }}>{checked ? 'Done' : 'Pending'}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: ONYX.muted, marginTop: 12 }}>Once your coach confirms your supplements or lifestyle guidelines, your daily checklist will show up here.</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 18 }}>
            <div style={{ background: ONYX.bg, border: `1px solid ${ONYX.border}`, borderRadius: 4, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: ONYX.accent, marginBottom: 8 }}><Droplet size={12} /> Water (glasses)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => adjustWater(-1)} style={{ width: 30, height: 30, borderRadius: 4, border: `1px solid ${ONYX.border}`, background: ONYX.accentSoft, color: ONYX.ink, fontWeight: 700, cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: 20, fontWeight: 700, color: ONYX.ink }}>{todayMetrics.water || 0}</span>
                <button onClick={() => adjustWater(1)} style={{ width: 30, height: 30, borderRadius: 4, border: `1px solid ${ONYX.border}`, background: ONYX.accentSoft, color: ONYX.ink, fontWeight: 700, cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ background: ONYX.bg, border: `1px solid ${ONYX.border}`, borderRadius: 4, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: ONYX.accent, marginBottom: 8 }}><Flame size={12} /> Energy (1-10)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => adjustEnergy(-1)} style={{ width: 30, height: 30, borderRadius: 4, border: `1px solid ${ONYX.border}`, background: ONYX.accentSoft, color: ONYX.ink, fontWeight: 700, cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: 20, fontWeight: 700, color: ONYX.ink }}>{todayMetrics.energy || 0}</span>
                <button onClick={() => adjustEnergy(1)} style={{ width: 30, height: 30, borderRadius: 4, border: `1px solid ${ONYX.border}`, background: ONYX.accentSoft, color: ONYX.ink, fontWeight: 700, cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ background: ONYX.bg, border: `1px solid ${ONYX.border}`, borderRadius: 4, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: ONYX.accent, marginBottom: 8 }}>Mood &amp; reflection</div>
              <input value={moodDraft} onChange={(e) => setMoodDraft(e.target.value)} onBlur={() => saveMetric('mood', moodDraft)}
                placeholder="e.g. Calm and focused today"
                style={{ width: '100%', background: ONYX.card, border: `1px solid ${ONYX.border}`, borderRadius: 4, padding: '7px 10px', fontSize: 12.5, color: ONYX.ink }} />
            </div>
          </div>
        </Card>

        {/* Founder's note — round photo, tap to reveal the note */}
        <Card id="founder" hidden={isHidden('founder')} style={{ textAlign: 'center' }}>
          <Eyebrow>A note from the founder</Eyebrow>
          <SecTitle icon={<HeartPulse size={18} />}>Founder&apos;s note</SecTitle>
          <button data-founder-trigger onClick={() => setFounderOpen((v) => !v)}
            style={{ width: 72, height: 72, borderRadius: '50%', background: ONYX.accent, color: ONYX.onAccent, border: 'none', cursor: 'pointer', fontFamily: SERIF, fontSize: 20, fontWeight: 500, margin: '16px auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            RS
          </button>
          <div style={{ fontFamily: SERIF, fontSize: '1.05rem', fontWeight: 500, color: ONYX.ink }}>Roshni Sanghvi</div>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', color: ONYX.muted, textTransform: 'uppercase', marginBottom: 8 }}>Founder, Living Plus</div>
          <div style={{ fontSize: '0.72rem', color: ONYX.muted }}>Tap the photo to read the note</div>
          <div data-founder-body style={{ display: founderOpen ? 'block' : 'none', textAlign: 'left', marginTop: 16, fontSize: '0.92rem', lineHeight: 1.7, color: ONYX.inkSoft }}>
            {data.founderNote.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </Card>

        {/* Coach — photo, name, and designation stay visible; a personal
            quote sits behind a tap on the photo, same as the founder's
            note above. */}
        {data.coach && (
          <Card id="coach" hidden={isHidden('coach')} style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <button data-coach-trigger onClick={() => data.coachQuote && setCoachOpen((v) => !v)}
              style={{ width: 54, height: 54, borderRadius: '50%', flexShrink: 0, background: data.coach.photo_url ? `url(${data.coach.photo_url}) center/cover` : ONYX.accentSoft, border: `1px solid ${ONYX.border}`, padding: 0, cursor: data.coachQuote ? 'pointer' : 'default' }} />
            <div>
              <Eyebrow>Your coach</Eyebrow>
              <div style={{ fontFamily: SERIF, fontSize: '1.2rem', fontWeight: 500, marginTop: -6, color: ONYX.ink }}>{data.coach.full_name}</div>
              <div style={{ fontSize: '0.8rem', color: ONYX.muted, marginTop: 2 }}>{data.coach.designation}</div>
              {data.coachQuote && (
                <>
                  <div style={{ fontSize: '0.7rem', color: ONYX.muted, marginTop: 6 }}>Tap the photo for a note from {coachFirst}</div>
                  <div data-coach-body style={{ display: coachOpen ? 'block' : 'none', marginTop: 6, fontStyle: 'italic', color: ONYX.accentDeep, fontSize: '0.88rem', maxWidth: 560 }}>&ldquo;{renderMarkdownBold(data.coachQuote)}&rdquo;</div>
                </>
              )}
            </div>
          </Card>
        )}

        {/* Care team */}
        {data.careTeam.length > 0 && (
          <Card id="careteam" hidden={isHidden('careteam')}>
            <Eyebrow>Beyond your coach</Eyebrow>
            <SecTitle icon={<HeartPulse size={18} />}>Your care team</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 16 }}>
              {data.careTeam.map((m, i) => (
                <div key={i} style={{ background: ONYX.bg, border: `1px solid ${ONYX.border}`, borderRadius: 2, padding: '14px 16px' }}>
                  <div style={{ fontFamily: SERIF, fontSize: '1.05rem', fontWeight: 500, color: ONYX.ink }}>{m.name}</div>
                  {m.role && <div style={{ fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: ONYX.muted, marginTop: 2 }}>{m.role}</div>}
                  {m.intro && <p style={{ fontSize: '0.86rem', lineHeight: 1.5, marginTop: 8, color: ONYX.inkSoft }}>{renderMarkdownBold(m.intro)}</p>}
                  {m.date && (
                    <div style={{ fontSize: '0.78rem', color: ONYX.accentDeep, fontWeight: 600, marginTop: 8 }}>
                      {new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {m.time && ` · ${new Date(`2000-01-01T${m.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* How to use this guide + Your why */}
        <Card id="howto" hidden={isHidden('howto')}>
          <Eyebrow>Getting oriented</Eyebrow>
          <SecTitle icon={<HelpCircle size={18} />}>How to use your plan</SecTitle>
          <p style={{ marginTop: 14, marginBottom: 18, fontSize: '0.92rem', fontWeight: 600, color: ONYX.accent }}>Follow → Track → Adjust</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: ONYX.border }}>
            {[
              { icon: MapPin, title: 'This week', text: 'Check your goals and meals for the week.' },
              { icon: CheckCircle2, title: 'Each day', text: 'Tick off what you complete.' },
              { icon: HelpCircle, title: 'Need help?', text: 'Message ' + coachFirst + ' if something doesn’t work for you.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: ONYX.card, padding: '14px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 2, background: ONYX.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={ONYX.accent} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 4, color: ONYX.ink }}>{title}</div>
                  <div style={{ fontSize: '0.82rem', color: ONYX.muted, lineHeight: 1.55 }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${ONYX.border}` }}>
            <Eyebrow>Your why</Eyebrow>
            {data.whyReflection ? (
              <p style={{ fontSize: '0.92rem', lineHeight: 1.65, color: ONYX.inkSoft }}>{renderMarkdownBold(data.whyReflection)}</p>
            ) : (
              <p style={{ fontSize: '0.88rem', color: ONYX.muted }}>Not filled in yet.</p>
            )}
          </div>
        </Card>

        {LIFESTYLE_PERIODS.some((label) => parseBullets(lifestyleByPeriod[label] || '').length > 0) && (
          <Card id="lifestyle" hidden={isHidden('lifestyle')}>
            <SecTitle icon={<Sun size={18} />}>Daily Lifestyle Guidelines</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 16 }}>
              {LIFESTYLE_PERIODS.map((label) => {
                const items = parseBullets(lifestyleByPeriod[label] || '')
                if (items.length === 0) return null
                return (
                  <div key={label} style={{ background: ONYX.bg, border: `1px solid ${ONYX.border}`, borderRadius: 4, padding: '15px 17px' }}>
                    <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.accent, fontWeight: 600 }}>{label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <Circle size={11} color={ONYX.accent} style={{ flexShrink: 0, marginTop: 4, opacity: 0.6 }} />
                          <span style={{ fontSize: 13, lineHeight: 1.5, color: ONYX.inkSoft }}>{renderMarkdownBold(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {MEAL_PERIODS.some((label) => parseBullets(mealsByPeriod[label] || '').length > 0) && (
          <Card id="meals" hidden={isHidden('meals')}>
            <SecTitle icon={<Utensils size={18} />}>Breakfast, Lunch &amp; Dinner</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 16 }}>
              {MEAL_PERIODS.map((label) => {
                const items = parseBullets(mealsByPeriod[label] || '')
                if (items.length === 0) return null
                return (
                  <div key={label} style={{ background: ONYX.bg, border: `1px solid ${ONYX.border}`, borderRadius: 4, padding: '15px 17px' }}>
                    <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.accent, fontWeight: 600 }}>{label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <Circle size={11} color={ONYX.accent} style={{ flexShrink: 0, marginTop: 4, opacity: 0.6 }} />
                          <span style={{ fontSize: 13, lineHeight: 1.5, color: ONYX.inkSoft }}>{renderMarkdownBold(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {dailyScheduleText.trim() && (
          <Card id="schedule" hidden={isHidden('schedule')}>
            <SecTitle icon={<CalendarCheck size={18} />}>Daily Schedule</SecTitle>
            <div style={{ position: 'relative', paddingLeft: 34, marginTop: 18 }}>
              <div style={{ position: 'absolute', left: 13, top: 6, bottom: 6, width: 1, background: ONYX.border }} />
              {parseScheduleLines(dailyScheduleText).map((item, i, arr) => (
                <div key={i} style={{ position: 'relative', marginBottom: i < arr.length - 1 ? 20 : 0 }}>
                  <span style={{ position: 'absolute', left: -34, top: 0, width: 26, height: 26, borderRadius: '50%', background: ONYX.accentSoft, border: `2px solid ${ONYX.card}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Circle size={9} color={ONYX.accent} />
                  </span>
                  {item.time && <div style={{ fontSize: 11.5, fontWeight: 700, color: ONYX.accent }}>{item.time}</div>}
                  <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 2, color: ONYX.inkSoft }}>{item.text}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Your roadmap */}
        {months.length > 0 && (
          <Card id="roadmap" hidden={isHidden('roadmap')}>
            <Eyebrow>Month by month</Eyebrow>
            <SecTitle icon={<MapPin size={18} />}>Your roadmap</SecTitle>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
              {months.map((m) => (
                <button key={m.monthNumber} data-month-trigger={m.monthNumber} onClick={() => { const next = openMonth === m.monthNumber ? null : m.monthNumber; setOpenMonth(next); setOpenWeek(null); setOpenDay(null); setOpenSlot(null); setOpenRecipeId(null) }}
                  style={{
                    padding: '7px 15px', borderRadius: 2, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                    border: `1px solid ${openMonth === m.monthNumber ? ONYX.accent : ONYX.border}`,
                    background: openMonth === m.monthNumber ? ONYX.accent : 'transparent', color: openMonth === m.monthNumber ? ONYX.onAccent : ONYX.inkSoft,
                  }}>
                  {m.monthLabel}
                </button>
              ))}
            </div>

            {months.map((m) => (
              <div key={m.monthNumber} data-month-body={m.monthNumber} style={{ marginTop: 22, display: openMonth === m.monthNumber ? 'block' : 'none' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                  {m.weeks.map((w) => (
                    <button key={w.week_number} data-week-trigger={w.week_number} onClick={() => { const next = openWeek === w.week_number ? null : w.week_number; setOpenWeek(next); setOpenDay(null); setOpenSlot(null); setOpenRecipeId(null) }}
                      style={{
                        textAlign: 'left', padding: '11px 15px', borderRadius: 2, cursor: 'pointer', minWidth: 150,
                        border: `1px solid ${openWeek === w.week_number ? ONYX.accent : ONYX.border}`,
                        background: openWeek === w.week_number ? ONYX.accentSoft : ONYX.bg,
                      }}>
                      <div style={{ color: ONYX.accentDeep, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em' }}>WEEK {w.week_number}</div>
                      <div style={{ color: ONYX.inkSoft, fontSize: '0.83rem', marginTop: 3 }}>{w.focus_theme}</div>
                    </button>
                  ))}
                </div>

                {m.weeks.map((w) => (
                  <div key={w.week_number} data-week-body={w.week_number} style={{ display: openWeek === w.week_number ? 'block' : 'none', borderTop: `1px solid ${ONYX.border}`, paddingTop: 20 }}>
                    {(w.actions?.length ?? 0) > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.accent }}>Sunday to Saturday, this week&apos;s goals</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                          {DAY_LABELS.map((day, dayIndex) => {
                            const dayId = `${w.week_number}-${day}`
                            const isDayOpen = openDay === dayId
                            const dayDate = dateForWeekDay(data.createdAt, w.week_number, dayIndex)
                            return (
                              <div key={day} style={{ border: `1px solid ${ONYX.border}`, borderRadius: 2, overflow: 'hidden' }}>
                                <button data-day-trigger={dayId} onClick={() => setOpenDay(isDayOpen ? null : dayId)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                  <span style={{ fontSize: '0.83rem', fontWeight: 600, color: ONYX.ink }}>{day}</span>
                                  {isDayOpen ? <ChevronDown size={15} color={ONYX.accent} /> : <ChevronRight size={15} color={ONYX.muted} />}
                                </button>
                                <div data-day-body={dayId} style={{ display: isDayOpen ? 'block' : 'none', padding: '0 14px 14px' }}>
                                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {(w.days?.[dayIndex] ?? w.actions ?? []).map((action, ai) => {
                                      const checked = checkedSet.has(`${w.week_number}:${ai}:${dayDate}`)
                                      return (
                                        <li key={ai} data-goal-toggle={`${w.week_number}:${ai}:${dayDate}`} onClick={() => toggleGoal(w.week_number, ai, dayDate)}
                                          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 8, padding: '2px 0' }}>
                                          <span data-goal-icon-done style={{ display: checked ? 'inline-flex' : 'none', flexShrink: 0, marginTop: 2 }}><CheckCircle2 size={15} color={ONYX.accent} /></span>
                                          <span data-goal-icon-undone style={{ display: checked ? 'none' : 'inline-flex', flexShrink: 0, marginTop: 2 }}><Circle size={15} color={ONYX.muted} /></span>
                                          <span data-goal-text style={{ color: checked ? ONYX.muted : ONYX.inkSoft, fontSize: '0.9rem', lineHeight: 1.6, textDecoration: checked ? 'line-through' : 'none' }}>{action}</span>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const weekSlotRecipes = getSlotRecipes(w.week_number, DAY_MEAL_SLOTS, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank, 'Picked for your plan.')
                      return (
                        <div>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.accent }}>Recipes for the week</span>
                          <div data-slot-list style={{ display: openSlot == null ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 10 }}>
                            {weekSlotRecipes.map(({ slot, matches }) => {
                              const slotId = `${w.week_number}-${slot}`
                              return (
                                <button key={slot} data-slot-trigger={slotId} onClick={() => setOpenSlot(slotId)}
                                  style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 2, cursor: 'pointer', border: `1px solid ${ONYX.border}`, background: ONYX.bg }}>
                                  <div style={{ fontSize: '0.83rem', fontWeight: 600, color: ONYX.ink }}>{SLOT_LABELS[slot]}</div>
                                  <div style={{ fontSize: '0.75rem', color: matches.length ? ONYX.accent : ONYX.muted, marginTop: 4, fontWeight: 600 }}>
                                    {matches.length ? `${matches.length} recipe${matches.length === 1 ? '' : 's'}` : `Not detected yet, ${coachFirst} will add some.`}
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                          {weekSlotRecipes.map(({ slot, matches }) => {
                            const slotId = `${w.week_number}-${slot}`
                            return (
                            <div key={slot} data-slot-body={slotId} style={{ display: openSlot === slotId ? 'block' : 'none', marginTop: 14 }}>
                              <button data-slot-back onClick={() => setOpenSlot(null)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: ONYX.accent, fontSize: '0.78rem', fontWeight: 700, padding: 0, marginBottom: 12 }}>
                                ← Back to meal slots
                              </button>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: ONYX.ink, marginBottom: 10 }}>{SLOT_LABELS[slot]}, picked for your plan</div>
                              {matches.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                                  {matches.map(({ recipe }) => {
                                    const recipeKey = `${w.week_number}-${slot}-${recipe.id}`
                                    return (
                                    <button key={recipeKey} data-recipe-trigger={recipeKey} onClick={() => setOpenRecipeId(openRecipeId === recipeKey ? null : recipeKey)}
                                      style={{ textAlign: 'left', padding: 0, cursor: 'pointer', background: openRecipeId === recipeKey ? ONYX.accentSoft : ONYX.bg, border: `1px solid ${openRecipeId === recipeKey ? ONYX.accent : ONYX.border}`, borderRadius: 2, overflow: 'hidden' }}>
                                      {recipe.image_url ? (
                                        <img src={recipe.image_url} alt={recipe.name} style={{ width: '100%', height: 96, objectFit: 'cover', display: 'block' }} />
                                      ) : (
                                        <div style={{ width: '100%', height: 96, background: ONYX.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <ChefHat size={20} color={ONYX.accent} />
                                        </div>
                                      )}
                                      <div style={{ padding: '9px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                        <span style={{ color: ONYX.ink, fontSize: '0.83rem', fontWeight: 600 }}>{recipe.name}</span>
                                        {openRecipeId === recipeKey ? <ChevronDown size={14} color={ONYX.accent} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} color={ONYX.muted} style={{ flexShrink: 0 }} />}
                                      </div>
                                    </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.83rem', color: ONYX.muted }}>Nothing detected for {SLOT_LABELS[slot].toLowerCase()} yet, {coachFirst} will add some.</div>
                              )}

                              {matches.map(({ recipe }) => {
                                const recipeKey = `${w.week_number}-${slot}-${recipe.id}`
                                return (
                                <div key={recipeKey} data-recipe-body={recipeKey} style={{ display: openRecipeId === recipeKey ? 'block' : 'none', marginTop: 14, background: ONYX.bg, border: `1px solid ${ONYX.accent}`, borderRadius: 2, padding: '1.5rem', position: 'relative' }}>
                                  <button onClick={() => setOpenRecipeId(null)} data-no-export style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: ONYX.muted }}><X size={18} /></button>
                                  <div style={{ display: 'grid', gridTemplateColumns: recipe.image_url ? '1fr 1.3fr' : '1fr', gap: 22 }}>
                                    {recipe.image_url && <img src={recipe.image_url} alt={recipe.name} style={{ width: '100%', borderRadius: 2, objectFit: 'cover', maxHeight: 300 }} />}
                                    <div>
                                      {recipe.protein_label && <Eyebrow>{recipe.protein_label}</Eyebrow>}
                                      <h3 style={{ fontFamily: SERIF, fontSize: '1.3rem', fontWeight: 500, color: ONYX.ink, margin: '0 0 14px' }}>{recipe.name}</h3>
                                      <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.accent }}>Ingredients</span>
                                      <ul style={{ listStyle: 'none', margin: '8px 0 14px', padding: 0 }}>
                                        {splitRecipeLines(recipe.ingredients).map((line, i) => (
                                          <li key={i} style={{ color: ONYX.inkSoft, fontSize: '0.86rem', lineHeight: 1.6, marginBottom: 4 }}>{line}</li>
                                        ))}
                                      </ul>
                                      <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.accent }}>Directions</span>
                                      <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                                        {splitRecipeLines(recipe.steps).map((line, i) => (
                                          <li key={i} style={{ color: ONYX.inkSoft, fontSize: '0.86rem', lineHeight: 1.65, marginBottom: 6 }}>{line}</li>
                                        ))}
                                      </ol>
                                      {recipe.benefits && recipe.benefits.length > 0 && (
                                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${ONYX.border}` }}>
                                          <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.accent }}>Why it works</span>
                                          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                                            {recipe.benefits.map((b, i) => <li key={i} style={{ color: ONYX.inkSoft, fontSize: '0.84rem', lineHeight: 1.55, marginBottom: 4 }}>{b}</li>)}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                )
                              })}
                            </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            ))}
          </Card>
        )}

        {/* Power points — coach-pasted links each with a short note */}
        {data.powerPoints.filter((pp) => pp.url).length > 0 && (
          <Card id="nutrition" hidden={isHidden('nutrition')}>
            <Eyebrow>Worth a look</Eyebrow>
            <SecTitle icon={<LinkIcon size={18} />}>Your power points</SecTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {data.powerPoints.filter((pp) => pp.url).map((pp, i) => (
                <a key={i} href={pp.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, textDecoration: 'none', padding: '12px 14px', borderRadius: 2, border: `1px solid ${ONYX.border}` }}>
                  <div style={{ width: 34, height: 34, borderRadius: 2, background: ONYX.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LinkIcon size={16} color={ONYX.accent} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {pp.note && <div style={{ fontSize: '0.88rem', color: ONYX.inkSoft, lineHeight: 1.5, marginBottom: 3 }}>{renderMarkdownBold(pp.note)}</div>}
                    <div style={{ fontSize: '0.78rem', color: ONYX.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pp.url}</div>
                  </div>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Shopping list */}
        <Card id="grocery" hidden={isHidden('grocery')}>
          <Eyebrow>What to buy</Eyebrow>
          <SecTitle icon={<ShoppingCart size={18} />}>Your shopping list</SecTitle>
          <p style={{ fontSize: '0.87rem', color: ONYX.muted, marginTop: 14, marginBottom: 18 }}>Pulled straight from the ingredients of your matched recipes. Pick a week below to see it.</p>
          {months.length === 0 ? (
            <p style={{ fontSize: '0.87rem', color: ONYX.muted }}>Not planned yet, check back once your coach generates your roadmap.</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {months.map((m) => (
                  <button key={m.monthNumber} data-grocery-month-trigger={m.monthNumber} onClick={() => { const next = openGroceryMonth === m.monthNumber ? null : m.monthNumber; setOpenGroceryMonth(next); setOpenGroceryWeek(null) }}
                    style={{
                      padding: '7px 15px', borderRadius: 2, cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase',
                      border: `1px solid ${openGroceryMonth === m.monthNumber ? ONYX.accent : ONYX.border}`,
                      background: openGroceryMonth === m.monthNumber ? ONYX.accent : 'transparent', color: openGroceryMonth === m.monthNumber ? ONYX.onAccent : ONYX.inkSoft,
                    }}>
                    {m.monthLabel}
                  </button>
                ))}
              </div>
              {months.map((m) => (
                <div key={m.monthNumber} data-grocery-month-body={m.monthNumber} style={{ marginTop: 18, display: openGroceryMonth === m.monthNumber ? 'block' : 'none' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                    {m.weeks.map((w) => (
                      <button key={w.week_number} data-grocery-week-trigger={w.week_number} onClick={() => setOpenGroceryWeek(openGroceryWeek === w.week_number ? null : w.week_number)}
                        style={{
                          padding: '7px 13px', borderRadius: 2, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                          border: `1px solid ${openGroceryWeek === w.week_number ? ONYX.accent : ONYX.border}`,
                          background: openGroceryWeek === w.week_number ? ONYX.accentSoft : 'transparent', color: ONYX.inkSoft,
                        }}>
                        Week {w.week_number}
                      </button>
                    ))}
                  </div>
                  {m.weeks.map((w) => {
                    const weekRecipes = getSlotRecipes(w.week_number, DAY_MEAL_SLOTS, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank, 'Picked for your plan.').flatMap((s) => s.matches).map((mm) => mm.recipe)
                    const cats = aiGroceryCache[w.week_number] ?? buildGroceryList(weekRecipes)
                    // A coach-edited list (guide_overrides.grocery_list_override)
                    // wins over the computed one.
                    const finalCats = data.groceryListOverride ?? (cats.length > 0 ? cats : GROCERY_CATEGORIES)
                    return (
                      <div key={w.week_number} data-grocery-week-body={w.week_number} style={{ display: openGroceryWeek === w.week_number ? 'grid' : 'none', borderTop: `1px solid ${ONYX.border}`, paddingTop: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18 }}>
                        {finalCats.map((cat) => (
                          <div key={cat.head}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.accentDeep }}>{cat.head}</span>
                            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                              {cat.items.map((item) => {
                                const itemKey = `${w.week_number}:${cat.head}:${item}`
                                const bought = boughtItems.has(itemKey)
                                return (
                                  <li key={item} data-grocery-item={itemKey} onClick={() => toggleBought(itemKey)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.81rem', color: bought ? ONYX.muted : ONYX.inkSoft, padding: '3px 0', cursor: 'pointer' }}>
                                    <span data-grocery-icon-done style={{ display: bought ? 'inline-flex' : 'none', flexShrink: 0 }}><CheckCircle2 size={13} color={ONYX.accent} /></span>
                                    <span data-grocery-icon-undone style={{ display: bought ? 'none' : 'inline-flex', flexShrink: 0 }}><Circle size={13} color={ONYX.muted} /></span>
                                    <span data-grocery-item-text style={{ textDecoration: bought ? 'line-through' : 'none' }}>{item}</span>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </Card>

        {/* Supplements */}
        {data.confirmedSupplements.length > 0 && (
          <Card id="supplements" hidden={isHidden('supplements')}>
            <Eyebrow>Confirmed by {coachFirst}</Eyebrow>
            <SecTitle icon={<Pill size={18} />}>Your supplement plan</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginTop: 16 }}>
              {data.confirmedSupplements.map((s, i) => (
                <div key={i} style={{ background: ONYX.bg, border: `1px solid ${ONYX.border}`, borderRadius: 2, padding: '12px 14px' }}>
                  <div style={{ color: ONYX.ink, fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</div>
                  <div style={{ color: ONYX.inkSoft, fontSize: '0.82rem', marginTop: 4 }}>{[s.dose, s.timing, s.duration].filter(Boolean).join(' · ')}</div>
                  {s.notes && <div style={{ color: ONYX.warn, fontSize: '0.78rem', marginTop: 6 }}>⚠ {s.notes}</div>}
                </div>
              ))}
            </div>
            <div style={{ color: ONYX.muted, fontSize: '0.76rem', marginTop: 14 }}>Don&apos;t start, stop, or change a dose without confirming with {coachFirst} first.</div>
          </Card>
        )}

        {/* What's included in your care */}
        {data.careServices.length > 0 && (
          <Card id="services" hidden={isHidden('services')}>
            <Eyebrow>Your plan</Eyebrow>
            <SecTitle icon={<Star size={18} />}>What&apos;s included in your care</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10, marginTop: 16 }}>
              {data.careServices.map((svc, i) => {
                const Icon = CARE_ICON_MAP[svc.icon] || Star
                const isOpen = openService === i
                return (
                  <button key={i} data-care-trigger={i} onClick={() => setOpenService(isOpen ? null : i)}
                    style={{ textAlign: 'left', padding: '13px 12px', borderRadius: 2, cursor: 'pointer', border: `1px solid ${isOpen ? ONYX.accent : ONYX.border}`, background: isOpen ? ONYX.accentSoft : ONYX.bg }}>
                    <div style={{ width: 28, height: 28, borderRadius: 2, background: ONYX.card, border: `1px solid ${ONYX.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9 }}>
                      <Icon size={14} color={ONYX.accent} />
                    </div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 600, color: ONYX.ink }}>{svc.name}</div>
                    {svc.sessions && <div style={{ fontSize: '0.73rem', color: ONYX.muted, marginTop: 2 }}>{svc.sessions}</div>}
                  </button>
                )
              })}
            </div>
            {data.careServices.map((svc, i) => svc.description && (
              <div key={i} data-care-body={i} style={{ display: openService === i ? 'block' : 'none', marginTop: 14, padding: '14px 16px', borderRadius: 2, border: `1px solid ${ONYX.border}`, background: ONYX.bg }}>
                <div style={{ fontWeight: 600, fontSize: '0.87rem', marginBottom: 6, color: ONYX.ink }}>{svc.name}</div>
                <p style={{ fontSize: '0.85rem', lineHeight: 1.55, margin: 0, color: ONYX.inkSoft }}>{renderMarkdownBold(svc.description || '')}</p>
              </div>
            ))}
          </Card>
        )}

        {/* Track your progress */}
        <Card id="track" hidden={isHidden('track')}>
          <Eyebrow>Real numbers, not a guess</Eyebrow>
          <SecTitle icon={<CheckCircle2 size={18} />}>Track your progress</SecTitle>
          <p data-track-empty style={{ fontSize: '0.87rem', color: ONYX.muted, marginTop: 14, display: progress.totalDaysLogged === 0 ? 'block' : 'none' }}>No check-ins logged yet, tap a goal in your roadmap above each day you complete it, and your progress will show up here.</p>
          <div data-track-content style={{ display: progress.totalDaysLogged === 0 ? 'none' : 'block' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 1, background: ONYX.border, marginTop: 18, marginBottom: 22 }}>
              {[
                { key: 'streak', icon: <Flame size={13} />, value: progress.streak, label: 'day streak' },
                { key: 'days', icon: <CalendarCheck size={13} />, value: progress.totalDaysLogged, label: 'days logged, total' },
                { key: 'goals', icon: <Target size={13} />, value: `${goalsDone}/${totalActionsInPlan}`, label: 'goals accomplished' },
                { key: 'best', icon: <TrendingUp size={13} />, value: progress.bestMonth ? `${progress.bestMonth.pct}%` : '0%', label: progress.bestMonth ? `best month · ${progress.bestMonth.monthLabel}` : 'best month' },
              ].map((s) => (
                <div key={s.key} style={{ padding: '12px 14px', background: ONYX.card }}>
                  <span style={{ color: ONYX.accent }}>{s.icon}</span>
                  <div data-stat={s.key} style={{ fontFamily: SERIF, fontSize: '1.4rem', fontWeight: 500, marginTop: 8, color: ONYX.ink }}>{s.value}</div>
                  <div data-stat-label={s.key} style={{ fontSize: '0.7rem', color: ONYX.muted, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: ONYX.muted }}>Goals completed by month</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
              {progress.monthStats.map((m) => (
                <div key={m.monthNumber} style={{ textAlign: 'center' }}>
                  <div data-stat-pct={m.monthNumber} style={{ fontFamily: SERIF, fontSize: '1.5rem', fontWeight: 500, color: m.pct >= 70 ? ONYX.accent : ONYX.ink }}>{m.pct}%</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: 2, color: ONYX.inkSoft }}>{m.monthLabel}</div>
                  <div data-stat-sub={m.monthNumber} style={{ fontSize: '0.68rem', color: ONYX.muted }}>{m.doneActions}/{m.totalActions} goals</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* When to reach us */}
        <Card id="reach" hidden={isHidden('reach')}>
          <Eyebrow>Reach us</Eyebrow>
          <SecTitle icon={<Phone size={18} />}>When to reach us</SecTitle>
          {data.nextAppointment.date ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: ONYX.accentDeep, fontSize: '0.82rem', fontWeight: 600, marginBottom: 12, background: ONYX.accentSoft, padding: '6px 12px', borderRadius: 2, border: `1px solid ${ONYX.border}` }}>
                <CalendarCheck size={14} />
                {new Date(data.nextAppointment.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {data.nextAppointment.time && ` · ${new Date(`2000-01-01T${data.nextAppointment.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
                {data.nextAppointment.mode && ` · ${data.nextAppointment.mode}`}
              </div>
              <p style={{ color: ONYX.inkSoft, fontSize: '0.89rem', lineHeight: 1.6, marginBottom: 6 }}>Contact your care team if you:</p>
              <ul style={{ margin: '0 0 10px', paddingLeft: 20, color: ONYX.inkSoft, fontSize: '0.89rem', lineHeight: 1.6 }}>
                <li>Have questions about your plan</li>
                <li>Are struggling to follow a recommendation</li>
                <li>Notice an unexpected change in how you feel</li>
              </ul>
              <p style={{ color: ONYX.inkSoft, fontSize: '0.89rem', lineHeight: 1.6 }}><strong>Emergency?</strong> Seek immediate medical care.</p>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: ONYX.inkSoft, fontSize: '0.89rem', lineHeight: 1.6, marginBottom: 6 }}>Contact your care team if you:</p>
              <ul style={{ margin: '0 0 10px', paddingLeft: 20, color: ONYX.inkSoft, fontSize: '0.89rem', lineHeight: 1.6 }}>
                <li>Have questions about your plan</li>
                <li>Are struggling to follow a recommendation</li>
                <li>Notice an unexpected change in how you feel</li>
              </ul>
              <p style={{ color: ONYX.inkSoft, fontSize: '0.89rem', lineHeight: 1.6 }}><strong>Emergency?</strong> Seek immediate medical care.</p>
            </div>
          )}
          {data.coach?.email && (
            <p style={{ color: ONYX.accentDeep, fontSize: '0.83rem', marginTop: 12, fontWeight: 500 }}>Message {coachFirst} directly at {data.coach.email}.</p>
          )}
        </Card>

        {/* FAQ */}
        <Card id="faq" hidden={isHidden('faq')} style={{ marginBottom: 0 }}>
          <Eyebrow>Questions we hear most</Eyebrow>
          <SecTitle icon={<HelpCircle size={18} />}>FAQ</SecTitle>
          <div style={{ marginTop: 16 }}>
            {[
              ['What if I can’t finish everything on my plate exactly as shown?', 'Getting the food groups roughly right matters far more than hitting exact portions.'],
              ['What if I miss a few days on my habit tracker?', 'Log what actually happened, not what you wish had happened. An honest gap tells your coach more than a perfect-looking week.'],
              ['Can I eat something that’s not on the lists?', 'Yes, the lists are what to lean on, not a ban on everything else. Ask your coach if unsure.'],
            ].map(([q, a], i) => {
              const isOpen = openFaq === i
              return (
                <div key={i} style={{ borderBottom: i < 2 ? `1px solid ${ONYX.border}` : 'none' }}>
                  <button data-faq-trigger={i} onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ color: ONYX.ink, fontWeight: 500, fontSize: '0.92rem' }}>{q}</span>
                    {isOpen ? <ChevronDown size={16} color={ONYX.accent} style={{ flexShrink: 0 }} /> : <ChevronRight size={16} color={ONYX.muted} style={{ flexShrink: 0 }} />}
                  </button>
                  <div data-faq-body={i} style={{ display: isOpen ? 'block' : 'none', color: ONYX.inkSoft, fontSize: '0.86rem', paddingBottom: 15 }}>{a}</div>
                </div>
              )
            })}
          </div>
        </Card>

        <div style={{ color: ONYX.muted, fontSize: '0.72rem', marginTop: 24, textAlign: 'center', letterSpacing: '0.04em' }}>CLINIC LIVING PLUS PVT LTD™</div>
        <CanvasBlocksSection blocks={data.canvasBlocks} recipesById={Object.fromEntries(data.recipeBank.map((r) => [r.id, r]))} imagesById={Object.fromEntries(data.imageBank.map((im) => [im.id, im]))} theme={toBlockTheme(ONYX)} />
      </div>
    </div>
  )
}
