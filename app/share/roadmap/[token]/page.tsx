import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveRoadmapId } from '@/lib/share/publicData'
import { buildGuideData } from '@/lib/pdf/buildGuideData'
import { resolveConfirmedSupplements } from '@/lib/pdf/resolveConfirmedSupplements'
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

// Public, no-login page. A coach shares this URL with the patient directly
// (WhatsApp/email). Addressed by share_token rather than by the roadmap's row
// id, so revoking a link takes effect immediately instead of requiring the
// clinical row to be deleted.
export default async function PatientDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const roadmapId = await resolveRoadmapId(token)
  if (!roadmapId) notFound()

  const [{ data: roadmap, error }, { data: checkins }, { data: recipes }, { data: imageBank }] = await Promise.all([
    supabaseAdmin
      .from('roadmaps')
      // nutritionists.email deliberately dropped from this join — it was
      // reaching the patient's HTML. Name/designation/bio/photo are the
      // intended patient-facing coach identity.
      .select('*, patients(full_name, gender, primary_concern, nutritionists(id, full_name, designation, bio, response_note, photo_url)), sessions(case_summary)')
      .eq('id', roadmapId)
      .single(),
    supabaseAdmin.from('roadmap_checkins').select('week_number, action_index, checkin_date').eq('roadmap_id', roadmapId),
    supabaseAdmin.from('recipe_bank').select('*'),
    supabaseAdmin.from('guide_images').select('id, label, tags, image_url'),
  ])

  if (error || !roadmap) notFound()

  const confirmedSupplements = await resolveConfirmedSupplements(roadmap.patient_id)
  const guideData = buildGuideData(roadmap, imageBank ?? [], recipes ?? [], confirmedSupplements)

  if (guideData.template === 'almanac') {
    return <AlmanacTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'pulse') {
    return <PulseTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'onyx') {
    return <OnyxTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'week') {
    return <WeekTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'week-brutal') {
    return <WeekBrutalTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'week-earth') {
    return <WeekEarthTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'week-editorial') {
    return <WeekEditorialTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'week-neon') {
    return <WeekNeonTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'week-bloom') {
    return <WeekBloomTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'week-care') {
    return <WeekCareTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'week-aurora') {
    return <WeekAuroraTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  if (guideData.template === 'vitals') {
    return <VitalsTemplate shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
  }
  return <DashboardClient shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
}
