/**
 * pdfjs operator codes, by name.
 *
 * ── Why this file exists ────────────────────────────────────────────────
 * extractDietaryRx.ts reads BugSpeaks' dietary dots straight out of the PDF
 * operator list, matching on numeric opcodes. Those numbers come from
 * pdfjs's `OPS` enum, which is NOT stable across major versions — it is an
 * internal enum, renumbered whenever operators are added or removed.
 *
 * The values previously inlined in extractDietaryRx.ts were pdfjs 5.x
 * numbers. Under pdfjs 6.2.108, 7 of the 8 changed:
 *
 *     setFillRGBColor          56 -> 59
 *     setFillColorN            33 -> 55
 *     paintImageMask           92 -> 83   (renamed paintImageMaskXObject)
 *     paintInlineImageXObject  84 -> 86
 *     rectangle                67 -> 19
 *     fill                     14 -> 22
 *     fillStroke               16 -> 24
 *     transform                12 -> 12   (unchanged)
 *
 * Nothing would have thrown. The dot scanner would simply have matched no
 * fill-colour operators and returned zero dots, so every food's frequency
 * (daily / weekly / avoid) would have silently gone missing or wrong. That
 * is clinical content, so it is worth the ceremony of keeping the mapping
 * in one reviewed place.
 *
 * ── Why they are constants and not read from pdfjs ──────────────────────
 * The consumers are server-side route handlers (app/api/mrx/parse-report,
 * parse-dietary-rx). pdfjs-dist 6 is browser-targeted — importing its main
 * build in Node throws `DOMMatrix is not defined`, and pulling in the
 * `legacy` build server-side just to read an enum is a lot of weight. The
 * operator list itself is produced in the browser and posted as JSON.
 *
 * Instead the browser sends its live enum alongside the pages (see
 * `opsFromPdfjs`), and the server prefers that over these constants. These
 * are the fallback for older clients and the documented source of truth.
 *
 * ⚠️ On any future pdfjs major bump: re-derive these by name, do not assume.
 */

export type PdfOpsMap = {
  setFillRGBColor: number
  setFillColorN: number
  paintImageMask: number
  paintInlineImageXObject: number
  rectangle: number
  fill: number
  fillStroke: number
  transform: number
}

/** Verified against pdfjs-dist 6.2.108. */
export const PDF_OPS_V6: PdfOpsMap = {
  setFillRGBColor: 59,
  setFillColorN: 55,
  paintImageMask: 83, // paintImageMaskXObject
  paintInlineImageXObject: 86,
  rectangle: 19,
  fill: 22,
  fillStroke: 24,
  transform: 12,
}

/**
 * The pdfjs `OPS` names this app depends on, in the order of PdfOpsMap.
 * `paintImageMask` was renamed to `paintImageMaskXObject`, so both spellings
 * are accepted when reading a live enum.
 */
const OPS_NAMES: Record<keyof PdfOpsMap, string[]> = {
  setFillRGBColor: ['setFillRGBColor'],
  setFillColorN: ['setFillColorN'],
  paintImageMask: ['paintImageMaskXObject', 'paintImageMask'],
  paintInlineImageXObject: ['paintInlineImageXObject'],
  rectangle: ['rectangle'],
  fill: ['fill'],
  fillStroke: ['fillStroke'],
  transform: ['transform'],
}

/**
 * Build a PdfOpsMap from a live pdfjs `OPS` enum. Call this in the browser,
 * where pdfjs is already loaded, and send the result to the server with the
 * page payload. Resolving by name means a future renumbering is picked up
 * automatically instead of silently corrupting output.
 */
export function opsFromPdfjs(OPS: Record<string, number> | undefined | null): PdfOpsMap | null {
  if (!OPS) return null
  const out = {} as PdfOpsMap

  for (const key of Object.keys(OPS_NAMES) as (keyof PdfOpsMap)[]) {
    const found = OPS_NAMES[key].map((n) => OPS[n]).find((v) => typeof v === 'number')
    if (typeof found !== 'number') return null // incomplete enum — don't half-trust it
    out[key] = found
  }
  return out
}

/** Server-side resolution: trust the client's live enum, else the constants. */
export function resolvePdfOps(fromClient?: Partial<PdfOpsMap> | null): PdfOpsMap {
  if (fromClient) {
    const complete = (Object.keys(PDF_OPS_V6) as (keyof PdfOpsMap)[]).every(
      (k) => typeof fromClient[k] === 'number'
    )
    if (complete) return fromClient as PdfOpsMap
  }
  return PDF_OPS_V6
}
