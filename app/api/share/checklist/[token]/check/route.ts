import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveChecklistId } from '@/lib/share/publicData'

export const dynamic = 'force-dynamic'

// Public, token-addressed. The patient ticking an item on their checklist.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const id = await resolveChecklistId(token)
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { item_key, checked } = body
  if (typeof item_key !== 'string' || !item_key) {
    return NextResponse.json({ error: 'item_key is required' }, { status: 400 })
  }

  const { data: row, error: fetchError } = await supabaseAdmin
    .from('consultation_checklists')
    .select('checked_items')
    .eq('id', id)
    .single()
  if (fetchError || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const next = { ...(row.checked_items || {}) }
  if (checked) next[item_key] = true
  else delete next[item_key]

  const { error: updateError } = await supabaseAdmin
    .from('consultation_checklists')
    .update({ checked_items: next })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ checked_items: next })
}
