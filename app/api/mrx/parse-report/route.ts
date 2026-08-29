import { NextRequest, NextResponse } from 'next/server'
import { groqChatCompletion } from '@/lib/groq'
import {
  hasDietarySection,
  extractDietaryFromOperatorList,
  extractDietaryViaGroq,
  sanitiseDietaryRx,
} from '@/lib/mrx/extractDietaryRx'
import { extractNutritionFromPages } from '@/lib/mrx/extractNutrition'
import { extractFoundationMicrobiota } from '@/lib/mrx/ExtractFoundationmicrobiota'
import { extractAbundantSpecies } from '@/lib/mrx/extractAbundantSpecies'



function extractScoreBefore(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`(\\d+\\.?\\d*)\\s*\\n\\s*${escaped}`, 'i'))
  return match ? parseFloat(match[1]) : null
}

function extractPercentAfter(text: string, label: string): number | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`${escaped}\\s+(\\d+\\.?\\d*)%`, 'i'))
  return match ? parseFloat(match[1]) : null
}

// ── Pathogen extraction ───────────────────────────────────────────────────────

export interface PathogenSpecies {
  name: string; patient_value: number; min: number; p25: number
  ref_low: number; ref_high: number; p75: number; max: number
  status: 'low' | 'normal' | 'high'
}

function isPathogenName(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 60 || /\d/.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 4) return false
  return /^[A-Z][a-z]{2,25}$/.test(words[0]) && /^[a-z]{3,30}$/.test(words[1])
}

function parseNums(line: string): number[] {
  return line.split(/\s+/).map(t => parseFloat(t)).filter(n => !isNaN(n) && isFinite(n) && n >= 0)
}

function extractPathogenData(text: string): PathogenSpecies[] {
  const ANCHORS = [
    /Pathogen Characterization\s+BugSpeaks[\s\S]{0,300}Handbook Page No\.\s*21\)/i,
    /BugSpeaks[\s\S]{0,50}identifies and characterizes many pathogens[\s\S]{0,200}Handbook Page No\.\s*21\)/i,
    /PATHOGEN\s+CHARACTERIZATION/i,
  ]
  let startIdx = -1
  for (const p of ANCHORS) {
    const m = text.match(p)
    if (m?.index !== undefined) { startIdx = m.index + m[0].length; break }
  }
  if (startIdx === -1) { console.warn('[Pathogens] Anchor not found'); return [] }

  const chunk = text.slice(startIdx, startIdx + 15000)
  const endIdx = chunk.search(/\n(?:ANTIBIOTIC|PROBIOTIC|FOUNDATION|DIVERSITY|SCFA|VITAMIN|Summary Report)/i)
  const section = endIdx !== -1 ? chunk.slice(0, endIdx) : chunk
  console.log('[Pathogens] Section length:', section.length)

  const lines = section.split('\n').map((l: string) => l.trim()).filter(Boolean)
  const results: PathogenSpecies[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!isPathogenName(line)) { i++; continue }
    const words = line.split(/\s+/).filter((w: string) => /^[A-Za-z]+$/.test(w))
    const name = words.slice(0, words.length >= 3 ? 3 : 2).join(' ')
    let patientValue: number | null = null
    let boundaries: number[] | null = null
    if (i > 0) { const prev = parseNums(lines[i - 1]); if (prev.length === 1) patientValue = prev[0] }
    for (let j = 1; j <= 5 && i + j < lines.length; j++) {
      const ahead = lines[i + j]
      if (isPathogenName(ahead)) break
      const nums = parseNums(ahead)
      if (nums.length === 6 && !boundaries) { boundaries = nums; break }
      if (nums.length === 7 && !boundaries) { if (!patientValue) patientValue = nums[0]; boundaries = nums.slice(1); break }
      if (nums.length === 1 && !patientValue) patientValue = nums[0]
    }
    if (boundaries && patientValue !== null) {
      const [min, p25, ref_low, ref_high, p75, max] = boundaries
      if (min <= max && ref_low <= ref_high) {
        const status = patientValue < ref_low ? 'low' : patientValue > ref_high ? 'high' : 'normal'
        results.push({ name, patient_value: patientValue, min, p25, ref_low, ref_high, p75, max, status })
      }
    }
    i++
  }
  console.log('[Pathogens] Total extracted:', results.length)
  return results
}

function extractPathogenCategoryTag(text: string): string | null {
  const m = text.match(/Pathogen Characterization[\s\S]{0,300}(Ideal|Average|Below Average|Above Average|Non-Ideal)/i)
  return m ? m[1] : null
}

// ── Antibiotic extraction ─────────────────────────────────────────────────────

const KNOWN_ANTIBIOTICS = [
  'Amikacin','Aminocoumarin','Amoxicillin','Amoxicillin+Clavulanic_Acid',
  'Ampicillin','Ampicillin+Clavulanic_Acid','Avilamycin','Azithromycin',
  'Aztreonam','Benzalkonium_Chloride','Bicyclomycin','Bleomycin',
  'Carbapenem','Carbomycin','Cefepime','Cefixime','Cefotaxime',
  'Cefotaxime+Clavulanic_Acid','Cefoxitin','Ceftazidime',
  'Ceftazidime+Avibactam','Ceftriaxone','Cephalothin','Cephamycin',
  'Ciprofloxacin','Clindamycin','Colistin','Dalfopristin',
  'Diaminopyrimidine','Doxycycline','Elfamycin','Ertapenem',
  'Erythromycin','Florfenicol','Fosfomycin','Fusidic_Acid',
  'Gentamicin','Glycylcycline','Hygromycin','Imipenem','Isoniazid',
  'Kanamycin','Kasugamycin','Lincomycin','Lincosamide','Linezolid',
  'Meropenem','Methicillin','Minocycline','Monobactam','Mupirocin',
  'Nalidixic_Acid','Nitrofuran','Nitroimidazole','Oleandomycin',
  'Penicillin','Phenicol','Piperacillin','Piperacillin+Tazobactam',
  'Pleuromutilin','Pristinamycin','Quinupristin','Quinupristin+Dalfopristin',
  'Rhodamine','Rifampin','Rifamycin','Spectinomycin','Spiramycin',
  'Streptomycin','Streptothricin','Sulfamethoxazole','Teicoplanin',
  'Telithromycin','Temocillin','Tetracenomycin','Tetracycline',
  'Thiostrepton','Tiamulin','Ticarcillin','Ticarcillin+Clavulanic_Acid',
  'Tigecycline','Tobramycin','Triclosan','Trimethoprim','Tylosin',
  'Vancomycin','Viomycin','Virginiamycin_M','Virginiamycin_S','Zorbamycin',
]

/**
 * Word-position based extraction.
 *
 * FIX: Sort antibiotic names longest-first so combo drugs like
 * Cefotaxime+Clavulanic_Acid are matched before their base name Cefotaxime.
 * Reconstruct the full name from consecutive words on the row before claiming
 * a match, and mark those word indices as claimed so the base name can't
 * re-match the same words.
 */
function parseAntibioticResistanceFromPages(
  pages: { text: string; words: any[] }[]
): Record<string, string> {
  const result: Record<string, string> = {}
  const STATUS_RE = /^(Sensitive|Susceptible|Resistant)$/i

  // Sort longest-first so combo drugs (e.g. Cefotaxime+Clavulanic_Acid)
  // are matched before their base names (e.g. Cefotaxime)
  const sortedAntibiotics = [...KNOWN_ANTIBIOTICS].sort((a, b) => b.length - a.length)

  // Select only actual resistance table pages - they have 8+ known antibiotics.
  // Other sections (pathogens, notes) mention at most 1-3 antibiotic names.
  const resistancePages = pages.filter(page => {
    if (!page.words?.length) return false
    if (!page.text.includes('Sensitive') && !page.text.includes('Resistant')) return false
    const count = KNOWN_ANTIBIOTICS.filter(ab => page.text.includes(ab)).length
    return count >= 8
  })

  console.log('[Antibiotics] Resistance table pages found:', resistancePages.length)

  for (const page of resistancePages) {
    console.log('[Antibiotics] Processing page, words:', page.words.length)

    // Group words into rows by y-coordinate using a 6px bucket.
    const rowMap = new Map<number, any[]>()
    for (const w of page.words) {
      const key = Math.round(w.top / 6) * 6
      if (!rowMap.has(key)) rowMap.set(key, [])
      rowMap.get(key)!.push(w)
    }

    // Sort rows top-to-bottom
    const sortedRows = Array.from(rowMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, words]) => words.sort((a: any, b: any) => a.x0 - b.x0))

    for (let rowIdx = 0; rowIdx < sortedRows.length; rowIdx++) {
      const rowWords = sortedRows[rowIdx]

      // Track word indices already claimed by a longer match on this row
      // so the base name can't steal words already used by a combo drug
      const claimedIndices = new Set<number>()

      for (const ab of sortedAntibiotics) {
        let abWord: any = null

        // Reconstruct the full antibiotic name from consecutive words on the row.
        // This is required because pdfjs sometimes splits "Cefotaxime+Clavulanic_Acid"
        // across multiple word tokens.
        outer:
        for (let i = 0; i < rowWords.length; i++) {
          if (claimedIndices.has(i)) continue

          let reconstructed = ''
          for (let j = i; j < rowWords.length && reconstructed.length <= ab.length + 5; j++) {
            reconstructed += rowWords[j].text

            if (reconstructed.toLowerCase() === ab.toLowerCase()) {
              // Full name matched - claim the anchor word and all used indices
              abWord = rowWords[i]
              for (let k = i; k <= j; k++) claimedIndices.add(k)
              break outer
            }

            // Early exit: reconstructed can no longer be a prefix of ab
            if (!ab.toLowerCase().startsWith(reconstructed.toLowerCase())) break
          }
        }

        if (!abWord) continue

        // Search current row + next 2 rows for status badge to the right.
        // Handles cases where name and badge are at slightly different y.
        let found = false
        for (let k = rowIdx; k <= Math.min(rowIdx + 2, sortedRows.length - 1) && !found; k++) {
          const sw = sortedRows[k].find((w: any) =>
            STATUS_RE.test(w.text) && w.x0 > abWord.x0
          )
          if (sw) {
            const raw = sw.text
            const status = raw.toLowerCase() === 'susceptible' ? 'Sensitive' : raw
            if (!result[ab] || status === 'Resistant') {
              result[ab] = status
              if (status === 'Resistant') console.log(`[Antibiotics] RESISTANT: ${ab}`)
            }
            found = true
          }
        }
      }
    }
  }

  const rc = Object.values(result).filter(v => v === 'Resistant').length
  console.log('[Antibiotics] Word-position entries:', Object.keys(result).length, '| Resistant:', rc)
  return result
}

function isolateAntibioticSection(text: string): string {
  const ANCHORS = [
    /Antibiotic Recovery Potential[\s\S]{0,300}Handbook Page No\.\s*21\)/i,
    /Antibiotics are known to disrupt the microbiota ecosystem dramatically[\s\S]{0,300}Handbook Page No\.\s*21\)/i,
    /ANTIBIOTIC\s+RESISTANCE[\s\S]{0,20}RECOVERY/i,
    /Antibiotic Resistance[\s\S]{0,200}Handbook Page No\.\s*21\)/i,
  ]
  for (const anchor of ANCHORS) {
    const m = text.match(anchor)
    if (m?.index !== undefined) {
      const chunk = text.slice(m.index, m.index + 18000)
      const end = chunk.search(/\n(?:PROBIOTIC|PATHOGEN|FOUNDATION|DIVERSITY|SCFA|VITAMIN|NEURO|DISEASE|HEALTH|KINGDOM|Summary Report)/i)
      const section = end !== -1 ? chunk.slice(0, end) : chunk
      console.log('[Antibiotics] Section found, length:', section.length)
      return section
    }
  }
  console.warn('[Antibiotics] Anchor not found - using full text')
  return text
}

function extractAntibioticResistance(
  text: string,
  pages?: { text: string; words: any[] }[]
): Record<string, string> {
  // Primary: word-position based (accurate for 2-column table)
  if (pages?.length) {
    const fromPages = parseAntibioticResistanceFromPages(pages)
    if (Object.keys(fromPages).length > 0) return fromPages
  }
  // Fallback: text-based (same-line or next-line only)
  // Sort longest-first here too so combo drugs match before base names
  const sortedAntibiotics = [...KNOWN_ANTIBIOTICS].sort((a, b) => b.length - a.length)
  const section = isolateAntibioticSection(text)
  const search = section.length > 5000 ? section : text
  const result: Record<string, string> = {}
  for (const ab of sortedAntibiotics) {
    const esc = ab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = search.match(new RegExp(`${esc}[^\\n]*(Sensitive|Susceptible|Resistant)`, 'i'))
      || search.match(new RegExp(`${esc}[ \\t]*[\\r\\n]+[ \\t]*(Sensitive|Susceptible|Resistant)`, 'i'))
    if (m) {
      const raw = m[1] || m[2] || ''
      result[ab] = raw.toLowerCase() === 'susceptible' ? 'Sensitive' : raw
    }
  }
  console.log('[Antibiotics] Text-fallback entries:', Object.keys(result).length)
  return result
}

function extractAntibioticResistanceCategoryTag(text: string): string | null {
  const section = isolateAntibioticSection(text)
  const m = section.match(/Antibiotic Resistance[\s\S]{0,400}(Ideal|Average|Below Average|Above Average|Non-Ideal)/i)
  return m ? m[1] : null
}

function extractAntibioticRecoveryCategoryTag(text: string): string | null {
  const section = isolateAntibioticSection(text)
  const m = section.match(/(?:Microbiota Recovery|Antibiotic Recovery)[\s\S]{0,300}(Ideal|Average|Below Average|Above Average|Non-Ideal)/i)
  return m ? m[1] : null
}

function extractAntibioticRecoveryScore(text: string): number | null {
  const section = isolateAntibioticSection(text)
  const a = section.match(/(\d{2,3}\.\d{3})\s*\n\s*Antibiotic Recovery Potential/i)
  if (a) { console.log('[Antibiotics] Score (before label):', a[1]); return parseFloat(a[1]) }
  const b = section.match(/Antibiotic Recovery Potential\s*\n\s*(\d{2,3}\.\d{3})/i)
  if (b) { console.log('[Antibiotics] Score (after label):', b[1]); return parseFloat(b[1]) }
  const c = section.match(/Antibiotic Recovery Potential\s+(\d{2,3}\.\d{3})/i)
  if (c) { console.log('[Antibiotics] Score (inline):', c[1]); return parseFloat(c[1]) }
  const idx65 = section.indexOf('65.14')
  if (idx65 !== -1) {
    const before = section.slice(Math.max(0, idx65 - 500), idx65)
    const all = [...before.matchAll(/(\d{2,3}\.\d{3})/g)]
    if (all.length > 0) {
      const last = all[all.length - 1][1]
      console.log('[Antibiotics] Score (before 65.14):', last)
      return parseFloat(last)
    }
  }
  console.warn('[Antibiotics] Recovery score not found')
  return null
}

// ── Scores ────────────────────────────────────────────────────────────────────

function parseScores(text: string) {
  const nameMatch       = text.match(/Name:\s*([^\n]+?)\s*Sample Collection/m)
  const ageMatch        = text.match(/Age:\s*(\d+)\s*Yrs/i)
  const genderMatch     = text.match(/Gender:\s*(Male|Female)/i)
  const idMatch         = text.match(/ID:\s*([A-Z0-9]+)/i)
  const collectionMatch = text.match(/Sample Collection Date:\s*(\d{4}-\d{2}-\d{2})/i)
  const reportMatch     = text.match(/Report Generated Date:\s*(\d{4}-\d{2}-\d{2})/i)
  const rychMatch       = text.match(/YOUR SCORE\s*\n\s*(\d+)\s*\n\s*0\s+20/i)
  const rychFallback    = text.match(/Rych Index[^\n]*\n\s*(\d+(?:\.\d+)?)\s*\n/i)
  return {
    patient: {
      name:            nameMatch?.[1]?.trim() || null,
      age:             ageMatch?.[1] || null,
      gender:          genderMatch?.[1] || null,
      sample_id:       idMatch?.[1] || null,
      collection_date: collectionMatch?.[1] || null,
      report_date:     reportMatch?.[1] || null,
    },
    rych_index: rychMatch ? parseFloat(rychMatch[1]) : rychFallback ? parseFloat(rychFallback[1]) : null,
    scfa: {
      acetate: extractScoreBefore(text, 'Acetate'), propionate: extractScoreBefore(text, 'Propionate'),
      butyrate: extractScoreBefore(text, 'Butyrate'), isobutyric_acid: extractScoreBefore(text, 'Isobutyric acid'),
      valeric_acid: extractScoreBefore(text, 'Valeric acid'), isovaleric_acid: extractScoreBefore(text, 'Isovaleric acid'),
      methylbutyric_acid: extractScoreBefore(text, '2-Methylbutyric acid'),
      formate: extractScoreBefore(text, 'Formate'), caproate: extractScoreBefore(text, 'Caproate'),
    },
    vitamins: {
      b1: extractScoreBefore(text, 'Vitamin B1'), b2: extractScoreBefore(text, 'Vitamin B2'),
      b3: extractScoreBefore(text, 'Vitamin B3'), b5: extractScoreBefore(text, 'Vitamin B5'),
      b6: extractScoreBefore(text, 'Vitamin B6'), b7: extractScoreBefore(text, 'Vitamin B7'),
      b9: extractScoreBefore(text, 'Vitamin B9'), b12: extractScoreBefore(text, 'Vitamin B12'),
      c: extractScoreBefore(text, 'Vitamin C'),
    },
    neurotransmitters: {
      acetylcholine: extractScoreBefore(text, 'Acetylcholine'), dopamine: extractScoreBefore(text, 'Dopamine'),
      epinephrine: extractScoreBefore(text, 'Epinephrine'), gaba: extractScoreBefore(text, 'GABA'),
      glutamate: extractScoreBefore(text, 'Glutamate'), histamine: extractScoreBefore(text, 'Histamine'),
      norepinephrine: extractScoreBefore(text, 'Norepinephrine'), serotonin: extractScoreBefore(text, 'Serotonin'),
      tryptamine: extractScoreBefore(text, 'Tryptamine'), tryptophan: extractScoreBefore(text, 'Tryptophan'),
    },
    macronutrients: {
      carbohydrate: extractScoreBefore(text, 'Carbohydrate Metabolism Potential'),
      fat: extractScoreBefore(text, 'Fat Metabolism Potential'),
      protein: extractScoreBefore(text, 'Protein Metabolism Potential'),
    },
    gut_function: {
      intestinal_motility: extractScoreBefore(text, 'Intestinal Motility Potential'),
      mineral_bioavailability: extractScoreBefore(text, 'Mineral Bioavailability Potential'),
    },
    intolerance: {
      lactose: extractScoreBefore(text, 'Lactose Intolerance Management'),
      fructose: extractScoreBefore(text, 'Fructose Intolerance Management'),
      gluten: extractScoreBefore(text, 'Gluten Intolerance Management'),
      histamine_sensitivity: extractScoreBefore(text, 'Histamine Sensitivity Management'),
    },
    endurance: {
      aerobic: extractScoreBefore(text, 'Aerobic Endurance Potential'),
      physical: extractScoreBefore(text, 'Physical Endurance Potential'),
    },
    health_indicators: {
      microplastic: extractScoreBefore(text, 'Microplastic Exposure Indicator'),
      fatigue: extractScoreBefore(text, 'Prone to Fatigue'),
      gut_inflammation: extractScoreBefore(text, 'Potential Gut Inflammation'),
      leaky_gut: extractScoreBefore(text, 'Leaky Gut Potential'),
      tmao: extractScoreBefore(text, 'TMAO Production Potential'),
    },
    disease_risk: {
      constipation: extractPercentAfter(text, 'Constipation'),
      ibs: extractPercentAfter(text, 'Irritable Bowel Syndrome'),
      type2_diabetes: extractPercentAfter(text, 'Type 2 Diabetes'),
      hypertension: extractPercentAfter(text, 'Hypertension'),
      nafld: extractPercentAfter(text, 'Non-alcoholic Fatty Liver Disease'),
      rheumatoid_arthritis: extractPercentAfter(text, 'Rheumatoid Arthritis'),
      obesity: extractPercentAfter(text, 'Obesity'),
      ibd: extractPercentAfter(text, 'Inflammatory Bowel Disease'),
    },
    diversity: { shannon: extractScoreBefore(text, 'Shannon Diversity') },
    kingdom: {
      bacteria: extractScoreBefore(text, 'Bacteria'), archaea: extractScoreBefore(text, 'Archaea'),
      fungi: extractScoreBefore(text, 'Fungi'), eukaryota: extractScoreBefore(text, 'Eukaryota [Protozoa & Metazoa]'),
      viruses: extractScoreBefore(text, 'Viruses'),
    },
    antibiotic_recovery: extractAntibioticRecoveryScore(text),
  }
}

// ── Probiotics ────────────────────────────────────────────────────────────────

function parseProbioticSummary(pages: { text: string; words: any[] }[]): {
  absent: string[]; low_optimal: string[]; high_optimal: string[]
  optimal: string[]; atypical_high: string[]
} | null {
  for (const page of pages) {
    if (!page.text.includes('Probiotic Supplementation Summary')) continue
    const result = { absent: [] as string[], low_optimal: [] as string[], high_optimal: [] as string[], optimal: [] as string[], atypical_high: [] as string[] }
    const lineMap = new Map<number, any[]>()
    for (const w of page.words) {
      const y = Math.round(w.top / 4) * 4
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push(w)
    }
    let col2Category: 'low_optimal' | 'high_optimal' | 'atypical_high' = 'low_optimal'
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => a - b)
    for (const y of sortedYs) {
      const lw = lineMap.get(y)!.sort((a, b) => a.x0 - b.x0)
      const lineText = lw.map((w: any) => w.text).join(' ')
      if (lineText.includes('High') && lineText.includes('Optimal') && lw.some((w: any) => w.text === 'High' && w.x0 < 400)) col2Category = 'high_optimal'
      if (lineText.includes('Atypical')) col2Category = 'atypical_high'
      let i = 0
      while (i < lw.length) {
        const w = lw[i]; const x = w.x0; const t = w.text
        const NON_PROBIOTIC = new Set([
          'Pill','Follow','Avoid','Continue','Low','High','Optimal','Atypical',
          'Absent','Supplementation','Needed','Recommendations','Handbook',
          'Page','Note','Begin','Start','Stop','Take','Use','Add','Try','Help'
        ])
        if (/^[A-Z][a-z]{2,}$/.test(t) && !NON_PROBIOTIC.has(t) && i + 1 < lw.length && /^[a-z]{3,}$/.test(lw[i + 1]?.text || '')) {
          const parts = [t]; let j = i + 1
          while (j < lw.length) {
            const nw = lw[j]
            if (Math.abs(nw.x0 - x) < 220 && /^[a-z]{2,}$/.test(nw.text)) { parts.push(nw.text); j++ } else break
          }
          const species = parts.join(' ')
          if (x < 200) result.absent.push(species)
          else if (x < 405) { if (col2Category === 'high_optimal') result.high_optimal.push(species); else result.low_optimal.push(species) }
          else { if (col2Category === 'atypical_high') result.atypical_high.push(species); else result.optimal.push(species) }
          i = j
        } else i++
      }
    }
    return result
  }
  return null
}

// ── Dietary Rx ────────────────────────────────────────────────────────────────

async function parseDietaryRx(pages: Array<{ text: string; words: any[]; operatorList?: any }>, fullText: string): Promise<{ categories: any[]; method: string } | null> {
  try {
    if (!hasDietarySection(fullText)) return null
    if (pages?.length) {
      const opResult = extractDietaryFromOperatorList(pages)
      if (opResult && opResult.length >= 3) return { categories: sanitiseDietaryRx(opResult), method: 'operator_list' }
    }
    if (!process.env.GROQ_API_KEY) return null
    const groqResult = await extractDietaryViaGroq(fullText)
    if (groqResult.length >= 3) return { categories: groqResult, method: 'groq_70b' }
    return null
  } catch (e) {
    console.warn('[parse-report] dietary_rx failed:', e)
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { text, pages } = await req.json()

    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 })

    const scoresData = parseScores(text)

    let probiotics = null
    if (pages && Array.isArray(pages)) probiotics = parseProbioticSummary(pages)

    let speciesList: string[] = []
    try {
      const res = await groqChatCompletion({
        model: 'openai/gpt-oss-20b', max_tokens: 2000, temperature: 0,
        messages: [
          { role: 'system', content: 'Extract ALL microbial species names from this gut microbiome report. Include bacteria, fungi, archaea. Use genus + species format. Return ONLY: { "species": ["species 1", "species 2", ...] } No duplicates.' },
          { role: 'user', content: text.slice(0, 20000) },
        ],
        response_format: { type: 'json_object' },
      })
      speciesList = JSON.parse(res.choices[0]?.message?.content || '{}').species || []
    } catch { speciesList = [] }

    const foundation_microbiota   = extractFoundationMicrobiota(text)
    const abundant_species        = extractAbundantSpecies(text, pages ?? [])
    const pathogens_data          = extractPathogenData(text)
    const pathogensDetected       = pathogens_data.map(p => p.name)
    const pathogenCategoryTag     = extractPathogenCategoryTag(text)
    const antibioticResistance    = extractAntibioticResistance(text, pages ?? [])
    const antibioticResistanceTag = extractAntibioticResistanceCategoryTag(text)
    const antibioticRecoveryTag   = extractAntibioticRecoveryCategoryTag(text)
    const dietaryResult           = await parseDietaryRx(pages ?? [], text)
    const nutrition               = pages?.length ? extractNutritionFromPages(pages) : null

    const finalData = {
      ...scoresData,
      species_list:              speciesList,
      probiotics:                probiotics || { absent: [], low_optimal: [], high_optimal: [], optimal: [], atypical_high: [] },
      pathogens_detected:        pathogensDetected,
      pathogens_data,
      pathogen_category_tag:     pathogenCategoryTag,
      antibiotic_resistance:     antibioticResistance,
      antibiotic_resistance_tag: antibioticResistanceTag,
      antibiotic_recovery_tag:   antibioticRecoveryTag,
      probiotic_recommendations: [],
      dietary_rx:                dietaryResult?.categories ?? null,
      dietary_rx_parsed_at:      dietaryResult ? new Date().toISOString() : null,
      dietary_rx_method:         dietaryResult?.method ?? null,
      nutrition,
      foundation_microbiota,
      abundant_species,
    }

    return NextResponse.json({ data: finalData })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('parse-report error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
