import GuideTemplateRenderer from '@/components/guide-templates/GuideTemplateRenderer'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveRoadmapId } from '@/lib/share/publicData'
import { readFounderNoteTemplate } from '@/lib/clinicSettings'
import { buildGuideData } from '@/lib/pdf/buildGuideData'
import { resolveConfirmedSupplements } from '@/lib/pdf/resolveConfirmedSupplements'
import { ensureDailyContent } from '@/lib/pdf/ensureDailyContent'


export const revalidate = 60
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
    supabaseAdmin.from('roadmap_checkins').select('week_number, action_index, checkin_date, item_id, item_text_snapshot').eq('roadmap_id', roadmapId),
    supabaseAdmin.from('recipe_bank').select('*'),
    supabaseAdmin.from('guide_images').select('id, label, tags, image_url'),
  ])

  if (error || !roadmap) notFound()

  const [, confirmedSupplements, founderNoteTemplate] = await Promise.all([
    ensureDailyContent(roadmap),
    resolveConfirmedSupplements(roadmap.patient_id),
    readFounderNoteTemplate(),
  ])
  const guideData = buildGuideData(roadmap, imageBank ?? [], recipes ?? [], confirmedSupplements, founderNoteTemplate)

  return <GuideTemplateRenderer shareToken={token} data={guideData} initialCheckins={checkins ?? []} />
}
