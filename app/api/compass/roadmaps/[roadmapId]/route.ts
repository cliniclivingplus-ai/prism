import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { validateBlock } from '@/lib/blocks/types'
import { logGenerationEdit, type GenerationKind } from '@/lib/pdf/generationExamples'

// AI column name -> guide_overrides key, for the three fields whose edits
// get logged for later human review (see migration_v41's comment).
const TRACKED_FIELDS: { kind: GenerationKind; aiColumn: 'daily_schedule' | 'lifestyle_guidelines' | 'meal_guidelines'; overrideKey: string }[] = [
  { kind: 'daily_schedule', aiColumn: 'daily_schedule', overrideKey: 'daily_schedule' },
  { kind: 'lifestyle_guidelines', aiColumn: 'lifestyle_guidelines', overrideKey: 'daily_lifestyle_guidelines' },
  { kind: 'meal_guidelines', aiColumn: 'meal_guidelines', overrideKey: 'meal_guidelines' },
]

export async function GET(_req: NextRequest, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
  const { data, error } = await supabaseAdmin
    .from('roadmaps')
    .select('*, patients(full_name, gender, primary_concern, nutritionist_id, nutritionists(id, full_name, designation, bio, response_note, photo_url, email)), sessions(case_summary)')
    .eq('id', roadmapId)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// Coach edits from the guide preview page — overview/lifestyle_guidelines are
// real columns already used by the PDF; guide_overrides holds fields that
// don't have a natural column (goal_label, why_reflection).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (typeof body.overview === 'string') update.overview = body.overview
  if (typeof body.lifestyle_guidelines === 'string') update.lifestyle_guidelines = body.lifestyle_guidelines
  // Coach edits to per-week goals/food menu from the wellness-guide preview —
  // the whole array is replaced, mirroring how the AI generator writes it.
  if (Array.isArray(body.weekly_schedule)) update.weekly_schedule = body.weekly_schedule
  if (body.guide_overrides && typeof body.guide_overrides === 'object') {
    const incoming = { ...body.guide_overrides }
    // Freeform canvas blocks (the roadmap's "Custom blocks" section) go
    // through the same strict validateBlock() guard as every other block
    // in this app, before ever being persisted — unlike the rest of
    // guide_overrides (plain text/simple fields), a block's shape is rich
    // enough that an unvalidated one could crash the public dashboard.
    if (Array.isArray(incoming.canvas_blocks)) {
      const [{ data: images }, { data: recipes }] = await Promise.all([
        supabaseAdmin.from('guide_images').select('id'),
        supabaseAdmin.from('recipe_bank').select('id'),
      ])
      const allowedImageIds = new Set<string>((images ?? []).map((r: { id: string }) => r.id))
      const allowedRecipeIds = new Set<string>((recipes ?? []).map((r: { id: string }) => r.id))
      incoming.canvas_blocks = incoming.canvas_blocks
        .map((b: unknown) => validateBlock(b, allowedRecipeIds, allowedImageIds))
        .filter((b: unknown) => b !== null)
    }
    const { data: existing } = await supabaseAdmin
      .from('roadmaps')
      .select('guide_overrides, daily_schedule, lifestyle_guidelines, meal_guidelines')
      .eq('id', roadmapId)
      .single()
    update.guide_overrides = { ...(existing?.guide_overrides ?? {}), ...incoming }

    // A coach's save always writes every field (see DashboardClient's
    // save()), so we can't tell "edited" from "just saved" by presence
    // alone — only a real change from BOTH the AI's original AND whatever
    // was saved last time counts as a genuine edit worth logging (see
    // migration_v41's comment on why these aren't auto-applied to the
    // prompt).
    await Promise.all(TRACKED_FIELDS.map(async ({ kind, aiColumn, overrideKey }) => {
      if (!(overrideKey in incoming)) return
      const next = String(incoming[overrideKey] ?? '').trim()
      const prev = String(existing?.guide_overrides?.[overrideKey] ?? '').trim()
      const original = String(existing?.[aiColumn] ?? '').trim()
      if (!next || !original || next === prev || next === original) return
      await logGenerationEdit(roadmapId, kind, original, next)
    }))
  }

  const { data, error } = await supabaseAdmin.from('roadmaps').update(update).eq('id', roadmapId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
