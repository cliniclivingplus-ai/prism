/**
 * app/api/mrx/parse-dietary-rx/route.ts
 *
 * Extracts 3-phase dietary frequency data from ANY BugSpeaks report.
 *
 * TWO extraction strategies (tried in order):
 *
 *   1. OPERATOR LIST  - reads PDF paint operations to detect dot colours
 *      by X/Y position. Fast, accurate, no AI tokens used.
 *      Requires: { pages: PDFPageData[] } in request body.
 *
 *   2. GROQ 70b FALLBACK - used when operator list data is missing or
 *      yields < 10 items (scanned PDFs, stripped operator streams).
 *      Requires: { text: string } in request body.
 *
 * Called from:
 *   - app/api/mrx/parse-report/route.ts  → pass pages[] from pdfjs extraction
 *   - app/report/[id]/dietary-rx/page.tsx → pass stored pdf_text as fallback
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  hasDietarySection,
  extractDietaryFromOperatorList,
  extractDietaryViaGroq,
  sanitiseDietaryRx,
} from '@/lib/mrx/extractDietaryRx'
import type { DietaryCategory } from '@/lib/mrx/extractDietaryRx'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, pages } = body as {
      text?: string
      pages?: Array<{
        text: string
        words: { text: string; x0: number; top: number }[]
        operatorList?: { fnArray: number[]; argsArray: (number[] | null)[] }
      }>
    }

    if (!text && !pages?.length) {
      return NextResponse.json(
        { error: 'Provide either text (string) or pages (PDFPageData[])' },
        { status: 400 }
      )
    }

    const fullText = text ?? pages!.map(p => p.text).join('\n')

    if (!hasDietarySection(fullText)) {
      return NextResponse.json(
        { error: 'No dietary section found. Upload the full BugSpeaks report PDF.' },
        { status: 422 }
      )
    }

    let categories: DietaryCategory[] | null = null
    let method = 'unknown'

    // ── Strategy 1: operator list ──────────────────────────────────
    if (pages?.length) {
      try {
        const opResult = extractDietaryFromOperatorList(pages)
        if (opResult && opResult.length >= 3) {
          categories = opResult
          method = 'operator_list'
          console.log(`[parse-dietary-rx] operator list: ${categories.length} categories, ${categories.reduce((s, c) => s + c.items.length, 0)} items`)
        }
      } catch (e) {
        console.warn('[parse-dietary-rx] operator list failed, falling back to Groq:', e)
      }
    }

    // ── Strategy 2: Groq 70b fallback ─────────────────────────────
    if (!categories || categories.length < 3) {
      if (!process.env.GROQ_API_KEY) {
        return NextResponse.json(
          { error: 'GROQ_API_KEY not set and operator list extraction failed.' },
          { status: 500 }
        )
      }
      categories = await extractDietaryViaGroq(fullText)
      method = 'groq_70b'
      console.log(`[parse-dietary-rx] groq fallback: ${categories.length} categories, ${categories.reduce((s, c) => s + c.items.length, 0)} items`)
    }

    const sanitised = sanitiseDietaryRx(categories)

    if (sanitised.length === 0) {
      return NextResponse.json(
        { error: 'No food categories could be extracted from this report.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      categories: sanitised,
      meta: {
        method,
        category_count: sanitised.length,
        item_count: sanitised.reduce((s, c) => s + c.items.length, 0),
      },
    })
  } catch (err: unknown) {
    console.error('[parse-dietary-rx]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}

