import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, extname } from 'node:path'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'

// Exercise the actual TypeScript catalogue, matcher and grocery functions
// without starting Next or generating any patient content.
const loaded = new Map()
function load(file) {
  const path = resolve(file)
  if (loaded.has(path)) return loaded.get(path)
  if (extname(path) === '.json') return JSON.parse(readFileSync(path, 'utf8'))
  const compiledModule = { exports: {} }
  loaded.set(path, compiledModule.exports)
  const nativeRequire = createRequire(path)
  const localRequire = (name) => {
    if (!name.startsWith('.')) return nativeRequire(name)
    const target = resolve(dirname(path), name)
    const candidate = [target, `${target}.ts`, `${target}.tsx`, `${target}.json`].find(existsSync)
    if (!candidate) throw Error(`Cannot resolve ${name}`)
    return load(candidate)
  }
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(js, { module: compiledModule, exports: compiledModule.exports, require: localRequire, Date, Map, Object })
  return compiledModule.exports
}
const snapshot = load('lib/pdf/recipeCatalogueSnapshot.json')
const latestCutoff = existsSync('lib/pdf/recipeCatalogueSnackDessertSnapshot.json')
  ? load('lib/pdf/recipeCatalogueSnackDessertSnapshot.json').cutoff : snapshot.cutoff
const before = load('.lowfodmap-import/bank-before.json')
const plan = load('.lowfodmap-import/plan.json')
const { recipeCatalogueForPlan } = load('lib/pdf/recipeCatalogue.ts')
const { selectRecipesForPatient } = load('lib/pdf/matchRecipes.ts')
const { buildGroceryList } = load('lib/groceryList.ts')
let after = before.map((r) => {
  const change = plan.changes.find((c) => c.id === r.id)
  return change ? { ...r, ...change.row } : r
}).reverse()
for (const change of plan.changes.filter((c) => !c.id)) after.push({ id: `new-${change.row.name}`, ...change.row })
if (process.argv.includes('--live')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await db.from('recipe_bank').select('*').range(0, 999)
  if (error) throw Error(error.message)
  if (data.length >= 1000) throw Error('Use paginated verification for a bank of 1000 or more recipes')
  after = data
  const { count, error: roadmapError } = await db.from('roadmaps').select('id', { count: 'exact', head: true }).lte('created_at', snapshot.cutoff)
  if (roadmapError) throw Error(roadmapError.message)
  console.log(`Existing roadmaps covered by catalogue protection: ${count}`)
  const applied = load('.lowfodmap-import/applied.json')
  // Later imports can extend the live bank. Inspect the protected catalogue
  // for plans made immediately after this import when checking its records.
  const lowFodmapCatalogue = recipeCatalogueForPlan(new Date(Date.parse(snapshot.cutoff) + 1).toISOString(), after)
  assert.equal(lowFodmapCatalogue.length, before.length + applied.inserted.length)
  for (const change of plan.changes) {
    const row = lowFodmapCatalogue.find((r) => change.id ? r.id === change.id : r.name === change.row.name)
    assert.ok(row, `Missing ${change.row.name}`)
    for (const [key, value] of Object.entries(change.row)) assert.equal(JSON.stringify(row[key]), JSON.stringify(value), `${row.name}: ${key}`)
  }
}
const restored = recipeCatalogueForPlan(snapshot.cutoff, after)
assert.equal(JSON.stringify(restored), JSON.stringify(before), 'Every old bank field and its order must be unchanged')
assert.strictEqual(recipeCatalogueForPlan(new Date(Date.parse(latestCutoff) + 1).toISOString(), after), after)
const keys = ['id', 'name', 'meal_type', 'protein_label', 'ingredients', 'steps', 'tags']
const project = (rows) => rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])))
assert.equal(JSON.stringify(recipeCatalogueForPlan('2020-01-01', project(after))), JSON.stringify(project(before)))
for (const concern of ['low fodmap', 'diabetes', 'gut healing', 'PCOS', '']) {
  const opts = { primaryConcern: concern, dietProtocol: [] }
  const a = selectRecipesForPatient(opts, before), b = selectRecipesForPatient(opts, restored)
  assert.equal(JSON.stringify(a), JSON.stringify(b))
  assert.equal(JSON.stringify(buildGroceryList(Object.values(a).flat().map((m) => m.recipe))), JSON.stringify(buildGroceryList(Object.values(b).flat().map((m) => m.recipe))))
}
const recipes = load('.lowfodmap-import/parsed.json')
assert.equal(recipes.length, 29)
assert.ok(!recipes.some((r) => /trail mix|pradeepa|sushil/i.test(JSON.stringify(r))))
assert.ok(recipes.every((r) => r.tags.includes('low-fodmap') && r.ingredients && r.steps))
const rasam = recipes.find((r) => r.name === 'Barnyard Rasam Rice')
assert.ok(rasam.ingredients.includes('1 tablepoon rasam powder'))
assert.ok(rasam.steps.indexOf('Mix everything well.') < rasam.steps.indexOf('Pour 2 cups'))
assert.ok(recipes.find((r) => r.name === 'Kale Crisps').ingredients.includes('2 tbsp nutritional yeast'))
assert.equal(recipes.find((r) => r.name === 'Zucchini & Carrot Paratha').servings, null)
console.log('PASS: old catalogue and PDF fields exactly preserved; auto-matches and groceries unchanged; new plans use expanded bank; source extraction and privacy checks passed.')
