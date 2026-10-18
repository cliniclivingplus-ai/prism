import { categoriesOf, categoryLabel, recipeInCategory } from './recipeCategories'

type SearchableRecipe = { name: string; ingredients?: string | null; tags?: string[] | null }
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

export function filterRecipeBank<T extends SearchableRecipe>(recipes: T[], category: string, query: string): T[] {
  const terms = query.trim().split(/\s+/).map(normalize).filter(Boolean)
  return recipes.filter((recipe) => {
    if (category !== 'all' && !recipeInCategory(recipe, category)) return false
    const fields = [recipe.name, recipe.ingredients || '', ...(recipe.tags || []), ...categoriesOf(recipe).map(categoryLabel)].map(normalize)
    return terms.every((term) => fields.some((field) => field.includes(term)))
  })
}
