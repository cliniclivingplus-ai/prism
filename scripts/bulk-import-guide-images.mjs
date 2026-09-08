// One-off import for the _ImageBank_TestBatch drop: 970 real clip-art
// icons with no source metadata (no vision model on this Groq account to
// auto-caption them — see conversation). Uploads each to the same
// guide-images storage bucket the Picture Bank already uses, under a
// bulk-import/ prefix, and inserts a guide_images row with label/tags
// left blank — a coach fills those in later via the Picture Bank page's
// new inline edit + "needs a label" filter. Idempotent: skips any file
// whose storage_path already has a row, so it's safe to re-run after an
// interruption.
import { readFileSync, readdirSync } from 'fs'
import { join, extname } from 'path'
import { createClient } from '@supabase/supabase-js'

const SRC_DIR = '_ImageBank_TestBatch/all_unique_images'
const BUCKET = 'guide-images'
const PREFIX = 'bulk-import/'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const MIME = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' }

const files = readdirSync(SRC_DIR).filter((f) => extname(f).slice(1).toLowerCase() in MIME)
console.log('files found:', files.length)

const { data: existingRows } = await sb.from('guide_images').select('storage_path').like('storage_path', `${PREFIX}%`)
const existing = new Set((existingRows ?? []).map((r) => r.storage_path))
console.log('already imported:', existing.size)

let imported = 0
let failed = 0
for (const file of files) {
  const storagePath = PREFIX + file
  if (existing.has(storagePath)) continue

  const ext = extname(file).slice(1).toLowerCase()
  const contentType = MIME[ext]
  const buf = readFileSync(join(SRC_DIR, file))

  const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, buf, { contentType, upsert: true })
  if (uploadError) { console.error('upload failed:', file, uploadError.message); failed++; continue }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(storagePath)
  const { error: insertError } = await sb.from('guide_images').insert({ label: '', tags: [], storage_path: storagePath, image_url: pub.publicUrl })
  if (insertError) { console.error('insert failed:', file, insertError.message); failed++; continue }

  imported++
  if (imported % 50 === 0) console.log(`imported ${imported}...`)
}

console.log('done. imported:', imported, 'failed:', failed, 'skipped (already there):', files.length - imported - failed)
