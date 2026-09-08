// Curated lifestyle-protocol phrases for the coach's "Pick a protocol"
// picker (see components/ProtocolPickerButton.tsx). Sourced from the
// clinic's own historical guideline corpus (Living Plus' Canva protocol
// exports, ~2,000 real client guidelines) — each entry here is a clean,
// actionable rewrite of the most-repeated real phrasing within its
// category, not an invented recommendation. Categories match the corpus'
// own grouping (Hydration, Movement/Exercise, etc.), independent of which
// time-of-day box (Morning/Afternoon/Evening or Breakfast/Lunch/Dinner) a
// coach inserts an item into — the picker is one shared list for both.
export interface LifestyleProtocolCategory {
  id: string
  label: string
  items: string[]
}

export const LIFESTYLE_PROTOCOLS: LifestyleProtocolCategory[] = [
  {
    id: 'hydration',
    label: 'Hydration',
    items: [
      'Start the day with a glass of warm water',
      '2.5–3 litres of water through the day',
      'A glass of water before each meal',
      'Warm water with lemon on waking',
    ],
  },
  {
    id: 'fasting-meal-timing',
    label: 'Fasting / Meal Timing',
    items: [
      '12–14 hour overnight fast',
      'Take at least 20 minutes to finish a meal',
      'A glass of water 15 minutes before a meal',
      'Sit for 5 minutes after a meal',
    ],
  },
  {
    id: 'bowel-digestion',
    label: 'Bowel / Digestion Practice',
    items: [
      '1 tsp psyllium husk in water before lunch',
      'Chew on ½ tsp fennel seeds after a meal',
      'Chew thoroughly and eat slowly',
    ],
  },
  {
    id: 'movement-exercise',
    label: 'Movement / Exercise',
    items: [
      '15-minute walk after lunch',
      '15-minute walk after dinner',
      '20 minutes of yoga',
      '30 minutes of strength training',
      'Light cardio',
    ],
  },
  {
    id: 'breathwork-mindfulness',
    label: 'Breathwork / Mindfulness',
    items: [
      '10 minutes of breathwork',
      '15 minutes of pranayama',
      '10 minutes of meditation',
      'Deep breathing or yoga nidra before bed',
    ],
  },
  {
    id: 'sunlight',
    label: 'Sunlight',
    items: [
      '15 minutes of morning sunlight exposure',
    ],
  },
  {
    id: 'sleep',
    label: 'Sleep',
    items: [
      'Sleep by 10:30–11 PM',
      'Keep a consistent sleep schedule',
    ],
  },
  {
    id: 'stress-management',
    label: 'Stress Management',
    items: [
      '10 minutes of journaling',
      'Practice gratitude reflection',
    ],
  },
  {
    id: 'screen-time',
    label: 'Screen Time',
    items: [
      'No screens for 30 minutes before bed',
    ],
  },
  {
    id: 'oral-body-hygiene',
    label: 'Oral / Body Hygiene Practices',
    items: [
      'Dry brushing, 3–4 times a week',
      'Oil pulling with coconut oil',
      '30-second to 1-minute cold shower',
    ],
  },
  {
    id: 'supplement-tonic-ritual',
    label: 'Supplement / Tonic Ritual',
    items: [
      '1 tbsp apple cider vinegar before a meal',
      'Amla shot on an empty stomach',
      'Sip CF tea through the day',
      'Ginseng tea in the afternoon',
    ],
  },
  {
    id: 'alcohol-smoking',
    label: 'Alcohol / Smoking',
    items: [
      'Avoid alcohol',
      'No smoking',
      'Limit oil usage in cooking',
    ],
  },
]
