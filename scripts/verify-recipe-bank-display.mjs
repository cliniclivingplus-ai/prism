import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const compiledModule = { exports: {} }
const code = ts.transpileModule(readFileSync('lib/recipeBankDisplayText.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText
vm.runInNewContext(code, { module: compiledModule, exports: compiledModule.exports, require: createRequire(new URL('../lib/recipeBankDisplayText.ts', import.meta.url)) })
const { cleanRecipeBankDisplayText: clean } = compiledModule.exports
assert.equal(clean('� 1/2 cup Toor dal\n� 2 Onions', 'ingredients'), '1/2 cup Toor dal\n2 Onions')
assert.equal(clean('� Soak red rice\novernight\n� Once cooked, remove', 'steps'), 'Soak red rice\novernight\nOnce cooked, remove')
for (const kind of ['ingredients', 'steps']) {
  const ambiguous = '� cup milk\n1� cups\nCook for 2�3 minutes\nsaut� onions\n½ tsp salt\n180°C\nFor the sauce:'
  const result = clean(ambiguous, kind)
  assert.ok(!result.includes('�'))
  assert.ok(result.includes('[quantity unclear] cup milk'))
  assert.ok(result.includes('1[quantity unclear] cups'))
  assert.ok(result.includes('2[source text unclear]3'))
  assert.ok(result.includes('saut[source text unclear]'))
  assert.ok(result.includes('½ tsp salt\n180°C\nFor the sauce:'))
  assert.equal(clean('\uF0B7 1 tsp salt', kind), '1 tsp salt')
  assert.equal(clean(clean('� 2 Onions', kind), kind), clean('� 2 Onions', kind))
}
assert.equal(clean('� Ladies finger\n� Onion', 'ingredients'), 'Ladies finger\nOnion')
assert.equal(clean('� Eat with mint chutney', 'steps'), 'Eat with mint chutney')
const repairs = JSON.parse(readFileSync('lib/recipeBankSourceRepairs.json', 'utf8'))
for (const [id, repair] of Object.entries(repairs)) {
  for (const kind of ['ingredients', 'steps']) {
    assert.equal(clean(repair.original[kind], kind, id), repair.cleaned[kind])
    assert.equal(clean('Coach changed this', kind, id), 'Coach changed this')
  }
}
const bendakaya = repairs['143b39e9-102d-4ac4-a67c-cae3fea37c01'].cleaned
assert.ok(bendakaya.ingredients.includes('Turmeric powder – ¼ tsp'))
assert.ok(bendakaya.ingredients.includes('Coriander powder – 1½ tsp'))
assert.ok(!bendakaya.ingredients.includes('Heat a pan'))
assert.ok(bendakaya.steps.startsWith('Heat a pan'))
if (existsSync('.recipe-cleanup/bank-before.json')) {
  const bank = JSON.parse(readFileSync('.recipe-cleanup/bank-before.json', 'utf8'))
  const before = JSON.stringify(bank)
  let flagged = 0
  for (const recipe of bank) {
    const text = ['ingredients', 'steps'].map((kind) => clean(recipe[kind], kind, recipe.id)).join('\n')
    assert.ok(!/[\uFFFD\uF0B7\uF0A7]/.test(text), recipe.name)
    if (compiledModule.exports.recipeBankTextNeedsReview(text)) flagged++
  }
  assert.equal(JSON.stringify(bank), before)
  console.log(`Audited ${bank.length} recipes: no broken glyphs in bank previews; ${flagged} need source review. Stored data unchanged.`)
}
console.log('PASS: word-led bullets, source corrections, fractions, review labels and subsequent coach edits verified.')
