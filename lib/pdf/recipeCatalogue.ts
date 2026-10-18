import snapshot from './recipeCatalogueSnapshot.json'
import snackDessertSnapshot from './recipeCatalogueSnackDessertSnapshot.json'
import type { BankRecipe } from './matchRecipes'

// A catalogue import must not change a plan already sent to a patient.
// Keep its previous bank order (also the matcher tie-break), and restore
// fields revised by the import. New plans use the current shared bank.
export function recipeCatalogueForPlan(createdAt: string, bank: BankRecipe[]): BankRecipe[] {
  // Keep releases oldest first. A plan predating multiple imports must
  // undo their changes newest-first, then retain its original bank order.
  const releases = [snapshot, snackDessertSnapshot].filter((release) => !(Date.parse(createdAt) > Date.parse(release.cutoff)))
  if (!releases.length) return bank
  const byId = new Map(bank.map((recipe) => [recipe.id, recipe]))
  return releases[0].ids.flatMap((id) => {
    const recipe = byId.get(id)
    if (!recipe) return []
    let restored = recipe
    for (const release of [...releases].reverse()) {
      const original = (release.previousValues as Record<string, Partial<BankRecipe>>)[id]
      if (!original) continue
      // Restore only columns the caller fetched (including PDF projections).
      restored = Object.fromEntries(Object.entries(restored).map(([key, value]) => [
        key, Object.hasOwn(original, key) ? original[key as keyof BankRecipe] : value,
      ])) as BankRecipe
    }
    return [restored]
  })
}
