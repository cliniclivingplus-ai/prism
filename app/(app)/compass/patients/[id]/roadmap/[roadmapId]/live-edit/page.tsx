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
import AlmanacTemplate from '@/components/guide-templates/AlmanacTemplate'
import PulseTemplate from '@/components/guide-templates/PulseTemplate'
import OnyxTemplate from '@/components/guide-templates/OnyxTemplate'
import VitalsTemplate from '@/components/guide-templates/VitalsTemplate'
import DashboardClient from '@/components/guide-templates/DashboardClient'

// Every template with its own dedicated component now supports inline
// editing (Phase 3 brought Almanac/Pulse/Onyx/Vitals up to the same
// editable capability Week-family already had), so the coach edits on the
// exact layout the patient sees rather than on a stand-in, regardless of
// which template a roadmap uses. Classic has no dedicated component of its
// own — it falls through to DashboardClient below, which already supports
// the same inline editing (it's the same editor the generic Classic editor
// route uses).
const TEMPLATES = {
  'week': WeekTemplate,
  'week-aurora': WeekAuroraTemplate,
  'week-bloom': WeekBloomTemplate,
  'week-brutal': WeekBrutalTemplate,
  'week-care': WeekCareTemplate,
  'week-earth': WeekEarthTemplate,
  'week-editorial': WeekEditorialTemplate,
  'week-neon': WeekNeonTemplate,
  'almanac': AlmanacTemplate,
  'pulse': PulseTemplate,
  'onyx': OnyxTemplate,
  'vitals': VitalsTemplate,
} as const

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
// same DashboardClient component instead of duplicating it.
//
// Phase 3: Almanac/Pulse/Onyx/Vitals each gained their own `editable` mode
// (InlineEditableText + a per-field patchRoadmap autosave, matching Week's
// pattern — Founder's note/Coach's note/Care team/Your why/Power points/
// Services/lifestyle/meals/schedule/checklist/weekly goals/grocery list are
// all editable in place now), so every template a roadmap can use is
// reachable from here.
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

  const Template = (TEMPLATES as Record<string, typeof WeekTemplate | undefined>)[guideData.template]

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
