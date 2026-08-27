/**
 * MicrobiomeRx - Rules Engine V2
 * Deterministic. No AI in any decision.
 * Matches actual ReportData shape from extractSpecies.ts
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { translateForSupplements, translateForTherapies, translateForDietary } from './conditionMap'

export const RULES_VERSION_V2 = 'v2.0.0'

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────
export type RychTier = 1 | 2 | 3

export interface MarkerFinding {
  markername: string
  status: string
  severity: string
  priority_score: number
  condition_flagged: string
  five_r_step: string
  protocol_phase: string
  phase_1_action: string
  phase_2_action: string
  phase_3_action: string
  clinical_reasoning: string
  research_evidence: string
  contraindication_flags: string
}

export interface SupplementRecommendation {
  condition_name: string
  priority: number
  product_name: string
  aic_category: string
  dose: string
  timing: string
  duration: string
  mechanism: string
  protocol_phase: string
  notes: string
}

export interface TherapyRecommendation {
  condition_name: string
  therapy_type: string
  modality: string
  tier_indication: string
  rych_index_range: string
  frequency: string
  dosing_protocol: string
  course_length: string
  contraindication_screen: string
  stacks_with: string
  research_reference: string
  notes: string
}

export interface DietaryRecommendation {
  condition_name: string
  phase: string
  duration: string
  foods_include: string
  foods_exclude: string
  fermented_foods: string
  prebiotic_foods: string
  fibre_target: string
  hydration_target: string
  specific_instructions: string
  dietary_framework: string
}

export interface ProbioticRecommendation {
  probiotic_name: string
  strain_code: string
  probiotic_category: string
  cfu_range: string
  health_function: string
  key_mechanism: string
  contraindications: string
  protocol_phase: string
  stacks_with: string
  notes: string
}

export interface ContraindicationAlert {
  marker: string
  alert: string
  severity: 'CRITICAL' | 'WARNING'
}

export interface RulesOutputV2 {
  rules_version: string
  generated_at: string
  rych_index: number
  rych_tier: RychTier
  rych_tier_label: string
  conditions_flagged: string[]
  flagged_markers: MarkerFinding[]
  supplements: SupplementRecommendation[]
  therapies: TherapyRecommendation[]
  dietary: DietaryRecommendation[]
  probiotics: ProbioticRecommendation[]
  contraindication_alerts: ContraindicationAlert[]
  marker_count: number
  error?: string
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function getRychTier(score: number): RychTier {
  if (score < 30) return 3
  if (score <= 50) return 2
  return 1
}

function getRychTierLabel(tier: RychTier) {
  return tier === 3 ? 'Severe' : tier === 2 ? 'Moderate' : 'Mild'
}

function getRychStatus(score: number): string {
  if (score < 30)  return '< 30'
  if (score <= 50) return '30–50'
  if (score <= 70) return '50–70'
  return '> 70'
}

// Score thresholds for health indicator / SCFA / vitamin scores (0–100)
function scoreStatus(val: number | null | undefined): 'LOW' | 'HIGH' | null {
  if (val === null || val === undefined) return null
  if (val < 40) return 'LOW'
  if (val > 78) return 'HIGH'
  return null
}

interface MarkerInput {
  markername: string
  status: string
}

// ─────────────────────────────────────────────────────────────────
// MARKER EXTRACTION
// Maps the actual ReportData shape → { markername, status } pairs
// that match marker_protocol_map rows exactly
// ─────────────────────────────────────────────────────────────────
function extractFlaggedMarkers(reportData: Record<string, unknown>): MarkerInput[] {
  const flagged: MarkerInput[] = []

  // ── 1. Rych Index (top-level number) ─────────────────────────
  const rych = Number(reportData.rych_index ?? 0)
  if (rych > 0) {
    flagged.push({ markername: 'Rych Index', status: getRychStatus(rych) })
  }

  // ── 2. Antibiotic Recovery (top-level number, 0–100)
  // LOW score = LOW recovery = marker status LOW
  const ar = reportData.antibiotic_recovery as number | null
  if (ar !== null && ar !== undefined && ar < 40) {
    flagged.push({ markername: 'Antibiotic Recovery', status: 'LOW' })
  }

  // ── 3. Health Indicators (nested: health_indicators{})
  // INVERTED markers: LOW score = HIGH problem (Gut Inflammation, Leaky Gut)
  // DIRECT markers: LOW score = LOW function (Intestinal Motility etc.)
  const hi = (reportData.health_indicators ?? {}) as Record<string, number | null>

  // Inverted - LOW score means HIGH severity
  const invertedHiMap: Record<string, string> = {
    gut_inflammation: 'Gut Inflammation',
    leaky_gut:        'Leaky Gut',
  }
  for (const [key, markerName] of Object.entries(invertedHiMap)) {
    const val = hi[key]
    if (val === null || val === undefined) continue
    if (val < 40)                   flagged.push({ markername: markerName, status: 'HIGH' })
    else if (val >= 40 && val < 65) flagged.push({ markername: markerName, status: 'MODERATE' })
  }

  // Direct - LOW score means LOW function
  const directHiMap: Record<string, string> = {
    gut_motility:           'Intestinal Motility',
    histamine_tolerance:    'Histamine Intolerance',
    oxidative_stress:       'Oxidative Stress',
    liver_toxin:            'Liver Toxin Burden',
  }
  for (const [key, markerName] of Object.entries(directHiMap)) {
    const val = hi[key]
    if (val === null || val === undefined) continue
    if (val < 40) flagged.push({ markername: markerName, status: 'HIGH' })
  }

  // ── 4. SCFA (nested: scfa{butyrate, propionate, acetate}) ────
  const scfa = (reportData.scfa ?? {}) as Record<string, number | null>
  const scfaMap: Record<string, string> = {
    butyrate:   'SCFA Butyrate',
    propionate: 'SCFA Propionate',
    acetate:    'SCFA Acetate',
  }
  for (const [key, markerName] of Object.entries(scfaMap)) {
    const s = scoreStatus(scfa[key])
    if (s === 'LOW') flagged.push({ markername: markerName, status: 'LOW' })
  }

  // ── 5. Vitamins (nested: vitamins{b12, b9, k2, d, biotin}) ──
  const vit = (reportData.vitamins ?? {}) as Record<string, number | null>
  const vitMap: Record<string, string> = {
    b12:    'Vitamin B12 (Cobalamin)',
    b9:     'Vitamin B9 (Folate)',
    b6:     'Vitamin B6 (Pyridoxine)',
    b5:     'Vitamin B5 (Pantothenic Acid)',
    b3:     'Vitamin B3 (Niacin)',
    b1:     'Vitamin B1 (Thiamine)',
    k:      'Vitamin K',
    c:      'Vitamin C',
  }
  for (const [key, markerName] of Object.entries(vitMap)) {
    const s = scoreStatus(vit[key])
    if (s === 'LOW') flagged.push({ markername: markerName, status: 'LOW' })
  }

  // ── 6. Neurotransmitters (nested: neurotransmitters{}) ───────
  const nt = (reportData.neurotransmitters ?? {}) as Record<string, number | null>
  const ntMap: Record<string, string> = {
    serotonin: 'Serotonin Precursors',
    dopamine:  'Dopamine Precursors',
    gaba:      'GABA',
  }
  for (const [key, markerName] of Object.entries(ntMap)) {
    const s = scoreStatus(nt[key])
    if (s === 'LOW') flagged.push({ markername: markerName, status: 'LOW' })
  }

  // ── 7. Probiotics (absent[] / low_optimal[] arrays) ──────────
  // Any absent probiotic = LOW Probiotic Characterisation
  const probiotics = (reportData.probiotics ?? {}) as {
    absent?: string[]
    low_optimal?: string[]
    high_optimal?: string[]
    optimal?: string[]
    atypical_high?: string[]
  }
  if ((probiotics.absent ?? []).length > 0) {
    flagged.push({ markername: 'Probiotic Characterisation', status: 'LOW' })
  }

  // ── 8. Pathogens detected (array of pathogen name strings) ───
  const detected = (reportData.pathogens_detected ?? []) as string[]
  // KB1 exact pathogen marker names
  const pathogenKeywords: Record<string, string> = {
    'Candida':               'Candida / Fungal Overgrowth',
    'Fungal':                'Candida / Fungal Overgrowth',
    'Blastocystis':          'Blastocystis hominis',
    'E. coli':               'E. coli',
    'Escherichia':           'E. coli',
    'Shigella':              'Shigella',
    'Akkermansia':           'Akkermansia muciniphila',
    'Methanobrevibacter':    'Methanogenic Archaea',
    'Prevotella copri':      'Prevotella copri',
    'Antibiotic Resistance': 'Antibiotic Resistance Genes',
  }
  for (const name of detected) {
    for (const [keyword, markerName] of Object.entries(pathogenKeywords)) {
      if (name.includes(keyword)) {
        flagged.push({ markername: markerName, status: 'DETECTED' })
        break
      }
    }
  }

  // ── 9. Disease Risk (nested: disease_risk{constipation, ibd…}) ─
  const dr = (reportData.disease_risk ?? {}) as Record<string, number | null>
  // KB1 exact disease risk marker names
  const drMap: Record<string, string> = {
    constipation: 'Constipation',
    ibd:          "IBD (Crohn's / UC)",
    ibs:          'IBS',
    obesity:      'Obesity',
    diabetes:     'Type 2 Diabetes',
    nafld:        'NAFLD',
    hypertension: 'Hypertension',
  }
  for (const [key, markerName] of Object.entries(drMap)) {
    const val = dr[key]
    if (val === null || val === undefined) continue
    if (val >= 40) flagged.push({ markername: markerName, status: 'HIGH RISK' })
  }

  // Deduplicate by markername+status
  const seen = new Set<string>()
  return flagged.filter(m => {
    const key = `${m.markername}|${m.status}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─────────────────────────────────────────────────────────────────
// CONTRAINDICATION ALERTS
// ─────────────────────────────────────────────────────────────────
function buildContraindicationAlerts(
  findings: MarkerFinding[],
  reportData: Record<string, unknown>
): ContraindicationAlert[] {
  const alerts: ContraindicationAlert[] = []

  for (const f of findings) {
    if (f.contraindication_flags?.trim()) {
      alerts.push({
        marker: f.markername,
        alert: f.contraindication_flags,
        severity: f.severity === 'Severe' ? 'CRITICAL' : 'WARNING',
      })
    }
  }

  // Histamine LOW → warn about VSL#3 / L. casei / L. bulgaricus
  const hi = (reportData.health_indicators ?? {}) as Record<string, number | null>
  const histamine = hi.histamine_tolerance ?? null
  if (histamine !== null && histamine < 40) {
    alerts.push({
      marker: 'Histamine Tolerance',
      alert: 'LOW Histamine Tolerance - VSL#3, L. casei, and L. bulgaricus are CONTRAINDICATED. Use only: L. rhamnosus, B. longum, L. plantarum.',
      severity: 'CRITICAL',
    })
  }

  return alerts
}

// ─────────────────────────────────────────────────────────────────
// MAIN ENGINE
// ─────────────────────────────────────────────────────────────────
export async function runRulesEngineV2(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  reportData: Record<string, unknown>
): Promise<RulesOutputV2> {

  const rych     = Number(reportData.rych_index ?? 0)
  const tier     = getRychTier(rych)
  const tierLabel = getRychTierLabel(tier)
  const tierStr  = `Tier ${tier}`

  // Step 1 - Extract flagged markers
  const markerInputs = extractFlaggedMarkers(reportData)

  console.log(`[rulesEngineV2] Rych: ${rych} (Tier ${tier}), flagged markers: ${markerInputs.length}`)
  console.log('[rulesEngineV2] Markers:', markerInputs.map(m => `${m.markername}=${m.status}`).join(', '))

  if (markerInputs.length === 0) {
    return buildEmpty(rych, tier, tierLabel,
      'No flagged markers found. Check that report_data is fully parsed.')
  }

  // Step 2 - Query marker_protocol_map
  const markerNames = [...new Set(markerInputs.map(m => m.markername))]
  const { data: protocolRows, error: protocolError } = await supabase
    .from('marker_protocol_map')
    .select('*')
    .in('markername', markerNames)

  if (protocolError) {
    console.error('[rulesEngineV2] marker_protocol_map error:', protocolError)
    return buildEmpty(rych, tier, tierLabel, `KB query error: ${protocolError.message}`)
  }

  const flaggedMarkers: MarkerFinding[] = []
  const conditionsSet = new Set<string>()

  for (const input of markerInputs) {
    const match = (protocolRows ?? []).find(
      r =>
        r.markername?.toLowerCase().trim() === input.markername.toLowerCase().trim() &&
        r.status?.toLowerCase().trim() === input.status.toLowerCase().trim()
    )
    if (!match) {
      console.warn(`[rulesEngineV2] No KB match for: ${input.markername} | ${input.status}`)
      continue
    }

    const condition = match.condition_flagged || ''
    if (condition) conditionsSet.add(condition)

    flaggedMarkers.push({
      markername:            match.markername,
      status:                input.status,
      severity:              match.severity || 'Moderate',
      priority_score:        Number(match.priority_score) || 5,
      condition_flagged:     condition,
      five_r_step:           match['5r_step'] || '',
      protocol_phase:        match.protocol_phase || '',
      phase_1_action:        match.phase_1_action || '',
      phase_2_action:        match.phase_2_action || '',
      phase_3_action:        match.phase_3_action || '',
      clinical_reasoning:    match.clinical_reasoning || '',
      research_evidence:     match.research_evidence || '',
      contraindication_flags: match.contraindication_flags || '',
    })
  }

  // Sort by priority DESC
  flaggedMarkers.sort((a, b) => b.priority_score - a.priority_score)
  const conditionsFlagged = Array.from(conditionsSet)

  // Translate condition_flagged → correct condition_name per table
  const suppConditions    = translateForSupplements(conditionsFlagged)
  const therapyConditions = translateForTherapies(conditionsFlagged)
  const dietaryConditions = translateForDietary(conditionsFlagged)

  console.log(`[rulesEngineV2] conditions_flagged: ${conditionsFlagged.join(', ')}`)
  console.log(`[rulesEngineV2] supplement lookup: ${suppConditions.join(', ')}`)
  console.log(`[rulesEngineV2] therapy lookup: ${therapyConditions.join(', ')}`)
  console.log(`[rulesEngineV2] dietary lookup: ${dietaryConditions.join(', ')}`)

  // Step 3 - Supplements
  let supplements: SupplementRecommendation[] = []
  if (suppConditions.length > 0) {
    const { data } = await supabase
      .from('supplement_stack')
      .select('*')
      .in('condition_name', suppConditions)
      .order('supplement_priority', { ascending: true })
      supplements = (data ?? []).map(r => ({
        condition_name:  r.condition_name,
        priority:        Number(r.supplement_priority) || 99,
      
        product_name:    r.product_name,
        aic_product_name:r.aic_product_name,
        aic_match_notes: r.aic_match_notes,
      
        aic_category:    r.aic_category,
        dose:            r.dose,
        timing:          r.timing,
        duration:        r.duration,
        mechanism:       r.mechanism,
        protocol_phase:  r.protocol_phase,
        notes:           r.notes,
      }))
  }

  // Step 4 - Therapies (filtered by Rych tier)
  let therapies: TherapyRecommendation[] = []
  if (therapyConditions.length > 0) {
    const { data } = await supabase
      .from('therapy_protocols')
      .select('*')
      .in('condition_name', therapyConditions)
      .ilike('tier_indication', `%${tierStr}%`)
    therapies = (data ?? []).map(r => ({
      condition_name:         r.condition_name,
      therapy_type:           r.therapy_type,
      modality:               r.modality,
      tier_indication:        r.tier_indication,
      rych_index_range:       r.rych_index_range,
      frequency:              r.frequency,
      dosing_protocol:        r.dosing_protocol,
      course_length:          r.course_length,
      contraindication_screen: r.contraindication_screen,
      stacks_with:            r.stacks_with,
      research_reference:     r.research_reference,
      notes:                  r.notes,
    }))
  }

  // Step 5 - Dietary
  let dietary: DietaryRecommendation[] = []
  if (dietaryConditions.length > 0) {
    const { data } = await supabase
      .from('dietary_protocols')
      .select('*')
      .in('condition_name', dietaryConditions)
    dietary = (data ?? []).map(r => ({
      condition_name:       r.condition_name,
      phase:                r.phase,
      duration:             r.duration,
      foods_include:        r.foods_include,
      foods_exclude:        r.foods_exclude,
      fermented_foods:      r.fermented_foods,
      prebiotic_foods:      r.prebiotic_foods,
      fibre_target:         r.fibre_target,
      hydration_target:     r.hydration_target,
      specific_instructions: r.specific_instructions,
      dietary_framework:    r.dietary_framework,
    }))
  }

  // Step 6 - Probiotics
  let probiotics: ProbioticRecommendation[] = []
  const probioticSeen = new Set<string>()

  const addProbiotics = (rows: Record<string, unknown>[]) => {
    for (const r of rows) {
      const name = r.probiotic_name as string
      if (probioticSeen.has(name)) continue
      probioticSeen.add(name)
      probiotics.push({
        probiotic_name:     name,
        strain_code:        r.strain_code as string,
        probiotic_category: r.probiotic_category as string,
        cfu_range:          r.cfu_range as string,
        health_function:    r.health_function as string,
        key_mechanism:      r.key_mechanism as string,
        contraindications:  r.contraindications as string,
        protocol_phase:     r.protocol_phase as string,
        stacks_with:        r.stacks_with as string,
        notes:              r.notes as string,
      })
    }
  }

  for (const condition of conditionsFlagged.slice(0, 3)) {
    const { data } = await supabase
      .from('probiotic_matrix')
      .select('*')
      .ilike('bugspeaks_when_low', `%${condition}%`)
    addProbiotics(data ?? [])
  }

  if (rych < 50) {
    const { data } = await supabase
      .from('probiotic_matrix')
      .select('*')
      .ilike('bugspeaks_when_low', '%Low Rych Index%')
    addProbiotics(data ?? [])
  }

  // Step 7 - Contraindication alerts
  const contraindicationAlerts = buildContraindicationAlerts(flaggedMarkers, reportData)

  return {
    rules_version:          RULES_VERSION_V2,
    generated_at:           new Date().toISOString(),
    rych_index:             rych,
    rych_tier:              tier,
    rych_tier_label:        tierLabel,
    conditions_flagged:     conditionsFlagged,
    flagged_markers:        flaggedMarkers,
    supplements,
    therapies,
    dietary,
    probiotics,
    contraindication_alerts: contraindicationAlerts,
    marker_count:           flaggedMarkers.length,
  }
}

// ─────────────────────────────────────────────────────────────────
// METRICS EXPORT (for patient_metrics longitudinal tracking)
// ─────────────────────────────────────────────────────────────────
export function extractMetricsForTracking(
  reportData: Record<string, unknown>,
  reportDate: string
): Array<{ metric: string; value: number; report_date: string }> {
  const metrics: Array<{ metric: string; value: number; report_date: string }> = []

  const push = (metric: string, value: unknown) => {
    const n = Number(value)
    if (!isNaN(n) && n > 0) metrics.push({ metric, value: n, report_date: reportDate })
  }

  push('rych_index', reportData.rych_index)
  push('antibiotic_recovery', reportData.antibiotic_recovery)

  const hi = (reportData.health_indicators ?? {}) as Record<string, unknown>
  for (const [k, v] of Object.entries(hi)) push(`hi_${k}`, v)

  const scfa = (reportData.scfa ?? {}) as Record<string, unknown>
  for (const [k, v] of Object.entries(scfa)) push(`scfa_${k}`, v)

  const dr = (reportData.disease_risk ?? {}) as Record<string, unknown>
  for (const [k, v] of Object.entries(dr)) push(`risk_${k}`, v)

  return metrics
}

// ─────────────────────────────────────────────────────────────────
function buildEmpty(
  rych: number, tier: RychTier, tierLabel: string, error?: string
): RulesOutputV2 {
  return {
    rules_version: RULES_VERSION_V2,
    generated_at: new Date().toISOString(),
    rych_index: rych, rych_tier: tier, rych_tier_label: tierLabel,
    conditions_flagged: [], flagged_markers: [],
    supplements: [], therapies: [], dietary: [], probiotics: [],
    contraindication_alerts: [], marker_count: 0, error,
  }
}
