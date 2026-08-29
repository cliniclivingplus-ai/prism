import { groqChatCompletion } from '@/lib/groq'

// Shared by roadmap generation (interpret/route.ts Steps 3/3B/3C) and the
// coach-triggered "Regenerate" action on an existing roadmap's Daily
// Lifestyle Guidelines / Breakfast-Lunch-Dinner / Daily Schedule sections
// (regenerate-daily-content/route.ts) — one source of truth for these three
// prompts, so an existing roadmap regenerated later gets content grounded
// the exact same way a freshly generated one does, regardless of which
// template (Week-family or Classic/Almanac/Pulse/Onyx/Vitals) it uses.
export async function generateDailyContent(patientFacts: string, kbContext: string) {
  const lifestyleRes = await groqChatCompletion({
    model: 'openai/gpt-oss-20b',
    reasoning_effort: 'low',
    messages: [
      { role: 'system', content: 'Clinical nutritionist. Write 6 lifestyle instructions directly to the patient, each a single short action, like a to-do list, split evenly across Morning, Afternoon, and Evening. Never use an em dash (—); use a comma, period, or "and" instead.' },
      { role: 'user', content: `PATIENT FACTS:
${patientFacts}

KB:
${kbContext || 'Use expertise.'}

Write 6 lifestyle actions for this specific patient, chosen to fit their actual condition and habits from the facts above: 2 for Morning, 2 for Afternoon, 2 for Evening.
Each must:
- Genuinely belong to that time of day, not a generic action that could apply anytime — Morning covers waking routine, hydration, sunlight, breakfast; Afternoon covers lunch, movement, midday hydration; Evening covers dinner, wind-down, sleep hygiene
- Start with "Morning: ", "Afternoon: ", or "Evening: " followed by the action, e.g. "Morning: Wake up before sunlight." or "Evening: Take a 15-minute walk after dinner."
- Be ONE short, concrete action only
- Be a plain instruction, not a sentence about the patient or their habits
- No explanation, no reasoning, no "because"
- Under 8 words after the label

Return only 6 lines, 2 per period, in the order Morning, Morning, Afternoon, Afternoon, Evening, Evening. No intro, no outro, no bullet characters.` }
    ],
    temperature: 0.3,
    max_tokens: 500,
  })
  const lifestyle_guidelines = lifestyleRes.choices[0]?.message?.content?.trim() ?? ''

  const mealRes = await groqChatCompletion({
    model: 'openai/gpt-oss-20b',
    reasoning_effort: 'low',
    messages: [
      { role: 'system', content: 'Clinical nutritionist practicing functional nutrition. Write 6 meal instructions directly to the patient, each a single short action, split evenly across Breakfast, Lunch, and Dinner, grounded in each meal\'s functional role in the day. Never use an em dash (—); use a comma, period, or "and" instead.' },
      { role: 'user', content: `PATIENT FACTS:
${patientFacts}

KB:
${kbContext || 'Use expertise.'}

Write 6 meal actions for this specific patient, chosen to fit their actual condition and eating patterns from the facts above: 2 for Breakfast, 2 for Lunch, 2 for Dinner.
Each must reflect that meal's actual functional role, not be interchangeable with the others:
- Breakfast: gentle on digestion, breaks the overnight fast without shocking it — e.g. warm water, easily-digestible foods, light protein
- Lunch: the day's most substantial meal, when digestive capacity is highest — balanced protein and complex carbs, the main energy meal
- Dinner: lighter and earlier than lunch, easy to digest, supports overnight rest and sleep — avoid heavy or late eating
Each bullet must also:
- Start with "Breakfast: ", "Lunch: ", or "Dinner: " followed by the action, e.g. "Breakfast: Start with warm lemon water." or "Dinner: Finish eating by 8pm."
- Be ONE short, concrete action only
- Be a plain instruction, not a sentence about the patient or their habits
- No explanation, no reasoning, no "because"
- Under 8 words after the label

Return only 6 lines, 2 per meal, in the order Breakfast, Breakfast, Lunch, Lunch, Dinner, Dinner. No intro, no outro, no bullet characters.` }
    ],
    temperature: 0.3,
    max_tokens: 500,
  })
  const meal_guidelines = mealRes.choices[0]?.message?.content?.trim() ?? ''

  const scheduleRes = await groqChatCompletion({
    model: 'openai/gpt-oss-20b',
    reasoning_effort: 'low',
    messages: [
      { role: 'system', content: 'Clinical nutritionist writing a patient\'s full daily schedule, start of day to sleep, using ONLY the facts given. Never name a supplement, dose, or product that is not explicitly listed in the patient facts below. Output one line per time block, no other text. Never use an em dash (—) inside an activity description; use a comma or "and" instead — the em dash character is reserved as the separator between the time and the activity.' },
      { role: 'user', content: `PATIENT FACTS (use ONLY these — do not add any supplement, dose, or product not named here):
${patientFacts}

KB:
${kbContext || 'Use expertise.'}

Write this patient's full daily schedule, from wake-up to sleep, personalized to their actual condition, program, and constraints from the facts above (their real work hours, meal timing, symptoms, habits).
Each line must be exactly: "<time> — <activity>", e.g. "7:30 AM — Wake up." or "2:00 PM — Lunch, followed by a 15 minute walk."
Rules:
- EXACTLY 12 time blocks, no more, no fewer, covering the whole day in chronological order, real clock times (e.g. "7:30 AM", "2:00 PM"), never a range
- Each activity is specific and actionable, not generic ("Sunlight exposure and a glass of water" not "Get some sunlight")
- Ground every activity in the patient's real facts: their actual symptoms, condition, work hours, and eating patterns
- FORBIDDEN: naming any supplement, medication, or dose (e.g. "magnesium 400mg", "vitamin D") unless that exact supplement is already named in PATIENT FACTS above — if no supplement is mentioned in the facts, write none into the schedule at all
- If a fact describes a habit tied to a symptom or negative consequence (e.g. "consciously contracting muscles to fall asleep, contributing to morning stiffness"), the schedule must prescribe the CORRECTIVE opposite of that habit, never a rephrased version of the harmful habit itself — do not tell the patient to keep doing the thing identified as causing their problem
- Include real anchors every day needs: wake time, meals (breakfast/lunch/dinner), hydration, movement, and a wind-down/sleep routine — personalized to this patient's condition, not a generic list
- No explanation, no headers, no numbering, no bullet characters

Return only the 12 time-block lines, one per line, nothing else.` }
    ],
    temperature: 0.3,
    max_tokens: 900,
  })
  const daily_schedule = scheduleRes.choices[0]?.message?.content?.trim() ?? ''

  return { lifestyle_guidelines, meal_guidelines, daily_schedule }
}
