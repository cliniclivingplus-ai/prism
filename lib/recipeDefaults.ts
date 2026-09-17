import { splitRecipeLines } from './recipeText'

export interface RecipeFields {
  id?: string
  name: string
  meal_type?: string
  ingredients: string
  steps: string
  protein_label?: string | null
  eat_time?: string | null
  prep_time?: string | null
  cook_time?: string | null
  difficulty?: string | null
  health_score?: string | null
  servings?: string | null
  tools?: string[] | string | null
  notes?: string[] | string | null
  benefits?: string[] | string | null
}

export function fillRecipeDefaults(recipe: RecipeFields, override?: Partial<RecipeFields>) {
  const ingredientsStr = override?.ingredients ?? recipe.ingredients ?? ''
  const stepsStr = override?.steps ?? recipe.steps ?? ''
  const ingLines = splitRecipeLines(ingredientsStr)
  const stepLines = splitRecipeLines(stepsStr)
  const fullText = `${recipe.name} ${ingredientsStr} ${stepsStr}`.toLowerCase()

  // 1. Eat time
  let eatTime = override?.eat_time ?? recipe.eat_time ?? ''
  if (!eatTime.trim()) {
    const mt = (override?.meal_type ?? recipe.meal_type ?? '').toLowerCase()
    if (mt === 'breakfast') eatTime = '~8:00 AM'
    else if (mt === 'lunch') eatTime = '~1:00 PM'
    else if (mt === 'dinner') eatTime = '~7:30 PM'
    else if (mt === 'snack') eatTime = '~4:00 PM'
    else if (mt === 'dessert') eatTime = '~8:30 PM'
    else eatTime = '~1:00 PM'
  }

  // 2. Prep time
  let prepTime = override?.prep_time ?? recipe.prep_time ?? ''
  if (!prepTime.trim()) {
    if (ingLines.length > 8 || stepLines.length > 6) prepTime = '15 mins'
    else if (ingLines.length > 4 || stepLines.length > 3) prepTime = '10 mins'
    else prepTime = '5 mins'
  }

  // 3. Cook time
  let cookTime = override?.cook_time ?? recipe.cook_time ?? ''
  if (!cookTime.trim()) {
    if (/bake|roast|boil|simmer|pressure cook|stew/i.test(fullText)) cookTime = '20 mins'
    else if (/saute|tawa|pan|steam|cook|stir-fry/i.test(fullText)) cookTime = '12 mins'
    else cookTime = '5 mins'
  }

  // 4. Difficulty
  let difficulty = override?.difficulty ?? recipe.difficulty ?? ''
  if (!difficulty.trim()) {
    difficulty = stepLines.length > 5 ? 'Moderate' : 'Easy'
  }

  // 5. Health score
  let healthScore = override?.health_score ?? recipe.health_score ?? ''
  if (!healthScore.trim()) {
    healthScore = '9/10'
  }

  // 6. Servings
  let servings = override?.servings ?? recipe.servings ?? ''
  if (!servings.trim()) {
    servings = '1 serving'
  }

  // 7. Protein label
  let proteinLabel = override?.protein_label ?? recipe.protein_label ?? ''
  if (!proteinLabel.trim()) {
    if (/tofu|tempeh|moong|sprouts|chana|chickpea|lentil|dal|besan|soya|sattu|paneer|edamame|protein|egg/i.test(fullText)) {
      proteinLabel = '≈ 15g protein'
    } else {
      proteinLabel = '≈ 10g protein'
    }
  }

  // 8. Tools
  let toolsText = typeof override?.tools === 'string'
    ? override.tools
    : Array.isArray(override?.tools)
      ? override.tools.join('\n')
      : Array.isArray(recipe.tools)
        ? recipe.tools.join('\n')
        : typeof recipe.tools === 'string'
          ? recipe.tools
          : ''
  if (!toolsText.trim()) {
    const detected: string[] = []
    if (/blend|grind|smoothie|juice|puree/i.test(fullText)) detected.push('Blender / Mixer')
    if (/tawa|pan|saute|roast|fry/i.test(fullText)) detected.push('Non-stick Tawa / Pan')
    if (/boil|pot|soup|simmer/i.test(fullText)) detected.push('Cooking Pot')
    if (detected.length === 0) detected.push('Tawa / Pan')
    detected.push('Chopping Board & Knife', 'Mixing Bowl')
    toolsText = detected.join('\n')
  }

  // 9. Notes
  let notesText = typeof override?.notes === 'string'
    ? override.notes
    : Array.isArray(override?.notes)
      ? override.notes.join('\n')
      : Array.isArray(recipe.notes)
        ? recipe.notes.join('\n')
        : typeof recipe.notes === 'string'
          ? recipe.notes
          : ''
  if (!notesText.trim()) {
    notesText = [
      'Best enjoyed fresh right after preparation.',
      'Chew thoroughly to support optimal digestion and nutrient absorption.'
    ].join('\n')
  }

  // 10. Benefits (Why it works)
  let benefitsText = typeof override?.benefits === 'string'
    ? override.benefits
    : Array.isArray(override?.benefits)
      ? override.benefits.join('\n')
      : Array.isArray(recipe.benefits)
        ? recipe.benefits.join('\n')
        : typeof recipe.benefits === 'string'
          ? recipe.benefits
          : ''
  if (!benefitsText.trim()) {
    const list: string[] = []
    if (/sprouts|moong|lentil|chana|chickpea|dal/i.test(fullText)) {
      list.push('Sprouts & Lentils — Rich in bioavailable plant protein, folate, and gut-friendly prebiotic fiber.')
    }
    if (/ginger|turmeric|garlic|cumin|spices/i.test(fullText)) {
      list.push('Ginger & Spices — Natural digestive stimulant that reduces inflammation and bloating.')
    }
    if (/spinach|leafy|kale|moringa|greens|cucumber/i.test(fullText)) {
      list.push('Leafy Greens — High in chlorophyll, magnesium, and essential micronutrients for cellular detox.')
    }
    if (/oats|ragi|jowar|millet|quinoa|rice|buckwheat/i.test(fullText)) {
      list.push('Whole Grains & Millets — Complex slow-burning carbs that maintain steady blood sugar and energy.')
    }
    if (/almonds|walnuts|brazil|chia|flax|seeds|nuts/i.test(fullText)) {
      list.push('Nuts & Healthy Fats — Rich in essential Omega-3 fatty acids for brain & hormone support.')
    }
    if (/berries|amla|papaya|lemon|orange|fruit/i.test(fullText)) {
      list.push('Fruit & Antioxidants — High Vitamin C content to enhance iron absorption and immunity.')
    }
    if (list.length === 0) {
      list.push(
        'Nutrient Dense — Provides clean, plant-powered energy grounded in anti-inflammatory whole foods.',
        'Digestive Support — Formulated with high-fiber whole ingredients to promote gut motility and metabolic health.'
      )
    }
    benefitsText = list.join('\n')
  }

  return {
    eatTime,
    prepTime,
    cookTime,
    difficulty,
    healthScore,
    servings,
    proteinLabel,
    toolsText,
    notesText,
    benefitsText,
    ingredientsStr,
    stepsStr,
  }
}
