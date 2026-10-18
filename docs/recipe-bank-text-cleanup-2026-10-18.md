# Recipe Bank text cleanup — 18 October 2026

The first cleanup (`5b203c7`) only stripped leading replacement glyphs
before numeric ingredients and a limited list of direction verbs. The
reported Bendakaya Curry screenshot exposed word-led bullets, inline lost
fractions and ingredients interleaved with directions by a legacy PDF import.

The revised bank preview strips word-led list markers, labels unrecovered
inline text and quantities explicitly, and restores 11 entries from reviewed
source pages in `lib/recipeBankSourceRepairs.json`. Bendakaya Curry's turmeric
¼ tsp, coriander 1½ tsp, chili ½ tsp and mustard ½ tsp are recovered from
South Indian collection page 48. Adai is the same text as Mixed Dal Dosa,
page 14. The other corrections match all existing ingredient/direction word
tokens; source pages were rendered and checked. Names, categories and IDs
are retained; no deduplication or guessed substitutions occur.

Corrections apply only to the Recipe Bank preview and only when the original
field matches exactly. Subsequent coach edits take precedence. No database
rows, patient views, catalogue snapshots, grocery lists or PDFs are changed.
The editor continues to show the stored original rather than silently saving
preview corrections into an existing patient's recipe.

Validation: `node scripts/verify-recipe-bank-display.mjs` exercises word-led
bullets, fractions, source repairs and future edits. The local audit covers
893 current bank records: no replacement/private-use bullet glyphs remain
in previews; 189 records still contain unrecovered text explicitly labelled
for review. Full recipe reconstruction remains dependent on the original
files for those older records. TypeScript and focused ESLint also pass.
