export type PathogenRisk = "high" | "moderate" | "low";
export type PathogenCategory =
  | "bacterial"
  | "fungal"
  | "parasitic"
  | "opportunistic";

export interface PathogenMeta {
  name: string;
  risk: PathogenRisk;
  category: PathogenCategory;
  commonName?: string;
  associatedConditions: string[];
  clinicalNote: string;
}

// Master lookup: genus or species → metadata
// Keys are lowercase for case-insensitive matching
export const PATHOGEN_LOOKUP: Record<string, PathogenMeta> = {
  // ── HIGH RISK ─────────────────────────────────────────────────────────────
  "clostridioides difficile": {
    name: "Clostridioides difficile",
    risk: "high",
    category: "bacterial",
    commonName: "C. diff",
    associatedConditions: [
      "Antibiotic-associated diarrhea",
      "Pseudomembranous colitis",
      "Toxic megacolon",
    ],
    clinicalNote:
      "Highly virulent spore-forming pathogen. Produces toxins A and B causing severe colitis. Requires targeted treatment and microbiome restoration.",
  },
  "clostridium difficile": {
    name: "Clostridioides difficile",
    risk: "high",
    category: "bacterial",
    commonName: "C. diff",
    associatedConditions: [
      "Antibiotic-associated diarrhea",
      "Pseudomembranous colitis",
    ],
    clinicalNote:
      "Legacy name for C. difficile. Same high-risk profile - spore-former, toxin-producer.",
  },
  "helicobacter pylori": {
    name: "Helicobacter pylori",
    risk: "high",
    category: "bacterial",
    commonName: "H. pylori",
    associatedConditions: [
      "Peptic ulcer disease",
      "Gastric adenocarcinoma",
      "MALT lymphoma",
      "Chronic gastritis",
    ],
    clinicalNote:
      "WHO class I carcinogen. Eradication therapy (triple or quadruple) recommended when detected. Re-test post-treatment.",
  },
  "salmonella": {
    name: "Salmonella spp.",
    risk: "high",
    category: "bacterial",
    associatedConditions: [
      "Salmonellosis",
      "Enteric fever",
      "Bacteremia",
      "Reactive arthritis",
    ],
    clinicalNote:
      "Notifiable pathogen. Can cause systemic illness in immunocompromised patients. Assess for carrier state.",
  },
  "shigella": {
    name: "Shigella spp.",
    risk: "high",
    category: "bacterial",
    associatedConditions: [
      "Bacillary dysentery",
      "Hemolytic uremic syndrome",
      "Reactive arthritis",
    ],
    clinicalNote:
      "Extremely low infectious dose (~10 organisms). Produces Shiga toxin. Notifiable in most jurisdictions.",
  },
  "campylobacter": {
    name: "Campylobacter spp.",
    risk: "high",
    category: "bacterial",
    associatedConditions: [
      "Gastroenteritis",
      "Guillain-Barré syndrome",
      "Reactive arthritis",
      "IBD trigger",
    ],
    clinicalNote:
      "Most common bacterial GI pathogen globally. Post-infectious IBS and IBD flares are well-documented sequelae.",
  },
  "escherichia coli o157": {
    name: "E. coli O157:H7",
    risk: "high",
    category: "bacterial",
    commonName: "EHEC",
    associatedConditions: [
      "Hemorrhagic colitis",
      "Hemolytic uremic syndrome",
      "Thrombotic thrombocytopenic purpura",
    ],
    clinicalNote:
      "Shiga toxin-producing strain. Notifiable. Antibiotic use is controversial - may worsen HUS risk.",
  },
  "listeria": {
    name: "Listeria monocytogenes",
    risk: "high",
    category: "bacterial",
    associatedConditions: [
      "Listeriosis",
      "Meningitis",
      "Septicemia",
      "Fetal loss in pregnancy",
    ],
    clinicalNote:
      "High-risk in immunocompromised, elderly, and pregnant patients. Can cross blood-brain barrier.",
  },

  // ── MODERATE RISK ─────────────────────────────────────────────────────────
  "candida albicans": {
    name: "Candida albicans",
    risk: "moderate",
    category: "fungal",
    commonName: "Candida",
    associatedConditions: [
      "Candidiasis",
      "Leaky gut syndrome",
      "Recurrent thrush",
      "SIFO",
    ],
    clinicalNote:
      "Opportunistic yeast - becomes pathogenic with dysbiosis, antibiotic use, or immunosuppression. Address underlying dysbiosis alongside antifungal therapy.",
  },
  "candida": {
    name: "Candida spp.",
    risk: "moderate",
    category: "fungal",
    associatedConditions: ["Candidiasis", "SIFO", "Dysbiosis"],
    clinicalNote:
      "Fungal overgrowth - genus-level detection. Speciation recommended for targeted treatment.",
  },
  "klebsiella pneumoniae": {
    name: "Klebsiella pneumoniae",
    risk: "moderate",
    category: "bacterial",
    associatedConditions: [
      "Urinary tract infections",
      "Ankylosing spondylitis (gut-joint axis)",
      "Respiratory infections",
    ],
    clinicalNote:
      "Gut resident that can translocate. Elevated levels correlate with ankylosing spondylitis via molecular mimicry with HLA-B27.",
  },
  "klebsiella": {
    name: "Klebsiella spp.",
    risk: "moderate",
    category: "bacterial",
    associatedConditions: ["UTI", "Dysbiosis", "Inflammatory conditions"],
    clinicalNote: "Genus-level detection. Monitor for dominant overgrowth.",
  },
  "pseudomonas aeruginosa": {
    name: "Pseudomonas aeruginosa",
    risk: "moderate",
    category: "bacterial",
    associatedConditions: [
      "Opportunistic infections",
      "Antibiotic-resistant infections",
      "Gut dysbiosis",
    ],
    clinicalNote:
      "Environmental organism; gut colonisation indicates barrier disruption. Multi-drug resistant strains are a concern.",
  },
  "enterococcus faecalis": {
    name: "Enterococcus faecalis",
    risk: "moderate",
    category: "opportunistic",
    associatedConditions: [
      "Endocarditis",
      "Urinary tract infections",
      "Dysbiosis-associated inflammation",
    ],
    clinicalNote:
      "Normal gut resident at low levels; pathogenic at high abundance. Produces extracellular superoxide damaging colonic epithelium.",
  },
  "enterococcus faecium": {
    name: "Enterococcus faecium",
    risk: "moderate",
    category: "opportunistic",
    associatedConditions: ["Vancomycin-resistant enterococcal infections"],
    clinicalNote:
      "VRE strains are an increasing concern in hospital settings. Gut overgrowth warrants monitoring.",
  },
  "staphylococcus aureus": {
    name: "Staphylococcus aureus",
    risk: "moderate",
    category: "bacterial",
    commonName: "S. aureus / MRSA",
    associatedConditions: [
      "Skin and soft tissue infections",
      "Food poisoning",
      "Septicemia",
    ],
    clinicalNote:
      "Gut colonisation is a reservoir for systemic infection. MRSA screening recommended if detected.",
  },
  "proteus mirabilis": {
    name: "Proteus mirabilis",
    risk: "moderate",
    category: "bacterial",
    associatedConditions: [
      "Urinary tract infections",
      "Kidney stones (struvite)",
      "Rheumatoid arthritis (molecular mimicry)",
    ],
    clinicalNote:
      "Urease-producing organism - creates alkaline environment promoting kidney stone formation. RA link via HLA-DR4 molecular mimicry.",
  },
  "citrobacter": {
    name: "Citrobacter spp.",
    risk: "moderate",
    category: "opportunistic",
    associatedConditions: ["Dysbiosis", "Opportunistic GI infections"],
    clinicalNote:
      "Typically opportunistic; overgrowth suggests dysbiosis and barrier compromise.",
  },
  "morganella": {
    name: "Morganella morganii",
    risk: "moderate",
    category: "opportunistic",
    associatedConditions: ["Opportunistic infections", "Histamine production"],
    clinicalNote:
      "Histidine decarboxylase-positive - produces histamine in the gut, contributing to histamine intolerance.",
  },

  // ── LOW RISK / OPPORTUNISTIC ──────────────────────────────────────────────
  "bacteroides fragilis": {
    name: "Bacteroides fragilis",
    risk: "low",
    category: "opportunistic",
    associatedConditions: [
      "Intra-abdominal abscess",
      "Colorectal cancer (enterotoxigenic strain)",
    ],
    clinicalNote:
      "Normal anaerobe at low levels. Enterotoxigenic B. fragilis (ETBF) strain linked to CRC. Monitor for dominant abundance.",
  },
  "fusobacterium nucleatum": {
    name: "Fusobacterium nucleatum",
    risk: "moderate",
    category: "bacterial",
    associatedConditions: [
      "Colorectal cancer",
      "Periodontal disease",
      "Adverse pregnancy outcomes",
    ],
    clinicalNote:
      "Strong independent association with colorectal cancer - found enriched in CRC tumours. Warrants colonoscopy referral if dominant.",
  },
  "fusobacterium": {
    name: "Fusobacterium spp.",
    risk: "moderate",
    category: "bacterial",
    associatedConditions: ["Colorectal cancer risk", "Periodontal disease"],
    clinicalNote:
      "Genus-level detection. F. nucleatum is the primary CRC-associated species - speciation adds clinical value.",
  },
  "blastocystis": {
    name: "Blastocystis spp.",
    risk: "low",
    category: "parasitic",
    associatedConditions: [
      "IBS-like symptoms",
      "Skin conditions (urticaria)",
      "Gut dysbiosis",
    ],
    clinicalNote:
      "Clinical significance debated - some subtypes are commensals, others symptomatic. Subtype testing provides clarity.",
  },
  "dientamoeba fragilis": {
    name: "Dientamoeba fragilis",
    risk: "low",
    category: "parasitic",
    associatedConditions: ["Chronic diarrhea", "Abdominal pain", "IBS-like symptoms"],
    clinicalNote:
      "Non-invasive intestinal parasite. Often co-detected with pinworm. Treatment indicated if symptomatic.",
  },
  "giardia": {
    name: "Giardia lamblia",
    risk: "moderate",
    category: "parasitic",
    commonName: "Giardia",
    associatedConditions: [
      "Giardiasis",
      "Malabsorption",
      "Post-infectious IBS",
      "Micronutrient deficiency",
    ],
    clinicalNote:
      "Attaches to intestinal villi causing malabsorption. Post-giardia lactose intolerance is common. Treat with metronidazole or tinidazole.",
  },
  "cryptosporidium": {
    name: "Cryptosporidium spp.",
    risk: "moderate",
    category: "parasitic",
    associatedConditions: [
      "Cryptosporidiosis",
      "Profuse watery diarrhea",
      "Life-threatening in immunocompromised",
    ],
    clinicalNote:
      "Chlorine-resistant - waterborne transmission. Immunocompromised patients require urgent treatment.",
  },
};

/**
 * Look up pathogen metadata from a species/genus name.
 * Tries full name first, then genus only.
 */
export function lookupPathogen(speciesName: string): PathogenMeta | null {
  const lower = speciesName.toLowerCase().trim();

  // Try exact match
  if (PATHOGEN_LOOKUP[lower]) return PATHOGEN_LOOKUP[lower];

  // Try genus-only match (first word)
  const genus = lower.split(" ")[0];
  if (PATHOGEN_LOOKUP[genus]) return PATHOGEN_LOOKUP[genus];

  return null;
}

/**
 * Filter a species list to only known pathogens.
 * Returns enriched pathogen records sorted by risk (high → moderate → low).
 */
export function extractPathogens(
  species: Array<{ name: string; abundance?: number; level?: string }>
): Array<{ species: string; abundance?: number; level?: string } & PathogenMeta> {
  const riskOrder: Record<PathogenRisk, number> = { high: 0, moderate: 1, low: 2 };

  return species
    .map((s) => {
      const meta = lookupPathogen(s.name);
      if (!meta) return null;
      return { species: s.name, abundance: s.abundance, level: s.level, ...meta };
    })
    .filter(Boolean)
    .sort((a, b) => riskOrder[a!.risk] - riskOrder[b!.risk]) as Array<
    { species: string; abundance?: number; level?: string } & PathogenMeta
  >;
}

