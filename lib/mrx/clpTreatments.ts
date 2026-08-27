// lib/clpTreatments.ts
// Living Plus - Gut Management Treatments Catalogue
// Source: Gut_Treatments_Summary.xlsx

export type ClpTreatment = {
    condition: string
    what_it_is: string
    symptoms_addressed: string[]
    treatments: string[]
    /** Keys used to match against rules engine findings & disease risk scores */
    match_keys: string[]
    /** Condition severity tier for UI badge */
    tier: 'urgent' | 'monitor' | 'support'
  }
  
  export const CLP_TREATMENTS: ClpTreatment[] = [
    {
      condition: 'Leaky Gut Syndrome',
      what_it_is:
        'Damage to the gut lining allowing toxins and bacteria into the bloodstream, triggering systemic inflammation.',
      symptoms_addressed: [
        'Bloating', 'Gas', 'Reflux', 'Food sensitivities',
        'Fatigue', 'Skin issues', 'Joint pain', 'Autoimmune flares',
      ],
      treatments: [
        'Personalised elimination diet (L-glutamine, zinc)',
        'Targeted stress-management protocol',
        'Therapeutic probiotic supplementation',
        'Ozone therapy - gut lining repair',
        'IV nutrient therapy',
      ],
      match_keys: ['leaky gut', 'intestinal permeability', 'gut lining', 'zonulin', 'barrier', 'food sensitivity', 'autoimmune'],
      tier: 'urgent',
    },
    {
      condition: 'Gut Dysbiosis',
      what_it_is:
        'Imbalance in the gut microbiome - overgrowth of harmful bacteria or loss of beneficial ones.',
      symptoms_addressed: [
        'Bloating', 'Abdominal pain', 'Irregular bowels',
        'Fatigue', 'Brain fog', 'Mood issues',
        'Metabolic dysfunction', 'Autoimmune links',
      ],
      treatments: [
        'Advanced microbiome testing & interpretation',
        'Targeted nutrition plan (prebiotics + probiotics)',
        'Ozone therapy - antimicrobial & microbiome balancing',
        'IV repair protocol',
      ],
      match_keys: ['dysbiosis', 'microbiome imbalance', 'diversity', 'harmful bacteria', 'pathogen', 'enterotype', 'overgrowth'],
      tier: 'urgent',
    },
    {
      condition: 'GERD / Acid Reflux',
      what_it_is:
        'Stomach acid flows back into the oesophagus, often linked to dysbiosis or hiatal hernia.',
      symptoms_addressed: [
        'Heartburn', 'Regurgitation', 'Chest pain', 'Swallowing discomfort',
      ],
      treatments: [
        'Root-cause dietary protocol',
        'Ozone therapy - inflammation & flora correction',
        'IV nutrient therapy',
        'PPI-reduction pathway',
      ],
      match_keys: ['gerd', 'acid reflux', 'heartburn', 'regurgitation', 'ppi', 'proton pump'],
      tier: 'monitor',
    },
    {
      condition: 'IBD (Inflammatory Bowel Disease)',
      what_it_is:
        'Chronic immune-driven inflammation of the GI tract (umbrella term including Crohn\'s & UC).',
      symptoms_addressed: [
        'Abdominal pain', 'Bloody diarrhoea', 'Weight loss',
        'Fatigue', 'Extraintestinal symptoms',
      ],
      treatments: [
        'Personalised gut-healing nutrition plan',
        'Ozone therapy - anti-inflammatory',
        'IV therapy with L-glutamine for mucosal repair',
        'Lifestyle & psychological support for remission',
      ],
      match_keys: ['ibd', 'inflammatory bowel', 'crohn', 'colitis', 'mucosal', 'intestinal inflammation'],
      tier: 'urgent',
    },
    {
      condition: 'IBS (Irritable Bowel Syndrome)',
      what_it_is:
        'Functional disorder involving gut motility, sensitivity, and often dysbiosis or leaky gut.',
      symptoms_addressed: [
        'Bloating', 'Abdominal pain', 'Diarrhoea', 'Constipation',
        'Stress-triggered flares',
      ],
      treatments: [
        'Holistic nutrition & elimination protocol',
        'Stress-reduction & mind-gut therapy',
        'Ozone therapy',
        'IV therapy',
      ],
      match_keys: ['ibs', 'irritable bowel', 'motility', 'gut sensitivity', 'constipation', 'diarrhoea', 'diarrhea'],
      tier: 'monitor',
    },
    {
      condition: 'Diverticulitis',
      what_it_is:
        'Inflammation or infection of diverticula (pouches) in the colon wall.',
      symptoms_addressed: [
        'Lower abdominal pain', 'Fever', 'Bowel changes', 'Recurrence risk',
      ],
      treatments: [
        'High-fibre nutrition protocol',
        'Microbiome restoration support',
        'Ozone therapy - healing & inflammation control',
        'IV therapy',
      ],
      match_keys: ['diverticulitis', 'diverticulosis', 'diverticula', 'colon pouches'],
      tier: 'monitor',
    },
    {
      condition: "Crohn's Disease",
      what_it_is:
        'Transmural inflammation anywhere in the GI tract, often affecting the small intestine.',
      symptoms_addressed: [
        'Pain', 'Diarrhoea', 'Weight loss', 'Fistulas',
        'Malnutrition', 'Often misdiagnosed as TB in India',
      ],
      treatments: [
        'Microbiome-focused nutrition plan',
        'Ozone therapy',
        'IV nutrient therapy',
        'Psychological support alongside conventional care',
      ],
      match_keys: ["crohn", "crohn's", 'transmural', 'small intestine inflammation', 'fistula'],
      tier: 'urgent',
    },
    {
      condition: 'Ulcerative Colitis (UC)',
      what_it_is:
        'Continuous inflammation and ulcers in the colon and rectum lining.',
      symptoms_addressed: [
        'Bloody/mucousy diarrhoea', 'Urgency', 'Pain',
        'Increased cancer risk with duration',
      ],
      treatments: [
        'Gut healing nutrition protocol',
        'Ozone therapy',
        'IV nutrient repair',
        'Ongoing monitoring & lifestyle optimisation',
      ],
      match_keys: ['ulcerative colitis', 'uc', 'colon ulcers', 'rectal inflammation', 'bloody stool'],
      tier: 'urgent',
    },
    {
      condition: 'Dysentery / Post-Infectious IBS',
      what_it_is:
        'Infectious diarrhoea (bacterial/parasitic) often with blood/mucus; causes long-term post-infectious microbiome damage.',
      symptoms_addressed: [
        'Acute severe diarrhoea', 'Long-term post-infectious IBS', 'Dysbiosis',
      ],
      treatments: [
        'Acute support protocol',
        'Microbiome restoration programme',
        'Ozone therapy - antimicrobial',
        'IV rehydration & repair',
      ],
      match_keys: ['dysentery', 'post-infectious', 'parasitic', 'pathogen', 'bacterial infection', 'mucus stool'],
      tier: 'urgent',
    },
    {
      condition: 'Hiatal Hernia',
      what_it_is:
        'Stomach protrudes through the diaphragm, contributing to reflux.',
      symptoms_addressed: [
        'Heartburn', 'Regurgitation', 'Chest discomfort worsened by pressure',
      ],
      treatments: [
        'Diet & lifestyle modification to reduce intra-abdominal pressure',
        'Gut health optimisation (non-surgical focus)',
      ],
      match_keys: ['hiatal hernia', 'hernia', 'diaphragm', 'reflux'],
      tier: 'support',
    },
    {
      condition: 'Anal Fissure',
      what_it_is:
        'Tear in the anal lining, usually caused by constipation or hard stools.',
      symptoms_addressed: [
        'Severe pain and bleeding during/after bowel movements',
      ],
      treatments: [
        'Constipation resolution via fibre & hydration protocol',
        'Microbiome support',
        'Ozone therapy - healing',
        'IV therapy',
      ],
      match_keys: ['anal fissure', 'fissure', 'constipation', 'hard stools', 'rectal bleeding'],
      tier: 'support',
    },
    {
      condition: 'Gut Microbiome Issues (General)',
      what_it_is:
        'Imbalance or lack of diversity in gut bacteria affecting digestion, immunity, and overall health.',
      symptoms_addressed: [
        'Broad digestive issues', 'Weak immunity', 'Systemic inflammation',
        'Mental health impacts',
      ],
      treatments: [
        'Advanced microbiome testing & analysis',
        'Microbiome restoration protocol (diet, Ozone, IV)',
        'Applicable across all gut conditions',
      ],
      match_keys: ['low diversity', 'dysbiosis', 'microbiome', 'immunity', 'gut health'],
      tier: 'support',
    },
  ]
