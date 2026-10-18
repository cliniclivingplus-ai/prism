import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, extname } from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'

const cache = new Map()
function load(file, source) {
  const path = resolve(file)
  if (!source && cache.has(path)) return cache.get(path)
  if (extname(path) === '.json') return JSON.parse(readFileSync(path, 'utf8'))
  const compiledModule = { exports: {} }
  const nativeRequire = createRequire(path)
  const localRequire = (name) => {
    if (!name.startsWith('.')) return nativeRequire(name)
    const target = resolve(dirname(path), name)
    const candidate = [target, `${target}.ts`, `${target}.tsx`, `${target}.json`].find(existsSync)
    if (!candidate) throw Error(`Cannot resolve ${name}`)
    return load(candidate)
  }
  const js = ts.transpileModule(source || readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(js, { module: compiledModule, exports: compiledModule.exports, require: localRequire, Date, Map, Object })
  if (!source) cache.set(path, compiledModule.exports)
  return compiledModule.exports
}
const directory = '.snack-dessert-import'
const oldSnapshot = load('lib/pdf/recipeCatalogueSnapshot.json')
const snapshot = load('lib/pdf/recipeCatalogueSnackDessertSnapshot.json')
const before = load(`${directory}/bank-before.json`)
const plan = load(`${directory}/plan.json`)
// Compare with the actual implementation deployed before this import.
const previousCode = execFileSync('git', ['show', 'fe9164c:lib/pdf/recipeCatalogue.ts'], { encoding: 'utf8' })
const previousCatalogue = load('lib/pdf/recipeCatalogue.ts', previousCode).recipeCatalogueForPlan
const { recipeCatalogueForPlan } = load('lib/pdf/recipeCatalogue.ts')
const { selectRecipesForPatient } = load('lib/pdf/matchRecipes.ts')
const { buildGroceryList } = load('lib/groceryList.ts')
const { recipeInCategory } = load('lib/recipeCategories.ts')
const { filterRecipeBank } = load('lib/recipeBankSearch.ts')
assert.ok(Date.parse(snapshot.cutoff) > Date.parse(oldSnapshot.cutoff))
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
  after = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('recipe_bank').select('*').range(offset, offset + 999)
    if (error) throw Error(error.message)
    after.push(...data)
    if (data.length < 1000) break
  }
  const log = load(`${directory}/applied.json`)
  assert.ok(log.completed)
  assert.equal(after.length, before.length + log.inserted.length)
  for (const change of plan.changes) {
    const recipe = after.find((r) => change.id ? r.id === change.id : r.name === change.row.name)
    assert.ok(recipe, `Missing ${change.row.name}`)
    for (const [key, value] of Object.entries(change.row)) assert.equal(JSON.stringify(recipe[key]), JSON.stringify(value), `${recipe.name}: ${key}`)
  }
  const { count, error } = await db.from('roadmaps').select('id', { count: 'exact', head: true }).lte('created_at', snapshot.cutoff)
  if (error) throw Error(error.message)
  console.log(`Existing roadmaps protected: ${count}`)
}
const projection = (rows) => rows.map((r) => Object.fromEntries(['id', 'name', 'meal_type', 'protein_label', 'ingredients', 'steps', 'tags'].map((key) => [key, r[key]])))
for (const date of [oldSnapshot.cutoff, snapshot.cutoff]) {
  const expected = previousCatalogue(date, before)
  const restored = recipeCatalogueForPlan(date, after)
  assert.equal(JSON.stringify(restored), JSON.stringify(expected), 'Existing catalogue data and order must be unchanged')
  assert.equal(JSON.stringify(recipeCatalogueForPlan(date, projection(after))), JSON.stringify(previousCatalogue(date, projection(before))), 'PDF projection changed')
  for (const concern of ['low fodmap', 'diabetes', 'gut healing', 'PCOS', '']) {
    const options = { primaryConcern: concern, dietProtocol: [] }
    const a = selectRecipesForPatient(options, expected), b = selectRecipesForPatient(options, restored)
    assert.equal(JSON.stringify(a), JSON.stringify(b))
    assert.equal(JSON.stringify(buildGroceryList(Object.values(a).flat().map((r) => r.recipe))), JSON.stringify(buildGroceryList(Object.values(b).flat().map((r) => r.recipe))))
  }
}
assert.strictEqual(recipeCatalogueForPlan(new Date(Date.parse(snapshot.cutoff) + 1).toISOString(), after), after)
const source = load(`${directory}/parsed.json`), merged = load(`${directory}/merged-recipes.json`)
assert.equal(source.length, 41); assert.equal(merged.length, 36)
assert.ok(!/ankita|anita|williams|salwa|arshad|poonam/i.test(JSON.stringify(merged)))
assert.ok(load(`${directory}/extraction-audit.json`).every((r) => !r.unaccountedBodyItems.length))
for (const name of ['Oil-Free Hummus', 'Jowar Khakhra', 'Oil-Free Popcorn', 'Roasted Chickpeas', 'Baked Broccoli']) assert.ok(merged.find((r) => r.name === name).tags.includes('snacks'))
for (const category of ['snacks', 'desserts']) assert.equal(filterRecipeBank(merged, category, '').length, merged.filter((r) => r.tags.includes(category)).length)
assert.ok(recipeInCategory({ tags: ['snack'] }, 'snacks')); assert.ok(recipeInCategory({ tags: ['dessert'] }, 'desserts'))
const shake = source.find((r) => r.name === 'Chocolate Protein Shake')
assert.ok(shake.ingredients.includes('1 scoop plant protein powder')); assert.ok(shake.ingredients.includes('250 ml unsweetened soy milk'))
assert.equal(shake.steps, 'Blend until smooth.')
assert.ok(source.find((r) => r.name === 'Sattu Shake').ingredients.includes('For one shake:'))
console.log('PASS: 41 source entries merged into 36 recipes; categories/search, privacy, split-page extraction, chained catalogue preservation, PDF data, automatic matches and shopping lists verified.')
