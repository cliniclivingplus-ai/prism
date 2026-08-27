/**
 * lib/extractFoundationMicrobiota.ts
 */

export interface FoundationSpecies {
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

function isScientificName(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 60 || /\d/.test(t)) return false
  const words = t.split(/\s+/)
  if (words.length < 2 || words.length > 4) return false
  return /^[A-Z][a-z]{2,25}$/.test(words[0]) && /^[a-z]{3,30}$/.test(words[1])
}

function parseNumbers(line: string): number[] {
  return line
    .split(/\s+/)
    .map(t => parseFloat(t))
    .filter(n => !isNaN(n) && isFinite(n) && n >= 0)
}

function deriveStatus(
  value: number,
  refLow: number,
  refHigh: number
): 'low' | 'normal' | 'high' {
  if (value < refLow) return 'low'
  if (value > refHigh) return 'high'
  return 'normal'
}

export function extractFoundationMicrobiota(pdfText: string): FoundationSpecies[] {
  console.log('[FM] Starting extraction, text length:', pdfText.length)

  // ── 1. Find section using the fixed descriptive sentence as anchor ─────────
  // This sentence ALWAYS appears at the start of the Foundation Microbiota
  // section in BugSpeaks reports, making it the most reliable anchor.
  const ANCHOR = /Perturbations of these keystone species can have large effects[\s\S]{0,200}Handbook Page No\.\s*18\)/i

  const anchorMatch = pdfText.match(ANCHOR)

  if (!anchorMatch) {
    console.warn('[FM] Anchor sentence not found - trying heading fallback')
  }

  // Start extracting from right after the anchor sentence
  const startIdx = anchorMatch
    ? anchorMatch.index! + anchorMatch[0].length
    : pdfText.search(/FOUNDATION\s+MICROBIOTA/i)

  if (startIdx === -1) {
    console.warn('[FM] Section not found at all')
    return []
  }

  // End at the next major section heading or at most 6000 chars
  const chunk     = pdfText.slice(startIdx, startIdx + 6000)
  const endMatch  = chunk.search(
    /\n(?:PROBIOTIC|PATHOGEN|ANTIBIOTIC|DIVERSITY|SCFA|VITAMIN|NEURO|DISEASE|HEALTH|KINGDOM|Summary Report)/i
  )
  const sectionText = endMatch !== -1 ? chunk.slice(0, endMatch) : chunk

  console.log('[FM] Section isolated, length:', sectionText.length)

  // ── 2. Walk lines and extract species ─────────────────────────────────────
  const lines = sectionText.split('\n').map(l => l.trim()).filter(Boolean)
  console.log('[FM] Lines in section:', lines.length)

  const results: FoundationSpecies[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!isScientificName(line)) { i++; continue }

    const words = line.split(/\s+/).filter(w => /^[A-Za-z]+$/.test(w))
    const name  = words.slice(0, words.length >= 3 ? 3 : 2).join(' ')

    let patientValue: number | null = null
    let boundaries:   number[] | null = null

    // Pattern A: patient value is on the line BEFORE the species name
    // pdfjs renders the highlighted bar label before the text layer
    if (i > 0) {
      const prev = parseNumbers(lines[i - 1])
      if (prev.length === 1) patientValue = prev[0]
    }

    // Look ahead up to 5 lines for boundary row + patient value (Pattern B)
    for (let j = 1; j <= 5 && i + j < lines.length; j++) {
      const ahead = lines[i + j]
      if (isScientificName(ahead)) break

      const nums = parseNumbers(ahead)

      if (nums.length === 6 && !boundaries) {
        boundaries = nums
        break
      }
      if (nums.length === 7 && !boundaries) {
        if (!patientValue) patientValue = nums[0]
        boundaries = nums.slice(1)
        break
      }
      if (nums.length === 1 && !patientValue) {
        patientValue = nums[0]
      }
    }

    if (boundaries && patientValue !== null) {
      const [min, p25, ref_low, ref_high, p75, max] = boundaries
      if (min <= max && ref_low <= ref_high) {
        const status = deriveStatus(patientValue, ref_low, ref_high)
        results.push({ name, patient_value: patientValue, min, p25, ref_low, ref_high, p75, max, status })
        console.log(`[FM] ✓ ${name} → ${patientValue} (${status})`)
      }
    } else {
      console.log(`[FM] ✗ ${name} - patient:${patientValue} boundaries:${JSON.stringify(boundaries)}`)
    }

    i++
  }

  console.log('[FM] Total extracted:', results.length)
  return results
}
