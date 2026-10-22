import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

// READ a single session — this is what QAChat calls to load the transcript,
// qa_pairs and roadmap_instructions. Was missing, which caused the 405.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// UPDATE a session — used by QAChat to save the discussion (qa_pairs)
// and finalized roadmap_instructions. Unchanged from your version.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  // Opt-in discussion save: preserve older interview answers and detect another
  // coach saving the same session while this tab was open.
  if (Array.isArray(body.discussion_pairs)) {
    if (body.discussion_pairs.some((p: { mode?: string }) => !p || p.mode !== 'discussion')) {
      return NextResponse.json({ error: 'Invalid discussion' }, { status: 400 })
    }
    const { data: current, error: readError } = await supabaseAdmin.from('sessions').select('qa_pairs').eq('id', id).single()
    if (readError || !current) return NextResponse.json({ error: 'Could not read saved discussion' }, { status: 503 })
    const existing = Array.isArray(current.qa_pairs) ? current.qa_pairs : []
    const discussion = existing.filter((p: { mode?: string }) => p.mode === 'discussion')
    if (stableJson(discussion) === stableJson(body.discussion_pairs)) return NextResponse.json(current)
    if (stableJson(discussion) !== stableJson(body.expected_discussion ?? [])) {
      return NextResponse.json({ error: 'Another coach changed this discussion. Copy your new message before reloading to review their changes.' }, { status: 409 })
    }
    let query = supabaseAdmin.from('sessions').update({ qa_pairs: [...existing.filter((p: { mode?: string }) => p.mode !== 'discussion'), ...body.discussion_pairs] }).eq('id', id)
    query = current.qa_pairs === null ? query.is('qa_pairs', null) : query.eq('qa_pairs', JSON.stringify(current.qa_pairs))
    const { data, error } = await query.select().maybeSingle()
    if (error || !data) return NextResponse.json({ error: 'Discussion was not saved. Another edit may have arrived; keep this tab open and retry.' }, { status: 409 })
    return NextResponse.json(data)
  }
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update(body)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT alias → same behaviour as PATCH, in case anything calls PUT.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return PATCH(req, ctx)
}
