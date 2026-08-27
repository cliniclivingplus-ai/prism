// ─────────────────────────────────────────────────────────────────────────────
// Rules Engine v1.1.0
// - Thresholds loaded from Supabase reference_ranges table
// - Contraindications checked from DB
// - Enterotype detection is abundance-weighted
// - All findings versioned
// ─────────────────────────────────────────────────────────────────────────────

export const RULES_VERSION = 'v1.1.0'
export const PARSER_VERSION = 'v1.0.0'

export type Finding = {
  category: string
  finding: string
  severity: 'low' | 'moderate' | 'high'
  confidence: number
  confidence_source: 'threshold_distance' | 'validated_clinical_rule' | 'population_study'
  value: number | null
  threshold_low: number
  threshold_high: number
  metric: string
  pmids: string[]
}

export type SupplementTrigger = {
  supplement_name: string
  triggered_by: string
  evidence_level: 'strong' | 'moderate' | 'emerging'
  contraindicated_with: string[]
}

export type DietRule = {
  action: 'increase' | 'reduce'
  food: string
  indian_name: string | null
  reason: string
  frequency: string
  triggered_by: string
}

export type SpeciesAbundance = {
  species_name: string
  genus: string
  relative_abundance: number
}

export type EnterotypeResult = {
  enterotype: string | null
  reason: string | null
  dominant_genus: string | null
  dominant_abundance: number | null
  method: 'abundance_weighted' | 'species_count' | 'indeterminate'
}

export type RulesOutput = {
  version: string
  parser_version: string
  findings: Finding[]
  supplement_triggers: SupplementTrigger[]
  diet_rules: DietRule[]
  enterotype_result: EnterotypeResult
  generated_at: string
}

export type ReferenceRange = {
  metric: string
  category: string
  low: number
  high: number
  pmids: string[]
}

// ─── ABUNDANCE-WEIGHTED ENTEROTYPE DETECTION ─────────────────────────────────
// Uses actual relative_abundance values from report if available
// Falls back to species count method if abundance data not available
export function detectEnterotype(
  speciesAbundances: SpeciesAbundance[],
  speciesListFallback: string[] = []
): EnterotypeResult {

  // ── Method 1: Abundance-weighted (preferred) ─────────────────────────────
  if (speciesAbundances && speciesAbundances.length > 0) {
    const genusAbundance: Record<string, number> = {}
    let totalAbundance = 0

    speciesAbundances.forEach(s => {
      const genus = s.genus || s.species_name.split(' ')[0]
      const abundance = s.relative_abundance || 0
      genusAbundance[genus] = (genusAbundance[genus] || 0) + abundance
      totalAbundance += abundance
    })

    if (totalAbundance > 0) {
      // Convert to percentages
      const genusPct: Record<string, number> = {}
      Object.entries(genusAbundance).forEach(([genus, total]) => {
        genusPct[genus] = (total / totalAbundance) * 100
      })

      // Sort by abundance
      const sorted = Object.entries(genusPct).sort((a, b) => b[1] - a[1])
      const [topGenus, topPct] = sorted[0] || ['', 0]

      const ENTEROTYPE_MAP: Record<string, { label: string; description: string }> = {
        Prevotella: {
          label: 'Prevotella',
          description: 'Prevotella-dominant enterotype. Associated with plant-rich, high-fibre diets common in South Asian populations. May indicate elevated autoimmune risk in genetically susceptible individuals - particularly relevant given association with rheumatoid arthritis and ankylosing spondylitis.',
        },
        Bacteroides: {
          label: 'Bacteroides',
          description: 'Bacteroides-dominant enterotype (ET1). Most common in Western diet patterns. Strong polysaccharide-degrading capacity. Associated with high animal protein and fat intake. Generally good fibre-fermenting ability.',
        },
        Ruminococcus: {
          label: 'Ruminococcus',
          description: 'Ruminococcus-enriched enterotype (ET3). Associated with diverse fibre fermentation and strong butyrate production potential. Often indicates a resilient, diverse microbiome.',
        },
        Bifidobacterium: {
          label: 'Bifidobacterium-enriched',
          description: 'Bifidobacterium-enriched community. Common in plant-based diets and prebiotic-rich feeding patterns. Good immune regulatory capacity and GABA production potential.',
        },
        Faecalibacterium: {
          label: 'Faecalibacterium-enriched',
          description: 'Faecalibacterium-dominant community - indicates excellent gut health. F. prausnitzii dominance is strongly associated with low inflammation, good barrier integrity, and high butyrate production.',
        },
      }

      const matched = Object.keys(ENTEROTYPE_MAP).find(g => topGenus.includes(g))

      if (matched && topPct > 15) {
        const info = ENTEROTYPE_MAP[matched]
        return {
          enterotype: info.label,
          reason: `${info.description} (Dominant genus: ${topGenus} at ${topPct.toFixed(1)}% relative abundance)`,
          dominant_genus: topGenus,
          dominant_abundance: Math.round(topPct * 10) / 10,
          method: 'abundance_weighted',
        }
      }

      if (topPct > 10) {
        return {
          enterotype: `${topGenus}-dominant`,
          reason: `${topGenus} is the dominant genus at ${topPct.toFixed(1)}% relative abundance. No standard enterotype classification applies - mixed community with ${topGenus} dominance.`,
          dominant_genus: topGenus,
          dominant_abundance: Math.round(topPct * 10) / 10,
          method: 'abundance_weighted',
        }
      }
    }
  }

  // ── Method 2: Species count fallback ─────────────────────────────────────
  if (speciesListFallback.length > 0) {
    const str = speciesListFallback.join(' ').toLowerCase()
    const total = speciesListFallback.length

    const counts: Record<string, number> = {
      Prevotella:      ((str.match(/prevotella/g)    || []).length),
      Bacteroides:     ((str.match(/bacteroides/g)   || []).length),
      Ruminococcus:    ((str.match(/ruminococcus/g)  || []).length),
      Bifidobacterium: ((str.match(/bifidobacterium/g)||[]).length),
      Faecalibacterium:((str.match(/faecalibacterium/g)||[]).length),
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const [topGenus, topCount] = sorted[0] || ['', 0]
    const topRatio = topCount / total

    if (topRatio > 0.10) {
      return {
        enterotype: topGenus,
        reason: `Based on species count (abundance data not available): ${topGenus} represents ${topCount} species (${Math.round(topRatio*100)}% of detected species). Note: abundance-weighted classification would be more accurate.`,
        dominant_genus: topGenus,
        dominant_abundance: null,
        method: 'species_count',
      }
    }
  }

  return {
    enterotype: 'Mixed / Indeterminate',
    reason: 'No single dominant genus identified. Balanced community or insufficient species data for enterotype classification.',
    dominant_genus: null,
    dominant_abundance: null,
    method: 'indeterminate',
  }
}

// ─── SCORE ASSESSMENT ─────────────────────────────────────────────────────────
function assessScore(
  value: number | null | undefined,
  range: ReferenceRange | null
): {
  status: 'low' | 'normal' | 'high'
  confidence: number
  confidence_source: Finding['confidence_source']
} {
  if (value === null || value === undefined || !range) {
    return { status: 'normal', confidence: 0, confidence_source: 'threshold_distance' }
  }
  if (value < range.low) {
    const confidence = Math.min(0.95, 0.60 + ((range.low - value) / range.low) * 0.50)
    return { status: 'low', confidence: Math.round(confidence * 100) / 100, confidence_source: 'threshold_distance' }
  }
  if (value > range.high) {
    const confidence = Math.min(0.95, 0.60 + ((value - range.high) / range.high) * 0.30)
    return { status: 'high', confidence: Math.round(confidence * 100) / 100, confidence_source: 'threshold_distance' }
  }
  return { status: 'normal', confidence: 0.85, confidence_source: 'threshold_distance' }
}

// ─── MAIN ENGINE ──────────────────────────────────────────────────────────────
export function runRulesEngine(
  reportData: any,
  referenceRanges: ReferenceRange[],
  contraindications: { supplement: string; condition: string; reason: string; severity: string }[],
  patientConditions: string[] = [],
  speciesAbundances: SpeciesAbundance[] = []
): RulesOutput {
  const findings: Finding[] = []
  const supplement_triggers: SupplementTrigger[] = []
  const diet_rules: DietRule[] = []
  const addedDiets = new Set<string>()
  const addedSupps = new Set<string>()

  // Build lookup from DB ranges
  const rangeMap = new Map<string, ReferenceRange>()
  referenceRanges.forEach(r => rangeMap.set(`${r.category}:${r.metric}`, r))
  const getRange = (cat: string, metric: string) => rangeMap.get(`${cat}:${metric}`) || null

  const addDiet = (rule: DietRule) => {
    if (!addedDiets.has(rule.food)) { addedDiets.add(rule.food); diet_rules.push(rule) }
  }

  const getContra = (name: string): string[] => {
    const lower = patientConditions.map(c => c.toLowerCase())
    return contraindications
      .filter(c =>
        c.supplement.toLowerCase() === name.toLowerCase() &&
        lower.some(p => p.includes(c.condition.toLowerCase()) || c.condition.toLowerCase().includes(p))
      )
      .map(c => `${c.condition} (${c.severity}): ${c.reason}`)
  }

  const addSupp = (name: string, triggeredBy: string, evidence: 'strong' | 'moderate' | 'emerging') => {
    if (!addedSupps.has(name)) {
      addedSupps.add(name)
      supplement_triggers.push({
        supplement_name: name,
        triggered_by: triggeredBy,
        evidence_level: evidence,
        contraindicated_with: getContra(name),
      })
    }
  }

  const pushFinding = (
    category: string, finding: string, severity: Finding['severity'],
    confidence: number, confidence_source: Finding['confidence_source'],
    value: number | null, range: ReferenceRange | null, metric: string,
    pmids: string[]
  ) => {
    findings.push({
      category, finding, severity, confidence, confidence_source,
      value,
      threshold_low: range?.low ?? 0,
      threshold_high: range?.high ?? 100,
      metric,
      pmids: pmids.length ? pmids : (range?.pmids || []),
    })
  }

  // ── RYCH INDEX ─────────────────────────────────────────────────────────────
  const ri = reportData?.rych_index
  if (ri != null) {
    if (ri < 40) pushFinding('Overall Health', `Rych Index critically low at ${ri}/100`, 'high', 0.95, 'validated_clinical_rule', ri, null, 'rych_index', [])
    else if (ri < 60) pushFinding('Overall Health', `Rych Index below optimal at ${ri}/100`, 'moderate', 0.90, 'validated_clinical_rule', ri, null, 'rych_index', [])
  }

  // ── SCFA ───────────────────────────────────────────────────────────────────
  const scfa = reportData?.scfa || {}

  const butRange = getRange('scfa', 'butyrate')
  const butStatus = assessScore(scfa.butyrate, butRange)
  if (butStatus.status === 'low') {
    pushFinding('SCFA Production', `Low butyrate production potential (score: ${scfa.butyrate})`, 'high', butStatus.confidence, butStatus.confidence_source, scfa.butyrate, butRange, 'butyrate', ['PMID:29378044'])
    addSupp('Tributyrin', 'Low butyrate production potential', 'strong')
    addSupp('Resistant Starch (Type 2)', 'Low butyrate production potential', 'strong')
    addDiet({ action: 'increase', food: 'Cooked and cooled basmati rice', indian_name: 'Thanda chawal', reason: 'Resistant starch type 3 - feeds butyrate-producing bacteria directly', frequency: 'Daily', triggered_by: 'Low butyrate' })
    addDiet({ action: 'increase', food: 'Green unripe banana', indian_name: 'Kaccha kela', reason: 'Highest RS type 2 - supports Ruminococcus bromii and F. prausnitzii', frequency: 'Daily', triggered_by: 'Low butyrate' })
    addDiet({ action: 'increase', food: 'Horse gram', indian_name: 'Kulthi dal', reason: 'High resistant starch and prebiotic fibre support butyrate community', frequency: '3–4x per week', triggered_by: 'Low butyrate' })
  }

  const propRange = getRange('scfa', 'propionate')
  const propStatus = assessScore(scfa.propionate, propRange)
  if (propStatus.status === 'low') {
    pushFinding('SCFA Production', `Low propionate production potential (score: ${scfa.propionate})`, 'moderate', propStatus.confidence, propStatus.confidence_source, scfa.propionate, propRange, 'propionate', ['PMID:25599185'])
    addDiet({ action: 'increase', food: 'Oats', indian_name: 'Jaie', reason: 'Beta-glucan supports propionate-producing Bacteroides and Lachnospiraceae', frequency: 'Daily', triggered_by: 'Low propionate' })
    addDiet({ action: 'increase', food: 'Barley', indian_name: 'Jau', reason: 'Arabinoxylans drive propionate production via cross-feeding', frequency: '3x per week', triggered_by: 'Low propionate' })
  }

  const acetRange = getRange('scfa', 'acetate')
  const acetStatus = assessScore(scfa.acetate, acetRange)
  if (acetStatus.status === 'low') {
    pushFinding('SCFA Production', `Low acetate production potential (score: ${scfa.acetate})`, 'moderate', acetStatus.confidence, acetStatus.confidence_source, scfa.acetate, acetRange, 'acetate', ['PMID:25005271'])
    addSupp('Inulin / FOS', 'Low acetate production potential', 'strong')
  }

  // ── VITAMINS ────────────────────────────────────────────────────────────────
  const vitamins = reportData?.vitamins || {}
  const vitKeys: [string, string][] = [['b12','B12 (Cobalamin)'],['b9','B9 (Folate)'],['b7','B7 (Biotin)'],['b6','B6 (Pyridoxine)'],['b5','B5 (Pantothenic acid)'],['b3','B3 (Niacin)'],['b2','B2 (Riboflavin)'],['b1','B1 (Thiamine)'],['c','Vitamin C']]

  vitKeys.forEach(([key, label]) => {
    const r = getRange('vitamins', key)
    const s = assessScore(vitamins[key], r)
    if (s.status === 'low') {
      pushFinding('Vitamin Production', `Low microbial ${label} synthesis potential (score: ${vitamins[key]})`, key === 'b12' ? 'moderate' : 'low', s.confidence, s.confidence_source, vitamins[key], r, key, [])
      if (key === 'b12') addSupp('Vitamin B12 (methylcobalamin)', 'Low microbial B12 synthesis', 'strong')
      if (key === 'b9') addDiet({ action: 'increase', food: 'Dark leafy greens (spinach, methi)', indian_name: 'Palak / Methi', reason: 'Rich dietary folate compensates for low microbial synthesis', frequency: 'Daily', triggered_by: 'Low B9' })
    }
  })

  // ── NEUROTRANSMITTERS ───────────────────────────────────────────────────────
  const neuro = reportData?.neurotransmitters || {}
  const neuroKeys: [string, string, string?, ('strong'|'moderate'|'emerging')?][] = [
    ['gaba','GABA','Bifidobacterium longum','moderate'],
    ['serotonin','serotonin precursor'],
    ['dopamine','dopamine precursor'],
    ['tryptophan','tryptophan metabolism'],
  ]

  neuroKeys.forEach(([key, label, supp, suppEvidence]) => {
    const r = getRange('neurotransmitters', key)
    const s = assessScore(neuro[key], r)
    if (s.status === 'low') {
      pushFinding('Neurotransmitter', `Low ${label} production potential (score: ${neuro[key]})`, key === 'tryptophan' ? 'high' : 'moderate', s.confidence, s.confidence_source, neuro[key], r, key, [])
      if (supp && suppEvidence) addSupp(supp, `Low ${label} production`, suppEvidence)
      if (key === 'gaba') addDiet({ action: 'increase', food: 'Fermented foods (idli, dosa, kanji)', indian_name: 'Idli / Kanji', reason: 'Enriches GABA-producing Lactobacillus and Bifidobacterium', frequency: 'Daily', triggered_by: 'Low GABA' })
      if (key === 'serotonin' || key === 'tryptophan') addDiet({ action: 'increase', food: 'Tryptophan-rich foods (paneer, lentils, walnuts)', indian_name: 'Paneer / Moong dal', reason: 'Tryptophan is the precursor for gut serotonin synthesis', frequency: 'Daily', triggered_by: `Low ${label}` })
    }
  })

  // ── GUT FUNCTION ────────────────────────────────────────────────────────────
  const gf = reportData?.gut_function || {}

  const motR = getRange('gut_function', 'intestinal_motility')
  const motS = assessScore(gf.intestinal_motility, motR)
  if (motS.status === 'low') {
    pushFinding('Gut Function', `Low intestinal motility potential (score: ${gf.intestinal_motility})`, 'moderate', motS.confidence, motS.confidence_source, gf.intestinal_motility, motR, 'intestinal_motility', ['PMID:23886975'])
    addSupp('Magnesium glycinate', 'Low intestinal motility potential', 'moderate')
    addDiet({ action: 'increase', food: 'Warm water with lemon - morning', indian_name: 'Garam nimbu pani', reason: 'Supports bile flow and gastrocolic reflex activation', frequency: 'Daily morning', triggered_by: 'Low motility' })
  }

  const minR = getRange('gut_function', 'mineral_bioavailability')
  const minS = assessScore(gf.mineral_bioavailability, minR)
  if (minS.status === 'low') {
    pushFinding('Gut Function', `Low mineral bioavailability potential (score: ${gf.mineral_bioavailability})`, 'moderate', minS.confidence, minS.confidence_source, gf.mineral_bioavailability, minR, 'mineral_bioavailability', ['PMID:26407938'])
    addDiet({ action: 'increase', food: 'Fermented foods with minerals (ragi idli, sesame)', indian_name: 'Ragi idli / Til', reason: 'Fermentation reduces phytates that block mineral absorption', frequency: 'Daily', triggered_by: 'Low mineral bioavailability' })
  }

  // ── INTOLERANCE ─────────────────────────────────────────────────────────────
  const intol = reportData?.intolerance || {}
  const lacR = getRange('intolerance', 'lactose')
  const lacS = assessScore(intol.lactose, lacR)
  if (lacS.status === 'low') {
    pushFinding('Intolerance Management', `Low lactose intolerance management capacity (score: ${intol.lactose})`, 'low', lacS.confidence, lacS.confidence_source, intol.lactose, lacR, 'lactose', ['PMID:20458351'])
    addDiet({ action: 'reduce', food: 'Unfermented dairy (fresh milk)', indian_name: 'Doodh', reason: 'Low lactase-producing bacteria reduces tolerance - prefer fermented dairy', frequency: 'Limit', triggered_by: 'Low lactose management' })
    addDiet({ action: 'increase', food: 'Curd / Yoghurt', indian_name: 'Dahi', reason: 'Lactose already fermented - delivers live bacteria without lactose load', frequency: 'Daily', triggered_by: 'Low lactose management' })
  }

  // ── HEALTH INDICATORS ───────────────────────────────────────────────────────
  const hi = reportData?.health_indicators || {}

  const lgR = getRange('health_indicators', 'leaky_gut')
  const lgS = assessScore(hi.leaky_gut, lgR)
  if (lgS.status === 'high') {
    pushFinding('Gut Barrier', `Elevated leaky gut potential indicator (score: ${hi.leaky_gut})`, 'high', lgS.confidence, lgS.confidence_source, hi.leaky_gut, lgR, 'leaky_gut', ['PMID:24499528'])
    addSupp('L-Glutamine', 'Elevated leaky gut potential', 'moderate')
    addSupp('Zinc carnosine', 'Elevated leaky gut potential', 'moderate')
    addDiet({ action: 'reduce', food: 'Ultra-processed foods', indian_name: 'Packaged snacks, instant noodles', reason: 'Emulsifiers degrade mucus barrier and increase permeability', frequency: 'Avoid', triggered_by: 'Leaky gut' })
  }

  const tmaoR = getRange('health_indicators', 'tmao')
  const tmaoS = assessScore(hi.tmao, tmaoR)
  if (tmaoS.status === 'high') {
    pushFinding('Cardiovascular Risk', `Elevated TMAO production potential (score: ${hi.tmao})`, 'moderate', tmaoS.confidence, tmaoS.confidence_source, hi.tmao, tmaoR, 'tmao', ['PMID:23614584'])
    addSupp('Omega-3 (EPA/DHA)', 'Elevated TMAO and cardiovascular risk', 'strong')
    addDiet({ action: 'reduce', food: 'Red meat and egg yolks', indian_name: null, reason: 'High choline and carnitine drive TMAO-producing microbial activity', frequency: 'Limit to 2x per week', triggered_by: 'High TMAO' })
  }

  const giR = getRange('health_indicators', 'gut_inflammation')
  const giS = assessScore(hi.gut_inflammation, giR)
  if (giS.status === 'high') {
    pushFinding('Inflammation', `Elevated gut inflammation indicator (score: ${hi.gut_inflammation})`, 'moderate', giS.confidence, giS.confidence_source, hi.gut_inflammation, giR, 'gut_inflammation', ['PMID:26925050'])
    addSupp('Omega-3 (EPA/DHA)', 'Elevated gut inflammation indicator', 'strong')
    addDiet({ action: 'increase', food: 'Turmeric with black pepper', indian_name: 'Haldi + Kali mirch', reason: 'Curcumin + piperine reduces NF-κB inflammatory signalling', frequency: 'Daily', triggered_by: 'Gut inflammation' })
    addDiet({ action: 'reduce', food: 'Refined vegetable oils', indian_name: 'Refined tel', reason: 'High omega-6 promotes pro-inflammatory microbial metabolites', frequency: 'Switch to ghee or coconut oil', triggered_by: 'Gut inflammation' })
  }

  const fatR = getRange('health_indicators', 'fatigue')
  const fatS = assessScore(hi.fatigue, fatR)
  if (fatS.status === 'high') {
    pushFinding('Energy', `Elevated fatigue propensity indicator (score: ${hi.fatigue})`, 'moderate', fatS.confidence, fatS.confidence_source, hi.fatigue, fatR, 'fatigue', ['PMID:24810079'])
    addSupp('Vitamin D3 + K2', 'Elevated fatigue propensity', 'moderate')
  }

  // ── MACRONUTRIENTS ──────────────────────────────────────────────────────────
  const macro = reportData?.macronutrients || {}
  const carbR = getRange('macronutrients', 'carbohydrate')
  const carbS = assessScore(macro.carbohydrate, carbR)
  if (carbS.status === 'low') {
    pushFinding('Macronutrient Metabolism', `Low carbohydrate metabolism potential (score: ${macro.carbohydrate})`, 'moderate', carbS.confidence, carbS.confidence_source, macro.carbohydrate, carbR, 'carbohydrate', ['PMID:23609775'])
    addSupp('Inulin / FOS', 'Low carbohydrate metabolism potential', 'strong')
  }

  // ── DISEASE RISK ─────────────────────────────────────────────────────────────
  const dr = reportData?.disease_risk || {}
  const diseaseRules = [
    { key: 'constipation',   label: 'Constipation',    t: 30, ht: 50, pmid: 'PMID:29902980', supps: [['Magnesium glycinate','moderate'],['Psyllium husk','strong']] as [string,('strong'|'moderate'|'emerging')][], diets: [{ action: 'increase' as const, food: 'Psyllium husk (isabgol)', indian_name: 'Isabgol', reason: 'Soluble fibre adds bulk and supports motility', frequency: 'Daily with water', triggered_by: 'Constipation' }] },
    { key: 'ibs',            label: 'IBS',             t: 15, ht: 30, pmid: 'PMID:25734706', supps: [['Lactobacillus rhamnosus GG','strong']] as [string,('strong'|'moderate'|'emerging')][], diets: [] },
    { key: 'type2_diabetes', label: 'Type 2 Diabetes', t: 10, ht: 20, pmid: 'PMID:23023125', supps: [['Berberine','moderate']] as [string,('strong'|'moderate'|'emerging')][], diets: [{ action: 'reduce' as const, food: 'Refined carbohydrates and added sugar', indian_name: 'Maida, mithai', reason: 'Rapid glucose spikes feed pro-inflammatory pathobionts', frequency: 'Avoid', triggered_by: 'T2D risk' },{ action: 'increase' as const, food: 'Bitter gourd', indian_name: 'Karela', reason: 'Polyphenols support metabolic microbiome composition', frequency: '3x per week', triggered_by: 'T2D risk' }] },
    { key: 'nafld',          label: 'NAFLD',           t: 5,  ht: 10, pmid: 'PMID:26040892', supps: [] as [string,('strong'|'moderate'|'emerging')][], diets: [{ action: 'reduce' as const, food: 'Fructose-rich foods and packaged juices', indian_name: 'Cold drinks', reason: 'Fructose drives NAFLD-associated microbial patterns', frequency: 'Avoid', triggered_by: 'NAFLD risk' }] },
    { key: 'hypertension',   label: 'Hypertension',    t: 10, ht: 20, pmid: 'PMID:28931803', supps: [] as [string,('strong'|'moderate'|'emerging')][], diets: [{ action: 'reduce' as const, food: 'Excess dietary sodium', indian_name: 'Namak, pickles, papads', reason: 'High sodium disrupts microbiome and is associated with hypertension', frequency: 'Limit to <2g/day', triggered_by: 'Hypertension risk' }] },
  ]

  diseaseRules.forEach(({ key, label, t, ht, pmid, supps, diets }) => {
    const v = dr[key]
    if (v != null && v > t) {
      pushFinding('Disease Risk', `Elevated ${label} microbiome risk pattern (${v}%)`, v > ht ? 'high' : 'moderate', 0.78, 'population_study', v, null, key, [pmid])
      supps.forEach(([n, e]) => addSupp(n, `Elevated ${label} risk`, e))
      diets.forEach(d => addDiet(d))
    }
  })

  // ── DIVERSITY ───────────────────────────────────────────────────────────────
  const shanR = getRange('diversity', 'shannon')
  const shannon = reportData?.diversity?.shannon
  if (shannon != null) {
    const shS = assessScore(shannon, shanR)
    if (shS.status === 'low') {
      pushFinding('Diversity', `Low Shannon diversity index (${shannon}) - reduced microbiome resilience`, shannon < 2.0 ? 'high' : 'moderate', 0.88, 'validated_clinical_rule', shannon, shanR, 'shannon', ['PMID:22797518'])
      addSupp('Inulin / FOS', 'Low microbiome diversity', 'strong')
      addDiet({ action: 'increase', food: 'Diverse vegetables - 10+ types per week', indian_name: 'Bhindi, karela, lauki, tinda, drumstick', reason: 'Dietary variety is the single strongest driver of microbiome diversity', frequency: 'Daily rotation', triggered_by: 'Low diversity' })
      addDiet({ action: 'increase', food: 'Garlic and onion', indian_name: 'Lahsun / Pyaz', reason: 'Inulin and FOS selectively feed Bifidobacterium and Lactobacillus', frequency: 'Daily in cooking', triggered_by: 'Low diversity' })
    }
  }

  // ── ANTIBIOTIC RECOVERY ─────────────────────────────────────────────────────
  const abxR = getRange('antibiotic', 'antibiotic_recovery')
  const abx = reportData?.antibiotic_recovery
  if (abx != null) {
    const abxS = assessScore(abx, abxR)
    if (abxS.status === 'low') {
      pushFinding('Antibiotic Recovery', `Low antibiotic recovery potential (score: ${abx})`, abx < 50 ? 'high' : 'moderate', 0.80, 'validated_clinical_rule', abx, abxR, 'antibiotic_recovery', ['PMID:28489527'])
      addSupp('Saccharomyces boulardii', 'Low antibiotic recovery potential', 'strong')
      addSupp('Lactobacillus rhamnosus GG', 'Low antibiotic recovery potential', 'strong')
    }
  }

  // ── ALWAYS INCLUDE ──────────────────────────────────────────────────────────
  addDiet({ action: 'reduce', food: 'Alcohol', indian_name: null, reason: 'Directly reduces microbial diversity and increases intestinal permeability', frequency: 'Avoid or limit to 1x per week', triggered_by: 'General gut health' })
  addDiet({ action: 'reduce', food: 'Artificial sweeteners (aspartame, sucralose)', indian_name: 'Sugar-free products', reason: 'Disrupt microbial metabolic balance and impair glucose signalling', frequency: 'Avoid', triggered_by: 'General gut health' })
  addDiet({ action: 'increase', food: 'Sprouted legumes', indian_name: 'Ankurit moong / chana', reason: 'Sprouting increases prebiotic content and reduces anti-nutrients', frequency: '4x per week', triggered_by: 'General microbiome support' })

  // ── ENTEROTYPE ──────────────────────────────────────────────────────────────
  const enterotype_result = detectEnterotype(
    speciesAbundances,
    reportData?.species_list || []
  )

  return {
    version: RULES_VERSION,
    parser_version: PARSER_VERSION,
    findings,
    supplement_triggers,
    diet_rules,
    enterotype_result,
    generated_at: new Date().toISOString(),
  }
}

// ─── EXTRACT METRICS FOR LONGITUDINAL TRACKING ───────────────────────────────
// Call this after running the engine to save to patient_metrics table
export function extractMetricsForTracking(reportData: any): Array<{ metric: string; category: string; value: number }> {
  const metrics: Array<{ metric: string; category: string; value: number }> = []

  const add = (category: string, metric: string, value: any) => {
    if (value !== null && value !== undefined && !isNaN(Number(value))) {
      metrics.push({ category, metric, value: Number(value) })
    }
  }

  add('overall', 'rych_index', reportData?.rych_index)
  add('diversity', 'shannon', reportData?.diversity?.shannon)
  add('antibiotic', 'antibiotic_recovery', reportData?.antibiotic_recovery)

  const scfa = reportData?.scfa || {}
  Object.entries(scfa).forEach(([k, v]) => add('scfa', k, v))

  const vitamins = reportData?.vitamins || {}
  Object.entries(vitamins).forEach(([k, v]) => add('vitamins', k, v))

  const neuro = reportData?.neurotransmitters || {}
  Object.entries(neuro).forEach(([k, v]) => add('neurotransmitters', k, v))

  const hi = reportData?.health_indicators || {}
  Object.entries(hi).forEach(([k, v]) => add('health_indicators', k, v))

  const dr = reportData?.disease_risk || {}
  Object.entries(dr).forEach(([k, v]) => add('disease_risk', k, v))

  const gf = reportData?.gut_function || {}
  Object.entries(gf).forEach(([k, v]) => add('gut_function', k, v))

  const macro = reportData?.macronutrients || {}
  Object.entries(macro).forEach(([k, v]) => add('macronutrients', k, v))

  return metrics
}
