// Turns the nine shared cookbooks into one reviewed import file.
// Parse only: writes .cookbooks_parsed.json and prints a report. Nothing
// here touches the database (see docs/SOP.md, "Bulk data imports").
import { readFileSync, writeFileSync } from 'node:fs'
import { getDocumentProxy, extractText } from 'unpdf'
import { parseCardBook } from './parse-card.mjs'
import { parseBook } from './parse-book.mjs'

const DIR = 'D:/clp_base/clp_merge/recipes_shared by_Nithya/'

// A book's category is what a coach will filter by. Every recipe stays
// visible by default; the category only narrows the view.
const BOOKS = [
  { file: '_SOUTH INDIAN - Meal Plan.pdf', category: 'south-indian', parser: 'card' },
  { file: 'North Indian - Meal Plan.pdf', category: 'north-indian', parser: 'card' },
  { file: 'Smoothie Recipes.pdf', category: 'smoothies', parser: 'card', meal: 'breakfast' },
  { file: 'Diksha Jain- Low FODMAP Soups.pdf', category: 'low-fodmap', parser: 'card', meal: 'dinner' },
  { file: 'Cholesterol Management - Cookbook.pdf', category: 'cholesterol', parser: 'card' },
  { file: 'Diabetes Management - Cook Book.pdf', category: 'diabetes', parser: 'card' },
  { file: 'Gut healing- Cook Book.pdf', category: 'gut-healing', parser: 'card' },
  { file: 'PCOS Holistic Healing Protocol - Recipes (1).pdf', category: 'pcos', parser: 'card' },
  { file: 'Unna Vijay- InstaPot Recipes.pdf', category: 'instant-pot', parser: 'book', meal: 'dinner' },
]

const SECTION_WORD = /^(breakfast|lunch|dinner|snacks?|desserts?)$/i
const normaliseMeal = (word) => {
  const w = word.toLowerCase().replace(/s$/, '')
  return ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'].includes(w) ? w : null
}

// Where a book prints its own BREAKFAST / LUNCH / DINNER / SNACK divider
// pages, that is the meal type — taken from the source, not guessed.
async function sectionDividers(buffer) {
  const doc = await getDocumentProxy(new Uint8Array(buffer))
  const dividers = []
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const content = await doc.getPage(pn).then((p) => p.getTextContent())
    const items = content.items.filter((i) => i.str.trim() && !/roshnisanghvi/i.test(i.str))
    if (items.length === 0 || items.length > 3) continue
    const biggest = items.slice().sort((a, b) => b.height - a.height)[0]
    const meal = SECTION_WORD.test(biggest.str.trim()) ? normaliseMeal(biggest.str.trim()) : null
    if (meal) dividers.push({ page: pn, meal })
  }
  return dividers
}

// Cholesterol lists its recipes under Breakfast / Lunch / Dinner / Snacks /
// Soups headings on its contents pages; that mapping is also from the source.
async function contentsSections(buffer) {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: false })
  const map = new Map()
  let current = null
  for (const page of text.slice(0, 12)) {
    for (const raw of page.split('\n')) {
      const line = raw.replace(/R\s*O\s*S\s*H\s*N\s*I.*$/i, '').trim()
      if (!line) continue
      if (SECTION_WORD.test(line) || /^soups?$/i.test(line)) {
        current = /^soups?$/i.test(line) ? 'dinner' : normaliseMeal(line)
        continue
      }
      if (/^(north|south) indian$/i.test(line)) continue
      if (current && line.length > 3 && line.length < 60) map.set(key(line), current)
    }
  }
  return map
}

// Last resort for the two books that state no sections: the dish itself.
// Stated plainly in the report so a coach can correct any of them.
function mealFromName(name) {
  const n = name.toLowerCase()
  if (/\b(smoothie|juice|latte|tea|milk)\b/.test(n)) return 'breakfast'
  if (/\b(dosa|idli|upma|poha|paratha|chilla|roti|puttu|pongal|oats|porridge|pancake|thepla|uttapam|adai|pesarattu)\b/.test(n)) return 'breakfast'
  if (/\b(soup|rasam)\b/.test(n)) return 'dinner'
  if (/\b(chutney|laddu|ladoo|barfi|halwa|snack|vadi|dhokla|tikki|cutlet|bhel|chaat|dip|hummus)\b/.test(n)) return 'snack'
  if (/\b(sambar|curry|dal|sabzi|palya|poriyal|kootu|kurma|masala|rice|pulao|pulav|biryani|khichdi|bisibelebath|bowl|salad|raita)\b/.test(n)) return 'lunch'
  return 'lunch'
}

const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const all = []
const report = []

for (const book of BOOKS) {
  const buffer = readFileSync(DIR + book.file)
  const parsed = book.parser === 'card' ? await parseCardBook(buffer) : await parseBook(buffer)

  let dividers = []
  let contents = new Map()
  if (!book.meal) {
    dividers = await sectionDividers(buffer)
    if (dividers.length === 0) contents = await contentsSections(buffer)
  }

  const sources = { divider: 0, contents: 0, name: 0, fixed: 0 }
  for (const recipe of parsed) {
    let meal = book.meal
    if (meal) sources.fixed++
    if (!meal && dividers.length) {
      const applicable = dividers.filter((d) => d.page < recipe.page)
      if (applicable.length) {
        meal = applicable[applicable.length - 1].meal
        sources.divider++
      }
    }
    if (!meal && contents.size) {
      meal = contents.get(key(recipe.name)) || null
      if (meal) sources.contents++
    }
    if (!meal) {
      meal = mealFromName(recipe.name)
      sources.name++
    }
    all.push({ ...recipe, meal_type: meal, category: book.category, source: book.file })
  }
  report.push({ book: book.file, category: book.category, count: parsed.length, sources })
}

// One recipe, many categories: the Diabetes and Gut Healing books share most
// of their pages, and a dish can appear in more than one collection. Matching
// on the name plus the ingredient list keeps two different dishes with the
// same name apart.
const merged = new Map()
for (const r of all) {
  const signature = `${key(r.name)}::${key(r.ingredients).slice(0, 120)}`
  const existing = merged.get(signature)
  if (existing) {
    if (!existing.categories.includes(r.category)) existing.categories.push(r.category)
    existing.sources.push(`${r.source} p${r.page}`)
    continue
  }
  merged.set(signature, {
    name: r.name,
    meal_type: r.meal_type,
    ingredients: r.ingredients,
    steps: r.steps,
    servings: r.servings,
    prep_time: r.prep_time,
    cook_time: r.cook_time,
    categories: [r.category],
    sources: [`${r.source} p${r.page}`],
    page: r.page,
    sourceFile: r.source,
  })
}

const recipes = [...merged.values()]
writeFileSync('.cookbooks_parsed.json', JSON.stringify(recipes, null, 2))

console.log('Per book:')
for (const r of report) {
  console.log(
    `  ${r.book.slice(0, 34).padEnd(35)} ${String(r.count).padStart(3)}  ${r.category.padEnd(13)} meal from: ` +
      Object.entries(r.sources).filter(([, n]) => n).map(([k2, n]) => `${k2} ${n}`).join(', ')
  )
}
console.log(`\nparsed ${all.length} recipe pages -> ${recipes.length} distinct recipes (${all.length - recipes.length} merged as duplicates)`)
const byMeal = recipes.reduce((a, r) => ({ ...a, [r.meal_type]: (a[r.meal_type] || 0) + 1 }), {})
console.log('by meal type:', JSON.stringify(byMeal))
const multi = recipes.filter((r) => r.categories.length > 1)
console.log(`in more than one category: ${multi.length}`)
multi.slice(0, 5).forEach((r) => console.log(`   ${r.name} -> ${r.categories.join(', ')}`))
