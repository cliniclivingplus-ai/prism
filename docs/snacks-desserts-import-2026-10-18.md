# Snacks and Desserts import — 18 October 2026

Five PDFs contain 41 source entries, merged into 36 distinct recipes: 17 Snacks and 19 Desserts. The reviewed plan inserts 18 new records and reuses 18 existing records. Existing duplicate rows elsewhere in the bank are not deleted.

Savoury recipes are filed under Snacks; sweets under Desserts, including the savoury recipes packaged in a dessert PDF. Cover identities are excluded. Different formulations keep distinct names (for example, the two cacao energy-ball recipes and Oat Bites with Figs & Raisins).

## Snacks

- Air Fryer Carrot / Beetroot Chips
- 3 Seed Cracker
- Bajra Cracker
- Roasted Chickpeas
- Roasted Spicy Edamame
- Apple Chips
- Kale Chips
- Savoury Sattu Balls
- Sweet Potato Chaat & Nutritional Yeast
- Soybean-Amaranth Cutlets
- Sattu Shake
- Chocolate Protein Shake
- Sattu Protein Bars
- Oil-Free Hummus
- Jowar Khakhra
- Oil-Free Popcorn
- Baked Broccoli

## Desserts

- Date & Quinoa Pops
- Cacao Energy Balls with Oats & Hemp
- Oat Bites with Figs & Raisins
- Chia Pudding
- Dates Snickers
- Vegan Chocolate Cake
- Homemade Applesauce
- Mini Peanut Butter Cups
- Avocado Cacao Mousse
- Cashew Blueberry Oatmeal Cookies
- Apple Cinnamon Cookies
- Cacao Energy Balls with Walnuts & Dates
- Fudgy Brownie
- Quinoa Carrot Cake
- Banana Sweet Potato Bread
- Cacao Walnut Pie
- Vegan Ice Cream
- Snicker Bites
- Raw Hazelnut Spread

## Source review

- **Bajra Cracker**: Directions add 3/4 cup water, which is not listed in the ingredient list.
- **Roasted Chickpeas**: The two source collections give different total times, 15 and 25 minutes, for the same recipe.
- **Roasted Spicy Edamame**: Header says 10-15 minutes; directions require 20-25 minutes of roasting.
- **Cacao Energy Balls with Oats & Hemp**: Header says 15 minutes; directions specify 15-18 minutes of blending.
- **Chia Pudding**: The 10-minute header does not include the stated 6-8 hours of chilling.
- **Sattu Shake**: Directions add jaggery without a quantity in the ingredient list.
- **Sattu Protein Bars**: The 15-minute header excludes the stated 2-3 hours of chilling. Per-bar nutrition figures are copied from the source and have not been recalculated.
- **Mini Peanut Butter Cups**: Source says to let chocolate "cook off"; likely a wording error. Confirm intended instruction.
- **Fudgy Brownie**: Allow the source-specified chilling time in addition to preparation.
- **Cacao Walnut Pie**: Source says 5 servings but directions cut the pie into 8 pieces. Confirm yield.

Review warnings are stored in recipe notes and marked with `source-review-needed`. Printed timings, yields and other source notes are retained. Missing quantities and conflicting source details are not invented or silently corrected.

## Existing dashboards

`recipeCatalogueSnackDessertSnapshot.json` adds a second catalogue release; it does not replace the earlier Low FODMAP snapshot. Existing plans undo applicable import changes newest-first and retain their prior bank order. This protects recipe data, automatic matches, grocery derivation, PDF projections and historical views through the shared guide-data builder. New plans use the current bank. No roadmap, share-token, guideline or check-in record is rewritten by the importer.

## Reproduction and audit

- `node scripts/parse-snacks-desserts.mjs` extracts source content only.
- `node scripts/import-snacks-desserts.mjs --prepare` performs read-only preparation and writes the protection snapshot.
- `node scripts/verify-snacks-desserts.mjs` checks simulated changes against the previously deployed catalogue implementation.
- Deploy and verify the protection release before importing.
- `node scripts/import-snacks-desserts.mjs --write --protection-deployed` applies the reviewed changes.
- `node scripts/verify-snacks-desserts.mjs --live` checks persisted rows and historical catalogue equivalence.

Original bank values, source audit, reviewed changes and applied IDs are retained under the git-ignored `.snack-dessert-import/` directory. An already completed import performs no writes on repetition. The importer stops on catalogue drift or dashboards created after preparation. Never replace either historical snapshot after its import has been applied.
