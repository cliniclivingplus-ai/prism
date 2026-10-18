import { getSlotRecipes } from './pdf/weekRecipes'
import type { DayMealSlot } from './pdf/ClientGuideDocument'
import type { BankRecipe, RecipeMatch } from './pdf/matchRecipes'

const slots: DayMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']
export function shoppingRecipes(
  weeks: { week_number: number }[],
  bank: BankRecipe[],
  weekly: Record<number, Partial<Record<DayMealSlot, string[]>>>,
  manual: Partial<Record<DayMealSlot, string[]>>,
  matches: Record<DayMealSlot, RecipeMatch[]>,
  overrides: Record<string, { hidden?: boolean; ingredients?: string; name?: string }>,
): BankRecipe[] {
  const seen = new Set<string>()
  return weeks.flatMap((week) => getSlotRecipes(week.week_number, slots, weekly, manual, matches, bank, '')
    .flatMap((slot) => slot.matches).map((match) => match.recipe))
    .filter((recipe) => {
      if (overrides[recipe.id]?.hidden || seen.has(recipe.id)) return false
      seen.add(recipe.id); return true
    }).map((recipe) => ({ ...recipe, ingredients: overrides[recipe.id]?.ingredients ?? recipe.ingredients, name: overrides[recipe.id]?.name ?? recipe.name }))
}
