// Imports .cookbooks_parsed.json (+ .cookbook-images.json) into
// public.recipe_bank. Dry-run by default; pass --write to insert.
//
// Idempotent: a recipe whose name + meal type already exists is skipped, so
// a repeat run cannot duplicate the collection. Inserted ids and uploaded
// image paths are recorded in .cookbooks_imported.json so the import can be
// undone precisely. See docs/SOP.md, "Bulk data imports".
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
})

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const BUCKET = 'recipe-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const write = process.argv.includes('--write')

const recipes = JSON.parse(readFileSync('.cookbooks_parsed.json', 'utf8'))
const images = new Map(
  JSON.parse(readFileSync('.cookbook-images.json', 'utf8')).map((i) => [`${i.sourceFile}::${i.page}`, i])
)

const { data: existing, error } = await db.from('recipe_bank').select('id, name, meal_type, tags')
if (error) throw new Error(error.message)
const existingByKey = new Map(existing.map((r) => [`${r.name.trim().toLowerCase()}|${r.meal_type}`, r]))

// A recipe already in the bank is not skipped — it is tagged with the
// categories of the books it also appears in. Same "one recipe, many
// categories" rule as the cross-book merge.
const toInsert = []
const toTag = []
const seen = new Set()
for (const r of recipes) {
  const key = `${r.name.trim().toLowerCase()}|${r.meal_type}`
  const already = existingByKey.get(key)
  if (already) {
    const missing = r.categories.filter((c) => !(already.tags || []).includes(c))
    if (missing.length) toTag.push({ id: already.id, name: already.name, tags: [...(already.tags || []), ...missing], added: missing })
    continue
  }
  if (seen.has(key)) continue
  seen.add(key)
  toInsert.push(r)
}
const skipped = toTag

const withPhoto = toInsert.filter((r) => images.has(`${r.sourceFile}::${r.page}`)).length
console.log(`${recipes.length} parsed · ${toInsert.length} to insert · ${toTag.length} already in the bank (category added instead)`)
console.log(`${withPhoto} of those have a photo to upload`)
const byCategory = {}
for (const r of toInsert) for (const c of r.categories) byCategory[c] = (byCategory[c] || 0) + 1
console.log('by category:', JSON.stringify(byCategory))

if (!write) {
  console.log('\nDRY RUN — nothing written. Re-run with --write.')
  process.exit(0)
}

// Tag the ones that already exist first — cheap, and it makes a partial
// run easy to reason about.
let retagged = 0
for (const t of toTag) {
  const { error: tagErr } = await db.from('recipe_bank').update({ tags: t.tags }).eq('id', t.id)
  if (tagErr) console.log(`  ! tagging failed for ${t.name}: ${tagErr.message}`)
  else retagged++
}
console.log(`tagged ${retagged} existing recipes with their new categories`)

const imported = []
let uploaded = 0, failedUpload = 0, inserted = 0
for (const [index, r] of toInsert.entries()) {
  let image_url = null
  let image_storage_path = null
  const img = images.get(`${r.sourceFile}::${r.page}`)
  if (img && img.bytes <= MAX_IMAGE_BYTES) {
    const ext = img.path.split('.').pop()
    const storagePath = `cookbook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const body = readFileSync(img.path)
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(storagePath, body, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: false })
    if (upErr) {
      failedUpload++
      console.log(`  ! photo failed for ${r.name}: ${upErr.message}`)
    } else {
      const { data: pub } = db.storage.from(BUCKET).getPublicUrl(storagePath)
      image_url = pub.publicUrl
      image_storage_path = storagePath
      uploaded++
    }
  }

  const { data, error: insErr } = await db
    .from('recipe_bank')
    .insert({
      name: r.name,
      meal_type: r.meal_type,
      ingredients: r.ingredients,
      steps: r.steps,
      servings: r.servings,
      prep_time: r.prep_time,
      cook_time: r.cook_time,
      tags: r.categories,
      tools: [],
      notes: [],
      benefits: [],
      image_url,
      image_storage_path,
    })
    .select('id, name')
    .single()
  if (insErr) { console.log(`  ! insert failed for ${r.name}: ${insErr.message}`); continue }
  inserted++
  imported.push({ id: data.id, name: data.name, categories: r.categories, image_storage_path })
  if ((index + 1) % 50 === 0) console.log(`  ...${index + 1}/${toInsert.length}`)
}

writeFileSync('.cookbooks_imported.json', JSON.stringify({ inserted: imported, retagged: toTag }, null, 2))
console.log(`\ninserted ${inserted} recipes · ${uploaded} photos uploaded · ${failedUpload} photo failures`)
console.log('ids written to .cookbooks_imported.json')
