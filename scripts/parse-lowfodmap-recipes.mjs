// Read-only PDF extraction. Review the JSON and source warnings before import.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { getDocumentProxy } from 'unpdf'

const directory = process.argv[2] || 'D:/clp_base/clp_merge/recipes_shared by_Nithya/Low_fod_map'
const out = '.lowfodmap-import'
mkdirSync(out, { recursive: true })

function lines(items) {
  const rows = []
  for (const item of items) {
    let row = rows.find((r) => Math.abs(r.y - item.y) < 1.5)
    if (!row) { row = { y: item.y, items: [] }; rows.push(row) }
    row.items.push(item)
  }
  return rows.sort((a, b) => b.y - a.y).map((row) => {
    let previous
    return row.items.sort((a, b) => a.x - b.x).map((item) => {
      const space = previous && item.x - (previous.x + previous.w) > item.h * 0.12 ? ' ' : ''
      previous = item
      return space + item.s
    }).join('').replace(/\s+/g, ' ').trim().replace(/^(\d+)\s*\.\s*/, '$1. ')
  }).filter(Boolean)
}

const books = [
  { file: 'Low FODMAP Recipes.pdf', source: 'Low FODMAP Recipes', layout: 'main', entries: [
    [3, 'Tofu Scramble'], [4, 'Moong Daal Dosa'], [5, 'Kale & Kiwi Smoothie'],
    [6, 'Quinoa Porridge'], [7, 'Malibu Smoothie'], [8, 'Vegetable Daal'],
    [9, 'Soybean Curry with Brown Rice'], [10, 'Quinoa Khichadi'], [11, 'Broccoli Chickpea Curry'],
    [12, 'Jowar Roti Wraps'], [13, 'Red Lentil Curry'], [14, 'Roasted Pumpkin Soup'], [15, 'Tofu Stir Fry'],
  ] },
  { file: 'Low Fodmap - Snacks.pdf', source: 'Low FODMAP Snacks', layout: 'snacks', entries: [
    [2, 'Sweet Potato Hash'], [3, 'Matcha Energy Balls'], [4, 'Kale Crisps'], [5, 'Hummus Dip'], [6, 'Mint Gazpacho'],
  ] },
  { file: 'Pradeepa- Low Fodmap Recipes.pdf', source: 'Low FODMAP Recipe Collection', layout: 'cards', entries: [
    [3, 'Zucchini & Carrot Paratha'], [4, 'Little Millet Uttapam'], [5, 'Buckwheat Savoury Pancake'],
    [6, 'Beetroot Neer Dosa'], [7, 'Barnyard Rasam Rice', 8], [9, 'Millets Pulao'],
    [10, 'Buttermilk Curry'], [11, 'Ridge Gourd Kootu'], [12, 'Chow Chow Chutney'],
    [13, 'Spiced Kohlrabi Soup'], [14, 'One Pot Sesame Carrot Soup'],
  ] },
]

const warnings = {
  'Zucchini & Carrot Paratha': ['Source lists "12 idlis" as the yield for paratha. Yield omitted pending review.'],
  'Little Millet Uttapam': ['Source says "1/2 yellow mung dal" without a unit.', 'Source calls methi seeds "fenugreek leaves". Confirm the intended ingredient.'],
  'Beetroot Neer Dosa': ['Directions mention green chilies, but the ingredient list gives no quantity.'],
  'Soybean Curry with Brown Rice': ['Directions mention mustard seeds and green chilly paste without ingredient quantities.'],
  'Ridge Gourd Kootu': ['Title/ingredients say ridge gourd; directions say snake gourd. Confirm the intended vegetable.'],
  'Chow Chow Chutney': ['Directions mention oil, mustard and dry red chili for tempering without ingredient quantities.'],
  'Quinoa Porridge': ['Source duration is 5 minutes, but directions require 15-20 minutes of simmering.'],
  'Roasted Pumpkin Soup': ['Source duration is 30 minutes, but directions require 45-60 minutes of roasting plus simmering.'],
  'Jowar Roti Wraps': ['Directions refer to jowar dough without a dough-making step and say to repeat step 6 within step 6.'],
  'Tofu Stir Fry': ['Directions mention an additional chopped cruciferous vegetable without a separate ingredient quantity.'],
}

async function pageItems(doc, number) {
  const page = await doc.getPage(number)
  const { items } = await page.getTextContent()
  return items.filter((i) => i.str.trim()).map((i) => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], h: i.height, w: i.width }))
}

const result = []
for (const book of books) {
  const doc = await getDocumentProxy(new Uint8Array(readFileSync(`${directory}/${book.file}`)))
  for (const [page, name, continuation] of book.entries) {
    const items = await pageItems(doc, page)
    const ingredientHeading = items.find((i) => /^ingredients\s*:?$/i.test(i.s))
    const directionItems = continuation ? await pageItems(doc, continuation) : items
    const directionHeading = directionItems.find((i) => /^(directions|instructions)\s*:?$/i.test(i.s))
    if (!ingredientHeading || !directionHeading) throw Error(`Missing headings: ${book.source} ${page}`)
    const isBody = (i) => !/roshnisanghvi\.com|^©|^(ingredients|directions|instructions)\s*:?$/i.test(i.s)
    const noteHeading = items.find((i) => /^notes$/i.test(i.s))
    let ingredients, steps, sourceNotes = []
    if (book.layout === 'main') {
      ingredients = lines(items.filter((i) => isBody(i) && i.y < ingredientHeading.y - 2 && i.y > directionHeading.y + 3))
      steps = lines(items.filter((i) => isBody(i) && i.y < directionHeading.y - 2 && (!noteHeading || i.y > noteHeading.y + 2)))
      if (noteHeading) sourceNotes = lines(items.filter((i) => isBody(i) && i.y < noteHeading.y - 2))
    } else if (book.layout === 'snacks') {
      const meta = items.find((i) => /prep\s*time/i.test(i.s))
      if (!meta) throw Error(`Missing timing strip: ${name}`)
      const ingredientItems = items.filter((i) => isBody(i) && i.y < ingredientHeading.y - 2 && i.y > meta.y + 8)
      // Only Sweet Potato Hash has two real ingredient columns. Other
      // cards split individual words into text objects at different x's.
      ingredients = page === 2
        ? [...lines(ingredientItems.filter((i) => i.x < 500)), ...lines(ingredientItems.filter((i) => i.x >= 500))]
        : lines(ingredientItems)
      steps = lines(items.filter((i) => isBody(i) && i.y < directionHeading.y - 2))
    } else {
      const middle = (ingredientHeading.x + directionHeading.x) / 2
      if (continuation) {
        const ing = items.filter((i) => isBody(i) && i.y < ingredientHeading.y - 2)
        const dirs = directionItems.filter((i) => isBody(i) && i.y < directionHeading.y - 2)
        ingredients = [...lines(ing.filter((i) => i.x < 150)), ...lines(ing.filter((i) => i.x >= 150))]
        steps = [...lines(dirs.filter((i) => i.x < 150)), ...lines(dirs.filter((i) => i.x >= 150))]
      } else {
        ingredients = lines(items.filter((i) => isBody(i) && i.x < middle && i.y < ingredientHeading.y - 2))
        steps = lines(directionItems.filter((i) => isBody(i) && i.x > middle && i.y < directionHeading.y - 2))
      }
    }
    // Join only obvious wrapped ingredient lines; retain real quantities,
    // named ingredients and component headings as separate grocery items.
    ingredients = ingredients.filter((s) => !/^ingredients$/i.test(s))
    ingredients = ingredients.reduce((list, line) => {
      if (list.length && (/^[a-z(]/.test(line) || /^(Seeds|Powder|Indian twist)\b/.test(line))) list[list.length - 1] += ` ${line}`
      else list.push(line)
      return list
    }, [])
    ingredients = ingredients.map((s) => /^(For (?:masala paste|tampering)|Part [12])$/i.test(s) ? `${s}:` : s)
    if (book.layout === 'main') steps = steps.reduce((list, line) => {
      if (list.length && !/^\d+\./.test(line)) list[list.length - 1] += ` ${line}`
      else list.push(line)
      return list
    }, [])
    const text = lines(items).join(' ')
    const servings = text.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(servings?|wraps|idlis)\b/i)
    const snackServings = text.match(/serve\s*size\s*:?\s*(\d+)/i)
    const prep = text.match(/prep\s*time\s*:?\s*(\d+\s*minutes)/i)
    const cook = text.match(/cook\s*time\s*:?\s*(\d+\s*minutes)/i)
    const duration = text.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*minutes/i)
    const flags = warnings[name] || []
    const notes = [`Source: ${book.source}, page${continuation ? 's' : ''} ${page}${continuation ? `-${continuation}` : ''}.`, ...sourceNotes]
    if (flags.length) notes.push(...flags.map((s) => `SOURCE REVIEW NEEDED: ${s}`))
    if (book.layout !== 'snacks' && duration) notes.push(`Source gives a single duration of ${duration[0]}; prep/cook split is not specified.`)
    if (ingredients.length < 2 || steps.length < 1) throw Error(`Incomplete recipe: ${name}`)
    result.push({ name, meal_type: book.layout === 'snacks' ? 'snack' : 'lunch', ingredients: ingredients.join('\n'), steps: steps.join('\n'), servings: name === 'Zucchini & Carrot Paratha' ? null : servings?.[0] ?? (snackServings ? `${snackServings[1]} servings` : null), prep_time: prep?.[1] ?? null, cook_time: cook?.[1] ?? null, notes, tags: ['low-fodmap', ...(flags.length ? ['source-review-needed'] : [])], tools: [], benefits: [], source: book.source, page, flags })
  }
}
if (result.length !== 29) throw Error(`Expected 29 recipes, got ${result.length}`)
writeFileSync(`${out}/parsed.json`, JSON.stringify(result, null, 2))
console.log(`Extracted ${result.length} recipes. Trail Mix excluded. ${result.filter((r) => r.flags.length).length} entries flagged for source review.`)
