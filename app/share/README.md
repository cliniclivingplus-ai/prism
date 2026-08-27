# /share — patient-facing routes

Ported in Step 2, from Compass's `app/dashboard/[roadmapId]` and
`app/checklist/[checklistId]`:

| Old (Compass)             | New                            |
| ------------------------- | ------------------------------ |
| `/dashboard/<roadmapId>`  | `/share/roadmap/<share_token>` |
| `/checklist/<checklistId>`| `/share/checklist/<share_token>`|

`/dashboard` in the merged app is the clinician roster, which is why these
move rather than staying put.

Old links keep working if Step 2 adds a redirect from the legacy paths that
looks the row up by id and 301s to its token URL. Decide before cutover
whether to keep that shim permanently or expire it.
