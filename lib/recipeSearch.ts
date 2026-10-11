// Shared matcher for every coach-facing "search the recipe bank" box.
//
// Searching by name alone meant a coach typing "low fodmap" found nothing,
// even though the bank holds recipes tagged for exactly that. Tags are how
// the clinic marks a recipe's clinical purpose, so they are searchable here
// too, and the comparison ignores punctuation: "low fodmap", "low-FODMAP"
// and "lowfodmap" all find the same recipes.
const flatten = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function recipeMatchesQuery(
  recipe: { name: string; tags?: string[] | null },
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (recipe.name.toLowerCase().includes(q)) return true

  const flatQuery = flatten(q)
  if (!flatQuery) return false
  if (flatten(recipe.name).includes(flatQuery)) return true
  return (recipe.tags || []).some((tag) => flatten(tag).includes(flatQuery))
}
