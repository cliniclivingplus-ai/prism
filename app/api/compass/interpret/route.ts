import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { supabaseBlood } from '@/lib/supabase'
import { supabaseMrx } from '@/lib/supabase'
import Groq from 'groq-sdk'
import { embedText } from '@/lib/embeddings'
import { buildMarkerTrends, buildTrendSnapshot, buildBloodMarkersPromptBlock, type ExtractedMarker } from '@/lib/bloodTrends'
import { parsePrescriptionRow, buildPrescriptionPromptBlock } from '@/lib/mrxPrescription'
import { resolveConfirmedSupplements } from '@/lib/pdf/resolveConfirmedSupplements'
import { generateAIChecklist, type ChecklistItem } from '@/lib/dailyChecklist'
import { buildDayProgression, hasValidDays } from '@/lib/pdf/reshapeRoadmap'
import { generateDailyContent } from '@/lib/pdf/generateDailyContent'

// A 12-month plan now runs up to 8 sequential weekly-schedule chunk calls
// (on top of the 4 earlier steps) since each week's response got much bigger
// once it started including a 7-day escalation breakdown, not just one
// shared set of actions — well beyond the old 60s budget.
export const maxDuration = 280
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function extractJSON(text: string): unknown {
  const clean = text.replace(/```json|```/g, '').trim()
  for (const t of [clean, text]) {
    try { return JSON.parse(t) } catch {}
    const arr = t.match(/\[[\s\S]*\]/)
    if (arr) { try { return JSON.parse(arr[0]) } catch {} }
  }
  throw new Error(`Cannot parse JSON: ${text.slice(0, 200)}`)
}

// The deterministic floor for a week's "days" escalation — used only when
// the AI response for that week omits `days` entirely or returns something
// malformed (observed on real long-duration roadmaps: `days` missing on
// every single week). Explicit "building up" framing per instruction — the
// reader should be able to tell from the wording alone that this is a
// progression through the week, not have to infer it from a changing
// number. Deliberately never invents a quantity/dose to escalate (that's
// exactly the prescription-style framing being removed) — every day just
// carries the same real action, with a marker showing how far into the
// week's habit-building process it is.

export async function POST(req: NextRequest) {
  try {
    const { session_id, patient_id, duration_months = 1, refresh_roadmap_id } = await req.json()
    if (!session_id || !patient_id) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const [{ data: session }, { data: patient }, { data: reports }] = await Promise.all([
      supabaseAdmin.from('sessions').select('*').eq('id', session_id).single(),
      supabaseAdmin.from('patients').select('*').eq('id', patient_id).single(),
      supabaseAdmin.from('patient_reports').select('report_type, patient_summary').eq('patient_id', patient_id).eq('status', 'ready'),
    ])
    if (!session || !patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const qaPairs: { question: string; answer: string }[] = session.qa_pairs ?? []
    const roadmapInstructions = session.roadmap_instructions ?? ''

    const fullQA = qaPairs.map((qa, i) => `Q${i+1}: ${qa.question}\nAnswer: ${qa.answer}`).join('\n\n')
    const geminiSnippet = session.gemini_doc_raw?.slice(0, 800) ?? ''
    const reportsBlock = (reports ?? []).length
      ? (reports ?? []).map((r) => `${r.report_type}:\n${r.patient_summary}`).join('\n\n')
      : ''

    // ── Blood Panel Analyzer data (if this patient is linked) ──
    // Same real-value, no-fabrication principle as reportsBlock — pulls the
    // patient's actual extracted marker values/reference ranges/abnormal
    // flags from the linked blood.reports rows, never inferred.
    let bloodMarkersBlock = ''
    try {
      const { data: bloodLink } = await supabaseAdmin
        .from('blood_patient_links')
        .select('blood_patient_id')
        .eq('clp_patient_id', patient_id)
        .maybeSingle()
      if (bloodLink) {
        const { data: bloodReports } = await supabaseBlood
          .from('reports')
          .select('created_at, markers')
          .eq('patient_id', bloodLink.blood_patient_id)
        const trends = buildMarkerTrends(
          (bloodReports ?? []).map((r) => ({ created_at: r.created_at, markers: r.markers as ExtractedMarker[] | null }))
        )
        bloodMarkersBlock = buildBloodMarkersPromptBlock(buildTrendSnapshot(trends))
      }
    } catch (e) { console.log('Blood marker fetch error:', e) }

    // ── MicrobiomeRX approved prescription (if this patient is linked) ──
    // Only the doctor-approved row (approved_at set via that app's own
    // "Approve RX" step) counts as real, finalized guidance — an
    // unapproved draft is deliberately never pulled in here.
    let mrxPrescriptionBlock = ''
    try {
      const { data: mrxLink } = await supabaseAdmin
        .from('mrx_patient_links')
        .select('mrx_patient_id')
        .eq('clp_patient_id', patient_id)
        .maybeSingle()
      if (mrxLink) {
        // mrx.reports.patient_id is null on every row today — reports (and
        // prescriptions, via report_id) only carry the patient's name as
        // free text, so the linked patient's actual data has to be found by
        // matching that name. See mrx-link/route.ts for the same approach.
        const { data: mrxPatient } = await supabaseMrx.from('patients').select('name').eq('id', mrxLink.mrx_patient_id).maybeSingle()
        if (mrxPatient) {
          const { data: mrxReports } = await supabaseMrx.from('reports').select('id').ilike('patient_name', mrxPatient.name)
          const reportIds = (mrxReports ?? []).map((r) => r.id)
          if (reportIds.length > 0) {
            const { data: rxRow } = await supabaseMrx
              .from('prescriptions')
              .select('approved_at, rx_data')
              .in('report_id', reportIds)
              .not('approved_at', 'is', null)
              .order('approved_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            const prescription = parsePrescriptionRow(rxRow)
            if (prescription) mrxPrescriptionBlock = buildPrescriptionPromptBlock(prescription)
          }
        }
      }
    } catch (e) { console.log('MicrobiomeRX prescription fetch error:', e) }

    // ── KB Search ────────────────────────────────────────────
    let kbContext = ''
    let kbSources: { title: string; source_type: string; chunk_preview: string }[] = []
    try {
      const stopWords = new Set(['the','patient','is','are','was','with','and','has','have','been','their','they','this','that','from','for','not','but','can','also','more','very','some','into','over','after','history','experiencing','currently'])
      const rawText = [patient.primary_concern, patient.medical_history, ...qaPairs.slice(0, 5).map(qa => qa.answer)].filter(Boolean).join(' ')
      const keywords = [...new Set(rawText.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w)).slice(0, 10))].join(' | ')
      console.log('KB keywords:', keywords)

          // Build query for embedding — use clinical terms from patient data
      const queryText = [
        patient.primary_concern ?? '',
        patient.medical_history ?? '',
        ...qaPairs.slice(0, 5).map(qa => `${qa.question} ${qa.answer}`)
      ].filter(Boolean).join(' ').slice(0, 512)

      console.log('KB query:', queryText.slice(0, 100))

      let chunks: {content: string; document_id: string}[] = []
      let usedVectorSearch = false

      // ── Try vector search first ──────────────────────────
      const queryEmbedding = await embedText(queryText)

      if (queryEmbedding && queryEmbedding.length === 384) {
        console.log('Using vector search (pgvector)')
        const { data: vectorChunks, error: vecError } = await supabaseAdmin
          .rpc('match_kb_chunks', {
            query_embedding: queryEmbedding,
            match_threshold: 0.25,
            match_count: 12,
          })

        if (!vecError && vectorChunks?.length > 0) {
          // Limit to 2 chunks per document for diversity
          const seen: Record<string, number> = {}
          for (const chunk of vectorChunks) {
            const docCount = seen[chunk.document_id] ?? 0
            if (docCount < 2) {
              chunks.push({ content: chunk.content, document_id: chunk.document_id })
              seen[chunk.document_id] = docCount + 1
            }
          }
          usedVectorSearch = true
          console.log('Vector search:', chunks.length, 'chunks, top similarity:', vectorChunks[0]?.similarity?.toFixed(3))
        } else {
          console.log('Vector search returned nothing:', vecError?.message)
        }
      }

      // ── Fallback: keyword search per medical term ────────
      if (!usedVectorSearch || chunks.length < 4) {
        console.log('Using text search fallback')
        const medicalTermMap: Record<string, string[]> = {
          'pcos': ['polycystic', 'ovarian', 'insulin', 'menstrual', 'testosterone'],
          'thyroid': ['thyroid', 'hypothyroid', 'hashimoto', 'iodine'],
          'gut': ['microbiome', 'intestinal', 'constipation', 'probiotic', 'digestive'],
          'inflammation': ['inflammation', 'inflammatory', 'anti-inflammatory', 'cytokine'],
          'weight': ['obesity', 'metabolism', 'adipose', 'insulin resistance'],
          'diabetes': ['glucose', 'insulin', 'glycemic', 'blood sugar'],
          'fatigue': ['fatigue', 'adrenal', 'mitochondria', 'energy'],
          'sleep': ['circadian', 'melatonin', 'cortisol', 'insomnia'],
          'hormone': ['estrogen', 'progesterone', 'cortisol', 'endocrine'],
        }

        const patientText = queryText.toLowerCase()
        const searchTerms = new Set<string>()

        keywords.split(' | ').filter(Boolean).forEach((k: string) => searchTerms.add(k))
        for (const [trigger, synonyms] of Object.entries(medicalTermMap)) {
          if (patientText.includes(trigger)) synonyms.forEach(s => searchTerms.add(s))
        }

        const textChunks: {content: string; document_id: string}[] = [...chunks]
        for (const kw of [...searchTerms].slice(0, 8)) {
          const { data: kwChunks } = await supabaseAdmin
            .from('kb_chunks').select('content, document_id')
            .textSearch('content', kw, { type: 'websearch', config: 'english' })
            .limit(2)
          if (kwChunks?.length) {
            for (const chunk of kwChunks) {
              const alreadyIn = textChunks.some(c => c.content === chunk.content)
              const docCount = textChunks.filter(c => c.document_id === chunk.document_id).length
              if (!alreadyIn && docCount < 2) textChunks.push(chunk)
            }
          }
        }
        chunks = textChunks.slice(0, 12)
      }

      if (chunks?.length) {
        const docIds = [...new Set(chunks.map((c: {document_id:string}) => c.document_id))]
        const { data: docs } = await supabaseAdmin.from('kb_documents').select('id, title, source_type').in('id', docIds)
        const docMap = Object.fromEntries((docs ?? []).map((d: {id:string;title:string;source_type:string}) => [d.id, d]))
        kbContext = chunks.map((c: {content:string}, i: number) => `[KB ${i+1}]: ${c.content.slice(0, 350)}`).join('\n\n')
        kbSources = docIds.map(id => ({ title: docMap[id]?.title ?? 'Unknown', source_type: docMap[id]?.source_type ?? 'unknown', chunk_preview: chunks.find((c: {document_id:string}) => c.document_id === id)?.content?.slice(0, 80) ?? '' }))
        console.log('KB chunks:', chunks.length, 'from', docIds.length, 'books:', kbSources.map(s => s.title.split('(')[0].trim()).join(', '))
      } else {
        const { data: fb } = await supabaseAdmin.from('kb_chunks').select('content, document_id').limit(6)
        if (fb?.length) {
          const docIds = [...new Set(fb.map((c: {document_id:string}) => c.document_id))]
          const { data: docs } = await supabaseAdmin.from('kb_documents').select('id, title, source_type').in('id', docIds)
          const docMap = Object.fromEntries((docs ?? []).map((d: {id:string;title:string;source_type:string}) => [d.id, d]))
          kbContext = fb.map((c: {content:string}, i: number) => `[KB ${i+1}]: ${c.content.slice(0, 300)}`).join('\n\n')
          kbSources = docIds.map(id => ({ title: docMap[id]?.title ?? 'Unknown', source_type: docMap[id]?.source_type ?? 'unknown', chunk_preview: fb.find((c: {document_id:string}) => c.document_id === id)?.content?.slice(0, 80) ?? '' }))
          console.log('KB fallback:', fb.length, 'chunks')
        }
      }
    } catch (e) { console.log('KB error:', e) }

    // ── STEP 1: Extract specific patient facts ────────────────
    // This is the key step — pull exact facts before generating
    console.log('Step 1: Extracting patient facts...')
    const factsRes = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: 'Extract specific clinical facts from the consultation. Return only a bullet list of specific, measurable, named facts. No generalisations. Only what is explicitly stated. Never use an em dash (—); use a comma, period, or "and" instead.' },
        { role: 'user', content: `Patient: ${patient.full_name}, ${patient.gender ?? ''}, Concern: ${patient.primary_concern}

Gemini meeting notes:
${geminiSnippet}

Q&A:
${fullQA || 'None'}
${reportsBlock ? `\nLab/diagnostic reports on file:\n${reportsBlock}\n` : ''}
${bloodMarkersBlock ? `\nBlood panel test results on file (real extracted values):\n${bloodMarkersBlock}\n` : ''}
${mrxPrescriptionBlock ? `\nDoctor-approved MicrobiomeRX prescription on file (already finalized by a doctor, treat as settled clinical direction):\n${mrxPrescriptionBlock}\n` : ''}
Extract every specific fact mentioned:
- Exact symptoms (with duration, frequency, severity)
- Exact diet details (what they eat, when, how much)
- Exact lifestyle (sleep times, work hours, exercise history)
- Exact medical history (conditions, dates, medications, test results)
- Exact measurements (weight, height, lab values)
- Specific habits (good and bad)
- What has worked or failed before
${reportsBlock ? '- Exact lab/report findings (values, whether in/out of normal range)' : ''}
${bloodMarkersBlock ? '- Exact blood panel marker values, units, reference ranges, and which are out of range' : ''}
${mrxPrescriptionBlock ? '- Every doctor-approved supplement, therapy, and dietary item from the MicrobiomeRX prescription, with its exact dose/instructions' : ''}

Return as a bullet list. Every point must be specific and sourced from the data above. NO generalisations.` }
      ],
      temperature: 0.1,
      max_tokens: 900,
    })
    const patientFacts = factsRes.choices[0]?.message?.content?.trim() ?? ''
    console.log('Facts extracted:', patientFacts.slice(0, 200))

    // ── STEP 2: Overview ─────────────────────────────────────
    const overviewRes = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: `You are ${patient.full_name}'s treating nutritionist at Living Plus. Write directly to her/him.
STRICT RULES:
- Every sentence MUST reference a specific fact from the PATIENT FACTS list below
- Use exact details: their real food, their real symptoms, their real schedule
- FORBIDDEN words: "may", "might", "could", "possibly", "often", "many people", "typically", "generally"
- If you write something not in the facts list, delete it
- Tone: warm, direct, like a doctor who knows them personally
- Never use an em dash (—). Use a comma, period, or "and" instead` },
        { role: 'user', content: `PATIENT FACTS (use ONLY these):
${patientFacts}

NUTRITIONIST INSTRUCTIONS:
${roadmapInstructions || 'Focus on root cause healing based on their specific condition.'}

KB CLINICAL KNOWLEDGE:
${kbContext || 'Use clinical expertise.'}

Write 2 paragraphs directly to ${patient.full_name}.
Paragraph 1: Describe exactly what is happening in their body right now — using their specific symptoms, test results, eating patterns from the facts list.
Paragraph 2: Tell them exactly what will change over ${duration_months} months — specific to their condition and goals.
Use "you" throughout. Reference their real details. No generic health advice.` }
      ],
      temperature: 0.5,
      max_tokens: 650,
    })
    const overview = overviewRes.choices[0]?.message?.content?.trim() ?? ''

    // ── STEP 3/3B/3C: Lifestyle guidelines, meal guidelines, daily schedule ──
    // Shared with the coach-triggered "Regenerate" action on an existing
    // roadmap (regenerate-daily-content/route.ts) via lib/pdf/generateDailyContent.ts,
    // so a roadmap generated fresh and one backfilled later get identically
    // grounded content — regardless of which template (Week-family or
    // Classic/Almanac/Pulse/Onyx/Vitals) is picked.
    const { lifestyle_guidelines, meal_guidelines, daily_schedule } = await generateDailyContent(groq, patientFacts, kbContext)

    // ── STEP 3E: Daily Health Check-in checklist ──────────────
    // See lib/dailyChecklist.ts — selects/rephrases from confirmed
    // supplements + this roadmap's own lifestyle guidelines, never
    // originates a new item. Empty on any failure; buildGuideData() falls
    // back to buildDeterministicChecklist (same two real sources) when this
    // roadmap's daily_checklist_items ends up null.
    const confirmedSupplementsForChecklist = await resolveConfirmedSupplements(patient_id)
    const daily_checklist_items: ChecklistItem[] = await generateAIChecklist(confirmedSupplementsForChecklist, lifestyle_guidelines)

    // ── STEP 4: Clinical notes ────────────────────────────────
    const clinicalRes = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: 'Clinical nutritionist writing notes. Use only patient facts and KB. Be specific and clinical. Never use an em dash (—); use a comma, period, or "and" instead.' },
        { role: 'user', content: `PATIENT FACTS:
${patientFacts}

KB:
${kbContext || 'Use expertise.'}

Write 4 clinical notes, each section starting with EXACTLY one of these four header lines (plain text, no markdown bold, no extra words on the header line itself):
• Biomarkers:
• Diet protocol:
• Supplements:
• Red flags:

Under "Biomarkers:", list specific tests to track for this patient's exact condition with target ranges.
Under "Diet protocol:", give specific dietary intervention based on their actual eating patterns.
Under "Supplements:", give 2-3 specific supplements with exact doses, timing, and clinical reason for this patient.
Under "Red flags:", list specific warning signs to watch for given their history.

Each bullet under a section starts with •. Specific to this patient. No generic statements. No markdown formatting anywhere (no **, no #).` }
      ],
      temperature: 0.2,
      max_tokens: 1200, // was 400, raised to 800 after four multi-bullet
      // sections (biomarkers, diet protocol, supplements, red flags)
      // reliably ran out of budget mid-sentence on the last section
      // (observed: "Red flags" cut off at "Monitor Kalika" with nothing
      // after it) — this is patient-facing (Supplements + When-to-reach-us
      // PDF pages), so truncation isn't just an internal-notes annoyance.
      // Raised again to 1200 on the openai/gpt-oss-20b migration: it's a
      // reasoning model whose hidden reasoning tokens also count against
      // max_tokens (mitigated with reasoning_effort:'low' below, but still
      // needs more headroom than the old non-reasoning llama model did).
    })
    const nutritionist_guidelines = clinicalRes.choices[0]?.message?.content?.trim() ?? ''

    // ── STEP 5: Weekly schedule ───────────────────────────────
    // Handle short durations: 0.25 = 1 week, 0.5 = 2 weeks
    const totalWeeks = duration_months < 1
      ? Math.round(duration_months * 4)
      : duration_months * 4

    // A single completion can't reliably produce a full 12-month (48-week)
    // schedule — each week's JSON object now includes a 7-day escalation
    // breakdown on top of the base fields, roughly 800+ tokens per week, so
    // even 12 weeks alone would run past the model's ~8,192 output ceiling.
    // Generating in 6-week chunks keeps every individual call well inside
    // that limit regardless of total duration, and each chunk is told which
    // phase of the overall arc it represents so the progression (eliminate →
    // repair → rebuild) still holds across chunks.
    const WEEKS_PER_CHUNK = 6
    const chunkRanges: { startWeek: number; endWeek: number }[] = []
    for (let start = 1; start <= totalWeeks; start += WEEKS_PER_CHUNK) {
      chunkRanges.push({ startWeek: start, endWeek: Math.min(start + WEEKS_PER_CHUNK - 1, totalWeeks) })
    }

    function phaseGuidance(startWeek: number, endWeek: number): string {
      const third = totalWeeks / 3
      if (endWeek <= third) return 'This is the EARLY phase — eliminate triggers and address root causes from the facts.'
      if (startWeek > third * 2) return 'This is the LATE phase — optimise and sustain the improvements already built.'
      return 'This is the MID phase — build on earlier improvements and repair damage.'
    }

    // Caps how many prior themes get listed in the "don't repeat these"
    // instruction. Uncapped, a full 12-month (8-chunk) plan would list up to
    // 42 themes verbatim by the last chunk — a much harder ask for the model
    // to reliably honor than a handful, and untested at that length (the
    // real verification run only exercised 2 chunks / 6 themes). The
    // original bug's repeat cycle was every 12 weeks (2 chunks), so capping
    // to the 3 most recent chunks' worth of themes comfortably covers that
    // distance without the list growing unbounded on longer plans.
    const MAX_THEMES_IN_PROMPT = WEEKS_PER_CHUNK * 3
    function recentThemes(themes: string[]): string[] {
      return themes.slice(-MAX_THEMES_IN_PROMPT)
    }

    async function generateWeeklyChunk(startWeek: number, endWeek: number, usedThemes: string[]): Promise<unknown[]> {
      const weeksInChunk = endWeek - startWeek + 1
      const res = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: 'Return only a valid JSON array. No markdown. Write cause and actions directly to the patient using their specific facts. Never write generic health advice. Never use an em dash (—) anywhere in the text; use a comma, period, or "and" instead.' },
          { role: 'user', content: `PATIENT FACTS (the only source of truth — use these specific details):
${patientFacts}

KB CLINICAL KNOWLEDGE:
${kbContext || 'Use expertise.'}

NUTRITIONIST INSTRUCTIONS:
${roadmapInstructions || 'Address root causes from facts, then build on improvements, then optimise and sustain.'}

This is part of a longer ${totalWeeks}-week plan, split into chunks. This chunk covers ONLY weeks ${startWeek} to ${endWeek} — ${weeksInChunk} items total. ${phaseGuidance(startWeek, endWeek)}
${usedThemes.length > 0 ? `\nTHEMES ALREADY COVERED BY EARLIER WEEKS OF THIS SAME PLAN — do not repeat any of these, and do not write a close variant of one (e.g. "X and Y" when "X" already appeared):\n${recentThemes(usedThemes).map((t) => `- ${t}`).join('\n')}\nEvery week in this chunk must address a genuinely different physiological system or mechanism from all of the above.\n` : ''}
WEEK NUMBERING (critical — get this exact):
- The FIRST item's "week_number" MUST be exactly ${startWeek} (not 0, not 1 — exactly ${startWeek}).
- Each following item increments by exactly 1.
- The LAST item's "week_number" MUST be exactly ${endWeek}.
${weeksInChunk >= 2 ? `- Example: with ${weeksInChunk} items starting at ${startWeek}, the week_number sequence is ${startWeek}, ${startWeek + 1}, ${startWeek + 2}${weeksInChunk > 3 ? ', … ' + endWeek : ''}.` : ''}

RULES FOR CAUSE:
- Explain the BIOCHEMICAL MECHANISM — what is actually happening in the body at a cellular/hormonal level
- E.g. "Your elevated cortisol from 10-12hr workdays is suppressing progesterone production, which explains your irregular cycle. Cortisol and progesterone compete for the same receptor sites, so when cortisol dominates, progesterone cannot bind, disrupting your luteal phase."
- Be scientific. Use medical terms but explain them. Reference their actual symptoms.
- Never say "may", "might", "could", "typically"

RULES FOR ACTIONS — healthy lifestyle guidance, NOT a prescription:
- Each action is a specific, measurable HEALTHY LIFESTYLE habit: movement, hydration, sleep, meal timing/composition, stress management, or a real change to their actual daily schedule
- FORBIDDEN: naming any supplement, medication, or dose (e.g. "2 tablespoons of flaxseed", "400mg magnesium") — this section is lifestyle guidance the patient follows day to day, not a clinical prescription. Supplement dosing belongs only in the separate clinical Supplements section, never here.
- Still be specific about timing/frequency/duration: "a 15 minute walk after lunch daily", "lights off by 10pm", "protein at every meal" — specificity means exact timing and frequency, not a substance and quantity
- Include the WHY in one sentence after the action
- Reference their actual schedule/habits from Q&A and patient facts
- Actions should NOT suggest "consult a doctor" or "consult a nutritionist" — she is already at LP

RULES FOR "days" (building up through the week — make the progression visible in the wording itself, never just a changing number):
- Exactly 7 entries, one per day of THIS week, in order: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
- Each day has exactly 3 short lines, one per action above in the same order
- Each line must explicitly say where in the week's progression this is, in words — e.g. "Starting today: a 10 minute walk after lunch" building up to "Fully in place: a 20 minute walk after lunch" by Saturday. A reader should be able to tell this is a build-up from the phrase alone, not have to infer it from a number changing.
- Same "no supplement/dose" rule as actions above — the progression is in duration/frequency/consistency of a real habit, never a substance quantity
- Keep each line SHORT (under 16 words)
- E.g. for "Take a 15 minute walk after lunch daily": Sunday "Starting today: a 10 minute walk after lunch", Wednesday "Building up: a 15 minute walk after lunch", Saturday "Fully in place: a 20 minute walk after lunch"

[{
  "week_number": ${startWeek},
  "focus_theme": "Specific clinical theme",
  "cause": "3 sentences explaining the exact biochemical mechanism happening in their body. Scientific, specific to their condition and facts. Direct to patient.",
  "actions": [
    "Specific measurable healthy-lifestyle action with exact timing/frequency, why it works in one sentence, no supplement or dose",
    "Second specific lifestyle action with timing/frequency, scientific rationale, no supplement or dose",
    "Third specific lifestyle action tied to their actual daily schedule, no supplement or dose"
  ],
  "days": [
    ["Sunday's build-up-framed version of action 1", "Sunday's build-up-framed version of action 2", "Sunday's build-up-framed version of action 3"],
    ["Monday's build-up-framed version of action 1", "Monday's build-up-framed version of action 2", "Monday's build-up-framed version of action 3"],
    "… 7 total, Sunday through Saturday, each explicitly worded as further along the build-up than the day before"
  ],
  "milestone": "By end of this week, if you follow all actions: [1-2 specific, measurable changes the patient will notice, e.g. bloating reduces, energy improves by afternoon, bowel movement becomes regular]. Be specific and realistic."
}]

Exactly ${weeksInChunk} items, week_number ${startWeek} through ${endWeek}. Each week must address a different physiological system or mechanism from every other week in this chunk${usedThemes.length > 0 ? ' AND from every theme already covered above' : ''}. Every week needs its own complete "days" array — never omit it or leave it shorter than 7 entries.` }
        ],
        temperature: 0.3,
        // Raised per-week budget (was 850+300) on the openai/gpt-oss-120b
        // migration to leave headroom for hidden reasoning tokens, which
        // count against max_tokens on this model even at reasoning_effort
        // 'low'. Still capped at 8000 — Groq's practical output ceiling —
        // and 6 weeks/chunk (the max WEEKS_PER_CHUNK) stays under it.
        max_tokens: Math.min(8000, weeksInChunk * 1000 + 400),
      })
      const raw = res.choices[0]?.message?.content ?? ''
      const parsed = extractJSON(raw)
      if (!Array.isArray(parsed)) throw new Error(`Not an array (weeks ${startWeek}-${endWeek}). Raw: ${raw.slice(0, 200)}`)
      // Don't trust the model's own week_number — observed it start a chunk
      // at 0 instead of ${startWeek} despite explicit instructions. Position
      // in the array is unambiguous, so renumber sequentially regardless of
      // what the model wrote.
      return parsed.slice(0, weeksInChunk).map((week, i) => {
        const w: Record<string, unknown> = { ...(week as Record<string, unknown>), week_number: startWeek + i }
        // Deterministic floor: if the model dropped `days` (or returned it
        // malformed) for this week, synthesize the same explicit
        // build-up-framed progression from that week's own real `actions`
        // rather than let every template's `week.days?.[dayIndex] ?? week.actions`
        // fallback silently show the identical 3 actions on all 7 days.
        const actions = Array.isArray(w.actions) ? (w.actions as unknown[]).filter((a): a is string => typeof a === 'string') : []
        if (actions.length > 0 && !hasValidDays(w, actions.length)) {
          w.days = buildDayProgression(actions)
        }
        return w
      })
    }

    let weeklySchedule: unknown[]
    try {
      // Sequential, not parallel — Groq's TPM budget is shared across the
      // whole org, and this session has repeatedly hit that limit under
      // concurrent load; one chunk at a time stays well inside it. Being
      // sequential is also what makes cross-chunk theme memory possible:
      // usedThemes accumulates real focus_theme values from every
      // already-generated week and gets fed into each subsequent chunk's
      // prompt, so a long (6+ month) plan's later chunks know what earlier
      // ones already covered instead of independently re-deriving similar
      // themes from the same patient facts (observed on a real 48-week
      // roadmap: themes cycled every 12 weeks with no memory in place).
      weeklySchedule = []
      const usedThemes: string[] = []
      for (const { startWeek, endWeek } of chunkRanges) {
        const chunk = await generateWeeklyChunk(startWeek, endWeek, usedThemes)
        weeklySchedule.push(...chunk)
        for (const w of chunk) {
          const theme = (w as Record<string, unknown>).focus_theme
          if (typeof theme === 'string' && theme.trim()) usedThemes.push(theme.trim())
        }
      }
      console.log('Weeks:', weeklySchedule.length)
    } catch (err) {
      return NextResponse.json({ error: `Weekly parse failed. ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
    }

    // ── Save ─────────────────────────────────────────────────
    // A refresh writes fresh AI content into the SAME roadmap row (same id)
    // instead of inserting a new one — the patient's already-shared
    // /dashboard/{roadmapId} link keeps working unchanged, they just see
    // updated content next time they open it. guide_overrides (template,
    // theme, care team, hidden sections, etc.) is a coach's own separate
    // configuration and is deliberately left untouched by a refresh.
    //
    // Before that overwrite happens, archive whatever's currently live into
    // roadmap_versions — otherwise the previous session's plan is gone the
    // moment this one lands, with no way to see what the patient was
    // actually looking at last week. Best-effort: a failed snapshot should
    // never block the coach from getting their new roadmap.
    if (refresh_roadmap_id) {
      try {
        const { data: previous } = await supabaseAdmin
          .from('roadmaps')
          .select('session_id, overview, lifestyle_guidelines, meal_guidelines, daily_schedule, daily_checklist_items, nutritionist_guidelines, weekly_schedule, kb_sources, duration_months, guide_overrides')
          .eq('id', refresh_roadmap_id)
          .single()
        if (previous) {
          await supabaseAdmin.from('roadmap_versions').insert({
            roadmap_id: refresh_roadmap_id,
            session_id: previous.session_id,
            overview: previous.overview,
            lifestyle_guidelines: previous.lifestyle_guidelines,
            meal_guidelines: previous.meal_guidelines,
            daily_schedule: previous.daily_schedule,
            daily_checklist_items: previous.daily_checklist_items,
            nutritionist_guidelines: previous.nutritionist_guidelines,
            weekly_schedule: previous.weekly_schedule,
            kb_sources: previous.kb_sources,
            duration_months: previous.duration_months,
            guide_overrides: previous.guide_overrides,
          })
        }
      } catch (e) { console.log('Roadmap version archive failed (non-fatal):', e) }
    }

    const roadmapWrite = {
      overview, lifestyle_guidelines, meal_guidelines, daily_schedule,
      // Empty (generation skipped or failed) writes null, not `[]` — the
      // buildGuideData() fallback chain uses `??`, which only falls through
      // on null/undefined, not on a truthy-but-empty array.
      daily_checklist_items: daily_checklist_items.length > 0 ? daily_checklist_items : null,
      nutritionist_guidelines, weekly_schedule: weeklySchedule, kb_sources: kbSources, duration_months,
    }
    const { data: roadmap, error: roadmapError } = refresh_roadmap_id
      ? await supabaseAdmin.from('roadmaps').update(roadmapWrite).eq('id', refresh_roadmap_id).select().single()
      : await supabaseAdmin.from('roadmaps').insert({ session_id, patient_id, ...roadmapWrite, status: 'draft' }).select().single()

    if (roadmapError) {
      // Surfaced explicitly because it is the expected failure until v37/v38/v39 run.
      if (roadmapError.code === 'PGRST204' || /column .* does not exist/i.test(roadmapError.message)) {
        return NextResponse.json(
          { error: 'This needs migration_v37_add_meal_guidelines.sql, migration_v38_add_daily_schedule.sql, and migration_v39_daily_checklist.sql to be run first.' },
          { status: 503 }
        )
      }
      throw new Error(roadmapError.message)
    }
    await supabaseAdmin.from('sessions').update({ status: 'interpreted' }).eq('id', session_id)
    // Old check-ins were against the previous plan's actual task text —
    // meaningless once that text is replaced, so a refresh starts the
    // patient's tracking clean against the new content rather than showing
    // "goals done" that don't correspond to anything on the page anymore.
    if (refresh_roadmap_id) await supabaseAdmin.from('roadmap_checkins').delete().eq('roadmap_id', refresh_roadmap_id)
    console.log('=== DONE ===')

    return NextResponse.json({ success: true, roadmap_id: roadmap.id, roadmap: { ...roadmap, weekly_schedule: weeklySchedule } })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
