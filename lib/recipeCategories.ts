// Recipe collections a coach can filter the bank by. A category is stored
// as a plain tag on the recipe, so a dish can belong to several at once —
// the same Palak Tofu appears in the South Indian, Diabetes, Gut Healing and
// PCOS collections — and nothing is hidden by default: the filter only
// narrows the view.
//
// 'low-fodmap' is also what the recipe matcher reads when a patient's plan
// calls for low FODMAP (see lib/pdf/matchRecipes.ts), so a recipe tagged
// into that collection is recommended for those patients automatically.
export const RECIPE_CATEGORIES = [
  { slug: 'south-indian', label: 'South Indian' },
  { slug: 'north-indian', label: 'North Indian' },
  { slug: 'smoothies', label: 'Smoothies' },
  { slug: 'snacks', label: 'Snacks' },
  { slug: 'desserts', label: 'Desserts' },
  { slug: 'low-fodmap', label: 'Low FODMAP' },
  { slug: 'gut-healing', label: 'Gut healing' },
  { slug: 'diabetes', label: 'Diabetes' },
  { slug: 'cholesterol', label: 'Cholesterol' },
  { slug: 'pcos', label: 'PCOS' },
  { slug: 'instant-pot', label: 'Instant Pot' },
] as const

export type RecipeCategorySlug = (typeof RECIPE_CATEGORIES)[number]['slug']

const BY_SLUG = new Map(RECIPE_CATEGORIES.map((c) => [c.slug, c.label]))

// Spelling variants already in the bank ("lowfodmap") resolve to the same
// collection, so older recipes filter alongside the new ones.
const normalise = (tag: string) => tag.toLowerCase().replace(/[^a-z]/g, '')
const BY_NORMALISED = new Map(RECIPE_CATEGORIES.map((c) => [normalise(c.slug), c.slug]))
BY_NORMALISED.set('snack', 'snacks')
BY_NORMALISED.set('dessert', 'desserts')

export function categoriesOf(recipe: { tags?: string[] | null }): RecipeCategorySlug[] {
  const found = new Set<RecipeCategorySlug>()
  for (const tag of recipe.tags || []) {
    const slug = BY_NORMALISED.get(normalise(tag))
    if (slug) found.add(slug as RecipeCategorySlug)
  }
  return [...found]
}

export function recipeInCategory(recipe: { tags?: string[] | null }, slug: string): boolean {
  return categoriesOf(recipe).includes(slug as RecipeCategorySlug)
}

export function categoryLabel(slug: string): string {
  return BY_SLUG.get(slug as RecipeCategorySlug) ?? slug
}
