import type { GuideData, Coach, DayMealSlot } from './ClientGuideDocument'
import type { GuideImage } from './matchGuideImage'
import type { BankRecipe } from './matchRecipes'
import type { ChecklistPageBlock } from '../blocks/types'
import { parseNutritionistGuidelines } from './parseNutritionistGuidelines'
import { buildDeterministicChecklist, type ChecklistItem } from '../dailyChecklist'

// goalLabel is a complete, capitalized, period-terminated sentence — this
// strips the trailing period so it reads correctly spliced mid-sentence.
function asPhrase(sentence: string): string {
  return sentence.trim().replace(/\.+$/, '')
}

// The deterministic floor for dailySchedule — same role as the grocery
// list's regex extraction relative to its AI cleanup pass: zero patient
// data needed, always available, guaranteed non-empty. Shown only when
// neither the AI-generated roadmap.daily_schedule nor a coach's manual
// override exists yet (an older roadmap generated before this feature
// existed, or one whose generation call failed) — never patient-specific,
// so it's never confused for real personalized guidance.
const STANDARD_DAILY_SCHEDULE = [
  '7:00 AM — Wake up, hydrate with a glass of water.',
  '7:30 AM — Morning sunlight exposure, 10 minutes.',
  '8:00 AM — Light movement or stretching.',
  '9:00 AM — Breakfast.',
  '1:00 PM — Lunch, followed by a 15 minute walk.',
  '4:00 PM — Hydration check-in and a light snack.',
  '6:00 PM — Evening movement or exercise.',
  '8:00 PM — Dinner, lighter and earlier than lunch.',
  '9:00 PM — Screens off, wind-down routine begins.',
  '10:00 PM — Lights out.',
].join('\n')

// The founder's note personalizes itself with the patient's name and goal
// until a coach actually edits it — once edited, it's the coach's own text
// verbatim (same "override wins, else compute a real default" pattern as
// whyReflection/coachQuote above), not a template with placeholders to fill.
function defaultFounderNote(firstName: string, goalLabel: string): string {
  return [
    `${firstName},`,
    `This plan wasn't templated, a coach spent real time on your actual life before a single recommendation in here was chosen.`,
    `We'll be watching for every small win on the way to ${asPhrase(goalLabel.toLowerCase())}. That's not a formality here, it's the whole point of this place.`,
    `Come find us when something in here surprises you, or doesn't sit right. We'd love to hear it.`,
  ].join('\n\n')
}

// Shared by the editable preview page and the PDF download route, so both
// always resolve the same content the same way (WYSIWYG) — guide_overrides
// wins over the derived defaults when a coach has explicitly edited a field.
export type RoadmapRow = {
  created_at: string
  overview: string | null
  lifestyle_guidelines: string | null
  meal_guidelines?: string | null
  daily_schedule?: string | null
  daily_checklist_items?: ChecklistItem[] | null
  nutritionist_guidelines: string | null
  kb_sources: GuideData['roadmap']['kb_sources'] | null
  weekly_schedule: GuideData['roadmap']['weekly_schedule'] | null
  duration_months: number
  guide_overrides: { goal_label?: string; why_reflection?: string; coach_quote?: string; founder_note?: string; manual_recipes?: Partial<Record<DayMealSlot, string[]>>; weekly_manual_recipes?: Record<number, Partial<Record<DayMealSlot, string[]>>>; theme?: string; template?: string; care_services?: GuideData['careServices']; next_appointment?: GuideData['nextAppointment']; care_team?: GuideData['careTeam']; hidden_sections?: string[]; daily_metrics?: GuideData['dailyMetrics']; power_points?: GuideData['powerPoints']; canvas_blocks?: ChecklistPageBlock[]; daily_lifestyle_guidelines?: string; meal_guidelines?: string; daily_schedule?: string; daily_checklist_items?: ChecklistItem[] } | null
  patients: (Omit<GuideData['patient'], never> & { nutritionists: Coach | null }) | null
  sessions: { case_summary: { goal?: string; coach_quote?: string } | null } | null
}

export function buildGuideData(
  roadmap: RoadmapRow,
  imageBank: GuideImage[] = [],
  recipeBank: BankRecipe[] = [],
  confirmedSupplements: GuideData['confirmedSupplements'] = []
): GuideData {
  const overrides = roadmap.guide_overrides ?? {}
  // Priority: coach's manual edit > the AI's motivating one-liner from the
  // case summary > the raw problem statement, as a last resort for sessions
  // generated before the "goal" field existed.
  const goalLabel = overrides.goal_label
    || roadmap.sessions?.case_summary?.goal
    || roadmap.patients?.primary_concern
    || 'Feeling like yourself again'
  const firstName = roadmap.patients?.full_name?.split(' ')[0] ?? 'there'
  // Real, already-AI-written content — reused as the default so these two
  // Week-family sections are never empty on a plan that already has
  // lifestyle/diet guidance, without generating anything new.
  const dietProtocolBullets = parseNutritionistGuidelines(roadmap.nutritionist_guidelines ?? '').dietProtocol
  return {
    patient: roadmap.patients as GuideData['patient'],
    coach: roadmap.patients?.nutritionists ?? null,
    roadmap: {
      overview: roadmap.overview ?? '',
      lifestyle_guidelines: roadmap.lifestyle_guidelines ?? '',
      nutritionist_guidelines: roadmap.nutritionist_guidelines ?? '',
      kb_sources: roadmap.kb_sources ?? [],
      weekly_schedule: roadmap.weekly_schedule ?? [],
      duration_months: roadmap.duration_months,
    },
    goalLabel,
    whyReflection: overrides.why_reflection || (roadmap.overview ?? '').split('\n\n')[0] || goalLabel,
    coachQuote: overrides.coach_quote || roadmap.sessions?.case_summary?.coach_quote || '',
    founderNote: overrides.founder_note || defaultFounderNote(firstName, goalLabel),
    imageBank,
    recipeBank,
    manualRecipes: overrides.manual_recipes ?? {},
    weeklyManualRecipes: overrides.weekly_manual_recipes ?? {},
    theme: overrides.theme || 'classic',
    template: overrides.template || 'classic',
    createdAt: roadmap.created_at,
    confirmedSupplements,
    careServices: overrides.care_services ?? [],
    nextAppointment: overrides.next_appointment ?? { date: '', time: '', mode: '' },
    careTeam: overrides.care_team ?? [],
    hiddenSections: overrides.hidden_sections ?? [],
    dailyMetrics: overrides.daily_metrics ?? {},
    powerPoints: overrides.power_points ?? [],
    canvasBlocks: overrides.canvas_blocks ?? [],
    dailyLifestyleGuidelines: overrides.daily_lifestyle_guidelines ?? roadmap.lifestyle_guidelines ?? '',
    // roadmap.meal_guidelines is the dedicated Breakfast/Lunch/Dinner
    // generation (Step 3B in interpret/route.ts); dietProtocolBullets is
    // the pre-v37 fallback for roadmaps generated before that step existed.
    mealGuidelines: overrides.meal_guidelines ?? roadmap.meal_guidelines ?? dietProtocolBullets.join('\n'),
    // roadmap.daily_schedule is the AI-generated, patient-personalized
    // timeline (Step 3C); STANDARD_DAILY_SCHEDULE is the generic,
    // zero-personalization floor for roadmaps generated before that step
    // existed, or where the generation call failed — never nothing.
    dailySchedule: overrides.daily_schedule ?? roadmap.daily_schedule ?? STANDARD_DAILY_SCHEDULE,
    // roadmap.daily_checklist_items is the AI-selected/phrased checklist
    // (Step 3E), grounded in confirmedSupplements + lifestyle_guidelines,
    // never invented. The deterministic fallback below uses the exact same
    // two real sources — same grounding, just computed with fixed
    // source-and-index IDs instead of an AI pass, for roadmaps generated
    // before this step existed or when generation failed.
    dailyChecklistItems: overrides.daily_checklist_items
      ?? roadmap.daily_checklist_items
      ?? buildDeterministicChecklist(confirmedSupplements, roadmap.lifestyle_guidelines ?? ''),
  }
}
