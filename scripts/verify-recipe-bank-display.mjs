import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const compiledModule = { exports: {} }
const code = ts.transpileModule(readFileSync('lib/recipeBankDisplayText.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText
vm.runInNewContext(code, { module: compiledModule, exports: compiledModule.exports })
const { cleanRecipeBankDisplayText: clean } = compiledModule.exports
assert.equal(clean('� 1/2 cup Toor dal\n� 2 Onions', 'ingredients'), '1/2 cup Toor dal\n2 Onions')
assert.equal(clean('� Soak red rice\novernight\n� Once cooked, remove', 'steps'), 'Soak red rice\novernight\nOnce cooked, remove')
for (const kind of ['ingredients', 'steps']) {
  const ambiguous = '� cup milk\n1� cups\nCook for 2�3 minutes\nsaut� onions\n½ tsp salt\n180°C\nFor the sauce:'
  assert.equal(clean(ambiguous, kind), ambiguous)
  assert.equal(clean('\uF0B7 1 tsp salt', kind), '1 tsp salt')
  assert.equal(clean(clean('� 2 Onions', kind), kind), clean('� 2 Onions', kind))
}
console.log('PASS: list artifacts removed; ambiguous quantities, words, fractions, headings and line breaks preserved.')
