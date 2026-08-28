'use client'

// An "Editorial" skin of WeekTemplate — identical data plumbing, sections
// and interactions (same GuideData, same checkins/daily-metrics/grocery
// APIs, same download-as-static-HTML), just re-themed to a serif magazine
// look (Playfair Display/Source Sans 3, maroon accent) instead of Week's
// warm paper/gold. Built for a 1-week plan: "Your roadmap" shows that one
// week directly (no month/week tabs), and it adds a "Daily Health
// Check-in" section — a habit checklist built from this patient's REAL
// supplements and lifestyle guidelines (never generic placeholder items),
// plus a water/energy/mood log per real calendar date. A coach always
// edits content in the Classic editor regardless of which template is
// picked; this component never runs in editable mode.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  HeartPulse, Utensils, Pill, Phone, CalendarCheck, HelpCircle, ChefHat, MapPin, ChevronDown, ChevronRight, X, Download,
  CheckCircle2, Circle, Sparkles, Star, ShoppingCart, Video, MessageCircle, Activity, Stethoscope, Users, Target, TrendingUp,
  Droplet, Zap, Sun, Moon, Footprints, Wind, Link as LinkIcon, type LucideIcon,
} from 'lucide-react'
import type { GuideData, DayMealSlot } from '@/lib/pdf/ClientGuideDocument'
import { parseBullets, splitIntoPeriods, joinPeriods, parseScheduleLines } from '@/lib/periodBullets'
import InlineEditableText from '@/components/InlineEditableText'
import type { ChecklistItem } from '@/lib/dailyChecklist'
import { parseNutritionistGuidelines } from '@/lib/pdf/parseNutritionistGuidelines'
import { selectRecipesForPatient } from '@/lib/pdf/matchRecipes'
import { getSlotRecipes } from '@/lib/pdf/weekRecipes'
import { renderMarkdownBold } from '@/lib/renderMarkdownBold'
import { splitRecipeLines } from '@/lib/recipeText'
import { GROCERY_CATEGORIES } from '@/lib/foodPlates'
import { buildGroceryList, type GroceryCategory } from '@/lib/groceryList'
import { matchGuideImageDistinct } from '@/lib/pdf/matchGuideImage'
import { buildInlineExportScript } from '@/lib/pdf/inlineExportScript'
import { CanvasBlocksSection } from './CanvasBlocksSection'
import { toBlockTheme } from '@/lib/blocks/BlockRenderer'

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

// Same real-calendar-date anchoring as every other template — a week's
// "Sunday" is the actual calendar Sunday of the week the roadmap was
// created in, so each day tab is a genuine, distinct date.
function weekSundayISO(createdAtISO: string): string {
  const dateOnly = createdAtISO.slice(0, 10)
  const d = new Date(`${dateOnly}T00:00:00Z`)
  return shiftDateISO(dateOnly, -d.getUTCDay())
}
function dateForWeekDay(createdAtISO: string, weekNumber: number, dayIndex: number): string {
  return shiftDateISO(weekSundayISO(createdAtISO), (weekNumber - 1) * 7 + dayIndex)
}

type Checkin = { week_number: number; action_index: number | null; checkin_date: string; item_id?: string | null; item_text_snapshot?: string | null }

// Keyword hints for the schedule timeline's per-item icon (see the
// "Daily schedule" section) — a real signal beats a generic dot, same
// spirit as the period-classifier in src/lib/periodBullets.ts.
const SCHEDULE_ICON_RULES: [RegExp, LucideIcon][] = [
  [/\b(breakfast|lunch|dinner|meal|snack)\b/i, Utensils],
  // Checked before the walk/exercise rule below, since "breathing exercise"
  // would otherwise match "exercise" first — breath-work reads better as
  // Wind than as a generic workout icon. No trailing \b on "breath" so it
  // still matches "breathing", "breath work", etc.
  [/\bbreath|\b(pranayama|meditat|vagus)\b/i, Wind],
  [/\b(walk|steps?|gym|workout|exercise|yoga|stretch)\b/i, Footprints],
  [/\b(sun|sunlight|wake)\b/i, Sun],
  [/\b(sleep|bed|mouth\s*tap|night)\b/i, Moon],
  [/\b(water|hydrat|juice|tea|coffee)\b/i, Droplet],
  [/\b(muscle|stimulat|massage|relax)\b/i, HeartPulse],
]
function iconForScheduleItem(text: string): LucideIcon {
  for (const [pattern, Icon] of SCHEDULE_ICON_RULES) if (pattern.test(text)) return Icon
  return Circle
}

const PALETTE = {
  paper1: '#FAF7F2', paper2: '#FFFFFF', paper3: '#F0EBE3',
  gold1: '#F0EBE3', gold2: '#8B3A3A',
  dusk1: '#1A1A1A', dusk2: '#8B3A3A',
  night1: '#1A1A1A', night2: '#141414', night3: '#111111',
  ink: '#1A1A1A', cream: '#FAF7F2', goldAccent: '#8B3A3A', berry: '#8B3A3A',
  line: 'rgba(26,26,26,0.18)',
}

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@300;400;500;600&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap'

const TOC_ITEMS: { label: string; id: string }[] = [
  { label: 'Daily health check-in', id: 'checkin' },
  { label: 'Founder’s note', id: 'founder' },
  { label: 'Meet your coach', id: 'coach' },
  { label: 'Your care team', id: 'careteam' },
  { label: 'How to use this guide', id: 'howto' },
  { label: 'Your why', id: 'howto' },
  { label: 'Daily lifestyle guidelines', id: 'lifestyle' },
  { label: 'Breakfast, Lunch & Dinner', id: 'meals' },
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
    <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.65, color: dark ? PALETTE.cream : PALETTE.ink, display: 'block', marginBottom: 12 }}>
      {children}
    </span>
  )
}

// When `sectionId` is passed, the whole title row becomes the click target
// for that section's accordion (see openSections state below) — same
// header, same icon/text, just wrapped as a <button> with a chevron that
// rotates instead of a plain <div>. Every call site that doesn't pass it
// (rare — a couple of sections render their own custom header row) keeps
// rendering exactly as before.
function SecTitle({ icon, children, dark, sectionId, open, onToggle }: {
  icon: React.ReactNode; children: React.ReactNode; dark?: boolean
  sectionId?: string; open?: boolean; onToggle?: () => void
}) {
  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ color: dark ? PALETTE.cream : PALETTE.ink, opacity: 0.85 }}>{icon}</span>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: 'clamp(1.6rem,3.6vw,2.2rem)', margin: 0, color: dark ? PALETTE.cream : PALETTE.ink }}>{children}</h2>
    </div>
  )
  if (!onToggle) return <div style={{ marginBottom: 8 }}>{content}</div>
  return (
    <button data-section-trigger={sectionId} onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', marginBottom: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
      {content}
      <ChevronDown data-section-chevron size={20} color={dark ? PALETTE.cream : PALETTE.ink}
        style={{ opacity: 0.6, flexShrink: 0, transition: 'transform 0.2s ease', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
    </button>
  )
}

function stageForPct(pct: number): number {
  return pct >= 85 ? 4 : pct >= 60 ? 3 : pct >= 35 ? 2 : pct >= 10 ? 1 : 0
}
const GROWTH_LABELS = ['Just planted', 'First sprout', 'Taking root', 'Growing strong', 'In full bloom']

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

// A small, face-only cut of GrowthMascot's character — same head/ear
// shapes and palette so it reads as the same mascot at any size, just
// without the plant. Meant to be dropped into section headers and empty
// states for a bit of personality, with an expression that reacts to real
// patient progress rather than being purely decorative.
function MascotFace({ expression, size = 40, blinkDelay = 0 }: { expression: 'happy' | 'proud' | 'thinking'; size?: number; blinkDelay?: number }) {
  const mouthD = expression === 'proud' ? 'M43 65 Q56 79 69 65' : expression === 'thinking' ? 'M47 67 Q56 69 65 67' : 'M46 66 Q56 74 66 66'
  return (
    <svg data-mascot-face width={size} height={size * 0.9} viewBox="0 0 112 100" style={{ flexShrink: 0, animation: 'clpMascotBob 3.6s ease-in-out infinite', transformOrigin: '56px 90px' }}>
      <path d="M20 62 Q18 40 40 32 Q56 26 74 34 Q94 42 92 62" fill="none" stroke={PALETTE.berry} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18 62 Q56 78 94 62 Q90 84 56 86 Q22 84 18 62 Z" fill={PALETTE.gold2} stroke={PALETTE.berry} strokeWidth="2.2" />
      <g data-mascot-eyes style={{ transformOrigin: '56px 58px', animation: `clpMascotBlink 5.4s ease-in-out ${blinkDelay}s infinite` }}>
        {expression === 'proud' ? (
          <>
            <path d="M39 59 Q44 53 49 59" fill="none" stroke={PALETTE.ink} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M63 59 Q68 53 73 59" fill="none" stroke={PALETTE.ink} strokeWidth="2.4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="44" cy="58" r="3" fill={PALETTE.ink} />
            <circle cx="68" cy="58" r="3" fill={PALETTE.ink} />
          </>
        )}
      </g>
      {expression === 'thinking' && <path d="M38 49 Q43 45 49 47" fill="none" stroke={PALETTE.ink} strokeWidth="1.6" strokeLinecap="round" opacity={0.6} />}
      <path data-mascot-mouth d={mouthD} fill="none" stroke={PALETTE.ink} strokeWidth="2" strokeLinecap="round" style={{ transition: 'd 0.3s ease' }} />
      <path d="M40 30 Q38 18 30 12" fill="none" stroke={PALETTE.dusk1} strokeWidth="2" strokeLinecap="round" />
      <path d="M30 12 Q26 8 30 4 Q34 8 30 12" fill={PALETTE.dusk1} />
      <path d="M76 30 Q80 16 90 10" fill="none" stroke={PALETTE.dusk1} strokeWidth="2" strokeLinecap="round" />
      <path d="M90 10 Q86 6 90 2 Q94 6 90 10" fill={PALETTE.dusk1} />
    </svg>
  )
}

// Purely decorative, static (no animation, unlike MascotFace/GrowthMascot)
// hand-drawn food doodles — same original line-art language and PALETTE
// tokens as the rest of this file, no external image assets. Meant to sit
// behind hero copy or beside a food-related section header for a bit of
// warmth without competing for attention the way an animated element would.
function FoodDoodle({ kind, size = 48, style }: { kind: 'citrus' | 'leaf' | 'bowl'; size?: number; style?: CSSProperties }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true, style }
  if (kind === 'citrus') {
    return (
      <svg {...common}>
        <circle cx="32" cy="32" r="23" fill={PALETTE.gold2} stroke={PALETTE.berry} strokeWidth="2" />
        <g stroke={PALETTE.berry} strokeWidth="1.3" strokeLinecap="round">
          <path d="M32 11 L32 53" />
          <path d="M13 21 L51 43" />
          <path d="M13 43 L51 21" />
        </g>
        <circle cx="32" cy="32" r="23" fill="none" stroke={PALETTE.berry} strokeWidth="2" />
      </svg>
    )
  }
  if (kind === 'leaf') {
    return (
      <svg {...common}>
        <path d="M14 50 Q10 22 40 12 Q52 34 30 50 Q22 52 14 50 Z" fill={PALETTE.gold1} stroke={PALETTE.berry} strokeWidth="2" strokeLinejoin="round" />
        <path d="M16 48 Q30 34 40 14" fill="none" stroke={PALETTE.berry} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M10 28 Q32 40 54 28 L50 42 Q32 50 14 42 Z" fill={PALETTE.gold2} stroke={PALETTE.berry} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="32" cy="27" rx="22" ry="7" fill={PALETTE.dusk1} opacity={0.35} />
      <circle cx="24" cy="24" r="3" fill={PALETTE.berry} />
      <circle cx="34" cy="21" r="2.4" fill={PALETTE.berry} />
      <circle cx="41" cy="25" r="2.8" fill={PALETTE.berry} />
    </svg>
  )
}

function StreakFlame({ lit, pop }: { lit: boolean; pop: boolean }) {
  return (
    <svg data-streak-flame width="14" height="14" viewBox="0 0 24 24" style={{ animation: pop ? 'clpFlamePop 0.5s ease' : undefined }}>
      <path data-on-color={PALETTE.goldAccent} data-off-color="rgba(26,26,26,0.25)" d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"
        fill={lit ? PALETTE.goldAccent : 'rgba(26,26,26,0.25)'} style={{ transition: 'fill 0.3s ease' }} />
    </svg>
  )
}

const LIFESTYLE_PERIODS = ['Morning', 'Afternoon', 'Evening']
const MEAL_PERIODS = ['Breakfast', 'Lunch', 'Dinner']

export default function WeekEditorialTemplate({ shareToken, data, initialCheckins, editable = false, roadmapId }: {
  shareToken: string
  data: GuideData
  initialCheckins: Checkin[]
  // Inline coach editing, same contract as WeekTemplate: defaults closed,
  // and only the authenticated live-edit route ever opts in.
  editable?: boolean
  roadmapId?: string
}) {
  const firstName = data.patient.full_name?.split(' ')[0] || 'there'
  const coachFirst = data.coach?.full_name?.split(' ')[0] || 'your coach'
  const hiddenStyle = (id: string): CSSProperties => ((data.hiddenSections ?? []).includes(id) ? { display: 'none' } : {})
  const isHidden = (id: string) => (data.hiddenSections ?? []).includes(id)
  const parsed = useMemo(() => parseNutritionistGuidelines(data.roadmap.nutritionist_guidelines), [data.roadmap.nutritionist_guidelines])

  // Best-effort, fire-and-forget — local state already reflects the edit
  // optimistically, the same tolerance the grocery AI-cleanup fetch uses.
  function patchRoadmap(body: Record<string, unknown>) {
    if (!roadmapId) return
    fetch(`/api/compass/roadmaps/${roadmapId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => {})
  }

  // Local editable copies, seeded once from the real data — the same
  // per-period split/join round trip WeekTemplate and the Classic editor
  // use, so every editor serializes back to one storage format.
  const [lifestyleByPeriod, setLifestyleByPeriod] = useState<Record<string, string>>(() => splitIntoPeriods(data.dailyLifestyleGuidelines, LIFESTYLE_PERIODS))
  const [mealsByPeriod, setMealsByPeriod] = useState<Record<string, string>>(() => splitIntoPeriods(data.mealGuidelines, MEAL_PERIODS))
  const [dailyScheduleText, setDailyScheduleText] = useState(data.dailySchedule)
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
  // Time and activity edit as two separate single-line fields, and a
  // pasted newline is stripped — one schedule entry must stay one line in
  // storage or parseScheduleLines would split it and shift every index.
  function saveScheduleField(lineIndex: number, field: 'time' | 'text', nextValue: string) {
    const clean = nextValue.replace(/\s*\n\s*/g, ' ').trim()
    setDailyScheduleText((prev) => {
      const lines = parseScheduleLines(prev)
      const current = lines[lineIndex] ?? { time: '', text: '' }
      const nextEntry = field === 'time' ? { ...current, time: clean } : { ...current, text: clean }
      const updated = lines.map((item, i) => {
        const e = i === lineIndex ? nextEntry : item
        return e.time ? `${e.time} — ${e.text}` : e.text
      }).join('\n')
      patchRoadmap({ guide_overrides: { daily_schedule: updated } })
      return updated
    })
  }

  // This template only ever shows ONE week — the first one the plan has —
  // no month/week tabs, "Your roadmap" goes straight to its 7 days.
  const [weeklySchedule, setWeeklySchedule] = useState(data.roadmap.weekly_schedule ?? [])
  const week = useMemo(() => {
    const weeks = [...weeklySchedule].sort((a, b) => a.week_number - b.week_number)
    return weeks[0] ?? null
  }, [weeklySchedule])
  // A week with no per-day breakdown shares one `actions` list across all
  // 7 days, so editing any day there edits that shared list — matching what
  // is actually displayed rather than silently forking a per-day copy.
  function saveScheduleAction(dayIndex: number, actionIndex: number, next: string) {
    if (!week) return
    setWeeklySchedule((prev) => {
      const updated = prev.map((w) => {
        if (w.week_number !== week.week_number) return w
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

  const [openDay, setOpenDay] = useState<string | null>(null)
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(false)

  // Every content section on this page is a click-to-open accordion (closed
  // by default) — a single-week plan crams a lot into one scroll, and the
  // grocery list especially can run to 100+ items, so nothing renders until
  // the patient actually taps into it. Jumping via the TOC opens the target
  // section too, not just scrolls to its (otherwise-empty-looking) header.
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const isSectionOpen = (id: string) => openSections.has(id)
  const toggleSection = (id: string) => setOpenSections((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const openSection = (id: string) => setOpenSections((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))

  const today = todayISO()

  // Weekly goals stay keyed by action_index; Daily Health Check-in items
  // additionally get an item_id-based key so a coach editing or reordering
  // the checklist never reattaches a tick to a different item.
  const checkedSet = useMemo(() => {
    const set = new Set<string>()
    for (const c of checkins) {
      set.add(`${c.week_number}:${c.action_index}:${c.checkin_date}`)
      if (c.item_id) set.add(`${c.week_number}:item:${c.item_id}:${c.checkin_date}`)
    }
    return set
  }, [checkins])

  // Real, week-scoped adherence — same "no real match beats a fabricated
  // one" derivation every other template uses, just against one week
  // instead of a month roll-up.
  const progress = useMemo(() => {
    const dateSet = new Set(checkins.map((c) => c.checkin_date))
    let streak = 0
    let cursor = dateSet.has(today) ? today : shiftDateISO(today, -1)
    while (dateSet.has(cursor)) { streak++; cursor = shiftDateISO(cursor, -1) }
    if (!week) return { streak, totalDaysLogged: dateSet.size, totalActions: 0, doneActions: 0, pct: 0 }
    let total = 0
    let done = 0
    if (week.days && week.days.length > 0) {
      const validDates = new Set(DAY_LABELS.map((_, i) => dateForWeekDay(data.createdAt, week.week_number, i)))
      const perDay = week.days[0]?.length ?? week.actions?.length ?? 0
      total = week.days.reduce((n, d) => n + d.length, 0)
      done = checkins.filter((c) => c.week_number === week.week_number && c.action_index != null && c.action_index < perDay && validDates.has(c.checkin_date)).length
    } else {
      total = week.actions?.length ?? 0
      const doneKeys = new Set(checkins.map((c) => `${c.week_number}:${c.action_index}`))
      done = (week.actions ?? []).filter((_, i) => doneKeys.has(`${week.week_number}:${i}`)).length
    }
    return { streak, totalDaysLogged: dateSet.size, totalActions: total, doneActions: done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [checkins, week, today, data.createdAt])

  const totalActionsInPlan = progress.totalActions
  const goalsDone = progress.doneActions
  const adherencePct = progress.pct

  const [cheering, setCheering] = useState(false)
  const cheerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Shared by both the real weekly goals AND the Daily Health Check-in
  // checklist below (which uses the sentinel week_number 0 — real weeks
  // always start at 1, so 0 can never collide with a real week's goals,
  // and this reuses the exact same checkins table/endpoint with zero
  // schema changes).
  async function toggleGoal(weekNumber: number, actionIndex: number, date: string) {
    const key = `${weekNumber}:${actionIndex}:${date}`
    const wasChecked = checkedSet.has(key)
    if (!wasChecked && weekNumber !== 0) {
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

  // Daily Health Check-in — checklist built from this patient's REAL
  // supplements (confirmed by the coach) and a few real lifestyle-guideline
  // lines, never a generic placeholder list. Persists like every other
  // goal: real checkins table, week_number 0 sentinel, so the coach can see
  // exactly which days a patient actually did each one.
  // The real Daily Health Check-in list (lib/dailyChecklist.ts): AI-selected
  // at generation from this patient's confirmed supplements and lifestyle
  // guidelines, then coach-editable. Read from data rather than re-derived
  // here, so an edit a coach makes shows up on every template, not just Week.
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(data.dailyChecklistItems)
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
  // Daily Health Check-in progress for the selected date — drives both the
  // mascot's expression in the section header and the encouragement line
  // above the list.
  const checkinDoneCount = checklistItems.filter((it) => checkedSet.has(`0:item:${it.id}:${checkinDate}`)).length
  const checkinAllDone = checklistItems.length > 0 && checkinDoneCount === checklistItems.length
  const checkinNoneDone = checkinDoneCount === 0
  // Same sentinel week_number 0 and same endpoint as the weekly goals, but
  // keyed by the item's stable id rather than its position. Completing the
  // last item of the day fires the celebration the weekly goals already get.
  async function toggleDailyItem(item: { id: string; text: string }) {
    const key = `0:item:${item.id}:${checkinDate}`
    const wasChecked = checkedSet.has(key)
    if (!wasChecked && checklistItems.length > 0 && checkinDoneCount === checklistItems.length - 1) {
      setCheering(true)
      if (cheerTimeoutRef.current) clearTimeout(cheerTimeoutRef.current)
      cheerTimeoutRef.current = setTimeout(() => setCheering(false), 900)
    }
    const entry: Checkin = { week_number: 0, action_index: null, checkin_date: checkinDate, item_id: item.id, item_text_snapshot: item.text }
    const revert = () => setCheckins((prev) => wasChecked
      ? [...prev, entry]
      : prev.filter((c) => !(c.week_number === 0 && c.item_id === item.id && c.checkin_date === checkinDate)))
    setCheckins((prev) => wasChecked
      ? prev.filter((c) => !(c.week_number === 0 && c.item_id === item.id && c.checkin_date === checkinDate))
      : [...prev, entry])
    try {
      const r = await fetch(`/api/share/roadmap/${shareToken}/checkins`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_number: 0, item_id: item.id, item_text: item.text, date: checkinDate }),
      })
      if (!r.ok) revert()
    } catch {
      revert()
    }
  }

  // Water/energy/mood are small per-day numbers/text, not boolean
  // check-offs — stored on the roadmap row itself (guide_overrides.daily_metrics)
  // via a dedicated endpoint, same safe read-merge-write pattern the coach's
  // own "Save changes" already uses on that column.
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
    } catch { /* optimistic UI already updated; best-effort sync */ }
  }
  function adjustWater(delta: number) {
    saveMetric('water', Math.max(0, (metricsCache[checkinDate]?.water ?? 0) + delta))
  }
  function adjustEnergy(delta: number) {
    saveMetric('energy', Math.max(0, Math.min(10, (metricsCache[checkinDate]?.energy ?? 0) + delta)))
  }

  const [aiGroceryCache, setAiGroceryCache] = useState<Record<number, GroceryCategory[]>>({})
  const [boughtItems, setBoughtItems] = useState<Set<string>>(new Set())
  // The shopping list is the single longest section on this page (can run
  // to 100+ items across a week's worth of recipes) — collapsing the whole
  // section isn't enough on its own, so each category inside it is its own
  // little accordion too, closed by default, same click-to-open pattern.
  const [openGroceryCats, setOpenGroceryCats] = useState<Set<string>>(new Set())
  const toggleGroceryCat = (head: string) => setOpenGroceryCats((prev) => {
    const next = new Set(prev)
    if (next.has(head)) next.delete(head)
    else next.add(head)
    return next
  })
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

  const [groceryOverride, setGroceryOverride] = useState<GroceryCategory[] | null>(data.groceryListOverride)
  useEffect(() => {
    if (!week || groceryOverride) return
    const wn = week.week_number
    if (aiGroceryCache[wn]) return
    const weekRecipes = getSlotRecipes(wn, DAY_MEAL_SLOTS, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank, 'Picked for your plan.').flatMap((s) => s.matches).map((mm) => mm.recipe)
    const candidateItems = buildGroceryList(weekRecipes).flatMap((cat) => cat.items.map((name) => ({ name, category: cat.head })))
    if (candidateItems.length === 0) return
    let cancelled = false
    fetch('/api/share/grocery-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: candidateItems }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j || !Array.isArray(j.categories) || j.categories.length === 0) return
        setAiGroceryCache((prev) => ({ ...prev, [wn]: j.categories }))
      })
      .catch(() => { /* keep the regex-based list on failure */ })
    return () => { cancelled = true }
  }, [week, groceryOverride, aiGroceryCache, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank])
  const weekGroceryRecipes = useMemo(() => {
    if (!week) return []
    return getSlotRecipes(week.week_number, DAY_MEAL_SLOTS, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank, 'Picked for your plan.')
      .flatMap((s) => s.matches).map((mm) => mm.recipe)
  }, [week, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank])
  // A coach-edited list wins over the computed one, so an edit made in any
  // template shows up on whichever skin the patient actually sees.
  const groceryCats = useMemo(() => {
    if (groceryOverride) return groceryOverride
    if (!week) return []
    const computed = aiGroceryCache[week.week_number] ?? buildGroceryList(weekGroceryRecipes)
    return computed.length > 0 ? computed : GROCERY_CATEGORIES
  }, [groceryOverride, week, aiGroceryCache, weekGroceryRecipes])
  function saveGroceryList(next: GroceryCategory[]) {
    setGroceryOverride(next)
    patchRoadmap({ guide_overrides: { grocery_list_override: next } })
  }
  function saveGroceryItemText(catHead: string, itemIndex: number, next: string) {
    saveGroceryList(groceryCats.map((cat) => (cat.head === catHead ? { ...cat, items: cat.items.map((it, i) => (i === itemIndex ? next : it)) } : cat)))
  }
  function removeGroceryItem(catHead: string, itemIndex: number) {
    saveGroceryList(groceryCats
      .map((cat) => (cat.head === catHead ? { ...cat, items: cat.items.filter((_, i) => i !== itemIndex) } : cat))
      .filter((cat) => cat.items.length > 0))
  }
  function addGroceryItem(catHead: string) {
    saveGroceryList(groceryCats.map((cat) => (cat.head === catHead ? { ...cat, items: [...cat.items, 'New item'] } : cat)))
  }
  function saveGroceryCategoryName(oldHead: string, next: string) {
    saveGroceryList(groceryCats.map((cat) => (cat.head === oldHead ? { ...cat, head: next } : cat)))
  }
  function removeGroceryCategory(head: string) {
    saveGroceryList(groceryCats.filter((cat) => cat.head !== head))
  }
  function addGroceryCategory() {
    saveGroceryList([...groceryCats, { head: 'New category', items: ['New item'] }])
  }
  function resetGroceryList() {
    setGroceryOverride(null)
    patchRoadmap({ guide_overrides: { grocery_list_override: null } })
  }

  const [openService, setOpenService] = useState<number | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [founderOpen, setFounderOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)

  // Same "no real match beats a fabricated one" tag-matched photo as Classic
  // — a plain icon tile shows instead if nothing in the picture bank fits.
  const whyImage = useMemo(() => {
    return matchGuideImageDistinct('motivation why reflection goal mindset determination doodle illustration', data.imageBank, new Set())
  }, [data.imageBank])

  function downloadDashboard() {
    const root = document.getElementById("week-editorial-export-root")
    if (!root) return
    const clone = root.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[data-no-export]').forEach((el) => el.remove())
    clone.querySelectorAll('[data-hidden-section]').forEach((el) => el.remove())
    clone.querySelectorAll('[data-day-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleDay('${el.getAttribute('data-day-trigger')}', this)`))
    clone.querySelectorAll('[data-slot-trigger]').forEach((el) => el.setAttribute('onclick', `clpOpenSlot('${el.getAttribute('data-slot-trigger')}')`))
    clone.querySelectorAll('[data-slot-back]').forEach((el) => el.setAttribute('onclick', 'clpCloseSlot()'))
    clone.querySelectorAll('[data-recipe-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleRecipe('${el.getAttribute('data-recipe-trigger')}')`))
    clone.querySelectorAll('[data-meal-trigger]').forEach((el) => el.setAttribute('onclick', `clpSetMealTab('${el.getAttribute('data-meal-trigger')}')`))
    clone.querySelectorAll('[data-faq-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleFaq('${el.getAttribute('data-faq-trigger')}')`))
    clone.querySelectorAll('[data-care-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleCare('${el.getAttribute('data-care-trigger')}')`))
    clone.querySelectorAll('[data-toc-trigger]').forEach((el) => el.setAttribute('onclick', 'clpToggleToc()'))
    clone.querySelectorAll('[data-toc-link]').forEach((el) => {
      const targetId = (el.getAttribute('href') || '').replace('#', '')
      el.setAttribute('onclick', `clpCloseToc(); clpOpenSection('${targetId}')`)
    })
    clone.querySelectorAll('[data-toc-panel]').forEach((el) => ((el as HTMLElement).style.display = 'none'))
    // Every section header is a collapsed-by-default accordion (see
    // openSections state) — same toggle handler regardless of which section,
    // the chevron rotation is driven by a shared CSS class rather than
    // swapping icons, so one function covers all of them.
    clone.querySelectorAll('[data-section-trigger]').forEach((el) => el.setAttribute('onclick', `clpToggleSection('${el.getAttribute('data-section-trigger')}')`))
    clone.querySelectorAll('[data-grocery-cat-trigger]').forEach((el) => {
      const key = (el.getAttribute('data-grocery-cat-trigger') || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      el.setAttribute('onclick', `clpToggleGroceryCat('${key}')`)
    })
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
    clone.querySelectorAll('[data-water-inc]').forEach((el) => el.setAttribute('onclick', 'clpAdjustMetric(\'water\', 1)'))
    clone.querySelectorAll('[data-water-dec]').forEach((el) => el.setAttribute('onclick', 'clpAdjustMetric(\'water\', -1)'))
    clone.querySelectorAll('[data-energy-inc]').forEach((el) => el.setAttribute('onclick', 'clpAdjustMetric(\'energy\', 1)'))
    clone.querySelectorAll('[data-energy-dec]').forEach((el) => el.setAttribute('onclick', 'clpAdjustMetric(\'energy\', -1)'))
    clone.querySelectorAll('[data-checkin-date]').forEach((el) => el.setAttribute('onchange', 'clpSetCheckinDate(this.value)'))
    clone.querySelectorAll('[data-mood-input]').forEach((el) => el.setAttribute('oninput', 'clpSaveMood(this.value)'))
    clone.querySelectorAll('[style*="position: sticky"]').forEach((el) => ((el as HTMLElement).style.position = 'static'))

    const monthsData = week ? [{
      monthNumber: 1, monthLabel: 'This week',
      weeks: [{ week_number: week.week_number, totalActions: week.days?.length ? week.days.reduce((n, d) => n + d.length, 0) : (week.actions?.length ?? 0) }],
    }] : []
    const script = buildInlineExportScript({
      shareToken, monthsData,
      colors: { ink: PALETTE.ink, inkSoft: PALETTE.ink, muted: 'rgba(26,26,26,0.55)', accent: PALETTE.berry, accentSoft: 'rgba(139,58,58,0.08)', border: PALETTE.line, onAccent: '#fff' },
    })
    const dailyMetricsJson = JSON.stringify(metricsCache).replace(/</g, '\\u003c')
    const weekMetaJson = JSON.stringify({ weekNumber: week?.week_number ?? 1, checklistCount: checklistItems.length, todayISO: today }).replace(/</g, '\\u003c')
    const title = (data.patient?.full_name || 'Your') + "'s Week Plan, Living Plus"
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
<script>
var CLP_DAILY_METRICS_KEY = 'clp-daily-metrics-${shareToken}';
var CLP_WEEK_META = ${weekMetaJson};
var CLP_CHECKIN_DATE = CLP_WEEK_META.todayISO;
function clpGetDailyMetrics(){ try { return JSON.parse(localStorage.getItem(CLP_DAILY_METRICS_KEY) || 'null') || ${dailyMetricsJson}; } catch(e){ return ${dailyMetricsJson}; } }
function clpSetDailyMetrics(m){ try { localStorage.setItem(CLP_DAILY_METRICS_KEY, JSON.stringify(m)); } catch(e){} }
function clpRenderMetrics(){
  var all = clpGetDailyMetrics();
  var m = all[CLP_CHECKIN_DATE] || {};
  var w = document.querySelector('[data-water-value]'); if (w) w.textContent = m.water || 0;
  var e = document.querySelector('[data-energy-value]'); if (e) e.textContent = m.energy || 0;
  var mood = document.querySelector('[data-mood-input]'); if (mood) mood.value = m.mood || '';
}
function clpAdjustMetric(field, delta){
  var all = clpGetDailyMetrics();
  var m = all[CLP_CHECKIN_DATE] || {};
  var next = (m[field] || 0) + delta;
  if (field === 'water') next = Math.max(0, next);
  if (field === 'energy') next = Math.max(0, Math.min(10, next));
  m[field] = next;
  all[CLP_CHECKIN_DATE] = m;
  clpSetDailyMetrics(all);
  clpRenderMetrics();
}
function clpSaveMood(value){
  var all = clpGetDailyMetrics();
  var m = all[CLP_CHECKIN_DATE] || {};
  m.mood = value;
  all[CLP_CHECKIN_DATE] = m;
  clpSetDailyMetrics(all);
}
function clpSetCheckinDate(value){ CLP_CHECKIN_DATE = value; clpRenderMetrics(); }
clpRenderMetrics();
function clpSectionChevron(id){ var trig = document.querySelector('[data-section-trigger="' + id + '"]'); return trig ? trig.querySelector('[data-section-chevron]') : null; }
function clpToggleSection(id){
  var body = document.querySelector('[data-section-body="' + id + '"]');
  if (!body) return;
  var willOpen = body.style.display !== 'block';
  body.style.display = willOpen ? 'block' : 'none';
  var chevron = clpSectionChevron(id);
  if (chevron) chevron.style.transform = willOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
}
function clpOpenSection(id){
  var body = document.querySelector('[data-section-body="' + id + '"]');
  if (!body || body.style.display === 'block') return;
  body.style.display = 'block';
  var chevron = clpSectionChevron(id);
  if (chevron) chevron.style.transform = 'rotate(0deg)';
}
function clpToggleGroceryCat(head){
  var body = document.querySelector('[data-grocery-cat-body="' + head + '"]');
  if (!body) return;
  var willOpen = body.style.display !== 'block';
  body.style.display = willOpen ? 'block' : 'none';
  var trig = document.querySelector('[data-grocery-cat-trigger="' + head + '"]');
  var chevron = trig ? trig.querySelector('[data-grocery-cat-chevron]') : null;
  if (chevron) chevron.style.transform = willOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
}
</script>
<script>${script}</script>
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(data.patient?.full_name || 'client').replace(/\s+/g, '-')}-week-editorial-plan.html`
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
    <div id="week-editorial-export-root" style={{ background: PALETTE.paper1, minHeight: '100vh', fontFamily: "'Source Sans 3', sans-serif", color: PALETTE.ink, WebkitFontSmoothing: 'antialiased' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href={FONT_LINK} rel="stylesheet" />
      <a href={`/roadmaps/${shareToken}/edit`} data-no-export style={{ display: 'none' }} />
      <style>{`
        @keyframes clpMascotBob { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-4px) rotate(-1.5deg); } }
        @keyframes clpMascotCheer { 0% { transform: translateY(0) scale(1) rotate(0deg); } 30% { transform: translateY(-14px) scale(1.08) rotate(-4deg); } 55% { transform: translateY(-6px) scale(1.04) rotate(3deg); } 100% { transform: translateY(0) scale(1) rotate(0deg); } }
        @keyframes clpFlamePop { 0% { transform: scale(1); } 40% { transform: scale(1.22) rotate(-4deg); } 100% { transform: scale(1) rotate(0deg); } }
        @keyframes clpMascotBlink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.12); } }
        @media (prefers-reduced-motion: reduce) { [data-mascot-idle], [data-mascot-face], [data-mascot-eyes], [data-streak-flame] { animation: none !important; } }
        section[id] { scroll-margin-top: 64px; }
      `}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(250,247,242,0.92)', backdropFilter: 'blur(6px)', borderBottom: `1px solid ${PALETTE.line}`, padding: '10px 1.5rem' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', position: 'relative' }}>
          <button data-toc-trigger onClick={() => setTocOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Source Sans 3', monospace", fontSize: 11.5, fontWeight: 600, color: PALETTE.ink, background: PALETTE.gold1, border: `1px solid ${PALETTE.line}`, borderRadius: 20, padding: '7px 14px', cursor: 'pointer' }}>
            Jump to section <ChevronDown size={13} style={{ transform: tocOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          <div data-toc-panel style={{ display: tocOpen ? 'grid' : 'none', position: 'absolute', top: '100%', left: 0, marginTop: 6, gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))', gap: '2px 12px', background: PALETTE.paper1, border: `1px solid ${PALETTE.line}`, borderRadius: 12, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', maxHeight: '70vh', overflowY: 'auto', zIndex: 31 }}>
            {TOC_ITEMS.filter((item) => !isHidden(item.id)).map((item, i) => (
              <a key={`${item.id}-${i}`} data-toc-link href={`#${item.id}`} onClick={() => { setTocOpen(false); openSection(item.id) }}
                style={{ fontFamily: "'Source Sans 3', monospace", fontSize: 11.5, fontWeight: 600, color: PALETTE.ink, opacity: 0.75, textDecoration: 'none', padding: '8px 9px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Hero */}
      <section style={{ padding: '5rem 1.5rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <FoodDoodle kind="citrus" size={54} style={{ position: 'absolute', top: 28, left: '6%', opacity: 0.5, transform: 'rotate(-12deg)', pointerEvents: 'none' }} />
        <FoodDoodle kind="leaf" size={46} style={{ position: 'absolute', top: 60, right: '7%', opacity: 0.5, transform: 'rotate(10deg)', pointerEvents: 'none' }} />
        <FoodDoodle kind="bowl" size={50} style={{ position: 'absolute', bottom: 14, left: '11%', opacity: 0.45, transform: 'rotate(-6deg)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 920, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: PALETTE.berry, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontWeight: 700, fontFamily: "'Source Sans 3', monospace", fontSize: 13 }}>LP</div>
          <Eyebrow>Living Plus · One week</Eyebrow>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: 'clamp(2.2rem,6vw,3.6rem)', lineHeight: 1.05, letterSpacing: '-0.01em', margin: 0 }}>
            Hi {firstName},<br />here&apos;s your week
          </h1>
          <div style={{ marginTop: '1.1rem', fontFamily: "'Source Sans 3', monospace", fontSize: '0.85rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry }}>{data.goalLabel}</div>

          <div style={{ margin: '2.5rem 0 0.5rem' }}>
            <GrowthMascot pct={adherencePct} cheering={cheering} />
          </div>
          <div data-growth-caption style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6 }}>
            {totalActionsInPlan > 0 ? <>{GROWTH_LABELS[stageForPct(adherencePct)]} · <span data-goals-done>{goalsDone}</span>/{totalActionsInPlan} goals tracked</> : 'Your progress plant, check off goals in your week to grow it'}
          </div>
        </div>
      </section>

      {/* Daily Health Check-in — the one section from the reference layout
          this template was asked to bring over. Checklist items are this
          patient's real supplements + real lifestyle-guideline lines (never
          generic placeholders); water/energy/mood are logged per real date. */}
      <section id="checkin" style={{ background: PALETTE.paper2, padding: '4rem 1.5rem', ...hiddenStyle('checkin') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 12 }}>
              <MascotFace expression={checkinAllDone ? 'proud' : checkinNoneDone ? 'thinking' : 'happy'} size={44} blinkDelay={0.7} />
              <div>
                <Eyebrow>Daily accountability</Eyebrow>
                <SecTitle icon={<CheckCircle2 size={26} />} sectionId="checkin" open={isSectionOpen('checkin')} onToggle={() => toggleSection('checkin')}>Daily Health Check-in</SecTitle>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {editable && (
                <button type="button" onClick={() => setConfirmRegenerate(true)} disabled={regenerating}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, padding: '8px 12px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: PALETTE.paper1, color: PALETTE.berry, cursor: regenerating ? 'default' : 'pointer', opacity: regenerating ? 0.6 : 1 }}>
                  <Sparkles size={13} /> {regenerating ? 'Regenerating…' : 'Ask AI to regenerate'}
                </button>
              )}
              <input data-checkin-date type="date" value={checkinDate} onChange={(e) => setCheckinDate(e.target.value)}
                style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.8rem', background: PALETTE.paper1, border: `1px solid ${PALETTE.line}`, padding: '9px 12px', borderRadius: 10, color: PALETTE.ink, fontWeight: 600 }} />
            </div>
          </div>

          {confirmRegenerate && (
            <div style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${PALETTE.berry}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem' }}>Regenerate from this patient&apos;s current supplements and lifestyle guidelines? Any manual edits to the checklist will be overwritten.</span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={() => setConfirmRegenerate(false)}
                  style={{ fontSize: '0.78rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: `1px solid ${PALETTE.line}`, background: 'transparent', color: PALETTE.ink, cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={regenerateChecklist}
                  style={{ fontSize: '0.78rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: 'none', background: PALETTE.berry, color: '#fff', cursor: 'pointer' }}>Regenerate</button>
              </div>
            </div>
          )}
          <div data-section-body="checkin" style={{ display: isSectionOpen('checkin') ? 'block' : 'none' }}>
          {checklistItems.length > 0 && (
            <p style={{ fontSize: '0.82rem', color: PALETTE.berry, opacity: 0.85, fontWeight: 600, margin: '-6px 0 16px' }}>
              {checkinAllDone
                ? 'Everything checked off for today — nice work.'
                : checkinNoneDone
                ? 'Nothing logged yet today — tap an item below to check in.'
                : `${checkinDoneCount} of ${checklistItems.length} done so far today.`}
            </p>
          )}
          {checklistItems.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {checklistItems.map((item) => {
                const checked = checkedSet.has(`0:item:${item.id}:${checkinDate}`)
                return (
                  <div key={item.id} data-goal-toggle={`0:item:${item.id}:${checkinDate}`} onClick={() => { if (!editable) toggleDailyItem(item) }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '13px 16px', borderRadius: 14, cursor: 'pointer', border: `1px solid ${checked ? PALETTE.berry : PALETTE.line}`, background: checked ? 'rgba(139,58,58,0.08)' : 'rgba(255,255,255,0.4)', transition: 'background 0.15s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span data-goal-icon-done style={{ display: checked ? 'inline-flex' : 'none', flexShrink: 0 }}><CheckCircle2 size={18} color={PALETTE.berry} /></span>
                      <span data-goal-icon-undone style={{ display: checked ? 'none' : 'inline-flex', flexShrink: 0 }}><Circle size={18} opacity={0.4} /></span>
                      {editable ? (
                        <InlineEditableText editable value={item.text} onSave={(next) => saveChecklistItemText(item.id, next)}
                          style={{ fontSize: '0.88rem', fontWeight: 500, color: PALETTE.ink, flex: 1 }} />
                      ) : (
                        <span data-goal-text style={{ fontSize: '0.88rem', fontWeight: 500, color: checked ? PALETTE.berry : PALETTE.ink, textDecoration: checked ? 'line-through' : 'none' }}>{item.text}</span>
                      )}
                    </div>
                    {editable ? (
                      <span role="button" onClick={(e) => { e.stopPropagation(); removeChecklistItem(item.id) }} title="Remove"
                        style={{ display: 'inline-flex', color: PALETTE.berry, opacity: 0.6, cursor: 'pointer', flexShrink: 0 }}><X size={15} /></span>
                    ) : (
                      <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: checked ? PALETTE.berry : 'rgba(139,58,58,0.08)', color: checked ? '#fff' : PALETTE.berry, flexShrink: 0 }}>{checked ? 'Done' : 'Pending'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Once {coachFirst} confirms your supplements or lifestyle guidelines, your daily checklist will show up here.</p>
          )}
          {editable && (
            <button type="button" onClick={addChecklistItem}
              style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${PALETTE.line}`, background: 'none', color: PALETTE.berry, cursor: 'pointer' }}>
              + Add task
            </button>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.4)', border: `1px solid ${PALETTE.line}`, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry, marginBottom: 10 }}><Droplet size={13} /> Water (glasses)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button data-water-dec data-no-export onClick={() => adjustWater(-1)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: PALETTE.gold1, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>−</button>
                <span data-water-value style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 600 }}>{todayMetrics.water || 0}</span>
                <button data-water-inc data-no-export onClick={() => adjustWater(1)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: PALETTE.gold1, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.4)', border: `1px solid ${PALETTE.line}`, borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry, marginBottom: 10 }}><Zap size={13} /> Energy (1-10)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button data-energy-dec data-no-export onClick={() => adjustEnergy(-1)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: PALETTE.gold1, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>−</button>
                <span data-energy-value style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 600 }}>{todayMetrics.energy || 0}</span>
                <button data-energy-inc data-no-export onClick={() => adjustEnergy(1)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: PALETTE.gold1, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.4)', border: `1px solid ${PALETTE.line}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry, marginBottom: 10 }}>Mood &amp; reflection</div>
              <input data-mood-input value={moodDraft} onChange={(e) => setMoodDraft(e.target.value)} onBlur={() => saveMetric('mood', moodDraft)}
                placeholder="e.g. Calm and focused today"
                style={{ width: '100%', background: PALETTE.paper1, border: `1px solid ${PALETTE.line}`, borderRadius: 10, padding: '8px 10px', fontSize: '0.85rem', fontFamily: "'Source Sans 3', sans-serif", color: PALETTE.ink }} />
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Founder's note */}
      <section id="founder" style={{ background: PALETTE.paper2, padding: '4rem 1.5rem', ...hiddenStyle('founder') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Eyebrow>A note from the founder</Eyebrow>
          <SecTitle icon={<HeartPulse size={26} />} sectionId="founder" open={isSectionOpen('founder')} onToggle={() => toggleSection('founder')}>Founder&apos;s Note</SecTitle>
          <div data-section-body="founder" style={{ display: isSectionOpen('founder') ? 'block' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginTop: 20 }}>
            <button data-founder-trigger onClick={() => setFounderOpen((v) => !v)}
              style={{ width: 64, height: 64, borderRadius: 32, flexShrink: 0, background: PALETTE.berry, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              RS
            </button>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 500, marginTop: -8 }}>Roshni Sanghvi</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.65, marginTop: 2 }}>Founder, Living Plus</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.55, marginTop: 8 }}>Tap the photo to read the note</div>
            </div>
          </div>
          <div data-founder-body style={{ display: founderOpen ? 'block' : 'none', marginTop: 20, fontSize: '0.95rem', lineHeight: 1.75 }}>
            {data.founderNote.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
          </div>
          </div>
        </div>
      </section>

      {/* Coach */}
      {data.coach && (
        <section id="coach" style={{ background: PALETTE.paper2, borderTop: `1px solid ${PALETTE.line}`, borderBottom: `1px solid ${PALETTE.line}`, padding: '3rem 1.5rem', ...hiddenStyle('coach') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Eyebrow>Your coach</Eyebrow>
            <SecTitle icon={<MessageCircle size={26} />} sectionId="coach" open={isSectionOpen('coach')} onToggle={() => toggleSection('coach')}>Meet Your Coach</SecTitle>
            <div data-section-body="coach" style={{ display: isSectionOpen('coach') ? 'flex' : 'none', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginTop: 10 }}>
              <button data-coach-trigger onClick={() => data.coachQuote && setCoachOpen((v) => !v)}
                style={{ width: 64, height: 64, borderRadius: 32, flexShrink: 0, background: data.coach.photo_url ? `url(${data.coach.photo_url}) center/cover` : PALETTE.gold1, border: `1px solid ${PALETTE.line}`, padding: 0, cursor: data.coachQuote ? 'pointer' : 'default' }} />
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 500 }}>{data.coach.full_name}</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.65, marginTop: 2 }}>{data.coach.designation}</div>
                {data.coachQuote && (
                  <>
                    <div style={{ fontSize: '0.72rem', opacity: 0.55, marginTop: 8 }}>Tap the photo for a note from {coachFirst}</div>
                    <div data-coach-body style={{ display: coachOpen ? 'block' : 'none', marginTop: 6, fontStyle: 'italic', color: PALETTE.berry, fontSize: '0.92rem', maxWidth: 560 }}>&ldquo;{renderMarkdownBold(data.coachQuote)}&rdquo;</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Care team */}
      {data.careTeam.length > 0 && (
        <section id="careteam" style={{ background: PALETTE.paper3, padding: '4rem 1.5rem', ...hiddenStyle('careteam') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Eyebrow>Beyond your coach</Eyebrow>
            <SecTitle icon={<HeartPulse size={26} />} sectionId="careteam" open={isSectionOpen('careteam')} onToggle={() => toggleSection('careteam')}>Your care team</SecTitle>
            <div data-section-body="careteam" style={{ display: isSectionOpen('careteam') ? 'flex' : 'none', marginTop: 24, flexDirection: 'column', gap: 24 }}>
              {data.careTeam.map((m, i) => (
                <div key={i} style={i > 0 ? { paddingTop: 24, borderTop: `1px solid ${PALETTE.line}` } : undefined}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 500 }}>{m.name}</div>
                  {m.role && <div style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry, marginTop: 4 }}>{m.role}</div>}
                  {m.intro && <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>{renderMarkdownBold(m.intro)}</p>}
                  {m.date && (
                    <div style={{ fontSize: '0.85rem', color: PALETTE.berry, fontWeight: 600, marginTop: 10 }}>
                      {new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {m.time && ` · ${new Date(`2000-01-01T${m.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How to use this guide + Your why */}
      <section id="howto" style={{ background: PALETTE.gold1, padding: '4rem 1.5rem', ...hiddenStyle('howto') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Eyebrow>Getting oriented</Eyebrow>
          <SecTitle icon={<HelpCircle size={26} />} sectionId="howto" open={isSectionOpen('howto')} onToggle={() => toggleSection('howto')}>How To Use Your Plan</SecTitle>
          <div data-section-body="howto" style={{ display: isSectionOpen('howto') ? 'block' : 'none' }}>
          <p style={{ marginTop: 16, marginBottom: 20, fontSize: '0.95rem', fontWeight: 600, color: PALETTE.berry }}>Follow → Track → Adjust</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
            {[
              { icon: MapPin, title: 'This week', text: 'Check your goals and meals for the week.' },
              { icon: CheckCircle2, title: 'Each day', text: 'Tick off what you complete, including your daily check-in above.' },
              { icon: HelpCircle, title: 'Need help?', text: 'Message ' + coachFirst + ' if something doesn’t work for you.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(139,58,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
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
            {data.whyReflection ? (
              <p style={{ fontSize: '0.95rem', lineHeight: 1.65 }}>{renderMarkdownBold(data.whyReflection)}</p>
            ) : (
              <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Not filled in yet.</p>
            )}
          </div>
          </div>
        </div>
      </section>

      {/* Daily lifestyle guidelines — coach-editable (Ask AI or type your
          own in the Classic editor), defaults to this roadmap's own
          lifestyle_guidelines text so it's never empty on a plan that
          already has guidance. Groups into Morning/Afternoon/Evening cards
          when the text uses those labels, otherwise one flat list. */}
      {LIFESTYLE_PERIODS.some((label) => parseBullets(lifestyleByPeriod[label] || '').length > 0) && (
        <section id="lifestyle" style={{ background: PALETTE.paper3, padding: '4rem 1.5rem', ...hiddenStyle('lifestyle') }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Eyebrow>Morning · Afternoon · Evening</Eyebrow>
            <SecTitle icon={<Sun size={26} />} sectionId="lifestyle" open={isSectionOpen('lifestyle')} onToggle={() => toggleSection('lifestyle')}>Daily Lifestyle Guidelines</SecTitle>
            <div data-section-body="lifestyle" style={{ display: isSectionOpen('lifestyle') ? 'block' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
                {LIFESTYLE_PERIODS.map((label) => ({ label, items: parseBullets(lifestyleByPeriod[label] || '') })).filter((g) => g.items.length > 0).map((g) => (
                  <div key={g.label} style={{ background: 'rgba(255,255,255,0.4)', border: `1px solid ${PALETTE.line}`, borderRadius: 14, padding: '18px 20px' }}>
                    <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: PALETTE.berry, fontWeight: 700 }}>{g.label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                      {g.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <Circle size={13} color={PALETTE.berry} opacity={0.6} style={{ flexShrink: 0, marginTop: 3 }} />
                          {editable ? (
                            <InlineEditableText editable value={item}
                              onSave={(next) => (LIFESTYLE_PERIODS.includes(g.label) ? saveLifestyleItem(g.label, i, next) : saveMealItem(g.label, i, next))}
                              style={{ fontSize: '0.88rem', lineHeight: 1.5, flex: 1 }} />
                          ) : (
                            <span style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>{renderMarkdownBold(item)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Breakfast, Lunch & Dinner — same pattern as lifestyle above,
          defaults to the real "Diet protocol" bullets already parsed out
          of nutritionist_guidelines. */}
      {MEAL_PERIODS.some((label) => parseBullets(mealsByPeriod[label] || '').length > 0) && (
        <section id="meals" style={{ background: PALETTE.paper2, padding: '4rem 1.5rem', ...hiddenStyle('meals') }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FoodDoodle kind="bowl" size={40} />
              <div>
                <Eyebrow>On the plate</Eyebrow>
                <SecTitle icon={<Utensils size={26} />} sectionId="meals" open={isSectionOpen('meals')} onToggle={() => toggleSection('meals')}>Breakfast, Lunch &amp; Dinner</SecTitle>
              </div>
            </div>
            <div data-section-body="meals" style={{ display: isSectionOpen('meals') ? 'block' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
                {MEAL_PERIODS.map((label) => ({ label, items: parseBullets(mealsByPeriod[label] || '') })).filter((g) => g.items.length > 0).map((g) => (
                  <div key={g.label} style={{ background: 'rgba(255,255,255,0.4)', border: `1px solid ${PALETTE.line}`, borderRadius: 14, padding: '18px 20px' }}>
                    <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: PALETTE.berry, fontWeight: 700 }}>{g.label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                      {g.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <Circle size={13} color={PALETTE.berry} opacity={0.6} style={{ flexShrink: 0, marginTop: 3 }} />
                          {editable ? (
                            <InlineEditableText editable value={item}
                              onSave={(next) => (LIFESTYLE_PERIODS.includes(g.label) ? saveLifestyleItem(g.label, i, next) : saveMealItem(g.label, i, next))}
                              style={{ fontSize: '0.88rem', lineHeight: 1.5, flex: 1 }} />
                          ) : (
                            <span style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>{renderMarkdownBold(item)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Daily schedule — the one section here with no existing data to
          default from (a real time-blocked day is genuinely new
          information), so it just doesn't render until the coach writes
          one or clicks Ask AI. */}
      {(dailyScheduleText.trim() || editable) && (
        <section id="schedule" style={{ background: PALETTE.dusk1, padding: '4rem 1.5rem', ...hiddenStyle('schedule') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Eyebrow dark>Your one day</Eyebrow>
            <SecTitle dark icon={<CalendarCheck size={26} color={PALETTE.cream} />} sectionId="schedule" open={isSectionOpen('schedule')} onToggle={() => toggleSection('schedule')}>Daily Schedule</SecTitle>
            <div data-section-body="schedule" style={{ display: isSectionOpen('schedule') ? 'block' : 'none', marginTop: 24 }}>
              <div style={{ position: 'relative', paddingLeft: 40 }}>
                {/* One continuous connecting line behind every icon dot —
                    the "flow map" read comes from this plus a distinct icon
                    per activity type (meal/walk/breath/sleep/etc.), not
                    just a plain circle per row. */}
                <div style={{ position: 'absolute', left: 15, top: 8, bottom: 8, width: 2, background: 'rgba(250,247,242,0.22)' }} />
                {parseScheduleLines(dailyScheduleText).map((item, i, arr) => {
                  const Icon = iconForScheduleItem(item.text)
                  return (
                    <div key={i} style={{ position: 'relative', marginBottom: i < arr.length - 1 ? 26 : 0 }}>
                      <span style={{ position: 'absolute', left: -40, top: 0, width: 32, height: 32, borderRadius: 16, background: PALETTE.gold1, color: PALETTE.dusk1, border: `2px solid ${PALETTE.dusk1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                        <Icon size={15} />
                      </span>
                      {(item.time || editable) && (
                        <div style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.78rem', fontWeight: 700, color: PALETTE.gold1 }}>{editable ? <InlineEditableText editable value={item.time} placeholder="Time" onSave={(next) => saveScheduleField(i, 'time', next)} /> : item.time}</div>
                      )}
                      <div style={{ color: PALETTE.cream, opacity: 0.92, fontSize: '0.92rem', lineHeight: 1.5, marginTop: 2 }}>{editable ? <InlineEditableText editable value={item.text} placeholder="Activity" onSave={(next) => saveScheduleField(i, 'text', next)} /> : item.text}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Power points — coach-pasted links each with a short note */}
      {data.powerPoints.filter((pp) => pp.url).length > 0 && (
        <section id="nutrition" style={{ background: PALETTE.paper3, padding: '4rem 1.5rem', ...hiddenStyle('nutrition') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Eyebrow>Worth a look</Eyebrow>
            <SecTitle icon={<LinkIcon size={26} />} sectionId="nutrition" open={isSectionOpen('nutrition')} onToggle={() => toggleSection('nutrition')}>Your Power Points</SecTitle>
            <div data-section-body="nutrition" style={{ display: isSectionOpen('nutrition') ? 'flex' : 'none', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              {data.powerPoints.filter((pp) => pp.url).map((pp, i) => (
                <a key={i} href={pp.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 14, textDecoration: 'none', color: PALETTE.ink, padding: '14px 16px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: 'rgba(255,255,255,0.35)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(139,58,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LinkIcon size={16} color={PALETTE.berry} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {pp.note && <div style={{ fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 3 }}>{renderMarkdownBold(pp.note)}</div>}
                    <div style={{ fontSize: '0.8rem', color: PALETTE.berry, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pp.url}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Your roadmap — one week only, straight to the day accordion, no
          month/week tabs since there's exactly one week to show. */}
      {week && (
        <section id="roadmap" style={{ background: PALETTE.dusk1, padding: '4rem 1.5rem', ...hiddenStyle('roadmap') }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Eyebrow dark>Your one week</Eyebrow>
            <SecTitle dark icon={<MapPin size={26} color={PALETTE.cream} />} sectionId="roadmap" open={isSectionOpen('roadmap')} onToggle={() => toggleSection('roadmap')}>Your Roadmap</SecTitle>
            <div data-section-body="roadmap" style={{ display: isSectionOpen('roadmap') ? 'block' : 'none' }}>
            <p style={{ color: PALETTE.cream, opacity: 0.75, fontSize: '0.92rem', marginTop: 12, marginBottom: 24 }}>{week.focus_theme}</p>

            {(week.actions?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1, opacity: 0.85 }}>Sunday to Saturday, this week&apos;s goals</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {DAY_LABELS.map((day, dayIndex) => {
                    const dayId = `${week.week_number}-${day}`
                    const isDayOpen = openDay === dayId
                    const dayDate = dateForWeekDay(data.createdAt, week.week_number, dayIndex)
                    return (
                      <div key={day} style={{ border: '1px solid rgba(250,247,242,0.22)', borderRadius: 12, overflow: 'hidden' }}>
                        <button data-day-trigger={dayId} onClick={() => setOpenDay(isDayOpen ? null : dayId)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.95rem', fontWeight: 500, color: PALETTE.cream }}>{day}</span>
                          {isDayOpen ? <ChevronDown size={16} color={PALETTE.gold1} /> : <ChevronRight size={16} color={PALETTE.cream} opacity={0.5} />}
                        </button>
                        <div data-day-body={dayId} style={{ display: isDayOpen ? 'block' : 'none', padding: '0 14px 14px' }}>
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                            {(week.days?.[dayIndex] ?? week.actions ?? []).map((action, ai) => {
                              const checked = checkedSet.has(`${week.week_number}:${ai}:${dayDate}`)
                              return (
                                <li key={ai} data-goal-toggle={`${week.week_number}:${ai}:${dayDate}`} onClick={() => { if (!editable) toggleGoal(week.week_number, ai, dayDate) }}
                                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 8, padding: '2px 0' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}>
                                    <circle data-goal-check-track data-on-color={PALETTE.gold1} data-off-color="rgba(250,247,242,0.4)" cx="12" cy="12" r="10" fill="none" stroke={checked ? PALETTE.gold1 : 'rgba(250,247,242,0.4)'} strokeWidth="2" style={{ transition: 'stroke 0.25s ease' }} />
                                    <circle data-goal-check-fill cx="12" cy="12" r="10" fill={PALETTE.gold1} style={{ opacity: checked ? 1 : 0, transition: 'opacity 0.25s ease' }} />
                                    <path data-goal-check-tick d="M7 12.5 10.5 16 17 8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                                      strokeDasharray="16" style={{ strokeDashoffset: checked ? 0 : 16, transition: 'stroke-dashoffset 0.35s ease 0.05s' }} />
                                  </svg>
                                  {editable ? (
                                    <InlineEditableText editable value={action} onSave={(next) => saveScheduleAction(dayIndex, ai, next)}
                                      style={{ color: PALETTE.cream, fontSize: '0.92rem', lineHeight: 1.6, flex: 1 }} />
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
              const weekSlotRecipes = getSlotRecipes(week.week_number, DAY_MEAL_SLOTS, data.weeklyManualRecipes, data.manualRecipes, weekMealMatches, data.recipeBank, 'Picked for your plan.')
              return (
                <div>
                  <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1, opacity: 0.85 }}>Recipes for the week</span>
                  <div data-slot-list style={{ display: openSlot == null ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 10 }}>
                    {weekSlotRecipes.map(({ slot, matches }) => {
                      const slotId = `${week.week_number}-${slot}`
                      return (
                        <button key={slot} data-slot-trigger={slotId} onClick={() => setOpenSlot(slotId)}
                          style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 12, cursor: 'pointer', border: '1px solid rgba(250,247,242,0.22)', background: 'rgba(250,247,242,0.08)' }}>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9rem', fontWeight: 500, color: PALETTE.cream }}>{SLOT_LABELS[slot]}</div>
                          <div style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.72rem', color: matches.length ? PALETTE.gold1 : PALETTE.cream, opacity: matches.length ? 1 : 0.5, marginTop: 4, fontWeight: 600 }}>
                            {matches.length ? `${matches.length} recipe${matches.length === 1 ? '' : 's'}` : `Not detected yet, ${coachFirst} will add some.`}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {weekSlotRecipes.map(({ slot, matches }) => {
                    const slotId = `${week.week_number}-${slot}`
                    return (
                    <div key={slot} data-slot-body={slotId} style={{ display: openSlot === slotId ? 'block' : 'none', marginTop: 16 }}>
                      <button data-slot-back onClick={() => setOpenSlot(null)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: PALETTE.gold1, fontFamily: "'Source Sans 3', monospace", fontSize: '0.78rem', fontWeight: 700, padding: 0, marginBottom: 12 }}>
                        ← Back to meal slots
                      </button>
                      <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1, opacity: 0.85, display: 'block', marginBottom: 10 }}>{SLOT_LABELS[slot]}, picked for your plan</span>
                      {matches.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                          {matches.map(({ recipe }) => {
                            const recipeKey = `${week.week_number}-${slot}-${recipe.id}`
                            return (
                            <button key={recipeKey} data-recipe-trigger={recipeKey} onClick={() => setOpenRecipeId(openRecipeId === recipeKey ? null : recipeKey)}
                              style={{ textAlign: 'left', padding: 0, cursor: 'pointer', background: openRecipeId === recipeKey ? 'rgba(224,195,132,0.16)' : 'rgba(250,247,242,0.08)', border: `1px solid ${openRecipeId === recipeKey ? PALETTE.gold1 : 'rgba(250,247,242,0.22)'}`, borderRadius: 12, overflow: 'hidden' }}>
                              {recipe.image_url ? (
                                <img src={recipe.image_url} alt={recipe.name} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                              ) : (
                                <div style={{ width: '100%', height: 100, background: 'rgba(250,247,242,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

                      {matches.map(({ recipe }) => {
                        const recipeKey = `${week.week_number}-${slot}-${recipe.id}`
                        return (
                        <div key={recipeKey} data-recipe-body={recipeKey} style={{ display: openRecipeId === recipeKey ? 'block' : 'none', marginTop: 14, background: 'rgba(250,247,242,0.06)', border: `1px solid ${PALETTE.gold1}`, borderRadius: 14, padding: '1.75rem', position: 'relative' }}>
                          <button onClick={() => setOpenRecipeId(null)} data-no-export style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: PALETTE.cream, opacity: 0.6 }}><X size={18} /></button>
                          <div style={{ display: 'grid', gridTemplateColumns: recipe.image_url ? '1fr 1.3fr' : '1fr', gap: 24 }}>
                            {recipe.image_url && <img src={recipe.image_url} alt={recipe.name} style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 320 }} />}
                            <div>
                              {recipe.protein_label && <Eyebrow dark>{recipe.protein_label}</Eyebrow>}
                              <h3 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: '1.4rem', color: PALETTE.cream, margin: '0 0 16px' }}>{recipe.name}</h3>
                              <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1 }}>Ingredients</span>
                              <ul style={{ listStyle: 'none', margin: '8px 0 16px', padding: 0 }}>
                                {splitRecipeLines(recipe.ingredients).map((line, i) => (
                                  <li key={i} style={{ color: PALETTE.cream, opacity: 0.9, fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 4 }}>{line}</li>
                                ))}
                              </ul>
                              <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1 }}>Directions</span>
                              <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                                {splitRecipeLines(recipe.steps).map((line, i) => (
                                  <li key={i} style={{ color: PALETTE.cream, opacity: 0.9, fontSize: '0.88rem', lineHeight: 1.65, marginBottom: 6 }}>{line}</li>
                                ))}
                              </ol>
                              {recipe.benefits && recipe.benefits.length > 0 && (
                                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(250,247,242,0.18)' }}>
                                  <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.gold1 }}>Why it works</span>
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
          </div>
        </section>
      )}

      {/* Supplements */}
      {data.confirmedSupplements.length > 0 && (
        <section id="supplements" style={{ background: PALETTE.dusk2, padding: '4rem 1.5rem', ...hiddenStyle('supplements') }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Eyebrow dark>Confirmed by {coachFirst}</Eyebrow>
            <SecTitle dark icon={<Pill size={26} color={PALETTE.cream} />} sectionId="supplements" open={isSectionOpen('supplements')} onToggle={() => toggleSection('supplements')}>Your Supplement Plan</SecTitle>
            <div data-section-body="supplements" style={{ display: isSectionOpen('supplements') ? 'block' : 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 20 }}>
              {data.confirmedSupplements.map((s, i) => (
                <div key={i} style={{ background: 'rgba(250,247,242,0.06)', border: '1px solid rgba(250,247,242,0.22)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ color: PALETTE.cream, fontWeight: 600, fontSize: '0.95rem' }}>{s.name}</div>
                  <div style={{ color: PALETTE.cream, opacity: 0.75, fontSize: '0.85rem', marginTop: 4 }}>{[s.dose, s.timing, s.duration].filter(Boolean).join(' · ')}</div>
                  {s.notes && <div style={{ color: PALETTE.gold1, fontSize: '0.8rem', marginTop: 6 }}>⚠ {s.notes}</div>}
                </div>
              ))}
            </div>
            <div style={{ color: PALETTE.cream, opacity: 0.5, fontSize: '0.78rem', marginTop: 16 }}>Don&apos;t start, stop, or change a dose without confirming with {coachFirst} first.</div>
            </div>
          </div>
        </section>
      )}

      {/* Shopping list */}
      <section id="grocery" style={{ background: PALETTE.paper2, padding: '4rem 1.5rem', ...hiddenStyle('grocery') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Eyebrow>What to buy</Eyebrow>
          <SecTitle icon={<ShoppingCart size={26} />} sectionId="grocery" open={isSectionOpen('grocery')} onToggle={() => toggleSection('grocery')}>Your Shopping List</SecTitle>
          <div data-section-body="grocery" style={{ display: isSectionOpen('grocery') ? 'block' : 'none' }}>
          {editable && groceryOverride && (
            <button type="button" onClick={resetGroceryList}
              style={{ marginTop: 14, fontSize: '0.75rem', fontWeight: 700, padding: '7px 12px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: 'transparent', color: PALETTE.berry, cursor: 'pointer' }}>
              Reset to auto-generated list
            </button>
          )}
          <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: 16, marginBottom: 20 }}>{editable ? 'Pulled from your matched recipes — edit any item, or add your own.' : 'Pulled straight from the ingredients of your matched recipes. Tap a category to see its items.'}</p>
          {!week ? (
            <p style={{ fontSize: '0.9rem', opacity: 0.6 }}>Not planned yet, check back once your coach generates your roadmap.</p>
          ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
                {groceryCats.map((cat) => {
                  const catOpen = openGroceryCats.has(cat.head)
                  return (
                  <div key={cat.head}>
                    <button data-grocery-cat-trigger={cat.head} onClick={() => toggleGroceryCat(cat.head)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', gap: 6 }}>
                      {editable ? (
                        <InlineEditableText editable value={cat.head} onSave={(next) => saveGroceryCategoryName(cat.head, next)}
                          style={{ fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry }} />
                      ) : (
                        <span style={{ fontFamily: "'Source Sans 3', monospace", fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: PALETTE.berry }}>{cat.head} · {cat.items.length}</span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {editable && (
                          <span role="button" onClick={(e) => { e.stopPropagation(); removeGroceryCategory(cat.head) }} title="Remove category"
                            style={{ display: 'inline-flex', color: PALETTE.berry, opacity: 0.6, cursor: 'pointer' }}><X size={13} /></span>
                        )}
                        <ChevronDown data-grocery-cat-chevron size={14} color={PALETTE.berry}
                          style={{ opacity: 0.7, transition: 'transform 0.2s ease', transform: catOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                      </div>
                    </button>
                    <ul data-grocery-cat-body={cat.head} style={{ display: catOpen ? 'block' : 'none', listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                      {cat.items.map((item, itemIndex) => {
                        const itemKey = `${week.week_number}:${cat.head}:${item}`
                        const bought = boughtItems.has(itemKey)
                        return (
                          <li key={itemIndex} data-grocery-item={itemKey} onClick={() => { if (!editable) toggleBought(itemKey) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', opacity: bought ? 0.45 : 0.8, padding: '3px 0', cursor: 'pointer' }}>
                            <span data-grocery-icon-done style={{ display: bought ? 'inline-flex' : 'none', flexShrink: 0 }}><CheckCircle2 size={13} color={PALETTE.berry} /></span>
                            <span data-grocery-icon-undone style={{ display: bought ? 'none' : 'inline-flex', flexShrink: 0 }}><Circle size={13} opacity={0.5} /></span>
                            {editable ? (
                              <>
                                <InlineEditableText editable value={item} onSave={(next) => saveGroceryItemText(cat.head, itemIndex, next)}
                                  style={{ flex: 1 }} />
                                <span role="button" onClick={() => removeGroceryItem(cat.head, itemIndex)} title="Remove"
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
                          <button type="button" onClick={() => addGroceryItem(cat.head)}
                            style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', fontWeight: 700, padding: 0, border: 'none', background: 'none', color: PALETTE.berry, cursor: 'pointer', opacity: 0.8 }}>
                            + Add item
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                  )
                })}
                {editable && (
                  <button type="button" onClick={addGroceryCategory}
                    style={{ alignSelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, padding: '8px 14px', borderRadius: 10, border: `1px dashed ${PALETTE.line}`, background: 'none', color: PALETTE.berry, cursor: 'pointer' }}>
                    + Add category
                  </button>
                )}
              </div>
          )}
          </div>
        </div>
      </section>

      {/* What's included in your care */}
      {data.careServices.length > 0 && (
        <section id="services" style={{ background: PALETTE.paper3, padding: '4rem 1.5rem', ...hiddenStyle('services') }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Eyebrow>Your plan</Eyebrow>
            <SecTitle icon={<Star size={26} />} sectionId="services" open={isSectionOpen('services')} onToggle={() => toggleSection('services')}>What&apos;s Included In Your Care</SecTitle>
            <div data-section-body="services" style={{ display: isSectionOpen('services') ? 'block' : 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 20 }}>
              {data.careServices.map((svc, i) => {
                const Icon = CARE_ICON_MAP[svc.icon] || Star
                const isOpen = openService === i
                return (
                  <button key={i} data-care-trigger={i} onClick={() => setOpenService(isOpen ? null : i)}
                    style={{ textAlign: 'left', padding: '14px 12px', borderRadius: 12, cursor: 'pointer', border: `1px solid ${isOpen ? PALETTE.berry : PALETTE.line}`, background: isOpen ? 'rgba(139,58,58,0.06)' : 'rgba(255,255,255,0.35)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: PALETTE.gold1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                      <Icon size={16} color={PALETTE.ink} />
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{svc.name}</div>
                    {svc.sessions && <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 2 }}>{svc.sessions}</div>}
                  </button>
                )
              })}
            </div>
            {data.careServices.map((svc, i) => svc.description && (
              <div key={i} data-care-body={i} style={{ display: openService === i ? 'block' : 'none', marginTop: 16, padding: '16px 18px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: 'rgba(255,255,255,0.35)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{svc.name}</div>
                <p style={{ fontSize: '0.87rem', lineHeight: 1.55, margin: 0 }}>{renderMarkdownBold(svc.description || '')}</p>
              </div>
            ))}
            </div>
          </div>
        </section>
      )}

      {/* Track your progress */}
      <section id="track" style={{ background: PALETTE.gold1, padding: '4rem 1.5rem', ...hiddenStyle('track') }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Eyebrow>Real numbers, not a guess</Eyebrow>
          <SecTitle icon={<CheckCircle2 size={26} />} sectionId="track" open={isSectionOpen('track')} onToggle={() => toggleSection('track')}>Track Your Progress</SecTitle>
          <div data-section-body="track" style={{ display: isSectionOpen('track') ? 'block' : 'none' }}>
          <p data-track-empty style={{ fontSize: '0.9rem', opacity: 0.65, marginTop: 16, display: progress.totalDaysLogged === 0 ? 'block' : 'none' }}>No check-ins logged yet, tap a goal above each day you complete it, and your progress will show up here.</p>
          <div data-track-content style={{ display: progress.totalDaysLogged === 0 ? 'none' : 'block' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>
              {[
                { key: 'streak', icon: <StreakFlame lit={progress.streak > 0} pop={cheering} />, value: progress.streak, label: 'day streak' },
                { key: 'days', icon: <CalendarCheck size={14} />, value: progress.totalDaysLogged, label: 'days logged, total' },
                { key: 'goals', icon: <Target size={14} />, value: `${goalsDone}/${totalActionsInPlan}`, label: 'goals accomplished' },
                { key: 'best', icon: <TrendingUp size={14} />, value: `${progress.pct}%`, label: 'this week' },
              ].map((s) => (
                <div key={s.key} style={{ flex: '1 1 130px', padding: '12px 14px', borderRadius: 10, border: `1px solid ${PALETTE.line}`, background: 'rgba(255,255,255,0.35)' }}>
                  <span style={{ color: PALETTE.berry }}>{s.icon}</span>
                  <div data-stat={s.key} style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 8 }}>{s.value}</div>
                  <div data-stat-label={s.key} style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* When to reach us */}
      <section id="reach" style={{ background: PALETTE.night1, padding: '4rem 1.5rem', ...hiddenStyle('reach') }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Eyebrow dark>Reach us</Eyebrow>
          <SecTitle dark icon={<Phone size={26} color={PALETTE.cream} />} sectionId="reach" open={isSectionOpen('reach')} onToggle={() => toggleSection('reach')}>When To Reach Us</SecTitle>
          <div data-section-body="reach" style={{ display: isSectionOpen('reach') ? 'block' : 'none' }}>
          {data.nextAppointment.date ? (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: PALETTE.gold1, fontFamily: "'Source Sans 3', monospace", fontSize: '0.85rem', marginBottom: 14 }}>
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
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: PALETTE.night2, padding: '4rem 1.5rem 6rem', ...hiddenStyle('faq') }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Eyebrow dark>Questions we hear most</Eyebrow>
          <SecTitle dark icon={<HelpCircle size={26} color={PALETTE.cream} />} sectionId="faq" open={isSectionOpen('faq')} onToggle={() => toggleSection('faq')}>FAQ</SecTitle>
          <div data-section-body="faq" style={{ display: isSectionOpen('faq') ? 'block' : 'none' }}>
          <div style={{ marginTop: 20 }}>
            {[
              ['What if I can’t finish everything on my plate exactly as shown?', 'Getting the food groups roughly right matters far more than hitting exact portions.'],
              ['What if I miss a day on my daily check-in?', 'Log what actually happened, not what you wish had happened. An honest gap tells your coach more than a perfect-looking week.'],
              ['Can I eat something that’s not on the lists?', 'Yes, the lists are what to lean on, not a ban on everything else. Ask your coach if unsure.'],
            ].map(([q, a], i) => {
              const isOpen = openFaq === i
              return (
                <div key={i} style={{ borderBottom: i < 2 ? '1px solid rgba(250,247,242,0.18)' : 'none' }}>
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
          <div style={{ color: PALETTE.cream, opacity: 0.4, fontSize: '0.75rem', marginTop: 40, fontFamily: "'Source Sans 3', monospace" }}>Living Plus Pvt Ltd™</div>
          </div>
        </div>
      </section>
      {data.canvasBlocks.length > 0 && (
        <section style={{ background: PALETTE.paper1, padding: '2rem 1.5rem' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
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
    </div>
  )
}
