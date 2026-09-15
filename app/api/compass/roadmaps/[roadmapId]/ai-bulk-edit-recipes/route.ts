import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Rewrites every recipe currently shown in this roadmap's plan, one Groq
// call each — a real 20-30 week plan can surface a couple dozen distinct
// recipes across all its meal slots, so this can run long.
export const maxDuration = 120

import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { parseNutritionistGuidelines } from '@/lib/pdf/parseNutritionistGuidelines'
import { selectRecipesForPatient, type BankRecipe } from '@/lib/pdf/matchRecipes'
import { getSlotRecipes } from '@/lib/pdf/weekRecipes'
import type { DayMealSlot } from '@/lib/pdf/ClientGuideDocument'
import { DIET_RULE, findNonVegTerm } from '@/lib/dietRules'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const DAY_MEAL_SLOTS: DayMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']

// Groq's free tier shares one small per-minute token budget across the
// whole app (see qa-chat/route.ts's own comments on this) — rewriting a
// couple dozen recipes back to back would burst well past it. Small
// concurrency with a short stagger, not Promise.all.
const CONCURRENCY = 2

async function rewriteOneRecipe(recipe: BankRecipe, instruction: string): Promise<{ ingredients: string; steps: string } | null> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0.2,
      max_tokens: 900,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'system',
          content: `You edit one recipe's ingredients and steps per a coach's instruction, for one specific patient's plan only — you are NOT changing the shared recipe everyone else sees, just this patient's copy.
${DIET_RULE}
HARD RULES:
- Return the FULL updated ingredients and steps, not just the changed lines.
- If the instruction asks to remove an ingredient, remove it from BOTH the ingredient list and any step that names it, rewriting that step naturally rather than leaving a gap or a dangling reference.
- If removing the ingredient would leave a step with nothing to do (e.g. "mince the garlic"), remove that step entirely instead of leaving an empty one.
- Never add a new ingredient or step that wasn't implied by the instruction.
- Keep every other ingredient, quantity, and step exactly as written.
- Never use an em dash (—); use a comma, period, or "and" instead.
- Return STRICT JSON only: {"ingredients": "one per line, exactly like the input format", "steps": "one per line, exactly like the input format"}.`,
        },
        {
          role: 'user',
          content: `Recipe: ${recipe.name}

Ingredients:
${recipe.ingredients}

Steps:
${recipe.steps}

Coach's instruction: ${instruction}`,
        },
      ],
    })
    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : clean) as { ingredients?: unknown; steps?: unknown }
    const ingredients = typeof parsed.ingredients === 'string' ? parsed.ingredients.trim() : ''
    const steps = typeof parsed.steps === 'string' ? parsed.steps.trim() : ''
    if (!ingredients || !steps) return null
    // Deterministic backstop, same as the recipe-bank save path — a rewrite
    // must never introduce a non-veg ingredient even if the instruction
    // itself didn't ask for one to be removed.
    if (findNonVegTerm(`${recipe.name} ${ingredients}`)) return null
    return { ingredients, steps }
  } catch (err) {
    console.error(`ai-bulk-edit-recipes: failed on "${recipe.name}"`, err instanceof Error ? err.message : err)
    return null
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
  let instruction = ''
  try {
    const body = await req.json()
    instruction = typeof body.instruction === 'string' ? body.instruction.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  if (!instruction) return NextResponse.json({ error: 'Tell AI what to change, e.g. "remove all the garlic".' }, { status: 400 })

  const { data: roadmap, error: roadmapError } = await supabaseAdmin
    .from('roadmaps')
    .select('patient_id, nutritionist_guidelines, weekly_schedule, guide_overrides, patients(primary_concern)')
    .eq('id', roadmapId)
    .single()
  if (roadmapError || !roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

  const { data: recipeBank } = await supabaseAdmin.from('recipe_bank').select('*')
  if (!recipeBank || recipeBank.length === 0) {
    return NextResponse.json({ error: 'No recipes in the recipe bank yet.' }, { status: 422 })
  }

  // Same matching this roadmap's own templates use client-side (see
  // lib/pdf/matchRecipes.ts + weekRecipes.ts) — recomputed here so "every
  // recipe shown in this plan" means the exact same set a coach sees,
  // curated per-week overrides included, not a re-guess.
  const dietProtocol = parseNutritionistGuidelines(roadmap.nutritionist_guidelines ?? '').dietProtocol
  const primaryConcern = (roadmap.patients as { primary_concern?: string } | null)?.primary_concern ?? ''
  const weekMealMatches = selectRecipesForPatient({ primaryConcern, dietProtocol }, recipeBank as BankRecipe[], 5)
  const overrides = (roadmap.guide_overrides ?? {}) as Record<string, unknown>
  const weeklyManualRecipes = (overrides.weekly_manual_recipes ?? {}) as Record<number, Partial<Record<DayMealSlot, string[]>>>
  const manualRecipes = (overrides.manual_recipes ?? {}) as Partial<Record<DayMealSlot, string[]>>
  const weekNumbers = [...new Set((Array.isArray(roadmap.weekly_schedule) ? roadmap.weekly_schedule : []).map((w: { week_number: number }) => w.week_number))]

  const recipeIds = new Set<string>()
  for (const wn of weekNumbers) {
    for (const { matches } of getSlotRecipes(wn, DAY_MEAL_SLOTS, weeklyManualRecipes, manualRecipes, weekMealMatches, recipeBank as BankRecipe[], '')) {
      for (const m of matches) recipeIds.add(m.recipe.id)
    }
  }
  const recipes = (recipeBank as BankRecipe[]).filter((r) => recipeIds.has(r.id))
  if (recipes.length === 0) {
    return NextResponse.json({ error: 'No recipes are currently showing in this plan yet, generate the weekly plan first.' }, { status: 422 })
  }

  const existingOverrides = (overrides.recipe_content_overrides ?? {}) as Record<string, { ingredients: string; steps: string }>
  const newOverrides: Record<string, { ingredients: string; steps: string }> = { ...existingOverrides }
  const results: { id: string; name: string; changed: boolean }[] = []

  for (let i = 0; i < recipes.length; i += CONCURRENCY) {
    const batch = recipes.slice(i, i + CONCURRENCY)
    const rewritten = await Promise.all(batch.map((r) => rewriteOneRecipe(r, instruction)))
    batch.forEach((r, idx) => {
      const result = rewritten[idx]
      if (result) {
        newOverrides[r.id] = result
        results.push({ id: r.id, name: r.name, changed: true })
      } else {
        results.push({ id: r.id, name: r.name, changed: false })
      }
    })
  }

  const { error: updateError } = await supabaseAdmin
    .from('roadmaps')
    .update({ guide_overrides: { ...overrides, recipe_content_overrides: newOverrides } })
    .eq('id', roadmapId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ recipeContentOverrides: newOverrides, results })
}
