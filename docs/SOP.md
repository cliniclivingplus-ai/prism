# LP Workspace — Standard Operating Procedure

Operating manual for the Living Plus clinician workspace (the merged
Compass + MicrobiomeRx + Blood Panel app, deployed as `prism`).

**Scope.** How to run it, change it, ship it, and what must never be broken.
Architecture and the merge history live in `CLAUDE.md`; this file is the
day-to-day procedure.

**Status:** living document. Last updated 2026-10-06.

---

## 0. How to maintain this SOP

Rules for keeping it true, because a stale SOP is worse than none:

1. **Every production incident gets an entry in §9**, written the same day:
   symptom as the user reported it, real cause, fix, commit hash.
2. **Every rule in §7 earns its place by having been broken once.** Do not add
   aspirational rules; add the ones that cost a real outage or a real
   clinical-safety near miss.
3. **Any change to the deploy, environment, or secrets updates §2–§3** in the
   same commit as the change itself.
4. **Figures (counts, limits, versions) are measured, not remembered.** Each
   one here was read off the repo or the live platform on the date above.
   Re-measure before trusting an old number.

---

## 1. What the system is

One Next.js app, one repo, one deployment, one login, serving three clinical
tools plus the hub that links them:

| Area | Lives at | Purpose |
|---|---|---|
| Hub / workspace | `app/(app)/dashboard`, `app/(app)/patients` | Patient roster, per-patient workspace tying all three tools together |
| LP Compass | `app/(app)/compass/**`, `app/api/compass/**` | Sessions, AI roadmaps, recipes, shopping list, patient share pages |
| MicrobiomeRx | `app/(app)/mrx/**`, `app/api/mrx/**` | BugSpeaks stool report analysis |
| Blood Panel | `app/(app)/blood/**`, `app/api/blood/**` | Blood report extraction and marker analysis |
| Patient-facing | `app/share/**`, `app/api/share/**` | The only unauthenticated surface |

Measured 2026-10-06: 81 API routes, 52 pages, 12 migration files in
`supabase/`.

Stack: Next.js 16.3.1, React 19.2.8, Supabase (Postgres + Auth + Storage),
Groq `openai/gpt-oss-20b` (28 call sites) and `openai/gpt-oss-120b` (5), with
Gemini as fallback for oversized or failed Groq requests.

---

## 2. Environments and infrastructure

### Live

| Thing | Value |
|---|---|
| Vercel project | `cliniclivingplus/prism` |
| Live domains | `cliniclivingpluss.com`, `www.cliniclivingpluss.com` |
| Other aliases | `prismanalyzer.vercel.app`, `prism-cliniclivingplus.vercel.app` |
| Serverless region | `bom1` (Mumbai) — set in `vercel.json` |
| Database | Supabase project `cliniclivingplus` (ref `jtidesyasvaiztbxkcgz`) |
| Repo | `github.com/cliniclivingplus-ai/prism`, branch `main` |

### Database layout

One Supabase project, three schemas: `public` (Compass + hub), `mrx`
(MicrobiomeRx), `blood` (Blood Panel). Table names repeat across schemas
(`patients`, `reports`) and are kept apart by schema, never renamed.

### Storage buckets and their real size limits

A bucket's `file_size_limit` is the real ceiling, whatever the UI says.
Measured 2026-10-06:

| Bucket | Limit | Allowed types |
|---|---|---|
| `patient-reports` | 15,000,000 B | PDF, PNG, JPEG, WebP |
| `blood-reports` | 15,728,640 B | PDF, PNG, JPEG, WebP |
| `mrx-reports` | 52,428,800 B | PDF |
| `coach-photos` | 5,000,000 B | PNG, JPEG, WebP |
| `guide-images`, `recipe-images` | 5,242,880 B | any |

**Any client-side size check must match its bucket exactly.** A looser check
lets a file past that Storage then rejects.

### Known gap — one database for everything

Local development, Vercel Preview and Production all point at the **same**
Supabase project. Consequences, stated plainly:

- Running the app locally reads and writes **live patient records**.
- A preview deploy is not a safe sandbox.

A separate development database is agreed as future work, not yet built. The
agreed deploy shape when it is: a `dev` branch that builds preview URLs
automatically, with production staying a manual, deliberate step. Until then,
treat any local or preview session as if it were production, because it is.

---

## 3. Secrets and configuration

Environment variables, all set in Vercel (Production and Preview) and
mirrored in local `.env.local`:

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin client — **canonical name**, never `SUPABASE_SERVICE_KEY` |
| `GROQ_API_KEY`, `GROQ_API_KEY_2` … `_5` | Groq, rotated across keys for rate limits |
| `GEMINI_API_KEY` | Gemini fallback |
| `HUGGINGFACE_API_KEY` | Embeddings for the knowledge base |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY` | Google Drive import |

Rules:

- `.env.local` is never committed. Check `git status` before every commit.
- The service-role key bypasses all row-level security. It may only be used in
  server code (`app/api/**`, server modules in `lib/**`), never shipped to a
  browser bundle.
- Add a new variable to **both** Vercel and `.env.local`, or it works locally
  and fails in production (or the reverse).

---

## 4. Local development

```bash
npm install
# .env.local must exist — copy from the team vault, or: vercel env pull .env.local
npm run dev
```

Notes:

- `predev` / `prebuild` run `scripts/copy-pdf-worker.mjs`, which copies the PDF
  worker from the `pdfjs-dist` copy nested under `react-pdf` into `public/`.
  Do not replace it with a CDN URL (see §7.8).
- Next refuses to run two dev servers from the same folder. If another session
  already has one running, use it rather than starting a second.
- The app is login-gated; `/share/**` links are the only pages viewable
  without a session.

---

## 5. Standard change procedure

1. **Understand the real cause before editing.** Reproduce the symptom and
   find the mechanism. "Network error" turned out to be a 4.5MB platform
   limit; "unsupported Unicode escape" was a NUL byte in PDF text. The
   reported symptom is rarely the cause.
2. **Make the change.** Match the surrounding code's style and comment
   density. Where a non-obvious constraint forced the design, say so in a
   comment — most of §7 exists because someone did.
3. **Type-check: `npx tsc --noEmit -p .` — must be clean (zero errors).**
4. **Lint: `npx eslint <changed files>`.** The repo carries a known baseline of
   **331 errors and 236 warnings** (2026-10-06), mostly `no-explicit-any` and
   React-hooks rules in `components/guide-templates/`. Do not expect zero.
   Compare before and after, and introduce no new ones.
5. **Verify behaviour, don't assume it.** See §6.
6. **Commit** with a message stating what changed and why, in plain language.
   End AI-assisted commits with the agreed `Co-Authored-By` line.
7. **Push** to `main`.

---

## 6. Verification before shipping

Pick what applies; never skip all of it.

| Change touches | How to verify |
|---|---|
| Patient-facing templates | Open a real `/share/roadmap/<token>` page in a browser and look at the section |
| Coach editor | Open the live-edit page (needs a login) and edit a field end to end |
| An API route | Call it with real input; check the status and the stored row |
| Extraction / parsing | Run it over a real file from the clinic, not a synthetic one |
| Categorisation / classification | Run it over the whole real corpus (e.g. all 492 recipes) and read the output |
| Database writes | Confirm the row, then remove any test row you created |

Rules:

- **Test against real data where it is safe to read.** The grocery fix was only
  trustworthy because it ran over all 492 recipes; the upload fix because it
  ran on the coach's actual 6.3MB PDF.
- **Never enter real credentials to test.** If verification needs a login the
  assistant cannot use, say so plainly and ask the user to check that part.
- **Clean up test rows and test files** in the same session you create them.
- **Report honestly.** If something was not verified, say which part and why.

---

## 7. Rules that must not be broken

Each of these was learned the hard way.

**7.1 Everything is gated except a short, explicit list.** The only public
paths, from `PUBLIC_PATHS` in `lib/auth/middleware.ts`: `/login`,
`/reset-password`, `/api/auth/signup`, `/share/**`, `/api/share/**`,
`/_next/**`, `/favicon.ico`, and `/pdf.worker.min.mjs`. Every other route,
including all APIs, requires a session. An inherited middleware that exempted
`/api/*` would expose every patient record. Add to that list only with a
written reason beside the entry, as the existing ones have.

**7.2 Patients are identified by id, never by name.** Any report a tool saves
carries a real foreign key to the hub patient (`clp_patient_id`). Name matching
is permitted only as the documented fallback for historical rows, and it must
refuse to match when two patients share a name.

**7.3 Share links are addressed by `share_token`, never by row id**, so a link
can be revoked without deleting clinical data. Never `select('*')` on a public
path — column-list every field that crosses to a patient's browser. No staff
contact details, no full legal names.

**7.4 No AI-generated clinical doses.** MicrobiomeRx's rules engine is
deterministic; AI writes explanations only. Patient-facing weekly goals are
everyday lifestyle guidance, never dosed escalations. The coach-reviewed
supplements section is the one place real doses belong.

**7.5 Classification is decided by rule, not by the model.** The model may
clean, merge and split names; our code assigns the category (`categorizeItem()`
in `lib/groceryList.ts`). A model files chilli powder with the vegetables often
enough to matter.

**7.6 Sanitise everything file-derived before it reaches the database.**
`stripUnsafeChars()` / `sanitizeForDb()` in `lib/sanitizeDbText.ts`, applied to
raw text and to any AI output stored as jsonb. Postgres rejects a NUL character
outright (SQLSTATE 22P05).

**7.7 Uploads over ~4.5MB must go straight to Storage.** A serverless request
body is capped at 4.5MB on Vercel. The pattern: ask the API for a single-use
signed upload URL, `PUT` the file to Storage from the browser, then post only
the storage path. See `app/api/patients/[id]/reports/upload-url/route.ts`.
Blood Panel extracts in the browser for the same reason — only kilobytes of
text are posted, never page images.

**7.8 The PDF worker must match `react-pdf`'s own `pdfjs-dist` version.**
`react-pdf` pins 5.x while the app's own parsing uses 6.x; pdf.js refuses to run
on a version mismatch. `scripts/copy-pdf-worker.mjs` copies the right one into
`public/` and keeps it same-origin — do not load it from a CDN.

**7.9 pdfjs operator codes are renumbered between majors.** They are resolved by
name from the live `OPS` enum (`lib/mrx/pdfOps.ts`), with a pinned map as
fallback. On any pdfjs major bump, re-derive by name — a silently wrong map
produces wrong clinical output with no error at all.

**7.10 Coach-facing editors never display a link's URL.** Stored text keeps
`[phrase](url)`; the editor shows the phrase and reattaches links on save
(`lib/linkText.ts`). A link carries exactly one URL.

**7.11 Legacy `/dashboard/<id>` and `/checklist/<id>` share URLs 404 on
purpose.** Decided 2026-08-25. Do not re-raise.

---

## 8. Release procedure

Production deploys are manual, by CLI, from the project folder. There is no
GitHub auto-deploy.

```bash
# 1. Pre-flight
git status                 # nothing unintended, no .env files
npx tsc --noEmit -p .      # must be clean

# 2. Commit and push
git add <files>
git commit -m "..."
git push origin main

# 3. Deploy
vercel deploy --prod --yes

# 4. Confirm what went live
vercel ls prism --prod            # newest should be Ready
vercel inspect <deployment-url>   # Aliases should include cliniclivingpluss.com

# 5. Smoke-test the live site, for example
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"items":[{"name":"Chilli powder","category":"Other vegetables"}]}' \
  https://www.cliniclivingpluss.com/api/share/grocery-list
```

Notes:

- A local `next build` is not required; Vercel builds remotely. Avoid running
  one while another session's dev server is using `.next`.
- CLI deploys carry no commit metadata, so `vercel inspect` cannot tell you
  which commit is live. Confirm by testing live behaviour instead.
- More than one person deploys this project. Before assuming a deployment is
  yours, check its age and test for your change.

### Rollback

```bash
vercel ls prism --prod            # find the last good deployment
vercel rollback <deployment-url>  # repoint the aliases to it
```

Rolling back code does **not** undo a database migration or any row the bad
build wrote. Check data separately.

### Database migrations

SQL files live in `supabase/` (`migration_v24` … `v43`). They are applied
against the live database deliberately, outside the deploy. Rules: additive and
nullable wherever possible; never backfill clinical identity by name-matching;
verify a migration is not merely present but *enforcing* (try an insert that
should fail) before depending on it.

---

## 9. Incident log

Newest first. One entry per production problem.

### 2026-10-03 — "Unsupported Unicode escape sequence" on a Blood Panel upload
- **Symptom:** upload failed at the end with that message; retrying never
  helped, on any network or machine.
- **Cause:** the PDF's text layer contained a NUL character, which Postgres
  refuses inside text (SQLSTATE 22P05). It failed at the insert, after parsing,
  OCR and the AI pass had already run. Reproduced against the real database,
  same error text.
- **Fix:** `lib/sanitizeDbText.ts` strips NULs, other C0 control characters and
  unpaired surrogates; applied in Blood Panel (browser extractor, route,
  markers), patient reports (raw text, summary, supplements) and MicrobiomeRx
  (species list, report data). Real text, emoji and non-English characters pass
  through untouched. Commit `67ad489`.

### 2026-10-03 — Shopping list filed items in the wrong aisles
- **Symptom:** chilli powder under vegetables, vegetables under Fruit.
- **Cause:** the final category came straight from the model's own answer,
  unchecked. Behind it, the fallback categoriser matched substrings, so
  "peanut" read as a pea.
- **Fix:** the model now only cleans and merges names; `categorizeItem()`
  assigns every category. Whole-word matching, spice and pantry forms to the
  spices, longest keyword wins across categories, plural and spelling variants
  (`daal` / `dhal`), plus many missing keywords. Across all 492 recipes,
  unsorted items fell from 322 to 224. Commit `159b9b8`.

### 2026-09-29 — Report upload failed above ~4.5MB
- **Symptom:** "File size exceeds maximum upload limit" or a network error on a
  6.3MB PDF, on every network and machine, though the UI promised 15MB.
- **Cause:** the browser posted the file through our API; Vercel caps a
  serverless request body at ~4.5MB, so the request died before our code ran.
- **Fix:** signed-URL upload straight to Storage, with only the storage path
  posted to the API (§7.7); client size check aligned to the bucket's real
  limit. Verified on the coach's actual 6.3MB report. Commit `896a272`.

### 2026-09-11 — Raw link markup shown to coaches; links holding two URLs
- **Symptom:** `[yoga](https://…)` visible in the editor; some links dead.
- **Cause:** editors displayed stored text verbatim. Separately, 14 rows in the
  seeded keyword-link bank held two URLs joined by `; `, which is not valid
  link syntax, so patients saw raw URLs too.
- **Fix:** editors show the phrase and reattach links on save
  (`lib/linkText.ts`); multi-URL links normalise to the first URL everywhere;
  auto-link, the Link button and the keyword API refuse to create them. Commit
  `ca41028`.

### Earlier
See `CLAUDE.md` for the pre-merge audit findings and the pdfjs 5→6 operator
renumbering, which belongs to the same class of silent-wrong-output bug (§7.9).

---

## 10. Troubleshooting runbook

| Symptom | Likely cause | First action |
|---|---|---|
| Upload fails on big files only | Request-body limit (§7.7) | Check the file is over ~4.5MB; route it through a signed Storage URL |
| "Unsupported Unicode escape sequence" | NUL in file-derived text (§7.6) | Confirm the write passes through `sanitizeDbText` |
| Upload rejected though under the stated limit | Client cap looser than the bucket's | Compare the check against the bucket's `file_size_limit` |
| Extraction returns nothing from a PDF | No text layer (a scan) | Expect the OCR path; a near-empty result means the scan is too poor to read |
| AI step fails intermittently | Groq rate limit (429) | Retry after a minute; check key rotation and request size |
| Patient's panel empty though a report exists | Identity resolution (§7.2) | Check `clp_patient_id` on the report row; duplicates by name are refused on purpose |
| A share link 404s | Legacy URL, or revoked token (§7.3, §7.11) | Check `share_token` and `share_revoked_at` |
| PDF viewer blank, or a worker error | Worker/API version mismatch (§7.8) | Re-run `scripts/copy-pdf-worker.mjs`; confirm the version it copied |
| Dev server will not start | Another session already has one | Use the running one; do not start a second in the same folder |

---

## 11. Routine maintenance

| Task | Cadence | Notes |
|---|---|---|
| Review this SOP against reality | Monthly, and after any incident | Re-measure the figures in §1–§3 |
| Re-check the lint baseline (§5) | Monthly | It should fall over time, never rise |
| Review Groq / Gemini key headroom | Monthly | Rate limits are shared across the whole app |
| Check storage growth per bucket | Quarterly | Reports accumulate and buckets have hard limits |
| Dependency updates | As needed | Treat pdfjs and react-pdf as a pair (§7.8, §7.9) |

---

## 12. Open items

- **Separate development database** — agreed in principle, not built. Until it
  exists, local and preview work touches live patient data (§2).
- **`dev` branch with automatic previews, production staying manual** — agreed
  shape, not yet configured.
- **Uploads still posting through the API:** "Upload notes" and the
  MicrobiomeRx report upload will fail above ~4.5MB for the reason in §7.7.
- **`mrx.reports.patient_id` empty on 207 historical rows** — a data-integrity
  decision, deliberately not fixed from application code. See `CLAUDE.md`.
