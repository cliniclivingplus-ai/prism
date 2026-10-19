import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const baseline = 'f2da04f'
const oldSource = (file) => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' })
const cache = new Map()
function evaluate(file, source = fs.readFileSync(file, 'utf8'), mocks = {}) {
  const full = path.resolve(file), native = createRequire(full), exports = {}
  function require(name) {
    if (name in mocks) return mocks[name]
    if (name.startsWith('.') || name.startsWith('@/')) {
      const target = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(full), name)
      const resolved = [target, target + '.ts', target + '.tsx', target + '.json'].find((p) => fs.existsSync(p) && fs.statSync(p).isFile())
      if (resolved?.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved, 'utf8'))
      if (resolved) { if (!cache.has(resolved)) cache.set(resolved, evaluate(resolved)); return cache.get(resolved) }
    }
    return native(name)
  }
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, module: { exports }, require, console, Response, Promise, setTimeout, clearTimeout })
  return exports
}
const bank = fs.existsSync('.recipe-cleanup/bank-before.json')
  ? JSON.parse(fs.readFileSync('.recipe-cleanup/bank-before.json', 'utf8'))
  : Array.from({ length: 900 }, (_, i) => ({ id: String(i), name: `Recipe ${i}`, tags: ['diabetes', 'low-fodmap'], ingredients: '1 cup spinach\n2 tomatoes\n1 cup millet', steps: 'Cook.', meal_type: 'lunch', protein_label: null }))
const beforeBank = JSON.stringify(bank)
const oldMatcher = evaluate('lib/pdf/matchRecipes.ts', oldSource('lib/pdf/matchRecipes.ts')).selectRecipesForPatient
const matcher = evaluate('lib/pdf/matchRecipes.ts').selectRecipesForPatient
const options = ['low fodmap', 'diabetes', 'PCOS', '', 'gut healing', 'unmatched concern'].map((primaryConcern) => ({ primaryConcern, dietProtocol: ['Vegetables, whole grains and lentils', 'Coriander, ginger, turmeric, cumin and leafy greens', 'Spinach, broccoli, tomato, carrot, millet, quinoa, oats, rice and tofu'] }))
for (const opts of options) for (const limit of [0, 2, 5, 15]) {
  assert.equal(JSON.stringify(matcher(opts, bank, limit)), JSON.stringify(oldMatcher(opts, bank, limit)), 'Recipe IDs, order, why text and full content must remain identical')
}
const measure = (fn) => { const times = []; for (let i = 0; i < 7; i++) { const start = performance.now(); fn(); times.push(performance.now() - start) } return +times.sort((a, b) => a - b)[3].toFixed(2) }
const matchBefore = measure(() => options.forEach((opts) => oldMatcher(opts, bank)))
const matchAfter = measure(() => options.forEach((opts) => matcher(opts, bank)))
console.log(`Matcher CPU, ${bank.length} recipes × ${options.length} concerns, median: ${matchBefore}ms before → ${matchAfter}ms after (local benchmark, not page-load timing).`)

const oldSlots = evaluate('lib/pdf/weekRecipes.ts', oldSource('lib/pdf/weekRecipes.ts')).getSlotRecipes
const slots = evaluate('lib/pdf/weekRecipes.ts').getSlotRecipes
const selection = matcher(options[0], bank)
const mealSlots = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']
const manual = { breakfast: [bank.at(-1).id], lunch: [bank[0].id, 'missing-id'], dinner: [], snack: [bank[2].id] }
const weekly = { 1: { breakfast: [] }, 2: { lunch: [bank.at(-2).id] } }
for (const week of [1, 2, 3, 52]) assert.equal(JSON.stringify(slots(week, mealSlots, weekly, manual, selection, bank, 'Picked.')), JSON.stringify(oldSlots(week, mealSlots, weekly, manual, selection, bank, 'Picked.')))
const duplicateBank = [{ ...bank[0], name: 'First' }, { ...bank[0], name: 'Second' }]
assert.equal(slots(1, ['breakfast'], {}, { breakfast: [bank[0].id] }, {}, duplicateBank, '')[0].matches[0].recipe.name, 'First')

const file = 'components/RecipeContentRenderer.tsx'
const oldContent = evaluate(file, oldSource(file)), content = evaluate(file)
for (const component of ['RecipeIngredientsRenderer', 'RecipeDirectionsRenderer']) {
  for (const rawText of ['1 cup rice\nSalt to taste', 'For the sauce:\n1 tbsp chilli powder\n### Garnish\nCoriander leaves', '']) {
    const props = { rawText, colors: { accent: '#538A22', text: '#123456', accentSoft: '#fafafa' }, style: { fontSize: 12, lineHeight: 1.5, opacity: .8 } }
    assert.equal(renderToStaticMarkup(React.createElement(content[component], props)), renderToStaticMarkup(React.createElement(oldContent[component], props)), 'Recipe HTML must be unchanged')
    assert.equal(content.sameRecipeContent(props, { ...props, colors: { ...props.colors }, style: { ...props.style } }), true)
    assert.equal(content.sameRecipeContent(props, { ...props, rawText: 'Coach changed this' }), false)
    assert.equal(content.sameRecipeContent(props, { ...props, colors: { ...props.colors, accent: '#ffffff' } }), false)
    assert.equal(content.sameRecipeContent(props, { ...props, style: { ...props.style, lineHeight: 2 } }), false)
  }
}

// Execute each actual parent memo expression. Eight unrelated typing renders
// must reuse the same recipe array; a real ingredient edit must recompute.
let integrated = 0
for (const name of fs.readdirSync('components/guide-templates').filter((f) => f.endsWith('Template.tsx') || f === 'DashboardClient.tsx')) {
  const source = fs.readFileSync('components/guide-templates/' + name, 'utf8')
  if (!source.includes('<RecipeShoppingListEditor ')) continue
  const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let statement
  function visit(node) { if (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => d.name.getText(ast) === 'shoppingListRecipes')) statement = node.getText(ast); ts.forEachChild(node, visit) }
  visit(ast)
  assert.ok(statement, name)
  const weeks = [{ week_number: 1 }], weeklyPicks = { 1: { breakfast: [bank[0].id] } }, overrides = {}
  let previousDeps, previousValue, calculations = 0
  const context = {
    weeklySchedule: weeks, editWeeks: weeks, hiddenSections: [], weeklyManualRecipes: weeklyPicks, manualRecipes: {}, weekMealMatches: selection, recipeOverrides: overrides,
    data: { recipeBank: bank, weeklyManualRecipes: weeklyPicks, manualRecipes: {}, hiddenSections: [] },
    shoppingRecipes: (...args) => { calculations++; return args },
    useMemo: (fn, deps) => { if (!previousDeps || deps.some((dep, i) => dep !== previousDeps[i])) { previousDeps = deps; previousValue = fn() } return previousValue },
    exports: {},
  }
  const code = '(function(){' + ts.transpileModule(statement + '\nexport { shoppingListRecipes }', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText + '})()'
  for (let i = 0; i < 8; i++) vm.runInNewContext(code, context)
  assert.equal(calculations, 1, name + ': unrelated typing must not rebuild shopping recipes')
  context.recipeOverrides = { [bank[0].id]: { ingredients: 'Coach edited ingredients' } }
  vm.runInNewContext(code, context)
  assert.equal(calculations, 2, name + ': actual recipe edits must invalidate the memo')
  // Save/autosave functions must remain byte-for-byte unchanged apart from
  // line endings. Performance work must not alter how coach edits persist.
  function saveFunctions(text) {
    const tree = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), result = new Map()
    function walk(node) {
      if (ts.isFunctionDeclaration(node) && node.name && ['save', 'patchRoadmap', 'saveGroceryList', 'saveGroceryItemText'].includes(node.name.text)) result.set(node.name.text, node.getText(tree).replace(/\r\n/g, '\n'))
      ts.forEachChild(node, walk)
    }
    walk(tree); return result
  }
  for (const [key, previous] of saveFunctions(oldSource('components/guide-templates/' + name))) assert.equal(saveFunctions(source).get(key), previous, name + ': save behavior must remain unchanged')
  integrated++
}
assert.equal(integrated, 13)

const dashboardFile = 'components/guide-templates/DashboardClient.tsx'
const oldDashboard = oldSource(dashboardFile), dashboard = fs.readFileSync(dashboardFile, 'utf8')
const oldImages = oldDashboard.slice(oldDashboard.indexOf('  const combinedImages = new Map(mealImages)'), oldDashboard.indexOf('  // Downloads exactly', oldDashboard.indexOf('  const combinedImages = new Map(mealImages)')))
const dashboardAst = ts.createSourceFile(dashboardFile, dashboard, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let newImages
function findImages(node) { if (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => d.name.getText(dashboardAst) === 'combinedImages')) newImages = node.getText(dashboardAst); ts.forEachChild(node, findImages) }
findImages(dashboardAst)
const imageContext = { mealImages: new Map([['auto', 'auto-url']]), allWeekSlotRecipes: [{ matches: [{ recipe: { id: 'own', image_url: 'own-url' } }, { recipe: { id: 'fallback', name: 'Rice', tags: [] } }] }], data: { imageBank: [] }, customUploadedRecipeImages: { own: 'coach-upload' }, matchGuideImageDistinct: () => ({ image_url: 'matched-url' }), useMemo: (fn) => fn(), exports: {} }
function imageValues(source) { vm.runInNewContext('(function(){' + source + '\nexports.images = [...combinedImages.entries()]})()', imageContext); return JSON.stringify(imageContext.exports.images) }
assert.equal(imageValues(newImages), imageValues(oldImages), 'Memoized image choices must preserve coach uploads, recipe photos and fallbacks')

const Renderer = evaluate('components/guide-templates/GuideTemplateRenderer.tsx', undefined, {
  'next/dynamic': (loader) => Object.assign(() => null, { source: loader.toString() }),
}).default
const templateNames = { classic: 'DashboardClient', week: 'WeekTemplate', almanac: 'AlmanacTemplate', pulse: 'PulseTemplate', onyx: 'OnyxTemplate', vitals: 'VitalsTemplate', 'week-aurora': 'WeekAuroraTemplate', 'week-bloom': 'WeekBloomTemplate', 'week-brutal': 'WeekBrutalTemplate', 'week-care': 'WeekCareTemplate', 'week-earth': 'WeekEarthTemplate', 'week-editorial': 'WeekEditorialTemplate', 'week-neon': 'WeekNeonTemplate', unknown: 'DashboardClient' }
for (const [template, component] of Object.entries(templateNames)) for (const editable of [true, false]) {
  const props = { data: { template }, initialCheckins: [], editable, roadmapId: 'fixture-plan', patientId: 'fixture-patient', shareToken: 'fixture-token', duration: 3 }
  const element = Renderer(props)
  assert.ok(element.type.source.includes(component), template)
  for (const key of ['data', 'initialCheckins', 'editable', 'roadmapId', 'shareToken']) assert.equal(element.props[key], props[key])
}

// Exercise the guide-data route with fixed mocked reads and compare the exact
// payload to the old route; no real patient or database writes are involved.
async function routePayload(source) {
  const events = [], roadmap = { id: 'fixture-plan', patient_id: 'fixture-patient', guide_overrides: { coach_quote: 'Keep every edit' } }
  const rows = { roadmaps: roadmap, guide_images: [{ id: 'image' }], recipe_bank: bank }
  const admin = { from: (table) => {
    const query = { select: () => query, eq: () => query, single: () => query, then: (resolve) => { events.push(table); return Promise.resolve({ data: rows[table], error: null }).then(resolve) } }
    return query
  } }
  const route = evaluate('app/api/compass/roadmaps/[roadmapId]/guide-data/route.ts', source, {
    'next/server': {}, '@/lib/supabase': { supabaseAdmin: admin },
    '@/lib/clinicSettings': { readFounderNoteTemplate: async () => { events.push('founder'); return 'Clinic note' } },
    '@/lib/pdf/resolveConfirmedSupplements': { resolveConfirmedSupplements: async () => { events.push('supplements'); return ['Confirmed only'] } },
    '@/lib/pdf/ensureDailyContent': { ensureDailyContent: async (row) => { events.push('daily'); row.daily_schedule = 'Existing routine' } },
    '@/lib/pdf/buildGuideData': { buildGuideData: (...args) => args },
  })
  const result = await route.GET({}, { params: Promise.resolve({ roadmapId: 'fixture-plan' }) })
  assert.equal(events.filter((event) => event === 'roadmaps').length, 1)
  return result.json()
}
const guideRoute = 'app/api/compass/roadmaps/[roadmapId]/guide-data/route.ts'
assert.equal(JSON.stringify(await routePayload(fs.readFileSync(guideRoute, 'utf8'))), JSON.stringify(await routePayload(oldSource(guideRoute))))
assert.equal(JSON.stringify(bank), beforeBank, 'Performance optimizations must not mutate stored recipe contents')
console.log('PASS: matching/order/content unchanged, recipe HTML unchanged, typing memoized in all 13 layouts, real edits invalidate, template props preserved, guide-data payload identical. No patient writes or edit caching.')
