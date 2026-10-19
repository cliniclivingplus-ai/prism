import type { DayMealSlot } from './ClientGuideDocument'
import type { BankRecipe, RecipeMatch } from './matchRecipes'

// The same immutable bank is reused across weeks and re-renders. Build its
// ID index once; retain the first entry to match Array.find exactly.
const bankIndexes = new WeakMap<BankRecipe[], Map<string, BankRecipe>>()
function recipesById(bank: BankRecipe[]): Map<string, BankRecipe> {
  const cached = bankIndexes.get(bank)
  if (cached) return cached
  const index = new Map<string, BankRecipe>()
  for (const recipe of bank) if (!index.has(recipe.id)) index.set(recipe.id, recipe)
  bankIndexes.set(bank, index)
  return index
}

// The single source of truth for "which recipes does week N's slot show" —
// shared by every template (Classic's DashboardClient, Almanac, and any
// future one) so they can never silently disagree about a patient's real
// curated recipes. A per-week override wins, then the old plan-wide
// `manualRecipes` (from before per-week curation existed, kept so older
// roadmaps don't lose a coach's picks), then the top auto-detected matches.
export function curatedSlotIds(
  slot: DayMealSlot,
  weekNumber: number,
  weeklyManualRecipes: Record<number, Partial<Record<DayMealSlot, string[]>>>,
  manualRecipes: Partial<Record<DayMealSlot, string[]>>,
  weekMealMatches: Record<DayMealSlot, RecipeMatch[]>
): string[] {
  // 1. Explicit per-week override for this specific week number (if non-empty)
  const weekRaw = weeklyManualRecipes?.[weekNumber]?.[slot]
  if (Array.isArray(weekRaw) && weekRaw.length > 0) return weekRaw

  // 2. Plan-wide manual override (if non-empty)
  const legacyRaw = manualRecipes?.[slot]
  if (Array.isArray(legacyRaw) && legacyRaw.length > 0) return legacyRaw

  // 3. If an explicit empty array was set and no legacy manual selection exists, return []
  if (Array.isArray(weekRaw)) return weekRaw
  if (Array.isArray(legacyRaw)) return legacyRaw

  // 4. Otherwise, fall back to AI auto-detected matches
  return (weekMealMatches?.[slot] || []).map((m) => m.recipe.id)
}

export function getSlotRecipes(
  weekNumber: number,
  slots: readonly DayMealSlot[],
  weeklyManualRecipes: Record<number, Partial<Record<DayMealSlot, string[]>>>,
  manualRecipes: Partial<Record<DayMealSlot, string[]>>,
  weekMealMatches: Record<DayMealSlot, RecipeMatch[]>,
  recipeBank: BankRecipe[],
  pickedByLine: string
): { slot: DayMealSlot; matches: RecipeMatch[] }[] {
  const byId = recipesById(recipeBank || [])
  return slots.map((slot) => {
    const chosenIds = curatedSlotIds(slot, weekNumber, weeklyManualRecipes, manualRecipes, weekMealMatches)
    const matches = chosenIds
      .map((id): RecipeMatch | null => {
        const auto = weekMealMatches?.[slot]?.find((m) => m.recipe.id === id)
        if (auto) return auto
        const recipe = byId.get(id)
        return recipe ? { recipe, why: pickedByLine } : null
      })
      .filter((m): m is RecipeMatch => !!m)
    return { slot, matches }
  })
}
