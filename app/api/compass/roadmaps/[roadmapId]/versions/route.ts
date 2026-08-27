import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

// Lightweight list for the "Previous versions" picker — full content is
// only fetched when a coach actually opens one (see versions/[versionId]).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params
  const { data, error } = await supabaseAdmin
    .from('roadmap_versions')
    .select('id, session_id, overview, duration_months, archived_at')
    .eq('roadmap_id', roadmapId)
    .order('archived_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
