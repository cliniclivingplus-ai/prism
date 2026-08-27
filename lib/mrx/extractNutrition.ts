/**
 * lib/extractNutrition.ts
 *
 * Extracts the 3-phase nutrition recommendation data from BugSpeaks PDFs.
 *
 * How it works:
 * - The PDF draws colored filled circles (dots) next to each food item.
 *   Each dot = one phase frequency. Color encodes the frequency.
 * - We read the raw drawing commands (operator list) from pdfjs to get
 *   the circle colors and positions, then match them to the food item
 *   text words by proximity.
 *
 * Color → Frequency mapping:
 *   Dark green  (0.125, 0.325, 0.228) → "daily"  (1 meal/day)
 *   Amber/gold  (0.941, 0.762, 0.118) → "3day"   (1 meal/3 days)
 *   Blue        (0.137, 0.384, 0.848) → "alt"    (alternate day)
 *   Red         (0.863, 0.149, 0.149) → "avoid"  (avoid)
 *
 * Column layout (PDF x-coordinates):
 *   Left table:  Phase 1 ≈ 173–187 | Phase 2 ≈ 217–231 | Phase 3 ≈ 261–275
 *   Right table: Phase 1 ≈ 456–470 | Phase 2 ≈ 500–514 | Phase 3 ≈ 544–558
 *
 * Coordinate system:
 *   pdfjs constructPath bbox uses PDF coords (y=0 at bottom).
 *   Words use viewport coords (y=0 at top).
 *   Transform: viewport_top = PAGE_HEIGHT - pdf_y_center  (PAGE_HEIGHT = 841.92)
 */

export type FreqCode = 'daily' | 'alt' | '3day' | 'avoid'
export type NutritionData = Record<string, [FreqCode, FreqCode, FreqCode]>

// ── Aliases used by dietary-rx/page.tsx ──────────────────────────────────────
export type Freq = FreqCode
export type NutritionMap = NutritionData

/** Category → emoji for display in the nutrition UI */
export const CATEGORY_EMOJI: Record<string, string> = {
  'Greens & Vegetables':     '🥦',
  'Fruits':                  '🍎',
  'Pulses & Legumes':        '🫘',
  'Cereals':                 '🌾',
  'Fats & Oils':             '🫙',
  'Herbs & Condiments':      '🌿',
  'Egg & Meat':              '🥚',
  'Dietary Supplements':     '💊',
  'Nuts & Seed Oils':        '🥜',
  'Drinks & Beverages':      '🍵',
  'Milk & Fermented Products': '🥛',
}

/**
 * extractNutritionFromPDF - used by dietary-rx/page.tsx
 *
 * Called with the full report_data object loaded from Supabase.
 * Returns the nutrition map that was stored during PDF parsing,
 * or null if it hasn't been extracted yet (e.g. report was uploaded
 * before this feature was added - re-upload to populate it).
 */
export async function extractNutritionFromPDF(
  pdfDoc: { numPages: number; getPage: (n: number) => Promise<unknown> },
  onProgress?: (msg: string) => void
): Promise<NutritionMap | null> {
  const pages: Array<{ text: string; words: any[]; operatorList: unknown }> = []

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    onProgress?.(`Scanning page ${i} of ${pdfDoc.numPages}…`)
    const page = await (pdfDoc.getPage(i) as any)

    // Need page height to flip PDF y (bottom-up) → viewport top (top-down)
    const viewport = page.getViewport({ scale: 1 })
    const pageHeight = viewport.height

    const [operatorList, textContent] = await Promise.all([
      page.getOperatorList(),
      page.getTextContent(),
    ])

    const words = textContent.items
      .filter((item: any) => item.str?.trim())
      .map((item: any) => ({
        text:  item.str.trim(),
        x0:    item.transform[4],
        top:   pageHeight - item.transform[5],  // ← the fix
      }))

    const text = textContent.items.map((item: any) => item.str).join(' ')
    pages.push({ text, words, operatorList })
  }

  return extractNutritionFromPages(pages as any)
}

// A4 page height in points - all BugSpeaks PDFs are A4
const PAGE_HEIGHT = 841.92

// ─── Color detection ──────────────────────────────────────────────────────────

function colorToFreq(r: number, g: number, b: number): FreqCode | null {
  if (r < 0.2  && g > 0.25 && g < 0.45 && b < 0.3) return 'daily'  // dark green
  if (r > 0.8  && g > 0.6  && b < 0.3)              return '3day'   // amber
  if (r < 0.3  && g < 0.5  && b > 0.7)              return 'alt'    // blue
  if (r > 0.7  && g < 0.4  && b < 0.4)              return 'avoid'  // red
  return null
}

// ─── Column detection ─────────────────────────────────────────────────────────

function xToPhaseCol(
  x: number
): { side: 'left' | 'right'; phase: 0 | 1 | 2 } | null {
  if (x > 170 && x < 200) return { side: 'left',  phase: 0 }
  if (x > 215 && x < 245) return { side: 'left',  phase: 1 }
  if (x > 255 && x < 285) return { side: 'left',  phase: 2 }
  if (x > 450 && x < 480) return { side: 'right', phase: 0 }
  if (x > 495 && x < 525) return { side: 'right', phase: 1 }
  if (x > 538 && x < 568) return { side: 'right', phase: 2 }
  return null
}

// ─── Circle extraction from operator list ─────────────────────────────────────

interface Circle {
  cx: number      // PDF x (same in both coordinate systems)
  cy_top: number  // viewport top = PAGE_HEIGHT - pdf_y_center
  freq: FreqCode
}

/**
 * Scans a pdfjs operator list for small filled colored circles.
 *
 * Strategy (version-independent):
 *   1. Any op with exactly 3 float args all in [0,1] that match a known
 *      frequency color → treat as setFillRGBColor.
 *   2. Any op with args[2] being an array of 4 numbers where the bounding
 *      box width and height are both ~13.5pt → treat as constructPath for
 *      a circle, paired with the most recent fill color.
 *
 * This avoids hardcoding pdfjs OPS enum values (which differ between
 * pdfjs-dist 3.x and 4.x).
 */
function extractCirclesFromOperatorList(
  operatorList: { fnArray: number[]; argsArray: unknown[] }
): Circle[] {
  const { fnArray, argsArray } = operatorList
  const circles: Circle[] = []
  let currentColor: [number, number, number] | null = null

  for (let i = 0; i < fnArray.length; i++) {
    const args = argsArray[i]

    // ── Detect setFillRGBColor ──────────────────────────────────────────────
    // Signature: exactly 3 float args in [0, 1], matching a freq color.
    if (
      Array.isArray(args) &&
      args.length === 3 &&
      typeof args[0] === 'number' &&
      typeof args[1] === 'number' &&
      typeof args[2] === 'number' &&
      args[0] >= 0 && args[0] <= 1 &&
      args[1] >= 0 && args[1] <= 1 &&
      args[2] >= 0 && args[2] <= 1
    ) {
      const freq = colorToFreq(args[0] as number, args[1] as number, args[2] as number)
      if (freq !== null) {
        currentColor = [args[0] as number, args[1] as number, args[2] as number]
      }
    }

    // ── Detect constructPath for a small circle ─────────────────────────────
    // Signature: args[2] is a 4-element array [minX, minY, maxX, maxY]
    // where width ≈ height ≈ 13.5pt (the dot diameter).
    if (
      currentColor &&
      Array.isArray(args) &&
      args.length >= 3
    ) {
      const bbox = args[2] as ArrayLike<number> | null
      if (
        bbox != null &&
        typeof (bbox as ArrayLike<number>).length !== 'undefined' &&
        (bbox as ArrayLike<number>).length >= 4
      ) {
        const minX = (bbox as ArrayLike<number>)[0]
        const minY = (bbox as ArrayLike<number>)[1]
        const maxX = (bbox as ArrayLike<number>)[2]
        const maxY = (bbox as ArrayLike<number>)[3]
        const w = maxX - minX
        const h = maxY - minY

        // All BugSpeaks dots are 13.5pt circles - allow ±3pt tolerance
        if (w > 10 && w < 17 && h > 10 && h < 17) {
          const freq = colorToFreq(...currentColor)
          if (freq) {
            const cx = (minX + maxX) / 2
            const cy_pdf = (minY + maxY) / 2
            circles.push({
              cx,
              cy_top: PAGE_HEIGHT - cy_pdf,  // convert to viewport coords
              freq,
            })
          }
        }
      }
    }
  }

  return circles
}

// ─── Word/text extraction helpers ─────────────────────────────────────────────

const SKIP_WORDS = new Set([
  'Items', 'Phase', '1', '2', '3',
  'NUTRITIONAL', 'REPORT',
  'Name:', 'Age:', 'ID:', 'Sample', 'Collection', 'Date:',
  'Received', 'Generated', 'Gender:', 'Type:', 'Stool',
  'Page', 'of', '45',
  '35', '36', '37', '38', '39', '40', '41', '42', '43', '44',
])

interface WordObj { text: string; x0: number; top: number }

function groupWordsByRow(words: WordObj[]): Map<number, WordObj[]> {
  const rows = new Map<number, WordObj[]>()
  for (const w of words) {
    if (SKIP_WORDS.has(w.text)) continue
    const rowKey = Math.round(w.top)
    if (!rows.has(rowKey)) rows.set(rowKey, [])
    rows.get(rowKey)!.push(w)
  }
  return rows
}

// ─── Per-page extraction ───────────────────────────────────────────────────────

function extractFromOnePage(
  operatorList: { fnArray: number[]; argsArray: unknown[] },
  words: WordObj[]
): NutritionData {
  const result: NutritionData = {}

  // Step 1: Get all colored circles
  const circles = extractCirclesFromOperatorList(operatorList)
  if (circles.length === 0) return result

  // Step 2: Build circle map: `side:rowBucket` → Map<phaseIndex, freq>
  // rowBucket = Math.round(cy_top / 8) * 8  (8pt buckets)
  const circleMap = new Map<string, Map<number, FreqCode>>()
  for (const c of circles) {
    const col = xToPhaseCol(c.cx)
    if (!col) continue
    const bucket = Math.round(c.cy_top / 8) * 8
    const key = `${col.side}:${bucket}`
    if (!circleMap.has(key)) circleMap.set(key, new Map())
    circleMap.get(key)!.set(col.phase, c.freq)
  }

  // Step 3: Group words into rows, split by left/right column
  const rows = groupWordsByRow(words)

  // Step 4: For each text row, find the matching circle bucket
  for (const [rowTop, rowWords] of rows) {
    //  Left column: food names at x ≈ 46 (range 30–290)
    //  Right column: food names at x ≈ 328 (range 310–440)
    //  Section headers (e.g. "Fruits") start at x ≈ 15 - exclude by x0 < 30
    const leftWords  = rowWords.filter(w => w.x0 >= 30 && w.x0 < 290)
    const rightWords = rowWords.filter(w => w.x0 >= 310 && w.x0 < 440)

    for (const [side, colWords] of [
      ['left',  leftWords ] as const,
      ['right', rightWords] as const,
    ]) {
      if (colWords.length === 0) continue
      const name = colWords.map(w => w.text).join(' ').toUpperCase()
      if (name.length < 2) continue

      // Find the nearest circle bucket (within 30pt)
      const rowBucket = Math.round(rowTop / 8) * 8
      let bestKey: string | null = null
      let bestDist = 999

      for (const mapKey of circleMap.keys()) {
        const [mapSide, mapBucketStr] = mapKey.split(':')
        if (mapSide !== side) continue
        const dist = Math.abs(parseInt(mapBucketStr, 10) - rowBucket)
        if (dist < bestDist && dist < 30) {
          bestDist = dist
          bestKey = mapKey
        }
      }

      if (bestKey) {
        const phases = circleMap.get(bestKey)!
        if (phases.size === 3) {
          result[name] = [
            phases.get(0) as FreqCode,
            phases.get(1) as FreqCode,
            phases.get(2) as FreqCode,
          ]
        }
      }
    }
  }

  return result
}

// ─── Split-item post-processing ───────────────────────────────────────────────

// Some food names wrap across two PDF rows and get extracted as two entries.
const SPLIT_FIXES: Array<[string, string, string]> = [
  ['SEAWEED (LAMINARIA', 'JAPONICA)',           'SEAWEED (LAMINARIA JAPONICA)'],
  ['KAMUT [KHORASAN',    'WHEAT]',              'KAMUT [KHORASAN WHEAT]'],
  ['RESISTANT STARCH',   'ENRICHED BROWN RICE', 'RESISTANT STARCH ENRICHED BROWN RICE'],
  ['TENDER COCONUT',     'WATER',               'TENDER COCONUT WATER'],
]

function fixSplitItems(data: NutritionData): NutritionData {
  for (const [part1, part2, full] of SPLIT_FIXES) {
    if (data[part1] !== undefined && data[part2] !== undefined) {
      data[full] = data[part1]
      delete data[part1]
      delete data[part2]
    }
  }
  return data
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all nutrition recommendations from the parsed PDF pages.
 *
 * @param pages - Array from the parse-report client payload. Each element
 *   must have { text, words, operatorList }. Only pages containing the
 *   string "NUTRITIONAL REPORT" are processed.
 *
 * @returns NutritionData (flat object) or null if nothing was found.
 *
 * Example output:
 *   {
 *     "BROCCOLI": ["daily", "alt",   "alt"],
 *     "BEEF":     ["avoid", "avoid", "3day"],
 *     "TURMERIC": ["daily", "alt",   "alt"],
 *   }
 */
export function extractNutritionFromPages(
  pages: Array<{ text: string; words: WordObj[]; operatorList?: unknown }>
): NutritionData | null {
  if (!pages?.length) return null

  const merged: NutritionData = {}

  for (const page of pages) {
    if (!page.text?.includes('NUTRITIONAL REPORT')) continue
    if (!page.operatorList) continue

    const pageData = extractFromOnePage(
      page.operatorList as { fnArray: number[]; argsArray: unknown[] },
      page.words ?? []
    )
    Object.assign(merged, pageData)
  }

  if (Object.keys(merged).length === 0) return null
  return fixSplitItems(merged)
}
