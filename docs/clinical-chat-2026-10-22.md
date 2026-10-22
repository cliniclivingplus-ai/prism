# Clinical discussion and dashboard handoff

The coach discussion now retrieves clinic documents through parallel keyword
and vector searches. Keyword retrieval does not wait for the embedding provider.
Embedding timeout changes are opt-in for chat; ingestion retains its original
timeout. Four diverse excerpts retain more context than the former 350-character
cutoff. Short follow-ups retain the prior topic, with bounded earlier discussion
included for continuity.

Public scientific abstracts are retrieved from the
[Europe PMC REST service](https://europepmc.org/RestfulWebService), restricted to
indexed reviews, guidelines and randomised trials. Public queries contain only
recognised clinical topic terms; no free-form patient text or identifying details
are sent to literature search. Returned PubMed identifiers supply the links.
Only references cited by the reply appear in its source panel. Abstracts are
limited excerpts, not full-paper reviews; the prompt requires attention to study
population, applicability, uncertainty and conflicting evidence. Retrieval can
miss material and does not establish clinical suitability or completeness.

Discussion saves preserve interview answers and check the previous discussion
before writing. A concurrent save returns a visible conflict instead of replacing
another coach's discussion. References survive reload. Generation navigation is
blocked while a reply is pending or its save has failed. Chat no longer writes
lifestyle suggestions into the patient's latest saved dashboard.

Generation extracts decisions from the selected session's discussion. Short
instructions are included; longer discussions are processed chronologically
with overlapping segments and accumulated decisions. Later corrections supersede
earlier decisions. Invalid, truncated or failed extraction blocks generation
instead of silently reverting to a generic plan. Discussions exceeding the
supported extraction size return an explicit error. A new session with the final
agreed plan is needed in that case.

When a settled plan exists, daily guidelines are generated against it before
adding the exact agreed actions, rather than blindly appending them to potentially
contradictory clinic defaults. Existing generation uses the same new-draft insert
and explicit-refresh write paths. Public rendering, coach dashboard save paths,
existing guide overrides, recipe selection and stored patient dashboards are not
modified by deployment. Legacy backfill without an agreed plan retains its
previous daily-content path. No database migration or patient-data update runs.

Validation:

- `node scripts/tests/verify-clinical-chat.mjs`: mocked chat route with lexical
  fallback, follow-up context, combined citations; scientific-query privacy,
  valid identifiers/retraction checks and network failure; short/long decision
  extraction and failed extraction; actual session PATCH with conflict detection
  and interview preservation; daily-plan handoff and legacy backfill.
- Existing shopping-list and dashboard-performance regression checks.
- TypeScript project check and focused lint of the new/clean modules. Existing
  `any`, `prefer-const` and JSX-entity lint issues remain in the older chat/UI files.
- Live public-literature retrieval using generic IBS/FODMAP terms.
- Live Groq extraction using fabricated coach messages: a correction from
  20 minutes to 10 minutes was retained, as was the instruction not to fast.

An attempted live test combining private KB retrieval with external AI inference
was rejected by automatic approval review. It was not run. The route integration
test uses synthetic excerpts; the live extraction test uses fabricated messages
and does not access the clinic KB or any real patient.
