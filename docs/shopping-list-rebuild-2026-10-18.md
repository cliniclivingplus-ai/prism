# Shopping list extraction and editing — 18 October 2026

## Problem and behavior

Classic extraction used a wider set of automatic recommendations than the
recipes actually curated into the plan, fell back to a hard-coded list when
extraction was empty, and launched an AI cleanup against stale React state.
Its rendered items were checkboxes even in edit mode. Several other layouts
used the entire recipe bank to build their plan-wide list. Saves swallowed
HTTP errors; the standard PDF ignored the saved list entirely.

All 13 editable layouts now share `RecipeShoppingListEditor`. Its input is
the distinct visible recipes selected through the same `getSlotRecipes`
resolver used by the recipe sections, with current ingredient overrides.
Hidden recipes and hidden weeks are excluded. It uses the full plan, not a
different global list every time a week is opened.

Extraction is deterministic and reads ingredient fields only. It has no AI
request, generic-list fallback, or bank-wide ingredient expansion. Ingredient
names are canonicalized for spelling/synonyms/preparation and categorized
with whole-word food matching. Preparation suffixes such as potato fry/fryy
merge into potato; powders, flours, milk, pastes and seeds stay distinct.
Known source repairs apply only to unchanged original fields. Unrecognized
or damaged lines are presented for review instead of generating guessed food.
No quantities are calculated or invented. Alternatives remain alternatives.

The editor supports item/category edits, additions, removals and category
moves. Extraction creates an unsaved draft. Saving drops blank/duplicate
items, PATCHes only `grocery_list_override`, checks both HTTP status and the
returned persisted value, and updates the parent only after success. Failed
saves leave the draft editable for retry. Existing unrelated plan fields are
merged server-side; malformed shopping lists or failed reads cannot overwrite
them. The standard PDF now renders an explicit saved override, including an
intentionally empty list, with paginated category columns.

## Existing patients

No database migration or bulk update runs. Existing patient shopping UI/data
and the legacy extraction function are retained. Existing lists change only
when a coach explicitly saves a shopping list; PDF exports then use that saved
list. Background legacy AI cleanup is disabled in editor mode. Opening an
editor or extracting a draft does not write patient data.

## Verification

`node scripts/tests/verify-shopping-list.mjs` checks selection/hidden recipes,
ingredient overrides, duplicate potato preparations, chilli vs powder,
garlic vs powder, oats/flour/milk, source fractions, column leaks, empty
recipes, fruit/grain/vegetable/nut categories, manual edit/move/remove, failed
save/retry, round-trip PATCH/GET, unrelated field preservation, invalid input,
read failure and all 13 integrations. An AST comparison confirms each original
patient shopping subtree is retained. Other catalogue/import and recipe-bank
display regressions pass. TypeScript and focused ESLint pass; template-wide
pre-existing lint errors remain outside this change.
