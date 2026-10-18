// Extract the five supplied collections without sending PDFs to an AI.
// Page coordinates separate columns; cover identities never enter records.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { getDocumentProxy } from 'unpdf'

const base = process.argv[2] || 'D:/clp_base/clp_merge/recipes_shared by_Nithya'
const directory = '.snack-dessert-import'
mkdirSync(directory, { recursive: true })
const books = [
  { folder: 'snacks', file: 'Ankita S Crunchy Snacks & Dessert.pdf', source: 'Crunchy Snacks & Dessert Collection', entries: [
    [1, 'Air Fryer Carrot / Beetroot Chips', 'snacks'], [2, '3 Seed Cracker', 'snacks'],
    [3, 'Bajra Cracker', 'snacks'], [4, 'Roasted Chickpeas', 'snacks'],
    [5, 'Roasted Spicy Edamame', 'snacks'], [6, 'Apple Chips', 'snacks'],
    [7, 'Kale Chips', 'snacks'], [8, 'Date & Quinoa Pops', 'desserts'],
  ] },
  { folder: 'snacks', file: 'Snack Recipes.pdf', source: 'Snack Recipes Collection', entries: [
    [3, 'Savoury Sattu Balls', 'snacks'], [4, 'Cacao Energy Balls with Oats & Hemp', 'desserts'],
    [5, 'Oat Bites', 'desserts'], [6, 'Sweet Potato Chaat & Nutritional Yeast', 'snacks'],
    [7, 'Soybean-Amaranth Cutlets', 'snacks'], [8, 'Chia Pudding', 'desserts'],
    [9, 'Sattu Shake', 'snacks'], [10, 'Chocolate Protein Shake', 'snacks'],
    [11, 'Sattu Protein Bars', 'snacks'], [12, 'Dates Snickers', 'desserts'],
  ] },
  { folder: 'desserts', file: 'Anita Williams - Dessert Recipes.pdf', source: 'Dessert Recipes Collection A', entries: [
    [3, 'Vegan Chocolate Cake', 'desserts'], [4, 'Date & Quinoa Pops', 'desserts'],
    [5, 'Homemade Applesauce', 'desserts'], [6, 'Oil-Free Hummus', 'snacks'],
    [7, 'Jowar Khakhra', 'snacks'], [8, 'Oil-Free Popcorn', 'snacks'],
    [9, 'Roasted Chickpeas', 'snacks'], [10, 'Baked Broccoli', 'snacks'],
  ] },
  { folder: 'desserts', file: 'Salwa Arshad- Dessert Recipes.pdf', source: 'Dessert Recipes Collection B', entries: [
    [3, 'Mini Peanut Butter Cups', 'desserts'], [4, 'Avocado Cacao Mousse', 'desserts'],
    [5, 'Cashew Blueberry Oatmeal Cookies', 'desserts'], [6, 'Apple Cinnamon Cookies', 'desserts'],
    [7, 'Cacao Energy Balls with Walnuts & Dates', 'desserts'], [8, 'Fudgy Brownie', 'desserts'],
    [9, 'Vegan Chocolate Cake', 'desserts'], [10, 'Quinoa Carrot Cake', 'desserts'],
    [11, 'Banana Sweet Potato Bread', 'desserts'],
  ] },
  { folder: 'desserts', file: '_Desserts for Poonam.pdf', source: 'Dessert Recipes Collection C', large: true, entries: [
    [2, 'Cacao Walnut Pie', 'desserts', 3], [4, 'Vegan Ice Cream', 'desserts'],
    [5, 'Snicker Bites', 'desserts'], [6, 'Avocado Cacao Mousse', 'desserts'],
    [7, 'Fudgy Brownie', 'desserts'], [8, 'Raw Hazelnut Spread', 'desserts', 9],
  ] },
]
const cleanKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const footer = (s) => /roshnisanghvi|^©/.test(cleanKey(s))
function lines(items) {
  const rows = []
  for (const item of items) {
    let row = rows.find((r) => Math.abs(r.y - item.y) < 1.4)
    if (!row) { row = { y: item.y, items: [] }; rows.push(row) }
    row.items.push(item)
  }
  return rows.sort((a, b) => b.y - a.y).map((row) => {
    let previous
    return row.items.sort((a, b) => a.x - b.x).map((item) => {
      const space = previous && item.x - previous.x - previous.w > item.h * .12 ? ' ' : ''
      previous = item
      return space + item.s
    }).join('').replace(/\s+/g, ' ').trim()
  }).filter(Boolean)
}
function unwrap(rows, ingredients = false) {
  return rows.reduce((result, row) => {
    const previous = result[result.length - 1] || ''
    const newIngredient = /^(?:pinch|salt|water|juice|handful|optional|spices|seasonings|flavoring|frosting|cake|chocolate dip|shake powder|for one shake)\b/i.test(row)
    const openBracket = (previous.match(/\(/g) || []).length > (previous.match(/\)/g) || []).length
    const continuation = (!newIngredient && (/^[a-z(]/.test(row) || openBracket || /(?:\bor|\band|Vegan|Desiccated|Garlic|Cumin|Almond|Cashew|finely|Chili)$/.test(previous))) || (row === 'salt' && /pinch$/.test(previous))
    if (result.length && (ingredients ? continuation : /^[a-z]/.test(row))) result[result.length - 1] += ` ${row}`
    else result.push(row)
    return result
  }, []).map((row) => ingredients && /^(?:Spices|Seasonings|Flavoring|Frosting|Cake|Chocolate Dip)$/.test(row) ? `${row}:` : row).join('\n')
}
async function itemsFor(doc, page) {
  const { items } = await (await doc.getPage(page)).getTextContent()
  return items.filter((i) => i.str.trim() && !footer(i.str)).map((i) => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], h: i.height, w: i.width }))
}
const flags = {
  'Bajra Cracker': ['Directions add 3/4 cup water, which is not listed in the ingredient list.'],
  'Roasted Chickpeas': ['The two source collections give different total times, 15 and 25 minutes, for the same recipe.'],
  'Roasted Spicy Edamame': ['Header says 10-15 minutes; directions require 20-25 minutes of roasting.'],
  'Cacao Energy Balls with Oats & Hemp': ['Header says 15 minutes; directions specify 15-18 minutes of blending.'],
  'Chia Pudding': ['The 10-minute header does not include the stated 6-8 hours of chilling.'],
  'Sattu Shake': ['Directions add jaggery without a quantity in the ingredient list.'],
  'Sattu Protein Bars': ['The 15-minute header excludes the stated 2-3 hours of chilling. Per-bar nutrition figures are copied from the source and have not been recalculated.'],
  'Fudgy Brownie': ['Allow the source-specified chilling time in addition to preparation.'],
  'Cacao Walnut Pie': ['Source says 5 servings but directions cut the pie into 8 pieces. Confirm yield.'],
  'Mini Peanut Butter Cups': ['Source says to let chocolate "cook off"; likely a wording error. Confirm intended instruction.'],
}
const output = [], audit = []
for (const book of books) {
  const doc = await getDocumentProxy(new Uint8Array(readFileSync(`${base}/${book.folder}/${book.file}`)))
  for (const [page, name, category, continuation] of book.entries) {
    const items = await itemsFor(doc, page)
    const ingredientsHeads = items.filter((i) => /^ingredients\s*:?$/i.test(i.s))
    const directionHeads = items.filter((i) => /^(directions|instructions)\s*:?$/i.test(i.s))
    const ing = ingredientsHeads[0]
    let ingredientItems = [], directionItems = [], extraNotes = []
    if (name === 'Sattu Shake') {
      const middle = 120
      for (const [side, head, direction] of [[0, ingredientsHeads[0], directionHeads[0]], [1, ingredientsHeads[1], directionHeads[1]]]) {
        const inColumn = (i) => side ? i.x >= middle : i.x < middle
        ingredientItems.push(...items.filter((i) => inColumn(i) && i.y < head.y - 1 && i.y > direction.y + 1))
        directionItems.push(...items.filter((i) => inColumn(i) && i.y < direction.y - 1))
      }
      extraNotes.push('Make the shake powder first, then use 3 tbsp powder per cup of plant-based milk. Both component ingredient lists are included.')
      extraNotes.push('Source component headings: Sattu Shake Powder; How to Make the Shake.')
      extraNotes.push(...lines(items.filter((i) => /multiple servings/i.test(i.s))))
    } else if (book.large) {
      const nextItems = continuation ? await itemsFor(doc, continuation) : items
      const direction = nextItems.find((i) => /^instructions\s*:?$/i.test(i.s))
      if (!ing || !direction) throw Error(`Missing heading: ${name}`)
      ingredientItems = items.filter((i) => i.y < ing.y - 2 && i.x < 330 && (continuation || i.y > direction.y + 2))
      directionItems = nextItems.filter((i) => i.y < direction.y - 2)
      extraNotes.push(...lines(items.filter((i) => i.x >= 330 && i.h < 25)))
    } else {
      const direction = directionHeads[0]
      if (!ing || !direction) throw Error(`Missing heading: ${name}`)
      const middle = name === 'Chocolate Protein Shake' ? 120 : (ing.x + direction.x) / 2
      ingredientItems = items.filter((i) => i.x < middle && i.y < ing.y - 2)
      directionItems = items.filter((i) => i.x >= middle && i.y < direction.y - 2)
      const top = items.filter((i) => i.y > Math.max(ing.y, direction.y) + 2 && i.h < ing.h * .8)
      extraNotes.push(...lines(top))
      const yieldLabel = top.find((i) => /^yields\s*:/i.test(i.s))
      if (yieldLabel) extraNotes.push(...lines(top.filter((i) => Math.abs(i.x - yieldLabel.x) < 2)))
      const crackerYield = top.find((i) => /^cracker$/i.test(i.s))
      if (crackerYield) extraNotes.push(...lines(top.filter((i) => Math.abs(i.x - crackerYield.x) < 2)))
    }
    const removeHeading = (i) => !/^(ingredients|directions|instructions)\s*:?$/i.test(i.s)
    const ingredientLines = name === 'Sattu Shake'
      ? ['Shake powder:', ...lines(ingredientItems.filter((i) => i.x < 120)), 'For one shake:', ...lines(ingredientItems.filter((i) => i.x >= 120))]
      : lines(ingredientItems.filter(removeHeading))
    const stepLines = name === 'Sattu Shake'
      ? ['Shake powder:', ...lines(directionItems.filter((i) => i.x < 120)), 'For one shake:', ...lines(directionItems.filter((i) => i.x >= 120))]
      : lines(directionItems.filter(removeHeading))
    const notes = [`Source: ${book.source}, page${continuation ? 's' : ''} ${page}${continuation ? `-${continuation}` : ''}.`, ...extraNotes]
    const review = flags[name] || []
    notes.push(...review.map((text) => `SOURCE REVIEW NEEDED: ${text}`))
    const metadata = extraNotes.join(' ')
    const servings = metadata.match(/(?:servings?\s*:\s*\d+(?:\s*[-–]\s*\d+)?(?:\s*khakhras)?|\d+(?:\s*[-–]\s*\d+)?\s*(?:servings?|bars|cracker)|yields:\s*\d+\s*round cakes|serves\s*-\s*\d+\s*slices)/i)?.[0] ?? null
    const row = { name, ingredients: unwrap(ingredientLines, true), steps: unwrap(stepLines), meal_type: category === 'snacks' ? 'snack' : 'dessert', servings, prep_time: null, cook_time: null, notes, tags: [category, ...(review.length ? ['source-review-needed'] : [])], tools: [], benefits: [], source: book.source, page, review }
    if (!row.ingredients || !row.steps) throw Error(`Incomplete recipe: ${name}`)
    const joined = cleanKey(JSON.stringify(row))
    const body = [...ingredientItems, ...directionItems].filter(removeHeading)
    const missing = body.filter((i) => cleanKey(i.s).length > 2 && !joined.includes(cleanKey(i.s)))
    audit.push({ source: book.source, page, name, unaccountedBodyItems: missing.map((i) => i.s) })
    output.push(row)
  }
}
if (output.length !== 41) throw Error(`Expected 41 source recipes; got ${output.length}`)
if (audit.some((r) => r.unaccountedBodyItems.length)) throw Error('Extraction lost source text')
writeFileSync(`${directory}/parsed.json`, JSON.stringify(output, null, 2))
writeFileSync(`${directory}/extraction-audit.json`, JSON.stringify(audit, null, 2))
console.log(`Extracted ${output.length} source entries from five PDFs. No source-body text lost. Cross-book duplicates still require merging.`)
