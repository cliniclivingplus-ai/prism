'use client'

// A sixth, read-only patient-facing presentation of the exact same GuideData
// every other template uses — same real data, a chart/icon-forward visual
// language instead of paragraph-first: stat cards, progress rings, and a
// "functional medicine wheel" (a radial diagram of months/weeks colored by
// real tracked completion) replace long written sections wherever the
// underlying data is actually numeric. Founder's note, coach's note, and
// "your why" stay real, unedited coach/patient text — never shortened or
// rewritten — just shown as a large photo-forward pull-quote instead of a
// paragraph block. A coach always edits content in the Classic editor
// regardless of which template is picked; this component never runs in
// editable mode.
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { FOUNDER_PHOTO_URL, FOUNDER_INTRO } from '@/lib/founderInfo'
import {
  HeartPulse, Utensils, Pill, Phone, Clock, CalendarCheck, HelpCircle, ChefHat, MapPin, ChevronDown, ChevronRight, X, Download,
  CheckCircle2, Circle, Sparkles, Star, ShoppingCart, Video, MessageCircle, Activity, Stethoscope, Users, Target, TrendingUp,
  Moon, Droplet, Brain, Sun, Footprints, Smartphone, Link as LinkIcon, Flame, Award, Eye, EyeOff,
  type LucideIcon, AlertTriangle, Plus,
} from 'lucide-react'
import type { GuideData, DayMealSlot } from '@/lib/pdf/ClientGuideDocument'
import { parseNutritionistGuidelines } from '@/lib/pdf/parseNutritionistGuidelines'
import { selectRecipesForPatient, type BankRecipe } from '@/lib/pdf/matchRecipes'
import { reshapeRoadmapIntoMonths, type WeeklyPlan } from '@/lib/pdf/reshapeRoadmap'
import { getSlotRecipes } from '@/lib/pdf/weekRecipes'
import { renderMarkdownBold, splitTextAndImagesIndexed } from '@/lib/renderMarkdownBold'
import ImageInsertButton from '@/components/ImageInsertButton'
import ImagePreviewStrip from '@/components/ImagePreviewStrip'
import { splitRecipeLines } from '@/lib/recipeText'
import { RecipeIngredientsRenderer, RecipeDirectionsRenderer } from '@/components/RecipeContentRenderer'
import { GROCERY_CATEGORIES } from '@/lib/foodPlates'
import { buildGroceryList, type GroceryCategory } from '@/lib/groceryList'
import { matchGuideImageDistinct } from '@/lib/pdf/matchGuideImage'
import { buildInlineExportScript } from '@/lib/pdf/inlineExportScript'
import { Ring as PrimRing, Wheel, Card as PrimCard, PullQuote, DEFAULT_WHEEL_COLORS as WHEEL_COLORS } from '@/lib/blocks/primitives'
import { CanvasBlocksSection } from './CanvasBlocksSection'
import { toBlockTheme } from '@/lib/blocks/BlockRenderer'
import { PALETTES } from './palettes'
import { splitIntoPeriods, parseScheduleLines, joinPeriods } from '@/lib/periodBullets'
import { type ChecklistItem } from '@/lib/dailyChecklist'
import InlineEditableText from '@/components/InlineEditableText'
import AiBulkRecipeEditButton from '@/components/AiBulkRecipeEditButton'
import CombineRecipesButton from '@/components/CombineRecipesButton'
import { CareServiceLinkButton, isVisibleCareService } from '@/components/CareServiceLink'

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
function weekSundayISO(createdAtISO: string): string {
  const dateOnly = createdAtISO.slice(0, 10)
  const d = new Date(`${dateOnly}T00:00:00Z`)
  return shiftDateISO(dateOnly, -d.getUTCDay())
}
function dateForWeekDay(createdAtISO: string, weekNumber: number, dayIndex: number): string {
  return shiftDateISO(weekSundayISO(createdAtISO), (weekNumber - 1) * 7 + dayIndex)
}

type Checkin = { week_number: number; action_index: number | null; checkin_date: string; item_id?: string | null; item_text_snapshot?: string | null }

function parseBullets(text: string): string[] {
  return (text || '')
    .split(/\n|(?=•)/)
    .map((s) => s.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean)
}

// Same keyword -> icon/topic-label mapping used elsewhere in the app —
// purely decorative categorization, never changes what a guideline says.
// Here the matched topic word becomes the big, scannable label; the coach's
// real sentence stays underneath in full, just visually secondary.
const LIFESTYLE_RULES: [RegExp, LucideIcon, string][] = [
  [/\b(sleep|bedtime|wind[- ]down|rest)\b/i, Moon, 'Sleep'],
  [/\b(water|hydrat|fluid)\b/i, Droplet, 'Hydration'],
  [/\b(walk|step|exercise|movement|activity|stretch|workout)\b/i, Footprints, 'Movement'],
  [/\b(stress|cortisol|relax|breath|meditat|mindful|anxiety)\b/i, Brain, 'Stress'],
  [/\b(meal|eat|food|breakfast|lunch|dinner|snack|diet|protein|fiber|sugar)\b/i, Utensils, 'Nutrition'],
  [/\b(screen|phone|device|scroll)\b/i, Smartphone, 'Screen time'],
  [/\b(sun|morning|light|wake)\b/i, Sun, 'Morning routine'],
]
function topicForBullet(text: string): { Icon: LucideIcon; topic: string } {
  for (const [pattern, Icon, topic] of LIFESTYLE_RULES) if (pattern.test(text)) return { Icon, topic }
  return { Icon: HeartPulse, topic: 'Wellbeing' }
}

// Supplement timing text is free-form coach input ("with meals", "1-0-1",
// "before bed") — this only sorts a supplement into a time-of-day bucket for
// the visual timeline; it never changes or hides the real timing text, which
// always stays visible on the card itself.
const TIME_BUCKETS: [RegExp, string][] = [
  [/\b(morning|wake|breakfast|am\b)\b/i, 'Morning'],
  [/\b(noon|afternoon|lunch)\b/i, 'Afternoon'],
  [/\b(evening|dinner|pm\b)\b/i, 'Evening'],
  [/\b(bed|night|sleep)\b/i, 'Bedtime'],
]
function bucketForTiming(timing: string): string {
  for (const [pattern, bucket] of TIME_BUCKETS) if (pattern.test(timing)) return bucket
  return 'As directed'
}

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'

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
  { label: 'Recipes', id: 'recipes' },
  { label: 'Nutrition', id: 'nutrition' },
  { label: 'Grocery list', id: 'grocery' },
  { label: 'Supplements', id: 'supplements' },
  { label: 'Services', id: 'services' },
  { label: 'Track your progress', id: 'track' },
  { label: 'When to reach us', id: 'reach' },
  { label: 'FAQ', id: 'faq' },
]

export default function VitalsTemplate({ shareToken, data, initialCheckins, editable = false, roadmapId }: {
  shareToken: string
  data: GuideData
  initialCheckins: Checkin[]
  // Inline coach editing — see components/InlineEditableText.tsx and
  // WeekTemplate's identical prop shape/comment. Defaults to false and is
  // never passed by the public /share/roadmap/<token> page or the read-only
  // archived-version viewer, only by the authenticated coach route that
  // opts into it explicitly.
  editable?: boolean
  roadmapId?: string
}) {
  const theme = data.theme && PALETTES[data.theme] ? data.theme : 'classic'
  const p = PALETTES[theme]
  // Vitals' own shape: most tokens map straight from the shared palette;
  // `faint`/`track`/`warn` have no equivalent and stay fixed.
  // Memoized on `theme` — see the note on Eyebrow/SecTitle/Card/Ring below
  // for why: those closed over a fresh V object recreated every render, so
  // React treated every <Card> etc. on the page as a different component
  // type on every render and unmounted+remounted it on any click, however
  // unrelated — losing focus (back to <body>) and resetting scroll to top.
  const V = useMemo(() => ({
    bg: p.bg, card: p.paper, ink: p.ink, inkSoft: p.inkSoft, muted: p.muted, faint: '#9CA3AF',
    line: p.rule, accent: p.accent, accentSoft: p.accentSoft, accentDeep: p.greenDeep,
    warn: '#DC2626', track: '#E5E9F0',
  }), [p])

  const Eyebrow = useMemo(() => function Eyebrow({ children }: { children: React.ReactNode }) {
    return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: V.accent, display: 'block', marginBottom: 8 }}>{children}</span>
  }, [V])
  const SecTitle = useMemo(() => function SecTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ color: V.accent, display: 'flex' }}>{icon}</span>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: V.ink, letterSpacing: '-0.01em' }}>{children}</h2>
      </div>
    )
  }, [V])
  // Thin theme-aware wrappers around the shared primitives, which otherwise
  // default to a fixed blue — every Card/Ring call in this file goes through
  // these instead so the palette actually reaches them. Memoized on V, same
  // reason as Eyebrow/SecTitle above.
  const Card = useMemo(() => function Card(props: Parameters<typeof PrimCard>[0]) {
    return <PrimCard background={V.card} borderColor={V.line} {...props} />
  }, [V])
  const Ring = useMemo(() => function Ring(props: Parameters<typeof PrimRing>[0]) {
    return <PrimRing color={V.accent} trackColor={V.track} {...props} />
  }, [V])

  const firstName = data.patient.full_name?.split(' ')[0] || 'there'
  const coachFirst = data.coach?.full_name?.split(' ')[0] || 'your coach'
  const [hiddenSections, setHiddenSections] = useState<string[]>(data.hiddenSections || [])
  const isHidden = (id: string) => hiddenSections.includes(id)
  function toggleSection(id: string) {
    setHiddenSections((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      patchRoadmap({ guide_overrides: { hidden_sections: next } })
      return next
    })
  }
  const hiddenStyle = (id: string): CSSProperties => (!editable && isHidden(id) ? { display: 'none' } : {})
  const parsed = useMemo(() => parseNutritionistGuidelines(data.roadmap.nutritionist_guidelines), [data.roadmap.nutritionist_guidelines])
  const lifestyleBullets = useMemo(() => parseBullets(data.roadmap.lifestyle_guidelines), [data.roadmap.lifestyle_guidelines])

  // Best-effort, fire-and-forget — same helper/tolerance as WeekTemplate.
  function patchRoadmap(body: Record<string, unknown>) {
    if (!roadmapId) return
    fetch(`/api/compass/roadmaps/${roadmapId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => {})
  }

  // Weekly goals — unlike WeekTemplate (always exactly one week), Vitals
  // shows every month/week, so the editable copy stays the full raw
  // weekly_schedule and `months` is re-derived from it live.
  const [weeklySchedule, setWeeklySchedule] = useState(data.roadmap.weekly_schedule ?? [])
  const allMonths = useMemo(() => reshapeRoadmapIntoMonths(weeklySchedule).filter((m) => m.planned), [weeklySchedule])
  const months = useMemo(() => {
    if (editable) return allMonths
    return allMonths
      .filter((m) => !hiddenSections.includes(`month-${m.monthNumber}`))
      .map((m) => ({
        ...m,
        weeks: m.weeks.filter((w) => !hiddenSections.includes(`week-${w.week_number}`)),
      }))
      .filter((m) => m.weeks.length > 0)
  }, [allMonths, hiddenSections, editable])

  // Founder's note / coach's note / your why — real coach/patient text, not
  // covered by WeekTemplate's editable scope, but same InlineEditableText +
  // patchRoadmap autosave mechanism, using the same guide_overrides keys
  // DashboardClient's batch "Save changes" already writes to
  // (founder_note / coach_quote / why_reflection / care_team).
  const [founderNote, setFounderNote] = useState(data.founderNote)
  const [coachQuote, setCoachQuote] = useState(data.coachQuote)
  const [whyReflection, setWhyReflection] = useState(data.whyReflection)
  const [careTeam, setCareTeam] = useState<{ name: string; role: string; intro: string; photo?: string; date?: string; time?: string; mode?: string }[]>(data.careTeam || [])
  const [reachInfo, setReachInfo] = useState(data.reachInfo)
  function saveReachInfo(next: typeof reachInfo) {
    setReachInfo(next)
    patchRoadmap({ guide_overrides: { reach_info: next } })
  }
  function saveFounderNote(next: string) {
    setFounderNote(next)
    patchRoadmap({ guide_overrides: { founder_note: next } })
  }
  function saveCoachQuote(next: string) {
    setCoachQuote(next)
    patchRoadmap({ guide_overrides: { coach_quote: next } })
  }
  function saveWhyReflection(next: string) {
    setWhyReflection(next)
    patchRoadmap({ guide_overrides: { why_reflection: next } })
  }

  const [activeOrientationModal, setActiveOrientationModal] = useState<'founder' | 'coach' | 'howto' | null>(null)

  function saveCareTeam(next: typeof careTeam) {
    setCareTeam(next)
    patchRoadmap({ guide_overrides: { care_team: next } })
  }
  function saveCareTeamField(i: number, field: 'name' | 'role' | 'intro', next: string) {
    saveCareTeam(careTeam.map((m, idx) => (idx === i ? { ...m, [field]: next } : m)))
  }
  function removeCareTeamMember(i: number) {
    saveCareTeam(careTeam.filter((_, idx) => idx !== i))
  }
  function addCareTeamMember() {
    saveCareTeam([...careTeam, { name: 'New team member', role: '', intro: '', date: '', time: '', mode: '' }])
  }
  const [coaches, setCoaches] = useState<{ id: string; full_name: string; department: string | null; designation: string | null; bio: string | null; photo_url: string | null }[]>([])
  useEffect(() => {
    if (!editable) return
    fetch('/api/compass/nutritionists').then((r) => r.json()).then((j) => setCoaches(Array.isArray(j) ? j : []))
  }, [editable])
  function addCareTeamMemberFromDirectory(id: string) {
    const person = coaches.find((c) => c.id === id)
    if (!person) return
    saveCareTeam([...careTeam, { name: person.full_name, role: person.designation || '', intro: person.bio || '', photo: person.photo_url || '' }])
  }

  // The week heading on each roadmap week card ("Week 1 · <theme>").
  function saveWeekTheme(weekNumber: number, next: string) {
    setWeeklySchedule((prev) => {
      const updated = prev.map((w) => (w.week_number === weekNumber ? { ...w, focus_theme: next } : w))
      patchRoadmap({ weekly_schedule: updated })
      return updated
    })
  }
  function saveScheduleAction(weekNumber: number, dayIndex: number, actionIndex: number, next: string) {
    setWeeklySchedule((prev) => {
      const updated = prev.map((w) => {
        if (w.week_number !== weekNumber) return w
        if (w.days && w.days.length > 0) {
          const days = w.days.map((d, i) => (i === dayIndex ? d.map((a, j) => (j === actionIndex ? next : a)) : d))
          return { ...w, days }
        }
        const actions = (w.actions ?? []).map((a, j) => (j === actionIndex ? next : a))
        return { ...w, actions }
      })
      patchRoadmap({ weekly_schedule: updated })
      return updated
    })
  }

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

  const [recipeOverrides, setRecipeOverrides] = useState(data.recipeContentOverrides)
  useEffect(() => {
    if (data.recipeContentOverrides) {
      setRecipeOverrides(data.recipeContentOverrides)
    }
  }, [data.recipeContentOverrides])

  // Every distinct recipe used anywhere in the plan, deduped, grouped by
  // meal type — same computation the Recipes section renders below, hoisted
  // here so the "open from a lifestyle recipe link" effect further down can
  // find which slot a given recipe id lives under without duplicating it.
  // Never reads the URL hash here — this runs during the render pass, and
  // the server has no hash to match, so doing the lookup here would make
  // the very first client render disagree with the server-rendered HTML (a
  // hydration error). The hash is only ever read inside the effect below.
  const allWeekNumbers = useMemo(() => months.flatMap((m) => m.weeks).map((w) => w.week_number), [months])
  const recipesBySlot = useMemo(() => DAY_MEAL_SLOTS.map((slot) => {
    const bySlot = allWeekNumbers.map((wn) => getSlotRecipes(wn, [slot], data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank, 'Picked for your plan.')[0])
    const seen = new Set<string>()
    const matches = bySlot.flatMap((s) => s?.matches ?? [])
      .filter((m) => !recipeOverrides[m.recipe.id]?.hidden)
      .filter((m) => (seen.has(m.recipe.id) ? false : (seen.add(m.recipe.id), true)))
    return { slot, matches }
  }), [allWeekNumbers, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank, recipeOverrides])
  // A coach can link a lifestyle line (see RecipeLinkInsertButton) to any
  // recipe in the bank, not only the plan's top auto-matched picks — set by
  // the effect below (client-only, after hydration), never during render.
  const [linkedExtraRecipe, setLinkedExtraRecipe] = useState<BankRecipe | null>(null)
  const recipesBySlotWithLink = useMemo(() => {
    if (!linkedExtraRecipe) return recipesBySlot
    if (recipesBySlot.some((s) => s.matches.some((x) => x.recipe.id === linkedExtraRecipe.id))) return recipesBySlot
    return recipesBySlot.map((s) => s.slot === linkedExtraRecipe.meal_type
      ? { ...s, matches: [...s.matches, { recipe: linkedExtraRecipe, why: 'Linked from your daily routine.' }] }
      : s)
  }, [recipesBySlot, linkedExtraRecipe])

  // Opens a recipe the coach linked to from a lifestyle line (see
  // RecipeLinkInsertButton) when this page loads at that link's own
  // #recipe-<id> — finds which meal slot it's under (falling back to the
  // bank recipe's own meal_type when it isn't one of the auto-matched
  // picks), opens that slot, opens the recipe itself, then scrolls the
  // Recipes section into view.
  useEffect(() => {
    const m = window.location.hash.match(/^#recipe-(.+)$/)
    if (!m) return
    const id = m[1]
    let slot = recipesBySlot.find((s) => s.matches.some((x) => x.recipe.id === id))?.slot
    if (!slot) {
      const recipe = data.recipeBank.find((r) => r.id === id)
      if (recipe) { setLinkedExtraRecipe(recipe); slot = recipe.meal_type as DayMealSlot }
    }
    if (!slot) return
    setOpenSlot(`all-${slot}`)
    setOpenRecipeId(`all-${slot}-${id}`)
    requestAnimationFrame(() => document.getElementById('recipes')?.scrollIntoView({ behavior: 'smooth' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipesBySlot, data.recipeBank])
  const [tocOpen, setTocOpen] = useState(false)
  const [wheelMonthIdx, setWheelMonthIdx] = useState<number | null>(null)

  const today = todayISO()
  const progress = useMemo(() => {
    const dateSet = new Set(checkins.map((c) => c.checkin_date))
    let streak = 0
    let cursor = dateSet.has(today) ? today : shiftDateISO(today, -1)
    while (dateSet.has(cursor)) { streak++; cursor = shiftDateISO(cursor, -1) }
    const doneKeys = new Set(checkins.map((c) => `${c.week_number}:${c.action_index}`))
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

  const totalActionsInPlan = progress.monthStats.reduce((n, m) => n + m.totalActions, 0)
  const goalsDone = progress.monthStats.reduce((n, m) => n + m.doneActions, 0)
  const adherencePct = totalActionsInPlan > 0 ? Math.round((goalsDone / totalActionsInPlan) * 100) : 0
  const checkedSet = useMemo(() => new Set(checkins.map((c) => (c.item_id ? `0:item:${c.item_id}:${c.checkin_date}` : `${c.week_number}:${c.action_index}:${c.checkin_date}`))), [checkins])

  // Daily Health Check-in — same feature as the Week-family templates.
  // Items toggle by stable item_id, not position; when `editable` the coach
  // can add/remove/reword items, same pattern as WeekTemplate.
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(data.dailyChecklistItems || [])
  const [regenerating, setRegenerating] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [checkinDate, setCheckinDate] = useState(today)
  const checkinDoneCount = checklistItems.filter((it) => checkedSet.has(`0:item:${it.id}:${checkinDate}`)).length
  const checkinAllDone = checklistItems.length > 0 && checkinDoneCount === checklistItems.length
  const checkinNoneDone = checkinDoneCount === 0

  function saveChecklist(next: ChecklistItem[]) {
    setChecklistItems(next)
    patchRoadmap({ guide_overrides: { daily_checklist_items: next } })
  }
  function saveChecklistItemText(id: string, next: string) {
    saveChecklist(checklistItems.map((it) => (it.id === id ? { ...it, text: next } : it)))
  }
  function addChecklistItem() {
    saveChecklist([...checklistItems, { id: crypto.randomUUID(), text: 'New task', source: 'coach' }])
  }
  function removeChecklistItem(id: string) {
    saveChecklist(checklistItems.filter((it) => it.id !== id))
  }
  async function regenerateChecklist() {
    setConfirmRegenerate(false)
    setRegenerating(true)
    try {
      const res = await fetch(`/api/compass/roadmaps/${roadmapId}/regenerate-checklist`, { method: 'POST' })
      const j = await res.json().catch(() => null)
      if (res.ok && Array.isArray(j?.items)) saveChecklist(j.items)
    } catch { /* keep the current list on failure */ }
    finally { setRegenerating(false) }
  }

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

  // Water/energy/mood — small per-day numbers/text, stored on the roadmap
  // row (guide_overrides.daily_metrics) via a dedicated endpoint, same as
  // the Week templates and Classic.
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

  // Daily Lifestyle Guidelines / Breakfast-Lunch-Dinner / Daily Schedule —
  // the same period-split coach content Classic and Week render; editable
  // copies + save helpers follow WeekTemplate's exact pattern, each
  // sub-section only appears if it actually has content.
  const [lifestyleByPeriod, setLifestyleByPeriod] = useState<Record<string, string>>(() => splitIntoPeriods(data.dailyLifestyleGuidelines, LIFESTYLE_PERIODS))
  const [mealsByPeriod, setMealsByPeriod] = useState<Record<string, string>>(() => splitIntoPeriods(data.mealGuidelines, MEAL_PERIODS))

  // Supplement table — editable here now too (previously only editable on
  // the Classic editor). Saved as guide_overrides.confirmed_supplements_override,
  // which wins over the reports-derived list for this roadmap without
  // touching the source report(s) — same override-wins pattern as every
  // other field here.
  const [supplementRows, setSupplementRows] = useState(data.confirmedSupplements)
  function updateSupplementRow(i: number, patch: Partial<GuideData['confirmedSupplements'][number]>) {
    setSupplementRows((prev) => {
      const next = prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
      patchRoadmap({ guide_overrides: { confirmed_supplements_override: next } })
      return next
    })
  }
  function removeSupplementRow(i: number) {
    setSupplementRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i)
      patchRoadmap({ guide_overrides: { confirmed_supplements_override: next } })
      return next
    })
  }
  function addSupplementRow() {
    setSupplementRows((prev) => [...prev, { name: '', dose: '', timing: '', duration: '', notes: '' }])
  }
  function saveLifestyleItem(label: string, itemIndex: number, next: string) {
    setLifestyleByPeriod((prev) => {
      const items = parseBullets(prev[label] || '')
      if (!next.trim()) {
        items.splice(itemIndex, 1)
      } else {
        items[itemIndex] = next
      }
      const updated = { ...prev, [label]: items.join('\n') }
      const joined = joinPeriods(updated, LIFESTYLE_PERIODS)
      patchRoadmap({ lifestyle_guidelines: joined, guide_overrides: { daily_lifestyle_guidelines: joined } })
      return updated
    })
  }
  function saveMealItem(label: string, itemIndex: number, next: string) {
    setMealsByPeriod((prev) => {
      const items = parseBullets(prev[label] || '')
      if (!next.trim()) {
        items.splice(itemIndex, 1)
      } else {
        items[itemIndex] = next
      }
      const updated = { ...prev, [label]: items.join('\n') }
      const joined = joinPeriods(updated, MEAL_PERIODS)
      patchRoadmap({ meal_guidelines: joined, guide_overrides: { meal_guidelines: joined } })
      return updated
    })
  }
  function saveLifestylePeriodText(label: string, nextText: string) {
    setLifestyleByPeriod((prev) => {
      const updated = { ...prev, [label]: nextText }
      const joined = joinPeriods(updated, LIFESTYLE_PERIODS)
      patchRoadmap({ lifestyle_guidelines: joined, guide_overrides: { daily_lifestyle_guidelines: joined } })
      return updated
    })
  }
  function saveMealPeriodText(label: string, nextText: string) {
    setMealsByPeriod((prev) => {
      const updated = { ...prev, [label]: nextText }
      const joined = joinPeriods(updated, MEAL_PERIODS)
      patchRoadmap({ meal_guidelines: joined, guide_overrides: { meal_guidelines: joined } })
      return updated
    })
  }

  const [dailyScheduleText, setDailyScheduleText] = useState(data.dailySchedule || '')
  function saveScheduleField(lineIndex: number, field: 'time' | 'text', nextValue: string) {
    const clean = nextValue.replace(/\s*\n\s*/g, ' ').trim()
    setDailyScheduleText((prev) => {
      const parsedLines = parseScheduleLines(prev)
      const current = parsedLines[lineIndex] ?? { time: '', text: '' }
      const nextEntry = field === 'time' ? { ...current, time: clean } : { ...current, text: clean }
      const lines = parsedLines.map((item, i) => {
        const e = i === lineIndex ? nextEntry : item
        return e.time ? `${e.time} — ${e.text}` : e.text
      })
      const updated = lines.join('\n')
      patchRoadmap({ guide_overrides: { daily_schedule: updated } })
      return updated
    })
  }

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
    } catch { revert() }
  }

  const [openGroceryMonth, setOpenGroceryMonth] = useState<number | null>(null)
  const [openGroceryWeek, setOpenGroceryWeek] = useState<number | null>(null)
  const [boughtItems, setBoughtItems] = useState<Set<string>>(new Set())

  // Shopping list override — same "null means keep computing it live"
  // pattern as WeekTemplate. Note this applies the SAME override to every
  // week shown (pre-existing behavior: `data.groceryListOverride` was
  // already applied identically to every week before this change), so
  // editing doesn't change which week(s) the override affects.
  const [groceryOverride, setGroceryOverride] = useState<GroceryCategory[] | null>(data.groceryListOverride)
  function saveGroceryList(next: GroceryCategory[]) {
    setGroceryOverride(next)
    patchRoadmap({ guide_overrides: { grocery_list_override: next } })
  }
  function saveGroceryItemText(cats: GroceryCategory[], catHead: string, itemIndex: number, next: string) {
    saveGroceryList(cats.map((cat) => (cat.head === catHead ? { ...cat, items: cat.items.map((it, i) => (i === itemIndex ? next : it)) } : cat)))
  }
  function removeGroceryItem(cats: GroceryCategory[], catHead: string, itemIndex: number) {
    saveGroceryList(
      cats
        .map((cat) => (cat.head === catHead ? { ...cat, items: cat.items.filter((_, i) => i !== itemIndex) } : cat))
        .filter((cat) => cat.items.length > 0),
    )
  }
  function addGroceryItem(cats: GroceryCategory[], catHead: string) {
    saveGroceryList(cats.map((cat) => (cat.head === catHead ? { ...cat, items: [...cat.items, 'New item'] } : cat)))
  }
  function saveGroceryCategoryName(cats: GroceryCategory[], oldHead: string, next: string) {
    saveGroceryList(cats.map((cat) => (cat.head === oldHead ? { ...cat, head: next } : cat)))
  }
  function removeGroceryCategory(cats: GroceryCategory[], head: string) {
    saveGroceryList(cats.filter((cat) => cat.head !== head))
  }
  function addGroceryCategory(cats: GroceryCategory[]) {
    saveGroceryList([...cats, { head: 'New category', items: ['New item'] }])
  }
  function resetGroceryList() {
    setGroceryOverride(null)
    patchRoadmap({ guide_overrides: { grocery_list_override: null } })
  }
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

  const [openService, setOpenService] = useState<number | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const { superfoodImage, superfoodPick } = useMemo(() => {
    const used = new Set<string>()
    const pick = weekMealMatches.snack[0] || weekMealMatches.breakfast[0] || weekMealMatches.dinner[0] || weekMealMatches.lunch[0] || weekMealMatches.dessert[0] || null
    const superfood = pick
      ? (pick.recipe.image_url
        ? { id: pick.recipe.id, image_url: pick.recipe.image_url, label: pick.recipe.name, tags: pick.recipe.tags }
        : matchGuideImageDistinct(`${pick.recipe.name} ${pick.recipe.tags.join(' ')}`, data.imageBank, used))
      : null
    return { superfoodImage: superfood, superfoodPick: pick }
  }, [data.imageBank, weekMealMatches])

  function downloadDashboard() {
    const root = document.getElementById('vitals-export-root')
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
    clone.querySelectorAll('[data-faq-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleFaq('${el.getAttribute('data-faq-trigger')}')`))
    clone.querySelectorAll('[data-care-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleCare('${el.getAttribute('data-care-trigger')}')`))
    clone.querySelectorAll('[data-toc-trigger]').forEach((el) => el.setAttribute('onclick', 'clpToggleToc()'))
    clone.querySelectorAll('[data-toc-link]').forEach((el) => el.setAttribute('onclick', 'clpCloseToc()'))
    clone.querySelectorAll('[data-toc-panel]').forEach((el) => ((el as HTMLElement).style.display = 'none'))
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
      colors: { ink: V.ink, inkSoft: V.inkSoft, muted: V.muted, accent: V.accent, accentSoft: V.accentSoft, border: V.line, onAccent: '#fff' },
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
<style>body{margin:0;}</style>
</head>
<body>${clone.outerHTML}
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

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('download') === '1') {
      downloadDashboard()
      window.history.replaceState(null, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wheelSegments = progress.monthStats.map((m) => ({ label: m.monthLabel, pct: m.pct }))
  const activeWheelMonth = wheelMonthIdx != null ? months[wheelMonthIdx] : null

  return (
    <div id="vitals-export-root" style={{ background: V.bg, minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", color: V.ink, WebkitFontSmoothing: 'antialiased' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={FONT_LINK} rel="stylesheet" />

      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(245,247,251,0.92)', backdropFilter: 'blur(6px)', borderBottom: `1px solid ${V.line}`, padding: '10px 1.5rem' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative' }}>
          <button data-toc-trigger onClick={() => setTocOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: V.ink, background: '#fff', border: `1px solid ${V.line}`, borderRadius: 20, padding: '7px 14px', cursor: 'pointer' }}>
            Jump to section <ChevronDown size={13} style={{ transform: tocOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          <div data-toc-panel style={{ display: tocOpen ? 'grid' : 'none', position: 'absolute', top: '100%', left: 0, marginTop: 6, gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))', gap: '2px 12px', background: '#fff', border: `1px solid ${V.line}`, borderRadius: 12, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: '70vh', overflowY: 'auto', zIndex: 31 }}>
            {TOC_ITEMS.filter((item) => !isHidden(item.id)).map((item, i) => (
              <a key={`${item.id}-${i}`} data-toc-link href={`#${item.id}`} onClick={() => setTocOpen(false)}
                style={{ fontSize: 12, fontWeight: 600, color: V.inkSoft, textDecoration: 'none', padding: '8px 9px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Hero — one big ring instead of a paragraph of context */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2.5rem 1.5rem 0.5rem' }}>
        <Card style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <Eyebrow>Living Plus</Eyebrow>
          <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.3rem)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Hi {firstName}</h1>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: V.accent, marginTop: 6 }}>{data.goalLabel}</div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '1.75rem 0 0.75rem' }}>
            <Ring pct={adherencePct} size={150} thickness={13}>
              <div style={{ textAlign: 'center' }}>
                <div data-goals-done style={{ fontSize: 30, fontWeight: 800 }}>{adherencePct}%</div>
                <div style={{ fontSize: 10.5, color: V.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>adherence</div>
              </div>
            </Ring>
          </div>
          <div style={{ fontSize: 12.5, color: V.muted }}>
            {totalActionsInPlan > 0 ? <>{goalsDone} of {totalActionsInPlan} goals tracked</> : 'Check off goals in your plan to see progress here'}
          </div>
        </Card>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 1.5rem 3rem' }}>

        {/* Daily Health Check-in — same feature as the Week-family templates,
            ported here read-only. */}
        <Card id="checkin" hidden={isHidden('checkin')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <SecTitle icon={<CheckCircle2 size={20} />}>Daily Health Check-in</SecTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {editable && (
                <button type="button" onClick={() => setConfirmRegenerate(true)} disabled={regenerating}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '8px 12px', borderRadius: 9, border: `1px solid ${V.line}`, background: V.bg, color: V.accent, cursor: regenerating ? 'default' : 'pointer', opacity: regenerating ? 0.6 : 1 }}>
                  <Sparkles size={13} /> {regenerating ? 'Regenerating…' : 'Ask AI to regenerate'}
                </button>
              )}
              <input type="date" value={checkinDate} onChange={(e) => setCheckinDate(e.target.value)}
                style={{ fontSize: 12.5, background: V.bg, border: `1px solid ${V.line}`, padding: '8px 11px', borderRadius: 9, color: V.ink, fontWeight: 600 }} />
            </div>
          </div>

          {confirmRegenerate && (
            <div style={{ background: V.accentSoft, border: `1px solid ${V.accent}`, borderRadius: 12, padding: '12px 16px', margin: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: V.ink }}>Regenerate from this patient&apos;s current supplements and lifestyle guidelines? Any manual edits to the checklist will be overwritten.</span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={() => setConfirmRegenerate(false)} style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: `1px solid ${V.line}`, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={regenerateChecklist} style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none', background: V.accent, color: '#fff', cursor: 'pointer' }}>Regenerate</button>
              </div>
            </div>
          )}

          {!editable && checklistItems.length > 0 && (
            <p style={{ fontSize: 12.5, color: V.accent, fontWeight: 600, margin: '8px 0 12px' }}>
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
                  <div key={item.id} onClick={() => { if (!editable) toggleChecklistItem(item.id, item.text, checkinDate) }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', borderRadius: 12, cursor: editable ? 'default' : 'pointer', border: `1px solid ${checked ? V.accent : V.line}`, background: checked ? V.accentSoft : V.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                      {!editable && (checked
                        ? <CheckCircle2 size={17} color={V.accent} style={{ flexShrink: 0 }} />
                        : <Circle size={17} style={{ flexShrink: 0, opacity: 0.4 }} />)}
                      {editable ? (
                        <InlineEditableText editable value={item.text} onSave={(next) => saveChecklistItemText(item.id, next)}
                          style={{ fontSize: 13, fontWeight: 500, color: V.ink, flex: 1 }} />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, color: checked ? V.accent : V.ink, textDecoration: checked ? 'line-through' : 'none' }}>{item.text}</span>
                      )}
                    </div>
                    {editable ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeChecklistItem(item.id) }} title="Remove"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.accent, opacity: 0.6, flexShrink: 0 }}><X size={15} /></button>
                    ) : (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: checked ? V.accent : V.accentSoft, color: checked ? '#fff' : V.accent, flexShrink: 0 }}>{checked ? 'Done' : 'Pending'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: V.muted, marginTop: 12 }}>Once your coach confirms your supplements or lifestyle guidelines, your daily checklist will show up here.</p>
          )}
          {editable && (
            <button type="button" onClick={addChecklistItem}
              style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${V.line}`, background: 'none', color: V.accent, cursor: 'pointer' }}>
              + Add task
            </button>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 18 }}>
            <div style={{ background: V.bg, border: `1px solid ${V.line}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: V.accent, marginBottom: 8 }}><Droplet size={12} /> Water (glasses)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => adjustWater(-1)} style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${V.line}`, background: V.accentSoft, fontWeight: 700, cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{todayMetrics.water || 0}</span>
                <button onClick={() => adjustWater(1)} style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${V.line}`, background: V.accentSoft, fontWeight: 700, cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ background: V.bg, border: `1px solid ${V.line}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: V.accent, marginBottom: 8 }}><Flame size={12} /> Energy (1-10)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => adjustEnergy(-1)} style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${V.line}`, background: V.accentSoft, fontWeight: 700, cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{todayMetrics.energy || 0}</span>
                <button onClick={() => adjustEnergy(1)} style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${V.line}`, background: V.accentSoft, fontWeight: 700, cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ background: V.bg, border: `1px solid ${V.line}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: V.accent, marginBottom: 8 }}>Mood &amp; reflection</div>
              <input value={moodDraft} onChange={(e) => setMoodDraft(e.target.value)} onBlur={() => saveMetric('mood', moodDraft)}
                placeholder="e.g. Calm and focused today"
                style={{ width: '100%', background: V.card, border: `1px solid ${V.line}`, borderRadius: 9, padding: '7px 10px', fontSize: 12.5, color: V.ink }} />
            </div>
          </div>
        </Card>

        {/* Orientation & Notes Grid Row: Founder's Note, Coach's Note, How to Use Your Plan */}
        {(() => {
          const coachBio = data.coach?.bio || ''
          const rawQuote = coachQuote || ''
          const isPlaceholder = !rawQuote || rawQuote.includes('[First name]') || rawQuote.includes('remember what you said about')
          const displayQuote = isPlaceholder ? coachBio : rawQuote
          const coachName = data.coach?.full_name || 'Your Coach'
          const coachDesignation = data.coach?.designation || 'Integrative Health Coach'
          const coachPhoto = data.coach?.photo_url || ''

          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
                {/* 1. Founder's Note Card */}
                <Card id="founder" hidden={isHidden('founder')}>
                  <div onClick={() => setActiveOrientationModal('founder')}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', padding: '12px 6px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: V.accent, marginBottom: 12 }}>Founder&apos;s Note</div>
                    <div style={{ width: 64, height: 64, borderRadius: 32, background: `url(${FOUNDER_PHOTO_URL}) center/cover`, border: `1px solid ${V.line}`, marginBottom: 10 }} />
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: V.ink }}>Roshni Sanghvi</div>
                    <div style={{ fontSize: '0.8rem', color: V.muted, marginBottom: 14 }}>Founder, Living Plus</div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setActiveOrientationModal('founder') }}
                      style={{ marginTop: 'auto', padding: '7px 14px', borderRadius: 20, background: V.bg, color: V.accent, fontSize: '0.78rem', fontWeight: 700, border: `1px solid ${V.line}`, cursor: 'pointer' }}>
                      Read Intro &amp; Founder Note →
                    </button>
                  </div>
                </Card>

                {/* 2. Coach's Note Card */}
                {data.coach && (
                  <Card id="coach" hidden={isHidden('coach')}>
                    <div onClick={() => setActiveOrientationModal('coach')}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', padding: '12px 6px' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: V.accent, marginBottom: 12 }}>Coach&apos;s Note</div>
                      <div style={{ width: 64, height: 64, borderRadius: 32, background: coachPhoto ? `url(${coachPhoto}) center/cover` : V.accentSoft, border: `1px solid ${V.line}`, marginBottom: 10 }} />
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: V.ink }}>{coachName}</div>
                      <div style={{ fontSize: '0.8rem', color: V.muted, marginBottom: 14 }}>{coachDesignation}</div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setActiveOrientationModal('coach') }}
                        style={{ marginTop: 'auto', padding: '7px 14px', borderRadius: 20, background: V.bg, color: V.accent, fontSize: '0.78rem', fontWeight: 700, border: `1px solid ${V.line}`, cursor: 'pointer' }}>
                        Read Intro &amp; Coach Note →
                      </button>
                    </div>
                  </Card>
                )}

                {/* 3. How to Use Your Plan Card */}
                <Card id="howto" hidden={isHidden('howto')}>
                  <div onClick={() => setActiveOrientationModal('howto')}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', padding: '12px 6px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: V.accent, marginBottom: 12 }}>Guide &amp; Your Why</div>
                    <div style={{ width: 64, height: 64, borderRadius: 32, background: V.bg, border: `1px solid ${V.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, color: V.accent }}>
                      <HelpCircle size={30} />
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: V.ink }}>How to Use Your Plan</div>
                    <div style={{ fontSize: '0.8rem', color: V.muted, marginBottom: 14 }}>Follow → Track → Adjust</div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setActiveOrientationModal('howto') }}
                      style={{ marginTop: 'auto', padding: '7px 14px', borderRadius: 20, background: V.bg, color: V.accent, fontSize: '0.78rem', fontWeight: 700, border: `1px solid ${V.line}`, cursor: 'pointer' }}>
                      View Guide &amp; Your Why →
                    </button>
                  </div>
                </Card>
              </div>

              {/* MODAL OVERLAY */}
              {activeOrientationModal && (
                <div onClick={() => setActiveOrientationModal(null)}
                  style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ background: V.card, border: `1px solid ${V.line}`, borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', padding: 24, position: 'relative', color: V.ink }}>
                    
                    <button onClick={() => setActiveOrientationModal(null)}
                      style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, border: `1px solid ${V.line}`, background: V.bg, color: V.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>

                    {/* Founder Modal */}
                    {activeOrientationModal === 'founder' && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${V.line}` }}>
                          <div style={{ width: 64, height: 64, borderRadius: 32, background: `url(${FOUNDER_PHOTO_URL}) center/cover`, border: `1px solid ${V.line}`, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: V.ink }}>Roshni Sanghvi</div>
                            <div style={{ fontSize: '0.85rem', color: V.muted }}>Founder, Living Plus</div>
                            <div style={{ fontSize: '0.78rem', color: V.muted, marginTop: 4, lineHeight: 1.4 }}>{FOUNDER_INTRO}</div>
                          </div>
                        </div>
                        
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 10, color: V.ink }}>Founder&apos;s note</div>
                        {editable ? (
                          <InlineEditableText editable multiline value={founderNote} onSave={saveFounderNote}
                            style={{ fontSize: '0.92rem', lineHeight: 1.7, color: V.ink }} />
                        ) : (
                          founderNote.split('\n\n').map((para, i) => (
                            <p key={i} style={{ fontSize: '0.92rem', lineHeight: 1.7, marginBottom: 10, color: V.ink }}>{para}</p>
                          ))
                        )}
                      </div>
                    )}

                    {/* Coach Modal */}
                    {activeOrientationModal === 'coach' && data.coach && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${V.line}` }}>
                          <div style={{ width: 64, height: 64, borderRadius: 32, background: coachPhoto ? `url(${coachPhoto}) center/cover` : V.accentSoft, border: `1px solid ${V.line}`, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: V.ink }}>{coachName}</div>
                            <div style={{ fontSize: '0.85rem', color: V.muted }}>{coachDesignation}</div>
                          </div>
                        </div>

                        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 10, color: V.ink }}>Coach&apos;s note</div>
                        {editable ? (
                          <InlineEditableText editable multiline value={coachQuote || ''} onSave={saveCoachQuote} placeholder="Add a note from your coach…"
                            style={{ fontStyle: 'italic', color: V.accent, fontSize: '0.92rem' }} />
                        ) : displayQuote ? (
                          displayQuote.split('\n\n').map((para, i) => (
                            <p key={i} style={{ fontSize: '0.92rem', fontStyle: 'italic', color: V.accent, lineHeight: 1.65, marginBottom: 10 }}>&ldquo;{renderMarkdownBold(para)}&rdquo;</p>
                          ))
                        ) : null}
                      </div>
                    )}

                    {/* How to use Modal */}
                    {activeOrientationModal === 'howto' && (
                      <div>
                        <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${V.line}` }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: V.ink }}>How to use your plan</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: V.accent, marginTop: 4 }}>Follow → Track → Adjust</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 18 }}>
                          {[
                            { icon: HeartPulse, title: 'Why it matters', text: 'Every part of this guide was chosen for you. The more of it you use day to day, the more clearly your coach can see what’s working and fine-tune it.' },
                            { icon: MapPin, title: 'Your goals', text: 'Your roadmap takes you month by month. Open the week you’re in to see its focus and a few small goals for each day.' },
                            { icon: Sun, title: 'Your daily routine', text: 'The lifestyle guidelines, meals and daily schedule are the everyday habits behind those goals. Treat them as your default day, not a strict rulebook.' },
                            { icon: Utensils, title: 'Your kitchen', text: 'The recipes and shopping list come straight from your plan, so what you buy and cook already fits it.' },
                            { icon: CheckCircle2, title: 'Tick off and track', text: 'Tick off what you complete each day. Your progress shows you and your coach what’s working, and what to change.' },
                            { icon: HelpCircle, title: 'Need help?', text: 'Message ' + coachFirst + ' if something doesn’t work for you.' },
                          ].map(({ icon: Icon, title, text }) => (
                            <div key={title} style={{ background: V.bg, border: `1px solid ${V.line}`, borderRadius: 12, padding: 12 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: V.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                                <Icon size={15} color={V.accent} />
                              </div>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 2, color: V.ink }}>{title}</div>
                              <div style={{ fontSize: '0.82rem', color: V.muted, lineHeight: 1.45 }}>{text}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ paddingTop: 14, borderTop: `1px solid ${V.line}` }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8, color: V.ink }}>Your why</div>
                          {editable ? (
                            <InlineEditableText editable as="div" multiline value={whyReflection || ''} onSave={saveWhyReflection} placeholder="Not filled in yet."
                              style={{ fontSize: '0.95rem', lineHeight: 1.65 }} />
                          ) : whyReflection ? (
                            <p style={{ fontSize: '0.95rem', lineHeight: 1.65, color: V.ink }}>{renderMarkdownBold(whyReflection)}</p>
                          ) : (
                            <p style={{ fontSize: '0.9rem', color: V.muted }}>Not filled in yet.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {/* Care team */}
        {(careTeam.length > 0 || editable) && (
          <Card id="careteam" hidden={isHidden('careteam')}>
            <Eyebrow>Beyond your coach</Eyebrow>
            <SecTitle icon={<Users size={20} />}>Your care team</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 16 }}>
              {careTeam.map((m, i) => (
                <div key={i} style={{ border: `1px solid ${V.line}`, borderRadius: 14, padding: '14px 16px', position: 'relative' }}>
                  {editable && (
                    <button type="button" onClick={() => removeCareTeamMember(i)} title="Remove"
                      style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: V.accent, opacity: 0.6 }}><X size={14} /></button>
                  )}
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: m.photo ? `url(${m.photo}) center/cover` : V.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: V.accentDeep, marginBottom: 10 }}>
                    {!m.photo && (m.name || '?').charAt(0)}
                  </div>
                  {editable ? (
                    <>
                      <InlineEditableText editable value={m.name} placeholder="Name" onSave={(next) => saveCareTeamField(i, 'name', next)}
                        style={{ fontWeight: 700, fontSize: 13.5, display: 'block' }} />
                      <InlineEditableText editable value={m.role} placeholder="Role" onSave={(next) => saveCareTeamField(i, 'role', next)}
                        style={{ fontSize: 11, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3, display: 'block' }} />
                      <InlineEditableText editable as="div" multiline value={m.intro} placeholder="Short intro" onSave={(next) => saveCareTeamField(i, 'intro', next)}
                        style={{ fontSize: 12.5, color: V.inkSoft, lineHeight: 1.5, marginTop: 8 }} />
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{m.name}</div>
                      {m.role && <div style={{ fontSize: 11, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>{m.role}</div>}
                      {m.intro && <p style={{ fontSize: 12.5, color: V.inkSoft, lineHeight: 1.5, marginTop: 8, marginBottom: 0 }}>{renderMarkdownBold(m.intro)}</p>}
                    </>
                  )}
                </div>
              ))}
            </div>
            {editable && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {coaches.length > 0 && (
                  <select value="" onChange={(e) => { if (e.target.value) addCareTeamMemberFromDirectory(e.target.value) }}
                    style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${V.line}`, background: 'none', color: V.accent, cursor: 'pointer' }}>
                    <option value="">+ Add from staff directory…</option>
                    {Array.from(new Set(coaches.map((c) => c.department || 'No department'))).sort().map((dept) => (
                      <optgroup key={dept} label={dept}>
                        {coaches.filter((c) => (c.department || 'No department') === dept).map((c) => (
                          <option key={c.id} value={c.id}>{c.full_name}{c.designation ? ` — ${c.designation}` : ''}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
                <button type="button" onClick={addCareTeamMember}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${V.line}`, background: 'none', color: V.accent, cursor: 'pointer' }}>
                  + Add manually
                </button>
              </div>
            )}
          </Card>
        )}

        {LIFESTYLE_PERIODS.some((label) => parseBullets(lifestyleByPeriod[label] || '').length > 0) && (
          <Card id="lifestyle" hidden={isHidden('lifestyle')}>
            <SecTitle icon={<Sun size={20} />}>Daily Lifestyle Guidelines</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 16 }}>
              {LIFESTYLE_PERIODS.map((label) => {
                const items = parseBullets(lifestyleByPeriod[label] || '')
                if (items.length === 0) return null
                const { images, textItems } = splitTextAndImagesIndexed(items)
                return (
                  <div key={label} style={{ background: V.bg, border: `1px solid ${V.line}`, borderRadius: 12, padding: '15px 17px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: V.accent, fontWeight: 700 }}>{label}</span>
                      {editable && (
                        <ImageInsertButton value={lifestyleByPeriod[label] || ''} onChange={(next) => saveLifestylePeriodText(label, next)} />
                      )}
                    </div>
                    {editable ? (
                      <ImagePreviewStrip value={lifestyleByPeriod[label] || ''} onChange={(next) => saveLifestylePeriodText(label, next)} />
                    ) : images.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                        {images.map((img, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={img.url} alt={img.alt} loading="lazy" decoding="async" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 10, display: 'block' }} />
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {textItems.map(({ text, index }) => (
                        <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <Circle size={11} color={V.accent} style={{ flexShrink: 0, marginTop: 4, opacity: 0.6 }} />
                          {editable ? (
                            <InlineEditableText editable value={text} onSave={(next) => saveLifestyleItem(label, index, next)}
                              style={{ fontSize: 13, lineHeight: 1.5 }} />
                          ) : (
                            <span style={{ fontSize: 13, lineHeight: 1.5 }}>{renderMarkdownBold(text)}</span>
                          )}
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
            <SecTitle icon={<Utensils size={20} />}>Breakfast, Lunch &amp; Dinner</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 16 }}>
              {MEAL_PERIODS.map((label) => {
                const items = parseBullets(mealsByPeriod[label] || '')
                if (items.length === 0) return null
                const { images, textItems } = splitTextAndImagesIndexed(items)
                return (
                  <div key={label} style={{ background: V.bg, border: `1px solid ${V.line}`, borderRadius: 12, padding: '15px 17px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: V.accent, fontWeight: 700 }}>{label}</span>
                      {editable && (
                        <ImageInsertButton value={mealsByPeriod[label] || ''} onChange={(next) => saveMealPeriodText(label, next)} />
                      )}
                    </div>
                    {editable ? (
                      <ImagePreviewStrip value={mealsByPeriod[label] || ''} onChange={(next) => saveMealPeriodText(label, next)} />
                    ) : images.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                        {images.map((img, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={img.url} alt={img.alt} loading="lazy" decoding="async" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 10, display: 'block' }} />
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {textItems.map(({ text, index }) => (
                        <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <Circle size={11} color={V.accent} style={{ flexShrink: 0, marginTop: 4, opacity: 0.6 }} />
                          {editable ? (
                            <InlineEditableText editable value={text} onSave={(next) => saveMealItem(label, index, next)}
                              style={{ fontSize: 13, lineHeight: 1.5 }} />
                          ) : (
                            <span style={{ fontSize: 13, lineHeight: 1.5 }}>{renderMarkdownBold(text)}</span>
                          )}
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
            <SecTitle icon={<CalendarCheck size={20} />}>Daily Schedule</SecTitle>
            <div style={{ position: 'relative', paddingLeft: 34, marginTop: 18 }}>
              <div style={{ position: 'absolute', left: 13, top: 6, bottom: 6, width: 2, background: V.line }} />
              {parseScheduleLines(dailyScheduleText).map((item, i, arr) => (
                <div key={i} style={{ position: 'relative', marginBottom: i < arr.length - 1 ? 20 : 0 }}>
                  <span style={{ position: 'absolute', left: -34, top: 0, width: 26, height: 26, borderRadius: 13, background: V.accentSoft, border: `2px solid ${V.card}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Circle size={9} color={V.accent} />
                  </span>
                  {editable ? (
                    <>
                      <InlineEditableText editable value={item.time} placeholder="Time" onSave={(next) => saveScheduleField(i, 'time', next)}
                        style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, color: V.accent }} />
                      <InlineEditableText editable value={item.text} placeholder="Activity" onSave={(next) => saveScheduleField(i, 'text', next)}
                        style={{ display: 'block', fontSize: 13, lineHeight: 1.5, marginTop: 2 }} />
                    </>
                  ) : (
                    <>
                      {item.time && <div style={{ fontSize: 11.5, fontWeight: 700, color: V.accent }}>{item.time}</div>}
                      <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>{item.text}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Power points */}
        {data.powerPoints.filter((pp) => pp.url).length > 0 && (
          <Card id="nutrition" hidden={isHidden('nutrition')}>
            <Eyebrow>Worth a look</Eyebrow>
            <SecTitle icon={<LinkIcon size={20} />}>Your power points</SecTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {data.powerPoints.filter((pp) => pp.url).map((pp, i) => (
                <a key={i} href={pp.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, textDecoration: 'none', padding: '12px 14px', borderRadius: 12, border: `1px solid ${V.line}` }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: V.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LinkIcon size={16} color={V.accent} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {pp.note && <div style={{ fontSize: 13, color: V.ink, lineHeight: 1.5, marginBottom: 3 }}>{renderMarkdownBold(pp.note)}</div>}
                    <div style={{ fontSize: 11.5, color: V.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pp.url}</div>
                  </div>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Your roadmap — functional medicine pathway */}
        {months.length > 0 && (() => {
          const activeMthNum = openMonth ?? months[0]?.monthNumber ?? 1
          const activeMonthObj = months.find((m) => m.monthNumber === activeMthNum) || months[0]
          const activeWkNum = openWeek ?? activeMonthObj?.weeks[0]?.week_number ?? 1

          return (
            <Card id="roadmap" hidden={isHidden('roadmap')}>
              <Eyebrow>Month by month</Eyebrow>
              <SecTitle icon={<MapPin size={20} />}>Your roadmap</SecTitle>

              {/* Month Phase Stepper Header */}
              {months.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length}, 1fr)`, gap: 10, marginTop: 18, marginBottom: 24 }}>
                  {months.map((m) => {
                    const isSelected = activeMthNum === m.monthNumber
                    const isMthHidden = isHidden(`month-${m.monthNumber}`)
                    const goalCount = m.weeks.reduce((n, w) => n + (w.days?.length ? w.days.reduce((nn, d) => nn + d.length, 0) : (w.actions?.length ?? 0)), 0)
                    return (
                      <div key={m.monthNumber} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, width: '100%' }}>
                        <button data-month-trigger={m.monthNumber} onClick={() => { setOpenMonth(m.monthNumber); setOpenWeek(m.weeks[0]?.week_number ?? null) }}
                          style={{
                            padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                            border: `1px ${isMthHidden ? 'dashed' : 'solid'} ${isSelected ? V.accent : V.line}`,
                            background: isSelected ? V.accentSoft : '#fff', color: V.ink, opacity: isMthHidden ? 0.65 : 1, transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden'
                          }}>
                          {isSelected && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: V.accent }} />}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: isSelected ? V.accent : V.muted }}>PHASE 0{m.monthNumber}</span>
                            {isSelected ? (
                              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: V.accent, color: '#fff' }}>ACTIVE</span>
                            ) : (
                              <span style={{ fontSize: 10, color: V.muted }}>W{m.weekStart}–W{m.weekEnd}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.monthLabel}</div>
                          <div style={{ fontSize: 11, color: V.muted, marginTop: 3 }}>{m.weeks.length} Weeks · {goalCount} Targets</div>
                        </button>
                        {editable && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleSection(`month-${m.monthNumber}`) }}
                            title={isMthHidden ? `Unhide Month ${m.monthNumber} for patient` : `Hide Month ${m.monthNumber} from patient`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: isMthHidden ? V.accent : V.muted }}>
                            {isMthHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 4-Week Connected Milestone Pathway Track */}
              {activeMonthObj && (
                <div style={{ marginTop: 18, marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: V.accent }}>
                      {activeMonthObj.monthLabel} Pathway · Weeks {activeMonthObj.weekStart}–{activeMonthObj.weekEnd}
                    </div>
                    <span style={{ fontSize: 11, color: V.muted }}>Select a week to view protocol</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                    {activeMonthObj.weeks.map((w) => {
                      const isWkSelected = activeWkNum === w.week_number
                      const isWkHidden = isHidden(`week-${w.week_number}`)
                      const actionCount = w.actions?.length || (w.days ? w.days.reduce((acc, d) => acc + d.length, 0) : 0)
                      const previewActions = w.actions?.slice(0, 2) ?? []

                      return (
                        <div key={w.week_number} data-week-trigger={w.week_number} onClick={() => setOpenWeek(w.week_number)}
                          style={{
                            border: `1px ${isWkHidden ? 'dashed' : 'solid'} ${isWkSelected ? V.accent : V.line}`,
                            borderRadius: 16, padding: '16px 18px', background: isWkSelected ? '#FFFFFF' : V.bg,
                            cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: isWkSelected ? '0 8px 24px rgba(0,0,0,0.06)' : 'none',
                            position: 'relative', display: 'flex', flexDirection: 'column', opacity: isWkHidden ? 0.65 : 1,
                          }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 26, height: 26, borderRadius: '50%',
                                background: isWkSelected ? V.accent : V.accentSoft,
                                color: isWkSelected ? '#fff' : V.accent,
                                fontSize: 11, fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: isWkSelected ? `0 0 0 3px ${V.accentSoft}` : 'none'
                              }}>
                                {w.week_number}
                              </div>
                              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: isWkSelected ? V.accent : V.muted }}>
                                WEEK {w.week_number} {isWkHidden && '(Hidden)'}
                              </span>
                            </div>
                            {isWkSelected ? (
                              <span style={{ fontSize: 10, fontWeight: 700, color: V.accent, background: V.accentSoft, padding: '2px 8px', borderRadius: 10 }}>
                                Selected
                              </span>
                            ) : editable && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); toggleSection(`week-${w.week_number}`) }}
                                title={isWkHidden ? `Unhide Week ${w.week_number}` : `Hide Week ${w.week_number}`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: isWkHidden ? V.accent : V.muted }}>
                                {isWkHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            )}
                          </div>

                          {editable ? (
                            <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, marginBottom: 10 }}>
                              <InlineEditableText editable value={w.focus_theme || ''} placeholder="Add a heading for this week" onSave={(next) => saveWeekTheme(w.week_number, next)}
                                style={{ fontSize: 13.5, fontWeight: 700, color: V.ink }} />
                            </div>
                          ) : (
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: V.ink, lineHeight: 1.4, marginBottom: 10, flex: 1 }}>
                              {w.focus_theme || `Week ${w.week_number} Goals`}
                            </div>
                          )}

                          {previewActions.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                              {previewActions.map((act, i) => (
                                <div key={i} style={{ fontSize: 11, color: V.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  • {act}
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ fontSize: 11.5, color: V.muted, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${V.line}` }}>
                            <span>{actionCount} daily targets</span>
                            <span style={{ fontWeight: 700, color: V.accent }}>{isWkSelected ? 'Viewing ↓' : 'View Plan →'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Days breakdown accordion for active month & week */}
              {months.map((m) => (
                <div key={m.monthNumber} data-month-body={m.monthNumber} style={{ marginTop: 24, display: activeMthNum === m.monthNumber ? 'block' : 'none', borderTop: `1px solid ${V.line}`, paddingTop: 20 }}>
                  {m.weeks.map((w) => (
                    <div key={w.week_number} data-week-body={w.week_number} style={{ display: activeWkNum === w.week_number ? 'block' : 'none' }}>
                    {(w.actions?.length ?? 0) > 0 && (
                      <div style={{ marginBottom: 22 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sun–Sat, this week&apos;s goals</span>
                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          {DAY_LABELS.map((day, dayIndex) => {
                            const dayId = `${w.week_number}-${day}`
                            const isDayOpen = openDay === dayId
                            const dayDate = dateForWeekDay(data.createdAt, w.week_number, dayIndex)
                            const actionsForDay = w.days?.[dayIndex] ?? w.actions ?? []
                            const doneCount = actionsForDay.filter((_, ai) => checkedSet.has(`${w.week_number}:${ai}:${dayDate}`)).length
                            return (
                              <button key={day} data-day-trigger={dayId} onClick={() => setOpenDay(isDayOpen ? null : dayId)}
                                style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${isDayOpen ? V.accent : V.line}`, background: isDayOpen ? V.accentSoft : '#fff', cursor: 'pointer', textAlign: 'center', minWidth: 66 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: V.muted }}>{day.slice(0, 3)}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: doneCount === actionsForDay.length && actionsForDay.length > 0 ? V.accent : V.ink, marginTop: 2 }}>{doneCount}/{actionsForDay.length}</div>
                              </button>
                            )
                          })}
                        </div>
                        {DAY_LABELS.map((day, dayIndex) => {
                          const dayId = `${w.week_number}-${day}`
                          const isDayOpen = openDay === dayId
                          const dayDate = dateForWeekDay(data.createdAt, w.week_number, dayIndex)
                          return (
                            <div key={day} data-day-body={dayId} style={{ display: isDayOpen ? 'block' : 'none', marginTop: 12, padding: '12px 14px', border: `1px solid ${V.line}`, borderRadius: 12 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{day}</div>
                              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                {(w.days?.[dayIndex] ?? w.actions ?? []).map((action, ai) => {
                                  const checked = checkedSet.has(`${w.week_number}:${ai}:${dayDate}`)
                                  return (
                                    <li key={ai} data-goal-toggle={`${w.week_number}:${ai}:${dayDate}`} onClick={() => { if (!editable) toggleGoal(w.week_number, ai, dayDate) }}
                                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: editable ? 'default' : 'pointer', marginBottom: 8 }}>
                                      {!editable && (checked ? <CheckCircle2 size={16} color={V.accent} style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={16} color={V.faint} style={{ flexShrink: 0, marginTop: 1 }} />)}
                                      {editable ? (
                                        <InlineEditableText editable value={action} onSave={(next) => saveScheduleAction(w.week_number, dayIndex, ai, next)}
                                          style={{ fontSize: 13, color: V.ink }} />
                                      ) : (
                                        <span data-goal-text style={{ fontSize: 13, color: checked ? V.muted : V.ink, textDecoration: checked ? 'line-through' : 'none' }}>{action}</span>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )
                        })}
                      </div>
                    )}

                  </div>
                ))}
              </div>
            ))}
          </Card>
        )
      })()}

        {/* Recipes — Breakfast / Lunch / Dinner / Snacks / Desserts, every
            distinct recipe used anywhere in the plan, deduped, grouped by
            meal type instead of by week. Nothing has to be picked under
            "Your Roadmap" for this to show something. */}
        {months.length > 0 && (() => {
          return (
            <Card id="recipes" hidden={isHidden('recipes')}>
              <Eyebrow>Picked for your plan</Eyebrow>
              <SecTitle icon={<ChefHat size={20} />}>Your recipes</SecTitle>
            {editable && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {roadmapId && (
                  <AiBulkRecipeEditButton
                    roadmapId={roadmapId}
                    onApply={(o) => {
                      setRecipeOverrides((prev) => {
                        const next = { ...prev, ...o }
                        patchRoadmap({ guide_overrides: { recipe_content_overrides: next } })
                        return next
                      })
                    }}
                  />
                )}
                <CombineRecipesButton
                  recipes={data.recipeBank}
                  recipeOverrides={recipeOverrides}
                  manualRecipes={data.manualRecipes}
                  weeklyManualRecipes={data.weeklyManualRecipes}
                  weekMealMatches={weekMealMatches}
                  onApply={(nextOverrides, nextManual, nextWeekly) => {
                    setRecipeOverrides(nextOverrides)
                    patchRoadmap({
                      guide_overrides: {
                        recipe_content_overrides: nextOverrides,
                        manual_recipes: nextManual,
                        weekly_manual_recipes: nextWeekly,
                      },
                    })
                  }}
                />
              </div>
            )}
              {(() => {
                const w = { week_number: 'all' as const }
                const weekSlotRecipes = recipesBySlotWithLink
                      return (
                        <div>
                          <div data-slot-list style={{ display: openSlot == null ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 10 }}>
                            {weekSlotRecipes.map(({ slot, matches }) => {
                              const slotId = `${w.week_number}-${slot}`
                              return (
                                <button key={slot} data-slot-trigger={slotId} onClick={() => setOpenSlot(slotId)}
                                  style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${V.line}`, background: '#fff' }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{SLOT_LABELS[slot]}</div>
                                  <div style={{ fontSize: 11, color: matches.length ? V.accent : V.faint, marginTop: 3, fontWeight: 700 }}>
                                    {matches.length ? `${matches.length} recipe${matches.length === 1 ? '' : 's'}` : `Not detected, ${coachFirst} will add some.`}
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
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: V.accent, fontSize: 12, fontWeight: 700, padding: 0, marginBottom: 10 }}>
                                  ← Back to meal slots
                                </button>
                                {matches.length > 0 ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                                    {matches.map(({ recipe }) => {
                                      const recipeKey = `${w.week_number}-${slot}-${recipe.id}`
                                      const recipeName = recipeOverrides[recipe.id]?.name ?? recipe.name
                                      return (
                                        <button key={recipeKey} data-recipe-trigger={recipeKey} onClick={() => setOpenRecipeId(openRecipeId === recipeKey ? null : recipeKey)}
                                          style={{ textAlign: 'left', padding: 0, cursor: 'pointer', background: openRecipeId === recipeKey ? V.accentSoft : '#fff', border: `1px solid ${openRecipeId === recipeKey ? V.accent : V.line}`, borderRadius: 12, overflow: 'hidden' }}>
                                          {recipe.image_url ? (
                                            <img src={recipe.image_url} alt={recipeName} loading="lazy" decoding="async" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                                          ) : (
                                            <div style={{ width: '100%', height: 90, background: V.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChefHat size={18} color={V.accent} /></div>
                                          )}
                                          <div style={{ padding: '8px 10px', fontSize: 12.5, fontWeight: 700 }}>{recipeName}</div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 12.5, color: V.muted }}>Nothing detected yet, {coachFirst} will add some.</div>
                                )}
                                {matches.map(({ recipe }) => {
                                  const recipeKey = `${w.week_number}-${slot}-${recipe.id}`
                                  const recipeName = recipeOverrides[recipe.id]?.name ?? recipe.name
                                  const facts: [string, string][] = [
                                    ...(recipe.prep_time ? [['Prep', recipe.prep_time] as [string, string]] : []),
                                    ...(recipe.cook_time ? [['Cook', recipe.cook_time] as [string, string]] : []),
                                    ...(recipe.eat_time ? [['Eat time', recipe.eat_time] as [string, string]] : []),
                                    ...(recipe.servings ? [['Servings', recipe.servings] as [string, string]] : []),
                                    ...(recipe.difficulty ? [['Difficulty', recipe.difficulty] as [string, string]] : []),
                                    ...(recipe.health_score ? [['Health score', recipe.health_score] as [string, string]] : []),
                                  ]
                                  const hasExtras = facts.length > 0 || !!(recipe.tools && recipe.tools.length) || !!(recipe.notes && recipe.notes.length) || !!(recipe.benefits && recipe.benefits.length)
                                  return (
                                    <div key={recipeKey} data-recipe-body={recipeKey} style={{ display: openRecipeId === recipeKey ? 'block' : 'none', marginTop: 12, background: '#fff', border: `1px solid ${V.line}`, borderRadius: 14, padding: '1.25rem', position: 'relative' }}>
                                      <button onClick={() => setOpenRecipeId(null)} data-no-export style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: V.muted }}><X size={16} /></button>
                                      <div style={{ display: 'grid', gridTemplateColumns: recipe.image_url ? '1fr 1.3fr' : '1fr', gap: 18 }}>
                                        {recipe.image_url && (
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <img src={recipe.image_url} alt={recipeName} loading="lazy" decoding="async" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', display: 'block', ...(hasExtras ? { maxHeight: 180 } : { flex: 1, minHeight: 220 }) }} />
                                            {facts.length > 0 && (
                                              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                                {facts.map(([label, value]) => (
                                                  <div key={label} style={{ border: `1px solid ${V.line}`, borderRadius: 10, padding: '7px 9px' }}>
                                                    <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: V.muted }}>{label}</div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: V.ink, marginTop: 2 }}>{value}</div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            {recipe.tools && recipe.tools.length > 0 && (
                                              <div style={{ marginTop: 12 }}>
                                                <span style={{ fontSize: 10.5, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tools</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                                                  {recipe.tools.map((t, i) => (
                                                    <span key={i} style={{ fontSize: 11.5, color: V.inkSoft, background: V.accentSoft, borderRadius: 20, padding: '3px 9px' }}>{t}</span>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {recipe.notes && recipe.notes.length > 0 && (
                                              <div style={{ marginTop: 12 }}>
                                                <span style={{ fontSize: 10.5, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</span>
                                                <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 4 }}>
                                                  {recipe.notes.map((n, i) => (
                                                    <li key={i} style={{ fontSize: 11.5, color: V.inkSoft, lineHeight: 1.5 }}>{n}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                            {recipe.benefits && recipe.benefits.length > 0 && (
                                              <div style={{ marginTop: 12 }}>
                                                <span style={{ fontSize: 10.5, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Why it works</span>
                                                <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 5 }}>
                                                  {recipe.benefits.map((b, i) => (
                                                    <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, color: V.inkSoft, lineHeight: 1.5 }}>
                                                      <span style={{ flexShrink: 0, width: 4, height: 4, borderRadius: '50%', background: V.accent, marginTop: 6 }} />
                                                      <span>{b}</span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        <div>
                                          <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>{recipeName}</h3>
                                          <span style={{ fontSize: 10.5, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ingredients</span>
                                          {editable ? (
                                            <textarea
                                              value={recipeOverrides[recipe.id]?.ingredients ?? recipe.ingredients}
                                              onChange={(e) => { const v = e.target.value; setRecipeOverrides((prev) => ({ ...prev, [recipe.id]: { ingredients: v, steps: prev[recipe.id]?.steps ?? recipe.steps } })) }}
                                              onBlur={() => setRecipeOverrides((prev) => { patchRoadmap({ guide_overrides: { recipe_content_overrides: prev } }); return prev })}
                                              rows={6} placeholder="One ingredient per line"
                                              style={{ width: '100%', boxSizing: 'border-box' as const, fontSize: 12.5, padding: '7px 9px', border: `1px solid ${V.line}`, borderRadius: 10, fontFamily: 'inherit', resize: 'vertical' as const, margin: '8px 0 14px', lineHeight: 1.5, color: V.ink }}
                                            />
                                          ) : (
                                            <RecipeIngredientsRenderer
                                              rawText={recipeOverrides[recipe.id]?.ingredients ?? recipe.ingredients}
                                              colors={{ accent: V.accent, text: V.inkSoft, accentSoft: V.accentSoft }}
                                            />
                                          )}
                                          <span style={{ fontSize: 10.5, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Directions</span>
                                          {editable ? (
                                            <textarea
                                              value={recipeOverrides[recipe.id]?.steps ?? recipe.steps}
                                              onChange={(e) => { const v = e.target.value; setRecipeOverrides((prev) => ({ ...prev, [recipe.id]: { ingredients: prev[recipe.id]?.ingredients ?? recipe.ingredients, steps: v } })) }}
                                              onBlur={() => setRecipeOverrides((prev) => { patchRoadmap({ guide_overrides: { recipe_content_overrides: prev } }); return prev })}
                                              rows={6} placeholder="One step per line"
                                              style={{ width: '100%', boxSizing: 'border-box' as const, fontSize: 12.5, padding: '7px 9px', border: `1px solid ${V.line}`, borderRadius: 10, fontFamily: 'inherit', resize: 'vertical' as const, margin: '8px 0 0', lineHeight: 1.5, color: V.ink }}
                                            />
                                          ) : (
                                            <RecipeDirectionsRenderer
                                              rawText={recipeOverrides[recipe.id]?.steps ?? recipe.steps}
                                              colors={{ accent: V.accent, text: V.inkSoft, accentSoft: V.accentSoft }}
                                            />
                                          )}
                                          {!recipe.image_url && recipe.benefits && recipe.benefits.length > 0 && (
                                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${V.line}` }}>
                                              <span style={{ fontSize: 10.5, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Why it works</span>
                                              <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 5 }}>
                                                {recipe.benefits.map((b, i) => (
                                                  <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: V.inkSoft, lineHeight: 1.5 }}>
                                                    <span style={{ flexShrink: 0, width: 4, height: 4, borderRadius: '50%', background: V.accent, marginTop: 6 }} />
                                                    <span>{b}</span>
                                                  </li>
                                                ))}
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
            </Card>
          )
        })()}

        {/* Supplements — same table every other template uses, grouped by
            time-of-day sub-headers so "when to take" is still at-a-glance,
            not just a column. Editable inline now (previously only on the
            Classic editor) — each row keeps its real index into
            supplementRows (not the per-bucket position) so an edit always
            updates the right entry, including when retyping "when to take"
            moves a row into a different bucket on the next render. Saved as
            guide_overrides.confirmed_supplements_override, which wins over
            the reports-derived list for this roadmap without touching the
            source report(s). */}
        {(editable || data.confirmedSupplements.length > 0) && (
          <Card id="supplements" hidden={isHidden('supplements')}>
            <Eyebrow>Confirmed by {coachFirst}</Eyebrow>
            <SecTitle icon={<Pill size={20} />}>Your supplement plan</SecTitle>
            <div style={{ overflowX: 'auto', marginTop: 18 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: V.muted, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th style={{ padding: '4px 10px 8px 0' }}>Supplement</th>
                    <th style={{ padding: '4px 10px 8px 0' }}>Dose</th>
                    <th style={{ padding: '4px 10px 8px 0' }}>When to take</th>
                    <th style={{ padding: '4px 0 8px 0' }}>Duration</th>
                    {editable && <th style={{ padding: '4px 0 8px 0' }} />}
                  </tr>
                </thead>
                <tbody>
                  {['Morning', 'Afternoon', 'Evening', 'Bedtime', 'As directed'].map((bucket) => {
                    const items = supplementRows.map((s, idx) => ({ ...s, idx })).filter((s) => bucketForTiming(s.timing) === bucket)
                    if (items.length === 0) return null
                    return (
                      <Fragment key={bucket}>
                        <tr>
                          <td colSpan={editable ? 5 : 4} style={{ padding: '12px 0 4px 0', fontSize: 10.5, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{bucket}</td>
                        </tr>
                        {items.map((s) => (
                          <Fragment key={s.idx}>
                            <tr style={{ borderTop: `1px solid ${V.line}` }}>
                              <td style={{ padding: '9px 10px 9px 0', fontWeight: 700 }}><InlineEditableText value={s.name} editable={!!editable} onSave={(v) => updateSupplementRow(s.idx, { name: v })} placeholder="Name" /></td>
                              <td style={{ padding: '9px 10px 9px 0', color: V.muted }}><InlineEditableText value={s.dose} editable={!!editable} onSave={(v) => updateSupplementRow(s.idx, { dose: v })} placeholder="Dose" /></td>
                              <td style={{ padding: '9px 10px 9px 0', color: V.muted }}><InlineEditableText value={s.timing} editable={!!editable} onSave={(v) => updateSupplementRow(s.idx, { timing: v })} placeholder="When to take" /></td>
                              <td style={{ padding: '9px 0', color: V.muted }}><InlineEditableText value={s.duration} editable={!!editable} onSave={(v) => updateSupplementRow(s.idx, { duration: v })} placeholder="Duration" /></td>
                              {editable && <td style={{ padding: '9px 0 9px 10px' }}><button type="button" onClick={() => removeSupplementRow(s.idx)} style={{ background: 'none', border: 'none', color: V.muted, cursor: 'pointer', padding: 0 }}><X size={14} /></button></td>}
                            </tr>
                            {(s.notes || editable) && (
                              <tr>
                                <td colSpan={editable ? 5 : 4} style={{ padding: '0 0 9px 0', color: V.warn, fontSize: 11.5 }}><AlertTriangle size={12} style={{ display: 'inline-block', verticalAlign: '-1px' }} />{' '}<InlineEditableText value={s.notes} editable={!!editable} onSave={(v) => updateSupplementRow(s.idx, { notes: v })} placeholder="Safety note / contraindication (optional)" style={{ color: V.warn }} /></td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {editable && (
              <button type="button" onClick={addSupplementRow} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, background: 'none', border: 'none', color: V.accent, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                <Plus size={13} /> Add supplement
              </button>
            )}
            <div style={{ fontSize: 11.5, color: V.muted, marginTop: 16 }}>Don&apos;t start, stop, or change a dose without confirming with {coachFirst} first.</div>
          </Card>
        )}

        {/* Shopping list */}
        <Card id="grocery" hidden={isHidden('grocery')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <Eyebrow>What to buy</Eyebrow>
              <SecTitle icon={<ShoppingCart size={20} />}>Your shopping list</SecTitle>
            </div>
            {editable && groceryOverride && (
              <button type="button" onClick={resetGroceryList}
                style={{ fontSize: 11.5, fontWeight: 700, padding: '7px 12px', borderRadius: 10, border: `1px solid ${V.line}`, background: V.bg, color: V.accent, cursor: 'pointer' }}>
                Reset to auto-generated list
              </button>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: V.muted, marginTop: 12, marginBottom: 16 }}>
            {editable ? 'Pulled from your matched recipes — edit any item, or add your own.' : 'Pulled straight from the ingredients of your matched recipes. Check items off as you shop.'}
          </p>
          {(() => {
            const allPlanRecipes = data.recipeBank.length > 0 ? data.recipeBank : []
            const cats = buildGroceryList(allPlanRecipes)
            const finalCats: GroceryCategory[] = groceryOverride ?? (cats.length > 0 ? cats : GROCERY_CATEGORIES)
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {finalCats.map((cat) => (
                  <div key={cat.head} style={{ background: V.card, borderRadius: 12, border: `1px solid ${V.line}`, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
                      {editable ? (
                        <InlineEditableText editable value={cat.head} onSave={(next) => saveGroceryCategoryName(finalCats, cat.head, next)}
                          style={{ fontSize: 11, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }} />
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: V.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cat.head}</span>
                      )}
                      {editable && (
                        <span role="button" onClick={() => removeGroceryCategory(finalCats, cat.head)} title="Remove category"
                          style={{ display: 'inline-flex', color: V.accent, opacity: 0.6, cursor: 'pointer', flexShrink: 0 }}><X size={12} /></span>
                      )}
                    </div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {cat.items.map((item, itemIndex) => {
                        const itemKey = `${cat.head}:${item}`
                        const bought = boughtItems.has(itemKey) || boughtItems.has(`1:${cat.head}:${item}`)
                        return (
                          <li key={itemIndex} data-grocery-item={itemKey} onClick={() => { if (!editable) toggleBought(itemKey) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, opacity: bought ? 0.45 : 1, padding: '4px 0', cursor: editable ? 'default' : 'pointer' }}>
                            {!editable && (
                              <>
                                <span data-grocery-icon-done style={{ display: bought ? 'inline-flex' : 'none', flexShrink: 0 }}><CheckCircle2 size={15} color={V.accent} /></span>
                                <span data-grocery-icon-undone style={{ display: bought ? 'none' : 'inline-flex', flexShrink: 0 }}><Circle size={15} color={V.faint} /></span>
                              </>
                            )}
                            {editable ? (
                              <>
                                <InlineEditableText editable value={item} onSave={(next) => saveGroceryItemText(finalCats, cat.head, itemIndex, next)}
                                  style={{ flex: 1 }} />
                                <span role="button" onClick={() => removeGroceryItem(finalCats, cat.head, itemIndex)} title="Remove"
                                  style={{ display: 'inline-flex', color: V.accent, opacity: 0.6, cursor: 'pointer', flexShrink: 0 }}><X size={12} /></span>
                              </>
                            ) : (
                              <span data-grocery-item-text style={{ textDecoration: bought ? 'line-through' : 'none' }}>{item}</span>
                            )}
                          </li>
                        )
                      })}
                      {editable && (
                        <li>
                          <button type="button" onClick={() => addGroceryItem(finalCats, cat.head)}
                            style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: 0, border: 'none', background: 'none', color: V.accent, cursor: 'pointer', opacity: 0.8 }}>
                            + Add item
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
                {editable && (
                  <button type="button" onClick={() => addGroceryCategory(finalCats)}
                    style={{ alignSelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '10px 16px', borderRadius: 10, border: `1px dashed ${V.line}`, background: 'none', color: V.accent, cursor: 'pointer' }}>
                    + Add category
                  </button>
                )}
              </div>
            )
          })()}
        </Card>

        {/* Services */}
        {data.careServices.some(isVisibleCareService) && (
          <Card id="services" hidden={isHidden('services')}>
            <Eyebrow>Your plan</Eyebrow>
            <SecTitle icon={<Star size={20} />}>What&apos;s included in your care</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 16 }}>
              {data.careServices.map((svc, i) => {
                if (!isVisibleCareService(svc)) return null
                const Icon = CARE_ICON_MAP[svc.icon] || Star
                const isOpen = openService === i
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button data-care-trigger={i} onClick={() => setOpenService(isOpen ? null : i)}
                      style={{ flex: 1, textAlign: 'left', padding: '14px 12px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${isOpen ? V.accent : V.line}`, background: isOpen ? V.accentSoft : '#fff' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: V.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <Icon size={16} color="#fff" />
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{svc.name}</div>
                      {svc.sessions && <div style={{ fontSize: 11, color: V.muted, marginTop: 2 }}>{svc.sessions}</div>}
                    </button>
                    <CareServiceLinkButton link={svc.link} label={svc.linkLabel} accent={V.accent} />
                  </div>
                )
              })}
            </div>
            {data.careServices.map((svc, i) => svc.description && (
              <div key={i} data-care-body={i} style={{ display: openService === i ? 'block' : 'none', marginTop: 12, padding: '14px 16px', borderRadius: 10, border: `1px solid ${V.line}` }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{svc.name}</div>
                <p style={{ fontSize: 12.5, lineHeight: 1.55, margin: 0 }}>{renderMarkdownBold(svc.description || '')}</p>
              </div>
            ))}
          </Card>
        )}

        {/* Track your progress — stat dashboard + the same wheel again, at a glance */}
        <Card id="track" hidden={isHidden('track')}>
          <Eyebrow>Real numbers, not a guess</Eyebrow>
          <SecTitle icon={<Activity size={20} />}>Track your progress</SecTitle>
          <p data-track-empty style={{ fontSize: 12.5, color: V.muted, marginTop: 12, display: progress.totalDaysLogged === 0 ? 'block' : 'none' }}>No check-ins logged yet, tap a goal in your roadmap above each day you complete it, and your progress will show up here.</p>
          <div data-track-content style={{ display: progress.totalDaysLogged === 0 ? 'none' : 'block' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 16, marginBottom: 20 }}>
              {[
                { key: 'streak', icon: Flame, value: progress.streak, label: 'day streak' },
                { key: 'days', icon: CalendarCheck, value: progress.totalDaysLogged, label: 'days logged' },
                { key: 'goals', icon: Target, value: `${goalsDone}/${totalActionsInPlan}`, label: 'goals done' },
                { key: 'best', icon: Award, value: progress.bestMonth ? `${progress.bestMonth.pct}%` : '0%', label: progress.bestMonth ? `best · ${progress.bestMonth.monthLabel}` : 'best month' },
              ].map((s) => (
                <div key={s.key} style={{ padding: '14px', borderRadius: 12, border: `1px solid ${V.line}`, background: V.accentSoft }}>
                  <s.icon size={16} color={V.accent} />
                  <div data-stat={s.key} style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>{s.value}</div>
                  <div data-stat-label={s.key} style={{ fontSize: 11, color: V.muted, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
              <Wheel segments={wheelSegments} size={170} thickness={13} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 200px' }}>
                {progress.monthStats.map((m, i) => (
                  <div key={m.monthNumber} data-stat-pct={m.monthNumber} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: WHEEL_COLORS[i % WHEEL_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{m.monthLabel}</span>
                    <span data-stat-sub={m.monthNumber} style={{ fontSize: 11.5, color: V.muted }}>{m.doneActions}/{m.totalActions}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: V.accent, width: 40, textAlign: 'right' }}>{m.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* When to reach us */}
        <Card id="reach" hidden={isHidden('reach')}>
          <Eyebrow>Reach us</Eyebrow>
          <SecTitle icon={<Phone size={20} />}>When to reach us</SecTitle>
          {editable ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 14, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: V.muted, marginBottom: 4 }}>Phone</div>
                <input value={reachInfo.phone} onChange={(e) => setReachInfo({ ...reachInfo, phone: e.target.value })} onBlur={() => saveReachInfo(reachInfo)}
                  placeholder="Add a phone number" style={{ width: '100%', background: V.card, border: `1px solid ${V.line}`, borderRadius: 10, padding: '6px 9px', fontSize: 13, color: V.ink, boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: V.muted, marginBottom: 4 }}>Work hours</div>
                <input value={reachInfo.hours} onChange={(e) => setReachInfo({ ...reachInfo, hours: e.target.value })} onBlur={() => saveReachInfo(reachInfo)}
                  placeholder="e.g. Mon-Sat, 9am-6pm" style={{ width: '100%', background: V.card, border: `1px solid ${V.line}`, borderRadius: 10, padding: '6px 9px', fontSize: 13, color: V.ink, boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: V.muted, marginBottom: 4 }}>Front desk contact</div>
                <input value={reachInfo.frontDesk} onChange={(e) => setReachInfo({ ...reachInfo, frontDesk: e.target.value })} onBlur={() => saveReachInfo(reachInfo)}
                  placeholder="e.g. phone or email" style={{ width: '100%', background: V.card, border: `1px solid ${V.line}`, borderRadius: 10, padding: '6px 9px', fontSize: 13, color: V.ink, boxSizing: 'border-box' }} />
              </div>
            </div>
          ) : (reachInfo.phone || reachInfo.hours) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14, marginBottom: 2, fontSize: 13, color: V.inkSoft }}>
              {reachInfo.phone && <span><Phone size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{reachInfo.phone}</span>}
              {reachInfo.hours && <span><Clock size={12} style={{ verticalAlign: -2, marginRight: 5 }} />{reachInfo.hours}</span>}
            </div>
          )}
          {data.nextAppointment.date && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: V.accent, fontWeight: 700, fontSize: 13, marginTop: 14, marginBottom: 4 }}>
              <CalendarCheck size={15} />
              {new Date(data.nextAppointment.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {data.nextAppointment.time && ` · ${new Date(`2000-01-01T${data.nextAppointment.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
              {data.nextAppointment.mode && ` · ${data.nextAppointment.mode}`}
            </div>
          )}
          <p style={{ fontSize: 13, color: V.inkSoft, lineHeight: 1.6, marginTop: 14, marginBottom: 4 }}>Have a question? Contact front desk{reachInfo.frontDesk ? ` at ${reachInfo.frontDesk}` : ''} first.</p>
          <p style={{ fontSize: 13, color: V.inkSoft, lineHeight: 1.6 }}><strong>Emergency?</strong> Consult a physician nearby.</p>
          {data.coach?.email && <p style={{ fontSize: 12.5, color: V.accent, marginTop: 8 }}>Message {coachFirst} directly at {data.coach.email}.</p>}
        </Card>

        {/* FAQ */}
        <Card id="faq" hidden={isHidden('faq')}>
          <Eyebrow>Questions we hear most</Eyebrow>
          <SecTitle icon={<HelpCircle size={20} />}>FAQ</SecTitle>
          <div style={{ marginTop: 12 }}>
            {[
              ['What if I can’t finish everything on my plate exactly as shown?', 'Getting the food groups roughly right matters far more than hitting exact portions.'],
              ['What if I miss a few days on my habit tracker?', 'Log what actually happened, not what you wish had happened.'],
              ['Can I eat something that’s not on the lists?', 'Yes, the lists are what to lean on, not a ban on everything else. Ask your coach if unsure.'],
            ].map(([q, a], i) => {
              const isOpen = openFaq === i
              return (
                <div key={i} style={{ borderBottom: i < 2 ? `1px solid ${V.line}` : 'none' }}>
                  <button data-faq-trigger={i} onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{q}</span>
                    {isOpen ? <ChevronDown size={15} color={V.accent} /> : <ChevronRight size={15} color={V.faint} />}
                  </button>
                  <div data-faq-body={i} style={{ display: isOpen ? 'block' : 'none', color: V.muted, fontSize: 12.5, paddingBottom: 14 }}>{a}</div>
                </div>
              )
            })}
          </div>
        </Card>
        <CanvasBlocksSection blocks={data.canvasBlocks} recipesById={Object.fromEntries(data.recipeBank.map((r) => [r.id, r]))} imagesById={Object.fromEntries(data.imageBank.map((im) => [im.id, im]))} theme={toBlockTheme(V)} />
        {/* Footer — belongs at the true end of the page, after custom
            blocks (not before them, which put it in the middle when a
            roadmap has any). */}
        <div style={{ color: V.faint, fontSize: 11, marginTop: 28, textAlign: 'center' }}>Living Plus Pvt Ltd™</div>
      </div>
    </div>
  )
}
