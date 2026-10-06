# prism

Living Plus clinician workspace — LP Compass, MicrobiomeRx and Blood Panel in
one Next.js app, deployed at [cliniclivingpluss.com](https://www.cliniclivingpluss.com).

## Start here

| Document | What it covers |
|---|---|
| [`docs/SOP.md`](docs/SOP.md) | **Operating manual.** Environments, local setup, how to change and ship, rules that must not be broken, incident log, troubleshooting runbook |
| [`CLAUDE.md`](../CLAUDE.md) | Architecture, the three-tool merge history, and the decisions behind it |
| [`supabase/`](supabase/) | Database migrations, applied deliberately outside the deploy |

## Run it locally

```bash
npm install
# .env.local must exist — copy from the team vault, or: vercel env pull .env.local
npm run dev
```

Local development currently points at the **live** database. See
`docs/SOP.md` §2 before you run anything that writes.

## Ship it

```bash
npx tsc --noEmit -p .      # must be clean
git push origin main
vercel deploy --prod --yes
```

Full procedure, including verification and rollback, in `docs/SOP.md` §8.
