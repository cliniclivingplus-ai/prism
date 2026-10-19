# Dashboard loading and typing performance — 19 October 2026

## Scope and preservation

This is a code-only performance update. It performs no bulk database edits,
no catalogue import and no patient-content regeneration. Coach save/autosave
functions, guide overrides, share links, checklist records and catalogue
snapshots are preserved. No Redis or cross-request patient-data cache was
introduced; each request still reads current saved data.

## Changes

- All 13 dashboard layouts memoize their selected shopping recipes on actual
  recipe, schedule, visibility and ingredient-override dependencies. Unrelated
  text edits no longer rebuild the recipe array and ingredient extraction.
  The shopping editor is memoized while retaining its local unsaved draft.
  Classic's combined recipe-image matching is likewise memoized on recipe,
  image-bank and coach-uploaded-image changes instead of unrelated typing.
- Recipe selection compiles each keyword pattern once per selection instead
  of once per recipe. Scores, ordering, tie-breaks and explanation text are
  unchanged. Repeated weekly lookups reuse an ID index for each immutable
  bank array and retain first-match behavior for duplicate IDs.
- Ingredient/direction renderers reuse parsed text and skip reconciliation
  when text and every supported presentation value are unchanged. Real text
  or theme edits still update immediately.
- A client-side template boundary dynamically loads the chosen layout.
  The installed Next guide states that server-side dynamic imports do not
  provide automatic client code splitting, so the patient route's previous
  server dynamic imports were moved to the supported client pattern. Heavy
  Classic canvas/inspector/clone tools are also separate on-demand chunks.
- Ten previously eager image sites now use lazy loading and async decoding;
  existing source URLs, dimensions and content are untouched.
- Independent founder-note, check-in and supplement reads start in parallel
  where their dependencies allow it. Existing daily-content preparation is
  still awaited before constructing a guide. No saved data is cached/staled.

The full recipe bank is still available for the coach's picker and existing
matching behavior. This update does not remove fields/recipes to reduce
payload size, which could change old dashboards or recipe suggestions.

## Verification and limits

`node scripts/tests/verify-dashboard-performance.mjs` compares selections
against pre-change commit `f2da04f`, verifies unchanged rendered recipe HTML,
tests all 13 typing memo expressions with invalidation on real edits, checks
unchanged save functions, verifies template selection/props, and compares the
guide-data route payload with mocked reads. It does not write patient data.

With the local 893-recipe backup and six sample concerns, a seven-run median
measured approximately 110 ms before versus 47 ms after for matching alone.
This is a local CPU benchmark, not a measured end-to-end page-load improvement
or a test on the colleague's laptop. Eight unrelated simulated parent renders
reuse one shopping recipe calculation; changing ingredient overrides causes
a fresh calculation. Existing shopping, catalogue protection and recipe-bank
display regressions pass. TypeScript and focused ESLint checks are required
before deployment.

The colleague's device/browser has not been profiled directly. These changes
remove verified sources of repeated work; any remaining device-specific lag
needs a browser/network trace of the affected dashboard.
