import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

// Lets a coach add/fix the label+tags on an image that already exists —
// the bulk import (970 real icons, no source metadata to label them from)
// intentionally uploads with both blank, since there's no vision model on
// this account to auto-caption them; a coach fills them in here at their
// own pace, same as any other picture in the bank once labeled.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  const update: Record<string, unknown> = {}
  if (typeof body?.label === 'string') update.label = body.label.trim()
  if (Array.isArray(body?.tags)) {
    update.tags = [...new Set(body.tags.map((t: unknown) => String(t).trim().toLowerCase()).filter(Boolean))]
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('guide_images').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: existing } = await supabaseAdmin.from('guide_images').select('storage_path').eq('id', id).single()
  if (existing?.storage_path) {
    await supabaseAdmin.storage.from('guide-images').remove([existing.storage_path])
  }
  const { error } = await supabaseAdmin.from('guide_images').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
