// A title that ran to a second line was imported cut off ("Avocado and
// Red", "Watercress and"). The parser now reads wrapped titles; this
// repairs the rows already in the bank.
//
// Rows are matched on their ingredient text, which the title fix did not
// touch — never on the broken name, which is the thing being corrected.
// Dry-run by default; pass --write to apply.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
})
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const write = process.argv.includes('--write')

const parsed = JSON.parse(readFileSync('.cookbooks_parsed.json', 'utf8'))
const importedIds = new Set(JSON.parse(readFileSync('.cookbooks_imported.json', 'utf8')).inserted.map((r) => r.id))

// Whole ingredient text, not a prefix: two short recipes can share their
// first few lines, and a prefix match renamed one to the other.
const signature = (text) => (text || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const bySignature = new Map()
const ambiguous = new Set()
for (const r of parsed) {
  const sig = signature(r.ingredients)
  if (bySignature.has(sig)) ambiguous.add(sig)
  else bySignature.set(sig, r)
}
// A signature shared by two different recipes identifies neither.
for (const sig of ambiguous) bySignature.delete(sig)

const rows = []
for (let offset = 0; ; offset += 1000) {
  const { data, error } = await db.from('recipe_bank').select('id, name, meal_type, ingredients').range(offset, offset + 999)
  if (error) throw new Error(error.message)
  rows.push(...data)
  if (data.length < 1000) break
}

const fixes = []
let unmatched = 0
for (const row of rows) {
  if (!importedIds.has(row.id)) continue
  const match = bySignature.get(signature(row.ingredients))
  if (!match) { unmatched++; continue }
  // Only ever extend a name that was cut off; never swap one dish's name
  // for another's.
  const isExtension = match.name.toLowerCase().startsWith(row.name.toLowerCase().replace(/[\s&-]+$/, ''))
  if (!isExtension) { unmatched++; continue }
  if (match.name !== row.name) {
    fixes.push({ id: row.id, from: row.name, to: match.name, mealFrom: row.meal_type, mealTo: match.meal_type })
  }
}

console.log(`${rows.length} rows in the bank · ${importedIds.size} from this import · ${unmatched} could not be matched back to the source`)
console.log(`${fixes.length} names to repair (${fixes.filter((f) => f.mealFrom !== f.mealTo).length} of them also get a better meal type)`)
fixes.slice(0, 12).forEach((f) => console.log(`   "${f.from}" -> "${f.to}"${f.mealFrom !== f.mealTo ? `  [${f.mealFrom} -> ${f.mealTo}]` : ''}`))

if (!write) {
  console.log('\nDRY RUN — nothing written. Re-run with --write.')
  process.exit(0)
}

let done = 0
for (const f of fixes) {
  const { error } = await db.from('recipe_bank').update({ name: f.to, meal_type: f.mealTo }).eq('id', f.id)
  if (error) console.log(`  ! ${f.from}: ${error.message}`)
  else done++
}
writeFileSync('.cookbooks_renamed.json', JSON.stringify(fixes, null, 2))
console.log(`\nrepaired ${done} recipes; before/after recorded in .cookbooks_renamed.json`)
