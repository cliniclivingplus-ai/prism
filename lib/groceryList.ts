import { splitRecipeLines } from './recipeText'

export type GroceryCategory = { head: string; items: string[] }

// Single source of truth for the fixed category set, shared with the AI
// categorization route (src/app/api/compass/grocery-list/route.ts) so both the
// regex-based fallback and the AI pass always bucket into the same names.
export const GROCERY_CATEGORY_ORDER = [
  'Fruit',
  'Cruciferous vegetables',
  'Green vegetables & leafy greens',
  'Other vegetables',
  'Grains & millets',
  'Lentils & protein',
  'Nuts & seeds',
  'Herbs, spices & pantry',
  'Other',
]

const CATEGORY_KEYWORDS: { head: string; keywords: string[] }[] = [
  { head: 'Fruit', keywords: ['apple', 'banana', 'papaya', 'pear', 'orange', 'berry', 'berries', 'pomegranate', 'kiwi', 'mango', 'grape', 'lemon', 'lime', 'avocado', 'date', 'fig', 'melon', 'watermelon', 'strawberr', 'blueberr', 'raspberr', 'passionfruit', 'peach', 'plum', 'apricot', 'guava', 'pineapple'] },
  { head: 'Cruciferous vegetables', keywords: ['broccoli', 'cauliflower', 'kale', 'cabbage', 'brussels sprout', 'bok choy', 'arugula', 'rocket', 'radish', 'mooli', 'turnip', 'kohlrabi', 'mustard green', 'watercress', 'horseradish'] },
  { head: 'Green vegetables & leafy greens', keywords: ['spinach', 'palak', 'lettuce', 'zucchini', 'green bean', 'french bean', 'string bean', 'asparagus', 'cucumber', 'celery', 'pea', 'peas', 'green pepper', 'methi', 'fenugreek', 'swiss chard', 'coriander', 'cilantro', 'mint', 'curry leaf', 'curry leaves', 'parsley', 'leek', 'gourd', 'bottle gourd', 'bitter gourd', 'ridge gourd', 'ash gourd', 'lauki', 'torai', 'karela', 'okra', 'bhindi', 'spring onion', 'scallion'] },
  { head: 'Other vegetables', keywords: ['tomato', 'onion', 'garlic', 'ginger', 'pumpkin', 'carrot', 'beet', 'beetroot', 'sweet potato', 'potato', 'eggplant', 'brinjal', 'bell pepper', 'capsicum', 'mushroom', 'corn', 'yam', 'artichoke'] },
  { head: 'Grains & millets', keywords: ['oat', 'rice', 'ragi', 'jowar', 'bajra', 'quinoa', 'buckwheat', 'amaranth', 'millet', 'barley', 'wheat', 'flour', 'bread', 'pasta', 'noodle', 'spaghetti', 'tortilla', 'breadcrumb', 'poha'] },
  { head: 'Lentils & protein', keywords: ['moong', 'masoor', 'chana', 'toor dal', 'dal', 'rajma', 'tofu', 'tempeh', 'edamame', 'sprout', 'hummus', 'lentil', 'chickpea', 'bean', 'egg', 'chicken', 'fish', 'salmon', 'prawn', 'steak', 'bacon', 'paneer', 'yogurt', 'yoghurt', 'curd', 'milk', 'cheese'] },
  { head: 'Nuts & seeds', keywords: ['almond', 'walnut', 'brazil nut', 'chia', 'flaxseed', 'flax seed', 'pumpkin seed', 'sesame', 'sunflower seed', 'cashew', 'pistachio', 'tahini', 'hemp seed'] },
  { head: 'Herbs, spices & pantry', keywords: ['cinnamon', 'turmeric', 'cumin', 'coriander powder', 'black pepper', 'salt', 'honey', 'vinegar', 'oil', 'coconut', 'vanilla', 'cardamom', 'clove', 'bay leaf', 'mustard seed', 'chili', 'chilli', 'paprika', 'oregano', 'stock', 'sweetener', 'sauce', 'pesto', 'sugar', 'baking powder', 'cocoa', 'fennel', 'asafoetida', 'hing', 'jeera', 'seasoning', 'tamari', 'spirulina', 'matcha', 'jaggery'] },
]

const VAGUE_REFERENCE = /^(remaining|rest of|leftover)\b/i

const JUNK_ITEM_NAMES = new Set([
  'water', 'powder', 'ream', 'mixture', 'extract', 'kcal', 'calorie', 'calories', 'carb', 'carbs', 'protein', 'fat', 'fats', 'fiber', 'nutrition', 'nutrition information', 'ingredient', 'ingredients',
  'into', 'half', 'each', 'for', 'let', 'once', 'then', 'now', 'next', 'before', 'after', 'during', 'while', 'store', 'rest', 'top', 'batter', 'longer', 'storage', 'longer storage', 'for longer storage',
])

const NOISE_WORDS = /\b(fresh|freshly|finely|coarsely|roughly|thinly|thickly|small|medium|large|extra|ripe|boneless|skinless|deveined|peeled|grated|chopped|sliced|diced|minced|crushed|crumbled|drained|rinsed|cooked|raw|packet|packets|bag|bags|box|boxes|tin|tins|jar|jars|can|cans|lean|rasher|rashers|thumb|sized|piece|pieces|clove|cloves|halved|halves|julienned|julienne|quartered|shredded|leaf|leaves|root|roots|head|heads|bunch|bunches|sprig|sprigs|stick|sticks|stalk|stalks|wedge|wedges|slice|slices|cube|cubes|cubed|optional|garnish|organic|pure|cold|pressed|virgin|ground|powdered|soaked|dry|dried|roasted|toasted|steamed|boiled|blanched|pitted|seedless|seeded|unsweetened|sweetened|warm|hot|chilled)\b/gi

const SPELLING_VARIANTS: Record<string, string> = { chilly: 'chilli', chili: 'chilli' }

const CANONICAL_ALIASES: Record<string, string> = {
  'garlic clove': 'garlic',
  'garlic cloves': 'garlic',
  'clove garlic': 'garlic',
  'cloves garlic': 'garlic',
  'minced garlic': 'garlic',
  'garlic powder': 'garlic',
  'ginger root': 'ginger',
  'fresh ginger': 'ginger',
  'ginger piece': 'ginger',
  'grated ginger': 'ginger',
  'lemon juice': 'lemon',
  'fresh lemon': 'lemon',
  'lime juice': 'lime',
  'fresh lime': 'lime',
  'extra virgin olive oil': 'olive oil',
  'evoo': 'olive oil',
  'virgin coconut oil': 'coconut oil',
  'toasted sesame oil': 'sesame oil',
  'baby spinach': 'spinach',
  'spinach leaf': 'spinach',
  'spinach leaves': 'spinach',
  'fresh spinach': 'spinach',
  'coriander leaf': 'coriander leaves',
  'coriander leaves': 'coriander leaves',
  'cilantro': 'coriander leaves',
  'cilantro leaf': 'coriander leaves',
  'cilantro leaves': 'coriander leaves',
  'fresh coriander': 'coriander leaves',
  'mint leaf': 'mint leaves',
  'mint leaves': 'mint leaves',
  'fresh mint': 'mint leaves',
  'curry leaf': 'curry leaves',
  'fresh curry leaves': 'curry leaves',
  'jeera': 'cumin',
  'cumin seed': 'cumin',
  'cumin seeds': 'cumin',
  'cumin powder': 'cumin',
  'ground cumin': 'cumin',
  'turmeric powder': 'turmeric',
  'mustard seed': 'mustard seeds',
  'rai': 'mustard seeds',
  'black pepper powder': 'black pepper',
  'ground black pepper': 'black pepper',
  'sea salt': 'salt',
  'rock salt': 'salt',
  'pink salt': 'salt',
  'himalayan salt': 'salt',
  'chili powder': 'chilli powder',
  'red chili powder': 'chilli powder',
  'red chilli powder': 'chilli powder',
  'green chili': 'green chilli',
  'green chillies': 'green chilli',
  'green pepper': 'green capsicum',
  'bell pepper': 'capsicum',
  'red bell pepper': 'red capsicum',
  'yellow bell pepper': 'yellow capsicum',
  'spring onion': 'scallion',
  'spring onions': 'scallion',
  'scallions': 'scallion',
  'flax seed': 'flaxseed',
  'flax seeds': 'flaxseed',
  'flaxseed meal': 'flaxseed',
  'chia seed': 'chia seeds',
  'sesame seed': 'sesame seeds',
  'til': 'sesame seeds',
  'pumpkin seed': 'pumpkin seeds',
  'sunflower seed': 'sunflower seeds',
  'almond': 'almonds',
  'walnut': 'walnuts',
  'cashew nut': 'cashews',
  'cashew nuts': 'cashews',
  'cashew': 'cashews',
  'date': 'dates',
  'pitted dates': 'dates',
  'date paste': 'dates',
  'rolled oats': 'oats',
  'steel cut oats': 'oats',
  'instant oats': 'oats',
  'oat flour': 'oats',
  'brown rice flour': 'brown rice',
  'cooked quinoa': 'quinoa',
  'raw quinoa': 'quinoa',
  'plant based milk': 'plant milk',
  'almond milk': 'almond milk',
  'soy milk': 'soy milk',
  'oat milk': 'oat milk',
  'coconut milk': 'coconut milk',
  'thick coconut milk': 'coconut milk',
  'thin coconut milk': 'coconut milk',
  'hung curd': 'curd',
  'greek yogurt': 'yogurt',
  'plain yogurt': 'yogurt',
  'firm tofu': 'tofu',
  'silken tofu': 'tofu',
  'extra firm tofu': 'tofu',
  'sprouted moong': 'moong sprouts',
  'moong bean': 'moong dal',
  'yellow moong dal': 'moong dal',
  'green moong dal': 'moong dal',
  'chana dal': 'chana',
  'garbanzo bean': 'chickpeas',
  'garbanzo beans': 'chickpeas',
  'kabuli chana': 'chickpeas',
  'black chana': 'chana',
  'kidney bean': 'rajma',
  'kidney beans': 'rajma',
  'apple cider vinegar': 'apple cider vinegar',
  'acv': 'apple cider vinegar',
  'psyllium husk': 'psyllium husk',
  'isabgol': 'psyllium husk',
  'amla powder': 'amla',
  'amla juice': 'amla',
  'wheatgrass powder': 'wheatgrass',
  'wheatgrass juice': 'wheatgrass',
  'maca root powder': 'maca powder',
}

const UNIT_ALT = 'cups?|tbsps?|tbsp\\.?|tablespoons?|tsps?|tsp\\.?|teaspoons?|grams?|g|kg|mg|ml|milliliters?|l|liters?|oz\\.?|ounces?|lbs?|lb\\.?|pounds?|cloves?|inch(?:es)?|pinch(?:es)?|handfuls?|slices?|pieces?|bunch(?:es)?|stalks?|sprigs?|cans?|packets?|jars?|tins?|boxes?|each|drizzles?|splash(?:es)?|dash(?:es)?'
const LEADING_QTY = /^[\d½¼¾⅓⅔]+(\s*(?:[\-\/.]|\bto\b)\s*[\d½¼¾⅓⅔]+)*\s*/i
const LEADING_MULT = /^[x×]\s*/i
const LEADING_UNIT = new RegExp(`^(?:${UNIT_ALT})\\.?\\s+`, 'i')
const LEADING_OF = /^of\s+/i
const TRAILING_QTY_UNIT = new RegExp(`\\s+[\\d½¼¾⅓⅔]+(\\s*[\\-/.]\\s*[\\d½¼¾⅓⅔]+)*(?:\\s+(?:${UNIT_ALT})\\.?)*\\s*$`, 'i')
const ALL_CAPS_HEADER = /^[A-Z][A-Z\s\-]+$/

const INSTRUCTION_START = /^(?:(?:lightly|gently|quickly|slowly|carefully|thoroughly|briefly)\s+)?(add|cook|heat|mix|boil|simmer|saut[eé]?|roast|bake|garnish|drain|rinse|soak|transfer|grind|blend|crackle|temper|roll|cover|crush|whisk|fold|marinate|sprinkle|dry\s+roast|pressure\s+cook|preheat|pre-heat|combine|toast|plate|serve|repeat|once|then|now|next|let|top|place|layer|drizzle|pour|squeeze|arrange|wrap|divide|spread|dust|knead|rest|chill|freeze|refrigerate|reserve|discard|remove|allow|continue|dip|coat|brush|flip|press|shape|stuff|reduce|cool|halve|in\s+a|in\s+the|for\s+(?:the|garnish|serving|topping|storage|later|tempering|dusting|longer))\b/i
const MID_LINE_INSTRUCTION = /\b(?:let\s+the|once\s+\w|then\s+\w|now\s+\w|next\s+\w|pressure\s+cook|dry\s+roast|marinate|refrigerate|preheat|garnish\s+with|transfer\s+to|combine\s+and|mix\s+well|whisk\s+together|fold\s+in|set\s+aside|allow\s+to|for\s+(?:topping|garnish|garnishing|serving|dusting|later|storage))\b/i
const ENDS_LIKE_A_SENTENCE = /[.!]\s*$/
const COLUMN_GAP = /\s{2,}/

function stripLeakedInstructionText(line: string): string {
  const gapIdx = line.search(COLUMN_GAP)
  if (gapIdx > 0) {
    const left = line.slice(0, gapIdx).trim()
    if (left && !INSTRUCTION_START.test(left)) return left
    if (!left) return ''
  }
  const commaIdx = line.indexOf(',')
  if (commaIdx > 0) {
    const prefix = line.slice(0, commaIdx).trim()
    const rest = line.slice(commaIdx + 1).trim()
    if (!INSTRUCTION_START.test(prefix) && rest.length > 12 && (INSTRUCTION_START.test(rest) || ENDS_LIKE_A_SENTENCE.test(rest))) {
      return prefix
    }
  }
  const midMatch = line.match(MID_LINE_INSTRUCTION)
  if (midMatch && midMatch.index! > 0) {
    const prefix = line.slice(0, midMatch.index).trim()
    if (prefix && !INSTRUCTION_START.test(prefix)) return prefix
  }
  if (INSTRUCTION_START.test(line) || ENDS_LIKE_A_SENTENCE.test(line)) return ''
  return line
}

const KEEP_PLURAL = new Set(['oats', 'peas', 'greens', 'sprouts', 'seeds', 'nuts', 'beans', 'lentils', 'noodles', 'tortillas', 'chickpeas', 'breadcrumbs', 'walnuts', 'almonds', 'grapes'])

function singularizeWord(word: string): string {
  const lower = word.toLowerCase()
  if (KEEP_PLURAL.has(lower)) return word
  if (lower.length > 4 && lower.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (lower.length > 4 && lower.endsWith('oes')) return word.slice(0, -2)
  if (lower.length > 4 && /(?:ch|sh|x|z)es$/.test(lower)) return word.slice(0, -2)
  if (lower.length > 3 && lower.endsWith('s') && !/(?:us|ss|is)$/.test(lower)) return word.slice(0, -1)
  return word
}

function extractItemName(line: string): string {
  let s = line.trim()
  if (ALL_CAPS_HEADER.test(s) && s.length >= 3) return ''
  if (s.includes(':')) s = s.slice(s.lastIndexOf(':') + 1).trim()
  s = stripLeakedInstructionText(s)
  if (!s) return ''
  if (VAGUE_REFERENCE.test(s)) return ''
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/\([^)]*$/, '').trim()
  s = s.replace(/\([^)]*\)/g, '')
  s = s.split(',')[0]
  s = s.replace(/\b(to taste|as (?:needed|required|desired|per taste)|if needed|for taste)\b/gi, '')
  s = s.replace(/\bof\s+[\d½¼¾⅓⅔]+(?:\.\d+)?\s+/gi, 'of ')

  let prev = ''
  while (prev !== s) {
    prev = s
    s = s.replace(LEADING_QTY, '').replace(LEADING_MULT, '').replace(LEADING_UNIT, '').replace(LEADING_OF, '').trim()
  }
  s = s.replace(TRAILING_QTY_UNIT, '')

  s = s.replace(/-/g, ' ')
  s = s.replace(NOISE_WORDS, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/^(a|an|the|of)\s+/i, '').replace(/\s+(of|and|or|with|in)$/i, '').trim()
  s = s.replace(/^[.,;:\-\s]+/, '').replace(/[.,;:\-\s]+$/, '').trim()
  if (/^(and|or|a|an|the|of|with|in)$/i.test(s)) return ''

  s = s.toLowerCase()
  if (!/\b(and|or)\b/.test(s)) {
    const words = s.split(' ')
    words[words.length - 1] = singularizeWord(words[words.length - 1])
    s = words.join(' ')
  }
  s = s.split(' ').map((w) => SPELLING_VARIANTS[w] || w).join(' ')
  s = CANONICAL_ALIASES[s] || s
  if (JUNK_ITEM_NAMES.has(s)) return ''
  return s
}

function splitAndJoinedItems(name: string): string[] {
  if (!name) return []
  const parts = name.split(/\s*&\s*|\s+and\s+/i).map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts : [name]
}

function titleCase(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

function categorize(name: string): string {
  const lower = name.toLowerCase()
  for (const cat of CATEGORY_KEYWORDS) {
    if (cat.keywords.some((kw) => lower.includes(kw))) return cat.head
  }
  return 'Other'
}

export function buildGroceryList(recipes: { ingredients: string }[]): GroceryCategory[] {
  const buckets = new Map<string, Map<string, string>>()
  for (const recipe of recipes) {
    let insideWrappedParen = false
    for (const line of splitRecipeLines(recipe.ingredients || '')) {
      if (insideWrappedParen) {
        if (line.includes(')')) insideWrappedParen = false
        continue
      }
      const opens = (line.match(/\(/g) || []).length
      const closes = (line.match(/\)/g) || []).length
      if (opens > closes) insideWrappedParen = true
      for (const rawName of splitAndJoinedItems(extractItemName(line))) {
        if (!rawName || rawName.length < 2) continue
        const name = CANONICAL_ALIASES[rawName.toLowerCase()] || rawName
        const display = titleCase(name)
        const key = name.toLowerCase()
        const head = categorize(name)
        if (!buckets.has(head)) buckets.set(head, new Map())
        buckets.get(head)!.set(key, display)
      }
    }
  }
  return GROCERY_CATEGORY_ORDER
    .filter((head) => buckets.has(head))
    .map((head) => ({ head, items: [...buckets.get(head)!.values()].sort((a, b) => a.localeCompare(b)) }))
}
