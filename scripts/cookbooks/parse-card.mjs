// Parser for the "recipe card" cookbooks (South Indian, North Indian,
// Smoothies, Low FODMAP Soups).
//
// Their pages are two-column: ingredients on the left, directions on the
// right, with a title across the top and "N servings / N minutes" beside it.
// Flattened to a string those columns interleave and the last ingredient
// fuses onto the first direction ("...Almond MilkAdd all the ingredients").
// So this reads the text with its coordinates and splits on the real column
// boundary instead of guessing where one list ends.
import { getDocumentProxy } from 'unpdf'

const FOOTER = /roshnisanghvi\.com|^©/i

// Items on the same printed line share a y within a point or two.
function toLines(items) {
  const rows = []
  for (const it of items) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= 2.5)
    if (row) row.items.push(it)
    else rows.push({ y: it.y, items: [it] })
  }
  return rows
    .sort((a, b) => b.y - a.y) // PDF y grows upward
    .map((r) => ({
      y: r.y,
      x: Math.min(...r.items.map((i) => i.x)),
      h: Math.max(...r.items.map((i) => i.h)),
      text: r.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim(),
    }))
    .filter((r) => r.text)
}

export async function parseCardBook(buffer) {
  const doc = await getDocumentProxy(new Uint8Array(buffer))
  const recipes = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const items = content.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: i.transform[5], h: i.height, str: i.str.trim() }))
    if (!items.length) continue

    // Find the two column headers as ITEMS, not lines: they print at the
    // same height, so grouping into lines first merges them — and merges the
    // two columns with them, fusing every ingredient to a step beside it.
    const ingHeader = items.find((i) => /^ingredients\s*:?$/i.test(i.str))
    const dirHeader = items.find((i) => /^(directions|method|instructions|steps)\s*:?$/i.test(i.str))
    if (!ingHeader || !dirHeader) continue

    // Two layouts in these books. Side by side: the headings print level
    // with each other, ingredients left and directions right. Stacked
    // (PCOS): "Ingredients:" sits above "Instructions:", with the
    // ingredients themselves in two sub-columns between them.
    // The horizontal gap between the two headings is what distinguishes
    // them, not the vertical one: some books print the directions heading
    // lower AND to the right, which reads as stacked if you only compare y.
    const pageWidth = Math.max(...items.map((i) => i.x)) || 1
    const sideBySide = Math.abs(ingHeader.x - dirHeader.x) > pageWidth * 0.2
    const boundary = (ingHeader.x + dirHeader.x) / 2
    const headerY = Math.max(ingHeader.y, dirHeader.y)
    const META_LINE = /prep\s*time|cook\s*time|serve\s*size/i
    const SERVINGS = /(\d+\s*(?:-\s*\d+)?)\s*servings?/i
    const DURATION = /(\d+\s*(?:-\s*\d+)?)\s*(minutes|mins?|hours?|hrs?)/i

    // The title is simply the largest type on the page, wherever it sits:
    // above the columns in some books, mid-page beside the photo in others.
    // Looking only above the headings missed every recipe in those.
    const titleCandidates = items.filter(
      (i) =>
        i !== ingHeader &&
        i !== dirHeader &&
        !FOOTER.test(i.str) &&
        !META_LINE.test(i.str) &&
        !/^[\divxlc]+$/i.test(i.str)
    )
    if (!titleCandidates.length) continue
    const titleItem = titleCandidates.slice().sort((a, b) => b.h - a.h)[0]
    // A title can run to a second or third line ("Avocado and Red Cabbage
    // Salad"). Take every consecutive line set in the same size as the
    // biggest one — stopping at the first gap — or the name arrives cut off.
    const titleLines = toLines(titleCandidates.filter((i) => i.h >= titleItem.h - 1))
    const lineGap = titleItem.h * 2
    const startAt = titleLines.findIndex((l) => Math.abs(l.y - titleItem.y) <= 2.5)
    const titleRows = []
    for (let k = startAt; k >= 0 && k < titleLines.length; k++) {
      const row = titleLines[k]
      const previous = titleRows[titleRows.length - 1]
      if (previous && previous.y - row.y > lineGap) break
      titleRows.push(row)
    }
    const titleParts = titleRows.map((r) => ({ str: r.text, x: r.x, y: r.y, h: r.h }))

    // "2 servings · 40 minutes" prints beside the title; the Prep/Cook/Serve
    // strip can sit anywhere, so it is matched on its own wording.
    const nearTitle = items.filter((i) => i.y <= titleItem.y + 20 && i.y >= titleItem.y - 160)
    const metaText = [
      ...nearTitle.map((i) => i.str),
      ...items.filter((i) => META_LINE.test(i.str)).map((i) => i.str),
    ].join(' ')
    const servings =
      (metaText.match(SERVINGS) || [])[1] ||
      (metaText.match(/serve\s*size\s*:?\s*(\d+(?:\s*-\s*\d+)?)/i) || [])[1]
    const duration = metaText.match(DURATION)
    const prepTime = (metaText.match(/prep\s*time\s*:?\s*(\d+\s*(?:-\s*\d+)?\s*(?:minutes|mins?|hours?|hrs?))/i) || [])[1]
    const cookTime = (metaText.match(/cook\s*time\s*:?\s*(\d+\s*(?:-\s*\d+)?\s*(?:minutes|mins?|hours?|hrs?))/i) || [])[1]
    const title = titleCase(
      titleParts
        .map((i) => i.str)
        .join(' ')
        .replace(/prep\s*time\s*:?.*$/i, '')
        .replace(SERVINGS, '')
        .replace(DURATION, '')
        .replace(/ingredients\s*:?\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    if (!title || title.length < 3) continue
    const titleRowYs = titleRows.map((r) => r.y)
    const titleSet = new Set(
      titleCandidates.filter((i) => titleRowYs.some((y) => Math.abs(i.y - y) <= 2.5) && i.h >= titleItem.h - 1)
    )

    // Columns first, lines second — grouping into lines before splitting
    // would fuse each ingredient onto the step printed beside it.
    const body = items.filter(
      (i) =>
        i !== ingHeader &&
        i !== dirHeader &&
        !titleSet.has(i) &&
        !FOOTER.test(i.str) &&
        !META_LINE.test(i.str) &&
        !(nearTitle.includes(i) && /^\s*\d+\s*(?:-\s*\d+)?\s*(servings?|minutes|mins?|hours?)\s*$/i.test(i.str))
    )
    let ingredients, directions
    if (sideBySide) {
      ingredients = toLines(body.filter((i) => i.x < boundary && i.y < ingHeader.y - 2)).map((l) => l.text)
      directions = toLines(body.filter((i) => i.x >= boundary && i.y < dirHeader.y - 2)).map((l) => l.text)
    } else {
      // Stacked: whichever heading prints higher owns the band between the
      // two; the lower heading owns everything beneath it. Either heading
      // can be on top, so neither order is assumed.
      const upper = ingHeader.y > dirHeader.y ? ingHeader : dirHeader
      const lower = upper === ingHeader ? dirHeader : ingHeader
      const pageMid = Math.max(...items.map((i) => i.x)) / 2
      const between = body.filter((i) => i.y > lower.y + 2)
      // Two sub-columns: read the left one fully, then the right.
      const bandLines = [
        ...toLines(between.filter((i) => i.x < pageMid)),
        ...toLines(between.filter((i) => i.x >= pageMid)),
      ].map((l) => l.text)
      const belowLines = toLines(body.filter((i) => i.y < lower.y - 2)).map((l) => l.text)
      ingredients = upper === ingHeader ? bandLines : belowLines
      directions = upper === ingHeader ? belowLines : bandLines
    }
    if (ingredients.length < 2 || directions.length < 1) continue

    recipes.push({
      name: title,
      page: p,
      servings: servings ? `${servings.replace(/\s+/g, '')} servings` : null,
      prep_time: prepTime ? prepTime.replace(/\s+/g, ' ') : null,
      cook_time: cookTime
        ? cookTime.replace(/\s+/g, ' ')
        : duration
          ? `${duration[1].replace(/\s+/g, '')} ${duration[2].toLowerCase().startsWith('h') ? 'hours' : 'minutes'}`
          : null,
      ingredients: joinWrapped(ingredients),
      steps: joinWrapped(directions),
    })
  }
  return recipes
}

// A printed line that wraps is still one ingredient or one step. A new one
// starts at a quantity, a capital letter after a finished sentence, or a
// bullet; anything else continues the line above.
function joinWrapped(lines) {
  const out = []
  for (const raw of lines) {
    const line = raw.replace(/^[•◦▪·]\s*/, '').trim()
    if (!line) continue
    const prev = out[out.length - 1]
    // A wrapped line continues the one above only when it reads as a
    // continuation: starts lowercase, or closes a bracket the line opened.
    // Guessing from punctuation instead glued "Salt to taste" onto the
    // ingredient above it.
    const startsNew = !prev || !/^[a-z)\]]/.test(line)
    if (startsNew) out.push(line)
    else out[out.length - 1] = `${prev} ${line}`
  }
  return out.join('\n')
}

// Cookbook titles are printed in caps; the bank reads better in title case.
// A name already in mixed case is left exactly as printed.
const SMALL_WORDS = new Set(['and', 'or', 'with', 'in', 'of', 'the', 'a', 'an', 'for', 'to'])
function titleCase(name) {
  if (!/[a-z]/.test(name)) {
    return name
      .toLowerCase()
      .split(/\s+/)
      .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')
  }
  return name
}
