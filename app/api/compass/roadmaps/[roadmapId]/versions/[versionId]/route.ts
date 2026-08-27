import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

// Full content for one archived version, plus everything the read-only
// viewer needs to reuse the exact same rendering path as the live
// dashboard (patient info, the session's case summary, and today's
// image/recipe banks — those aren't versioned, a coach viewing history
// doesn't need the recipe bank frozen in amber too).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ roadmapId: string; versionId: string }> }) {
  const { roadmapId, versionId } = await params

  const { data: version, error } = await supabaseAdmin
    .from('roadmap_versions')
    .select('*')
    .eq('id', versionId)
    .eq('roadmap_id', roadmapId)
    .single()
  if (error || !version) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

  const [{ data: roadmap }, { data: session }, { data: recipes }, { data: imageBank }] = await Promise.all([
    supabaseAdmin
      .from('roadmaps')
      .select('created_at, patients(full_name, gender, primary_concern, nutritionist_id, nutritionists(id, full_name, designation, bio, response_note, photo_url, email))')
      .eq('id', roadmapId)
      .single(),
    version.session_id
      ? supabaseAdmin.from('sessions').select('case_summary').eq('id', version.session_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('recipe_bank').select('*'),
    supabaseAdmin.from('guide_images').select('id, label, tags, image_url'),
  ])
  if (!roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

  return NextResponse.json({ version, roadmap, session, recipes: recipes ?? [], imageBank: imageBank ?? [] })
}
