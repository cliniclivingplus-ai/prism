import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { validateBlock, type ChecklistPageBlock } from '@/lib/blocks/types'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('consultation_checklists').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// The recipe/image ids actually referenced across a block set — used to
// keep the checklist's own recipe_ids/image_ids columns (what the coach
// editor and public page filter the full bank down to) in sync whenever a
// manual save picks or uploads something new that wasn't in the original
// curated set from generation time.
function referencedIds(blocks: ChecklistPageBlock[]) {
  const recipeIds = new Set<string>()
  const imageIds = new Set<string>()
  for (const b of blocks) {
    if (b.type === 'recipe_gallery') b.recipe_ids.forEach((id) => recipeIds.add(id))
    if (b.type === 'image_gallery') b.image_ids.forEach((id) => imageIds.add(id))
    if (b.type === 'image') imageIds.add(b.image_id)
  }
  return { recipeIds, imageIds }
}

// The manual "Canva-style" editor's save endpoint — every block goes
// through the exact same validateBlock() guard as AI-generated content
// (unknown shape or invalid layout gets rejected outright). Unlike AI
// generation, a manual save validates recipe/image ids against the FULL
// picture/recipe bank rather than only the checklist's original curated
// subset — there's no fabrication risk here since the coach explicitly
// picked (or just uploaded) something real through the structured editor
// UI, not an LLM inventing an id. Any newly-referenced id then gets folded
// into the checklist's own recipe_ids/image_ids so the editor and public
// page's "filter the bank down to these ids" lookup keeps resolving it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (!Array.isArray(body.blocks)) return NextResponse.json({ error: 'blocks array is required' }, { status: 400 })

  const { data: row, error: fetchError } = await supabaseAdmin.from('consultation_checklists').select('recipe_ids, image_ids').eq('id', id).single()
  if (fetchError || !row) return NextResponse.json({ error: fetchError?.message || 'Not found' }, { status: 404 })

  const [{ data: allRecipes }, { data: allImages }] = await Promise.all([
    supabaseAdmin.from('recipe_bank').select('id'),
    supabaseAdmin.from('guide_images').select('id'),
  ])
  const allowedRecipeIds = new Set<string>((allRecipes ?? []).map((r: { id: string }) => r.id))
  const allowedImageIds = new Set<string>((allImages ?? []).map((r: { id: string }) => r.id))

  const blocks = body.blocks.map((b: unknown) => validateBlock(b, allowedRecipeIds, allowedImageIds))
  if (blocks.some((b: unknown) => b === null)) {
    return NextResponse.json({ error: 'One or more blocks were invalid, nothing was saved' }, { status: 422 })
  }

  const { recipeIds, imageIds } = referencedIds(blocks as ChecklistPageBlock[])
  const recipe_ids = [...new Set([...(row.recipe_ids || []), ...recipeIds])]
  const image_ids = [...new Set([...(row.image_ids || []), ...imageIds])]

  const { error: updateError } = await supabaseAdmin.from('consultation_checklists').update({ blocks, recipe_ids, image_ids, updated_at: new Date().toISOString() }).eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('consultation_checklists').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
