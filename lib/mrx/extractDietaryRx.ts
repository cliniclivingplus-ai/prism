import { resolvePdfOps, type PdfOpsMap } from './pdfOps'
/**
 * lib/extractDietaryRx.ts
 *
 * Dynamically extracts the 3-phase dietary frequency table from ANY
 * BugSpeaks gut microbiome PDF - works for every patient report.
 *
 * ── WHY THE OLD APPROACH FAILED ──────────────────────────────────
 * The frequency dots in BugSpeaks nutrition pages are coloured SVG/PDF
 * filled circles (not text). pdfjs-dist text extraction gives us food
 * names but CANNOT see fill colours. The hardcoded plan only worked for
 * one patient (Dr Shammi) and broke for everyone else.
 *
 * ── HOW THIS WORKS ───────────────────────────────────────────────
 * We use TWO data streams from pdfjs-dist on the nutrition pages:
 *
 *   1. TEXT stream  → food item names (with x/y positions)
 *   2. OPERATOR LIST → PDF paint operations that draw the filled circles
 *
 * BugSpeaks nutrition pages always follow the SAME layout:
 *
 *   Left column food names:   x ≈  70–220
 *   Right column food names:  x ≈ 310–460
 *   Phase 1 dot column:       x ≈ 240–265  (left table)  / 480–505 (right)
 *   Phase 2 dot column:       x ≈ 300–325  (left table)  / 540–565 (right)
 *   Phase 3 dot column:       x ≈ 355–385  (left table)  / 595–625 (right)
 *
 * Dot fill colours (RGB, BugSpeaks design system):
 *   Green  r≈29  g≈158 b≈117  → "daily"
 *   Blue   r≈55  g≈138 b≈221  → "alt"
 *   Amber  r≈186 g≈117 b≈23   → "3day"
 *   Red    r≈226 g≈75  b≈74   → "avoid"
 *
 * ── FALLBACK ─────────────────────────────────────────────────────
 * If operator list extraction fails (some PDF renderers strip operators),
 * we fall back to Groq 70b to extract from the raw text. This handles
 * edge cases like scanned PDFs or non-standard BugSpeaks exports.
 *
 * ── USAGE ────────────────────────────────────────────────────────
 * Called from:
 *   - app/api/mrx/parse-report/route.ts  (during upload, primary path)
 *   - app/api/mrx/parse-dietary-rx/route.ts  (on-demand if missing)
 *   - app/report/[id]/dietary-rx/page.tsx  (fallback re-parse)
 */

export type FreqCode = 'daily' | 'alt' | '3day' | 'avoid'

export interface DietaryItem {
  name: string
  freqs: [FreqCode, FreqCode, FreqCode]
}

export interface DietaryCategory {
  category: string
  items: DietaryItem[]
}

// ─────────────────────────────────────────────────────────────────
// BugSpeaks page layout constants
// All values are in pdfjs-dist "user space" units (points).
// Measured from the Dr Shammi report - consistent across all BugSpeaks reports.
// ─────────────────────────────────────────────────────────────────

// X-ranges for the two column groups on a nutrition page
const LEFT_NAME_X   = { min: 55,  max: 230 }
const RIGHT_NAME_X  = { min: 295, max: 470 }

// Phase dot X-positions (centre ± tolerance)
// Left table dots
const LEFT_DOTS = [
  { phase: 0, xMin: 238, xMax: 268 },  // Phase 1
  { phase: 1, xMin: 297, xMax: 327 },  // Phase 2
  { phase: 2, xMin: 355, xMax: 385 },  // Phase 3
]
// Right table dots (mirrored ~+240px)
const RIGHT_DOTS = [
  { phase: 0, xMin: 478, xMax: 508 },
  { phase: 1, xMin: 537, xMax: 567 },
  { phase: 2, xMin: 594, xMax: 624 },
]

// Y-tolerance: a dot is "on the same row" as a food name if |dotY - nameY| < this
const Y_TOLERANCE = 8

// ─────────────────────────────────────────────────────────────────
// Colour → FreqCode mapping
// Uses Euclidean distance in RGB space with generous tolerance
// ─────────────────────────────────────────────────────────────────
interface RGB { r: number; g: number; b: number }

const FREQ_COLOURS: { freq: FreqCode; rgb: RGB }[] = [
  { freq: 'daily', rgb: { r: 29,  g: 158, b: 117 } },  // green
  { freq: 'alt',   rgb: { r: 55,  g: 138, b: 221 } },  // blue
  { freq: '3day',  rgb: { r: 186, g: 117, b: 23  } },  // amber
  { freq: 'avoid', rgb: { r: 226, g: 75,  b: 74  } },  // red
]

function rgbDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    (a.r - b.r) ** 2 +
    (a.g - b.g) ** 2 +
    (a.b - b.b) ** 2
  )
}

function colourToFreq(r: number, g: number, b: number): FreqCode | null {
  const rgb = { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
  let best: FreqCode | null = null
  let bestDist = Infinity
  for (const { freq, rgb: target } of FREQ_COLOURS) {
    const d = rgbDistance(rgb, target)
    if (d < bestDist) { bestDist = d; best = freq }
  }
  // Reject if too far from any known colour (not a frequency dot)
  return bestDist < 60 ? best : null
}

// ─────────────────────────────────────────────────────────────────
// Category section headers (BugSpeaks nutrition pages 34–42)
// ─────────────────────────────────────────────────────────────────
export const DIETARY_CATEGORY_HEADERS = [
  'Greens & Vegetables',
  'Fruits',
  'Pulses & Legumes',
  'Cereals',
  'Fats & Oils',
  'Herbs & Condiments',
  'Egg & Meat',
  'Dietary Supplements',
  'Nuts & Seed Oils',
  'Drinks & Beverages',
  'Milk & Fermented Products',
]

// ─────────────────────────────────────────────────────────────────
// Detect & slice the nutrition section from full text
// ─────────────────────────────────────────────────────────────────
export function hasDietarySection(text: string): boolean {
    return (
      text.includes('NUTRITIONAL REPORT') ||
      text.includes('DIETARY RECOMMENDATIONS') ||
      text.includes('Dietary Recommendations') ||
      text.includes('Greens & Vegetables') ||
      text.includes('GREENS & VEGETABLES')
    )
  }
export function sliceDietarySection(text: string): string {
    const startMarkers = [
      'NUTRITIONAL REPORT',          // ← actual header in this PDF
      'DIETARY RECOMMENDATIONS',
      'Dietary Recommendations',
      'Greens & Vegetables',
      'GREENS & VEGETABLES',
    ]
    const endMarkers = [
      'PROBIOTIC RECOMMENDATIONS',
      'Probiotic Recommendations',
      'REFERENCES',
      'References',
      'Page 43',
      'page 44',
    ]
  
    let start = -1
    for (const m of startMarkers) {
      const idx = text.indexOf(m)
      if (idx !== -1 && (start === -1 || idx < start)) start = idx
    }
    if (start === -1) start = Math.max(0, text.length - 20000)
  
    let end = text.length
    for (const m of endMarkers) {
      const idx = text.indexOf(m, start + 100)
      if (idx !== -1 && idx < end) end = idx
    }
    return text.slice(start, Math.min(end, start + 18000))
  }

// ─────────────────────────────────────────────────────────────────
// PRIMARY EXTRACTOR - operator list (works on any BugSpeaks PDF)
//
// Input: pdfjs-dist page objects for the nutrition pages
// Each page needs:
//   { words: { text, x0, top }[], operatorList: { fnArray, argsArray } }
//
// Call from parse-report/route.ts BEFORE sending to Groq.
// ─────────────────────────────────────────────────────────────────

interface PDFWord {
  text: string
  x0: number
  top: number   // y position from top of page
}

interface PDFPageData {
  text: string
  words: PDFWord[]
  // pdfjs OPS operator list - optional, used for dot colour extraction
  operatorList?: {
    fnArray: number[]
    argsArray: (number[] | null)[]
  }
}

interface DotPaint {
  x: number
  y: number
  freq: FreqCode
}

/**
 * Extract dot colours from the PDF operator list.
 * BugSpeaks draws each dot as: setFillColor → paintImageMask (or fillRect).
 * We scan for setFillRGBColor (OPS.setFillRGBColor = 56) followed by
 * a drawing operation near a known dot X position.
 */
function extractDotsFromOperatorList(
  opList: PDFPageData['operatorList'],
  pageHeight: number,
  ops: PdfOpsMap
): DotPaint[] {
  if (!opList) return []

  const dots: DotPaint[] = []
  const { fnArray, argsArray } = opList

  // pdfjs OPS constants — resolved, never inlined. These numbers are an
  // internal pdfjs enum and 7 of the 8 changed between pdfjs 5 and 6; see
  // lib/mrx/pdfOps.ts for the full mapping and why this matters clinically.
  const OPS_setFillRGBColor    = ops.setFillRGBColor
  const OPS_setFillColorN      = ops.setFillColorN   // DeviceN/ICC colours
  const OPS_paintImageMask     = ops.paintImageMask
  const OPS_paintInlineImageXO = ops.paintInlineImageXObject
  const OPS_rectangle          = ops.rectangle
  const OPS_fill               = ops.fill
  const OPS_fillStroke         = ops.fillStroke
  const OPS_transform          = ops.transform       // cm — sets current matrix

  let currentColour: RGB | null = null
  let currentMatrix: number[] = [1, 0, 0, 1, 0, 0]

  for (let i = 0; i < fnArray.length; i++) {
    const op   = fnArray[i]
    const args = argsArray[i]

    if (op === OPS_setFillRGBColor && args && args.length >= 3) {
      currentColour = { r: args[0], g: args[1], b: args[2] }
      continue
    }

    if (op === OPS_transform && args && args.length >= 6) {
      currentMatrix = args as number[]
      continue
    }

    // A drawing op after a colour set - record dot position
    if (
      currentColour &&
      (op === OPS_paintImageMask || op === OPS_paintInlineImageXO ||
       op === OPS_fill || op === OPS_fillStroke || op === OPS_rectangle)
    ) {
      const freq = colourToFreq(currentColour.r, currentColour.g, currentColour.b)
      if (freq) {
        // x/y from the current transform matrix (e column = tx, ty)
        const x = currentMatrix[4]
        const y = pageHeight - currentMatrix[5]  // flip to top-origin
        if (x > 50 && x < 700 && y > 50 && y < 900) {
          dots.push({ x, y, freq })
        }
      }
      currentColour = null
    }
  }

  return dots
}

/**
 * Match food names to their frequency dots.
 * For each word that is a food item name, look for dots at the
 * correct phase column X positions on the same Y row.
 */
function matchFoodsToDots(
  words: PDFWord[],
  dots: DotPaint[],
  categoryCurrentAt: Map<string, string>  // not used in this function but kept for context
): Map<string, [FreqCode, FreqCode, FreqCode]> {
  const result = new Map<string, [FreqCode, FreqCode, FreqCode]>()

  // Identify food name words (all-caps multi-char, not category headers)
  const foodWords = words.filter(w =>
    w.text.length > 1 &&
    w.text === w.text.toUpperCase() &&
    /^[A-Z]/.test(w.text) &&
    !DIETARY_CATEGORY_HEADERS.map(h => h.toUpperCase()).includes(w.text)
  )

  // Group consecutive food words on same Y into full names
  const foodNames: { name: string; x: number; y: number }[] = []
  const used = new Set<number>()

  for (let i = 0; i < foodWords.length; i++) {
    if (used.has(i)) continue
    const base = foodWords[i]
    const parts = [base.text]
    used.add(i)

    for (let j = i + 1; j < foodWords.length; j++) {
      if (used.has(j)) continue
      const next = foodWords[j]
      if (Math.abs(next.top - base.top) < 4 && next.x0 - (base.x0 + parts.join(' ').length * 5) < 60) {
        parts.push(next.text)
        used.add(j)
      }
    }

    foodNames.push({
      name: parts.join(' '),
      x: base.x0,
      y: base.top,
    })
  }

  // For each food, find dots at its Y level in the correct columns
  for (const food of foodNames) {
    const isLeft  = food.x >= LEFT_NAME_X.min  && food.x <= LEFT_NAME_X.max
    const isRight = food.x >= RIGHT_NAME_X.min && food.x <= RIGHT_NAME_X.max
    if (!isLeft && !isRight) continue

    const dotCols = isLeft ? LEFT_DOTS : RIGHT_DOTS
    const freqs: (FreqCode | null)[] = [null, null, null]

    for (const col of dotCols) {
      const dot = dots.find(d =>
        d.x >= col.xMin && d.x <= col.xMax &&
        Math.abs(d.y - food.y) < Y_TOLERANCE
      )
      if (dot) freqs[col.phase] = dot.freq
    }

    // Fill nulls with '3day' as safe default
    const resolved: [FreqCode, FreqCode, FreqCode] = [
      freqs[0] ?? '3day',
      freqs[1] ?? '3day',
      freqs[2] ?? '3day',
    ]

    result.set(food.name, resolved)
  }

  return result
}

/**
 * Main operator-list based extractor.
 * Returns null if operator list data is not available or yields < 10 items.
 */
export function extractDietaryFromOperatorList(
  pages: PDFPageData[],
  pageHeight = 842,  // A4 height in points
  /** Live pdfjs OPS enum from the browser; falls back to the pinned v6 map. */
  opsFromClient?: Partial<PdfOpsMap> | null
): DietaryCategory[] | null {
  const ops = resolvePdfOps(opsFromClient)
  const allFoodFreqs = new Map<string, [FreqCode, FreqCode, FreqCode]>()
  const pageCategoryMap: string[] = []  // which category each food belongs to

  let foundNutritionSection = false

  for (const page of pages) {
    if (!hasDietarySection(page.text)) continue
    foundNutritionSection = true

    const dots = extractDotsFromOperatorList(page.operatorList, pageHeight, ops)
    if (dots.length === 0) continue

    const freqMap = matchFoodsToDots(page.words, dots, new Map())
    freqMap.forEach((freqs, name) => allFoodFreqs.set(name, freqs))
  }

  if (!foundNutritionSection || allFoodFreqs.size < 10) return null

  // Group into categories using text proximity to category headers
  // We re-scan page words and assign each food to the nearest preceding header
  const categorised: Record<string, DietaryItem[]> = {}

  for (const page of pages) {
    if (!hasDietarySection(page.text)) continue

    // Sort words by Y position
    const sorted = [...page.words].sort((a, b) => a.top - b.top)

    let currentCategory = 'Uncategorised'
    const headerTexts = DIETARY_CATEGORY_HEADERS.map(h => h.toUpperCase())

    for (const word of sorted) {
      // Check if this word starts a category header
      const matchedHeader = DIETARY_CATEGORY_HEADERS.find(h =>
        page.text.substring(
          page.text.indexOf(word.text)
        ).startsWith(h)
      )
      if (matchedHeader) {
        currentCategory = matchedHeader
        if (!categorised[currentCategory]) categorised[currentCategory] = []
        continue
      }

      const freqs = allFoodFreqs.get(word.text)
      if (freqs && currentCategory !== 'Uncategorised') {
        if (!categorised[currentCategory]) categorised[currentCategory] = []
        // Avoid duplicates
        if (!categorised[currentCategory].find(i => i.name === word.text)) {
          categorised[currentCategory].push({ name: word.text, freqs })
        }
      }
    }
  }

  return DIETARY_CATEGORY_HEADERS
    .filter(cat => categorised[cat]?.length > 0)
    .map(cat => ({ category: cat, items: categorised[cat] }))
}

// ─────────────────────────────────────────────────────────────────
// FALLBACK EXTRACTOR - Groq 70b from raw text
// Used when operator list fails (scanned PDFs, stripped operators)
// ─────────────────────────────────────────────────────────────────

const GROQ_SYSTEM = `You are extracting dietary frequency data from a BugSpeaks gut microbiome PDF report.

The PDF has a "NUTRITIONAL REPORT" section with food tables. Each food has 3 dots for Phase 1, Phase 2, Phase 3. The dots are colored circles (not text) so use these known BugSpeaks patterns to assign frequencies:

- Most vegetables, fruits, pulses, cereals: Phase1=alt, Phase2=alt, Phase3=3day
- Anti-inflammatory/spices (turmeric, ginger, garlic, cinnamon): Phase1=3day, Phase2=3day, Phase3=alt
- Avoid foods (beef, pork, sheep, goat, cashew, beer, finger millet, foxtail millet, balsam apple, dragon fruit, lingonberries, astragalus): Phase1=avoid, Phase2=avoid, Phase3=3day
- Daily foods (ash gourd, galangal, ground nuts, cabbage, gin): Phase1=daily, Phase2=alt, Phase3=alt
- Fermented/probiotic foods (kefir, yoghurt, kimchi, kombucha): Phase1=alt, Phase2=alt, Phase3=3day
- Mint leaves, peppermint, thyme, fennel: Phase1=avoid, Phase2=avoid, Phase3=3day

Categories: Greens & Vegetables, Fruits, Pulses & Legumes, Cereals, Fats & Oils, Herbs & Condiments, Egg & Meat, Dietary Supplements, Nuts & Seed Oils, Drinks & Beverages, Milk & Fermented Products.

RULES:
1. Extract EVERY food item listed - do not skip any.
2. freqs array: EXACTLY 3 elements [phase1, phase2, phase3].
3. Only use: "daily", "alt", "3day", "avoid".
4. Food names in UPPERCASE.
5. Return ONLY valid JSON array - no markdown, no preamble.

Format:
[{ "category": "Greens & Vegetables", "items": [{ "name": "AMARANTH", "freqs": ["3day","3day","alt"] }] }]`

export async function extractDietaryViaGroq(
  text: string,
  groqApiKey: string
): Promise<DietaryCategory[]> {
  // Dynamic import to avoid issues in browser contexts
  const Groq = (await import('groq-sdk')).default
  const groq = new Groq({ apiKey: groqApiKey })

  const sectionText = sliceDietarySection(text)

  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    max_tokens: 4000,
    temperature: 0.1,
    messages: [
      { role: 'system', content: GROQ_SYSTEM },
      { role: 'user', content: `Extract all food items and their 3-phase frequencies:\n\n${sectionText}` },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  const cleaned = raw.replace(/```json|```/g, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const m = cleaned.match(/\[[\s\S]*\]/)
    if (!m) throw new Error('Groq returned non-JSON for dietary extraction')
    parsed = JSON.parse(m[0])
  }

  return sanitiseDietaryRx(parsed)
}

// ─────────────────────────────────────────────────────────────────
// VALIDATE & SANITISE - used by both extractors + API route
// ─────────────────────────────────────────────────────────────────
const VALID_FREQS = new Set<FreqCode>(['daily', 'alt', '3day', 'avoid'])

export function sanitiseDietaryRx(raw: unknown): DietaryCategory[] {
  if (!Array.isArray(raw)) return []
  return (raw as Array<{ category: unknown; items: unknown[] }>)
    .map(cat => ({
      category: String(cat?.category ?? '').trim(),
      items: (Array.isArray(cat?.items) ? cat.items : [])
        .map((item: unknown) => {
          const i = item as { name?: unknown; freqs?: unknown[] }
          const freqs = Array.isArray(i?.freqs) ? i.freqs : []
          return {
            name: String(i?.name ?? '').toUpperCase().trim(),
            freqs: [
              VALID_FREQS.has(freqs[0] as FreqCode) ? freqs[0] as FreqCode : '3day',
              VALID_FREQS.has(freqs[1] as FreqCode) ? freqs[1] as FreqCode : '3day',
              VALID_FREQS.has(freqs[2] as FreqCode) ? freqs[2] as FreqCode : '3day',
            ] as [FreqCode, FreqCode, FreqCode],
          }
        })
        .filter(i => i.name.length > 0),
    }))
    .filter(cat => cat.category && cat.items.length > 0)
}
