// Parser for the cookbook-style PDFs (Cholesterol, Diabetes, Gut Healing,
// PCOS, InstaPot). Unlike the recipe cards these are single-column with
// explicit "Ingredients" and "Directions"/"Instructions" headings, so the
// flat text layer is enough — no coordinates needed.
//
// InstaPot prints its instructions ABOVE the title and ingredients, so the
// two headings can appear in either order; that is handled rather than
// assumed away.
import { extractText } from 'unpdf'

const FOOTER = /^(www\.)?roshnisanghvi\.com$|^©|^\d{1,3}$/i
const ING_HEAD = /^ingredients\s*:?\s*$/i
const DIR_HEAD = /^(directions|instructions|method|steps)\s*:?\s*$/i
// "CURRYIngredients:" — a title fused to the heading that follows it.
const FUSED_ING = /^(.*?)(ingredients\s*:?)\s*$/i

export async function parseBook(buffer) {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: false })
  const recipes = []

  text.forEach((pageText, idx) => {
    const lines = pageText
      .split('\n')
      .map((l) => l.replace(/ /g, ' ').trim())
      .filter((l) => l && !FOOTER.test(l))
    if (lines.length < 6) return

    let ingAt = lines.findIndex((l) => ING_HEAD.test(l))
    let fusedTitle = null
    if (ingAt === -1) {
      // Look for a title fused onto the heading.
      const fusedAt = lines.findIndex((l) => FUSED_ING.test(l) && l.length < 80)
      if (fusedAt === -1) return
      const [, before] = lines[fusedAt].match(FUSED_ING)
      fusedTitle = before.trim() || null
      ingAt = fusedAt
    }
    const dirAt = lines.findIndex((l) => DIR_HEAD.test(l))
    if (dirAt === -1) return

    let name, ingredients, steps
    if (dirAt > ingAt) {
      // Normal order: title, ingredients, directions.
      name = fusedTitle || pickTitle(lines.slice(0, ingAt))
      ingredients = lines.slice(ingAt + 1, dirAt)
      steps = lines.slice(dirAt + 1)
    } else {
      // InstaPot: instructions first, then the title and ingredients.
      steps = lines.slice(dirAt + 1, ingAt)
      ingredients = lines.slice(ingAt + 1)
      // The title sits at the end of the steps block, fused or on its own.
      name = fusedTitle || pickTitle(steps.slice(-2))
      if (!fusedTitle) steps = steps.slice(0, Math.max(0, steps.length - 2))
      else {
        const tail = steps[steps.length - 1]
        if (tail && /^[A-Z][A-Z\s-]+$/.test(tail)) {
          name = titleCase(`${tail} ${fusedTitle}`.replace(/\s+/g, ' ').trim())
          steps = steps.slice(0, -1)
        }
      }
    }

    if (!name || ingredients.length < 2 || steps.length < 1) return
    recipes.push({
      name: titleCase(name),
      page: idx + 1,
      servings: null,
      prep_time: null,
      cook_time: null,
      ingredients: joinWrapped(ingredients),
      steps: joinWrapped(steps),
    })
  })

  return recipes
}

// The title is the last real line before the ingredients: section labels
// ("For the Sprouts") and stray page furniture are skipped.
function pickTitle(before) {
  const candidates = before
    .map((l) => l.trim())
    .filter((l) => l && l.length <= 70 && !/^for the\b/i.test(l) && !/^[\d/]+$/.test(l))
  return candidates.length ? candidates[candidates.length - 1] : null
}

function joinWrapped(lines) {
  const out = []
  for (const raw of lines) {
    const line = raw.replace(/^[•◦▪·]\s*/, '').trim()
    if (!line) continue
    const prev = out[out.length - 1]
    const startsNew = !prev || /^[\d¼½¾⅓⅔]/.test(line) || /[.!?:]$/.test(prev)
    if (startsNew) out.push(line)
    else out[out.length - 1] = `${prev} ${line}`
  }
  return out.join('\n')
}

const SMALL_WORDS = new Set(['and', 'or', 'with', 'in', 'of', 'the', 'a', 'an', 'for', 'to'])
function titleCase(name) {
  if (!name) return name
  if (!/[a-z]/.test(name)) {
    return name
      .toLowerCase()
      .split(/\s+/)
      .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')
  }
  return name
}
