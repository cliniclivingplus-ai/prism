// Reviewed, idempotent import. Dry-run by default; --prepare writes the
// catalogue protection manifest, --write requires it to be deployed first.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const directory = '.lowfodmap-import'
const manifestPath = 'lib/pdf/recipeCatalogueSnapshot.json'
const recipes = JSON.parse(readFileSync(`${directory}/parsed.json`, 'utf8'))
const write = process.argv.includes('--write')
const prepare = process.argv.includes('--prepare')

// Explicit matches reviewed against ingredients AND directions, including
// aliases and truncated old imports. Similar names alone aren't duplicates.
const matches = {
  'Tofu Scramble': '4b4f82f0-983e-43d5-afcc-62f0faa405a6',
  'Moong Daal Dosa': '9102320e-43cf-4b72-9d62-af1972fdae7a',
  'Vegetable Daal': '7b884c9c-d6f1-40b0-b383-ed8bbe3ba2ba',
  'Soybean Curry with Brown Rice': 'bfb58165-8a67-41fe-b02f-75ae510f1bc2',
  'Broccoli Chickpea Curry': 'd23af349-20d5-49c0-9872-e75f1cb07792',
  'Jowar Roti Wraps': '83de3fd4-d50d-4657-9721-01d527be5103',
  'Red Lentil Curry': 'd391f2f0-f51b-47c0-b481-6f23dbac2dc8',
  'Roasted Pumpkin Soup': 'aeb05c81-6b35-4947-9a05-7739397cc73c',
  'Tofu Stir Fry': '8a69c69b-c074-430c-9896-94e7694d9eef',
  'Sweet Potato Hash': '8fedd9f4-a327-4a9c-b0af-7468d95b7e83',
  'Kale Crisps': '6fac1ae3-8c93-41c6-8b38-fa75f721b81e',
  'Hummus Dip': 'eb8b4a49-c282-4f34-9cc4-d3a959247a0e',
  'Mint Gazpacho': 'a8f0e70b-77aa-4df8-afc7-b27b8d39d36f',
  'Little Millet Uttapam': '4ef8670e-a89f-47fc-9cbc-618d5f0ded26',
  'Beetroot Neer Dosa': '7f5e1951-23f1-4c1a-ba1f-620443cb313c',
  'Barnyard Rasam Rice': '4cb58c0a-717c-4ca2-97cc-f0d97110b982',
  'Buttermilk Curry': '3a17d849-da43-4ac5-af3f-fda19658dcfb',
  'Ridge Gourd Kootu': 'b7a858df-c442-44b4-b042-f17b066041fc',
  'Chow Chow Chutney': 'b77d31db-ccbc-48ba-9033-a9be1beecf09',
  'Spiced Kohlrabi Soup': '619f9365-a507-4c4c-af4f-55eaaf747908',
  'One Pot Sesame Carrot Soup': 'f0c3be90-187a-4a02-95bf-54b2f7b28e3a',
}
const variantNames = {
  'Quinoa Porridge': 'Quinoa Porridge with Banana & Chia',
  'Quinoa Khichadi': 'Quinoa Khichadi with Cabbage Poriyal',
  'Matcha Energy Balls': 'Matcha Energy Balls with Dates & Almonds',
  'Millets Pulao': 'Kodo Millet Pulao',
}
async function readAll(table, columns = '*') {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from(table).select(columns).range(offset, offset + 999)
    if (error) throw Error(error.message)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
const bank = await readAll('recipe_bank')
const byId = new Map(bank.map((r) => [r.id, r]))
const normalize = (s) => s.toLowerCase().replace(/daal|dhal/g, 'dal').replace(/[^a-z0-9]/g, '')
const hash = (row) => createHash('sha256').update(JSON.stringify(row)).digest('hex')
const fields = ['name', 'ingredients', 'steps', 'servings', 'prep_time', 'cook_time', 'notes', 'tags']
const changes = []
for (const recipe of recipes) {
  if (/pradeepa|sushil|trail mix/i.test(JSON.stringify(recipe))) throw Error('Identity or excluded recipe found')
  const name = variantNames[recipe.name] || recipe.name
  const existing = matches[recipe.name] ? byId.get(matches[recipe.name]) : bank.find((r) => normalize(r.name) === normalize(name))
  if (matches[recipe.name] && !existing) throw Error(`Reviewed duplicate disappeared: ${recipe.name}`)
  const row = Object.fromEntries(fields.map((key) => [key, recipe[key]]))
  row.name = name
  row.tags = [...new Set([...(existing?.tags || []), ...recipe.tags])]
  row.notes = [...new Set([...(existing?.notes || []), ...recipe.notes])]
  changes.push({ sourceName: recipe.name, id: existing?.id || null, row, ...(existing ? {} : { meal_type: recipe.meal_type, tools: [], benefits: [] }) })
}
const updates = changes.filter((c) => c.id)
const inserts = changes.filter((c) => !c.id)
console.log(`${recipes.length} recipes: ${inserts.length} new, ${updates.length} existing records reused; Trail Mix excluded.`)
console.log('New variants: ' + inserts.map((r) => r.row.name).join('; '))
const report = recipes.filter((r) => r.flags.length).map((r) => ({ name: variantNames[r.name] || r.name, source: r.source, page: r.page, flags: r.flags }))
writeFileSync(`${directory}/review-flags.json`, JSON.stringify(report, null, 2))

if (prepare) {
  if (existsSync(`${directory}/applied.json`)) throw Error('Import already applied; do not replace its historical snapshot')
  const snapshot = {
    cutoff: new Date().toISOString(),
    ids: bank.map((r) => r.id),
    previousValues: Object.fromEntries(updates.map((c) => [c.id, Object.fromEntries(fields.map((key) => [key, byId.get(c.id)[key]]))])),
  }
  writeFileSync(manifestPath, JSON.stringify(snapshot, null, 2) + '\n')
  writeFileSync(`${directory}/bank-before.json`, JSON.stringify(bank, null, 2))
  writeFileSync(`${directory}/plan.json`, JSON.stringify({ bankHashes: Object.fromEntries(bank.map((r) => [r.id, hash(r)])), changes }, null, 2))
  console.log(`Prepared protection snapshot for ${bank.length} bank records. No database writes.`)
}
if (!write) { console.log('DRY RUN: no database changes.'); process.exit(0) }
if (existsSync(`${directory}/applied.json`)) {
  const applied = JSON.parse(readFileSync(`${directory}/applied.json`, 'utf8'))
  if (!applied.completed) throw Error('A partial import log exists. Review or roll back its recorded IDs before retrying.')
  console.log('Already applied; nothing written.'); process.exit(0)
}
if (!process.argv.includes('--protection-deployed')) throw Error('Deploy and verify catalogue protection before writing')
const plan = JSON.parse(readFileSync(`${directory}/plan.json`, 'utf8'))
const snapshot = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (bank.length !== snapshot.ids.length || bank.some((r) => hash(r) !== plan.bankHashes[r.id])) throw Error('Recipe bank changed since preparation; re-review before import')
if (JSON.stringify(changes) !== JSON.stringify(plan.changes)) throw Error('Reviewed import changed; prepare and deploy again')
const { count, error: countError } = await db.from('roadmaps').select('id', { count: 'exact', head: true }).gt('created_at', snapshot.cutoff)
if (countError) throw Error(countError.message)
if (count) throw Error('A new dashboard was created after preparation. Refresh/deploy the protection snapshot first.')
const log = { cutoff: snapshot.cutoff, updated: [], inserted: [] }
const saveLog = () => writeFileSync(`${directory}/applied.json`, JSON.stringify(log, null, 2))
saveLog()
for (const change of updates) {
  const { data, error } = await db.from('recipe_bank').update(change.row).eq('id', change.id).select('id').single()
  if (error || !data) throw Error(error?.message || 'Update changed no row')
  log.updated.push(change.id); saveLog()
}
for (const change of inserts) {
  const { data, error } = await db.from('recipe_bank').insert({ ...change.row, meal_type: change.meal_type, tools: [], benefits: [] }).select('id, name').single()
  if (error) throw Error(error.message)
  log.inserted.push(data); saveLog()
}
log.completed = true
saveLog()
console.log(`Applied: ${log.inserted.length} inserted, ${log.updated.length} reused. Rollback IDs and original values retained locally.`)
