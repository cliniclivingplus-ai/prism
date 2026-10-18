import { CATEGORY_KEYWORDS, GROCERY_CATEGORY_ORDER, type GroceryCategory } from './groceryList'
import sourceRepairs from './recipeBankSourceRepairs.json'

export type ShoppingRecipe = { id?: string; name?: string; ingredients: string }
export type ShoppingIssue = { recipe: string; line: string; reason: string }
const aliases: Record<string, string> = {
  potatoes: 'potato', tomatoes: 'tomato', onions: 'onion', chillies: 'chilli', chilies: 'chilli', chili: 'chilli', chilly: 'chilli',
  'red chili powder': 'chilli powder', 'red chilli powder': 'chilli powder', 'chili powder': 'chilli powder',
  'green chili': 'green chilli', 'green chillies': 'green chilli',
  cilantro: 'coriander leaves', 'coriander leaf': 'coriander leaves', 'coriander leaves': 'coriander leaves',
  'curry leaf': 'curry leaves', 'mint leaf': 'mint leaves', 'garlic cloves': 'garlic', 'cloves garlic': 'garlic',
  'lady finger': 'okra', 'ladies finger': 'okra', 'ladyfinger': 'okra', bhindi: 'okra', brinjal: 'eggplant', aubergine: 'eggplant',
  'bell pepper': 'capsicum', 'red bell pepper': 'red capsicum', 'green bell pepper': 'green capsicum',
  'spring onion': 'scallion', 'spring onions': 'scallion', 'flax seeds': 'flaxseed', 'flax seed': 'flaxseed',
  jeera: 'cumin seeds', 'cumin seed': 'cumin seeds', 'mustard seed': 'mustard seeds',
  'chia seed': 'chia seeds', 'pumpkin seed': 'pumpkin seeds', 'sunflower seed': 'sunflower seeds', 'sesame seed': 'sesame seeds',
  'cashew nut': 'cashews', 'cashew nuts': 'cashews', cashew: 'cashews', almond: 'almonds', walnut: 'walnuts',
  date: 'dates', 'kidney beans': 'rajma', 'kidney bean': 'rajma', 'garbanzo beans': 'chickpeas', 'garbanzo bean': 'chickpeas',
  'kabuli chana': 'chickpeas', 'split chickpeas': 'chana dal', 'bengal gram dal': 'chana dal',
  'mung dal': 'moong dal', 'rolled oats': 'oats', oatmeal: 'oats', 'plant based milk': 'plant milk',
  'extra virgin olive oil': 'olive oil', 'baby spinach': 'spinach', 'spinach leaves': 'spinach',
  'sea salt': 'salt', 'rock salt': 'salt', 'pink salt': 'salt',
  'asafoetida / hing': 'asafoetida', 'asafetida': 'asafoetida', hing: 'asafoetida',
  'methi / fenugreek seeds': 'fenugreek seeds', 'channa daal': 'chana dal',
  'urad daal': 'urad dal', 'moong daal': 'moong dal', 'toor daal': 'toor dal',
  'red chillis': 'red chilli', 'dried red chillis': 'dried red chilli',
  'coriander stems & leaves': 'coriander leaves', 'coriander stems and leaves': 'coriander leaves',
  'date paste': 'dates paste',
}
const units = /^(?:(?:cups?|tbsp\.?|tsp\.?|tablespoons?|teaspoons?|g|grams?|kg|ml|litres?|liters?|oz|ounces?|lbs?|pounds?|cloves?|inches?|pinch(?:es)?|handfuls?|slices?|pieces?|bunch(?:es)?|stalks?|sprigs?|cans?|packets?|pods?|stems?|heads?|bowls?)\s+(?:of\s+)?)/i
const qty = /^(?:(?:\d+(?:\.\d+)?(?:\s*\/\s*\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])+\s*(?:(?:–|-|to|×|x)\s*)?)+/i
const prep = /\b(?:fresh|freshly|finely|roughly|thinly|coarsely|small|medium|large|peeled|grated|chopped|sliced|diced|minced|crushed|rinsed|drained|soaked|boiled|steamed|cooked|raw|ripe|pitted|seedless|washed|florets|cubed|cubes|chilled|optional|extra|warm|cold)\b/gi
const instruction = /^(?:(?:gently|slowly|then|now)\s+)?(?:add|heat|cook|stir|mix|blend|grind|boil|simmer|serve|fry|bake|roast|cover|drain|soak|rinse|wash|remove|allow|transfer|bring|pressure cook|preheat|once|when|until|overnight|cut into|chopped|for the|for serving|for garnish|remaining|rest of|leftover)\b/i
const bare = /^(?:water|ingredients?|directions?|instructions?|method|salt to taste|to taste|as needed|optional|tempering|spices|seasonings|powder|mixture|batter|protein|calories?|kcal|fat|carbs?|fiber|servings?|minutes?)$/i
const keyText = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[’']/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim()

export function shoppingItemKey(value: string): string {
  let key = keyText(value).replace(/\b(?:chili|chilly|chilies|chillies|chillis)\b/g, 'chilli').replace(prep, ' ').replace(/\s+/g, ' ').trim()
  key = aliases[key] || key
  // A cooking/preparation suffix does not make a second shopping item.
  // Product forms (powder, flour, milk, paste, seeds) are intentionally kept.
  key = key.replace(/\s+(?:fryy?|fried|boiled|steamed|roasted|chopped|diced|sliced)$/, '')
  key = aliases[key] || key
  return key
}

const words = (s: string) => keyText(s).split(/[^a-z0-9]+/).filter(Boolean).map((w) => w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.endsWith('oes') ? w.slice(0, -2) : /(?:ch|sh|x|z)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !/(?:ss|us)$/.test(w) ? w.slice(0, -1) : w)
const phrase = (text: string, part: string) => {
  const haystack = ` ${words(text).join(' ')} `
  return haystack.includes(` ${words(part).join(' ')} `)
}

export function shoppingCategory(name: string): string {
  if (/\bbesan\b/i.test(name)) return 'Lentils & protein'
  if (/\b(?:acv|passata)\b/i.test(name)) return 'Herbs, spices & pantry'
  if (/\b(?:milk|yogh?urt|curd)\b/i.test(name)) return 'Lentils & protein'
  if (/\b(?:flour|atta|starch)\b/i.test(name)) return /\b(?:gram|chickpea|lentil|soy)\b/i.test(name) ? 'Lentils & protein' : 'Grains & millets'
  if (/\b(?:powder|paste|sauce|oil|vinegar|syrup|extract|masala|flakes)\b/i.test(name)) {
    if (/\b(?:protein|pea protein|soy protein)\s+powder\b/i.test(name)) return 'Lentils & protein'
    return 'Herbs, spices & pantry'
  }
  if (/\b(?:amaranth|methi|fenugreek|coriander|mint|curry)\s+(?:leaf|leaves|greens)\b/i.test(name)) return 'Green vegetables & leafy greens'
  if (/\b(?:okra|capsicum)\b/i.test(name)) return 'Other vegetables'
  if (/\b(?:chutney|pickle|pulp)\b/i.test(name)) return 'Herbs, spices & pantry'
  if (/^(?:(?:red|green|fresh|whole)\s+)?chilli$/i.test(name)) return 'Other vegetables'
  if (/\b(?:seed|seeds|nuts|butter)\b/i.test(name) && /\b(?:pumpkin|sunflower|sesame|chia|flax|melon|hemp|peanut|almond|cashew)\b/i.test(name)) return 'Nuts & seeds'
  let best = { head: 'Other', length: 0 }
  for (const cat of CATEGORY_KEYWORDS) for (const keyword of cat.keywords) {
    if (keyword.length > best.length && phrase(name, keyword)) best = { head: cat.head, length: keyword.length }
  }
  return best.head
}

const extraFoods = ['besan', 'sattu', 'passata', 'acv', 'asafoetida', 'green chilli', 'red chilli', 'capsicum', 'okra', 'red rice', 'brown rice', 'toor dal', 'urad dal', 'chana dal', 'moong dal', 'plant milk', 'curry leaves', 'coriander leaves', 'mint leaves', 'basil leaves', 'fenugreek seeds', 'mustard seeds', 'cumin seeds', 'sea salt', 'chana', 'green moong', 'channa daal', 'urad daal', 'toor daal', 'moong daal', 'water']
const foods = [...new Set([...CATEGORY_KEYWORDS.flatMap((category) => category.keywords), ...Object.keys(aliases), ...Object.values(aliases), ...extraFoods])]
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const foodMatchers = foods.map((food) => new RegExp(`\\b((?:(?:green|red|yellow|black|white|brown|whole|dried|ground|rolled|steel cut|unsweetened)\\s+)*${escaped(food)}(?:s|es)?(?:\\s+(?:powder|flour|milk|paste|sauce|oil|butter|seeds?|leaves|flakes|pulp|juice|chutney|stock|broth))?)\\b`, 'i'))
const foodWords = new Set(foods.flatMap((food) => food.toLowerCase().split(/[^a-z]+/)).concat(['green', 'red', 'yellow', 'black', 'white', 'brown', 'whole', 'dried', 'ground', 'rolled', 'unsweetened', 'powder', 'flour', 'milk', 'paste', 'sauce', 'oil', 'butter', 'seeds', 'leaves', 'flakes', 'pulp', 'juice', 'chutney', 'stock', 'broth', 'or']))
// Restrict accepted items to an explicitly named food phrase. Stray PDF
// fragments such as "Menu", "base", "until soft" never become groceries.
function foodPhrase(text: string): string {
  const candidates: { name: string; length: number }[] = []
  for (const matcher of foodMatchers) {
    const match = text.match(matcher)
    if (match) candidates.push({ name: match[1], length: match[1].length })
  }
  const best = candidates.sort((a, b) => b.length - a.length)[0]
  if (best && /\b(?:paste|powder|flour|oil|milk|sauce|butter)$/.test(text) && text.split(/\s+/).every((word) => foodWords.has(word))) return shoppingItemKey(text)
  if (best && /\s+(?:or|\/)\s+/.test(text)) {
    const alternatives = text.split(/\s+(?:or|\/)\s+/).map((part) => foodPhrase(part))
    if (alternatives.every(Boolean)) return [...new Set(alternatives)].join(' or ')
  }
  return best ? shoppingItemKey(best.name) : ''
}

function ingredientName(raw: string): string {
  let text = raw.trim().replace(/^[•▪◦·◆\uFFFD\uF0B7\-]+\s*/, '').replace(/^\d+[.)]\s+/, '')
  if (!text || /^(?:for\b|optional tempering|ingredients|directions|instructions|method|notes?|nutrition|calories|servings?|prep time|cook time)/i.test(text) || /:\s*$/.test(text)) return ''
  // Respect the ingredient column when an old PDF import joined columns.
  text = text.split(/\s{2,}/)[0]
  text = text.split(/\s+[\uFFFD•]\s+(?=[A-Z])/)[0]
  text = text.replace(/[\uFFFD◆•▪\uF0B7]/g, ' ').trim()
  text = text.replace(/\bcoriander\s+stems?\s*(?:&|and)\s*leaves\b/gi, 'coriander leaves')
  if (instruction.test(text)) return ''
  text = text.replace(/\b(?:add|heat|cook|stir|mix|blend|grind|boil|simmer|cover|serve|then|once)\b.*$/i, '').trim()
  text = text.replace(/\([^)]*\)/g, '').replace(/\([^)]*$/, '')
  text = text.replace(/\s+(?:–|—|-)\s*[\d¼½¾⅓⅔⅛⅜⅝⅞].*$/, '').replace(/\s+\d+(?:[½¼¾]|\/\d+)?\s*(?:g|tsp|tbsp|cup|ml|medium|small|large)\b.*$/i, '')
  text = text.split(/,\s*(?:finely|roughly|chopped|sliced|diced|minced|peeled|grated|soaked|rinsed|drained|to taste|adjust|optional)/i)[0]
  text = text.replace(/\b(?:to taste|as needed|as required|for garnish|for tempering|for seasoning|for frying|for serving|for dusting|for rolling|to season)\b.*$/i, '')
  let previous = ''
  while (previous !== text) { previous = text; text = text.replace(qty, '').replace(units, '').replace(/^(?:of|a|an|the|few|about)\s+/i, '').trim() }
  text = text.replace(prep, ' ').replace(/\b(?:pieces?|cloves?|pods?|stems?|sprigs?|handfuls?)\b/gi, ' ').replace(/\s+/g, ' ').replace(/^[\s,;:/–—-]+|[\s,;:/–—-]+$/g, '').trim()
  if (!text || bare.test(text) || instruction.test(text) || /[.!?]/.test(text) || /\b(?:minutes?|whistles?|overnight|until|consistency|instead|you|your|this|that)\b/i.test(text)) return ''
  return shoppingItemKey(text)
}

export function extractRecipeShoppingList(recipes: ShoppingRecipe[]): { categories: GroceryCategory[]; issues: ShoppingIssue[] } {
  const items = new Map<string, string>()
  const issues: ShoppingIssue[] = []
  const repairs = sourceRepairs as Record<string, { original: { ingredients: string }; cleaned: { ingredients: string } }>
  for (const recipe of recipes) {
    const repair = recipe.id ? repairs[recipe.id] : undefined
    const ingredients = repair?.original.ingredients === recipe.ingredients ? repair.cleaned.ingredients : recipe.ingredients
    for (const raw of (ingredients || '').split(/\n|;\s*|,\s*(?=\d)/)) {
      if (!raw.trim()) continue
      const name = ingredientName(raw)
      if (!name) { if (!bare.test(raw.trim()) && !/:\s*$/.test(raw) && !/^for\b/i.test(raw.trim()) && !/^(?:warm\s+|cold\s+)?water\b|^(?:base|menu|add-on)$/i.test(raw.trim())) issues.push({ recipe: recipe.name || 'Recipe', line: raw.trim(), reason: 'Could not confidently identify a shopping ingredient.' }); continue }
      // Explicit synonyms are one food, not several purchases.
      const synonyms = /chana dal\s*\/\s*bengal gram(?: dal)?(?:\s*\/\s*split chickpeas)?/i.test(name)
      const canonical = aliases[name]
      const parts = synonyms ? ['chana dal'] : canonical ? [canonical] : name.split(/\s+and\s+|\s*[&+]\s*|,\s*(?=[a-z])/i)
      for (const part of parts) {
        const key = foodPhrase(part)
        if (!key || bare.test(key)) { if (!bare.test(part)) issues.push({ recipe: recipe.name || 'Recipe', line: raw.trim(), reason: 'Ingredient name needs review.' }); continue }
        if (key.split(/\s+/).length > 6 || /\d/.test(key) || /\[|\]/.test(key)) { issues.push({ recipe: recipe.name || 'Recipe', line: raw.trim(), reason: 'Ingredient text needs review.' }); continue }
        if (!items.has(key)) items.set(key, key[0].toUpperCase() + key.slice(1))
      }
    }
  }
  const buckets = new Map<string, string[]>()
  for (const name of items.values()) { const head = shoppingCategory(name); buckets.set(head, [...(buckets.get(head) || []), name]) }
  return { categories: GROCERY_CATEGORY_ORDER.filter((head) => buckets.has(head)).map((head) => ({ head, items: buckets.get(head)!.sort((a, b) => a.localeCompare(b)) })), issues }
}

// Coach edits preserve the chosen category and product name. Only blanks and
// duplicate entries are removed; this does not regenerate their saved list.
export function normalizeShoppingDraft(categories: GroceryCategory[]): GroceryCategory[] {
  const seen = new Set<string>()
  const merged = new Map<string, GroceryCategory>()
  for (const category of categories) {
    const head = category.head.trim()
    if (!head) continue
    const groupKey = keyText(head)
    const group = merged.get(groupKey) || { head, items: [] }
    for (const raw of category.items) {
      const item = raw.trim()
      const key = shoppingItemKey(item)
      if (!key || seen.has(key)) continue
      seen.add(key); group.items.push(item)
    }
    merged.set(groupKey, group)
  }
  return [...merged.values()].filter((category) => category.items.length)
}
