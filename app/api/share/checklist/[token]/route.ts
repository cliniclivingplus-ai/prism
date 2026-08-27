import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveChecklistId } from '@/lib/share/publicData'

export const dynamic = 'force-dynamic'

// Public, token-addressed. Returns the checklist plus ONLY the recipes and
// images it actually references.
//
// Two deliberate differences from the gated
// /api/compass/checklists/[id]: it column-lists instead of select('*') (that
// row carries kb_sources, condition_goal, session_id and draft status, none
// of which belong in a patient's browser), and it resolves the referenced
// recipe/image ids server-side. The old public page fetched the entire
// recipe bank and image bank to filter them client-side, which published
// both banks wholesale to anyone holding a link.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const id = await resolveChecklistId(token)
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: checklist, error } = await supabaseAdmin
    .from('consultation_checklists')
    .select('id, title, blocks, recipe_ids, image_ids, checked_items')
    .eq('id', id)
    .single()

  if (error || !checklist) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const recipeIds: string[] = checklist.recipe_ids ?? []
  const imageIds: string[] = checklist.image_ids ?? []

  const [{ data: recipes }, { data: images }] = await Promise.all([
    recipeIds.length
      ? supabaseAdmin
          .from('recipe_bank')
          .select('id, name, image_url, protein_label')
          .in('id', recipeIds)
      : Promise.resolve({ data: [] as unknown[] }),
    imageIds.length
      ? supabaseAdmin.from('guide_images').select('id, label, image_url').in('id', imageIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  return NextResponse.json({ ...checklist, recipes: recipes ?? [], images: images ?? [] })
}
