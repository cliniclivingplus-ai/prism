import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { groqChatCompletion } from '@/lib/groq'
import { stripDietLabels } from '@/lib/dietRules'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { source_roadmap_id, target_patient_id, target_session_id, adapt_mode = 'ai_adapt' } = await req.json()

    if (!source_roadmap_id || !target_patient_id) {
      return NextResponse.json({ error: 'Missing source_roadmap_id or target_patient_id' }, { status: 400 })
    }

    // 1. Fetch source roadmap and target patient data
    const [{ data: sourceRoadmap }, { data: targetPatient }, { data: targetSessions }] = await Promise.all([
      supabaseAdmin.from('roadmaps').select('*').eq('id', source_roadmap_id).single(),
      supabaseAdmin.from('patients').select('*').eq('id', target_patient_id).single(),
      supabaseAdmin.from('sessions').select('*').eq('patient_id', target_patient_id).order('created_at', { ascending: false }),
    ])

    if (!sourceRoadmap || !targetPatient) {
      return NextResponse.json({ error: 'Source roadmap or target patient not found' }, { status: 404 })
    }

    const latestSession = target_session_id
      ? (targetSessions ?? []).find((s) => s.id === target_session_id)
      : (targetSessions ?? [])[0]

    const targetPatientName = targetPatient.full_name || 'Patient'

    // If adapt_mode === 'exact_clone', do a clean copy of structure & visual template with patient name update
    if (adapt_mode === 'exact_clone') {
      const overview = sourceRoadmap.overview ? sourceRoadmap.overview : ''

      const weekly_schedule = Array.isArray(sourceRoadmap.weekly_schedule)
        ? JSON.parse(JSON.stringify(sourceRoadmap.weekly_schedule))
        : []

      const newRoadmap = {
        patient_id: target_patient_id,
        session_id: latestSession?.id || null,
        overview,
        lifestyle_guidelines: sourceRoadmap.lifestyle_guidelines,
        meal_guidelines: sourceRoadmap.meal_guidelines,
        daily_schedule: sourceRoadmap.daily_schedule,
        daily_checklist_items: sourceRoadmap.daily_checklist_items,
        nutritionist_guidelines: sourceRoadmap.nutritionist_guidelines,
        weekly_schedule,
        kb_sources: sourceRoadmap.kb_sources,
        duration_months: sourceRoadmap.duration_months,
        guide_overrides: sourceRoadmap.guide_overrides,
        status: 'draft',
      }

      const { data: created, error } = await supabaseAdmin
        .from('roadmaps')
        .insert(newRoadmap)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, roadmap_id: created.id, roadmap: created })
    }

    // If adapt_mode === 'ai_adapt', use AI to adapt source roadmap's protocol to target patient's specific symptoms
    const targetFacts = [
      `Name: ${targetPatientName}`,
      targetPatient.gender ? `Gender: ${targetPatient.gender}` : null,
      targetPatient.primary_concern ? `Primary concern: ${targetPatient.primary_concern}` : null,
      targetPatient.medical_history ? `Medical history: ${targetPatient.medical_history}` : null,
      latestSession?.pre_meeting_notes ? `Pre-session notes: ${latestSession.pre_meeting_notes}` : null,
      latestSession?.post_meeting_notes ? `Post-session notes: ${latestSession.post_meeting_notes}` : null,
      latestSession?.qa_pairs?.length ? `Q&A details: ${JSON.stringify(latestSession.qa_pairs.slice(0, 5))}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const adaptRes = await groqChatCompletion({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content:
            'You are a clinical protocol adaptation assistant. You adapt an existing successful clinical roadmap/dashboard protocol to a new patient with similar symptoms. Return valid JSON ONLY. Never use em dashes (—).',
        },
        {
          role: 'user',
          content: `TARGET PATIENT FACTS:
${targetFacts}

SOURCE REFERENCE ROADMAP OVERVIEW:
${sourceRoadmap.overview || ''}

SOURCE REFERENCE WEEKLY SCHEDULE THEMES:
${JSON.stringify(
  (sourceRoadmap.weekly_schedule || []).map((w: any) => ({
    week: w.week_number,
    theme: w.focus_theme,
    cause: w.cause,
    actions: w.actions,
  }))
)}

INSTRUCTIONS:
1. Adapt the reference overview into 2 warm, clinical paragraphs written directly to ${targetPatientName}, addressing their specific symptoms while following the structure of the reference roadmap.
2. Return a JSON object with:
{
  "overview": "Adapted 2-paragraph overview for ${targetPatientName}...",
  "weekly_schedule": [ ...adapted weeks matching duration... ]
}
Make sure weekly_schedule adapts the source roadmap's weekly items to ${targetPatientName}'s specific details.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    })

    let adaptedContent: any = null
    try {
      const clean = adaptRes.choices[0]?.message?.content?.replace(/```json|```/g, '').trim() || ''
      const match = clean.match(/\{[\s\S]*\}/)
      if (match) adaptedContent = JSON.parse(match[0])
    } catch (e) {
      console.log('AI adapt parse failed, falling back to exact clone:', e)
    }

    const finalOverview = adaptedContent?.overview
      ? stripDietLabels(adaptedContent.overview)
      : sourceRoadmap.overview || ''

    const finalWeeklySchedule =
      Array.isArray(adaptedContent?.weekly_schedule) && adaptedContent.weekly_schedule.length > 0
        ? adaptedContent.weekly_schedule
        : sourceRoadmap.weekly_schedule

    const newRoadmap = {
      patient_id: target_patient_id,
      session_id: latestSession?.id || null,
      overview: finalOverview,
      lifestyle_guidelines: sourceRoadmap.lifestyle_guidelines,
      meal_guidelines: sourceRoadmap.meal_guidelines,
      daily_schedule: sourceRoadmap.daily_schedule,
      daily_checklist_items: sourceRoadmap.daily_checklist_items,
      nutritionist_guidelines: sourceRoadmap.nutritionist_guidelines,
      weekly_schedule: finalWeeklySchedule,
      kb_sources: sourceRoadmap.kb_sources,
      duration_months: sourceRoadmap.duration_months,
      guide_overrides: sourceRoadmap.guide_overrides,
      status: 'draft',
    }

    const { data: created, error } = await supabaseAdmin
      .from('roadmaps')
      .insert(newRoadmap)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, roadmap_id: created.id, roadmap: created })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
