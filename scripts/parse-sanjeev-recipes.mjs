// One-off: turn Final_Sanjeev_Sharma_Recipes.pdf into recipe_bank rows.
// Reads the PDF's own text layer (same unpdf path the app uses), parses the
// fixed page layout, and writes .recipes_parsed.json for review before any
// insert. Deliberately not an importer: nothing here touches the database.
import { readFileSync, writeFileSync } from 'node:fs'
import { extractText } from 'unpdf'

const PDF = 'D:/clp_base/clp_merge/Final_Sanjeev_Sharma_Recipes.pdf'

// The PDF letter-spaces its headers ("I N G R E D I E N T S"), so match on
// the de-spaced form rather than hard-coding each spelling.
const despace = (s) => s.replace(/\s+/g, ' ').trim()
const isHeader = (line, word) =>
  despace(line).replace(/\s/g, '').toUpperCase().startsWith(word)

const MEAL_OF_PAGE = (header) => {
  const h = despace(header).replace(/\s/g, '').toUpperCase()
  if (h.startsWith('BREAKFAST')) return 'breakfast'
  if (h.startsWith('LUNCH')) return 'lunch'
  if (h.startsWith('DINNER')) return 'dinner'
  return null
}

const META = /^PREP\s+(.+?)\s*[♦•]\s*COOK\s+(.+?)\s*[♦•]\s*SERVES\s+(.+?)$/i
const NOTE_START = /^(LOW-FODMAP NOTE|NOTE|CHEF'S NOTE|GUT NOTE|TIP)\b/i
const FOOTER = /COOKEDWITHOUTOIL|NONONSTICK|NOPLASTIC/i
const LIST_MARKER = /^(?:[•◦▪]|\d+\.)$/

function parsePage(pageText) {
  const raw = pageText.split('\n').map((l) => l.replace(/\u00a0/g, ' ').trimEnd())
  const meal = MEAL_OF_PAGE(raw[0] || '')
  if (!meal) return null

  // Drop the stray bullet/number column the extractor leaves at the end of
  // each page, and the printed footer.
  const lines = raw.filter(
    (l) => l.trim() && !LIST_MARKER.test(l.trim()) && !FOOTER.test(l.replace(/\s/g, ''))
  )

  const metaIdx = lines.findIndex((l) => META.test(despace(l)))
  if (metaIdx < 1) return null
  const [, prep, cook, serves] = despace(lines[metaIdx]).match(META)

  // Title can wrap across two lines (page 11, 12, 14...).
  const name = lines.slice(1, metaIdx).map(despace).join(' ').replace(/\s+/g, ' ').trim()

  const ingIdx = lines.findIndex((l, i) => i > metaIdx && isHeader(l, 'INGREDIENTS'))
  const methodIdx = lines.findIndex((l, i) => i > ingIdx && isHeader(l, 'METHOD'))
  if (ingIdx < 0 || methodIdx < 0) return null

  const ingredients = lines.slice(ingIdx + 1, methodIdx).map((l) => l.trim())

  const rest = lines.slice(methodIdx + 1).map((l) => l.trim())
  const noteIdx = rest.findIndex((l) => NOTE_START.test(l))
  const stepLines = (noteIdx === -1 ? rest : rest.slice(0, noteIdx))
  const notes = noteIdx === -1 ? [] : [rest.slice(noteIdx).join(' ').replace(/\s+/g, ' ').trim()]

  return { name, meal, prep, cook, serves, ingredients, steps: stepLines, notes }
}

// A multi-part recipe repeats each component's name as a heading in BOTH the
// ingredient list and the method ("Brown Rice", "Moong Dal Curry"). That
// appearing-in-both test is what identifies a heading; guessing from length
// or wording instead marked real ingredients ("Pinch of salt", "Salt, to
// taste") as headings, which would have dropped them from shopping lists.
// Marking a heading with a trailing colon is what the grocery extractor
// already recognises and skips.
function markSubHeadings(ingredients, steps) {
  const norm = (l) => l.trim().toLowerCase().replace(/[.:,]$/, '')
  const stepSet = new Set(steps.map(norm))
  const ingSet = new Set(ingredients.map(norm))
  const headings = new Set(
    [...ingSet].filter((l) => l && stepSet.has(l) && !/^[\d½¼¾⅓⅔]/.test(l))
  )
  const mark = (lines) =>
    lines.map((l) => (headings.has(norm(l)) ? `${l.trim().replace(/[:]$/, '')}:` : l.trim()))
  return { ingredients: mark(ingredients), steps: mark(steps), headings: [...headings] }
}

const buf = readFileSync(PDF)
const { text } = await extractText(new Uint8Array(buf), { mergePages: false })

const recipes = []
for (const page of text) {
  const parsed = parsePage(page)
  if (!parsed) continue
  const marked = markSubHeadings(parsed.ingredients, parsed.steps)
  const { ingredients, steps } = marked

  // "10 min" -> "10 minutes"; an overnight soak/chill is kept as a note, not
  // folded into a prep figure it would misstate.
  const timeNote = []
  const normTime = (t) => {
    const extra = t.match(/\+\s*(.+)$/)
    if (extra) timeNote.push(extra[1].trim())
    const n = t.match(/(\d+)\s*min/i)
    if (n) return `${n[1]} minutes`
    return /^none$/i.test(t.trim()) ? 'No cooking required' : t.trim()
  }
  const prep_time = normTime(parsed.prep)
  const cook_time = normTime(parsed.cook)
  const servesNum = parsed.serves.trim()
  const servings = /^\d+$/.test(servesNum) ? `${servesNum} servings` : servesNum

  const notes = [...new Set([...timeNote.map((t) => `Requires ${t}.`), ...parsed.notes])]

  recipes.push({
    name: parsed.name,
    meal_type: parsed.meal,
    ingredients: ingredients.join('\n'),
    steps: steps.join('\n'),
    prep_time,
    cook_time,
    servings,
    notes,
    tags: ['no-oil', 'gut-health', ...(parsed.notes.some((n) => /low-fodmap/i.test(n)) ? ['low-fodmap'] : [])],
    tools: [],
    benefits: [],
    parts: marked.headings,
  })
}

writeFileSync('.recipes_parsed.json', JSON.stringify(recipes, null, 2))
console.log(`parsed ${recipes.length} recipes`)
for (const r of recipes) {
  console.log(
    `${r.meal_type.padEnd(9)} | ${r.name.padEnd(52)} | ${String(r.ingredients.split('\n').length).padStart(2)} ing | ${String(r.steps.split('\n').length).padStart(2)} steps | ${r.prep_time} / ${r.cook_time} / ${r.servings}`
  )
}
