import { opsFromPdfjs, type PdfOpsMap } from './pdfOps'
/**
 * extractSpecies.ts
 *
 * Dynamic species extraction - no KNOWN_GENERA hardcoded list.
 * Detects any scientific name (Genus species) from PDF text using
 * biological suffix patterns to filter out English false positives.
 */

export type ExtractedPatient = {
  name: string
  age_sex: string
  complaint: string
  diet_type: string
  medical_history: string
  allergies: string
}

export type FoundationSpecies = {
  name: string
  patient_value: number
  min: number
  p25: number
  ref_low: number
  ref_high: number
  p75: number
  max: number
  status: 'low' | 'normal' | 'high'
}

export type ReportData = {
  patient: any
  rych_index: number | null
  scfa: Record<string, number | null>
  vitamins: Record<string, number | null>
  neurotransmitters: Record<string, number | null>
  macronutrients: Record<string, number | null>
  gut_function: Record<string, number | null>
  intolerance: Record<string, number | null>
  endurance: Record<string, number | null>
  health_indicators: Record<string, number | null>
  disease_risk: Record<string, number | null>
  diversity: Record<string, number | null>
  kingdom: Record<string, number | null>
  antibiotic_recovery: number | null
  probiotics: {
    absent: string[]
    low_optimal: string[]
    high_optimal: string[]
    optimal: string[]
    atypical_high: string[]
  }
  probiotic_recommendations: string[]
  pathogens_detected: string[]
  pathogen_category_tag: string | null
  pathogens_data: Array<{
    name: string
    patient_value: number
    min: number
    p25: number
    ref_low: number
    ref_high: number
    p75: number
    max: number
    status: 'low' | 'normal' | 'high'
  }>
  antibiotic_resistance: Record<string, string>
  antibiotic_resistance_tag: string | null
  antibiotic_recovery_tag: string | null
  species_list: string[]
  foundation_microbiota: FoundationSpecies[]
  dietary_rx: any[] | null
  dietary_rx_method: string | null
  dietary_rx_parsed_at: string | null
  nutrition: any | null
  nutrition_data?: Record<string, Record<string, [string, string, string]>>
}

export type PDFExtractResult = {
  species: string[]
  patient: ExtractedPatient
  reportData: ReportData | null
  rawText: string
}

// ─── Common words that look like species epithets - used to filter false ──────
// positives when scanning raw PDF text for scientific names.
const COMMON_WORDS = new Set([
  'the','and','for','are','with','from','this','that','have','been','were',
  'will','not','but','can','all','more','was','its','has','had','our','may',
  'any','one','two','new','per','due','via','use','used','also','into','than',
  'some','your','their','each','both','only','very','such','over','high','low',
  'rate','type','risk','data','age','sex','level','test','page','date','name',
  'case','care','dose','drug','diet','time','body','cell','gene','form',
  'acid','base','mass','site','role','mode','line','note','text','list',
  'report','sample','result','figure','section','score','index','value',
  'potential','indicator','management','metabolism','production',
])

/**
 * Extracts all scientific names dynamically from text.
 *
 * Genus detection: first word must end with a known biological suffix.
 * This eliminates common English words (e.g. "Please", "Name", "Sample")
 * while catching real genera (Bacteroides, Faecalibacterium, Bifidobacterium…).
 *
 * Epithet detection: all-lowercase, ≥3 chars, not a common English word,
 * not ending in -ing/-tion/-ness/-ment (English suffixes).
 */
function extractSpeciesFromText(text: string): string[] {
  const found = new Set<string>()

  const pattern = /\b([A-Z][a-z]{2,}(?:us|ia|um|is|er|ium|bacter|coccus|ella|oides|ales|aceae|cter|monas|vibrio|plasma|phila|rella|nella|myces|bacillus|bacterium|clostridium))\s+([a-z]{3,})\b/g

  let match
  while ((match = pattern.exec(text)) !== null) {
    const genus   = match[1]
    const epithet = match[2]

    if (COMMON_WORDS.has(epithet)) continue
    if (/ing$|tion$|ness$|ment$|ance$|ence$/.test(epithet)) continue

    found.add(`${genus} ${epithet}`)
  }

  return Array.from(found)
}

// ─── Nutrition trigger keywords ───────────────────────────────────────────────
const NUTRITION_TRIGGERS = ['NUTRITIONAL', 'Greens', 'Vegetables', 'Legumes', 'Cereals']

type PageData = { text: string; words: any[]; operatorList?: any }

async function extractPageText(
  pdf: any,
  pageNum: number
): Promise<{ text: string; words: any[] }> {
  const page    = await pdf.getPage(pageNum)
  const content = await page.getTextContent()
  const items   = content.items as any[]

  const lineMap = new Map<number, string[]>()
  const words: any[] = []

  for (const item of items) {
    if (!item.str?.trim()) continue
    const y = Math.round(item.transform?.[5] || 0)
    const x = item.transform?.[4] || 0
    const top = item.transform?.[5] || 0

    if (!lineMap.has(y)) lineMap.set(y, [])
    lineMap.get(y)!.push(item.str)

    const wordTokens = item.str.trim().split(/\s+/)
    let xOffset = x
    for (const token of wordTokens) {
      if (token) {
        words.push({ text: token, x0: xOffset, top: 850 - top })
        xOffset += token.length * 4
      }
    }
  }

  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
  let text = ''
  for (const y of sortedYs) {
    const line = lineMap.get(y)!.join(' ').trim()
    if (line) text += line + '\n'
  }

  return { text: text + '\n', words }
}

async function attachOperatorList(pdf: any, pageNum: number): Promise<any> {
  try {
    const page = await pdf.getPage(pageNum)
    return await page.getOperatorList()
  } catch {
    return undefined
  }
}

/**
 * The browser's live pdfjs OPS enum, captured when the PDF is parsed.
 * Posted to the server with the pages so the dietary-dot scanner matches on
 * the numbers this pdfjs build actually emitted — see lib/mrx/pdfOps.ts.
 */
export let lastPdfOps: PdfOpsMap | null = null

async function getPDFData(file: File): Promise<{ fullText: string; pages: PageData[] }> {
  const pdfjsLib = await import('pdfjs-dist')
  lastPdfOps = opsFromPdfjs(pdfjsLib.OPS as unknown as Record<string, number>)
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const textResults = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) => extractPageText(pdf, i + 1))
  )

  const fullText = textResults.map(r => r.text).join('')

  const patchedTexts = textResults.map(r => {
    let text = r.text
    if (!text.includes('NUTRITIONAL REPORT') &&
        text.includes('NUTRITIONAL') && text.includes('REPORT')) {
      text = text.replace('NUTRITIONAL', 'NUTRITIONAL REPORT')
    }
    return text
  })

  const nutritionPageIndices = patchedTexts
    .map((text, i) => ({ i, isNutrition: NUTRITION_TRIGGERS.some(t => text.includes(t)) }))
    .filter(p => p.isNutrition)
    .map(p => p.i)

  console.log(`[getPDFData] ${pdf.numPages} pages, ${nutritionPageIndices.length} nutrition pages`)

  const operatorListMap = new Map<number, any>()
  await Promise.all(
    nutritionPageIndices.map(async (idx) => {
      const opList = await attachOperatorList(pdf, idx + 1)
      if (opList) operatorListMap.set(idx, opList)
    })
  )

  const pages: PageData[] = textResults.map((r, i) => ({
    text:         patchedTexts[i],
    words:        r.words,
    operatorList: operatorListMap.get(i),
  }))

  return { fullText, pages }
}

function buildPatientForm(data: ReportData | null): ExtractedPatient {
  if (!data?.patient) {
    return { name: '', age_sex: '', complaint: '', diet_type: '', medical_history: '', allergies: '' }
  }
  const p = data.patient
  const age_sex = p.age && p.gender
    ? `${p.age}${p.gender.toLowerCase().startsWith('m') ? 'M' : 'F'}`
    : ''
  return { name: p.name || '', age_sex, complaint: '', diet_type: '', medical_history: '', allergies: '' }
}

export async function extractFromPDF(file: File): Promise<PDFExtractResult> {
  const { fullText, pages } = await getPDFData(file)

  // Dynamic species extraction - no KNOWN_GENERA list
  const speciesFromText = extractSpeciesFromText(fullText)

  const [nutritionData, reportDataRaw] = await Promise.all([
    (async () => {
      try {
        const { extractNutritionFromPages } = await import('./extractNutrition')
        const result = extractNutritionFromPages(pages) as Record<string, Record<string, [string, string, string]>> | null
        console.log('[extractFromPDF] nutrition:', result ? Object.keys(result).length + ' categories' : 'null')
        return result
      } catch (e) {
        console.error('[extractFromPDF] nutrition failed:', e instanceof Error ? e.message : String(e))
        return null
      }
    })(),

    (async () => {
      try {
        const pagesForAPI = pages.map(({ text, words }) => ({ text, words }))
        const res = await fetch('/api/mrx/parse-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullText, pages: pagesForAPI }),
        })
        if (!res.ok) return null
        const json = await res.json()
        return json.data as ReportData | null
      } catch {
        return null
      }
    })(),
  ])

  let reportData: ReportData | null = reportDataRaw

  if (reportData) {
    if (reportData.species_list?.length > 0) {
      reportData.species_list = Array.from(new Set([...speciesFromText, ...reportData.species_list]))
    } else {
      reportData.species_list = speciesFromText
    }
    if (nutritionData && Object.keys(nutritionData).length > 0) {
      ;(reportData as any).nutrition = nutritionData
    }
  } else {
    reportData = {
      patient: null, rych_index: null, scfa: {}, vitamins: {},
      neurotransmitters: {}, macronutrients: {}, gut_function: {},
      intolerance: {}, endurance: {}, health_indicators: {},
      disease_risk: {}, diversity: {}, kingdom: {},
      antibiotic_recovery: null,
      probiotics: { absent: [], low_optimal: [], high_optimal: [], optimal: [], atypical_high: [] },
      probiotic_recommendations: [],
      pathogens_detected: [],
      pathogen_category_tag: null,
      pathogens_data: [],
      antibiotic_resistance: {},
      antibiotic_resistance_tag: null,
      antibiotic_recovery_tag: null,
      foundation_microbiota: [],
      dietary_rx: null,
      dietary_rx_method: null,
      dietary_rx_parsed_at: null,
      nutrition: null,
      species_list: speciesFromText,
    }
  }

  const species = reportData.species_list || speciesFromText
  const patient = buildPatientForm(reportData)

  return { species, patient, reportData, rawText: fullText }
}

export async function extractSpeciesFromPDF(file: File): Promise<string[]> {
  const result = await extractFromPDF(file)
  return result.species
}
