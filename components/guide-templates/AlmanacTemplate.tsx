'use client'

// An alternate, read-only patient-facing presentation of the exact same
// GuideData the Classic template (DashboardClient.tsx) uses — same real
// data, different visual language (inspired by a reference design the
// coach liked: warm paper/gold/dusk color bands, Fraunces/Work
// Sans/IBM Plex Mono typography, scroll-reveal). A coach always edits
// content in the Classic editor regardless of which template is picked;
// this component never runs in editable mode.
//
// The reference design's centerpiece was a literal minute-by-minute daily
// schedule wheel — this app doesn't collect timestamped schedules, and
// inventing one would violate the "never fabricate" rule that's shaped
// every other feature in this app. In its place: a tree that grows through
// real stages as the patient's actual tracked adherence (goalsDone /
// totalActionsInPlan, the same number "Track your progress" already shows)
// increases — a meaningful visual grounded in real data instead.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  HeartPulse, Utensils, Pill, Phone, CalendarCheck, HelpCircle, ChefHat, MapPin, ChevronDown, ChevronRight, X, Download,
  CheckCircle2, Circle, Sparkles, Star, ShoppingCart, Video, MessageCircle, Activity, Stethoscope, Users, Target, TrendingUp,
  Moon, Droplet, Brain, Sun, Footprints, Smartphone, Link as LinkIcon, Flame,
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
import { splitIntoPeriods, joinPeriods, parseScheduleLines } from '@/lib/periodBullets'
import { type ChecklistItem } from '@/lib/dailyChecklist'
import InlineEditableText from '@/components/InlineEditableText'

const LIFESTYLE_PERIODS = ['Morning', 'Afternoon', 'Evening']
const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner']

const DAY_MEAL_SLOTS: DayMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']
const SLOT_LABELS: Record<DayMealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks', dessert: 'Desserts' }
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Same icon set as the Classic editor's care-service picker (src/app/dashboard/[shareToken]/DashboardClient.tsx)
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

type Checkin = { week_number: number; action_index: number | null; checkin_date: string; item_id?: string | null; item_text_snapshot?: string | null }

function parseBullets(text: string): string[] {
  return (text || '')
    .split(/\n|(?=•)/)
    .map((s) => s.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean)
}

// A guideline bullet is often "Category: detail" (e.g. "Fasting window: 12-14
// hour overnight fast") — splits it into a key/value chip when that shape is
// present, otherwise just shows the whole line as the value.
function splitKV(bullet: string): { k: string | null; v: string } {
  const m = bullet.match(/^([^:]{2,30}):\s*(.+)$/)
  return m ? { k: m[1].trim(), v: m[2].trim() } : { k: null, v: bullet }
}

// Purely decorative categorization (never changes what the guideline says,
// just picks a matching icon by keyword) — first match wins, so order goes
// roughly specific-to-generic. A guideline that matches nothing still shows
// fine with the HeartPulse fallback, same icon the section header already uses.
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

const PALETTE = {
  paper1: '#F7EFE0', paper2: '#F2E6CE', paper3: '#EAD9B4',
  gold1: '#E0C384', gold2: '#C9A24E',
  dusk1: '#8C5B45', dusk2: '#6E4740',
  night1: '#3E4436', night2: '#2B2F26', night3: '#211F19',
  ink: '#2B2A22', cream: '#F3ECDA', goldAccent: '#C89B3C', berry: '#7A3346',
  line: 'rgba(43,42,34,0.18)',
}

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,600;1,9..144,500&family=Work+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'

const TOC_ITEMS: { label: string; id: string }[] = [
  { label: 'Daily health check-in', id: 'checkin' },
  { label: 'Founder’s note', id: 'founder' },
  { label: 'Meet your coach', id: 'coach' },
  { label: 'Your care team', id: 'careteam' },
  { label: 'How to use this guide', id: 'howto' },
  { label: 'Your why', id: 'howto' },
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

function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.65, color: dark ? PALETTE.cream : PALETTE.ink, display: 'block', marginBottom: 12 }}>
      {children}
    </span>
  )
}

function SecTitle({ icon, children, dark }: { icon: React.ReactNode; children: React.ReactNode; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <span style={{ color: dark ? PALETTE.cream : PALETTE.ink, opacity: 0.85 }}>{icon}</span>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 'clamp(1.6rem,3.6vw,2.2rem)', margin: 0, color: dark ? PALETTE.cream : PALETTE.ink }}>{children}</h2>
    </div>
  )
}

function KVGrid({ items, dark, showIcons }: { items: string[]; dark?: boolean; showIcons?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: showIcons ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 24 }}>
      {items.map((bullet, i) => {
        const { k, v } = splitKV(bullet)
        const Icon = showIcons ? iconForBullet(bullet) : null
        return (
          <div key={i} style={{
            border: `1px solid ${dark ? 'rgba(243,236,218,0.22)' : PALETTE.line}`, borderRadius: 10, padding: '14px 16px',
            background: dark ? 'rgba(243,236,218,0.06)' : 'rgba(255,255,255,0.35)',
            display: 'flex', gap: Icon ? 14 : 0, alignItems: 'center',
          }}>
            {Icon && (
              <div style={{ width: 34, height: 34, borderRadius: 9, background: dark ? 'rgba(243,236,218,0.12)' : 'rgba(122,51,70,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={dark ? PALETTE.cream : PALETTE.berry} />
              </div>
            )}
            <div>
              {k && <span style={{ display: 'block', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4, color: dark ? PALETTE.cream : PALETTE.ink }}>{k}</span>}
              <span style={{ fontSize: '0.95rem', lineHeight: 1.5, color: dark ? PALETTE.cream : PALETTE.ink }}>{renderMarkdownBold(v)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Text-only staging for the caption under the mascot ("First sprout",
// "In full bloom" etc.) — kept separate from the visual, which now grows
// continuously with real adherence (pct, 0-100) rather than snapping
// between discrete stages.
function stageForPct(pct: number): number {
  return pct >= 85 ? 4 : pct >= 60 ? 3 : pct >= 35 ? 2 : pct >= 10 ? 1 : 0
}
const GROWTH_LABELS = ['Just planted', 'First sprout', 'Taking root', 'Growing strong', 'In full bloom']

// A companion mascot (bobs continuously, cheers when a goal is freshly
// checked) beside a plant that grows continuously with real tracked
// adherence (pct, 0-100 — the same number "Track your progress" shows) —
// replaces the reference design's fabricated schedule wheel with something
// grounded in real data and alive to interact with. Stem/leaves/flower
// reveal via stroke-dashoffset and opacity/transform transitions driven
// directly by pct, so the SAME markup works unanimated on first paint,
// live-animated in the browser, and re-driven by plain JS after every
// offline check-in in the downloaded file — no discrete stages to
// pre-render, just one continuous value the transitions follow.
const STEM_LEN = 70
function GrowthMascot({ pct, cheering }: { pct: number; cheering: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const stemOffset = STEM_LEN - (STEM_LEN * clamped) / 100
  const leaf1On = clamped >= 20
  const leaf2On = clamped >= 50
  const flowerOn = clamped >= 85
  const mouthD = clamped >= 85 ? 'M45 65 Q56 76 67 65' : clamped > 0 ? 'M46 67 Q56 73 66 67' : 'M46 66 Q56 72 66 66'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
      <svg data-mascot-idle width="100" height="90" viewBox="0 0 112 100"
        style={{ animation: cheering ? 'clpMascotCheer 0.7s ease' : 'clpMascotBob 3.2s ease-in-out infinite', transformOrigin: '56px 90px' }}>
        <path d="M20 62 Q18 40 40 32 Q56 26 74 34 Q94 42 92 62" fill="none" stroke={PALETTE.berry} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M18 62 Q56 78 94 62 Q90 84 56 86 Q22 84 18 62 Z" fill={PALETTE.gold2} stroke={PALETTE.berry} strokeWidth="2.2" />
        <g data-mascot-eyes style={{ transformOrigin: '56px 58px', animation: 'clpMascotBlink 5.4s ease-in-out infinite' }}>
          <circle cx="44" cy="58" r="3" fill={PALETTE.ink} />
          <circle cx="68" cy="58" r="3" fill={PALETTE.ink} />
        </g>
        <path data-mascot-mouth d={mouthD} fill="none" stroke={PALETTE.ink} strokeWidth="2" strokeLinecap="round" style={{ transition: 'd 0.3s ease' }} />
        <path d="M40 30 Q38 18 30 12" fill="none" stroke={PALETTE.dusk1} strokeWidth="2" strokeLinecap="round" />
        <path d="M30 12 Q26 8 30 4 Q34 8 30 12" fill={PALETTE.dusk1} />
        <path d="M76 30 Q80 16 90 10" fill="none" stroke={PALETTE.dusk1} strokeWidth="2" strokeLinecap="round" />
        <path d="M90 10 Q86 6 90 2 Q94 6 90 10" fill={PALETTE.dusk1} />
      </svg>
      <svg width="90" height="80" viewBox="0 0 112 96">
        <line x1="20" y1="90" x2="92" y2="90" stroke={PALETTE.line} strokeWidth="3" strokeLinecap="round" />
        <path data-plant-stem d="M56 90 L56 20" stroke={PALETTE.dusk1} strokeWidth="3" fill="none" strokeLinecap="round"
          strokeDasharray={STEM_LEN} style={{ strokeDashoffset: stemOffset, transition: 'stroke-dashoffset 0.6s cubic-bezier(.2,.8,.3,1)' }} />
        <path data-plant-leaf1 d="M56 60 Q40 56 38 42 Q54 44 56 60 Z" fill={PALETTE.gold1}
          style={{ opacity: leaf1On ? 1 : 0, transform: leaf1On ? 'scale(1)' : 'scale(0.4)', transformOrigin: '47px 51px', transition: 'opacity 0.4s ease, transform 0.4s ease' }} />
        <path data-plant-leaf2 d="M56 46 Q72 42 74 28 Q58 30 56 46 Z" fill={PALETTE.gold1}
          style={{ opacity: leaf2On ? 1 : 0, transform: leaf2On ? 'scale(1)' : 'scale(0.4)', transformOrigin: '65px 37px', transition: 'opacity 0.4s ease, transform 0.4s ease' }} />
        <g data-plant-flower style={{ opacity: flowerOn ? 1 : 0, transform: flowerOn ? 'scale(1)' : 'scale(0.3)', transformOrigin: '56px 22px', transition: 'opacity 0.4s ease 0.1s, transform 0.45s cubic-bezier(.2,.9,.3,1.4) 0.1s' }}>
          <path d="M56 12 Q64 6 66 -2 Q56 -4 52 6 Q50 -2 40 0 Q42 8 52 12 Q42 14 40 22 Q50 22 56 14 Q58 22 68 22 Q68 12 56 12 Z" transform="translate(0,10)" fill={PALETTE.berry} />
          <circle cx="56" cy="22" r="4" fill={PALETTE.goldAccent} />
        </g>
      </svg>
    </div>
  )
}

// Same "just did something good" pop as the mascot cheer, reused for the
// streak flame in Track Your Progress — lights up (gray to gold) once the
// streak is real, no fabricated fire before there's an actual streak.
function StreakFlame({ lit, pop }: { lit: boolean; pop: boolean }) {
  return (
    <svg data-streak-flame width="14" height="14" viewBox="0 0 24 24" style={{ animation: pop ? 'clpFlamePop 0.5s ease' : undefined }}>
      <path data-on-color={PALETTE.goldAccent} data-off-color="rgba(43,42,34,0.25)" d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"
        fill={lit ? PALETTE.goldAccent : 'rgba(43,42,34,0.25)'} style={{ transition: 'fill 0.3s ease' }} />
    </svg>
  )
}

export default function AlmanacTemplate({ shareToken, data, initialCheckins, editable = false, roadmapId }: {
  shareToken: string
  data: GuideData
  initialCheckins: Checkin[]
  // Inline coach editing — see components/InlineEditableText.tsx and
  // WeekTemplate.tsx (the reference implementation). Defaults to false and
  // is never passed by the public /share/roadmap/<token> page or the
  // read-only archived-version viewer, only by the authenticated coach
  // route that opts into it explicitly.
  editable?: boolean
  roadmapId?: string
}) {
  const firstName = data.patient.full_name?.split(' ')[0] || 'there'
  const coachFirst = data.coach?.full_name?.split(' ')[0] || 'your coach'
  // A coach's hide/show choice is made in the Classic editor and just a
  // saved fact here, same as before — unaffected by `editable`.
  const hiddenStyle = (id: string): CSSProperties => ((data.hiddenSections ?? []).includes(id) ? { display: 'none' } : {})
  const isHidden = (id: string) => (data.hiddenSections ?? []).includes(id)
  const parsed = useMemo(() => parseNutritionistGuidelines(data.roadmap.nutritionist_guidelines), [data.roadmap.nutritionist_guidelines])

  // Best-effort, fire-and-forget — same helper and tolerance as
  // WeekTemplate.tsx: local state below already reflects the edit
  // optimistically, so a failed PATCH is never worse than a missed autosave.
  function patchRoadmap(body: Record<string, unknown>) {
    if (!roadmapId) return
    fetch(`/api/compass/roadmaps/${roadmapId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => {})
  }

  // "Your roadmap" is normally derived straight from data.roadmap.weekly_schedule
  // (read-only). In editable mode it instead derives from a local, patchable
  // copy so a coach's edits show up immediately without a reload, same
  // "override state seeded from the real data" pattern as everything else
  // below.
  const [weeklySchedule, setWeeklySchedule] = useState(data.roadmap.weekly_schedule ?? [])
  const months = useMemo(() => reshapeRoadmapIntoMonths(weeklySchedule).filter((m) => m.planned), [weeklySchedule])
  function saveRoadmapAction(weekNumber: number, dayIndex: number, actionIndex: number, next: string) {
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

  // Same real, tappable goal check-off as Classic — striking a goal here
  // persists to the same checkins table, so "Track your progress" and the
  // tree above update immediately, live, not just on the next page load.
  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins)

  // Matched once at the same limit (5) Classic uses, so both templates rank
  // recipes identically — this is the real per-week curated data (a coach's
  // explicit picks win; otherwise the same auto-match Classic falls back to)
  // via the shared helper in src/lib/pdf/weekRecipes.ts, not a separate
  // flat/generic list.
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

  // Same real check-in-derived stats "Track your progress" shows in
  // Classic (src/app/dashboard/[shareToken]/DashboardClient.tsx) — never a
  // placeholder number.
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
  // shows (never recomputed separately) — the mascot/plant's growth stage
  // and the "goals accomplished" stat can never silently disagree with it.
  const totalActionsInPlan = progress.monthStats.reduce((n, m) => n + m.totalActions, 0)
  const goalsDone = progress.monthStats.reduce((n, m) => n + m.doneActions, 0)
  const adherencePct = totalActionsInPlan > 0 ? Math.round((goalsDone / totalActionsInPlan) * 100) : 0

  const checkedSet = useMemo(() => new Set(checkins.map((c) => (c.item_id ? `0:item:${c.item_id}:${c.checkin_date}` : `${c.week_number}:${c.action_index}:${c.checkin_date}`))), [checkins])

  // Local editable copy, same override pattern as lifestyle/meal/schedule —
  // stable `id`s mean editing wording or adding/removing items never
  // reattaches a patient's historical checkmark to a different item.
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(data.dailyChecklistItems || [])
  const [regenerating, setRegenerating] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
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

  // Local editable copies, seeded once from the real data — same
  // per-period split/join round trip WeekTemplate/DashboardClient use, so
  // every editor always serializes back to the identical "Label: text"
  // storage format.
  const [lifestyleByPeriod, setLifestyleByPeriod] = useState<Record<string, string>>(() => splitIntoPeriods(data.dailyLifestyleGuidelines, LIFESTYLE_PERIODS))
  const [mealsByPeriod, setMealsByPeriod] = useState<Record<string, string>>(() => splitIntoPeriods(data.mealGuidelines, MEAL_PERIODS))
  function saveLifestyleItem(label: string, itemIndex: number, next: string) {
    setLifestyleByPeriod((prev) => {
      const items = parseBullets(prev[label] || '')
      items[itemIndex] = next
      const updated = { ...prev, [label]: items.join('\n') }
      patchRoadmap({ guide_overrides: { daily_lifestyle_guidelines: joinPeriods(updated, LIFESTYLE_PERIODS) } })
      return updated
    })
  }
  function saveMealItem(label: string, itemIndex: number, next: string) {
    setMealsByPeriod((prev) => {
      const items = parseBullets(prev[label] || '')
      items[itemIndex] = next
      const updated = { ...prev, [label]: items.join('\n') }
      patchRoadmap({ guide_overrides: { meal_guidelines: joinPeriods(updated, MEAL_PERIODS) } })
      return updated
    })
  }

  // Flat ordered list, same as WeekTemplate — each entry is edited as two
  // separate single-line fields (time/text), never a <textarea>, so a stray
  // Enter can't insert a real newline into what MUST stay one storage line
  // (parseScheduleLines splits on \n).
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

  // Brief mascot cheer + flame pop when a goal is freshly checked (not on
  // uncheck) — purely a feel-good pulse, never fabricates progress; the
  // underlying pct/streak numbers driving the mascot/plant/flame are the
  // exact same real ones "Track your progress" shows.
  const [cheering, setCheering] = useState(false)
  const cheerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Same optimistic-update-with-revert pattern as Classic's toggle() —
  // persists to the same /checkins endpoint, so ticking a goal here shows
  // up identically if the coach or patient later opens the Classic template.
  // `date` is the specific day-tab's own real calendar date (see
  // dateForWeekDay above), not always today — each day tracks independently.
  async function toggleGoal(weekNumber: number, actionIndex: number, date: string) {
    const key = `${weekNumber}:${actionIndex}:${date}`
    const wasChecked = checkedSet.has(key)
    if (!wasChecked) {
      setCheering(true)
      if (cheerTimeoutRef.current) clearTimeout(cheerTimeoutRef.current)
      cheerTimeoutRef.current = setTimeout(() => setCheering(false), 700)
    }
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

  // Shopping list — same per-week, recipe-derived, categorized ingredients
  // as Classic (src/lib/groceryList.ts), expanding inline instead of a popup.
  const [openGroceryMonth, setOpenGroceryMonth] = useState<number | null>(null)
  const [openGroceryWeek, setOpenGroceryWeek] = useState<number | null>(null)
  const [aiGroceryCache, setAiGroceryCache] = useState<Record<number, GroceryCategory[]>>({})

  // Shopping list override — null means "keep computing it live per week"
  // (see finalCats below); once a coach edits anything, the whole list
  // becomes their own persisted content, same "override wins" pattern as
  // WeekTemplate. Note this preserves an existing quirk: one override list
  // is shown for every week, not a per-week override — unchanged from the
  // read-only behavior this replaces.
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

  // "Bought" checklist — same personal, never-synced-to-the-server
  // localStorage checklist as Classic, under the SAME storage key
  // (clp-grocery-${shareToken}) and the same item-key format, so checking
  // something off here shows checked in Classic too, and vice versa.
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
    if (openGroceryWeek == null || groceryOverride || aiGroceryCache[openGroceryWeek]) return
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
  }, [openGroceryWeek, groceryOverride, aiGroceryCache, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank])

  // What's included in your care — same coach-entered tiles as Classic,
  // editable via a local copy patched to guide_overrides.care_services
  // (same override key DashboardClient's "Save changes" writes).
  const [openService, setOpenService] = useState<number | null>(null)
  const [careServices, setCareServices] = useState(data.careServices || [])
  function saveCareServices(next: typeof careServices) {
    setCareServices(next)
    patchRoadmap({ guide_overrides: { care_services: next } })
  }

  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [founderOpen, setFounderOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)

  // Founder's note / coach's quote / your why — same
  // guide_overrides.founder_note / coach_quote / why_reflection keys
  // DashboardClient's "Save changes" writes, just autosaved per-field here
  // like every other editable field in this file.
  const [founderNote, setFounderNote] = useState(data.founderNote)
  function saveFounderNote(next: string) {
    setFounderNote(next)
    patchRoadmap({ guide_overrides: { founder_note: next } })
  }
  const [coachQuote, setCoachQuote] = useState(data.coachQuote)
  function saveCoachQuote(next: string) {
    setCoachQuote(next)
    patchRoadmap({ guide_overrides: { coach_quote: next } })
  }
  const [whyReflection, setWhyReflection] = useState(data.whyReflection)
  function saveWhyReflection(next: string) {
    setWhyReflection(next)
    patchRoadmap({ guide_overrides: { why_reflection: next } })
  }

  // Care team — guide_overrides.care_team, same shape as DashboardClient's
  // AiEditButton "care_team_member" editor, just field-by-field here.
  const [careTeam, setCareTeam] = useState(data.careTeam || [])
  function saveCareTeam(next: typeof careTeam) {
    setCareTeam(next)
    patchRoadmap({ guide_overrides: { care_team: next } })
  }
  function addCareTeamMember() {
    saveCareTeam([...careTeam, { name: '', role: '', intro: '', date: '', time: '', mode: '' }])
  }
  function removeCareTeamMember(i: number) {
    saveCareTeam(careTeam.filter((_, idx) => idx !== i))
  }

  // Power points — guide_overrides.power_points.
  const [powerPoints, setPowerPoints] = useState(data.powerPoints || [])
  function savePowerPoints(next: typeof powerPoints) {
    setPowerPoints(next)
    patchRoadmap({ guide_overrides: { power_points: next } })
  }
  function addPowerPoint() {
    savePowerPoints([...powerPoints, { url: '', note: '' }])
  }
  function removePowerPoint(i: number) {
    savePowerPoints(powerPoints.filter((_, idx) => idx !== i))
  }

  // Same "no real match beats a fabricated one" tag-matched photo as Classic
  // — a plain icon tile shows instead if nothing in the picture bank fits.
  const whyImage = useMemo(() => {
    return matchGuideImageDistinct('motivation why reflection goal mindset determination doodle illustration', data.imageBank, new Set())
  }, [data.imageBank])

  // Downloads exactly what's rendered — every collapsible block in this
  // template is always mounted (just `display:none` when closed, never
  // conditionally unmounted) specifically so a DOM clone captures the whole
  // plan regardless of what happened to be open at download time, then a
  // shared vanilla-JS "offline brain" (src/lib/pdf/inlineExportScript.ts,
  // same one Pulse uses) makes month/week/recipe/grocery/goal toggles work
  // with zero network calls once opened as a local file.
  function downloadDashboard() {
    const root = document.getElementById('almanac-export-root')
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
      colors: { ink: PALETTE.ink, inkSoft: PALETTE.ink, muted: 'rgba(43,42,34,0.55)', accent: PALETTE.berry, accentSoft: 'rgba(122,51,70,0.08)', border: PALETTE.line, onAccent: '#fff' },
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
    <div id="almanac-export-root" style={{ background: PALETTE.paper1, minHeight: '100vh', fontFamily: "'Work Sans', sans-serif", color: PALETTE.ink, WebkitFontSmoothing: 'antialiased' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={FONT_LINK} rel="stylesheet" />
      <a href={`/roadmaps/${shareToken}/edit`} data-no-export style={{ display: 'none' }} />
      <style>{`
        @keyframes clpMascotBob { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-4px) rotate(-1.5deg); } }
        @keyframes clpMascotCheer { 0% { transform: translateY(0) scale(1) rotate(0deg); } 30% { transform: translateY(-14px) scale(1.08) rotate(-4deg); } 55% { transform: translateY(-6px) scale(1.04) rotate(3deg); } 100% { transform: translateY(0) scale(1) rotate(0deg); } }
        @keyframes clpFlamePop { 0% { transform: scale(1); } 40% { transform: scale(1.22) rotate(-4deg); } 100% { transform: scale(1) rotate(0deg); } }
        @keyframes clpMascotBlink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.12); } }
        @media (prefers-reduced-motion: reduce) { [data-mascot-idle], [data-mascot-face], [data-mascot-eyes], [data-streak-flame] { animation: none !important; } }
      `}</style>

      {/* Jump-to-section — a single dropdown rather than a row of links, so
          it never overflows or shows a scrollbar regardless of section
          count. Restored offline via data-toc-trigger/data-toc-panel. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(247,239,224,0.92)', backdropFilter: 'blur(6px)', borderBottom: `1px solid ${PALETTE.line}`, padding: '10px 1.5rem' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', position: 'relative' }}>
          <button data-toc-trigger onClick={() => setTocOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, fontWeight: 600, color: PALETTE.ink, background: PALETTE.gold1, border: `1px solid ${PALETTE.line}`, borderRadius: 20, padding: '7px 14px', cursor: 'pointer' }}>
            Jump to section <ChevronDown size={13} style={{ transform: tocOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          <div data-toc-panel style={{ display: tocOpen ? 'grid' : 'none', position: 'absolute', top: '100%', left: 0, marginTop: 6, gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))', gap: '2px 12px', background: PALETTE.paper1, border: `1px solid ${PALETTE.line}`, borderRadius: 12, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', maxHeight: '70vh', overflowY: 'auto', zIndex: 31 }}>
            {TOC_ITEMS.filter((item) => !isHidden(item.id)).map((item, i) => (
              <a key={`${item.id}-${i}`} data-toc-link href={`#${item.id}`} onClick={() => setTocOpen(false)}
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, fontWeight: 600, color: PALETTE.ink, opacity: 0.75, textDecoration: 'none', padding: '8px 9px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 3rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: PALETTE.berry, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>LP</div>
          <Eyebrow>Living Plus</Eyebrow>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 'clamp(2.2rem,6vw,3.6rem)', lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0 }}>
            Hi {firstName},<br />here&apos;s your plan
          </h1>
          <div style={{ marginTop: '1.1rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry }}>{data.goalLabel}</div>

          <div style={{ margin: '2.5rem 0 0.5rem' }}>
            <GrowthMascot pct={adherencePct} cheering={cheering} />
          </div>
          <div data-growth-caption style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6 }}>
            {totalActionsInPlan > 0 ? <>{GROWTH_LABELS[stageForPct(adherencePct)]} · <span data-goals-done>{goalsDone}</span>/{totalActionsInPlan} goals tracked</> : 'Your progress tree, check off goals in your plan to grow it'}
          </div>
        </div>
      </section>

      {/* Daily Health Check-in — same feature as the Week-family templates,
          ported here read-only. */}
      <section id="checkin" style={{ background: PALETTE.paper1, padding: '4rem 1.5rem', ...hiddenStyle('checkin') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <SecTitle icon={<CheckCircle2 size={26} />}>Daily Health Check-in</SecTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {editable && (
                <button type="button" onClick={() => setConfirmRegenerate(true)} disabled={regenerating}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, padding: '8px 12px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: '#fff', color: PALETTE.berry, cursor: regenerating ? 'default' : 'pointer', opacity: regenerating ? 0.6 : 1 }}>
                  <Sparkles size={13} /> {regenerating ? 'Regenerating…' : 'Ask AI to regenerate'}
                </button>
              )}
              <input type="date" value={checkinDate} onChange={(e) => setCheckinDate(e.target.value)}
                style={{ fontSize: 12.5, background: '#fff', border: `1px solid ${PALETTE.line}`, padding: '8px 11px', borderRadius: 9, color: PALETTE.ink, fontWeight: 600 }} />
            </div>
          </div>

          {confirmRegenerate && (
            <div style={{ background: 'rgba(122,51,70,0.08)', border: `1px solid ${PALETTE.berry}`, borderRadius: 12, padding: '12px 16px', margin: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: PALETTE.ink }}>Regenerate from this patient&apos;s current supplements and lifestyle guidelines? Any manual edits to the checklist will be overwritten.</span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={() => setConfirmRegenerate(false)} style={{ fontSize: '0.78rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: `1px solid ${PALETTE.line}`, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={regenerateChecklist} style={{ fontSize: '0.78rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none', background: PALETTE.berry, color: '#fff', cursor: 'pointer' }}>Regenerate</button>
              </div>
            </div>
          )}

          {!editable && checklistItems.length > 0 && (
            <p style={{ fontSize: 13, color: PALETTE.berry, fontWeight: 600, margin: '14px 0 4px' }}>
              {checkinAllDone
                ? 'Everything checked off for today — nice work.'
                : checkinNoneDone
                ? 'Nothing logged yet today — tap an item below to check in.'
                : `${checkinDoneCount} of ${checklistItems.length} done so far today.`}
            </p>
          )}

          {checklistItems.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 20 }}>
              {checklistItems.map((item) => {
                const checked = checkedSet.has(`0:item:${item.id}:${checkinDate}`)
                return (
                  <div key={item.id} onClick={() => { if (!editable) toggleChecklistItem(item.id, item.text, checkinDate) }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', borderRadius: 10, cursor: editable ? 'default' : 'pointer', border: `1px solid ${checked ? PALETTE.berry : PALETTE.line}`, background: checked ? 'rgba(122,51,70,0.08)' : 'rgba(255,255,255,0.5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                      {!editable && (checked
                        ? <CheckCircle2 size={17} color={PALETTE.berry} style={{ flexShrink: 0 }} />
                        : <Circle size={17} style={{ flexShrink: 0, opacity: 0.4 }} />)}
                      {editable ? (
                        <InlineEditableText editable value={item.text} onSave={(next) => saveChecklistItemText(item.id, next)}
                          style={{ fontSize: 13, fontWeight: 500, color: PALETTE.ink, flex: 1 }} />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, color: checked ? PALETTE.berry : PALETTE.ink, textDecoration: checked ? 'line-through' : 'none' }}>{item.text}</span>
                      )}
                    </div>
                    {editable ? (
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeChecklistItem(item.id) }} title="Remove"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: PALETTE.berry, opacity: 0.6, flexShrink: 0 }}><X size={15} /></button>
                    ) : (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: checked ? PALETTE.berry : 'rgba(122,51,70,0.1)', color: checked ? '#fff' : PALETTE.berry, flexShrink: 0 }}>{checked ? 'Done' : 'Pending'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, opacity: 0.65, marginTop: 16 }}>Once your coach confirms your supplements or lifestyle guidelines, your daily checklist will show up here.</p>
          )}
          {editable && (
            <button type="button" onClick={addChecklistItem}
              style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${PALETTE.line}`, background: 'none', color: PALETTE.berry, cursor: 'pointer' }}>
              + Add task
            </button>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 24 }}>
            <div style={{ background: 'rgba(255,255,255,0.5)', border: `1px solid ${PALETTE.line}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry, marginBottom: 8 }}><Droplet size={12} /> Water (glasses)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => adjustWater(-1)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${PALETTE.line}`, background: 'rgba(122,51,70,0.08)', fontWeight: 700, cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{todayMetrics.water || 0}</span>
                <button onClick={() => adjustWater(1)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${PALETTE.line}`, background: 'rgba(122,51,70,0.08)', fontWeight: 700, cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.5)', border: `1px solid ${PALETTE.line}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry, marginBottom: 8 }}><Flame size={12} /> Energy (1-10)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => adjustEnergy(-1)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${PALETTE.line}`, background: 'rgba(122,51,70,0.08)', fontWeight: 700, cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{todayMetrics.energy || 0}</span>
                <button onClick={() => adjustEnergy(1)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${PALETTE.line}`, background: 'rgba(122,51,70,0.08)', fontWeight: 700, cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.5)', border: `1px solid ${PALETTE.line}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry, marginBottom: 8 }}>Mood &amp; reflection</div>
              <input value={moodDraft} onChange={(e) => setMoodDraft(e.target.value)} onBlur={() => saveMetric('mood', moodDraft)}
                placeholder="e.g. Calm and focused today"
                style={{ width: '100%', background: '#fff', border: `1px solid ${PALETTE.line}`, borderRadius: 8, padding: '7px 10px', fontSize: 12.5, color: PALETTE.ink }} />
            </div>
          </div>
        </div>
      </section>

      {/* Founder's note — same left-aligned avatar-row layout as the coach
          section right below it, so the two sit on the exact same left
          edge and avatar size instead of one being centered and one not. */}
      <section id="founder" style={{ background: PALETTE.paper2, padding: '4rem 1.5rem', ...hiddenStyle('founder') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Eyebrow>A note from the founder</Eyebrow>
          <SecTitle icon={<HeartPulse size={26} />}>Founder&apos;s Note</SecTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginTop: 20 }}>
            <button data-founder-trigger onClick={() => setFounderOpen((v) => !v)}
              style={{ width: 64, height: 64, borderRadius: 32, flexShrink: 0, background: PALETTE.berry, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              RS
            </button>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.3rem', fontWeight: 500, marginTop: -8 }}>Roshni Sanghvi</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.65, marginTop: 2 }}>Founder, Living Plus</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.55, marginTop: 8 }}>Tap the photo to read the note</div>
            </div>
          </div>
          <div data-founder-body style={{ display: founderOpen ? 'block' : 'none', marginTop: 20, fontSize: '0.95rem', lineHeight: 1.75 }}>
            {editable ? (
              <InlineEditableText editable as="div" multiline value={founderNote} onSave={saveFounderNote}
                style={{ fontSize: '0.95rem', lineHeight: 1.75, whiteSpace: 'pre-wrap' }} />
            ) : (
              founderNote.split('\n\n').map((para, i) => <p key={i}>{para}</p>)
            )}
          </div>
        </div>
      </section>

      {/* Coach — photo, name, and designation stay visible; a personal
          quote (when the coach has entered one) sits behind a tap on the
          photo instead of always showing, same pattern as the founder's
          note above. */}
      {data.coach && (
        <section id="coach" style={{ background: PALETTE.paper2, borderTop: `1px solid ${PALETTE.line}`, borderBottom: `1px solid ${PALETTE.line}`, padding: '3rem 1.5rem', ...hiddenStyle('coach') }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <button data-coach-trigger onClick={() => (coachQuote || editable) && setCoachOpen((v) => !v)}
              style={{ width: 64, height: 64, borderRadius: 32, flexShrink: 0, background: data.coach.photo_url ? `url(${data.coach.photo_url}) center/cover` : PALETTE.gold1, border: `1px solid ${PALETTE.line}`, padding: 0, cursor: (coachQuote || editable) ? 'pointer' : 'default' }} />
            <div>
              <Eyebrow>Your coach</Eyebrow>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.3rem', fontWeight: 500, marginTop: -8 }}>{data.coach.full_name}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.65, marginTop: 2 }}>{data.coach.designation}</div>
              {(coachQuote || editable) && (
                <>
                  <div style={{ fontSize: '0.72rem', opacity: 0.55, marginTop: 8 }}>Tap the photo for a note from {coachFirst}</div>
                  <div data-coach-body style={{ display: coachOpen ? 'block' : 'none', marginTop: 6, fontStyle: 'italic', color: PALETTE.berry, fontSize: '0.92rem', maxWidth: 560 }}>
                    {editable ? (
                      <InlineEditableText editable multiline value={coachQuote || ''} onSave={saveCoachQuote} placeholder="Add a note from your coach…"
                        style={{ fontStyle: 'italic', color: PALETTE.berry, fontSize: '0.92rem' }} />
                    ) : (
                      <>&ldquo;{renderMarkdownBold(coachQuote)}&rdquo;</>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Care team — open, no card border, floating typographic treatment
          rather than a boxed tile. */}
      {(careTeam.length > 0 || editable) && (
        <section id="careteam" style={{ background: PALETTE.paper3, padding: '4rem 1.5rem', ...hiddenStyle('careteam') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Eyebrow>Beyond your coach</Eyebrow>
            <SecTitle icon={<HeartPulse size={26} />}>Your care team</SecTitle>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {careTeam.map((m, i) => (
                <div key={i} style={i > 0 ? { paddingTop: 24, borderTop: `1px solid ${PALETTE.line}` } : undefined}>
                  {editable ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <InlineEditableText editable value={m.name} placeholder="Name" onSave={(next) => saveCareTeam(careTeam.map((x, idx) => (idx === i ? { ...x, name: next } : x)))}
                          style={{ fontFamily: "'Fraunces', serif", fontSize: '1.1rem', fontWeight: 500, flex: 1 }} />
                        <button type="button" onClick={() => removeCareTeamMember(i)} title="Remove"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: PALETTE.berry, opacity: 0.6, flexShrink: 0 }}><X size={15} /></button>
                      </div>
                      <InlineEditableText editable value={m.role} placeholder="Role" onSave={(next) => saveCareTeam(careTeam.map((x, idx) => (idx === i ? { ...x, role: next } : x)))}
                        style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry }} />
                      <InlineEditableText editable as="div" multiline value={m.intro} placeholder="Intro" onSave={(next) => saveCareTeam(careTeam.map((x, idx) => (idx === i ? { ...x, intro: next } : x)))}
                        style={{ fontSize: '0.95rem', lineHeight: 1.6 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <InlineEditableText editable value={m.date} placeholder="Date (YYYY-MM-DD)" onSave={(next) => saveCareTeam(careTeam.map((x, idx) => (idx === i ? { ...x, date: next } : x)))}
                          style={{ fontSize: '0.85rem', color: PALETTE.berry, fontWeight: 600 }} />
                        <InlineEditableText editable value={m.time} placeholder="Time (HH:MM)" onSave={(next) => saveCareTeam(careTeam.map((x, idx) => (idx === i ? { ...x, time: next } : x)))}
                          style={{ fontSize: '0.85rem', color: PALETTE.berry, fontWeight: 600 }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.1rem', fontWeight: 500 }}>{m.name}</div>
                      {m.role && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry, marginTop: 4 }}>{m.role}</div>}
                      {m.intro && <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>{renderMarkdownBold(m.intro)}</p>}
                      {m.date && (
                        <div style={{ fontSize: '0.85rem', color: PALETTE.berry, fontWeight: 600, marginTop: 10 }}>
                          {new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {m.time && ` · ${new Date(`2000-01-01T${m.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {editable && (
                <button type="button" onClick={addCareTeamMember}
                  style={{ alignSelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${PALETTE.line}`, background: 'none', color: PALETTE.berry, cursor: 'pointer' }}>
                  + Add team member
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* How to use this guide + Your why — same real walkthrough + reflection as Classic */}
      <section id="howto" style={{ background: PALETTE.gold1, padding: '4rem 1.5rem', ...hiddenStyle('howto') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Eyebrow>Getting oriented</Eyebrow>
          <SecTitle icon={<HelpCircle size={26} />}>How To Use Your Plan</SecTitle>
          <p style={{ marginTop: 16, marginBottom: 20, fontSize: '0.95rem', fontWeight: 600, color: PALETTE.berry }}>Follow → Track → Adjust</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
            {[
              { icon: MapPin, title: 'This week', text: 'Check your goals and meals for the week.' },
              { icon: CheckCircle2, title: 'Each day', text: 'Tick off what you complete.' },
              { icon: HelpCircle, title: 'Need help?', text: 'Message ' + coachFirst + ' if something doesn’t work for you.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(122,51,70,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Icon size={18} color={PALETTE.berry} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: '0.88rem', opacity: 0.75, lineHeight: 1.55 }}>{text}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${PALETTE.line}` }}>
            <Eyebrow>Your why</Eyebrow>
            {whyImage && <img src={whyImage.image_url} alt={whyImage.label} style={{ display: 'block', width: '100%', maxWidth: 340, height: 'auto', borderRadius: 12, margin: '12px auto 16px' }} />}
            {editable ? (
              <InlineEditableText editable as="div" multiline value={whyReflection || ''} onSave={saveWhyReflection} placeholder="Not filled in yet."
                style={{ fontSize: '0.95rem', lineHeight: 1.65 }} />
            ) : whyReflection ? (
              <p style={{ fontSize: '0.95rem', lineHeight: 1.65 }}>{renderMarkdownBold(whyReflection)}</p>
            ) : (
              <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Not filled in yet.</p>
            )}
          </div>
        </div>
      </section>

      {LIFESTYLE_PERIODS.some((label) => parseBullets(lifestyleByPeriod[label] || '').length > 0) && (
        <section id="lifestyle" style={{ background: PALETTE.paper1, padding: '4rem 1.5rem', ...hiddenStyle('lifestyle') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <SecTitle icon={<Sun size={26} />}>Daily Lifestyle Guidelines</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 20 }}>
              {LIFESTYLE_PERIODS.map((label) => {
                const items = parseBullets(lifestyleByPeriod[label] || '')
                if (items.length === 0) return null
                return (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.35)', border: `1px solid ${PALETTE.line}`, borderRadius: 10, padding: '15px 17px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: PALETTE.berry, fontWeight: 600 }}>{label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <Circle size={11} color={PALETTE.berry} style={{ flexShrink: 0, marginTop: 4, opacity: 0.6 }} />
                          {editable ? (
                            <InlineEditableText editable value={item} onSave={(next) => saveLifestyleItem(label, i, next)}
                              style={{ fontSize: '0.9rem', lineHeight: 1.5 }} />
                          ) : (
                            <span style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{renderMarkdownBold(item)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {MEAL_PERIODS.some((label) => parseBullets(mealsByPeriod[label] || '').length > 0) && (
        <section id="meals" style={{ background: PALETTE.paper3, padding: '4rem 1.5rem', ...hiddenStyle('meals') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <SecTitle icon={<Utensils size={26} />}>Breakfast, Lunch &amp; Dinner</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 20 }}>
              {MEAL_PERIODS.map((label) => {
                const items = parseBullets(mealsByPeriod[label] || '')
                if (items.length === 0) return null
                return (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.35)', border: `1px solid ${PALETTE.line}`, borderRadius: 10, padding: '15px 17px' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: PALETTE.berry, fontWeight: 600 }}>{label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <Circle size={11} color={PALETTE.berry} style={{ flexShrink: 0, marginTop: 4, opacity: 0.6 }} />
                          {editable ? (
                            <InlineEditableText editable value={item} onSave={(next) => saveMealItem(label, i, next)}
                              style={{ fontSize: '0.9rem', lineHeight: 1.5 }} />
                          ) : (
                            <span style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{renderMarkdownBold(item)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {dailyScheduleText.trim() && (
        <section id="schedule" style={{ background: PALETTE.paper1, padding: '4rem 1.5rem', ...hiddenStyle('schedule') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <SecTitle icon={<CalendarCheck size={26} />}>Daily Schedule</SecTitle>
            <div style={{ position: 'relative', paddingLeft: 34, marginTop: 24 }}>
              <div style={{ position: 'absolute', left: 13, top: 6, bottom: 6, width: 2, background: PALETTE.line }} />
              {parseScheduleLines(dailyScheduleText).map((item, i, arr) => (
                <div key={i} style={{ position: 'relative', marginBottom: i < arr.length - 1 ? 20 : 0 }}>
                  <span style={{ position: 'absolute', left: -34, top: 0, width: 26, height: 26, borderRadius: 13, background: 'rgba(122,51,70,0.1)', border: `2px solid ${PALETTE.paper1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Circle size={9} color={PALETTE.berry} />
                  </span>
                  {editable ? (
                    <>
                      <InlineEditableText editable value={item.time} placeholder="Time" onSave={(next) => saveScheduleField(i, 'time', next)}
                        style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 700, color: PALETTE.berry }} />
                      <InlineEditableText editable value={item.text} placeholder="Activity" onSave={(next) => saveScheduleField(i, 'text', next)}
                        style={{ display: 'block', fontSize: '0.9rem', lineHeight: 1.5, marginTop: 2 }} />
                    </>
                  ) : (
                    <>
                      {item.time && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: PALETTE.berry }}>{item.time}</div>}
                      <div style={{ fontSize: '0.9rem', lineHeight: 1.5, marginTop: 2 }}>{item.text}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Power points — coach-pasted links (videos, articles, tools) each
          with a short note. Recipes are still browsable per-week inside
          "Your roadmap" below. */}
      {(powerPoints.filter((pp) => pp.url).length > 0 || editable) && (
        <section id="nutrition" style={{ background: PALETTE.paper3, padding: '4rem 1.5rem', ...hiddenStyle('nutrition') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Eyebrow>Worth a look</Eyebrow>
            <SecTitle icon={<LinkIcon size={26} />}>Your Power Points</SecTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              {editable
                ? powerPoints.map((pp, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: 'rgba(255,255,255,0.35)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(122,51,70,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <LinkIcon size={16} color={PALETTE.berry} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <InlineEditableText editable value={pp.note} placeholder="Note" onSave={(next) => savePowerPoints(powerPoints.map((x, idx) => (idx === i ? { ...x, note: next } : x)))}
                        style={{ fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 3, display: 'block' }} />
                      <InlineEditableText editable value={pp.url} placeholder="https://…" onSave={(next) => savePowerPoints(powerPoints.map((x, idx) => (idx === i ? { ...x, url: next } : x)))}
                        style={{ fontSize: '0.8rem', color: PALETTE.berry, display: 'block' }} />
                    </div>
                    <button type="button" onClick={() => removePowerPoint(i)} title="Remove"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: PALETTE.berry, opacity: 0.6, flexShrink: 0 }}><X size={15} /></button>
                  </div>
                ))
                : powerPoints.filter((pp) => pp.url).map((pp, i) => (
                <a key={i} href={pp.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 14, textDecoration: 'none', color: PALETTE.ink, padding: '14px 16px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: 'rgba(255,255,255,0.35)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(122,51,70,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LinkIcon size={16} color={PALETTE.berry} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {pp.note && <div style={{ fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 3 }}>{renderMarkdownBold(pp.note)}</div>}
                    <div style={{ fontSize: '0.8rem', color: PALETTE.berry, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pp.url}</div>
                  </div>
                </a>
              ))}
              {editable && (
                <button type="button" onClick={addPowerPoint}
                  style={{ alignSelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${PALETTE.line}`, background: 'none', color: PALETTE.berry, cursor: 'pointer' }}>
                  + Add power point
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Your roadmap — real Month → Week → Recipes structure, same
          per-week curated data Classic uses (src/lib/pdf/weekRecipes.ts).
          Everything expands inline, in place, as part of the page — no
          popup dialogs. */}
      {months.length > 0 && (
        <section id="roadmap" style={{ background: PALETTE.dusk1, padding: '4rem 1.5rem', ...hiddenStyle('roadmap') }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Eyebrow dark>Month by month</Eyebrow>
            <SecTitle dark icon={<MapPin size={26} color={PALETTE.cream} />}>Your Roadmap</SecTitle>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 24 }}>
              {months.map((m) => (
                <button key={m.monthNumber} data-month-trigger={m.monthNumber} onClick={() => { const next = openMonth === m.monthNumber ? null : m.monthNumber; setOpenMonth(next); setOpenWeek(null); setOpenDay(null); setOpenSlot(null); setOpenRecipeId(null) }}
                  style={{
                    padding: '9px 18px', borderRadius: 24, cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', letterSpacing: '0.04em',
                    border: `1px solid ${openMonth === m.monthNumber ? PALETTE.gold1 : 'rgba(243,236,218,0.3)'}`,
                    background: openMonth === m.monthNumber ? PALETTE.gold1 : 'transparent', color: openMonth === m.monthNumber ? PALETTE.ink : PALETTE.cream,
                  }}>
                  {m.monthLabel}
                </button>
              ))}
            </div>

            {months.map((m) => (
              <div key={m.monthNumber} data-month-body={m.monthNumber} style={{ marginTop: 28, display: openMonth === m.monthNumber ? 'block' : 'none' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {m.weeks.map((w) => (
                    <button key={w.week_number} data-week-trigger={w.week_number} onClick={() => { const next = openWeek === w.week_number ? null : w.week_number; setOpenWeek(next); setOpenDay(null); setOpenSlot(null); setOpenRecipeId(null) }}
                      style={{
                        textAlign: 'left', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', minWidth: 150,
                        border: `1px solid ${openWeek === w.week_number ? PALETTE.gold1 : 'rgba(243,236,218,0.22)'}`,
                        background: openWeek === w.week_number ? 'rgba(224,195,132,0.14)' : 'rgba(243,236,218,0.05)',
                      }}>
                      <div style={{ color: PALETTE.gold1, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.05em' }}>Week {w.week_number}</div>
                      <div style={{ color: PALETTE.cream, fontSize: '0.85rem', marginTop: 3 }}>{w.focus_theme}</div>
                    </button>
                  ))}
                </div>

                {m.weeks.map((w) => (
                  <div key={w.week_number} data-week-body={w.week_number} style={{ display: openWeek === w.week_number ? 'block' : 'none', borderTop: '1px solid rgba(243,236,218,0.18)', paddingTop: 24 }}>
                    {(w.actions?.length ?? 0) > 0 && (
                      <div style={{ marginBottom: 28 }}>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1, opacity: 0.85 }}>Sunday to Saturday, this week&apos;s goals</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                          {DAY_LABELS.map((day, dayIndex) => {
                            const dayId = `${w.week_number}-${day}`
                            const isDayOpen = openDay === dayId
                            const dayDate = dateForWeekDay(data.createdAt, w.week_number, dayIndex)
                            return (
                              <div key={day} style={{ border: '1px solid rgba(243,236,218,0.22)', borderRadius: 12, overflow: 'hidden' }}>
                                <button data-day-trigger={dayId} onClick={() => setOpenDay(isDayOpen ? null : dayId)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: '0.95rem', fontWeight: 500, color: PALETTE.cream }}>{day}</span>
                                  {isDayOpen ? <ChevronDown size={16} color={PALETTE.gold1} /> : <ChevronRight size={16} color={PALETTE.cream} opacity={0.5} />}
                                </button>
                                <div data-day-body={dayId} style={{ display: isDayOpen ? 'block' : 'none', padding: '0 14px 14px' }}>
                                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {(w.days?.[dayIndex] ?? w.actions ?? []).map((action, ai) => {
                                      const checked = checkedSet.has(`${w.week_number}:${ai}:${dayDate}`)
                                      return (
                                        <li key={ai} data-goal-toggle={`${w.week_number}:${ai}:${dayDate}`} onClick={() => { if (!editable) toggleGoal(w.week_number, ai, dayDate) }}
                                          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: editable ? 'default' : 'pointer', marginBottom: 8, padding: '2px 0' }}>
                                          <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}>
                                            <circle data-goal-check-track data-on-color={PALETTE.gold1} data-off-color="rgba(243,236,218,0.4)" cx="12" cy="12" r="10" fill="none" stroke={checked ? PALETTE.gold1 : 'rgba(243,236,218,0.4)'} strokeWidth="2" style={{ transition: 'stroke 0.25s ease' }} />
                                            <circle data-goal-check-fill cx="12" cy="12" r="10" fill={PALETTE.gold1} style={{ opacity: checked ? 1 : 0, transition: 'opacity 0.25s ease' }} />
                                            <path data-goal-check-tick d="M7 12.5 10.5 16 17 8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                                              strokeDasharray="16" style={{ strokeDashoffset: checked ? 0 : 16, transition: 'stroke-dashoffset 0.35s ease 0.05s' }} />
                                          </svg>
                                          {editable ? (
                                            <InlineEditableText editable value={action} onSave={(next) => saveRoadmapAction(w.week_number, dayIndex, ai, next)}
                                              style={{ color: PALETTE.cream, fontSize: '0.92rem', lineHeight: 1.6 }} />
                                          ) : (
                                            <span data-goal-text style={{ color: PALETTE.cream, opacity: checked ? 0.55 : 0.9, fontSize: '0.92rem', lineHeight: 1.6, textDecoration: checked ? 'line-through' : 'none', transition: 'opacity 0.2s ease' }}>{action}</span>
                                          )}
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
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1, opacity: 0.85 }}>Recipes for the week</span>
                          <div data-slot-list style={{ display: openSlot == null ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 10 }}>
                            {weekSlotRecipes.map(({ slot, matches }) => {
                              const slotId = `${w.week_number}-${slot}`
                              return (
                                <button key={slot} data-slot-trigger={slotId} onClick={() => setOpenSlot(slotId)}
                                  style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 12, cursor: 'pointer', border: '1px solid rgba(243,236,218,0.22)', background: 'rgba(243,236,218,0.08)' }}>
                                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '0.9rem', fontWeight: 500, color: PALETTE.cream }}>{SLOT_LABELS[slot]}</div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: matches.length ? PALETTE.gold1 : PALETTE.cream, opacity: matches.length ? 1 : 0.5, marginTop: 4, fontWeight: 600 }}>
                                    {matches.length ? `${matches.length} recipe${matches.length === 1 ? '' : 's'}` : `Not detected yet, ${coachFirst} will add some.`}
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                          {weekSlotRecipes.map(({ slot, matches }) => {
                            const slotId = `${w.week_number}-${slot}`
                            return (
                            <div key={slot} data-slot-body={slotId} style={{ display: openSlot === slotId ? 'block' : 'none', marginTop: 16 }}>
                              <button data-slot-back onClick={() => setOpenSlot(null)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: PALETTE.gold1, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', fontWeight: 700, padding: 0, marginBottom: 12 }}>
                                ← Back to meal slots
                              </button>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1, opacity: 0.85, display: 'block', marginBottom: 10 }}>{SLOT_LABELS[slot]}, picked for your plan</span>
                              {matches.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                                  {matches.map(({ recipe }) => {
                                    const recipeKey = `${w.week_number}-${slot}-${recipe.id}`
                                    return (
                                    <button key={recipeKey} data-recipe-trigger={recipeKey} onClick={() => setOpenRecipeId(openRecipeId === recipeKey ? null : recipeKey)}
                                      style={{ textAlign: 'left', padding: 0, cursor: 'pointer', background: openRecipeId === recipeKey ? 'rgba(224,195,132,0.16)' : 'rgba(243,236,218,0.08)', border: `1px solid ${openRecipeId === recipeKey ? PALETTE.gold1 : 'rgba(243,236,218,0.22)'}`, borderRadius: 12, overflow: 'hidden' }}>
                                      {recipe.image_url ? (
                                        <img src={recipe.image_url} alt={recipe.name} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                                      ) : (
                                        <div style={{ width: '100%', height: 100, background: 'rgba(243,236,218,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <ChefHat size={20} color={PALETTE.cream} opacity={0.5} />
                                        </div>
                                      )}
                                      <div style={{ padding: '9px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                        <span style={{ color: PALETTE.cream, fontSize: '0.85rem', fontWeight: 600 }}>{recipe.name}</span>
                                        {openRecipeId === recipeKey ? <ChevronDown size={14} color={PALETTE.gold1} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} color={PALETTE.cream} opacity={0.5} style={{ flexShrink: 0 }} />}
                                      </div>
                                    </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.88rem', color: PALETTE.cream, opacity: 0.6 }}>Nothing detected for {SLOT_LABELS[slot].toLowerCase()} yet, {coachFirst} will add some.</div>
                              )}

                              {/* Recipe detail — expands inline, right under
                                  the slot it belongs to, as part of the page
                                  rather than a floating popup. Every match's
                                  detail is always mounted (just hidden) so a
                                  downloaded copy of this page has every
                                  recipe available, not just whichever one
                                  happened to be open. */}
                              {matches.map(({ recipe }) => {
                                const recipeKey = `${w.week_number}-${slot}-${recipe.id}`
                                return (
                                <div key={recipeKey} data-recipe-body={recipeKey} style={{ display: openRecipeId === recipeKey ? 'block' : 'none', marginTop: 14, background: 'rgba(243,236,218,0.06)', border: `1px solid ${PALETTE.gold1}`, borderRadius: 14, padding: '1.75rem', position: 'relative' }}>
                                  <button onClick={() => setOpenRecipeId(null)} data-no-export style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: PALETTE.cream, opacity: 0.6 }}><X size={18} /></button>
                                  <div style={{ display: 'grid', gridTemplateColumns: recipe.image_url ? '1fr 1.3fr' : '1fr', gap: 24 }}>
                                    {recipe.image_url && <img src={recipe.image_url} alt={recipe.name} style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 320 }} />}
                                    <div>
                                      {recipe.protein_label && <Eyebrow dark>{recipe.protein_label}</Eyebrow>}
                                      <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: '1.4rem', color: PALETTE.cream, margin: '0 0 16px' }}>{recipe.name}</h3>
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1 }}>Ingredients</span>
                                      <ul style={{ listStyle: 'none', margin: '8px 0 16px', padding: 0 }}>
                                        {splitRecipeLines(recipe.ingredients).map((line, i) => (
                                          <li key={i} style={{ color: PALETTE.cream, opacity: 0.9, fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 4 }}>{line}</li>
                                        ))}
                                      </ul>
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1 }}>Directions</span>
                                      <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                                        {splitRecipeLines(recipe.steps).map((line, i) => (
                                          <li key={i} style={{ color: PALETTE.cream, opacity: 0.9, fontSize: '0.88rem', lineHeight: 1.65, marginBottom: 6 }}>{line}</li>
                                        ))}
                                      </ol>
                                      {recipe.benefits && recipe.benefits.length > 0 && (
                                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(243,236,218,0.18)' }}>
                                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1 }}>Why it works</span>
                                          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                                            {recipe.benefits.map((b, i) => <li key={i} style={{ color: PALETTE.cream, opacity: 0.9, fontSize: '0.86rem', lineHeight: 1.55, marginBottom: 4 }}>{b}</li>)}
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
          </div>
        </section>
      )}

      {/* Supplements */}
      {data.confirmedSupplements.length > 0 && (
        <section id="supplements" style={{ background: PALETTE.dusk2, padding: '4rem 1.5rem', ...hiddenStyle('supplements') }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Eyebrow dark>Confirmed by {coachFirst}</Eyebrow>
            <SecTitle dark icon={<Pill size={26} color={PALETTE.cream} />}>Your Supplement Plan</SecTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 20 }}>
              {data.confirmedSupplements.map((s, i) => (
                <div key={i} style={{ background: 'rgba(243,236,218,0.06)', border: '1px solid rgba(243,236,218,0.22)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ color: PALETTE.cream, fontWeight: 600, fontSize: '0.95rem' }}>{s.name}</div>
                  <div style={{ color: PALETTE.cream, opacity: 0.75, fontSize: '0.85rem', marginTop: 4 }}>{[s.dose, s.timing, s.duration].filter(Boolean).join(' · ')}</div>
                  {s.notes && <div style={{ color: PALETTE.gold1, fontSize: '0.8rem', marginTop: 6 }}>⚠ {s.notes}</div>}
                </div>
              ))}
            </div>
            <div style={{ color: PALETTE.cream, opacity: 0.5, fontSize: '0.78rem', marginTop: 16 }}>Don&apos;t start, stop, or change a dose without confirming with {coachFirst} first.</div>
          </div>
        </section>
      )}

      {/* Shopping list — same recipe-derived, categorized ingredients as
          Classic (src/lib/groceryList.ts), broken out per week; expands
          inline instead of a popup. */}
      <section id="grocery" style={{ background: PALETTE.paper2, padding: '4rem 1.5rem', ...hiddenStyle('grocery') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <Eyebrow>What to buy</Eyebrow>
              <SecTitle icon={<ShoppingCart size={26} />}>Your Shopping List</SecTitle>
            </div>
            {editable && groceryOverride && (
              <button type="button" onClick={resetGroceryList}
                style={{ fontSize: '0.75rem', fontWeight: 700, padding: '7px 12px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: '#fff', color: PALETTE.berry, cursor: 'pointer' }}>
                Reset to auto-generated list
              </button>
            )}
          </div>
          <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: 16, marginBottom: 20 }}>
            {editable ? 'Pulled from your matched recipes — edit any item, or add your own.' : 'Pulled straight from the ingredients of your matched recipes. Pick a week below to see it.'}
          </p>
          {months.length === 0 ? (
            <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Not planned yet, check back once your coach generates your roadmap.</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {months.map((m) => (
                  <button key={m.monthNumber} data-grocery-month-trigger={m.monthNumber} onClick={() => { const next = openGroceryMonth === m.monthNumber ? null : m.monthNumber; setOpenGroceryMonth(next); setOpenGroceryWeek(null) }}
                    style={{
                      padding: '9px 18px', borderRadius: 24, cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem',
                      border: `1px solid ${openGroceryMonth === m.monthNumber ? PALETTE.berry : PALETTE.line}`,
                      background: openGroceryMonth === m.monthNumber ? PALETTE.berry : 'transparent', color: openGroceryMonth === m.monthNumber ? '#fff' : PALETTE.ink,
                    }}>
                    {m.monthLabel}
                  </button>
                ))}
              </div>
              {months.map((m) => (
                <div key={m.monthNumber} data-grocery-month-body={m.monthNumber} style={{ marginTop: 20, display: openGroceryMonth === m.monthNumber ? 'block' : 'none' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                    {m.weeks.map((w) => (
                      <button key={w.week_number} data-grocery-week-trigger={w.week_number} onClick={() => setOpenGroceryWeek(openGroceryWeek === w.week_number ? null : w.week_number)}
                        style={{
                          padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                          border: `1px solid ${openGroceryWeek === w.week_number ? PALETTE.berry : PALETTE.line}`,
                          background: openGroceryWeek === w.week_number ? 'rgba(122,51,70,0.08)' : 'transparent',
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
                    const finalCats = groceryOverride ?? (cats.length > 0 ? cats : GROCERY_CATEGORIES)
                    return (
                      <div key={w.week_number} data-grocery-week-body={w.week_number} style={{ display: openGroceryWeek === w.week_number ? 'grid' : 'none', borderTop: `1px solid ${PALETTE.line}`, paddingTop: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
                        {finalCats.map((cat) => (
                          <div key={cat.head}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {editable ? (
                                <InlineEditableText editable value={cat.head} onSave={(next) => saveGroceryCategoryName(finalCats, cat.head, next)}
                                  style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry, flex: 1 }} />
                              ) : (
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry }}>{cat.head}</span>
                              )}
                              {editable && (
                                <span role="button" onClick={() => removeGroceryCategory(finalCats, cat.head)} title="Remove category"
                                  style={{ display: 'inline-flex', color: PALETTE.berry, opacity: 0.6, cursor: 'pointer', flexShrink: 0 }}><X size={12} /></span>
                              )}
                            </div>
                            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                              {cat.items.map((item, itemIndex) => {
                                const itemKey = `${w.week_number}:${cat.head}:${item}`
                                const bought = boughtItems.has(itemKey)
                                return (
                                  <li key={itemIndex} data-grocery-item={itemKey} onClick={() => { if (!editable) toggleBought(itemKey) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', opacity: bought ? 0.45 : 0.8, padding: '3px 0', cursor: editable ? 'default' : 'pointer' }}>
                                    {!editable && (
                                      <>
                                        <span data-grocery-icon-done style={{ display: bought ? 'inline-flex' : 'none', flexShrink: 0 }}><CheckCircle2 size={13} color={PALETTE.berry} /></span>
                                        <span data-grocery-icon-undone style={{ display: bought ? 'none' : 'inline-flex', flexShrink: 0 }}><Circle size={13} opacity={0.5} /></span>
                                      </>
                                    )}
                                    {editable ? (
                                      <>
                                        <InlineEditableText editable value={item} onSave={(next) => saveGroceryItemText(finalCats, cat.head, itemIndex, next)}
                                          style={{ flex: 1 }} />
                                        <span role="button" onClick={() => removeGroceryItem(finalCats, cat.head, itemIndex)} title="Remove"
                                          style={{ display: 'inline-flex', color: PALETTE.berry, opacity: 0.6, cursor: 'pointer', flexShrink: 0 }}><X size={12} /></span>
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
                                    style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', fontWeight: 700, padding: 0, border: 'none', background: 'none', color: PALETTE.berry, cursor: 'pointer', opacity: 0.8 }}>
                                    + Add item
                                  </button>
                                </li>
                              )}
                            </ul>
                          </div>
                        ))}
                        {editable && (
                          <button type="button" onClick={() => addGroceryCategory(finalCats)}
                            style={{ alignSelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${PALETTE.line}`, background: 'none', color: PALETTE.berry, cursor: 'pointer' }}>
                            + Add category
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* What's included in your care — same coach-entered tiles as
          Classic; expands inline instead of a popup. */}
      {(careServices.length > 0 || editable) && (
        <section id="services" style={{ background: PALETTE.paper3, padding: '4rem 1.5rem', ...hiddenStyle('services') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Eyebrow>Your plan</Eyebrow>
            <SecTitle icon={<Star size={26} />}>What&apos;s Included In Your Care</SecTitle>
            {editable ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
                {careServices.map((svc, i) => (
                  <div key={i} style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${PALETTE.line}`, background: 'rgba(255,255,255,0.35)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <InlineEditableText editable value={svc.name} placeholder="Service name" onSave={(next) => saveCareServices(careServices.map((x, idx) => (idx === i ? { ...x, name: next } : x)))}
                        style={{ fontSize: '0.9rem', fontWeight: 700, flex: 1 }} />
                      <button type="button" onClick={() => saveCareServices(careServices.filter((_, idx) => idx !== i))} title="Remove"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: PALETTE.berry, opacity: 0.6, flexShrink: 0 }}><X size={15} /></button>
                    </div>
                    <InlineEditableText editable value={svc.sessions} placeholder="Sessions (e.g. 2x/month)" onSave={(next) => saveCareServices(careServices.map((x, idx) => (idx === i ? { ...x, sessions: next } : x)))}
                      style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 4, display: 'block' }} />
                    <InlineEditableText editable as="div" multiline value={svc.description || ''} placeholder="Description" onSave={(next) => saveCareServices(careServices.map((x, idx) => (idx === i ? { ...x, description: next } : x)))}
                      style={{ fontSize: '0.87rem', lineHeight: 1.55, marginTop: 8 }} />
                  </div>
                ))}
                <button type="button" onClick={() => saveCareServices([...careServices, { name: '', icon: 'coaching', sessions: '', description: '' }])}
                  style={{ alignSelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${PALETTE.line}`, background: 'none', color: PALETTE.berry, cursor: 'pointer' }}>
                  + Add service
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 20 }}>
                  {careServices.map((svc, i) => {
                    const Icon = CARE_ICON_MAP[svc.icon] || Star
                    const isOpen = openService === i
                    return (
                      <button key={i} data-care-trigger={i} onClick={() => setOpenService(isOpen ? null : i)}
                        style={{ textAlign: 'left', padding: '14px 12px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${isOpen ? PALETTE.berry : PALETTE.line}`, background: isOpen ? 'rgba(122,51,70,0.06)' : 'rgba(255,255,255,0.35)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: PALETTE.gold1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                          <Icon size={16} color={PALETTE.ink} />
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{svc.name}</div>
                        {svc.sessions && <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 2 }}>{svc.sessions}</div>}
                      </button>
                    )
                  })}
                </div>
                {careServices.map((svc, i) => svc.description && (
                  <div key={i} data-care-body={i} style={{ display: openService === i ? 'block' : 'none', marginTop: 16, padding: '16px 18px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: 'rgba(255,255,255,0.35)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{svc.name}</div>
                    <p style={{ fontSize: '0.87rem', lineHeight: 1.55, margin: 0 }}>{renderMarkdownBold(svc.description || '')}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      )}

      {/* Track your progress — same real check-in-derived stats as Classic */}
      <section id="track" style={{ background: PALETTE.gold1, padding: '4rem 1.5rem', ...hiddenStyle('track') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Eyebrow>Real numbers, not a guess</Eyebrow>
          <SecTitle icon={<CheckCircle2 size={26} />}>Track Your Progress</SecTitle>
          <p data-track-empty style={{ fontSize: '0.9rem', opacity: 0.65, marginTop: 16, display: progress.totalDaysLogged === 0 ? 'block' : 'none' }}>No check-ins logged yet, tap a goal in your roadmap above each day you complete it, and your progress will show up here.</p>
          <div data-track-content style={{ display: progress.totalDaysLogged === 0 ? 'none' : 'block' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20, marginBottom: 24 }}>
              {[
                { key: 'streak', icon: <StreakFlame lit={progress.streak > 0} pop={cheering} />, value: progress.streak, label: 'day streak' },
                { key: 'days', icon: <CalendarCheck size={14} />, value: progress.totalDaysLogged, label: 'days logged, total' },
                { key: 'goals', icon: <Target size={14} />, value: `${goalsDone}/${totalActionsInPlan}`, label: 'goals accomplished' },
                { key: 'best', icon: <TrendingUp size={14} />, value: progress.bestMonth ? `${progress.bestMonth.pct}%` : '0%', label: progress.bestMonth ? `best month · ${progress.bestMonth.monthLabel}` : 'best month' },
              ].map((s) => (
                <div key={s.key} style={{ flex: '1 1 130px', padding: '12px 14px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: 'rgba(255,255,255,0.35)' }}>
                  <span style={{ color: PALETTE.berry }}>{s.icon}</span>
                  <div data-stat={s.key} style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 8 }}>{s.value}</div>
                  <div data-stat-label={s.key} style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Goals completed by month</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 12 }}>
              {progress.monthStats.map((m) => (
                <div key={m.monthNumber} style={{ textAlign: 'center' }}>
                  <div data-stat-pct={m.monthNumber} style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: "'Fraunces', serif", color: m.pct >= 70 ? PALETTE.berry : PALETTE.ink }}>{m.pct}%</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, marginTop: 2 }}>{m.monthLabel}</div>
                  <div data-stat-sub={m.monthNumber} style={{ fontSize: '0.72rem', opacity: 0.55 }}>{m.doneActions}/{m.totalActions} goals</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* When to reach us / next appointment */}
      <section id="reach" style={{ background: PALETTE.night1, padding: '4rem 1.5rem', ...hiddenStyle('reach') }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Eyebrow dark>Reach us</Eyebrow>
          <SecTitle dark icon={<Phone size={26} color={PALETTE.cream} />}>When To Reach Us</SecTitle>
          {data.nextAppointment.date ? (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: PALETTE.gold1, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', marginBottom: 14 }}>
                <CalendarCheck size={16} />
                {new Date(data.nextAppointment.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {data.nextAppointment.time && ` · ${new Date(`2000-01-01T${data.nextAppointment.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
                {data.nextAppointment.mode && ` · ${data.nextAppointment.mode}`}
              </div>
              <p style={{ color: PALETTE.cream, opacity: 0.85, fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 6 }}>Contact your care team if you:</p>
              <ul style={{ margin: '0 0 10px', paddingLeft: 20, color: PALETTE.cream, opacity: 0.85, fontSize: '0.92rem', lineHeight: 1.6 }}>
                <li>Have questions about your plan</li>
                <li>Are struggling to follow a recommendation</li>
                <li>Notice an unexpected change in how you feel</li>
              </ul>
              <p style={{ color: PALETTE.cream, opacity: 0.85, fontSize: '0.92rem', lineHeight: 1.6 }}><strong>Emergency?</strong> Seek immediate medical care.</p>
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              <p style={{ color: PALETTE.cream, opacity: 0.85, fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 6 }}>Contact your care team if you:</p>
              <ul style={{ margin: '0 0 10px', paddingLeft: 20, color: PALETTE.cream, opacity: 0.85, fontSize: '0.92rem', lineHeight: 1.6 }}>
                <li>Have questions about your plan</li>
                <li>Are struggling to follow a recommendation</li>
                <li>Notice an unexpected change in how you feel</li>
              </ul>
              <p style={{ color: PALETTE.cream, opacity: 0.85, fontSize: '0.92rem', lineHeight: 1.6 }}><strong>Emergency?</strong> Seek immediate medical care.</p>
            </div>
          )}
          {data.coach?.email && (
            <p style={{ color: PALETTE.gold1, fontSize: '0.85rem', marginTop: 14 }}>Message {coachFirst} directly at {data.coach.email}.</p>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: PALETTE.night2, padding: '4rem 1.5rem 6rem', ...hiddenStyle('faq') }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Eyebrow dark>Questions we hear most</Eyebrow>
          <SecTitle dark icon={<HelpCircle size={26} color={PALETTE.cream} />}>FAQ</SecTitle>
          <div style={{ marginTop: 20 }}>
            {[
              ['What if I can’t finish everything on my plate exactly as shown?', 'Getting the food groups roughly right matters far more than hitting exact portions.'],
              ['What if I miss a few days on my habit tracker?', 'Log what actually happened, not what you wish had happened. An honest gap tells your coach more than a perfect-looking week.'],
              ['Can I eat something that’s not on the lists?', 'Yes, the lists are what to lean on, not a ban on everything else. Ask your coach if unsure.'],
            ].map(([q, a], i) => {
              const isOpen = openFaq === i
              return (
                <div key={i} style={{ borderBottom: i < 2 ? '1px solid rgba(243,236,218,0.18)' : 'none' }}>
                  <button data-faq-trigger={i} onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ color: PALETTE.cream, fontWeight: 600, fontSize: '0.95rem' }}>{q}</span>
                    {isOpen ? <ChevronDown size={16} color={PALETTE.gold1} style={{ flexShrink: 0 }} /> : <ChevronRight size={16} color={PALETTE.cream} opacity={0.5} style={{ flexShrink: 0 }} />}
                  </button>
                  <div data-faq-body={i} style={{ display: isOpen ? 'block' : 'none', color: PALETTE.cream, opacity: 0.65, fontSize: '0.88rem', paddingBottom: 16 }}>{a}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
      {data.canvasBlocks.length > 0 && (
        <section style={{ background: PALETTE.paper1, padding: '2rem 1.5rem' }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <CanvasBlocksSection
              blocks={data.canvasBlocks}
              recipesById={Object.fromEntries(data.recipeBank.map((r) => [r.id, r]))}
              imagesById={Object.fromEntries(data.imageBank.map((im) => [im.id, im]))}
              theme={toBlockTheme({
                accent: PALETTE.berry,
                accentSoft: PALETTE.paper2,
                line: PALETTE.line,
                card: PALETTE.cream,
                ink: PALETTE.ink,
                muted: PALETTE.dusk1,
              })}
            />
          </div>
        </section>
      )}
      {/* Footer — belongs at the true end of the page, after custom
          blocks (not before them, which put it in the middle when a
          roadmap has any). */}
      <div style={{ background: PALETTE.night2, padding: '0 1.5rem 3rem', textAlign: 'center' }}>
        <div style={{ color: PALETTE.cream, opacity: 0.4, fontSize: '0.75rem', fontFamily: "'IBM Plex Mono', monospace" }}>Living Plus Pvt Ltd™</div>
      </div>
    </div>
  )
}
