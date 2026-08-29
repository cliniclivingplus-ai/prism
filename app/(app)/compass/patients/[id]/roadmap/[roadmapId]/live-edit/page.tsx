import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'
import { buildGuideData } from '@/lib/pdf/buildGuideData'
import { resolveConfirmedSupplements } from '@/lib/pdf/resolveConfirmedSupplements'
import WeekTemplate from '@/components/guide-templates/WeekTemplate'
import WeekAuroraTemplate from '@/components/guide-templates/WeekAuroraTemplate'
import WeekBloomTemplate from '@/components/guide-templates/WeekBloomTemplate'
import WeekBrutalTemplate from '@/components/guide-templates/WeekBrutalTemplate'
import WeekCareTemplate from '@/components/guide-templates/WeekCareTemplate'
import WeekEarthTemplate from '@/components/guide-templates/WeekEarthTemplate'
import WeekEditorialTemplate from '@/components/guide-templates/WeekEditorialTemplate'
import WeekNeonTemplate from '@/components/guide-templates/WeekNeonTemplate'
import DashboardClient from '@/components/guide-templates/DashboardClient'

// Every Week-family skin supports inline editing, so the coach edits on the
// exact template the patient sees rather than on a stand-in.
const WEEK_FAMILY = {
  'week': WeekTemplate,
  'week-aurora': WeekAuroraTemplate,
  'week-bloom': WeekBloomTemplate,
  'week-brutal': WeekBrutalTemplate,
  'week-care': WeekCareTemplate,
  'week-earth': WeekEarthTemplate,
  'week-editorial': WeekEditorialTemplate,
  'week-neon': WeekNeonTemplate,
} as const

// Templates with their own dedicated, read-only-only component — none of
// these support an `editable` prop (yet). Classic falls through to
// DashboardClient below instead, which already supports full inline
// editing (it's the same editor the generic Classic editor route uses),
// so it needs no template-specific work to join Week-family here.
const NOT_YET_LIVE_EDITABLE = new Set(['almanac', 'pulse', 'onyx', 'vitals'])

// Phase 1 of inline editing: a coach edits directly on the same component
// the patient sees (WeekTemplate), instead of the generic Classic editor +
// a separate "Preview as patient" tab. Gated the same way every other
// authenticated page in this app is (proxy.ts / lib/auth/middleware.ts) —
// nothing here does its own auth check, and `editable` is hardcoded true
// only because this route itself is unreachable without a session. The
// public /share/roadmap/<token> page and the read-only archived-version
// viewer both render WeekTemplate too, but neither of them passes
// `editable` or `roadmapId`, so they get the default read-only render.
//
// Phase 2: Classic joined Week-family here too — it already had full
// inline editing under a different name (the "editable" mode the generic
// interpret-page editor already used), so this route just points at the
// same DashboardClient component instead of duplicating it. Almanac/Pulse/
// Onyx/Vitals are still read-only-only components with no `editable` prop
// at all, so they fall through to the "not yet available" message below —
// building real inline editing for each is its own follow-up, not a small
// addition.
export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function LiveEditPage({ params }: { params: Promise<{ id: string; roadmapId: string }> }) {
  const { id: patientId, roadmapId } = await params

  const [{ data: roadmap, error }, { data: imageBank }, { data: recipeBank }] = await Promise.all([
    supabaseAdmin
      .from('roadmaps')
      .select('*, patients(full_name, gender, primary_concern, nutritionists(id, full_name, designation, bio, response_note, photo_url, email)), sessions(case_summary)')
      .eq('id', roadmapId)
      .single(),
    supabaseAdmin.from('guide_images').select('id, label, tags, image_url'),
    supabaseAdmin.from('recipe_bank').select('*'),
  ])
  if (error || !roadmap) notFound()

  const confirmedSupplements = await resolveConfirmedSupplements(roadmap.patient_id)
  const guideData = buildGuideData(roadmap, imageBank ?? [], recipeBank ?? [], confirmedSupplements)

  const { data: checkins } = await supabaseAdmin
    .from('roadmap_checkins')
    .select('week_number, action_index, checkin_date, item_id, item_text_snapshot')
    .eq('roadmap_id', roadmapId)

  const backHref = `/compass/patients/${patientId}`
  const classicEditorHref = roadmap.session_id ? `/compass/patients/${patientId}/sessions/${roadmap.session_id}/interpret` : backHref

  const Template = (WEEK_FAMILY as Record<string, typeof WeekTemplate | undefined>)[guideData.template]

  if (!Template && NOT_YET_LIVE_EDITABLE.has(guideData.template)) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ fontSize: 14, color: '#5A5548' }}>
          Inline editing isn&apos;t built for &quot;{guideData.template}&quot; yet — edit it in the Classic editor instead.
        </p>
        <Link href={classicEditorHref} style={{ color: '#8A3B2E', fontWeight: 700, textDecoration: 'underline' }}>
          <ArrowLeft size={12} style={{ display: 'inline', verticalAlign: -1 }} /> Open Classic editor
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: '#FBF1E3', borderBottom: '1px solid #E8D4AE', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: 13, color: '#7A5A1E', fontWeight: 600, flexWrap: 'wrap' }}>
        {/* Week-family autosaves per field on blur; DashboardClient (used
            for Classic here) batches edits behind its own "Save changes"
            button instead — the banner text has to match whichever one is
            actually rendering below, or it promises a save behavior this
            editor doesn't have. */}
        <span>{Template ? 'Editing live — changes save as you click away from each field.' : 'Editing on the real layout — click Save changes below when you\'re done.'}</span>
        <Link href={classicEditorHref} style={{ color: '#7A5A1E', textDecoration: 'underline', fontWeight: 700 }}>
          <ArrowLeft size={11} style={{ display: 'inline', verticalAlign: -1 }} /> Classic editor
        </Link>
      </div>
      {Template ? (
        <Template
          editable
          roadmapId={roadmapId}
          shareToken={roadmap.share_revoked_at ? '' : (roadmap.share_token ?? '')}
          data={guideData}
          initialCheckins={checkins ?? []}
        />
      ) : (
        <DashboardClient
          editable
          roadmapId={roadmapId}
          shareToken={roadmap.share_revoked_at ? undefined : (roadmap.share_token ?? undefined)}
          patientId={patientId}
          data={guideData}
          initialCheckins={checkins ?? []}
          duration={roadmap.duration_months ?? undefined}
        />
      )}
    </div>
  )
}
