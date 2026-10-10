// One-off importer for .recipes_parsed.json -> public.recipe_bank.
// Idempotent: skips a row whose name + meal_type already exists, so a repeat
// run cannot duplicate the collection. Writes the inserted ids to
// .recipes_imported.json so the import can be undone precisely.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
})

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const recipes = JSON.parse(readFileSync('.recipes_parsed.json', 'utf8'))
const dryRun = !process.argv.includes('--write')

const { data: existing, error: readErr } = await db.from('recipe_bank').select('name, meal_type')
if (readErr) throw new Error(readErr.message)
const seen = new Set(existing.map((r) => `${r.name.trim().toLowerCase()}|${r.meal_type}`))

const rows = []
const skipped = []
for (const r of recipes) {
  const key = `${r.name.trim().toLowerCase()}|${r.meal_type}`
  if (seen.has(key)) { skipped.push(r.name); continue }
  rows.push({
    name: r.name,
    meal_type: r.meal_type,
    ingredients: r.ingredients,
    steps: r.steps,
    prep_time: r.prep_time,
    cook_time: r.cook_time,
    servings: r.servings,
    notes: r.notes,
    tags: r.tags,
    tools: [],
    benefits: [],
  })
}

console.log(`${recipes.length} parsed · ${rows.length} to insert · ${skipped.length} already present`)
if (skipped.length) console.log('  already present:', skipped.join('; '))

if (dryRun) {
  console.log('\nDRY RUN — nothing written. Re-run with --write to insert.')
  process.exit(0)
}

const { data, error } = await db.from('recipe_bank').insert(rows).select('id, name, meal_type')
if (error) throw new Error(error.message)
writeFileSync('.recipes_imported.json', JSON.stringify(data, null, 2))
console.log(`\ninserted ${data.length} recipes; ids written to .recipes_imported.json`)
