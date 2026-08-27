import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MAX_HISTORY_MESSAGES = 10
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Support both possible env var names
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY)!

const PAGE_TRIGGERS = ['this page','the page','look at','what does this','what about this','tell me about this','this section','these numbers','these values','this score','this patient','what it tells','interpret','explain this','what does it mean','is this','are these','this data','properly','what can you see','read this','analyse this','analyze this']
const KB_TRIGGERS   = ['supplement','supplements','recommend','recommendation','what to give','which product','aic','therapy','therapies','dietary','diet plan','protocol','treatment plan','what can be given','dose','dosage','phase 1','phase 2','phase 3','what should i prescribe','prescription','what supplement','plan for this','treatment for','what do i give']
// ADD after KB_TRIGGERS:
const FILTER_TRIGGERS = ['filter', 'narrow down', 'reduce', 'prioritise', 'prioritize', 'which ones', 'top supplements', 'most important', 'cut down', 'allergy', 'avoid', 'remove', 'skip', 'not suitable']
const isFilterQuery = (t: string) => FILTER_TRIGGERS.some(w => t.toLowerCase().includes(w))


const isPageQuery = (t: string) => PAGE_TRIGGERS.some(w => t.toLowerCase().includes(w))
const isKbQuery   = (t: string) => KB_TRIGGERS.some(w => t.toLowerCase().includes(w))
const hdr = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` })

async function searchKnowledge(query: string) {
  try {
    const kw = query.split(' ').slice(0,3).join('%')
    const r = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?content=ilike.*${kw}*&select=source_file,content&limit=4`, { headers: hdr() })
    const d = await r.json()
    return Array.isArray(d) ? d : []
  } catch { return [] }
}

async function getReportContext(id: string) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${id}&select=patient_name,patient_age_sex,report_data,rules_output&limit=1`, { headers: hdr() })
    const d = await r.json()
    return d?.[0] ?? null
  } catch { return null }
}

// ── Pre-filter AIC products to only what's relevant for this patient ──────────
async function getAICContext(reportId: string): Promise<string> {
  try {
    if (!SUPABASE_KEY) {
      console.error('[AIC] SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_ROLE_KEY are both undefined!')
      return ''
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}&select=report_data,patient_name,rules_output&limit=1`, { headers: hdr() })
    if (!r.ok) { console.error('[AIC] Report fetch failed:', r.status, r.statusText); return '' }

    const arr = await r.json()
    const rep = arr?.[0]
    if (!rep) { console.log('[AIC] No report found for', reportId); return '' }

    const raw  = (rep.report_data ?? {}) as Record<string,unknown>
    const ro   = rep.rules_output as any

    if (!raw || Object.keys(raw).length === 0) {
      console.log('[AIC] report_data is empty')
      return ''
    }

    const fmt = (v: unknown) => typeof v === 'number' ? v.toFixed(1) : v != null ? String(v) : '-'
    const num = (v: unknown) => typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0

    const hi   = (raw.health_indicators  ?? {}) as Record<string,unknown>
    const dr   = (raw.disease_risk       ?? {}) as Record<string,unknown>
    const scfa = (raw.scfa               ?? {}) as Record<string,unknown>
    const vit  = (raw.vitamins           ?? {}) as Record<string,unknown>
    const nt   = (raw.neurotransmitters  ?? {}) as Record<string,unknown>
    const prob = (raw.probiotics         ?? {}) as Record<string,unknown>
    const pathDet: string[] = Array.isArray(raw.pathogens_detected) ? raw.pathogens_detected as string[] : []
    const absent: string[]  = Array.isArray(prob.absent) ? prob.absent as string[] : []

    console.log('[AIC] HI keys:', Object.keys(hi).join(', '))
    console.log('[AIC] DR keys:', Object.keys(dr).join(', '))
    console.log('[AIC] report_data keys:', Object.keys(raw).join(', '))

    // ── Determine which SPECIFIC conditions apply ─────────────────────────
    const getHI = (key: string) => {
      const val = hi[key] ?? hi[key.replace(/_/g,' ')] ?? hi[key.replace(/\s/g,'_')]
      return num(typeof val === 'object' && val !== null && 'score' in (val as any) ? (val as any).score : val)
    }
    const getDR = (key: string) => {
      const val = dr[key] ?? dr[key.replace(/_/g,' ')] ?? dr[key.toLowerCase()]
      return num(val)
    }
    const getScfa  = (key: string) => num(scfa[key] ?? scfa[key.replace(/_/g,' ')])
    const getVit   = (key: string) => num(vit[key]  ?? vit[key.replace(/_/g,' ')])
    const getNt    = (key: string) => num(nt[key]   ?? nt[key.replace(/_/g,' ')])

    const rychIndex       = num(raw.rych_index ?? 0)
    const leakyGut        = getHI('leaky gut') || getHI('leaky_gut')
    const gutInflam       = getHI('gut inflammation') || getHI('gut_inflammation')
    const constipRisk     = getDR('constipation')
    const hypertensionRisk = getDR('hypertension')
    const diabetesRisk    = getDR('type2 diabetes') || getDR('type2_diabetes') || getDR('diabetes')
    const tmao            = getHI('tmao') || getHI('tmao_production')
    const microplastic    = getHI('microplastic') || getHI('microplastic_toxicity')
    const fatigue         = getHI('fatigue')
    const butyrate        = getScfa('butyrate')
    const propionate      = getScfa('propionate')
    const acetate         = getScfa('acetate')
    const vitB12          = getVit('vitamin_b12') || getVit('vitamin b12') || getVit('b12')
    const gaba            = getNt('gaba')
    const tryptophan      = getNt('tryptophan')

    console.log(`[AIC] Rych:${rychIndex} LeakyGut:${leakyGut} GutInflam:${gutInflam} Constip:${constipRisk}% Absent:${absent.length} Pathogens:${pathDet.length}`)

    // ── Build the relevant conditions list ────────────────────────────────
    const relevantConditions: string[] = []

    if (leakyGut > 0 && leakyGut < 65)    relevantConditions.push('Leaky Gut Syndrome - Moderate', 'Leaky Gut Syndrome - Severe + IBD Risk')
    if (gutInflam > 0 && gutInflam < 65)   relevantConditions.push('Colonic Inflammation + Leaky Gut', 'Severe Gut Inflammation + IBD/IBS Trigger')
    if (constipRisk > 20)                  relevantConditions.push('Constipation + Gut Stasis + Dysbiosis Perpetuation', 'Methane-Dominant SIBO / Constipation Driver')
    if (absent.length > 0)                 relevantConditions.push('Moderate Gut Dysbiosis', 'Severe Gut Dysbiosis', 'Post-Antibiotic Gut Damage')
    if (pathDet.length > 0)                relevantConditions.push('Fungal Dysbiosis / Candida Overgrowth', 'Blastocystis Parasitic Colonisation', 'Multi-Drug Resistance Profile')
    if (butyrate > 0 && butyrate < 60)     relevantConditions.push('Butyrate Deficiency - Colonocyte Energy Failure')
    if (tmao > 40)                         relevantConditions.push('Microplastic Toxicity + Systemic Toxin Load')
    if (vitB12 > 0 && vitB12 < 47)        relevantConditions.push('B12 Deficiency - Neurological + Energy + Anemia')
    if (gaba > 0 && gaba < 50)            relevantConditions.push('Neurotransmitter Deficiency - Serotonin + Dopamine + GABA', 'Anxiety + Poor Sleep + Gut Motility Impairment')
    if (diabetesRisk > 10)                 relevantConditions.push('Metabolic Dysregulation - T2D Risk')
    if (hypertensionRisk > 15)             relevantConditions.push('Cardiovascular Risk - Microbiome-Driven Hypertension')
    if (rychIndex < 45)                    relevantConditions.push('Immune Suppression + Leaky Gut + Oxidative Stress')

    // Always add base conditions
    relevantConditions.push('Gut Barrier Failure - Mucin Layer Degradation', 'Prevotella Deficiency - Fibre Fermentation Gap')

    const uniqueConditions = [...new Set(relevantConditions)].slice(0, 12)
    console.log('[AIC] Relevant conditions:', uniqueConditions.length, uniqueConditions.slice(0,3).join(', '))

    if (uniqueConditions.length === 0) return ''

    // ── Fetch matching products from supplement_stack ─────────────────────
    const [sr, tr, dr2] = await Promise.all([
      Promise.all(uniqueConditions.slice(0,8).map(c =>
        fetch(`${SUPABASE_URL}/rest/v1/supplement_stack?condition_name=eq.${encodeURIComponent(c)}&select=condition_name,product_name,aic_category,dose,timing,duration,mechanism,protocol_phase,notes&order=supplement_priority.asc&limit=4`, { headers: hdr() })
          .then(r => r.ok ? r.json() : []).catch(() => [])
      )),
      Promise.all(uniqueConditions.slice(0,5).map(c =>
        fetch(`${SUPABASE_URL}/rest/v1/therapy_protocols?condition_name=eq.${encodeURIComponent(c)}&select=condition_name,therapy_type,modality,frequency,course_length,dosing_protocol&limit=3`, { headers: hdr() })
          .then(r => r.ok ? r.json() : []).catch(() => [])
      )),
      Promise.all(uniqueConditions.slice(0,5).map(c =>
        fetch(`${SUPABASE_URL}/rest/v1/dietary_protocols?condition_name=eq.${encodeURIComponent(c)}&select=condition_name,phase,duration,specific_instructions,foods_to_include,foods_to_avoid&limit=3`, { headers: hdr() })
          .then(r => r.ok ? r.json() : []).catch(() => [])
      )),
    ])

    const seenS = new Set<string>()
    const supps = sr.flat().filter((s:any) => {
      if (!s?.product_name || seenS.has(s.product_name)) return false
      seenS.add(s.product_name); return true
    })
    const seenT = new Set<string>()
    const thers = tr.flat().filter((t:any) => {
      const k = `${t?.modality}_${t?.condition_name}`
      if (!t?.condition_name || seenT.has(k)) return false
      seenT.add(k); return true
    })
    const seenD = new Set<string>()
    const diets = dr2.flat().filter((d:any) => {
      const k = `${d?.condition_name}_${d?.phase}`
      if (!d?.condition_name || seenD.has(k)) return false
      seenD.add(k); return true
    })

    console.log(`[AIC] MATCHED: ${supps.length} supplements, ${thers.length} therapies, ${diets.length} dietary`)

    // Fallback: if rules_output already has supplements, use those
    let engineBlock = ''
    if (supps.length === 0 && ro?.supplements?.length > 0) {
      const items = (ro.supplements as any[]).slice(0,12)
        .map((s:any) => `  • [${s.protocol_phase}] ${s.product_name} - ${s.dose ?? ''} | ${s.timing ?? ''}`)
        .join('\n')
      engineBlock = `\nPREVIOUSLY GENERATED PLAN (use these):\n${items}`
      console.log('[AIC] Using rules_output supplements as fallback')
    }

    if (supps.length === 0 && !engineBlock) {
      console.log('[AIC] No supplements matched - returning empty')
      return ''
    }

    // ── Build summary ─────────────────────────────────────────────────────
    const bioSummary = [
      `Rych Index: ${rychIndex} | Antibiotic Recovery: ${fmt(raw.antibiotic_recovery)}`,
      `Leaky Gut: ${leakyGut.toFixed(1)} (low=bad) | Gut Inflammation: ${gutInflam.toFixed(1)} (low=bad)`,
      `Constipation Risk: ${constipRisk.toFixed(1)}% | Hypertension: ${hypertensionRisk.toFixed(1)}% | T2D: ${diabetesRisk.toFixed(1)}%`,
      `SCFA - Butyrate: ${butyrate.toFixed(1)} | Propionate: ${propionate.toFixed(1)} | Acetate: ${acetate.toFixed(1)}`,
      absent.length > 0 ? `Absent Probiotics: ${absent.join(', ')}` : 'Absent Probiotics: None',
      pathDet.length > 0 ? `Pathogens: ${pathDet.join(', ')}` : 'Pathogens: None',
    ].join('\n')

    // Limit to 8 supplements to stay under token limit
    const suppBlock = supps.slice(0,8).length > 0
      ? supps.slice(0,8).map(s =>
          `• [${s.protocol_phase}] ${s.product_name}: ${s.dose ?? '-'} ${s.timing ?? ''} - ${s.condition_name}`
        ).join('\n')
      : 'No supplements matched from KB.'

    const therBlock = thers.slice(0,4).length > 0
      ? thers.slice(0,4).map(t => `• ${t.modality || t.therapy_type}: ${t.frequency ?? '-'} | ${t.course_length ?? '-'}`).join('\n')
      : ''

    const dietBlock = diets.slice(0,4).length > 0
      ? diets.slice(0,4).map(d => `• ${d.condition_name} (${d.phase ?? ''}): ${(d.specific_instructions ?? '').slice(0,120)}`).join('\n')
      : ''

    // Pre-format the complete supplement answer - LLM only adds 1-sentence rationale
    const preformatted = supps.slice(0,8).map(s =>
      `• ${s.product_name} [${s.protocol_phase}]\n  Dose: ${s.dose ?? '-'} | Timing: ${s.timing ?? '-'}\n  Condition: ${s.condition_name}`
    ).join('\n\n')

    return [
      '=== SUPPLEMENT RECOMMENDATION FOR THIS PATIENT ===',
      bioSummary,
      engineBlock,
      '',
      'THE FOLLOWING ARE THE ONLY SUPPLEMENTS TO RECOMMEND.',
      'DO NOT ADD ANY OTHER PRODUCTS. DO NOT CHANGE NAMES OR DOSES.',
      'Your only job is to list these exactly and add 1 sentence explaining why each was triggered:',
      '',
      preformatted,
      thers.length > 0 ? `\nTHERAPIES:\n${therBlock}` : '',
      diets.length > 0 ? `\nDIETARY:\n${dietBlock}` : '',
      '',
      'FORMAT YOUR ANSWER: List each supplement above with its dose/timing, then 1 sentence: "Triggered because [biomarker] shows [value]."',
      'DO NOT invent supplements like "Dipeptivan", "IV Glutathione", "Zinc Carnosine" etc.',
      '=== END ===',
    ].filter(Boolean).join('\n')

  } catch (err) {
    console.error('[getAICContext]', err)
    return ''
  }
}

function buildPageDataContext(pageCtx: any): string {
  if (!pageCtx?.data) return ''
  const lines = [
    `=== CURRENT PAGE: ${pageCtx.label} ===`,
    `Section: ${pageCtx.section}`,
    pageCtx.patientName ? `Patient: ${pageCtx.patientName}` : '',
    '', 'PAGE DATA:',
  ].filter(Boolean)

  function flatten(obj: Record<string,unknown>, prefix = '') {
    for (const [k,v] of Object.entries(obj)) {
      if (v == null) continue
      const label = prefix ? `${prefix}.${k}` : k
      if (Array.isArray(v)) {
        lines.push(`${label} (${v.length}):`)
        v.slice(0,30).forEach((i:any) => lines.push(`  - ${typeof i==='object'?JSON.stringify(i):i}`))
        if (v.length>30) lines.push(`  … +${v.length-30} more`)
      } else if (typeof v==='object') {
        flatten(v as Record<string,unknown>, label)
      } else {
        lines.push(`${label}: ${v}`)
      }
    }
  }
  flatten(pageCtx.data)
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { messages, report_id, active_section, page_context } = await req.json()
    const last = [...messages].reverse().find((m:any) => m.role==='user')?.content ?? ''
    const pageTrig = isPageQuery(last)
    const kbTrig   = isKbQuery(last)

    const [chunks, report, aicContext] = await Promise.all([
      pageTrig ? Promise.resolve([]) : searchKnowledge(last),
      report_id ? getReportContext(report_id) : Promise.resolve(null),
      (report_id && (kbTrig || !pageTrig)) ? getAICContext(report_id) : Promise.resolve(''),
    ])

    const knowledgeCtx = chunks.length > 0
      ? chunks.map((c:any,i:number) => `[${i+1}: ${c.source_file}]\n${c.content}`).join('\n\n---\n\n')
      : ''
    // Do NOT send full report_data JSON - too large. AIC context already has biomarker summary.
    const reportCtx = report
      ? `Patient: ${report.patient_name ?? ''}, ${report.patient_age_sex ?? ''}`
      : ''
    const pageCtx = page_context ? buildPageDataContext(page_context) : ''

    const filterTrig = isFilterQuery(last)

    if (kbTrig && aicContext && aicContext.includes('===') && !filterTrig) {
      // Direct answer for generic supplement queries
      const lines = aicContext.split('\n')
      const startIdx = lines.findIndex(l => l.includes('THE FOLLOWING ARE THE ONLY SUPPLEMENTS'))
      const endIdx   = lines.findIndex(l => l.includes('FORMAT YOUR ANSWER'))
      if (startIdx > -1 && endIdx > -1) {
        const bioStart = lines.findIndex(l => l.includes('=== SUPPLEMENT RECOMMENDATION'))
        const bio = lines.slice(bioStart + 1, startIdx).filter(Boolean).join('\n')
        const suppList = lines.slice(startIdx + 3, endIdx).filter(Boolean).join('\n')
        const therLine = lines.find(l => l.startsWith('THERAPIES:')) ?? ''
        const dietLine = lines.find(l => l.startsWith('DIETARY:')) ?? ''
        const directAnswer = [
          `Based on ${reportCtx ? reportCtx.split(',')[0] : 'this patient'}'s biomarkers:\n`,
          bio ? `📊 ${bio}\n` : '',
          '**RECOMMENDED AIC SUPPLEMENTS:**\n',
          suppList,
          therLine ? `\n**THERAPIES:**\n${therLine.replace('THERAPIES:','').trim()}` : '',
          dietLine ? `\n**DIETARY PROTOCOL:**\n${dietLine.replace('DIETARY:','').trim()}` : '',
          '\n⚠ These recommendations are from the LP clinical database. Always review with the treating physician.',
        ].filter(Boolean).join('\n')
        return NextResponse.json({ reply: directAnswer })
      }
    }

    // Build active supplement list from page context for filter queries
    const activeSupps = (page_context?.data?.active_supplements as any[]) ?? []
    const suppNames = activeSupps.map((s:any) => s.name || s.label).filter(Boolean)

    const filterContext = filterTrig && suppNames.length > 0
      ? `CURRENT SUPPLEMENT LIST ON PAGE (${suppNames.length} items):\n${suppNames.map((n:string,i:number) => `${i+1}. ${n}`).join('\n')}`
      : ''

    const filterInstruction = filterTrig
      ? `The doctor wants to FILTER or PRIORITISE the supplement list. 
Doctor's request: "${last}"
${filterContext}
- Remove any supplements the doctor flagged as allergies or contraindicated
- Group remaining into: MUST KEEP, RECOMMENDED, CAN REMOVE
- Give one clinical reason per supplement tied to this patient's biomarkers
- Be specific — reference actual values (Leaky Gut: ${page_context?.data?.rych_index ?? '?'}, pathogens, etc.)
- Do NOT repeat supplements the doctor said to remove`
      : ''

    const system = [
      'You are a senior clinical gut microbiome specialist at Living Plus. You assist doctors in reviewing specific patient cases.',
      reportCtx ? `Patient: ${reportCtx}` : '',
      page_context?.data ? `Rych Index: ${page_context.data.rych_index ?? '?'} | Conditions: ${(page_context.data.conditions_flagged as string[] ?? []).join(', ')}` : '',
      filterInstruction || (pageTrig && pageCtx ? `PAGE DATA:\n${pageCtx.slice(0, 2000)}` : ''),
      !filterTrig && aicContext ? aicContext.slice(0, 1500) : '',
      knowledgeCtx ? `KB:\n${knowledgeCtx.slice(0,600)}` : '',
      'Answer ONLY about this specific patient. Never give generic advice.',
    ].filter(Boolean).join('\n\n')

    // Cap history sent back to the model - unbounded ...messages makes cost grow
    // quadratically with conversation length since every prior turn gets resent.
    const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES)

    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: system },
        ...recentMessages,
      ],
    })

    return NextResponse.json({ reply: response.choices[0].message.content })
  } catch (err: any) {
    console.error('[rag-query]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
