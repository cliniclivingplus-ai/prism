/**
 * conditionMap.ts
 * Translates KB1 condition_flagged names → KB2 supplement condition_name lookups.
 *
 * KB2 uses operational names, so translation is required.
 * KB3 (therapy_protocols) uses KB1 names directly.
 * KB4 (dietary_protocols) uses KB1 names directly.
 */

const KB1_TO_SUPPLEMENTS: Record<string, string> = {
  // Rych Index
  'Severe Gut Dysbiosis': 'Severe Gut Dysbiosis (Rych <30)',
  'Moderate Gut Dysbiosis': 'Moderate Gut Dysbiosis (Rych 30–50)',
  'Mild Gut Imbalance': 'Mild Gut Imbalance (Rych 50–70)',
  'Optimal Microbiome': '',

  // Antibiotic
  'Post-Antibiotic Gut Damage': 'Post-Antibiotic Gut Damage',

  // SCFAs
  'Colonic Inflammation + Leaky Gut': 'Butyrate Deficiency (SCFAs LOW)',
  'Insulin Resistance Risk + Impaired Gut Motility':
    'Propionate Deficiency',
  'Gut pH Imbalance + Bifidobacterium Deficiency':
    'Acetate Deficiency',

  // Vitamins
  'Thiamine Deficiency - Energy + Nerve Function':
    'Vitamin B1 Deficiency',
  'NAD+ Depletion - Mitochondrial Dysfunction':
    'Vitamin B3 Deficiency',
  'Adrenal + Stress Hormone Dysregulation':
    'Vitamin B5 Deficiency',
  'Neurotransmitter Deficiency - Serotonin + Dopamine + GABA':
    'Vitamin B6 (P5P) Deficiency',
  'B12 Deficiency - Neurological + Energy + Anemia':
    'Vitamin B12 Deficiency',
  'Immune Suppression + Leaky Gut + Oxidative Stress':
    'Vitamin C Deficiency',
  'Coagulation + Bone Health + Cardiovascular Risk':
    'Vitamin K Deficiency',

  // Neurotransmitters
  'Anxiety + Poor Sleep + Gut Motility Impairment':
    'GABA Deficiency',
  'Low Mood + IBS + Appetite Dysregulation':
    'Serotonin Precursor Deficiency',
  'Low Motivation + Fatigue + Cognitive Fog':
    'Dopamine Precursor Deficiency',

  // Leaky Gut
  'Leaky Gut Syndrome - Moderate':
    'Leaky Gut (Moderate)',
  'Leaky Gut Syndrome - Severe + IBD Risk':
    'Leaky Gut (High / Severe)',

  // Gut Function
  'Constipation + Gut Stasis + Dysbiosis Perpetuation':
    'Constipation / Low Motility',
  'Microplastic Toxicity + Systemic Toxin Load':
    'Microplastic Toxicity',

  // Intolerances
  'Lactose Maldigestion': 'Lactose Intolerance',
  'Non-Celiac Gluten Sensitivity / Celiac Risk':
    'Gluten Sensitivity',
  'Histamine Intolerance': 'Histamine Intolerance',

  // Health Indicators
  'Chronic Gut Inflammation - Moderate':
    'Gut Inflammation (Moderate)',
  'Severe Gut Inflammation + IBD/IBS Trigger':
    'Gut Inflammation (High / IBD Risk)',
  'Systemic Oxidative Stress':
    'Oxidative Stress (High)',
  'Liver Detoxification Overload':
    'Liver Toxin Burden (High)',

  // Disease Risk
  'Constipation Risk - Microbiome Driven':
    'Constipation / Low Motility',
  'Cardiovascular Risk - Microbiome-Driven Hypertension':
    'Hypertension Risk',
  'Metabolic Dysregulation - T2D Risk':
    'T2D Risk / Metabolic Syndrome',
  'Metabolic Obesity - Microbiome-Mediated':
    'Obesity / Metabolic Obesity',
  'IBD Predisposition - Inflammatory Cascade Risk':
    'Gut Inflammation (High / IBD Risk)',
  'IBS - Gut Microbiome Driven':
    'Gut Inflammation (Moderate)',
  'Non-Alcoholic Fatty Liver Disease Risk':
    'NAFLD',

  // Specific Bacteria
  'Prevotella Deficiency - Fibre Fermentation Gap': '',
  'Prevotella Dominance - RA + Autoimmune Association':
    'Prevotella copri (HIGH - RA risk)',
  'E. coli Overgrowth - Proteobacteria Dysbiosis':
    'E. coli Overgrowth',
  'Gut Barrier Failure - Mucin Layer Degradation':
    'Akkermansia Deficiency',

  // Resistance / Pathogens
  'Multi-Drug Resistance Profile':
    'Antibiotic Resistance (Elevated)',
  'Shigella Infection - Bacterial Pathogen':
    'Shigella / Bacterial Pathogen',
  'Blastocystis Parasitic Colonisation':
    'Blastocystis Detection',
  'Fungal Dysbiosis / Candida Overgrowth':
    'Candida Overgrowth',
  'Methane-Dominant SIBO / Constipation Driver':
    'Methane SIBO (Methanobrevibacter HIGH)',
}

/**
 * KB3 uses KB1 names directly
 */
const KB1_TO_THERAPIES: Record<string, string> = {}

/**
 * KB4 uses KB1 names directly
 */
const KB1_TO_DIETARY: Record<string, string> = {}

function translate(
  conditions: string[],
  map: Record<string, string>
): string[] {
  const result = new Set<string>()

  for (const c of conditions) {
    // Empty map = pass-through mode
    if (Object.keys(map).length === 0) {
      result.add(c)
      continue
    }

    const mapped = map[c]

    // Only add valid mapped values
    if (mapped) {
      result.add(mapped)
    }
  }

  return Array.from(result)
}

export function translateForSupplements(
  conditions: string[]
): string[] {
  return translate(conditions, KB1_TO_SUPPLEMENTS)
}

export function translateForTherapies(
  conditions: string[]
): string[] {
  return translate(conditions, KB1_TO_THERAPIES)
}

export function translateForDietary(
  conditions: string[]
): string[] {
  return translate(conditions, KB1_TO_DIETARY)
}
