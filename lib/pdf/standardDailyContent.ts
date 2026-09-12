// Living Plus's fixed, clinic-approved Daily Lifestyle Guidelines and
// Breakfast/Lunch/Dinner content — every roadmap starts here (fresh
// generation, the coach "Regenerate" button, and the self-heal backfill in
// ensureDailyContent.ts all funnel through generateDailyContent.ts, which
// uses these constants directly), instead of an AI guess that drifted
// per patient. A coach can still edit, add to, or fully replace any line
// afterward in the roadmap editor — this is only the starting point every
// dashboard is generated with, not a locked value.
//
// Format matches lib/periodBullets.ts's storage convention: one
// "Label: item" line per bullet, label being one of this list's own period
// names (Morning/Afternoon/Evening for lifestyle, Breakfast/Lunch/Dinner
// for meals) — exactly what splitIntoPeriods/joinPeriods and every
// template's period-grouped rendering already expect.

export const STANDARD_LIFESTYLE_GUIDELINES = [
  'Morning: Sunlight exposure (15 mins on waking up)',
  'Morning: 12-14 hour overnight fasting',
  'Morning: Amla shot',
  'Morning: Breathing exercise',
  'Morning: Workout',
  'Morning: Yoga',
  'Morning: Wheatgrass juice',
  'Morning: 3 CF water',
  'Afternoon: Take 20 mins to finish your meal',
  'Afternoon: Walk post lunch for 20 mins',
  'Afternoon: Herbal tea',
  'Afternoon: 1-2 brazil nuts + 4-5 almonds (soaked)',
  'Afternoon: 1 seasonal fruit',
  'Afternoon: Handful of goji berries in the evening',
  'Evening: Finish dinner 3 hours before bedtime',
  'Evening: No devices 1 hour before bedtime',
  'Evening: 15 minutes walking post dinner',
  'Evening: Yoga nidra',
  'Evening: Soak your feet in Epsom salt for 15-20 min',
  'Evening: Vagus nerve eye exercise',
  'Evening: Vagus nerve ear massage',
  'Evening: Diaphragmatic breathing',
].join('\n')

export const STANDARD_MEAL_GUIDELINES = [
  'Breakfast: 1 bowl of fruits',
  'Breakfast: 1 tbsp of ground flaxseeds',
  'Breakfast: 1 portion of whole grains',
  'Breakfast: 1 portion of vegetables',
  'Breakfast: 1 portion of GLV',
  'Breakfast: 1 serving of tofu/pulses',
  'Lunch: 2 portions of cooked vegetables',
  'Lunch: 1 portion of whole grains',
  'Lunch: 1 serving of tofu',
  'Lunch: 1 serving of pulses, soaked overnight with 1/2 tbsp of ACV',
  'Lunch: 1 tbsp seeds (pumpkin, chia, sunflower, hemp, sesame)',
  'Lunch: 1 inch grated ginger',
  'Lunch: Plant based curd/buttermilk',
  'Lunch: 1 tbsp of ACV mixed in a glass of water, 15 mins before meal',
  'Dinner: 1 portion of cruciferous vegetables',
  'Dinner: 1 tbsp seeds (pumpkin, chia, sunflower, hemp, sesame)',
  'Dinner: 1 portion of whole grains/millets',
  'Dinner: 2 tsp of psyllium husk with a glass of water before dinner',
  'Dinner: 1 serving of pulses, soaked overnight with 1/2 tbsp of ACV',
].join('\n')
