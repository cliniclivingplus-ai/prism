import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'
import { buildGuideData, type RoadmapRow } from '@/lib/pdf/buildGuideData'
import DashboardClient from '@/components/guide-templates/DashboardClient'
import AlmanacTemplate from '@/components/guide-templates/AlmanacTemplate'
import PulseTemplate from '@/components/guide-templates/PulseTemplate'
import OnyxTemplate from '@/components/guide-templates/OnyxTemplate'
import WeekTemplate from '@/components/guide-templates/WeekTemplate'
import VitalsTemplate from '@/components/guide-templates/VitalsTemplate'
import WeekBrutalTemplate from '@/components/guide-templates/WeekBrutalTemplate'
import WeekEarthTemplate from '@/components/guide-templates/WeekEarthTemplate'
import WeekEditorialTemplate from '@/components/guide-templates/WeekEditorialTemplate'
import WeekNeonTemplate from '@/components/guide-templates/WeekNeonTemplate'
import WeekBloomTemplate from '@/components/guide-templates/WeekBloomTemplate'
import WeekCareTemplate from '@/components/guide-templates/WeekCareTemplate'
import WeekAuroraTemplate from '@/components/guide-templates/WeekAuroraTemplate'

export const revalidate = 0
export const dynamic = 'force-dynamic'

// Renders an archived roadmap_versions row through the exact same template
// components as the live dashboard — same "one rendering codepath, WYSIWYG"
// principle buildGuideData already follows for the editor vs. the PDF — so
// this is a faithful replay of what the patient actually saw, not a
// simplified summary. `roadmapId` passed to the templates is a sentinel,
// never the real one: those components let a viewer tap a goal checkbox
// (that's how the real patient page works even read-only), and a tap here
// must never write a checkin against the still-live roadmap underneath it.
const ARCHIVE_SENTINEL_PREFIX = 'archived-version-'

export default async function RoadmapVersionPage({ params }: { params: Promise<{ id: string; roadmapId: string; versionId: string }> }) {
  const { id: patientId, roadmapId, versionId } = await params

  const [{ data: version }, { data: roadmap }] = await Promise.all([
    supabaseAdmin.from('roadmap_versions').select('*').eq('id', versionId).eq('roadmap_id', roadmapId).single(),
    supabaseAdmin
      .from('roadmaps')
      .select('created_at, patients(full_name, gender, primary_concern, nutritionist_id, nutritionists(id, full_name, designation, bio, response_note, photo_url, email))')
      .eq('id', roadmapId)
      .single(),
  ])
  if (!version || !roadmap) notFound()

  const { data: session } = version.session_id
    ? await supabaseAdmin.from('sessions').select('case_summary').eq('id', version.session_id).maybeSingle()
    : { data: null }
  const [{ data: recipes }, { data: imageBank }] = await Promise.all([
    supabaseAdmin.from('recipe_bank').select('*'),
    supabaseAdmin.from('guide_images').select('id, label, tags, image_url'),
  ])

  const roadmapRow: RoadmapRow = {
    created_at: roadmap.created_at,
    overview: version.overview,
    lifestyle_guidelines: version.lifestyle_guidelines,
    meal_guidelines: version.meal_guidelines,
    daily_schedule: version.daily_schedule,
    daily_checklist_items: version.daily_checklist_items,
    nutritionist_guidelines: version.nutritionist_guidelines,
    kb_sources: version.kb_sources,
    weekly_schedule: version.weekly_schedule,
    duration_months: version.duration_months,
    guide_overrides: version.guide_overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patients: roadmap.patients as any,
    sessions: session,
  }
  const guideData = buildGuideData(roadmapRow, imageBank ?? [], recipes ?? [])
  const sentinelRoadmapId = `${ARCHIVE_SENTINEL_PREFIX}${versionId}`

  const banner = (
    <div style={{ background: '#FBF1E3', borderBottom: '1px solid #E8D4AE', padding: '10px 20px', textAlign: 'center', fontSize: 13, color: '#7A5A1E', fontWeight: 600 }}>
      Archived version from {new Date(version.archived_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} — view only, not the live link.{' '}
      <Link href={`/compass/patients/${patientId}/roadmap-history/${roadmapId}`} style={{ color: '#7A5A1E', textDecoration: 'underline', fontWeight: 700 }}>
        <ArrowLeft size={11} style={{ display: 'inline', verticalAlign: -1 }} /> Back to history
      </Link>
    </div>
  )

  const template = guideData.template
  return (
    <div>
      {banner}
      {template === 'almanac' ? <AlmanacTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'pulse' ? <PulseTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'onyx' ? <OnyxTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'week' ? <WeekTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'week-brutal' ? <WeekBrutalTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'week-earth' ? <WeekEarthTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'week-editorial' ? <WeekEditorialTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'week-neon' ? <WeekNeonTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'week-bloom' ? <WeekBloomTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'week-care' ? <WeekCareTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'week-aurora' ? <WeekAuroraTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : template === 'vitals' ? <VitalsTemplate shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />
        : <DashboardClient shareToken={sentinelRoadmapId} data={guideData} initialCheckins={[]} />}
    </div>
  )
}
