import snapshot from './recipeCatalogueSnapshot.json'
import type { BankRecipe } from './matchRecipes'

// A catalogue import must not change a plan already sent to a patient.
// Keep its previous bank order (also the matcher tie-break), and restore
// fields revised by the import. New plans use the current shared bank.
export function recipeCatalogueForPlan(createdAt: string, bank: BankRecipe[]): BankRecipe[] {
  if (Date.parse(createdAt) > Date.parse(snapshot.cutoff)) return bank
  const byId = new Map(bank.map((recipe) => [recipe.id, recipe]))
  const previous = snapshot.previousValues as Record<string, Partial<BankRecipe>>
  return snapshot.ids.flatMap((id) => {
    const recipe = byId.get(id)
    if (!recipe) return []
    const original = previous[id]
    if (!original) return [recipe]
    // Preserve each caller's selected columns, including the PDF's smaller
    // projection, rather than leaking additional snapshot fields into it.
    return [Object.fromEntries(Object.entries(recipe).map(([key, value]) => [
      key, Object.hasOwn(original, key) ? original[key as keyof BankRecipe] : value,
    ])) as BankRecipe]
  })
}
