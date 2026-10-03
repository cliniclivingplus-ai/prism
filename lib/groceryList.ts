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
  { head: 'Fruit', keywords: ['apple', 'banana', 'papaya', 'pear', 'orange', 'berry', 'strawberry', 'blueberry', 'raspberry', 'cranberry', 'mulberry', 'gooseberry', 'goji berry', 'pomegranate', 'kiwi', 'mango', 'grape', 'lemon', 'lime', 'sweet lime', 'mosambi', 'avocado', 'date', 'medjool date', 'raisin', 'fig', 'melon', 'watermelon', 'muskmelon', 'passionfruit', 'peach', 'plum', 'apricot', 'guava', 'pineapple', 'cherry', 'jackfruit', 'chikoo', 'sapota', 'custard apple', 'dragon fruit', 'amla'] },
  { head: 'Cruciferous vegetables', keywords: ['broccoli', 'cauliflower', 'kale', 'cabbage', 'brussels sprout', 'bok choy', 'arugula', 'rocket', 'radish', 'mooli', 'turnip', 'kohlrabi', 'mustard green', 'watercress', 'horseradish'] },
  { head: 'Green vegetables & leafy greens', keywords: ['spinach', 'palak', 'lettuce', 'zucchini', 'green bean', 'french bean', 'string bean', 'asparagus', 'cucumber', 'celery', 'pea', 'peas', 'green pepper', 'methi', 'fenugreek', 'tindora', 'ivy gourd', 'drumstick', 'chayote', 'microgreen', 'leafy green', 'basil leaf', 'swiss chard', 'coriander', 'cilantro', 'mint', 'curry leaf', 'curry leaves', 'parsley', 'leek', 'gourd', 'bottle gourd', 'bitter gourd', 'ridge gourd', 'ash gourd', 'lauki', 'torai', 'karela', 'okra', 'bhindi', 'spring onion', 'scallion'] },
  { head: 'Other vegetables', keywords: ['tomato', 'onion', 'garlic', 'ginger', 'pumpkin', 'carrot', 'beet', 'beetroot', 'sweet potato', 'potato', 'eggplant', 'brinjal', 'bell pepper', 'capsicum', 'red pepper', 'green pepper', 'yellow pepper', 'orange pepper', 'cherry tomato', 'mushroom', 'corn', 'sweet corn', 'yam', 'artichoke', 'aubergine', 'butternut squash', 'squash', 'shallot', 'spring onion', 'green onion', 'kimchi', 'olive'] },
  { head: 'Grains & millets', keywords: ['oat', 'rice', 'ragi', 'jowar', 'bajra', 'quinoa', 'buckwheat', 'amaranth', 'millet', 'barley', 'wheat', 'flour', 'bread', 'pasta', 'noodle', 'spaghetti', 'tortilla', 'breadcrumb', 'poha', 'rava', 'rawa', 'sooji', 'suji', 'semolina', 'daliya', 'dalia', 'couscous', 'polenta', 'muri', 'wrap', 'groat', 'sourdough'] },
  { head: 'Lentils & protein', keywords: ['moong', 'mung', 'masoor', 'chana', 'channa', 'chole', 'toor dal', 'dal', 'daal', 'dhal', 'dhall', 'urad', 'arhar', 'rajma', 'lobia', 'cowpea', 'black eyed pea', 'moth bean', 'soybean', 'soy bean', 'bengal gram', 'gram', 'sattu', 'aquafaba', 'buttermilk', 'rajma', 'tofu', 'tempeh', 'edamame', 'sprout', 'hummus', 'lentil', 'chickpea', 'bean', 'egg', 'chicken', 'fish', 'salmon', 'prawn', 'steak', 'bacon', 'paneer', 'yogurt', 'yoghurt', 'curd', 'milk', 'cheese'] },
  { head: 'Nuts & seeds', keywords: ['almond', 'walnut', 'brazil nut', 'chia', 'chia seed', 'flaxseed', 'flax seed', 'pumpkin seed', 'sesame', 'sesame seed', 'sunflower seed', 'melon seed', 'watermelon seed', 'cashew', 'pistachio', 'tahini', 'hemp seed', 'peanut', 'groundnut', 'hazelnut', 'pecan', 'macadamia', 'pine nut', 'nut butter', 'trail mix'] },
  { head: 'Herbs, spices & pantry', keywords: ['cinnamon', 'turmeric', 'cumin', 'coriander powder', 'coriander seed', 'fenugreek seed', 'methi seed', 'carom seed', 'ajwain', 'carom', 'kalonji', 'nigella', 'star anise', 'nutmeg', 'saffron', 'amchur', 'aamchur', 'tamarind', 'kokum', 'cayenne', 'basil', 'thyme', 'dill', 'sage', 'chive', 'rosemary', 'pepper flake', 'chilli flake', 'black pepper', 'white pepper', 'peppercorn', 'rock salt', 'sendha namak', 'baking soda', 'nutritional yeast', 'chocolate', 'cacao', 'molasses', 'miso', 'sriracha', 'siracha', 'gochujang', 'soy sauce', 'tamari', 'liquid amino', 'nori', 'wakame', 'kombu', 'dashi', 'eno', 'salt', 'honey', 'vinegar', 'oil', 'coconut', 'vanilla', 'cardamom', 'clove', 'bay leaf', 'mustard seed', 'chili', 'chilli', 'paprika', 'oregano', 'stock', 'sweetener', 'sauce', 'pesto', 'sugar', 'baking powder', 'cocoa', 'fennel', 'asafoetida', 'hing', 'jeera', 'seasoning', 'tamari', 'spirulina', 'matcha', 'jaggery'] },
]

const VAGUE_REFERENCE = /^(remaining|rest of|leftover)\b/i

const JUNK_ITEM_NAMES = new Set([
  'water', 'powder', 'ream', 'mixture', 'extract', 'kcal', 'calorie', 'calories', 'carb', 'carbs', 'protein', 'fat', 'fats', 'fiber', 'nutrition', 'nutrition information', 'ingredient', 'ingredients',
  'into', 'half', 'each', 'for', 'let', 'once', 'then', 'now', 'next', 'before', 'after', 'during', 'while', 'store', 'rest', 'top', 'batter', 'longer', 'storage', 'longer storage', 'for longer storage',
  'juice from', 'juice of', 'half a', 'few', 'piece', 'pieces', 'portion', 'portions', 'disc of',
])

const NOISE_WORDS = /\b(fresh|freshly|finely|coarsely|roughly|thinly|thickly|small|medium|large|extra|ripe|boneless|skinless|deveined|peeled|grated|chopped|sliced|diced|minced|crushed|crumbled|drained|rinsed|cooked|raw|packet|packets|bag|bags|box|boxes|tin|tins|jar|jars|can|cans|lean|rasher|rashers|thumb|sized|piece|pieces|clove|cloves|halved|halves|julienned|julienne|quartered|shredded|leaf|leaves|root|roots|head|heads|bunch|bunches|sprig|sprigs|stick|sticks|stalk|stalks|wedge|wedges|slice|slices|cube|cubes|cubed|optional|garnish|organic|pure|cold|pressed|virgin|ground|powdered|soaked|dry|dried|roasted|toasted|steamed|boiled|blanched|pitted|seedless|seeded|unsweetened|sweetened|warm|hot|chilled|floret|florets|disc|discs|chunk|chunks|stem|stems|pod|pods|frozen|mashed|few|handful|handfuls|size|big|homemade|mix|mixes)\b/gi

const SPELLING_VARIANTS: Record<string, string> = { chilly: 'chilli', chili: 'chilli' }

const CANONICAL_ALIASES: Record<string, string> = {
  'garlic clove': 'garlic',
  'garlic cloves': 'garlic',
  'clove garlic': 'garlic',
  'cloves garlic': 'garlic',
  'minced garlic': 'garlic',
  'garlic powder': 'garlic',
  'garlic pod': 'garlic',
  'garlic pods': 'garlic',
  'pods garlic': 'garlic',
  'pods of garlic': 'garlic',
  'ginger root': 'ginger',
  'fresh ginger': 'ginger',
  'ginger piece': 'ginger',
  'grated ginger': 'ginger',
  'ginger powder': 'ginger',
  'ginger garlic paste': 'ginger',
  'lemon juice': 'lemon',
  'fresh lemon': 'lemon',
  'juice of lemon': 'lemon',
  'juice from lemon': 'lemon',
  'lime juice': 'lime',
  'fresh lime': 'lime',
  'juice of lime': 'lime',
  'juice from lime': 'lime',
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
  'handful of coriander': 'coriander leaves',
  'coriander powder': 'coriander leaves',
  'coriander chutney': 'coriander leaves',
  'mint leaf': 'mint leaves',
  'mint leaves': 'mint leaves',
  'fresh mint': 'mint leaves',
  'few mint': 'mint leaves',
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
  'pepper corn': 'black pepper',
  'pepper corns': 'black pepper',
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
  'homemade date paste': 'dates',
  'rolled oats': 'oats',
  'steel cut oats': 'oats',
  'instant oats': 'oats',
  'oat flour': 'oats',
  'oatmeal': 'oats',
  'more oats': 'oats',
  'brown rice flour': 'brown rice',
  'brown rice flakes': 'brown rice',
  'rice flakes': 'brown rice',
  'red rice flakes': 'red rice',
  'cooked quinoa': 'quinoa',
  'raw quinoa': 'quinoa',
  'quinoa flakes': 'quinoa',
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
  'vanilla yogurt': 'yogurt',
  'firm tofu': 'tofu',
  'silken tofu': 'tofu',
  'extra firm tofu': 'tofu',
  'big tofu': 'tofu',
  'sprouted moong': 'moong sprouts',
  'green mung sprouts': 'moong sprouts',
  'mung bean sprouts': 'moong sprouts',
  'mung sprouts': 'moong sprouts',
  'mixed sprouts': 'moong sprouts',
  'sprouts': 'moong sprouts',
  'moong bean': 'moong dal',
  'yellow moong dal': 'moong dal',
  'green moong dal': 'moong dal',
  'yellow mung dal': 'moong dal',
  'chana dal': 'chana',
  'garbanzo bean': 'chickpeas',
  'garbanzo beans': 'chickpeas',
  'kabuli chana': 'chickpeas',
  'black chana': 'chana',
  'kidney bean': 'rajma',
  'kidney beans': 'rajma',
  'apple cider vinegar': 'apple cider vinegar',
  'acv': 'apple cider vinegar',
  'squeezed lemon juice': 'lemon',
  'juice of lime or lemon': 'lemon',
  'squeezed lime juice': 'lime',
  'chickpea': 'chickpeas',
  'chickpea flour': 'chickpeas',
  'coriander': 'coriander leaves',
  'stock bok choy': 'bok choy',
  'stems of bok choy': 'bok choy',
  'natural peanut butter': 'peanut butter',
  'frozen blueberries': 'blueberries',
  'blueberry': 'blueberries',
  'frozen mixed berry': 'blueberries',
  'mixed berry': 'blueberries',
  'juicy figs': 'figs',
  'fig': 'figs',
  'barnyard millet': 'millet',
  'foxtail millet': 'millet',
  'little millet': 'millet',
  'millet flake': 'millet',
  'millet flakes': 'millet',
  'brown rice poha': 'rice poha',
  'poha': 'rice poha',
  'quinoa pasta': 'quinoa',
  'psyllium husk': 'psyllium husk',
  'isabgol': 'psyllium husk',
  'amla powder': 'amla',
  'amla juice': 'amla',
  'wheatgrass powder': 'wheatgrass',
  'wheatgrass juice': 'wheatgrass',
  'maca root powder': 'maca powder',
  'broccoli floret': 'broccoli',
  'broccoli florets': 'broccoli',
  'broccoli stem': 'broccoli',
  'broccoli microgreen': 'broccoli',
  'broccoli sprouts': 'broccoli',
  'half a of broccoli cut': 'broccoli',
  'mashed avocado': 'avocado',
  'green apple': 'apple',
  'homemade applesauce': 'apple',
  'applesauce': 'apple',
  'mix of frozen banana': 'banana',
  'frozen banana': 'banana',
  'cherry tomato': 'cherry tomatoes',
  '10 cherry tomatoes': 'cherry tomatoes',
  'sweet potato': 'sweet potato',
  'methi seeds': 'methi',
  'ragi flour': 'ragi',
  'black urad dal': 'black urad dal',
  'red amaranth': 'red amaranth',
  'wholemeal bread': 'wholemeal bread',
  'whole wheat bread': 'wholemeal bread',
  'black pepper corn': 'black pepper',
  'black peppercorn': 'black pepper',
  'black peppercorns': 'black pepper',
  'black peppercorns for': 'black pepper',
  'beet': 'beetroot',
  'beetroot': 'beetroot',
  'beet hummus': 'beetroot',
  'ash gourd': 'ash gourd',
  'ashgourd': 'ash gourd',
  'bottle gourd': 'bottle gourd',
  'bottlegourd': 'bottle gourd',
  'baby corn': 'corn',
  'baby potato': 'potato',
  'baking potato': 'potato',
  'amount of potato': 'potato',
  'baby sweet corn': 'corn',
  'baby carrot': 'carrots',
  'carrots': 'carrots',
  'air fried onion': 'scallion',
  'bok choy greens': 'bok choy',
  'full of bok choy': 'bok choy',
  'brussels sprouts': 'brussels sprouts',
  'brussel sprout': 'brussels sprouts',
  'green cabbage': 'cabbage',
  'cilantro lime rice': 'rice',
  'date pulp': 'dates',
  'cranberry': 'cranberries',
  'apricot': 'apricots',
}

const UNIT_ALT = 'cups?|tbsps?|tbsp\\.?|tablespoons?|tsps?|tsp\\.?|teaspoons?|grams?|g|kg|mg|ml|milliliters?|l|liters?|oz\\.?|ounces?|lbs?|lb\\.?|pounds?|cloves?|inch(?:es)?|pinch(?:es)?|handfuls?|handful|slices?|slice|pieces?|piece|bunch(?:es)?|stalks?|stalk|sprigs?|sprig|cans?|can|packets?|packet|jars?|jar|tins?|tin|boxes?|box|pods?|pod|stems?|stem|discs?|disc|chunks?|chunk|size|head|heads|leaves|leaf|roots?|root|drizzles?|splash(?:es)?|dash(?:es)?|each|bowls?|plates?|portions?|scoops?'
const LEADING_QTY = /^(?:[\d½¼¾⅓⅔]+(?:\/[\d½¼¾⅓⅔]+)?(?:\.\d+)?(?:\s+(?:[\d½¼¾⅓⅔]+(?:\/[\d½¼¾⅓⅔]+)?(?:\.\d+)?|to|-|\/|x|×))*\s*)+/i
const LEADING_MULT = /^[x×]\s*/i
const LEADING_UNIT = new RegExp(`^(?:${UNIT_ALT})\\.?\\s+`, 'i')
const LEADING_OF = /^(?:of|from|a|an|the|disc of)\s+/i
const TRAILING_QTY_UNIT = new RegExp(`\\s+(?:[\\d½¼¾⅓⅔]+(?:[\\-/.]\\s*[\\d½¼¾⅓⅔]+)*(?:\\s*(?:${UNIT_ALT})\\.?)?|(?:${UNIT_ALT})\\.?)\\s*$`, 'i')
const ALL_CAPS_HEADER = /^[A-Z][A-Z\s\-]+$/

const INSTRUCTION_START = /^(?:(?:lightly|gently|quickly|slowly|carefully|thoroughly|briefly)\s+)?(add|cook|heat|mix|boil|simmer|saut[eé]?|roast|bake|garnish|drain|rinse|soak|transfer|grind|blend|blended|crackle|temper|roll|cover|crush|whisk|fold|marinate|sprinkle|dry\s+roast|pressure\s+cook|preheat|pre-heat|combine|toast|plate|serve|repeat|once|then|now|next|let|top|place|layer|drizzle|pour|squeeze|arrange|wrap|divide|spread|dust|knead|rest|chill|freeze|refrigerate|reserve|discard|remove|allow|continue|dip|coat|brush|flip|press|shape|stuff|reduce|cool|halve|about|amount|batch|full\s+of|half\s+a\s+of|in\s+a|in\s+the|for\s+(?:the|garnish|serving|topping|storage|later|tempering|dusting|longer))\b/i
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

const KEEP_PLURAL = new Set(['oats', 'peas', 'greens', 'sprouts', 'seeds', 'nuts', 'beans', 'lentils', 'noodles', 'tortillas', 'chickpeas', 'breadcrumbs', 'walnuts', 'almonds', 'grapes', 'carrots', 'cranberries', 'apricots'])

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

  // Replace any non-standard bullet symbols everywhere in string
  s = s.replace(/[◆\uFFFD•▪★▲■◦]+/g, ' ').trim()
  // Clean unmatched outer parentheses/brackets/quotes
  s = s.replace(/^[()\[\]{}"'\s]+|[()\[\]{}"'\s]+$/g, '').trim()

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
    s = s.replace(/^(?:juice\s+(?:from|of)\s+|and\s+|with\s+|or\s+|in\s+|for\s+|about\s+|amount\s+of\s+|batch\s+of\s+|full\s+of\s+|half\s+a\s+of\s+|blend\s+|blended\s+|try\s+|add\s+a\s+|add\s+)+/i, '').trim()
    s = s.replace(/\s+(?:if\s+its?\s+suits?\s+you|for\s+taste|to\s+taste|try|for)$/i, '').trim()
    s = s.replace(LEADING_QTY, '').replace(LEADING_MULT, '').replace(LEADING_UNIT, '').replace(LEADING_OF, '').trim()
    s = s.replace(/^[^\w\d½¼¾⅓⅔]+/i, '').trim()
    s = s.replace(/^[()\[\]{}"'\s]+|[()\[\]{}"'\s]+$/g, '').trim()
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
  const parts = name.split(/\s*&\s*|\s+and\s+|\s+or\s+|\s*\/\s*/i).map((p) => p.trim()).filter(Boolean)
  return parts.length > 0 ? parts : [name]
}

function titleCase(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

// Matching happens on whole words, not substrings: plain `includes()` put
// "peanut" in the pea bucket and "cornflour" in with the sweetcorn.
function singularizeForMatch(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !/(?:us|ss|is)$/.test(word)) return word.slice(0, -1)
  return word
}

// Deliberately not singularizeWord(): that one keeps "oats"/"peas" plural on
// purpose for display, which left them unable to match the keywords "oat"
// and "pea".
function toWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(singularizeForMatch)
}

// True when the keyword's words appear in order, as whole words.
function hasPhrase(words: string[], keyword: string): boolean {
  const kw = toWords(keyword)
  if (kw.length === 0) return false
  for (let i = 0; i + kw.length <= words.length; i++) {
    let hit = true
    for (let j = 0; j < kw.length; j++) {
      if (words[i + j] !== kw[j]) { hit = false; break }
    }
    if (hit) return true
  }
  return false
}

// Longest keyword first, so "pumpkin seed" wins over "pumpkin".
const SORTED_CATEGORY_KEYWORDS = CATEGORY_KEYWORDS.map((cat) => ({
  head: cat.head,
  keywords: [...cat.keywords].sort((a, b) => b.length - a.length),
}))

// A spice or pantry form of a food is shopped for with the spices, not with
// the fresh food it is made from: chilli powder is not a vegetable and
// tomato ketchup is not a tomato. Checked before the keyword table, which
// would otherwise file both by their first word.
const PANTRY_FORM_WORDS = new Set([
  'powder', 'masala', 'seasoning', 'spice', 'chutney', 'pickle', 'ketchup', 'sauce', 'paste',
  'puree', 'vinegar', 'syrup', 'extract', 'essence', 'stock', 'broth', 'oil', 'ghee', 'jam',
  'marmalade', 'tea', 'coffee', 'flour', 'atta', 'starch',
])

// ...except where the pantry form is still bought as the food itself: a nut
// butter sits with the nuts, a flour with its grain.
const PANTRY_FORM_EXCEPTIONS = [
  { head: 'Nuts & seeds', first: ['almond', 'peanut', 'groundnut', 'cashew', 'walnut', 'hazelnut', 'pistachio', 'sesame', 'sunflower', 'pumpkin'], second: ['butter'] },
  { head: 'Grains & millets', first: ['wheat', 'ragi', 'jowar', 'bajra', 'millet', 'rice', 'oat', 'barley', 'buckwheat', 'amaranth', 'corn', 'maize', 'quinoa'], second: ['flour', 'atta', 'starch'] },
  { head: 'Lentils & protein', first: ['gram', 'chickpea', 'lentil', 'soy', 'protein', 'whey', 'pea'], second: ['flour', 'powder'] },
]

// Shared by the regex pass below and by the AI tidy-up route, which runs
// every name the model returns back through this instead of trusting the
// category the model picked. A model will occasionally file chilli powder
// with the vegetables, or a vegetable under Fruit, and a shopping list
// sorted into the wrong aisles is worse than one not sorted at all.
export function categorizeItem(name: string): string {
  const words = toWords(name)
  if (words.length === 0) return 'Other'

  for (const ex of PANTRY_FORM_EXCEPTIONS) {
    for (let i = 0; i + 1 < words.length; i++) {
      if (ex.first.includes(words[i]) && ex.second.includes(words[i + 1])) return ex.head
    }
  }
  if (words.some((w) => PANTRY_FORM_WORDS.has(w))) return 'Herbs, spices & pantry'
  // "besan" is gram flour under another name, with no second word to match.
  if (words.includes('besan')) return 'Lentils & protein'

  let best = { head: 'Other', length: 0 }
  for (const cat of SORTED_CATEGORY_KEYWORDS) {
    for (const kw of cat.keywords) {
      // Across categories, not just within one: "pumpkin seed" has to beat
      // "pumpkin", even though Other vegetables is listed first.
      if (kw.length > best.length && hasPhrase(words, kw)) best = { head: cat.head, length: kw.length }
    }
  }
  return best.head
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
      const rawExtracted = extractItemName(line)
      if (!rawExtracted) continue
      for (const piece of splitAndJoinedItems(rawExtracted)) {
        const cleaned = extractItemName(piece) || piece
        if (!cleaned || cleaned.length < 2) continue
        const name = CANONICAL_ALIASES[cleaned.toLowerCase()] || cleaned
        const display = titleCase(name)
        const key = name.toLowerCase()
        const head = categorizeItem(name)
        if (!buckets.has(head)) buckets.set(head, new Map())
        buckets.get(head)!.set(key, display)
      }
    }
  }
  return GROCERY_CATEGORY_ORDER
    .filter((head) => buckets.has(head))
    .map((head) => ({ head, items: [...buckets.get(head)!.values()].sort((a, b) => a.localeCompare(b)) }))
}
