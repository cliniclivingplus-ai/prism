// Selects recipes from the coach-built recipe bank for a specific patient's
// guide — grounded only in real signals already in their data (their stated
// concern, and the diet-protocol bullets the AI clinical step generated for
// them), never a generic fixed list. A recipe only gets included if it
// actually matches one of those real terms; the "why" quotes the matched
// term back, the same grounding discipline used for coach_quote elsewhere in
// this app (never invent a connection that isn't really there).
//
// Note: recipes have no calorie data (the source cookbooks don't reliably
// include it, and fabricating a number would be worse than omitting one) —
// selection is concern/diet-protocol relevance only, not calorie-based.
export type BankRecipe = {
  id: string
  name: string
  meal_type: string
  protein_label: string | null
  ingredients: string
  steps: string
  tags: string[]
  // Optional "facts" fields, only present when a coach's source (e.g. a
  // Canva recipe card) actually had them — never fabricated. A recipe
  // missing all of these still renders fine; the dashboard just omits the
  // facts/tools/notes sections for it instead of showing a placeholder.
  eat_time?: string | null
  prep_time?: string | null
  cook_time?: string | null
  difficulty?: string | null
  health_score?: string | null
  servings?: string | null
  tools?: string[]
  notes?: string[]
  benefits?: string[]
  image_url?: string | null // coach's own photo for this recipe — takes priority over the tag-matched picture bank
}
export type RecipeMatch = { recipe: BankRecipe; why: string }

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'your', 'this', 'that', 'from', 'for', 'you', 'are', 'was', 'her', 'his', 'their',
  'have', 'has', 'been', 'they', 'she', 'him', 'but', 'not', 'all', 'can', 'will', 'more', 'also', 'into',
])

function extractKeywords(text: string): string[] {
  return [...new Set(
    (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  )]
}

// A plan that says "low FODMAP" anywhere must be offered the recipes the
// clinic curated for exactly that. Keyword scoring alone could not deliver
// it: "low" is dropped as too short, so "fodmap" counted for a single point
// and a recipe matching three incidental words outranked one that genuinely
// is low-FODMAP.
const LOW_FODMAP_MENTION = /fodmap/i

export function planMentionsLowFodmap(primaryConcern: string, dietProtocol: string[]): boolean {
  return LOW_FODMAP_MENTION.test([primaryConcern, ...dietProtocol].join(' '))
}

// Tag-driven on purpose: a recipe counts as low-FODMAP because a coach
// tagged it so, never because the word turned up somewhere in its text.
// Both spellings already in the bank ("low-fodmap", "lowfodmap") qualify.
export function isLowFodmapRecipe(recipe: Pick<BankRecipe, 'tags'>): boolean {
  return (recipe.tags || []).some((t) => t.toLowerCase().replace(/[^a-z]/g, '').includes('fodmap'))
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'] as const

export function selectRecipesForPatient(
  opts: { primaryConcern: string; dietProtocol: string[] },
  bank: BankRecipe[],
  perMealLimit = 5
): Record<(typeof MEAL_TYPES)[number], RecipeMatch[]> {
  const concernKeywords = extractKeywords(opts.primaryConcern)
  const dietKeywords = opts.dietProtocol.flatMap(extractKeywords)
  const keywords = [...new Set([...concernKeywords, ...dietKeywords])]
  // The same patterns are tested against every recipe. Compile once per
  // selection rather than thousands of times while the browser renders.
  const keywordPatterns = keywords.map((keyword) => ({
    keyword,
    pattern: new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
  }))
  const lowFodmapPlan = planMentionsLowFodmap(opts.primaryConcern, opts.dietProtocol)

  // Recipes are no longer typed by meal. The clinic organises the bank by
  // collection (South Indian, Low FODMAP, PCOS…) and the coach decides at
  // pick time what belongs at what time of day, so every slot draws from
  // the whole bank. Scored once, then dealt out so no two slots suggest the
  // same dish.
  const scored = bank
    .map((r) => {
      const haystack = `${r.name} ${r.tags.join(' ')} ${r.ingredients}`.toLowerCase()
      const matched = keywordPatterns.filter(({ pattern }) => pattern.test(haystack)).map(({ keyword }) => keyword)
      const fodmapFirst = lowFodmapPlan && isLowFodmapRecipe(r)
      return { recipe: r, matched, fodmapFirst }
    })
    .sort((a, b) => Number(b.fodmapFirst) - Number(a.fodmapFirst) || b.matched.length - a.matched.length)

  const relevant = scored.filter((s) => s.matched.length > 0 || s.fodmapFirst)
  const pool = relevant.length > 0 ? relevant : scored

  const result = {} as Record<(typeof MEAL_TYPES)[number], RecipeMatch[]>
  for (const meal of MEAL_TYPES) result[meal] = []
  // Round-robin: the strongest matches spread across the slots rather than
  // all landing in the first one.
  let cursor = 0
  for (let round = 0; round < perMealLimit; round++) {
    for (const meal of MEAL_TYPES) {
      const s = pool[cursor++]
      if (!s) break
      result[meal].push({
        recipe: s.recipe,
        why: s.fodmapFirst
          ? 'Chosen for your plan because it is built to be low-FODMAP.'
          : opts.primaryConcern && s.matched.some((k) => concernKeywords.includes(k))
            ? `Chosen for your plan, it fits what your coach noted about "${s.matched.find((m) => concernKeywords.includes(m))}."`
            : s.matched.length > 0
              ? `Chosen for your plan, it matches your care team's diet notes on "${s.matched[0]}."`
              : `Chosen for your plan by your care team.`,
      })
    }
  }
  return result
}
