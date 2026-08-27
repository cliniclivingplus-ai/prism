// lib/aicSupplementRules.ts
// AIC Supplement Rules Engine - v3.0.0
// Full coverage: all 60 products mapped to deterministic biomarker rules

export const AIC_RULES_VERSION = 'v3.0.0'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AICProduct {
  product_key: string
  name:        string
  subtitle:    string | null
  dose:        string | null
  timing:      string | null
  phase:       1 | 2 | 3
  category:    string
  ingredients: string[] | null
  note:        string | null
  rotation:    { month1: string; month2: string; month3: string } | null
  active:      boolean
}

export interface AICFinding {
  biomarker:       string
  observed_value:  string | number
  reference_range: string
  severity:        'critical' | 'high' | 'moderate' | 'low'
  clinical_note:   string
}

export interface AICRecommendation {
  product:          AICProduct
  product_key:      string
  phase:            1 | 2 | 3
  priority:         'critical' | 'high' | 'moderate' | 'supportive'
  triggered_by:     AICFinding[]
  rationale_prompt: string
  ai_rationale?:    string
}

export interface AICRulesOutput {
  version:                        string
  patient_name:                   string
  rych_index:                     number
  phase1:                         AICRecommendation[]
  phase2_infection_control:       AICRecommendation[]
  phase2_probiotics:              AICRecommendation[]
  phase2_nutrition:               AICRecommendation[]
  phase3:                         AICRecommendation[]
  clinical_warnings:              string[]
  probiotic_alternation_schedule: string
  infection_control_rotation:     string | null
  die_off_warning:                boolean
  generated_at:                   string
}

// ─── Rules Engine ─────────────────────────────────────────────────────────────

export function runAICSupplementRules(
  reportData: Record<string, unknown>,
  products:   AICProduct[]
): AICRulesOutput {

  // TEMP DEBUG - remove after checking keys
  console.log('[AIC DEBUG] report_data keys:', JSON.stringify(Object.keys(reportData)))
  Object.keys(reportData).forEach(k => {
    const v = reportData[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      console.log(`[AIC DEBUG] reportData.${k} keys:`, JSON.stringify(Object.keys(v as object)))
    }
  })

  const productMap = new Map<string, AICProduct>(products.map(p => [p.product_key, p]))
  const getProduct = (key: string): AICProduct | null => productMap.get(key) ?? null

  const phase1:       AICRecommendation[] = []
  const phase2Infect: AICRecommendation[] = []
  const phase2Probio: AICRecommendation[] = []
  const phase2Nutrit: AICRecommendation[] = []
  const phase3:       AICRecommendation[] = []
  const warnings:     string[]            = []

  let needsInfectionControl = false
  let hasParasitic          = false
  let needsDieOff           = false

  // ── Score helpers ──────────────────────────────────────────────────────────

// Pre-resolved aliases: rules engine key → actual nested value
const vitamins  = (reportData.vitamins      as Record<string, number>) ?? {}
const endurance = (reportData.endurance     as Record<string, number>) ?? {}
const macros    = (reportData.macronutrients as Record<string, number>) ?? {}
const diversity = (reportData.diversity     as Record<string, number>) ?? {}

const KEY_ALIASES: Record<string, number> = {
  vitamin_b1:              vitamins.b1            ?? 0,
  vitamin_b2:              vitamins.b2            ?? 0,
  vitamin_b3:              vitamins.b3            ?? 0,
  vitamin_b5:              vitamins.b5            ?? 0,
  vitamin_b6:              vitamins.b6            ?? 0,
  vitamin_b7:              vitamins.b7            ?? 0,
  vitamin_b9:              vitamins.b9            ?? 0,
  vitamin_b12:             vitamins.b12           ?? 0,
  vitamin_c:               vitamins.c             ?? 0,
  physical_endurance:      endurance.physical     ?? 0,
  aerobic_endurance:       endurance.aerobic      ?? 0,
  fat_metabolism:          macros.fat             ?? 0,
  protein_metabolism:      macros.protein         ?? 0,
  carbohydrate_metabolism: macros.carbohydrate    ?? 0,
  diversity_score:         diversity.shannon      ?? 0,
}

const tryParse = (v: unknown): number | null => {
  if (typeof v === 'number' && !isNaN(v)) return v
  if (typeof v === 'string') { const n = parseFloat(v); if (!isNaN(n)) return n }
  return null
}

const score = (key: string): number => {
  // 0. Check explicit aliases first (handles key name mismatches)
  if (key in KEY_ALIASES) return KEY_ALIASES[key]

  // 1. Direct flat key at root
  const direct = tryParse(reportData[key])
  if (direct !== null) return direct

  // 2. Walk all nested sub-objects
  for (const subKey of Object.keys(reportData)) {
    const sub = reportData[subKey]
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      const nested = tryParse((sub as Record<string, unknown>)[key])
      if (nested !== null) return nested
    }
  }

  return 0
}

  const probiotics   = (reportData.probiotics         as Record<string, string>) ?? {}
  const pathogenMap  = (reportData.pathogens           as Record<string, number>) ?? {}
  const healthRisk   = (reportData.health_indicators   as Record<string, string>) ?? {}
  const diseaseRisk  = (reportData.disease_risk        as Record<string, number>) ?? {}
  const neuroMap     = (reportData.neurotransmitters   as Record<string, string>) ?? {}

  const isAbsent    = (sp: string)  => probiotics[sp] === 'absent'
  const isModHigh   = (ind: string) => ['moderate','high'].includes(String(healthRisk[ind] ?? '').toLowerCase())
  const isHigh      = (ind: string) => String(healthRisk[ind] ?? '').toLowerCase() === 'high'
  const pathElev    = (sp: string, t = 0.02) => (pathogenMap[sp] ?? 0) >= t
  const diseaseOver = (cond: string, pct = 15) => (diseaseRisk[cond] ?? 0) >= pct
  const neuroLow    = (nt: string) => ['low','absent'].includes(String(neuroMap[nt] ?? '').toLowerCase())
  const neuroHigh   = (nt: string) => String(neuroMap[nt] ?? '').toLowerCase() === 'atypical_high'

  const push = (
    bucket:           AICRecommendation[],
    key:              string,
    priority:         AICRecommendation['priority'],
    triggered_by:     AICFinding[],
    rationale_prompt: string
  ) => {
    const product = getProduct(key)
    if (!product || !product.active) return
    if (bucket.some(r => r.product_key === key)) return
    bucket.push({ product, product_key: key, phase: product.phase as 1|2|3, priority, triggered_by, rationale_prompt })
  }

  // ── Derived flags ──────────────────────────────────────────────────────────

  const rychIndex    = score('rych_index')
  const leakyGut     = isModHigh('leaky_gut')
  const gutInflam    = isModHigh('gut_inflammation')
  const constipRisk  = diseaseRisk['constipation'] ?? 0
  const motilityLow  = score('intestinal_motility') < 60
  const gabaLow      = score('gaba') < 50
  const trpLow       = score('tryptophan') < 38
  const achLow       = score('acetylcholine') < 25
  const butyrLow     = score('butyrate') < 55
  const propLow      = score('propionate') < 45
  const acetLow      = score('acetate') < 65
  const mineralLow   = score('mineral_bioavailability') < 35
  const carbLow      = score('carbohydrate_metabolism') < 28
  const fatLow       = score('fat_metabolism') < 39
  const protLow      = score('protein_metabolism') < 45
  const enduranceLow = score('physical_endurance') < 40 || score('aerobic_endurance') < 50
  const tmao         = isModHigh('tmao_production')
  const oxStress     = isModHigh('oxidative_stress')
  const immuneLow    = isModHigh('immune_function') || rychIndex < 45
  const diversityLow = score('diversity_score') < 50
  const histLow      = score('histamine_sensitivity') < 55
  const histHigh     = neuroHigh('histamine')
  const abRecovLow   = score('antibiotic_recovery') < 60
  const hasResistance = Array.isArray(reportData.antibiotic_resistance) &&
    (reportData.antibiotic_resistance as string[]).some(r => r.toLowerCase().includes('resistant'))

  const lactoAbsent    = ['lactobacillus_acidophilus','lactobacillus_plantarum',
    'lactobacillus_rhamnosus','lactobacillus_bulgaricus'].some(s => isAbsent(s))
  const bifidoAbsent   = isAbsent('bifidobacterium_animalis') || isAbsent('bifidobacterium_lactis')
  const sBoulAbsent    = isAbsent('saccharomyces_boulardii')
  const bacillusAbsent = ['bacillus_clausii','bacillus_coagulans',
    'bacillus_subtilis','bacillus_indicus'].some(s => isAbsent(s))
  const wideLacto      = ['lactobacillus_acidophilus','lactobacillus_plantarum',
    'lactobacillus_gasseri','lactobacillus_reuteri','lactobacillus_helveticus']
    .filter(s => isAbsent(s)).length >= 3

  const hasBacterial = ['helicobacter_pylori','klebsiella_pneumoniae',
    'shigella_dysenteriae','fusobacterium_nucleatum','clostridioides_difficile']
    .some(p => pathElev(p))
  const hasHPylori   = pathElev('helicobacter_pylori', 0.01)
  const prevDominant = (pathogenMap['prevotella_copri'] ?? 0) >= 0.25
  const blasto       = pathElev('blastocystis_hominis', 0.01)
  const hasCandida   = ['candida_albicans','candida_tropicalis',
    'candida_glabrata','candida_krusei'].some(p => pathElev(p, 0.01))
  const parasiticPaths = ['cryptosporidium','giardia_intestinalis','entamoeba_histolytica']
  hasParasitic         = parasiticPaths.some(p => pathElev(p, 0.005))

  const bVits = [
    { key: 'vitamin_b1',  label: 'B1',  ideal: 42 },
    { key: 'vitamin_b2',  label: 'B2',  ideal: 40 },
    { key: 'vitamin_b3',  label: 'B3',  ideal: 43 },
    { key: 'vitamin_b5',  label: 'B5',  ideal: 47 },
    { key: 'vitamin_b6',  label: 'B6',  ideal: 43 },
    { key: 'vitamin_b7',  label: 'B7',  ideal: 47 },
    { key: 'vitamin_b12', label: 'B12', ideal: 47 },
    { key: 'vitamin_c',   label: 'C',   ideal: 28 },
  ].filter(v => score(v.key) < v.ideal)

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 1 - GUT LINING & FOUNDATION
  // ══════════════════════════════════════════════════════════════════════════

  // 1. Colostrum Gut Revive - primary leaky gut sealer
  if (leakyGut || gutInflam) {
    const tf: AICFinding[] = []
    if (leakyGut)  tf.push({ biomarker: 'Leaky Gut Potential',       observed_value: String(healthRisk['leaky_gut'] ?? 'Moderate'),       reference_range: 'Target: Low', severity: 'high', clinical_note: 'Compromised gut barrier' })
    if (gutInflam) tf.push({ biomarker: 'Gut Inflammation Potential', observed_value: String(healthRisk['gut_inflammation'] ?? 'Moderate'), reference_range: 'Target: Low', severity: 'high', clinical_note: 'Active gut inflammation' })
    push(phase1, 'COLOSTRUM_GUT_REVIVE', 'critical', tf,
      `Patient has ${tf.map(f=>f.biomarker).join(' and ')}. Explain why Colostrum Gut Revive (IgG, L-Glutamine, Zinc Carnosine, Slippery Elm) is the first-line gut lining intervention before starting infection control. 2-3 sentences.`)
  }

  // 2. Leaky Gut Care
  if (leakyGut || gutInflam || diseaseOver('ibd', 10)) {
    const tf: AICFinding[] = []
    if (leakyGut)          tf.push({ biomarker: 'Leaky Gut Potential', observed_value: String(healthRisk['leaky_gut'] ?? 'Moderate'), reference_range: 'Target: Low', severity: 'high', clinical_note: 'Gut permeability compromised' })
    if (gutInflam)         tf.push({ biomarker: 'Gut Inflammation',    observed_value: String(healthRisk['gut_inflammation'] ?? 'Moderate'), reference_range: 'Target: Low', severity: 'high', clinical_note: 'Inflammatory state in gut' })
    if (diseaseOver('ibd',10)) tf.push({ biomarker: 'IBD Risk', observed_value: `${(diseaseRisk['ibd']??0).toFixed(1)}%`, reference_range: 'Target: <10%', severity: 'moderate', clinical_note: 'Elevated IBD predisposition' })
    push(phase1, 'LEAKY_GUT_CARE', leakyGut ? 'high' : 'moderate', tf,
      `Patient shows ${tf.map(f=>f.biomarker).join(', ')}. Explain why Leaky Gut Care powder (L-Glutamine 1500mg, Zinc Carnosine, DGL, Aloe Vera, Marshmallow) complements Colostrum to rebuild the gut mucosal lining. 2 sentences.`)
  }

  // 3. IBS Care
  if (bacillusAbsent || sBoulAbsent || constipRisk > 20 || motilityLow) {
    const tf: AICFinding[] = []
    if (bacillusAbsent)   tf.push({ biomarker: 'Bacillus Species (Multiple)', observed_value: 'ABSENT', reference_range: 'Should be present', severity: 'high', clinical_note: 'Spore-forming bacteria absent' })
    if (sBoulAbsent)      tf.push({ biomarker: 'Saccharomyces boulardii',     observed_value: 'ABSENT', reference_range: 'Should be present', severity: 'high', clinical_note: 'S. boulardii absent' })
    if (constipRisk > 20) tf.push({ biomarker: 'Constipation Risk', observed_value: `${constipRisk.toFixed(1)}%`, reference_range: 'Target: <15%', severity: constipRisk>35?'high':'moderate', clinical_note: 'Constipation predisposition' })
    if (motilityLow)      tf.push({ biomarker: 'Intestinal Motility', observed_value: score('intestinal_motility').toFixed(1), reference_range: 'Ideal: >62', severity: 'moderate', clinical_note: 'Reduced gut motility' })
    push(phase1, 'IBS_CARE', bacillusAbsent||sBoulAbsent ? 'critical' : 'high', tf,
      `Patient shows ${tf.map(f=>`${f.biomarker} (${f.observed_value})`).join(', ')}. Explain why IBS Care (Bacillus strains + S. boulardii 10B CFU + motility enzymes) is indicated for restoring gut flora and intestinal motility. 2 sentences.`)
  }

  // 4. Opti Fiber
  if (constipRisk > 15 || motilityLow || diversityLow || butyrLow) {
    const tf: AICFinding[] = []
    if (constipRisk > 15) tf.push({ biomarker: 'Constipation Risk',   observed_value: `${constipRisk.toFixed(1)}%`,        reference_range: 'Target: <15%', severity: 'moderate', clinical_note: 'Constipation predisposition' })
    if (diversityLow)     tf.push({ biomarker: 'Microbiome Diversity', observed_value: score('diversity_score').toFixed(1), reference_range: 'Ideal: >50',   severity: 'moderate', clinical_note: 'Low diversity reduces resilience' })
    if (butyrLow)         tf.push({ biomarker: 'Butyrate Potential',   observed_value: score('butyrate').toFixed(1),        reference_range: 'Ideal: >59.9', severity: 'moderate', clinical_note: 'Prebiotic fibre feeds butyrate producers' })
    push(phase1, 'OPTI_FIBER', 'moderate', tf,
      `Patient has ${tf.map(f=>f.biomarker).join(', ')}. Explain how Opti Fiber (multi-fibre prebiotic blend) feeds beneficial bacteria, improves gut motility, and supports SCFA production. 2 sentences.`)
  }

  // 5. Happy Bowels
  if (constipRisk > 20 || motilityLow || isModHigh('sibo_risk')) {
    const tf: AICFinding[] = []
    if (constipRisk > 20)       tf.push({ biomarker: 'Constipation Risk',   observed_value: `${constipRisk.toFixed(1)}%`,                  reference_range: 'Target: <15%', severity: constipRisk>35?'high':'moderate', clinical_note: 'Significant constipation risk' })
    if (motilityLow)            tf.push({ biomarker: 'Intestinal Motility', observed_value: score('intestinal_motility').toFixed(1),        reference_range: 'Ideal: >62',   severity: 'moderate', clinical_note: 'Poor motility' })
    if (isModHigh('sibo_risk')) tf.push({ biomarker: 'SIBO Risk',           observed_value: String(healthRisk['sibo_risk']),                reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'SIBO predisposition' })
    push(phase1, 'HAPPY_BOWELS', constipRisk > 35 ? 'high' : 'moderate', tf,
      `Patient has ${tf.map(f=>f.biomarker).join(', ')}. Explain why Happy Bowels (herbal pro-kinetic) supports bowel regularity, aids SIBO management through improved clearance, and assists detoxification. 2 sentences.`)
  }

  // 6. Toxin Cleanse
  if (tmao || isModHigh('endotoxin_production')) {
    needsDieOff = true
    const tf: AICFinding[] = []
    if (tmao) tf.push({ biomarker: 'TMAO Production Potential', observed_value: String(healthRisk['tmao_production'] ?? 'Moderate'), reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Elevated toxic metabolite production' })
    push(phase1, 'TOXIN_CLEANSE', 'moderate', tf,
      `Patient has elevated TMAO/toxin burden. Explain why Toxin Cleanse (activated charcoal + diatomaceous earth + kelp) binds toxic metabolites. ⚠️ Must be taken 2+ hours away from ALL other supplements. 2 sentences.`)
  }

  // 7. Vitamin C Care
  if (score('vitamin_c') < 28 || oxStress || immuneLow) {
    const tf: AICFinding[] = []
    if (score('vitamin_c') < 28) tf.push({ biomarker: 'Vitamin C Production Potential', observed_value: score('vitamin_c').toFixed(1), reference_range: 'Ideal: >28', severity: 'moderate', clinical_note: 'Low gut Vitamin C production' })
    if (oxStress)                tf.push({ biomarker: 'Oxidative Stress',               observed_value: String(healthRisk['oxidative_stress']??'Moderate'), reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Elevated oxidative stress burden' })
    push(phase1, 'VITAMIN_C_CARE', 'moderate', tf,
      `Patient shows ${tf.map(f=>f.biomarker).join(' and ')}. Explain how Sodium Ascorbate (1000mg, buffered) supports gut detox, constipation relief, antioxidant load, and immune readiness. 2 sentences.`)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2A - INFECTION CONTROL
  // ══════════════════════════════════════════════════════════════════════════

  // 8. Gut Cleanse Care
  if (hasBacterial || prevDominant || blasto) {
    needsInfectionControl = true
    needsDieOff           = true
    const tf: AICFinding[] = []
    if (hasHPylori)   tf.push({ biomarker: 'Helicobacter pylori',  observed_value: `${((pathogenMap['helicobacter_pylori']??0)*100).toFixed(3)}%`, reference_range: 'Safe Zone', severity: 'high', clinical_note: 'H. pylori detected' })
    if (prevDominant) tf.push({ biomarker: 'Prevotella copri',     observed_value: `${((pathogenMap['prevotella_copri']??0)*100).toFixed(1)}%`,    reference_range: 'Healthy: <25%', severity: 'high', clinical_note: 'Prevotella dominance' })
    if (blasto)       tf.push({ biomarker: 'Blastocystis hominis', observed_value: `${((pathogenMap['blastocystis_hominis']??0)*100).toFixed(3)}%`, reference_range: 'Safe Zone', severity: 'high', clinical_note: 'Blastocystis detected' })
    ;['klebsiella_pneumoniae','shigella_dysenteriae','fusobacterium_nucleatum','clostridioides_difficile']
      .filter(p => pathElev(p))
      .forEach(p => tf.push({ biomarker: p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), observed_value: `${((pathogenMap[p]??0)*100).toFixed(3)}%`, reference_range: 'Safe Zone', severity: 'high', clinical_note: 'Pathogen in Warning/Danger Zone' }))
    push(phase2Infect, 'GUT_CLEANSE_CARE', 'high', tf,
      `Patient has elevated pathogens: ${tf.map(f=>f.biomarker).join(', ')}. Explain how berberine (Gut Cleanse Care) acts as a broad-spectrum antimicrobial and why monthly rotation (Month 2: Black Cumin, Month 3: Oregano) prevents resistance. 2-3 sentences.`)
  }

  // 9. H Pylori Care
  if (hasHPylori) {
    push(phase2Infect, 'H_PYLORI_CARE', 'critical',
      [{ biomarker: 'Helicobacter pylori', observed_value: `${((pathogenMap['helicobacter_pylori']??0)*100).toFixed(3)}%`, reference_range: 'Should be in Safe Zone', severity: 'critical', clinical_note: 'H. pylori confirmed - specific eradication protocol required' }],
      `H. pylori detected in this patient. Explain why H Pylori Care (Mastic Gum 650mg, Berberine, Bismuth Citrate, Zinc Carnosine) is the specific 4-ingredient eradication protocol superior to berberine alone. 2-3 sentences.`)
  }

  // 10. Biofilm Care
  if (abRecovLow || hasResistance || (hasBacterial && rychIndex < 45)) {
    push(phase2Infect, 'BIOFILM_CARE', hasResistance ? 'critical' : 'high',
      [{ biomarker: hasResistance ? 'Antibiotic Resistance Genes' : 'Antibiotic Recovery Potential', observed_value: hasResistance ? 'Resistant genes detected' : score('antibiotic_recovery').toFixed(1), reference_range: 'Target: >65', severity: hasResistance ? 'critical' : 'high', clinical_note: 'Biofilm protection of pathogens likely' }],
      `Patient has ${hasResistance ? 'antibiotic resistance genes' : `low antibiotic recovery (${score('antibiotic_recovery').toFixed(1)})`}. Explain how Biofilm Care (Bacillus + protease/lipase/bromelain) dismantles biofilm polysaccharide matrix exposing pathogens to antimicrobials. 2 sentences.`)
  }

  // 11. Lyme Co Care
  if (hasParasitic) {
    needsDieOff           = true
    needsInfectionControl = true
    const tf = parasiticPaths.filter(p => pathElev(p,0.005)).map(p => ({
      biomarker:       p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
      observed_value:  `${((pathogenMap[p]??0)*100).toFixed(3)}%`,
      reference_range: 'Should be absent',
      severity:        'high' as const,
      clinical_note:   'Parasitic pathogen detected',
    }))
    push(phase2Infect, 'LYME_CO_CARE', 'high', tf,
      `Patient has parasitic pathogens: ${tf.map(f=>f.biomarker).join(', ')}. Explain why Lyme Co Care (Month 1: parasitic) should be rotated into Candida Care (Month 2) then Gut Cleanse Care (Month 3). 2-3 sentences.`)
  }

  // 12. Parasitic Care
  if (hasParasitic || isModHigh('parasite_risk')) {
    const tf: AICFinding[] = []
    if (hasParasitic)             tf.push({ biomarker: 'Parasitic Pathogens',     observed_value: 'Detected', reference_range: 'Should be absent', severity: 'high', clinical_note: 'Parasitic infection confirmed' })
    if (isModHigh('parasite_risk')) tf.push({ biomarker: 'Parasite Risk Indicator', observed_value: String(healthRisk['parasite_risk']??'Moderate'), reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Elevated parasite risk markers' })
    push(phase2Infect, 'PARASITIC_CARE', 'high', tf,
      `Patient shows parasitic infection markers. Explain why Parasitic Care (Black Walnut, Wormwood, Krimighna complex liquid tincture) is the primary antiparasitic, taken 30-60 mins before meals. 2 sentences.`)
  }

  // 13. Opti Parasitic Cleanse
  if (hasParasitic) {
    push(phase2Infect, 'OPTI_PARASITIC_CLEANSE', 'moderate',
      [{ biomarker: 'Parasitic Pathogens', observed_value: 'Detected', reference_range: 'Should be absent', severity: 'high', clinical_note: 'Capsule alternative to liquid Parasitic Care' }],
      `Parasitic pathogens confirmed. Explain why Opti Parasitic Cleanse (Black Walnut, Wormwood, Oregano, Clove, Neem capsules) is the capsule alternative for patients who cannot tolerate liquid tinctures. 2 sentences.`)
  }

  // 14. Opti-Candida
  if (hasCandida) {
    needsDieOff = true
    push(phase2Infect, 'OPTI_CANDIDA', 'high',
      [{ biomarker: 'Candida Species', observed_value: 'Elevated (Warning/Danger Zone)', reference_range: 'Safe Zone', severity: 'high', clinical_note: 'Candida overgrowth - enzyme-based cell wall disruption indicated' }],
      `Candida overgrowth confirmed. Explain how Opti-Candida (cellulase, hemicellulase, protease) dismantles Candida's chitin cell wall through enzyme action - a different mechanism from probiotic-based Candida Care. 2 sentences.`)
  }

  // 15. Active Garlic
  if (hasBacterial || prevDominant || blasto || isModHigh('sibo_risk')) {
    push(phase2Infect, 'ACTIVE_GARLIC', 'moderate',
      [{ biomarker: 'Bacterial Overgrowth / SIBO Risk', observed_value: hasBacterial?'Pathogens elevated':'Moderate risk', reference_range: 'Safe Zone', severity: 'moderate', clinical_note: 'Allicin provides broad-spectrum antimicrobial + pro-kinetic support' }],
      `Patient has bacterial/SIBO markers. Explain how Active Garlic (5% allicin) provides dual benefit: broad-spectrum infection control and pro-kinetic intestinal motility support. 2 sentences.`)
  }

  // 16. Optizyme
  if (isModHigh('systemic_inflammation') || hasResistance || abRecovLow || isModHigh('gut_inflammation')) {
    push(phase2Infect, 'OPTIZYME', 'moderate',
      [{ biomarker: 'Systemic Inflammation / Biofilm', observed_value: isModHigh('systemic_inflammation') ? String(healthRisk['systemic_inflammation']??'Moderate') : 'Present', reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Systemic enzyme therapy indicated' }],
      `Patient shows inflammatory/biofilm markers. Explain why Optizyme (serratiopeptidase, bromelain, trypsin - taken away from food) reduces systemic inflammation, disrupts biofilm, and improves circulation. 2 sentences.`)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2B - PROBIOTICS
  // ══════════════════════════════════════════════════════════════════════════

  // 17. S. Boulardii Care
  if (sBoulAbsent) {
    push(phase2Probio, 'S_BOULARDII_CARE', 'high',
      [{ biomarker: 'Saccharomyces boulardii', observed_value: 'ABSENT (0.000)', reference_range: 'Should be present', severity: 'high', clinical_note: 'Critical for gut inflammation, neurotransmitters, IBS' }],
      `Saccharomyces boulardii is completely absent. Explain its role in gut inflammation reduction, neurotransmitter support, and IBS symptom management. Note alternating nightly with Optibiotic. 2 sentences.`)
  }

  // 18. Optibiotic
  if (butyrLow || propLow || acetLow || lactoAbsent || bifidoAbsent) {
    const tf: AICFinding[] = []
    if (butyrLow)     tf.push({ biomarker: 'Butyrate Potential',              observed_value: score('butyrate').toFixed(1),   reference_range: 'Ideal: >59.9', severity: 'high',     clinical_note: 'Low colonocyte fuel' })
    if (propLow)      tf.push({ biomarker: 'Propionate Potential',            observed_value: score('propionate').toFixed(1), reference_range: 'Ideal: >53.9', severity: 'moderate', clinical_note: 'Low hepatic glucose metabolism' })
    if (acetLow)      tf.push({ biomarker: 'Acetate Potential',               observed_value: score('acetate').toFixed(1),    reference_range: 'Ideal: >71.7', severity: 'moderate', clinical_note: 'Low peripheral glucose metabolism' })
    if (lactoAbsent)  tf.push({ biomarker: 'Lactobacillus (Multiple)',        observed_value: 'ABSENT', reference_range: 'Should be present', severity: 'high', clinical_note: 'Multiple Lactobacillus strains absent' })
    if (bifidoAbsent) tf.push({ biomarker: 'Bifidobacterium animalis/lactis', observed_value: 'ABSENT', reference_range: 'Should be present', severity: 'high', clinical_note: 'Key Bifidobacterium strains absent' })
    push(phase2Probio, 'OPTIBIOTIC', butyrLow&&score('butyrate')<45?'critical':'high', tf,
      `Patient shows low SCFA production and absent probiotics: ${tf.map(f=>f.biomarker).join(', ')}. Explain why Optibiotic (spore-based + tributyrin) is the primary SCFA intervention and must alternate nightly with S. Boulardii Care. 2-3 sentences.`)
  }

  // 19. Candida Care
  if (hasCandida || wideLacto) {
    const tf: AICFinding[] = []
    if (hasCandida) tf.push({ biomarker: 'Candida Species',             observed_value: 'Elevated', reference_range: 'Safe Zone',         severity: 'high', clinical_note: 'Candida overgrowth detected' })
    if (wideLacto)  tf.push({ biomarker: 'Lactobacillus Strains (3+)', observed_value: 'ABSENT',   reference_range: 'Should be present', severity: 'high', clinical_note: 'Widespread Lactobacillus depletion' })
    push(phase2Probio, 'CANDIDA_CARE', hasCandida?'critical':'high', tf,
      `Patient has ${tf.map(f=>f.biomarker).join(' and ')}. Explain why Candida Care (3-strain probiotic + S. boulardii) addresses Candida overgrowth and probiotic deficiency simultaneously. Alternates nightly with Optibiotic. 2 sentences.`)
  }

  // 20. Complete Biotic Care
  if (diversityLow || (lactoAbsent && bifidoAbsent)) {
    push(phase2Probio, 'COMPLETE_BIOTIC_CARE', diversityLow?'high':'moderate',
      [{ biomarker: diversityLow?'Microbiome Diversity':'Probiotic Absence (Lacto + Bifido)', observed_value: diversityLow?score('diversity_score').toFixed(1):'Multiple strains ABSENT', reference_range: diversityLow?'Ideal: >50':'Should be present', severity: 'high', clinical_note: 'Broad microbiome restoration needed' }],
      `Patient has ${diversityLow?`low microbiome diversity (${score('diversity_score').toFixed(1)})`:'widespread probiotic absence'}. Explain why Complete Biotic Care (pre + pro + postbiotic combination) provides comprehensive microbiome restoration vs single-category supplements. 2 sentences.`)
  }

  // 21. Spore Probiotic Care
  if (hasResistance || (bacillusAbsent && rychIndex < 40)) {
    push(phase2Probio, 'SPORE_PROBIOTIC_CARE', hasResistance?'high':'moderate',
      [{ biomarker: hasResistance?'Antibiotic Resistance':'Severely Low Rych Index + Bacillus Absence', observed_value: hasResistance?'Resistant genes detected':`Rych: ${rychIndex.toFixed(0)}, Bacillus: ABSENT`, reference_range: 'Target: No resistance / >50', severity: 'high', clinical_note: 'Acid-resistant spore probiotics needed for gastric survival' }],
      `Patient has ${hasResistance?'antibiotic resistance genes':'severe microbiome depletion'}. Explain why Spore Probiotic Care (acid-resistant spore format) is indicated - how spore encapsulation ensures colon delivery when conventional probiotics fail. 2 sentences.`)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2C - NUTRITIONAL SUPPORT
  // ══════════════════════════════════════════════════════════════════════════

  // 22. Total Active B Complex
  if (bVits.length >= 3) {
    push(phase2Nutrit, 'TOTAL_ACTIVE_B', bVits.length>=5?'high':'moderate',
      bVits.map(v => ({ biomarker: `Vitamin ${v.label} Production Potential`, observed_value: score(v.key).toFixed(1), reference_range: `Ideal: >${v.ideal}`, severity: 'moderate' as const, clinical_note: `Gut not producing adequate Vitamin ${v.label}` })),
      `Patient's gut shows low production for: ${bVits.map(v=>`Vitamin ${v.label}`).join(', ')}. Explain why exogenous active B vitamins are needed while the microbiome rebuilds and how the amino acid blend supports neurotransmitter precursors. 2 sentences.`)
  }

  // 23. Brain + Heart Care
  if (gabaLow || trpLow || achLow || neuroLow('serotonin')) {
    const tf: AICFinding[] = []
    if (gabaLow)              tf.push({ biomarker: 'GABA Potential',         observed_value: score('gaba').toFixed(1),         reference_range: 'Ideal: >52.7', severity: 'high',     clinical_note: 'Low GABA - anxiety, poor sleep' })
    if (trpLow)               tf.push({ biomarker: 'Tryptophan Potential',   observed_value: score('tryptophan').toFixed(1),   reference_range: 'Ideal: >40.7', severity: 'high',     clinical_note: 'Serotonin precursor deficiency' })
    if (achLow)               tf.push({ biomarker: 'Acetylcholine Potential',observed_value: score('acetylcholine').toFixed(1),reference_range: 'Ideal: >26.2', severity: 'moderate', clinical_note: 'Cognitive impact' })
    if (neuroLow('serotonin')) tf.push({ biomarker: 'Serotonin',             observed_value: 'Low',                            reference_range: 'Optimal',      severity: 'high',     clinical_note: 'Low gut serotonin production' })
    push(phase2Nutrit, 'BRAIN_HEART_CARE', gabaLow&&trpLow?'high':'moderate', tf,
      `Patient shows ${tf.map(f=>f.biomarker).join(', ')}. Explain how Brain + Heart Care (Omega-3 EPA+DHA, phospholipids, CoQ10) supports gut-brain axis, neuroinflammation reduction, and GABA/serotonin pathway support. 2-3 sentences.`)
  }

  // 24. Vegan Omega 3
  if ((gabaLow || trpLow || achLow) && reportData.is_vegan) {
    push(phase2Nutrit, 'VEGAN_OMEGA_3', 'moderate',
      [{ biomarker: 'Neurotransmitter Deficiency (Vegan Patient)', observed_value: 'Low GABA/Tryptophan', reference_range: 'Optimal', severity: 'moderate', clinical_note: 'Vegan-suitable Omega-3 alternative' }],
      `Vegan patient with neurotransmitter deficiency. Explain why Vegan Omega 3 (algae-derived DHA:EPA 4:1 + astaxanthin) provides identical neurological support to fish-derived omega-3 with no animal products. 2 sentences.`)
  }

  // 25. ZMAG
  if (mineralLow || enduranceLow) {
    const tf: AICFinding[] = []
    if (mineralLow)   tf.push({ biomarker: 'Mineral Bioavailability',    observed_value: score('mineral_bioavailability').toFixed(1), reference_range: 'Ideal: >35.9', severity: 'high',     clinical_note: 'Gut cannot absorb minerals properly' })
    if (enduranceLow) tf.push({ biomarker: 'Physical/Aerobic Endurance', observed_value: `${score('physical_endurance').toFixed(1)}/${score('aerobic_endurance').toFixed(1)}`, reference_range: 'Physical >46, Aerobic >59', severity: 'moderate', clinical_note: 'Low endurance correlates with zinc-magnesium depletion' })
    push(phase2Nutrit, 'ZMAG', mineralLow?'high':'moderate', tf,
      `Patient has ${tf.map(f=>f.biomarker).join(' and ')}. Explain why ZMAG (zinc-magnesium capsules) is needed despite potential adequate dietary intake - compromised gut lining causes mineral malabsorption. 2 sentences.`)
  }

  // 26. Optimal Magnesium Care
  if (constipRisk > 15 || motilityLow || gabaLow || trpLow) {
    const tf: AICFinding[] = []
    if (constipRisk>15)  tf.push({ biomarker: 'Constipation Risk',       observed_value: `${constipRisk.toFixed(1)}%`,            reference_range: 'Target: <15%', severity: constipRisk>35?'high':'moderate', clinical_note: 'Magnesium relaxes intestinal smooth muscle' })
    if (motilityLow)     tf.push({ biomarker: 'Intestinal Motility',     observed_value: score('intestinal_motility').toFixed(1), reference_range: 'Ideal: >62',   severity: 'moderate', clinical_note: 'Low motility' })
    if (gabaLow||trpLow) tf.push({ biomarker: 'GABA/Tryptophan (Sleep)', observed_value: 'LOW',                                  reference_range: 'Both Optimal', severity: 'moderate', clinical_note: 'Magnesium glycinate supports GABA receptor activation' })
    push(phase2Nutrit, 'OPTIMAL_MAGNESIUM', constipRisk>35?'high':'moderate', tf,
      `Patient has ${tf.map(f=>f.biomarker).join(', ')}. Explain why Optimal Magnesium Care powder (citrate/glycinate/malate complex, bedtime) addresses bowel regularity through smooth muscle relaxation and sleep quality through GABA receptor activation. 2 sentences.`)
  }

  // 27. Opt Histamine
  if (histLow || histHigh) {
    push(phase2Nutrit, 'OPT_HISTAMINE', 'moderate',
      [{ biomarker: histHigh?'Histamine (Atypically High)':'Histamine Sensitivity', observed_value: histHigh?'Atypical High':score('histamine_sensitivity').toFixed(1), reference_range: histHigh?'Should be Optimal':'Ideal: >45.6', severity: 'moderate', clinical_note: histHigh?'Gut overproducing histamine':'Low DAO enzyme activity' }],
      `Patient has ${histHigh?'atypically high histamine production':'low histamine sensitivity'}. Explain how Opt Histamine (quercetin, NAC, milk thistle, stinging nettle 810mg blend) reduces histamine burden and supports DAO enzyme activity. 2 sentences.`)
  }

  // 28. Opti Allergy Shield
  if (histHigh || histLow || needsDieOff || isModHigh('allergy_risk')) {
    push(phase2Nutrit, 'OPTI_ALLERGY_SHIELD', needsDieOff?'high':'moderate',
      [{ biomarker: needsDieOff?'Die-off Reaction Risk':'Histamine/Allergy Markers', observed_value: needsDieOff?'Active infection control protocol':'Elevated', reference_range: 'Target: Low', severity: needsDieOff?'high':'moderate', clinical_note: 'Anti-histamine support during die-off and allergy management' }],
      `Patient ${needsDieOff?'is on infection control (die-off risk)':'has histamine/allergy markers'}. Explain how Opti Allergy Shield (quercetin, bromelain, butterbur) dampens immune hypersensitivity and die-off reactions. 2 sentences.`)
  }

  // 29. Opti Calm
  if (gabaLow || trpLow || neuroLow('serotonin') || isModHigh('stress_response')) {
    const tf: AICFinding[] = []
    if (gabaLow)               tf.push({ biomarker: 'GABA Potential',      observed_value: score('gaba').toFixed(1),      reference_range: 'Ideal: >52.7', severity: 'high', clinical_note: 'Low GABA → anxiety, poor sleep' })
    if (trpLow)                tf.push({ biomarker: 'Tryptophan Potential',observed_value: score('tryptophan').toFixed(1),reference_range: 'Ideal: >40.7', severity: 'high', clinical_note: 'Low serotonin precursor' })
    if (neuroLow('serotonin')) tf.push({ biomarker: 'Serotonin',           observed_value: 'Low',                        reference_range: 'Optimal',      severity: 'high', clinical_note: 'Mood and sleep disruption' })
    push(phase2Nutrit, 'OPTI_CALM', gabaLow&&trpLow?'high':'moderate', tf,
      `Patient has ${tf.map(f=>f.biomarker).join(', ')}. Explain why Opti Calm (L-theanine, 5-HTP, GABA, Ashwagandha, Valerian, Magnesium Glycinate 600mg) directly supplements deficient neurotransmitter precursors for anxiety and sleep. 2 sentences.`)
  }

  // 30. Cell Membrane Care
  if (achLow || score('mitochondrial_function') < 40 || (gabaLow && trpLow && rychIndex < 40)) {
    push(phase2Nutrit, 'CELL_MEMBRANE_CARE', 'moderate',
      [{ biomarker: achLow?'Acetylcholine Potential':'Mitochondrial/Cognitive Function', observed_value: achLow?score('acetylcholine').toFixed(1):`Rych: ${rychIndex.toFixed(0)}`, reference_range: achLow?'Ideal: >26.2':'Ideal: >50', severity: 'moderate', clinical_note: 'Cellular membrane and mitochondrial integrity support needed' }],
      `Patient shows cognitive/mitochondrial deficiency markers. Explain why Cell Membrane Care (phosphatidylcholine, phosphatidylserine, Omega-3, CoQ10) supports neuronal membrane integrity and mitochondrial energy production. 2 sentences.`)
  }

  // 31. FMN Mito-I Support
  if (enduranceLow || score('mitochondrial_function') < 40 || (rychIndex < 45 && (fatLow || carbLow))) {
    push(phase2Nutrit, 'FMN_MITO_I', 'moderate',
      [{ biomarker: 'Mitochondrial / Energy Potential', observed_value: enduranceLow?`Endurance: ${score('physical_endurance').toFixed(1)}`:`Rych: ${rychIndex.toFixed(0)}`, reference_range: 'Ideal: Physical >46', severity: 'moderate', clinical_note: 'Mitochondrial cofactor support needed' }],
      `Patient has low energy/mitochondrial markers. Explain how Mito-I Support (D-Ribose 4000mg, Acetyl L-Carnitine 1000mg, CoQ10 Ubiquinol 200mg, Resveratrol) directly fuels ATP synthesis in the mitochondrial cycle. 2 sentences.`)
  }

  // 32. FMN Mito-II Support
  if (enduranceLow || isModHigh('systemic_inflammation') || score('mitochondrial_function') < 40) {
    push(phase2Nutrit, 'FMN_MITO_II', 'moderate',
      [{ biomarker: 'Mitochondrial Inflammation / Energy', observed_value: isModHigh('systemic_inflammation')?String(healthRisk['systemic_inflammation']??'Moderate'):`Endurance: ${score('physical_endurance').toFixed(1)}`, reference_range: 'Target: Low inflammation / High energy', severity: 'moderate', clinical_note: 'Mitochondrial anti-inflammatory support indicated' }],
      `Patient has mitochondrial/inflammatory burden. Explain how Mito-II Support (NAD+ precursors, PQQ, Alpha Lipoic Acid, glutathione precursors) works synergistically with Mito-I by reducing mitochondrial oxidative stress. Alternate days with Mito-I. 2 sentences.`)
  }

  // 33. FMN Opti-Zinc
  if (score('vitamin_b6') < 43 || mineralLow || immuneLow) {
    push(phase2Nutrit, 'FMN_OPTI_ZINC', 'moderate',
      [{ biomarker: mineralLow?'Mineral Bioavailability':'Immune / Zinc Depletion', observed_value: mineralLow?score('mineral_bioavailability').toFixed(1):rychIndex.toFixed(0), reference_range: mineralLow?'Ideal: >35.9':'Ideal: >50', severity: 'moderate', clinical_note: 'Zinc picolinate - highest bioavailability form' }],
      `Patient shows mineral/immune deficiency. Explain why FMN Opti-Zinc (zinc picolinate) has superior absorption vs zinc gluconate, and its role in immune activation, viral resistance, and gut barrier integrity. 2 sentences.`)
  }

  // 34. MultiVitamin MultiNutrient
  if (bVits.length >= 4 || (mineralLow && oxStress) || rychIndex < 35) {
    push(phase2Nutrit, 'MULTIVITAMIN_MULTINUTRIENT', bVits.length>=5?'high':'moderate',
      [{ biomarker: 'Multiple Nutritional Deficiencies', observed_value: `${bVits.length} B vitamins low, Rych: ${rychIndex.toFixed(0)}`, reference_range: 'All vitamins: Ideal range', severity: 'moderate', clinical_note: 'Comprehensive nutritional foundation needed' }],
      `Patient has multiple nutritional deficiencies (${bVits.length} B vitamins below ideal, Rych Index ${rychIndex.toFixed(0)}). Explain why MultiVitamin MultiNutrient Care (full spectrum vitamins + minerals + CoQ10 + ALA powder) provides the comprehensive nutritional base while the microbiome rebuilds. 2 sentences.`)
  }

  // 35. Advance Immune Care
  if (immuneLow || rychIndex < 40) {
    push(phase2Nutrit, 'ADVANCE_IMMUNE_CARE', rychIndex<30?'high':'moderate',
      [{ biomarker: 'Immune Function / Rych Index', observed_value: `Rych: ${rychIndex.toFixed(0)}`, reference_range: 'Ideal: >60', severity: rychIndex<30?'high':'moderate', clinical_note: 'Compromised immune readiness' }],
      `Patient has low Rych Index (${rychIndex.toFixed(0)}) indicating compromised immune function. Explain how Advance Immune Care (elderberry, echinacea, andrographis, beta-glucans + probiotics) provides multi-mechanism immune modulation during the treatment phase. 2 sentences.`)
  }

  // 36. Heart Care
  if (isModHigh('cardiovascular_risk') || enduranceLow || neuroLow('acetylcholine')) {
    push(phase2Nutrit, 'HEART_CARE', 'moderate',
      [{ biomarker: 'Cardiovascular / Mitochondrial Risk', observed_value: isModHigh('cardiovascular_risk')?String(healthRisk['cardiovascular_risk']??'Moderate'):`Endurance: ${score('aerobic_endurance').toFixed(1)}`, reference_range: 'Target: Low/Ideal', severity: 'moderate', clinical_note: 'Cardio-mitochondrial support indicated' }],
      `Patient shows cardiovascular/mitochondrial risk markers. Explain how Heart Care (CoQ10 ubiquinol, L-Carnitine, Hawthorn berry) enhances cardiac muscle energy production and reduces oxidative burden on cardiovascular tissue. 2 sentences.`)
  }

  // 37. UTI Care
  if (isModHigh('uti_risk') || pathElev('proteus_mirabilis', 0.01)) {
    push(phase2Nutrit, 'UTI_CARE', 'high',
      [{ biomarker: isModHigh('uti_risk')?'UTI Risk':'Proteus mirabilis', observed_value: isModHigh('uti_risk')?String(healthRisk['uti_risk']??'Moderate'):`${((pathogenMap['proteus_mirabilis']??0)*100).toFixed(3)}%`, reference_range: 'Target: Low/Safe Zone', severity: 'high', clinical_note: 'Urinary/vaginal microbiome imbalance' }],
      `Patient has urinary tract infection risk markers. Explain how UTI Care (D-Mannose, cranberry extract, uva ursi + urinary-specific probiotic strains) prevents pathogen adhesion to urinary epithelium and restores urogenital microbiome balance. 2 sentences.`)
  }

  // 38. Pain Care
  if (isModHigh('joint_inflammation') || isModHigh('systemic_inflammation') || diseaseOver('fibromyalgia', 10)) {
    push(phase2Nutrit, 'PAIN_CARE', isHigh('joint_inflammation')?'high':'moderate',
      [{ biomarker: 'Inflammation / Pain Markers', observed_value: isModHigh('joint_inflammation')?String(healthRisk['joint_inflammation']??'Moderate'):'Systemic inflammation elevated', reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Anti-inflammatory enzyme + anti-histamine combination indicated' }],
      `Patient shows inflammatory/pain markers. Explain how Pain Care (serratiopeptidase, bromelain, turmeric, boswellia, quercetin) provides systemic anti-inflammatory relief through enzymatic degradation of inflammatory mediators. 2 sentences.`)
  }

  // 39. Opti-Age
  if (oxStress || rychIndex < 40 || isModHigh('oxidative_stress')) {
    push(phase2Nutrit, 'OPTI_AGE', 'moderate',
      [{ biomarker: 'Oxidative Stress / Ageing Markers', observed_value: isModHigh('oxidative_stress')?String(healthRisk['oxidative_stress']??'Moderate'):`Rych: ${rychIndex.toFixed(0)}`, reference_range: 'Target: Low / Ideal: >60', severity: 'moderate', clinical_note: 'Senolytic and NAD+ support indicated' }],
      `Patient has oxidative stress and accelerated ageing markers (Rych: ${rychIndex.toFixed(0)}). Explain how Opti-Age (NMN, Resveratrol, Quercetin, Fisetin, Astaxanthin) activates sirtuin pathways and clears senescent cells. 2 sentences.`)
  }

  // 40. FMN Assimilate
  if (protLow || enduranceLow || (rychIndex < 45 && mineralLow)) {
    push(phase2Nutrit, 'FMN_ASSIMILATE', 'moderate',
      [{ biomarker: 'Protein Metabolism / Nutritional Support', observed_value: protLow?score('protein_metabolism').toFixed(1):`Rych: ${rychIndex.toFixed(0)}`, reference_range: 'Ideal: >46.2', severity: 'moderate', clinical_note: 'Hydrolysed protein for damaged gut easier absorption' }],
      `Patient has low protein metabolism and nutritional deficiency. Explain why FMN Assimilate (hydrolysed pea protein + phospholipid complex) provides pre-digested protein that bypasses poor proteolytic capacity in a compromised gut. 2 sentences.`)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2 - DETOX
  // ══════════════════════════════════════════════════════════════════════════

  // 41. Opti-Glutathione Complex
  if (oxStress || needsDieOff || tmao || hasCandida) {
    push(phase2Nutrit, 'OPTI_GLUTATHIONE_COMPLEX', needsDieOff?'high':'moderate',
      [{ biomarker: 'Oxidative Stress / Detox Burden', observed_value: isModHigh('oxidative_stress')?String(healthRisk['oxidative_stress']??'Moderate'):needsDieOff?'Die-off risk':'Elevated', reference_range: 'Target: Low', severity: needsDieOff?'high':'moderate', clinical_note: 'Glutathione + NAC + liver support stack' }],
      `Patient has oxidative/detox burden. Explain why Opti-Glutathione Complex (reduced glutathione 100mg + NAC + milk thistle + TMG + acetyl L-carnitine) provides multilayer antioxidant protection and liver detox support. 2 sentences.`)
  }

  // 42. Lipo-Glutathione
  if (isHigh('oxidative_stress') || (needsDieOff && rychIndex < 35)) {
    push(phase2Nutrit, 'LIPO_GLUTATHIONE', 'high',
      [{ biomarker: 'Severe Oxidative Stress / Heavy Detox Need', observed_value: isHigh('oxidative_stress')?'High':`Rych: ${rychIndex.toFixed(0)} + Die-off risk`, reference_range: 'Target: Low / Rych: >50', severity: 'high', clinical_note: 'High-dose liposomal delivery for maximum cellular access' }],
      `Patient has severe oxidative/detox burden. Explain why Lipo-Glutathione (1000mg reduced glutathione + 500mg phospholipid complex) provides 10x the bioavailability of standard glutathione through liposomal encapsulation. 2 sentences.`)
  }

  // 43. System Detox Care
  if (isModHigh('heavy_metal_exposure') || isModHigh('tmao_production')) {
    push(phase2Nutrit, 'SYSTEM_DETOX_CARE', 'high',
      [{ biomarker: 'Heavy Metal / TMAO Burden', observed_value: isModHigh('heavy_metal_exposure')?String(healthRisk['heavy_metal_exposure']??'Moderate'):String(healthRisk['tmao_production']??'Moderate'), reference_range: 'Target: Low', severity: 'high', clinical_note: 'Liposomal EDTA chelation indicated' }],
      `Patient has heavy metal/toxin burden. Explain why System Detox Care (liposomal EDTA 210mg + NAC + Selenium + ALA) provides cellular-level chelation for heavy metal removal. Must be taken empty stomach, away from other supplements. 2 sentences.`)
  }

  // 44. Heavy Metal Detox
  if (isModHigh('heavy_metal_exposure') || tmao) {
    push(phase2Nutrit, 'HEAVY_METAL_DETOX', 'moderate',
      [{ biomarker: 'Heavy Metal / Mycotoxin Burden', observed_value: isModHigh('heavy_metal_exposure')?String(healthRisk['heavy_metal_exposure']??'Moderate'):'TMAO/toxin elevated', reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Zeolite + humic acid dual binder system' }],
      `Patient has heavy metal/toxin burden. Explain how Heavy Metal Detox works as a two-capsule system: Green cap (liver activator at night) + Red cap (zeolite/humic acid binder on empty stomach in morning). 2 sentences.`)
  }

  // 45. Opti-Green
  if (tmao || oxStress || needsDieOff) {
    push(phase2Nutrit, 'OPTI_GREEN', 'moderate',
      [{ biomarker: 'Toxin / Detox Support Need', observed_value: tmao?'TMAO elevated':oxStress?'Oxidative stress elevated':'Die-off active', reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Natural heavy metal binder + antioxidant' }],
      `Patient needs ongoing detox support. Explain how Opti-Green (broken cell wall chlorella + spirulina) provides natural heavy metal binding and antioxidant support safe for long-term use alongside infection control. 2 sentences.`)
  }

  // 46. Opti-Bile
  if (fatLow || isModHigh('liver_stress') || diseaseOver('gallstone', 10)) {
    push(phase2Nutrit, 'OPTI_BILE', fatLow?'high':'moderate',
      [{ biomarker: fatLow?'Fat Metabolism Potential':'Liver/Gallbladder Stress', observed_value: fatLow?score('fat_metabolism').toFixed(1):String(healthRisk['liver_stress']??'Moderate'), reference_range: fatLow?'Ideal: >40.9':'Target: Low', severity: fatLow?'high':'moderate', clinical_note: 'Bile flow and liver detox support needed' }],
      `Patient has ${fatLow?`low fat metabolism (${score('fat_metabolism').toFixed(1)})`:'liver/gallbladder stress'}. Explain how Opti-Bile (TUDCA + bitter herbs: dandelion, artichoke, milk thistle) increases bile flow, improves fat digestion, and reduces estrogen dominance. 2 sentences.`)
  }

  // 47. Opti-Liver
  if (isModHigh('liver_stress') || needsDieOff || hasBacterial) {
    push(phase2Nutrit, 'OPTI_LIVER', needsDieOff?'high':'moderate',
      [{ biomarker: 'Liver Detox Support', observed_value: needsDieOff?'Active die-off protocol':String(healthRisk['liver_stress']??'Moderate'), reference_range: 'Target: Low', severity: needsDieOff?'high':'moderate', clinical_note: 'Liver protection during infection control' }],
      `Patient ${needsDieOff?'is on active infection control (liver under increased detox burden)':'has liver stress markers'}. Explain why Opti-Liver (milk thistle silymarin, artichoke, NAC, ALA) protects hepatocytes during high-load detox and pathogen die-off. 2 sentences.`)
  }

  // 48. Opti-Silica
  if (isModHigh('heavy_metal_exposure') || isModHigh('skin_health')) {
    push(phase2Nutrit, 'OPTI_SILICA', 'moderate',
      [{ biomarker: 'Heavy Metal / Skin Health', observed_value: isModHigh('heavy_metal_exposure')?String(healthRisk['heavy_metal_exposure']??'Moderate'):'Skin markers elevated', reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Bamboo silica - aluminium detox + collagen support' }],
      `Patient has heavy metal/skin concerns. Explain how Opti-Silica (bamboo extract 70% silica) supports aluminium detoxification, collagen formation, and hair/skin/nail health. 2 sentences.`)
  }

  // 49. Activated Charcoal
  if (needsDieOff || tmao) {
    push(phase2Nutrit, 'ACTIVATED_CHARCOAL', needsDieOff?'high':'moderate',
      [{ biomarker: needsDieOff?'Die-off Reaction Risk':'TMAO Production', observed_value: needsDieOff?'Active infection control protocol':String(healthRisk['tmao_production']??'Moderate'), reference_range: 'Target: Managed', severity: needsDieOff?'high':'moderate', clinical_note: '⚠️ Must be 2+ hours away from ALL supplements and medications' }],
      `Patient on infection control with die-off risk. Explain how Activated Charcoal binds endotoxin fragments and microbial die-off debris in the gut lumen, and why the mandatory 2+ hour gap from all other supplements is critical. 2 sentences.`)
  }

  // 50. FMN Chlorella
  if (tmao || oxStress || needsDieOff) {
    push(phase2Nutrit, 'FMN_CHLORELLA', 'moderate',
      [{ biomarker: 'Detox / Antioxidant Need', observed_value: tmao?'TMAO elevated':needsDieOff?'Die-off active':'Oxidative stress elevated', reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Powder chlorella for patients who prefer shake format' }],
      `Patient needs detox/antioxidant support. Explain how FMN Chlorella Powder (broken cell wall, 60% protein) provides heavy metal binding + immune modulation for patients who prefer adding to morning shakes. 2 sentences.`)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 3 - ENZYMES + MAINTENANCE
  // ══════════════════════════════════════════════════════════════════════════

  // 51. Digest All Care
  if (carbLow || fatLow || protLow) {
    const tf: AICFinding[] = []
    if (carbLow) tf.push({ biomarker: 'Carbohydrate Metabolism', observed_value: score('carbohydrate_metabolism').toFixed(1), reference_range: 'Ideal: >29.7', severity: 'moderate', clinical_note: 'Low carb metabolism' })
    if (fatLow)  tf.push({ biomarker: 'Fat Metabolism',          observed_value: score('fat_metabolism').toFixed(1),          reference_range: 'Ideal: >40.9', severity: 'moderate', clinical_note: 'Insufficient bile/lipase activity' })
    if (protLow) tf.push({ biomarker: 'Protein Metabolism',      observed_value: score('protein_metabolism').toFixed(1),      reference_range: 'Ideal: >46.2', severity: 'moderate', clinical_note: 'Low proteolytic capacity' })
    push(phase3, 'DIGEST_ALL_CARE', 'supportive', tf,
      `Patient's gut shows low ${tf.map(f=>f.biomarker).join(', ')}. Explain why Digest All Care (protease, amylase, lipase + ox bile/betaine HCl) is introduced in Phase 3 only after gut lining healing, bridging macronutrient processing while the microbiome matures. Note: veg variant available. 2 sentences.`)
  }

  // 52. Veg Digest All Care
  if ((carbLow || fatLow || protLow) && !fatLow) {
    push(phase3, 'VEG_DIGEST_ALL_CARE', 'supportive',
      [{ biomarker: 'Macronutrient Metabolism (Vegan)', observed_value: `Carb: ${score('carbohydrate_metabolism').toFixed(1)} / Protein: ${score('protein_metabolism').toFixed(1)}`, reference_range: 'Ideal ranges', severity: 'moderate', clinical_note: 'Vegan-suitable enzyme formula' }],
      `Patient has macronutrient metabolism deficiency. Explain why Veg Digest All Care (betaine HCl instead of ox bile) is the vegan/vegetarian-suitable enzyme formula with identical digestive coverage. 2 sentences.`)
  }

  // 53. Pancreatic Multi-enzyme Care
  if (fatLow || (carbLow && protLow)) {
    push(phase3, 'PANCREATIC_MULTIENZYME', fatLow?'high':'moderate',
      [{ biomarker: fatLow?'Fat Metabolism / Pancreatic Function':'Multiple Macronutrient Metabolism', observed_value: fatLow?score('fat_metabolism').toFixed(1):'Multiple low', reference_range: 'Ideal: >40.9', severity: fatLow?'high':'moderate', clinical_note: 'Pancreatic enzyme support indicated' }],
      `Patient has low fat/macronutrient metabolism suggesting pancreatic insufficiency. Explain how Pancreatic Multi-enzyme Care (pancreatin + ox bile + bromelain) restores comprehensive fat/protein/carb digestion and supports liver, gallbladder, and pancreas. 2 sentences.`)
  }

  // 54. Gerd Care
  if (isModHigh('low_stomach_acid') || isModHigh('sibo_risk') || hasBacterial) {
    push(phase3, 'GERD_CARE', 'moderate',
      [{ biomarker: isModHigh('low_stomach_acid')?'Low Stomach Acid':'SIBO/Bacterial Risk', observed_value: isModHigh('low_stomach_acid')?String(healthRisk['low_stomach_acid']??'Moderate'):'Present', reference_range: 'Target: Adequate HCl', severity: 'moderate', clinical_note: 'Betaine HCl restores gastric acidity to prevent bacterial overgrowth' }],
      `Patient has ${isModHigh('low_stomach_acid')?'low stomach acid':'SIBO/bacterial overgrowth markers'}. Explain how Gerd Care (betaine HCl + pepsin + enzymes) restores gastric acidity to create an antimicrobial barrier against SIBO recurrence. Note: only safe without active ulcers. 2 sentences.`)
  }

  // 55. Wheat Digest Care
  if (isModHigh('gluten_sensitivity') || diseaseOver('celiac', 5)) {
    push(phase3, 'WHEAT_DIGEST_CARE', 'moderate',
      [{ biomarker: 'Gluten/Wheat Sensitivity', observed_value: isModHigh('gluten_sensitivity')?String(healthRisk['gluten_sensitivity']??'Moderate'):`Celiac risk: ${(diseaseRisk['celiac']??0).toFixed(1)}%`, reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'DPP-IV enzyme breaks down gliadin fragments' }],
      `Patient has gluten/wheat sensitivity markers. Explain how Wheat Digest Care (DPP-IV enzyme specific to gliadin cleavage) provides enzymatic protection against gluten cross-contamination and reduces bloating and digestive discomfort. 2 sentences.`)
  }

  // 56. Dairy Digest Care
  if (isModHigh('dairy_sensitivity') || diseaseOver('lactose_intolerance', 10)) {
    push(phase3, 'DAIRY_DIGEST_CARE', 'moderate',
      [{ biomarker: 'Dairy/Lactose Sensitivity', observed_value: isModHigh('dairy_sensitivity')?String(healthRisk['dairy_sensitivity']??'Moderate'):`Lactose intolerance risk: ${(diseaseRisk['lactose_intolerance']??0).toFixed(1)}%`, reference_range: 'Target: Low', severity: 'moderate', clinical_note: 'Lactase + casein protease for complete dairy tolerance' }],
      `Patient has dairy/lactose sensitivity markers. Explain how Dairy Digest Care (lactase + casein protease + dairy lipase) enables complete dairy protein and fat digestion, reducing allergic/intolerance responses. 2 sentences.`)
  }

  // 57. Eczema Care
  if (hasCandida || isModHigh('skin_health') || diseaseOver('eczema', 10)) {
    push(phase3, 'ECZEMA_CARE', hasCandida?'high':'moderate',
      [{ biomarker: hasCandida?'Candida Species':'Skin Health / Eczema Risk', observed_value: hasCandida?'Elevated':`Eczema risk: ${(diseaseRisk['eczema']??0).toFixed(1)}%`, reference_range: 'Safe Zone / Target: Low', severity: hasCandida?'high':'moderate', clinical_note: 'Cellulase enzymes digest Candida cell wall - systemic + topical benefit' }],
      `Patient has ${hasCandida?'Candida overgrowth':'eczema/skin markers'}. Explain how Eczema Care (cellulase, hemicellulase + probiotics) taken empty stomach provides systemic anti-candida action manifesting as skin clearance. 2 sentences.`)
  }

  // 58. Creatine Monohydrate
  if (enduranceLow || score('physical_endurance') < 35 || (gabaLow && achLow)) {
    push(phase3, 'CREATINE_MONOHYDRATE', 'supportive',
      [{ biomarker: 'Physical Endurance / Cognitive Energy', observed_value: `Endurance: ${score('physical_endurance').toFixed(1)}`, reference_range: 'Ideal: >46', severity: 'moderate', clinical_note: 'Creatine boosts ATP for muscle and brain function' }],
      `Patient has low physical endurance and cognitive energy. Explain how micronised creatine monohydrate (3g/day) increases cellular ATP availability for both muscle performance and brain function (memory, brain fog). 2 sentences.`)
  }

  // 59. Detoxamin EDTA Suppository
  if (isHigh('heavy_metal_exposure')) {
    push(phase3, 'DETOXAMIN_EDTA', 'high',
      [{ biomarker: 'Severe Heavy Metal Toxicity', observed_value: String(healthRisk['heavy_metal_exposure']??'High'), reference_range: 'Target: Low', severity: 'high', clinical_note: 'Rectal EDTA - highest bioavailability chelation route' }],
      `Patient has severe heavy metal toxicity. Explain why Detoxamin EDTA Suppository (rectal delivery) achieves higher EDTA bioavailability than oral routes and is reserved for significant heavy metal burden under clinical supervision. 2 sentences.`)
  }

  // 60. Detoxamin EDTA + Glutathione Suppository
  if (isHigh('heavy_metal_exposure') && oxStress) {
    push(phase3, 'DETOXAMIN_EDTA_GLUTATHIONE', 'high',
      [{ biomarker: 'Severe Heavy Metal Toxicity + Oxidative Stress', observed_value: `Heavy metals: High / Oxidative stress: ${String(healthRisk['oxidative_stress']??'Elevated')}`, reference_range: 'Target: Low/Low', severity: 'high', clinical_note: 'Combined EDTA + Glutathione rectal suppository for enhanced chelation + antioxidant protection' }],
      `Patient has severe heavy metal toxicity combined with oxidative stress. Explain why the combined EDTA + Glutathione suppository enhances chelation efficacy through antioxidant protection of tissues during metal mobilisation. Clinical supervision required. 2 sentences.`)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WARNINGS
  // ══════════════════════════════════════════════════════════════════════════

  if (needsDieOff)           warnings.push('⚠️ Die-off Warning: Before starting infection control (Week 3), prepare die-off remedies - rotate: boiled ginger water, fennel seed water, Eno on empty stomach, activated charcoal (2+ hours away from supplements). If severe flare: reduce to half dose for 2–3 days then resume.')
  if (needsInfectionControl) warnings.push('⚠️ Never run two antimicrobials simultaneously. Each antimicrobial = 1 month only, then rotate. Never use same antimicrobial >1 month continuously.')
  if (leakyGut || gutInflam) warnings.push('⚠️ Gut lining FIRST: Do NOT start infection control until Phase 1 (Colostrum Gut Revive + Leaky Gut Care) has been completed for at least 2 weeks.')
  warnings.push('ℹ️ Colostrum Gut Revive contains bovine colostrum. Standard Digest All Care and Pancreatic Multi-enzyme contain Ox Bile. Always confirm dietary preference and prescribe veg variants where needed.')
  warnings.push('⚠️ Toxin Cleanse and Activated Charcoal must ALWAYS be taken 2+ hours away from all other supplements and medications - they will bind and inactivate them.')

  // ── Probiotic schedule ─────────────────────────────────────────────────────

  const hasSBoul  = phase2Probio.some(r => r.product_key === 'S_BOULARDII_CARE')
  const hasOpti   = phase2Probio.some(r => r.product_key === 'OPTIBIOTIC')
  const hasCandCa = phase2Probio.some(r => r.product_key === 'CANDIDA_CARE')

  const probioticSchedule =
    hasSBoul && hasOpti && hasCandCa
      ? 'Night 1: S. Boulardii Care (1 cap) → Night 2: Optibiotic (1 cap) → Night 3: Candida Care (1 cap) → Repeat cycle. Never give same probiotic two nights in a row.'
      : hasSBoul && hasOpti
      ? 'Night 1: S. Boulardii Care (1 cap) → Night 2: Optibiotic (1 cap) → Alternate nightly. Never same probiotic two nights in a row.'
      : phase2Probio.length > 0
      ? `${phase2Probio[0]?.product.name ?? 'Probiotic'}: 1 cap nightly`
      : 'No alternation needed based on current findings.'

  const infectionRotation = needsInfectionControl
    ? 'Month 1: Gut Cleanse Care (1 cap after lunch + dinner) | Month 2: Black Cumin Seed Oil (1 cap/day) | Month 3: Oregano Oil (1 cap/day)'
    : hasParasitic
    ? 'Month 1: Lyme Co Care (1–2ml before dinner) | Month 2: Candida Care (1 cap bedtime) | Month 3: Gut Cleanse Care (1 cap after lunch + dinner)'
    : null

  return {
    version:                        AIC_RULES_VERSION,
    patient_name:                   String(reportData.patient_name ?? 'Patient'),
    rych_index:                     rychIndex,
    phase1,
    phase2_infection_control:       phase2Infect,
    phase2_probiotics:              phase2Probio,
    phase2_nutrition:               phase2Nutrit,
    phase3,
    clinical_warnings:              warnings,
    probiotic_alternation_schedule: probioticSchedule,
    infection_control_rotation:     infectionRotation,
    die_off_warning:                needsDieOff,
    generated_at:                   new Date().toISOString(),
  }
}
