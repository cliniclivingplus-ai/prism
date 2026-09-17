import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Rewrites every recipe currently shown in this roadmap's plan, one Groq
// call each — a real 20-30 week plan can surface a couple dozen distinct
// recipes across all its meal slots, so this can run long.
export const maxDuration = 120

import { groqChatCompletion } from '@/lib/groq'
import { supabaseAdmin } from '@/lib/supabase'
import { parseNutritionistGuidelines } from '@/lib/pdf/parseNutritionistGuidelines'
import { selectRecipesForPatient, type BankRecipe } from '@/lib/pdf/matchRecipes'
import { getSlotRecipes } from '@/lib/pdf/weekRecipes'
import type { DayMealSlot } from '@/lib/pdf/ClientGuideDocument'
import { DIET_RULE, findNonVegTerm } from '@/lib/dietRules'

const DAY_MEAL_SLOTS: DayMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']

// Groq's free tier shares one small per-minute token budget across the
// whole app — small concurrency with a short stagger.
const CONCURRENCY = 2

function extractTargetRemoveTerm(instruction: string): string | null {
  const match = instruction.match(/(?:remove|no|without|allergic to|skip|omit|exclude)\s+([a-z0-9\s]+)/i)
  if (!match) return null
  const term = match[1].replace(/from the recipes|from recipes|in recipes|everywhere|all/gi, '').trim()
  return term.length >= 2 ? term.toLowerCase() : null
}

function cleanSentenceGrammar(text: string): string {
  let s = text
  // Remove orphaned descriptors like "minced", "chopped", "crushed", "sliced", "diced", "fresh", "cloves of", "clove of", "head of", "heads of"
  s = s.replace(/\b(minced|chopped|crushed|sliced|diced|grated|peeled|pressed|fresh|raw)\s+(?=and\b|,|\.|\s*$)/gi, '')
  s = s.replace(/\b(clove|cloves|head|heads|piece|pieces)\s+of\s+(?=and\b|,|\.|\s*$)/gi, '')

  // Fix connector double punctuation
  s = s.replace(/,\s*and\s*,/gi, ',')
  s = s.replace(/,\s*and\s*\./gi, '.')
  s = s.replace(/,\s*,+/g, ',')
  s = s.replace(/\s*,\s*\./g, '.')
  s = s.replace(/\b(and)\s+and\b/gi, 'and')
  s = s.replace(/\b(and)\s*\./gi, '.')
  s = s.replace(/\b(add|sauté|saute|cook|combine|mix|stir in|toss|season with)\s+and\b/gi, '$1')
  s = s.replace(/\b(add|sauté|saute|cook|combine|mix|stir in|toss)\s*,\s*(?=and\b)/gi, '$1 ')
  s = s.replace(/\s+/g, ' ').trim()

  // Clean leading/trailing punctuation
  s = s.replace(/^,\s*/, '').replace(/\s*,$/, '')

  if (s.length > 0 && /^[a-z]/.test(s)) {
    s = s.charAt(0).toUpperCase() + s.slice(1)
  }
  return s
}

function rewriteSentenceRemovingTerm(line: string, term: string): string {
  const termRegex = new RegExp(`\\b${term}\\b`, 'gi')
  if (!termRegex.test(line)) return line

  // Split into sentences if a step line contains multiple sentences
  const sentences = line.split(/(?<=\.)\s+/)
  const rewrittenSentences = sentences
    .map((sent) => {
      if (!termRegex.test(sent)) return sent

      let s = sent
      s = s.replace(new RegExp(`\\b(and\\s+)?(?:minced\\s+|chopped\\s+|crushed\\s+|sliced\\s+|diced\\s+|fresh\\s+)?${term}\\s*(,?\\s*and)?\\b`, 'gi'), (match, p1, p2) => {
        if (p1 && p2) return ' and'
        return ''
      })
      s = s.replace(termRegex, '')
      s = cleanSentenceGrammar(s)

      // If sentence has no meaningful words left (e.g. was "Mince the garlic."), drop sentence
      if (s.length < 4 || /^(and|with|in|to|the|\.)+$/i.test(s.trim())) {
        return ''
      }
      return s
    })
    .filter(Boolean)

  return rewrittenSentences.join(' ')
}

function enforceIngredientRemoval(ingredients: string, steps: string, term: string): { ingredients: string; steps: string } {
  const termRegex = new RegExp(`\\b${term}\\b`, 'gi')

  // Remove lines from ingredients list
  const cleanIngs = ingredients
    .split('\n')
    .filter((line) => !termRegex.test(line))
    .join('\n')

  // Rewrite sentences in steps naturally
  const cleanSteps = steps
    .split('\n')
    .map((line) => rewriteSentenceRemovingTerm(line, term))
    .filter((line) => line.trim().length > 0)
    .join('\n')

  return { ingredients: cleanIngs, steps: cleanSteps }
}

async function rewriteOneRecipe(
  recipe: BankRecipe,
  instruction: string,
  existingOverride?: { ingredients?: string; steps?: string }
): Promise<{ ingredients: string; steps: string } | null> {
  const inputIngredients = existingOverride?.ingredients ?? recipe.ingredients
  const inputSteps = existingOverride?.steps ?? recipe.steps

  try {
    const completion = await groqChatCompletion({
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
- When asked to remove an ingredient (e.g. garlic, nuts, dairy), DO NOT leave empty spaces, blank lines, dangling commas, or incomplete sentences.
- REWRITE ONLY THE SENTENCES THAT MENTION THE INGREDIENT so they flow naturally without that ingredient. For example:
  - "Sauté garlic, ginger, and onion" -> "Sauté ginger and onion"
  - "Add minced garlic to the warm oil" -> "Warm the oil" (or omit the sentence cleanly if it was exclusively about preparing the removed item, e.g. "Mince the garlic").
- KEEP ALL OTHER INGREDIENTS, QUANTITIES, AND STEPS UNTOUCHED AND INTACT.
- Never use an em dash (—); use a comma, period, or "and" instead.
- Return STRICT JSON only: {"ingredients": "one per line, non-empty", "steps": "one per line, non-empty"}.`,
        },
        {
          role: 'user',
          content: `Recipe: ${recipe.name}

Ingredients:
${inputIngredients}

Steps:
${inputSteps}

Coach's instruction: ${instruction}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : clean) as { ingredients?: unknown; steps?: unknown }
    let ingredients = typeof parsed.ingredients === 'string' ? parsed.ingredients.trim() : ''
    let steps = typeof parsed.steps === 'string' ? parsed.steps.trim() : ''

    if (!ingredients || !steps) return null
    if (findNonVegTerm(`${recipe.name} ${ingredients}`)) return null

    // Deterministic backstop: if instruction asks to remove an ingredient (e.g. "garlic"),
    // verify it is 100% purged from both ingredients and steps.
    const removeTerm = extractTargetRemoveTerm(instruction)
    if (removeTerm && (new RegExp(`\\b${removeTerm}\\b`, 'i').test(ingredients) || new RegExp(`\\b${removeTerm}\\b`, 'i').test(steps))) {
      const purged = enforceIngredientRemoval(ingredients, steps, removeTerm)
      ingredients = purged.ingredients
      steps = purged.steps
    }

    return { ingredients, steps }
  } catch (err) {
    console.error(`ai-bulk-edit-recipes: AI call failed on "${recipe.name}", applying deterministic filter:`, err instanceof Error ? err.message : err)
    const removeTerm = extractTargetRemoveTerm(instruction)
    if (removeTerm) {
      return enforceIngredientRemoval(inputIngredients, inputSteps, removeTerm)
    }
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

  // Fallback: if weekNumbers is empty or weekly schedule hasn't populated recipeIds, use weekMealMatches & manualRecipes
  if (recipeIds.size === 0) {
    const allMealMatches = [...weekMealMatches.breakfast, ...weekMealMatches.lunch, ...weekMealMatches.dinner, ...weekMealMatches.snack, ...weekMealMatches.dessert]
    allMealMatches.forEach((m) => recipeIds.add(m.recipe.id))
    Object.values(manualRecipes).forEach((slotList) => {
      if (Array.isArray(slotList)) slotList.forEach((id) => recipeIds.add(id))
    })
  }

  // Final safety fallback: if still empty, use all recipes in the recipe bank
  if (recipeIds.size === 0) {
    (recipeBank as BankRecipe[]).forEach((r) => recipeIds.add(r.id))
  }

  const recipes = (recipeBank as BankRecipe[]).filter((r) => recipeIds.has(r.id))
  if (recipes.length === 0) {
    return NextResponse.json({ error: 'No recipes found for this plan.' }, { status: 422 })
  }

  const existingOverrides = (overrides.recipe_content_overrides ?? {}) as Record<string, { ingredients: string; steps: string }>
  const newOverrides: Record<string, { ingredients: string; steps: string }> = { ...existingOverrides }
  const results: { id: string; name: string; changed: boolean }[] = []

  for (let i = 0; i < recipes.length; i += CONCURRENCY) {
    const batch = recipes.slice(i, i + CONCURRENCY)
    const rewritten = await Promise.all(batch.map((r) => rewriteOneRecipe(r, instruction, existingOverrides[r.id])))
    batch.forEach((r, idx) => {
      const result = rewritten[idx]
      if (result) {
        newOverrides[r.id] = { ...existingOverrides[r.id], ...result }
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
