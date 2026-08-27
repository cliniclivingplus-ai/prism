// lib/matchClpTreatments.ts
// Deterministic rules-based matcher - never uses AI.
// Maps key_findings + disease_risk from the rules engine to CLP treatment entries.

import { CLP_TREATMENTS, ClpTreatment } from './clpTreatments'

export type MatchedTreatment = ClpTreatment & {
  /** Snippets from findings/disease risk that triggered this match */
  triggered_by: string[]
  /** 0–1 relevance score used to sort results */
  relevance: number
}

/** Fields from the rules engine output that we search against */
interface MatchInput {
  key_findings?: Array<{ finding: string; category: string; severity: string }>
  disease_risk?: Record<string, number>   // { "IBD": 40.9, "Constipation": 22.3, … }
  enterotype?: string | null
  summary?: string
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
}

export function matchClpTreatments(input: MatchInput): MatchedTreatment[] {
  // Build a searchable corpus from all inputs
  const findingTexts: string[] = [
    ...(input.key_findings?.map(f => `${f.finding} ${f.category}`) ?? []),
    ...(input.enterotype ? [input.enterotype] : []),
    ...(input.summary ? [input.summary] : []),
  ]
  const diseaseRisk: Record<string, number> = input.disease_risk ?? {}

  const results: MatchedTreatment[] = []

  for (const treatment of CLP_TREATMENTS) {
    const triggers: string[] = []
    let score = 0

    // 1 - Match against key_findings text
    for (const findingText of findingTexts) {
      const norm = normalise(findingText)
      for (const key of treatment.match_keys) {
        if (norm.includes(normalise(key))) {
          // Avoid duplicate trigger messages
          const label = findingText.length > 80 ? findingText.slice(0, 80) + '…' : findingText
          if (!triggers.includes(label)) {
            triggers.push(label)
            score += 1
          }
        }
      }
    }

    // 2 - Match against disease risk labels (higher risk % = higher relevance boost)
    for (const [disease, riskPct] of Object.entries(diseaseRisk)) {
      const normDisease = normalise(disease)
      for (const key of treatment.match_keys) {
        if (normDisease.includes(normalise(key)) || normalise(key).includes(normDisease)) {
          const label = `${disease} risk: ${riskPct.toFixed(1)}%`
          if (!triggers.includes(label)) {
            triggers.push(label)
            // Weight by risk percentage (0–100 → 0–2 pts)
            score += Math.min(riskPct / 50, 2)
          }
        }
      }
    }

    // 3 - Tier boost so urgent conditions rank higher when matched
    if (triggers.length > 0) {
      if (treatment.tier === 'urgent') score += 1.5
      else if (treatment.tier === 'monitor') score += 0.75

      results.push({
        ...treatment,
        triggered_by: triggers,
        relevance: score,
      })
    }
  }

  // Sort by relevance descending
  return results.sort((a, b) => b.relevance - a.relevance)
}
