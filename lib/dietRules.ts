// Living Plus is vegetarian-only across the board — never suggest meat,
// poultry, fish, seafood, or eggs; dairy (milk, yogurt, paneer, ghee,
// cheese) is fine. This is a standing house rule, not a per-patient
// preference. Never name the diet philosophy itself ("vegetarian",
// "plant-based", "vegan") in generated text — just don't include the
// excluded ingredients.
export const DIET_RULE = 'Every food or meal mentioned must be vegetarian: never suggest meat, poultry, fish, seafood, or eggs. Dairy (milk, yogurt, paneer, ghee, cheese) is fine. Never use the words "vegetarian", "plant-based", "plant based", or "vegan" anywhere in the output — just don\'t include the excluded ingredients, without naming or announcing the constraint.'

// Deterministic backstop for anywhere a recipe/food item gets written to the
// database — a prompt instruction alone isn't a guarantee the model
// followed it, especially when faithfully transcribing something a coach
// pasted. Word-boundary matched, case-insensitive; deliberately excludes
// ambiguous/plant terms (e.g. "eggplant") that would false-positive.
export const NON_VEG_TERMS = [
  'chicken', 'mutton', 'lamb', 'goat meat', 'beef', 'pork', 'bacon', 'ham', 'sausage', 'salami', 'pepperoni',
  'turkey', 'duck', 'venison', 'meat',
  'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'anchovy', 'anchovies', 'sardine', 'mackerel',
  'shrimp', 'prawn', 'crab', 'lobster', 'squid', 'octopus', 'oyster', 'clam', 'mussel', 'scallop', 'seafood',
  'egg', 'eggs', 'omelette', 'omelet',
  'gelatin', 'lard',
]

// Returns the first matching non-veg term found in the given text (name,
// ingredients, etc.), or null if none. Word-boundary matched so "egg" won't
// false-positive inside "eggplant".
export function findNonVegTerm(text: string): string | null {
  return NON_VEG_TERMS.find((term) => new RegExp('\\b' + term + '\\b', 'i').test(text)) ?? null
}

// A prompt instruction not to say "vegetarian"/"plant-based" is a request,
// not a guarantee — a 20B open-weight model on low reasoning effort visibly
// ignores it sometimes (observed live: "...keeps it all plant-based" in an
// otherwise-compliant reply). Deterministically strips the label words
// themselves out of model output as a backstop, since the actual dietary
// content is already enforced separately (DIET_RULE + findNonVegTerm).
// Grammar after stripping won't always be perfect, but never claims a
// dietary label the coach didn't ask about, which matters more here.
const DIET_LABEL_WORDS = /\b(entirely |fully |completely |all |strictly )?(plant-based|plant based|vegetarian|vegan)\b/gi
export function stripDietLabels(text: string): string {
  return text
    .replace(DIET_LABEL_WORDS, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([,.!?])/g, '$1')
    .replace(/\b(keeps it|it's|that's|this is)\s+([,.!?])/gi, '$1$2')
    .trim()
}
