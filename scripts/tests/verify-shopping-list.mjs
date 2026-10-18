import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const modules = new Map()
export function load(file, mocks = {}) {
  const full = path.resolve(file)
  if (modules.has(full) && !Object.keys(mocks).length) return modules.get(full)
  if (full.endsWith('.json')) return JSON.parse(fs.readFileSync(full, 'utf8'))
  const exports = {}
  const native = createRequire(full)
  function require(name) {
    if (name in mocks) return mocks[name]
    if (name.startsWith('.') || name.startsWith('@/')) {
      const target = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(full), name)
      const candidate = [target, target + '.ts', target + '.tsx', target + '.json'].find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
      if (candidate) return load(candidate, mocks)
    }
    return native(name)
  }
  const compiled = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  vm.runInNewContext(compiled, { exports, module: { exports }, require, fetch: (...args) => globalThis.fetch(...args), console, setTimeout, clearTimeout })
  if (!Object.keys(mocks).length) modules.set(full, exports)
  return exports
}
const { extractRecipeShoppingList: extract, shoppingCategory: category, normalizeShoppingDraft: normalize } = load('lib/recipeShoppingList.ts')
const items = (result) => result.categories.flatMap((cat) => cat.items).map((x) => x.toLowerCase())
const recipes = [{ id: 'a', name: 'Test recipe', ingredients: '2 potatoes, chopped\nPotato fryy\n1 green chilli\n1 tsp red chilli powder\n1 apple\n1 cup millet\n1 tbsp coriander powder\nCoriander leaves\n1 tsp garlic powder\n2 cloves garlic\n1/2 cup oat milk\n2 tbsp oat flour\n1 cup oats\nHeat a pan and stir for 10 minutes\nFor the sauce:' }]
const extracted = extract(recipes)
const list = items(extracted)
assert.equal(list.filter((name) => name === 'potato').length, 1)
for (const name of ['green chilli', 'chilli powder', 'apple', 'millet', 'coriander powder', 'coriander leaves', 'garlic powder', 'garlic', 'oat milk', 'oat flour', 'oats']) assert.ok(list.includes(name), `${name}: ${JSON.stringify(extracted)}`)
assert.ok(!list.some((name) => /fry|heat|minutes|sauce/.test(name)))
for (const [food, head] of [['Apple', 'Fruit'], ['Peaches', 'Fruit'], ['Radishes', 'Cruciferous vegetables'], ['Almonds', 'Nuts & seeds'], ['Millet', 'Grains & millets'], ['Tomato', 'Other vegetables'], ['Green chilli', 'Other vegetables'], ['Chilli powder', 'Herbs, spices & pantry'], ['Coriander powder', 'Herbs, spices & pantry'], ['Pumpkin seeds', 'Nuts & seeds'], ['Oat flour', 'Grains & millets'], ['Oat milk', 'Lentils & protein'], ['Amaranth leaves', 'Green vegetables & leafy greens']]) assert.equal(category(food), head, food)
assert.equal(items(extract([])).length, 0)
assert.equal(items(extract([{ ingredients: '' }])).length, 0)
assert.ok(items(extract([{ ingredients: '1.5 cups rice\n1/4 tsp turmeric powder\nSALT\n2 tomatoes              Heat a pan and add the millet\n1 cup chana dal / Bengal Gram Dal / Split Chickpeas' }])).includes('rice'))
assert.ok(!items(extract([{ ingredients: '2 tomatoes              Heat a pan and add the millet' }])).includes('millet'))
const sourceExample = extract([{ ingredients: 'Turmeric powder – ¼ tsp\nCoriander powder – 1½ tsp\nMustard seeds – ½ tsp\n1 cup Jowar flour\nJowar flour for rolling\nBase\nMenu\n1 tsp ginger green chili paste\n1/4 cup Coriander Stems & Leaves chopped' }])
for (const food of ['turmeric powder', 'coriander powder', 'mustard seeds', 'jowar flour', 'ginger green chilli paste', 'coriander leaves']) assert.ok(items(sourceExample).includes(food), food)
assert.ok(!items(sourceExample).some((food) => /base|menu|rolling/.test(food)))
assert.equal(JSON.stringify(items(extract([{ ingredients: '1 carrot + 1 potato' }])).sort()), JSON.stringify(['carrot', 'potato']))
const clean = normalize([{ head: 'Other vegetables', items: ['Potato', 'potato fry', ''] }, { head: 'Pantry', items: ['Chilli powder', 'Green chilli', 'Green chilli'] }])
assert.equal(JSON.stringify(clean), JSON.stringify([{ head: 'Other vegetables', items: ['Potato'] }, { head: 'Pantry', items: ['Chilli powder', 'Green chilli'] }]))
assert.equal(JSON.stringify(normalize([{ head: 'Fruit', items: ['Apple'] }, { head: 'fruit', items: ['Banana', 'Apple'] }])), JSON.stringify([{ head: 'Fruit', items: ['Apple', 'Banana'] }]))

const { shoppingRecipes } = load('lib/shoppingRecipes.ts')
const bank = ['a', 'b', 'unused'].map((id) => ({ id, name: id, ingredients: id, tags: [] }))
const matches = { breakfast: [{ recipe: bank[2], why: '' }], lunch: [], dinner: [], snack: [], dessert: [] }
const selected = shoppingRecipes([{ week_number: 1 }], bank, { 1: { breakfast: ['a', 'b'], lunch: ['a'] } }, {}, matches, { b: { hidden: true }, a: { ingredients: 'Edited tomato' } })
assert.equal(selected.length, 1)
assert.equal(selected[0].ingredients, 'Edited tomato')
assert.equal(shoppingRecipes([{ week_number: 1 }], bank, { 1: { breakfast: [] } }, {}, matches, {}).length, 0)

// Render the real editor with a hook harness, exercising its actual event
// handlers and async save flow without any live patient/database writes.
let hooks = [], cursor = 0, failSave = true, savedBody, onSavedCount = 0
const react = createRequire(import.meta.url)('react')
const mockedReact = { ...react, useMemo: (fn) => fn(), useState: (initial) => {
  const index = cursor++
  if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
  return [hooks[index], (next) => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next }]
} }
const Editor = load('components/RecipeShoppingListEditor.tsx', { react: mockedReact }).default
globalThis.fetch = async (_url, options) => {
  savedBody = JSON.parse(options.body)
  return { ok: !failSave, json: async () => failSave ? { error: 'Test save failed' } : savedBody }
}
const props = { roadmapId: 'test-only', recipes, savedList: null, onSaved: () => { onSavedCount++ } }
function render() { cursor = 0; return Editor(props) }
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]
}
function button(tree, name) { return nodes(tree).find((n) => n.type === 'button' && [n.props.children].flat(Infinity).join('') === name) }
let tree = render()
assert.equal(nodes(tree).filter((n) => n.type === 'input' || n.type === 'select').length, 0, 'Compact view should not show a wall of fields')
assert.ok(nodes(tree).filter((n) => n.type === 'details').every((n) => !n.props.open), 'Categories start collapsed')
nodes(tree).find((n) => n.type === 'button' && n.props['aria-label']?.startsWith('Edit ')).props.onClick()
tree = render()
const firstInput = nodes(tree).find((n) => n.type === 'input' && n.props['aria-label']?.startsWith('Item '))
firstInput.props.onChange({ target: { value: 'Coach edited item' } })
tree = render()
assert.ok(nodes(tree).some((n) => n.props?.value === 'Coach edited item'))
await button(tree, 'Save shopping list').props.onClick()
tree = render()
assert.equal(onSavedCount, 0)
assert.ok(nodes(tree).some((n) => n.props?.role === 'alert' && n.props.children === 'Test save failed'))
assert.ok(nodes(tree).some((n) => n.props?.value === 'Coach edited item'))
failSave = false
await button(tree, 'Save shopping list').props.onClick()
tree = render()
assert.equal(onSavedCount, 1)
assert.ok(savedBody.guide_overrides.grocery_list_override.some((cat) => cat.items.includes('Coach edited item')))
assert.ok(button(tree, 'Save shopping list').props.disabled)
button(tree, 'Extract from recipes').props.onClick()
tree = render()
assert.ok(!nodes(tree).some((n) => n.props?.value === 'Coach edited item'))
assert.equal(onSavedCount, 1, 'Extraction must not silently save or overwrite the patient list')
nodes(tree).find((n) => n.type === 'button' && n.props['aria-label']?.startsWith('Edit ')).props.onClick()
tree = render()
const moveControl = nodes(tree).find((n) => n.type === 'select')
moveControl.props.onChange({ target: { value: 'Other' } })
tree = render()
assert.ok(nodes(tree).some((n) => n.type === 'span' && n.props.children === 'Other'))
nodes(tree).find((n) => n.type === 'button' && n.props['aria-label']?.startsWith('Edit ')).props.onClick()
tree = render()
const deleteControl = nodes(tree).find((n) => n.type === 'button' && n.props['aria-label']?.startsWith('Remove ') && !n.props['aria-label'].startsWith('Remove category'))
deleteControl.props.onClick()
tree = render()
assert.ok(!button(tree, 'Save shopping list').props.disabled)

// Real PATCH handler: round-trip a saved override, retain unrelated plan
// fields, reject malformed lists, and never update after a failed read.
let row = { guide_overrides: { coach_quote: 'Keep this quote', grocery_list_override: null } }
let updateCount = 0, readFailure = false
const admin = { from: () => {
  let pending
  const query = { select: () => query, eq: () => query, update: (body) => { pending = body; return query }, single: async () => {
    if (pending) { updateCount++; row = { ...row, ...pending }; return { data: row, error: null } }
    return readFailure ? { data: null, error: { message: 'Test read failed' } } : { data: row, error: null }
  } }
  return query
} }
const route = load('app/api/compass/roadmaps/[roadmapId]/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ status: options?.status || 200, json: async () => body }) } },
  '@/lib/supabase': { supabaseAdmin: admin }, '@/lib/blocks/types': { validateBlock: (block) => block }, '@/lib/pdf/generationExamples': { logGenerationEdit: async () => {} },
})
const context = { params: Promise.resolve({ roadmapId: 'test-only' }) }
const validBody = { guide_overrides: { grocery_list_override: [{ head: 'Other vegetables', items: ['Potato'] }] } }
let response = await route.PATCH({ json: async () => validBody }, context)
assert.equal(response.status, 200)
assert.equal((await response.json()).guide_overrides.coach_quote, 'Keep this quote')
assert.equal(JSON.stringify((await (await route.GET({}, context)).json()).guide_overrides.grocery_list_override), JSON.stringify(validBody.guide_overrides.grocery_list_override))
response = await route.PATCH({ json: async () => ({ guide_overrides: { grocery_list_override: [{ head: 'Bad', items: [42] }] } }) }, context)
assert.equal(response.status, 400)
assert.equal(updateCount, 1)

// Exercise the PDF shopping renderer without generating a patient document.
const pdfSource = fs.readFileSync('lib/pdf/ClientGuideDocument.tsx', 'utf8')
const pdfAst = ts.createSourceFile('document.tsx', pdfSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const pdfFunction = pdfAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'groceryPages').getText(pdfAst)
const pdfExports = {}
vm.runInNewContext(ts.transpileModule(pdfFunction + '\nexport { groceryPages }', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports: pdfExports, require: createRequire(import.meta.url), PageShell: 'section', Text: 'text', View: 'view', CheckboxSquare: 'checkbox', grid: {}, shared: {}, GROCERY_CATEGORIES: [{ head: 'Legacy', items: ['Legacy ingredient'] }],
})
const pdfPages = pdfExports.groceryPages({ groceryListOverride: [{ head: 'Other vegetables', items: ['Potato'] }] })
assert.equal(pdfPages.length, 1)
assert.ok(JSON.stringify(pdfPages).includes('Potato'))
assert.ok(!JSON.stringify(pdfPages).includes('Legacy ingredient'))
assert.ok(JSON.stringify(pdfExports.groceryPages({ groceryListOverride: [] })).includes('No shopping items'))
assert.equal(pdfExports.groceryPages({ groceryListOverride: [{ head: 'Test', items: Array.from({ length: 100 }, (_, i) => 'Item ' + i) }] }).length, 3)
readFailure = true
response = await route.PATCH({ json: async () => validBody }, context)
assert.equal(response.status, 500)
assert.equal(updateCount, 1)

// Every dashboard uses the same editor. Legacy grocery computation is
// unchanged and public views keep stored overrides until an explicit save.
const templates = fs.readdirSync('components/guide-templates').filter((f) => f.endsWith('Template.tsx') || f === 'DashboardClient.tsx')
let integrated = 0
for (const template of templates) {
  const file = 'components/guide-templates/' + template
  const current = fs.readFileSync(file, 'utf8')
  if (!current.includes('<RecipeShoppingListEditor ')) continue
  integrated++
  const previous = execFileSync('git', ['show', '86b1fd7:' + file], { encoding: 'utf8' })
  function groceryTrees(source) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const elements = []
    function visit(node) {
      if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(ast) === 'id' && a.initializer?.getText(ast) === '"grocery"')) elements.push(node.getText(ast).replace(/\r\n/g, '\n'))
      ts.forEachChild(node, visit)
    }
    visit(ast)
    return elements
  }
  assert.ok(groceryTrees(current).includes(groceryTrees(previous)[0]), template + ': existing patient shopping UI must be retained')
}
assert.equal(integrated, 13)
console.log('PASS: recipe-only extraction, categories, distinct product forms, duplicate cleanup, selection/hidden edits, draft editing, failed-save retry, explicit save and 13 template integrations.')
