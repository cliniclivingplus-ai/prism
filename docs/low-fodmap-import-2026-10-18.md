# Low FODMAP recipe import — 18 October 2026

29 source entries: 8 new recipes/variants, 21 reused records. Trail Mix excluded because its ingredient list and method repeat Mint Gazpacho.

All three supplied collections are represented. Cover names and patient identities are excluded from shared recipe data. Existing duplicate rows outside these 21 matches are not deleted.

## New recipes

- Kale & Kiwi Smoothie
- Quinoa Porridge with Banana & Chia
- Malibu Smoothie
- Quinoa Khichadi with Cabbage Poriyal
- Matcha Energy Balls with Dates & Almonds
- Zucchini & Carrot Paratha
- Buckwheat Savoury Pancake
- Kodo Millet Pulao

## Source details requiring review

These warnings are also stored in the affected recipes’ notes, with the `source-review-needed` tag. Source ingredients are preserved; no missing quantities or clinical substitutions are invented.

- **Quinoa Porridge with Banana & Chia** (Low FODMAP Recipes, page 6): Source duration is 5 minutes, but directions require 15-20 minutes of simmering.
- **Soybean Curry with Brown Rice** (Low FODMAP Recipes, page 9): Directions mention mustard seeds and green chilly paste without ingredient quantities.
- **Jowar Roti Wraps** (Low FODMAP Recipes, page 12): Directions refer to jowar dough without a dough-making step and say to repeat step 6 within step 6.
- **Roasted Pumpkin Soup** (Low FODMAP Recipes, page 14): Source duration is 30 minutes, but directions require 45-60 minutes of roasting plus simmering.
- **Tofu Stir Fry** (Low FODMAP Recipes, page 15): Directions mention an additional chopped cruciferous vegetable without a separate ingredient quantity.
- **Zucchini & Carrot Paratha** (Low FODMAP Recipe Collection, page 3): Source lists "12 idlis" as the yield for paratha. Yield omitted pending review.
- **Little Millet Uttapam** (Low FODMAP Recipe Collection, page 4): Source says "1/2 yellow mung dal" without a unit. Source calls methi seeds "fenugreek leaves". Confirm the intended ingredient.
- **Beetroot Neer Dosa** (Low FODMAP Recipe Collection, page 6): Directions mention green chilies, but the ingredient list gives no quantity.
- **Ridge Gourd Kootu** (Low FODMAP Recipe Collection, page 11): Title/ingredients say ridge gourd; directions say snake gourd. Confirm the intended vegetable.
- **Chow Chow Chutney** (Low FODMAP Recipe Collection, page 12): Directions mention oil, mustard and dry red chili for tempering without ingredient quantities.

## Existing dashboard protection

The shared guide-data builder uses `lib/pdf/recipeCatalogueSnapshot.json` for plans created at or before 2026-10-18T11:18:47.446Z. It preserves the previous 870 recipe IDs, bank order and pre-import values of revised records. This protects patient templates, recipe matching, shopping lists, PDF generation and historical views through the shared builder. New plans use the current bank.

No roadmap, guideline, share-token or check-in record is rewritten by the importer. The snapshot contains recipe catalogue data only. Old plans intentionally retain the previous catalogue; creating a new plan uses the expanded catalogue.

## Import and verification

- Parse: `node scripts/parse-lowfodmap-recipes.mjs`
- Prepare (read-only): `node scripts/import-lowfodmap-recipes.mjs --prepare`
- Verify simulated preservation: `node scripts/verify-lowfodmap-import.mjs`
- Deploy protection before importing.
- Apply reviewed import: `node scripts/import-lowfodmap-recipes.mjs --write --protection-deployed`
- Verify persisted content and catalogue preservation: `node scripts/verify-lowfodmap-import.mjs --live`

Preparation saves the full original bank, reviewed plan and later applied IDs under the git-ignored `.lowfodmap-import/` folder. Re-running a completed import performs no writes. The importer stops if the bank has changed or a new roadmap was created after preparation. Do not replace the historical snapshot after applying an import.
