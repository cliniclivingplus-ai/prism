import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const patient_id = formData.get('patient_id') as string
    const session_id = (formData.get('session_id') as string) || 'new'
    const session_name = (formData.get('session_name') as string) || ''
    const session_date = (formData.get('session_date') as string) || new Date().toISOString()
    const note_type = (formData.get('note_type') as string) || 'post' // 'pre' | 'post' | 'transcript' | 'auto'
    const notes_text_input = (formData.get('notes_text') as string) || ''
    const regenerate_dashboard = formData.get('regenerate_dashboard') === 'true'
    const file = formData.get('file') as File | null

    if (!patient_id) {
      return NextResponse.json({ error: 'Missing patient_id' }, { status: 400 })
    }

    let extractedFileText = ''
    let fileName = ''

    if (file && file.size > 0) {
      fileName = file.name
      const buffer = Buffer.from(await file.arrayBuffer())
      const lowerName = file.name.toLowerCase()

      if (lowerName.endsWith('.docx')) {
        try {
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ buffer })
          extractedFileText = result.value
        } catch (e) {
          console.error('[upload-notes] Mammoth DOCX parse error:', e)
          return NextResponse.json({ error: 'Failed to read Word document (.docx). Try pasting notes directly or using a .txt file.' }, { status: 422 })
        }
      } else if (lowerName.endsWith('.pdf')) {
        try {
          const pdfParseModule: any = await import('pdf-parse')
          const pdfParse = pdfParseModule.default || pdfParseModule
          const data = await pdfParse(buffer)
          extractedFileText = data.text
        } catch (e) {
          console.error('[upload-notes] pdf-parse error:', e)
          return NextResponse.json({ error: 'Failed to extract text from PDF. Try using a .txt/.docx file or pasting text directly.' }, { status: 422 })
        }
      } else {
        // Plain text files (.txt, .md, .csv, etc.)
        extractedFileText = buffer.toString('utf-8')
      }
    }

    const combinedNotesText = [notes_text_input.trim(), extractedFileText.trim()].filter(Boolean).join('\n\n')

    if (!combinedNotesText) {
      return NextResponse.json({ error: 'Please upload a note file or enter text notes.' }, { status: 400 })
    }

    let sessionObj: any = null

    if (session_id === 'new' || !session_id) {
      // Count existing sessions to give a clear title
      const { count } = await supabaseAdmin
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patient_id)

      const sessionNum = (count || 0) + 1
      const sessionTitle = session_name.trim() || `Consultation ${sessionNum}`

      const insertData: Record<string, any> = {
        patient_id,
        session_type: sessionTitle,
        session_date: session_date || new Date().toISOString(),
        status: 'notes-added',
      }

      if (note_type === 'pre') insertData.pre_meeting_notes = combinedNotesText
      else if (note_type === 'transcript') insertData.gemini_doc_raw = combinedNotesText
      else insertData.post_meeting_notes = combinedNotesText

      const { data: created, error: createErr } = await supabaseAdmin
        .from('sessions')
        .insert(insertData)
        .select()
        .single()

      if (createErr || !created) {
        return NextResponse.json({ error: createErr?.message || 'Failed to create new session.' }, { status: 500 })
      }

      sessionObj = created
    } else {
      // Update existing session
      const { data: existing } = await supabaseAdmin
        .from('sessions')
        .select('*')
        .eq('id', session_id)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Target session not found.' }, { status: 404 })
      }

      const updateData: Record<string, any> = { status: 'notes-added' }

      if (note_type === 'pre') {
        updateData.pre_meeting_notes = existing.pre_meeting_notes
          ? `${existing.pre_meeting_notes}\n\n${combinedNotesText}`
          : combinedNotesText
      } else if (note_type === 'transcript') {
        updateData.gemini_doc_raw = existing.gemini_doc_raw
          ? `${existing.gemini_doc_raw}\n\n${combinedNotesText}`
          : combinedNotesText
      } else {
        updateData.post_meeting_notes = existing.post_meeting_notes
          ? `${existing.post_meeting_notes}\n\n${combinedNotesText}`
          : combinedNotesText
      }

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('sessions')
        .update(updateData)
        .eq('id', session_id)
        .select()
        .single()

      if (updateErr || !updated) {
        return NextResponse.json({ error: updateErr?.message || 'Failed to update session notes.' }, { status: 500 })
      }

      sessionObj = updated
    }

    // Trigger structured clinical Q&A parsing via /api/compass/parse-gemini
    if (sessionObj && combinedNotesText.length > 20) {
      try {
        await fetch(new URL('/api/compass/parse-gemini', req.nextUrl.origin), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gemini_doc: combinedNotesText,
            patient_id,
            session_id: sessionObj.id,
          }),
        })
      } catch (e) {
        console.error('[upload-notes] parse-gemini trigger error:', e)
      }
    }

    let roadmapUpdated = false
    if (regenerate_dashboard && patient_id) {
      // Find active roadmap for this patient
      const { data: roadmaps } = await supabaseAdmin
        .from('roadmaps')
        .select('id, duration_months')
        .eq('patient_id', patient_id)
        .order('created_at', { ascending: false })
        .limit(1)

      const activeRoadmap = roadmaps?.[0]
      if (activeRoadmap) {
        try {
          const cookie = req.headers.get('cookie') ?? ''
          const refreshRes = await fetch(new URL('/api/compass/interpret', req.nextUrl.origin), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', cookie },
            body: JSON.stringify({
              session_id: sessionObj.id,
              patient_id,
              duration_months: activeRoadmap.duration_months ?? 1,
              refresh_roadmap_id: activeRoadmap.id,
            }),
          })
          if (refreshRes.ok) {
            roadmapUpdated = true
          }
        } catch (e) {
          console.error('[upload-notes] roadmap update error:', e)
        }
      }
    }

    return NextResponse.json({
      success: true,
      session: sessionObj,
      roadmapUpdated,
      fileName,
    })
  } catch (err) {
    console.error('upload-notes error:', err)
    return NextResponse.json({ error: 'Unexpected error uploading notes.' }, { status: 500 })
  }
}
