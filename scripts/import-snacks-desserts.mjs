// Reviewed category import. Dry-run by default. Deploy the new catalogue
// snapshot before --write. Every mutation is logged locally for rollback.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const directory = '.snack-dessert-import'
const manifestPath = 'lib/pdf/recipeCatalogueSnackDessertSnapshot.json'
const parsed = JSON.parse(readFileSync(`${directory}/parsed.json`, 'utf8'))
const matches = {
  'Air Fryer Carrot / Beetroot Chips': 'a63699f4-8d62-4e6a-a4d5-e630b40da787',
  '3 Seed Cracker': 'da9f50e1-b7a4-4b7b-bbb3-56194597a35d',
  'Bajra Cracker': 'dc57bb4d-43f8-43cc-ab6f-1b71eaab8c0c',
  'Roasted Chickpeas': '15cc9024-6eef-48f7-9615-5f1cc5818e92',
  'Roasted Spicy Edamame': '7251af67-aee3-4df6-88fe-c4ac22d422fd',
  'Apple Chips': '0622d81f-f057-4f5b-b983-23bb9b28efb8',
  'Kale Chips': '9de3f93b-65a0-4c88-8894-4efdfc711e41',
  'Date & Quinoa Pops': '7123678c-d387-4a4a-afc5-f51c7d971f3d',
  'Sattu Protein Bars': '8b9a58e1-444a-41c6-87a1-88bef24bb4b2',
  'Vegan Chocolate Cake': 'c03b98cf-8bee-4e37-9ec9-0b9e93f45124',
  'Oil-Free Hummus': '9a59ba57-de69-4b8f-b93f-5572fefb23d1',
  'Jowar Khakhra': 'f546b275-a33f-4477-8fd9-81ee7e0b5806',
  'Mini Peanut Butter Cups': '158f17fd-653d-4ca9-9f85-28a09542e093',
  'Avocado Cacao Mousse': 'd50d063b-a5d6-41ba-8e20-430c61bb5c48',
  'Cashew Blueberry Oatmeal Cookies': '3ff80749-ed12-46e1-b8de-5e217392b48e',
  'Cacao Energy Balls with Walnuts & Dates': '850bf98c-37d2-49c3-91e6-fc226d81ec4b',
  'Fudgy Brownie': 'c5ffc9de-5a66-4ebe-b3d6-c494f0c03d37',
  'Vegan Ice Cream': '79607d9c-0dda-45a0-82dd-b51e14c2773e',
}
const variantNames = { 'Oat Bites': 'Oat Bites with Figs & Raisins' }
const sourceRecipes = new Map()
for (const recipe of parsed) {
  if (/ankita|anita|williams|salwa|arshad|poonam/i.test(JSON.stringify(recipe))) throw Error('Cover identity found in recipe')
  const existing = sourceRecipes.get(recipe.name)
  if (existing) {
    existing.notes = [...new Set([...existing.notes, ...recipe.notes])]
    existing.tags = [...new Set([...existing.tags, ...recipe.tags])]
    existing.review = [...new Set([...existing.review, ...recipe.review])]
  } else sourceRecipes.set(recipe.name, structuredClone(recipe))
}
const recipes = [...sourceRecipes.values()]
if (parsed.length !== 41 || recipes.length !== 36) throw Error('Unexpected source/merged recipe counts')
async function all(table, columns = '*') {
  const result = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from(table).select(columns).range(start, start + 999)
    if (error) throw Error(error.message)
    result.push(...data)
    if (data.length < 1000) return result
  }
}
const bank = await all('recipe_bank')
const byId = new Map(bank.map((r) => [r.id, r]))
const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
const hash = (row) => createHash('sha256').update(JSON.stringify(row)).digest('hex')
const fields = ['name', 'ingredients', 'steps', 'servings', 'prep_time', 'cook_time', 'notes', 'tags']
const changes = recipes.map((recipe) => {
  const name = variantNames[recipe.name] || recipe.name
  const existing = matches[recipe.name] ? byId.get(matches[recipe.name]) : bank.find((r) => normalize(r.name) === normalize(name))
  if (matches[recipe.name] && !existing) throw Error(`Reviewed duplicate missing: ${name}`)
  const row = Object.fromEntries(fields.map((key) => [key, recipe[key]]))
  row.name = name
  row.tags = [...new Set([...(existing?.tags || []), ...recipe.tags])]
  row.notes = [...new Set([...(existing?.notes || []), ...recipe.notes])]
  return { id: existing?.id || null, row, meal_type: recipe.meal_type }
})
const updates = changes.filter((c) => c.id), inserts = changes.filter((c) => !c.id)
const report = recipes.filter((r) => r.review.length).map((r) => ({ name: variantNames[r.name] || r.name, flags: r.review }))
writeFileSync(`${directory}/review-flags.json`, JSON.stringify(report, null, 2))
writeFileSync(`${directory}/merged-recipes.json`, JSON.stringify(recipes, null, 2))
console.log(`${parsed.length} source entries -> ${recipes.length} unique recipes: ${inserts.length} new, ${updates.length} existing records reused; ${report.length} source-review flags.`)
console.log('Categories: '+JSON.stringify(Object.fromEntries(['snacks','desserts'].map((tag) => [tag, recipes.filter((r) => r.tags.includes(tag)).length]))))
if (process.argv.includes('--prepare')) {
  if (existsSync(`${directory}/applied.json`)) throw Error('Do not replace a snapshot after importing')
  const snapshot = { cutoff: new Date().toISOString(), ids: bank.map((r) => r.id), previousValues: Object.fromEntries(updates.map((c) => [c.id, Object.fromEntries(fields.map((key) => [key, byId.get(c.id)[key]]))])) }
  writeFileSync(manifestPath, JSON.stringify(snapshot, null, 2)+'\n')
  writeFileSync(`${directory}/bank-before.json`, JSON.stringify(bank, null, 2))
  writeFileSync(`${directory}/plan.json`, JSON.stringify({ bankHashes: Object.fromEntries(bank.map((r) => [r.id, hash(r)])), changes }, null, 2))
  console.log('Prepared additional protection snapshot. Previous Low FODMAP snapshot untouched.')
}
if (!process.argv.includes('--write')) { console.log('DRY RUN: no database writes.'); process.exit(0) }
if (existsSync(`${directory}/applied.json`)) {
  const log = JSON.parse(readFileSync(`${directory}/applied.json`, 'utf8'))
  if (!log.completed) throw Error('Partial import: review recorded mutations before retrying')
  console.log('Already applied; nothing written.'); process.exit(0)
}
if (!process.argv.includes('--protection-deployed')) throw Error('Deploy and verify catalogue protection before importing')
const snapshot = JSON.parse(readFileSync(manifestPath, 'utf8'))
const plan = JSON.parse(readFileSync(`${directory}/plan.json`, 'utf8'))
if (bank.length !== snapshot.ids.length || bank.some((r) => plan.bankHashes[r.id] !== hash(r))) throw Error('Bank changed since preparation. Re-review before import.')
if (JSON.stringify(changes) !== JSON.stringify(plan.changes)) throw Error('Import plan changed. Re-prepare and deploy first.')
const { count, error: countError } = await db.from('roadmaps').select('id', { count: 'exact', head: true }).gt('created_at', snapshot.cutoff)
if (countError) throw Error(countError.message)
if (count) throw Error('A new roadmap appeared. Extend and redeploy protection before import.')
const log = { cutoff: snapshot.cutoff, updated: [], inserted: [], completed: false }
const save = () => writeFileSync(`${directory}/applied.json`, JSON.stringify(log, null, 2))
save()
for (const change of updates) {
  const { data, error } = await db.from('recipe_bank').update(change.row).eq('id', change.id).select('id').single()
  if (error || !data) throw Error(error?.message || 'No updated row')
  log.updated.push(change.id); save()
}
for (const change of inserts) {
  const { data, error } = await db.from('recipe_bank').insert({ ...change.row, meal_type: change.meal_type, tools: [], benefits: [] }).select('id, name').single()
  if (error) throw Error(error.message)
  log.inserted.push(data); save()
}
log.completed = true; save()
console.log(`Applied ${log.inserted.length} inserts and ${log.updated.length} updates. Rollback audit saved locally.`)
