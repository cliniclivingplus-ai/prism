// "Make your own salad bowl" — the build-your-own chart the nutritionists
// hand out with their guidelines. Every roadmap starts with the clinic's
// standard version below; a coach can then edit the groups and ingredients
// for that patient, and their edits are stored on the roadmap
// (guide_overrides.salad_bowl) so the standard list is never overwritten.
//
// Transcribed from the clinic's own handout, wording and quantities as
// printed ("Zuchinni", "8- 10 almonds") rather than tidied, so a coach
// recognises their own chart.
export type SaladBowlGroup = { heading: string; items: string[] }

export const DEFAULT_SALAD_BOWL: SaladBowlGroup[] = [
  {
    heading: 'Pick three vegetables',
    items: [
      'Beetroot', 'Carrot', 'Cabbage', 'Sweet corn', 'Broccoli', 'Raw Mango', 'Zuchinni', 'Onions', 'Cucumbers',
      'Radish', 'Bell Pepper', 'Tomatoes', 'Celery', 'Mushrooms (roasted)', 'Cauliflower', 'Asparagus (steamed)',
      'Baby corn', 'Squash (roasted)',
    ],
  },
  {
    heading: 'Pick one leafy green',
    items: [
      'Kale', 'Beet leaves/Carrot Leaves', 'Lettuce', 'Spring Onions', 'Watercress', 'Spinach', 'Basil',
      'Rocket Leaves', 'Microgreens (handful)', 'Pui/ Basale Soppu',
    ],
  },
  {
    heading: 'Pick one fat source',
    items: [
      '1/4th Avocado', '1 tbsp nut butter (any)', '1 tbsp chia seeds', '1 tbsp hemp seeds', '1 tbsp pumpkin seeds',
      '1 tbsp tahini', '1 tbsp flaxseed powder', '6-8 walnuts', '8- 10 almonds', '8- 10 cashews', '4-5 Olives',
    ],
  },
  {
    heading: 'Pick desired enhancers',
    items: [
      'Nutritional Yeast', 'Grated ginger/ garlic', 'Salt/ Pepper', 'ACV/ Balsamic Vinegar', 'Mustard', 'Sriracha',
      'Apple', 'Pomegranate', 'Goji Berries', 'Jalapeno relish', 'Sprouts',
    ],
  },
]

export const SALAD_BOWL_TITLE = 'Make your own salad bowl'

// A coach's saved chart, or the clinic standard when they have not touched
// it. Anything malformed falls back rather than rendering a broken section.
export function resolveSaladBowl(stored: unknown): SaladBowlGroup[] {
  if (!Array.isArray(stored)) return DEFAULT_SALAD_BOWL
  const groups = stored
    .filter((g): g is SaladBowlGroup => !!g && typeof g === 'object' && typeof (g as SaladBowlGroup).heading === 'string')
    .map((g) => ({
      heading: String(g.heading),
      items: Array.isArray(g.items) ? g.items.map((i) => String(i)).filter((i) => i.trim()) : [],
    }))
  return groups.length ? groups : DEFAULT_SALAD_BOWL
}
