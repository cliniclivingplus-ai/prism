import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildGuideData } from '@/lib/pdf/buildGuideData'
import { resolveConfirmedSupplements } from '@/lib/pdf/resolveConfirmedSupplements'
import { renderGuidePdf } from '@/lib/pdf/renderGuideDocument'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params

  const [{ data: roadmap, error }, { data: imageBank }, { data: recipeBank }] = await Promise.all([
    supabaseAdmin
      .from('roadmaps')
      .select('*, patients(full_name, gender, primary_concern, nutritionists(id, full_name, designation, bio, response_note, photo_url, email)), sessions(case_summary)')
      .eq('id', roadmapId)
      .single(),
    supabaseAdmin.from('guide_images').select('id, label, tags, image_url'),
    supabaseAdmin.from('recipe_bank').select('id, name, meal_type, protein_label, ingredients, steps, tags'),
  ])

  if (error) return new Response(error.message, { status: 500 })
  if (!roadmap) return new Response('Not found', { status: 404 })

  const confirmedSupplements = await resolveConfirmedSupplements(roadmap.patient_id)
  const guideData = buildGuideData(roadmap, imageBank ?? [], recipeBank ?? [], confirmedSupplements)
  const pdfBuffer = await renderGuidePdf(guideData)

  const fileName = `${roadmap.patients?.full_name?.replace(/\s+/g, '-') ?? 'client'}-wellness-guide.pdf`

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
