import { groqChatCompletion } from '@/lib/groq'
import { getGoodExample } from './generationExamples'
import { DIET_RULE, stripDietLabels } from '@/lib/dietRules'
import { STANDARD_LIFESTYLE_GUIDELINES, STANDARD_MEAL_GUIDELINES } from './standardDailyContent'

// A real, coach-approved example gets shown to the model as a style
// reference, never as content to copy — appended to the prompt only when
// one exists (a brand-new clinic has none yet, and that's fine, the
// prompt's own rules are the floor either way). See generationExamples.ts
// for what "approved" means here (a coach saved this exact text unedited).
function exampleBlock(example: string | null): string {
  return example
    ? `\n\nEXAMPLE OF THE RIGHT LENGTH AND STYLE (a coach kept this as written for a different patient — match its brevity and tone, do not reuse its content):\n${example}`
    : ''
}


// Shared by roadmap generation (interpret/route.ts Steps 3/3B/3C) and the
// coach-triggered "Regenerate" action on an existing roadmap's Daily
// Lifestyle Guidelines / Breakfast-Lunch-Dinner / Daily Schedule sections
// (regenerate-daily-content/route.ts) — one source of truth for these three
// fields, so an existing roadmap regenerated later ends up identical to a
// freshly generated one, regardless of which template (Week-family or
// Classic/Almanac/Pulse/Onyx/Vitals) it uses.
export async function generateDailyContent(patientFacts: string, kbContext: string) {
  const scheduleExample = await getGoodExample('daily_schedule')

  // Lifestyle guidelines and meal guidelines are now the clinic's own fixed
  // standard (see standardDailyContent.ts) on every roadmap, not an
  // AI-personalized guess — a coach can still edit, add to, or replace any
  // line afterward (Pick/Link/Picture/Ask AI all still work per-field), but
  // every dashboard starts from the same clinically-approved baseline
  // instead of drifting per-patient. Only the daily schedule stays
  // AI-generated below, since it's a real per-patient timeline (actual work
  // hours, meal timing) that a fixed template can't represent.
  const lifestyle_guidelines = STANDARD_LIFESTYLE_GUIDELINES
  const meal_guidelines = STANDARD_MEAL_GUIDELINES

  const scheduleRes = await groqChatCompletion({
    model: 'openai/gpt-oss-20b',
    reasoning_effort: 'low',
    messages: [
      { role: 'system', content: `Clinical nutritionist writing a patient's full daily schedule, start of day to sleep, using ONLY the facts given. This is a visual timeline the patient scans in seconds, not a paragraph — every activity is a short label, never a run-on sentence. Never name a supplement, dose, or product that is not explicitly listed in the patient facts below. Output one line per time block, no other text. Never use an em dash (—) inside an activity description; use a comma instead — the em dash character is reserved as the separator between the time and the activity. ${DIET_RULE}` },
      { role: 'user', content: `PATIENT FACTS (use ONLY these — do not add any supplement, dose, or product not named here):
${patientFacts}

KB:
${kbContext || 'Use expertise.'}

Write this patient's full daily schedule, from wake-up to sleep, personalized to their actual condition, program, and constraints from the facts above (their real work hours, meal timing, symptoms, habits).
Each line must be exactly: "<time> — <activity>", e.g. "7:30 AM — Wake up, drink water." or "2:00 PM — Lunch, then a 15-minute walk."
Rules:
- EXACTLY 12 time blocks, no more, no fewer, covering the whole day in chronological order, real clock times (e.g. "7:30 AM", "2:00 PM"), never a range
- Under 8 words per activity — ONE primary action per line, at most one short add-on ("Lunch, then a walk," not "Lunch: 2 parts protein, 2 parts vegetables... incorporating a small serving of brown rice")
- Specific over generic within that word limit ("Sunlight, 10 minutes" not "Get some sunlight"), but specific never means longer — cut detail before cutting the word limit
- Never chain three or more things with commas/"and" into one activity — if a time block needs more than one action, that's a sign to split it into its own line instead (you have 12 lines; use them)
- Ground every activity in the patient's real facts: their actual symptoms, condition, work hours, and eating patterns
- FORBIDDEN: naming any supplement, medication, or dose (e.g. "magnesium 400mg", "vitamin D") unless that exact supplement is already named in PATIENT FACTS above — if no supplement is mentioned in the facts, write none into the schedule at all
- If a fact describes a habit tied to a symptom or negative consequence (e.g. "consciously contracting muscles to fall asleep, contributing to morning stiffness"), the schedule must prescribe the CORRECTIVE opposite of that habit, never a rephrased version of the harmful habit itself — do not tell the patient to keep doing the thing identified as causing their problem
- Include real anchors every day needs: wake time, meals (breakfast/lunch/dinner), hydration, movement, and a wind-down/sleep routine — personalized to this patient's condition, not a generic list
- No explanation, no headers, no numbering, no bullet characters

Return only the 12 time-block lines, one per line, nothing else.${exampleBlock(scheduleExample)}` }
    ],
    temperature: 0.3,
    max_tokens: 500,
  })
  const daily_schedule = stripDietLabels(scheduleRes.choices[0]?.message?.content?.trim() ?? '')

  return { lifestyle_guidelines, meal_guidelines, daily_schedule }
}
