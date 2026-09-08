import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

// A one-off picture a coach drops straight into a lifestyle/meal/goal
// textarea (see ImageInsertButton.tsx) — rendered inline via
// renderMarkdownBold's ![alt](url) support. Deliberately not the same flow
// as /api/compass/guide-images: that's the curated, tagged Picture Bank
// meant to be matched and reused across many patients' plans, this is a
// single upload for one spot in one roadmap, so it skips the label/tags
// requirement and doesn't write a guide_images row. Same storage bucket
// (no reason to stand up a second one), separate path prefix so the two
// don't visually mix in the bucket's file listing.
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file')

  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Use a PNG, JPEG, or WebP image' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 })

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `inline/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('guide-images')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data } = supabaseAdmin.storage.from('guide-images').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
