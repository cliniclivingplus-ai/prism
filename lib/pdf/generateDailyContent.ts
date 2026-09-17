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
export async function generateDailyContent(
  patientFacts: string,
  kbContext: string,
  customLifestyle?: string,
  customMealGuidelines?: string,
  customMealRecipes?: string
) {
  const scheduleExample = await getGoodExample('daily_schedule')

  const lifestyle_guidelines = customLifestyle?.trim() || STANDARD_LIFESTYLE_GUIDELINES
  const meal_guidelines = customMealGuidelines?.trim() || STANDARD_MEAL_GUIDELINES

  const scheduleRes = await groqChatCompletion({
    model: 'openai/gpt-oss-20b',
    reasoning_effort: 'low',
    messages: [
      {
        role: 'system',
        content: `Clinical nutritionist writing a personalized patient's full daily schedule (start-of-day to sleep) based on their consultation transcripts, notes, lifestyle guidelines, and meal guidelines. Output a clean visual time-block schedule that the patient can scan in seconds. Output one line per time block. Never name a supplement, dose, or product that is not explicitly listed in the facts below. Never use an em dash (—) inside an activity description; use a comma instead. The em dash is reserved strictly as the separator between the time and the activity. ${DIET_RULE}`
      },
      {
        role: 'user',
        content: `PATIENT TRANSCRIPTS, NOTES & CLINICAL FACTS:
${patientFacts}

DAILY LIFESTYLE GUIDELINES FOR THIS PATIENT:
${lifestyle_guidelines}

BREAKFAST, LUNCH & DINNER GUIDELINES:
${meal_guidelines}
${customMealRecipes ? `\nPRESCRIBED MEALS & PREPARATIONS:\n${customMealRecipes}` : ''}

KB CONTEXT:
${kbContext || 'Use clinical expertise.'}

Write this patient's full daily schedule, from their actual start-of-day wake-up time to sleep.

TIMING & PERSONALIZATION RULES:
1. INDIVIDUAL START OF DAY: Everyone's day starts differently (e.g. early 5:00 AM risers vs 7:00 AM risers vs 9:30 AM risers vs night-shift workers). Carefully parse the patient transcripts, notes, and facts for when THIS specific patient actually wakes up, sleeps, and works. Start the schedule at their real wake-up time. DO NOT default everyone to 7:00 AM or 7:30 AM.
2. CHRONOLOGICAL 12 TIME BLOCKS: Generate exactly 12 time blocks in strictly chronological order covering their entire waking day from wake-up to lights out (e.g., "5:30 AM — Wake up, warm water with lemon.").
3. INTEGRATE LIFESTYLE GUIDELINES: Weave their Daily Lifestyle Guidelines (morning sunlight, movement, hydration, post-meal walks, wind-down routine) naturally into the schedule at appropriate time slots relative to their wake time.
4. INTEGRATE BREAKFAST, LUNCH & DINNER: Weave Breakfast, Lunch, Dinner, and Snack timings naturally relative to their wake time (e.g., Breakfast 30-60 mins post-wake, Lunch mid-day, Dinner 3-4 hours before sleep). Include specific recommended items/drinks if specified (e.g. morning amla shot, herbal tea).
5. BREVITY & GROUNDING: Under 8 words per activity line. One primary action per line with at most one short add-on. Ground every action in their real condition and habits.
6. STRICT FORMAT: Each line must be exactly "<time> — <activity>", e.g. "6:00 AM — Wake up, drink warm water." or "1:30 PM — Lunch, followed by 15-minute walk."

Return only the 12 time-block lines, one per line, nothing else.${exampleBlock(scheduleExample)}`
      }
    ],
    temperature: 0.3,
    max_tokens: 500,
  })
  const daily_schedule = stripDietLabels(scheduleRes.choices[0]?.message?.content?.trim() ?? '')

  return { lifestyle_guidelines, meal_guidelines, daily_schedule }
}
