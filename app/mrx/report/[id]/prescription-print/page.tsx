'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Phone, Mail, MapPin, Globe, AlertTriangle, CheckCircle2, Pencil, X, NotebookPen } from 'lucide-react'

interface Section {
  key: string; label: string; aicProduct?: string
  detail: string; rationale: string; doctorNote: string
  status: 'kb' | 'modified' | 'added' | 'removed'
  category?: string; phase?: string; contraindications?: string
}
type MS = Section & { _subs?: Section[] }

interface PrescriptionData {
  patient_name: string; patient_age_sex: string
  rych_index: number; rych_tier_label: string
  conditions_flagged: string[]
  sections: { supplements: Section[]; therapies: Section[]; dietary: Section[] }
  clinical_impression: string; doctor_notes: string; approved_at: string | null
}
interface DoctorInfo { name: string; degree: string; reg_no: string; signature_data_url: string | null }

// ── Editable prescription item ─────────────────────────────────
interface RxItem {
  key: string
  displayName: string
  displaySub: string
  frequency: string
  duration: string
  doctorNote: string
  contraindications: string
  phase: string
  removed: boolean
}

const PHASE_ORDER = ['Phase 1','Phase 1+2','Phase 2','Phase 3',
  'Tier 1','Tier 1 — Supportive','Tier 2','Tier 2 — Moderate','Tier 2-3','Tier 3']
const PHASE_STYLE: Record<string,{bg:string;text:string;border:string}> = {
  'Phase 1':             {bg:'#538A22',text:'#fff',border:'#538A22'},
  'Phase 1+2':           {bg:'#6EA832',text:'#fff',border:'#6EA832'},
  'Phase 2':             {bg:'#A8D878',text:'#2A4D0D',border:'#8BC44F'},
  'Phase 3':             {bg:'#C8E9A8',text:'#2A4D0D',border:'#A8D878'},
  'Tier 1':              {bg:'#DBEAFE',text:'#1E40AF',border:'#BFDBFE'},
  'Tier 1 — Supportive': {bg:'#DBEAFE',text:'#1E40AF',border:'#BFDBFE'},
  'Tier 2':              {bg:'#FEF3C7',text:'#92400E',border:'#FDE68A'},
  'Tier 2 — Moderate':   {bg:'#FEF3C7',text:'#92400E',border:'#FDE68A'},
  'Tier 2-3':            {bg:'#FEF3C7',text:'#92400E',border:'#FDE68A'},
  'Tier 3':              {bg:'#FCE7F3',text:'#9D174D',border:'#FBCFE8'},
}

function groupByPhase(items: RxItem[]) {
  const g: Record<string,RxItem[]> = {}
  for (const i of items) {
    if (i.removed) continue
    const k = i.phase || 'Other'
    if (!g[k]) g[k] = []
    g[k].push(i)
  }
  const r: {phase:string;items:RxItem[]}[] = []
  for (const p of PHASE_ORDER) if (g[p]?.length) r.push({phase:p,items:g[p]})
  for (const k of Object.keys(g)) if (!PHASE_ORDER.includes(k)) r.push({phase:k,items:g[k]})
  return r
}

function groupDietaryByPhase(items: MS[]) {
  const g: Record<string,MS[]> = {}
  for (const i of items) {
    const match=(i.phase||'').match(/Phase\s*\d+(\+\d+)?/i)
    const base=match?match[0]:(i.phase||'Other')
    if(!g[base])g[base]=[]
    g[base].push(i)
  }
  const r: {phase:string;items:MS[]}[] = []
  for (const p of PHASE_ORDER) if(g[p]?.length) r.push({phase:p,items:g[p]})
  for (const k of Object.keys(g)) if(!PHASE_ORDER.includes(k)) r.push({phase:k,items:g[k]})
  return r
}

function mergeByAic(items: Section[]): MS[] {
  const g: Record<string,Section[]> = {}; const o: string[] = []
  for (const i of items) {
    const k=i.aicProduct?.trim()||i.label?.trim()||i.key
    if(!g[k]){g[k]=[]; o.push(k)} g[k].push(i)
  }
  return o.map(k=>{
    const gr=g[k]; if(gr.length===1) return gr[0]
    return { ...gr[0], label:gr[0].aicProduct||gr[0].label, detail:'',
      doctorNote:gr.map(i=>i.doctorNote).filter(Boolean).join('; '),
      contraindications:gr.map(i=>i.contraindications).filter(Boolean).join('; '),
      _subs:gr }
  })
}

function fmtDate(iso: string|null) {
  if(!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}).replace(/ /g,'/')
}
function parseDet(d: string) {
  const p=d.split(' · ').map(s=>s.trim()).filter(Boolean)
  if(p.length===0) return {dose:'',timing:'',dur:''}
  if(p.length===1) return {dose:p[0],timing:'',dur:''}
  if(p.length===2) return {dose:p[0],timing:p[1],dur:''}
  return {dose:p[0],timing:p[1],dur:p[2]}
}
function freq(dose:string,timing:string):string {
  const d=(dose+' '+timing).toLowerCase()
  if(d.includes('3x')||d.includes('tds')||d.includes('thrice')) return '1-1-1'
  if(d.includes('2x')||d.includes('twice')||d.includes('bd')) return '1-0-1'
  if(d.includes('bedtime')||d.includes('night')||d.includes('evening')) return '0-0-1'
  if(d.includes('morning')||d.includes('sublingual')||d.includes('1x')||d.includes('once')||d.includes('od')) return '1-0-0'
  if(d.includes('weekly')||d.includes('week')) return 'Weekly'
  if(d.includes('monthly')||d.includes('month')) return 'Monthly'
  return ''
}

function FtrRow() {
  const fi: React.CSSProperties = {display:'flex',alignItems:'center',gap:5}
  return (
    <div style={{display:'flex',justifyContent:'space-between',width:'100%',fontSize:'9.5px',color:'#555'}}>
      <div style={{display:'flex',flexDirection:'column',gap:2}}>
        <span style={fi}><Phone size={11} color="#C2185B" /> +91 7293111120</span>
        <span style={fi}><Mail size={11} color="#538A22" /> ClinicLivingPlus@gmail.com</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:2,textAlign:'right'}}>
        <span style={{...fi,justifyContent:'flex-end'}}><MapPin size={11} color="#C2185B" /> 27th Main, HSR Layout, Bangalore</span>
        <span style={{...fi,justifyContent:'flex-end'}}><Globe size={11} color="#1565C0" /> www.cliniclivingplus.com</span>
      </div>
    </div>
  )
}

// ── Inline editable text ────────────────────────────────────────
function Editable({ value, onChange, style, multiline }: {
  value: string; onChange: (v: string) => void; style?: React.CSSProperties; multiline?: boolean
}) {
  const base: React.CSSProperties = {
    background: 'transparent', border: 'none', outline: 'none',
    width: '100%', fontFamily: 'inherit', fontSize: 'inherit',
    color: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit',
    cursor: 'text', ...style,
  }
  if (multiline) return (
    <textarea value={value} onChange={e => onChange(e.target.value)}
      rows={Math.max(1, value.split('\n').length)}
      style={{ ...base, resize: 'none', overflow: 'hidden' }} />
  )
  return <input value={value} onChange={e => onChange(e.target.value)} style={base} />
}

export default function PrescriptionPrintPage() {
  const params   = useParams()
  const reportId = params.id as string
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'mrx' } }
  )

  const [data,        setData]        = useState<PrescriptionData|null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string|null>(null)
  const [doc,         setDoc]         = useState<DoctorInfo>({name:'',degree:'MBBS',reg_no:'',signature_data_url:null})
  const [editMode,    setEditMode]    = useState(false)

  // ── Editable fields ──────────────────────────────────────────
  const [patientName,    setPatientName]    = useState('')
  const [patientAgeSex,  setPatientAgeSex]  = useState('')
  const [rychLabel,      setRychLabel]      = useState('')
  const [conditions,     setConditions]     = useState<string[]>([])
  const [clinicalNote,   setClinicalNote]   = useState('')
  const [doctorNote,     setDoctorNote]     = useState('')
  const [rxItems,        setRxItems]        = useState<RxItem[]>([])
  const [dietaryItems,   setDietaryItems]   = useState<MS[]>([])

  useEffect(()=>{
    const hide=()=>{
      const b=document.querySelector('button[aria-label="Toggle Clinical Assistant"]') as HTMLElement|null
      const p=document.querySelector('div[style*="width:400px"]') as HTMLElement|null
      if(b) b.style.setProperty('display','none','important')
      if(p) p.style.setProperty('display','none','important')
    }
    hide(); const t1=setTimeout(hide,200); const t2=setTimeout(hide,800)
    return ()=>{clearTimeout(t1);clearTimeout(t2)}
  },[])

  // ── Build rxItems from merged sections ───────────────────────
  function buildRxItems(sections: PrescriptionData['sections']): RxItem[] {
    const raw = [...sections.supplements, ...sections.therapies].filter(s => s.status !== 'removed')
    const merged = mergeByAic(raw)
    const items: RxItem[] = []
    // Build phase groups to assign numbers correctly
    const grouped = (() => {
      const g: Record<string,MS[]> = {}
      for (const i of merged) { const k=i.phase||'Other'; if(!g[k])g[k]=[]; g[k].push(i) }
      const r: {phase:string;items:MS[]}[] = []
      for (const p of PHASE_ORDER) if(g[p]?.length) r.push({phase:p,items:g[p]})
      for (const k of Object.keys(g)) if(!PHASE_ORDER.includes(k)) r.push({phase:k,items:g[k]})
      return r
    })()
    for (const {phase, items: phaseItems} of grouped) {
      for (const item of phaseItems) {
        const isMerged = !!(item as MS)._subs
        const subs = (item as MS)._subs
        const effectiveDetail = item.detail || (isMerged && subs?.[0]?.detail) || ''
        const {dose:ed, timing:et, dur:edr} = parseDet(effectiveDetail)
        items.push({
          key: item.key,
          displayName: item.aicProduct || item.label,
          displaySub: [ed, et].filter(Boolean).join(' · '),
          frequency: freq(ed, et),
          duration: edr || '',
          doctorNote: item.doctorNote || '',
          contraindications: item.contraindications || '',
          phase,
          removed: false,
        })
      }
    }
    return items
  }

  useEffect(()=>{
    async function load(){
      const {data:{session}}=await supabase.auth.getSession()
      if(session){
        const {data:d}=await supabase.from('doctors')
          .select('name,degree,reg_no,signature_data_url')
          .eq('user_id',session.user.id).maybeSingle()
        if(d) setDoc({
          name:d.name||session.user.user_metadata?.full_name||session.user.email||'',
          degree:d.degree||'MBBS', reg_no:d.reg_no||'',
          signature_data_url:d.signature_data_url||null,
        })
        else setDoc(p=>({...p,name:session.user.user_metadata?.full_name||session.user.email||''}))
      }
      const {data:rep}=await supabase.from('reports')
        .select('patient_name,patient_age_sex,rules_output').eq('id',reportId).single()
      if(!rep){setError('Report not found');setLoading(false);return}
      const ro=rep.rules_output as any

      // Always read the live prescription from Supabase — this is the single
      // source of truth. The review page's "Download" button now calls
      // saveDraft() before opening this tab, so rx_data always reflects
      // whatever is currently on screen (including any AI filter results).
      // We deliberately do NOT use a one-shot sessionStorage handoff here:
      // that approach breaks the moment this effect runs more than once
      // (React Strict Mode in dev, a tab refresh, re-triggering window.print()),
      // silently falling back to stale data with no visible error.
      const {data:rx}=await supabase.from('prescriptions')
        .select('rx_data,approved_at').eq('report_id',reportId).maybeSingle()
      const rd=rx?.rx_data as any
      const sections=rd?.sections??{
        supplements:(ro?.supplements??[]).map((s:any,i:number)=>({
          key:`supp_${i}`,label:s.product_name,aicProduct:s.aic_product_name,
          detail:[s.dose,s.timing,s.duration].filter(Boolean).join(' · '),
          rationale:s.mechanism,doctorNote:'',status:'kb',category:s.aic_category,phase:s.protocol_phase})),
        therapies:(ro?.therapies??[]).map((t:any,i:number)=>({
          key:`ther_${i}`,label:t.modality||t.therapy_type,
          detail:[t.frequency,t.course_length].filter(Boolean).join(' · '),
          rationale:t.dosing_protocol,doctorNote:'',status:'kb',
          category:t.therapy_type,phase:t.tier_indication,contraindications:t.contraindication_screen})),
        dietary:(ro?.dietary??[]).map((d:any,i:number)=>({
          key:`diet_${i}`,label:`${d.condition_name} - ${d.phase}`,
          detail:d.duration,rationale:d.specific_instructions,doctorNote:'',status:'kb',phase:d.phase})),
      }
      const d: PrescriptionData = {
        patient_name:rep.patient_name||'Unknown',patient_age_sex:rep.patient_age_sex||'',
        rych_index:Number(ro?.rych_index??0),rych_tier_label:ro?.rych_tier_label??'',
        conditions_flagged:ro?.conditions_flagged??[],sections,
        clinical_impression:rd?.clinical_impression||'',doctor_notes:rd?.doctor_notes||'',
        approved_at:rx?.approved_at??null,
      }
      setData(d)
      initEditable(d)
      setLoading(false)
    }
    load()
  },[reportId])

  function initEditable(d: PrescriptionData) {
    setPatientName(d.patient_name)
    setPatientAgeSex(d.patient_age_sex)
    setRychLabel(`Rych Index: ${d.rych_index} - ${d.rych_tier_label}`)
    setConditions([...d.conditions_flagged])
    setClinicalNote(d.clinical_impression)
    setDoctorNote(d.doctor_notes)
    setRxItems(buildRxItems(d.sections))
    setDietaryItems(d.sections.dietary.filter(x => x.status !== 'removed') as MS[])
  }

  useEffect(()=>{ if(!loading&&data) setTimeout(()=>window.print(),700) },[loading,data])

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><p style={{color:'#538A22',fontFamily:'Arial'}}>Preparing prescription…</p></div>
  if(error||!data) return <div style={{padding:40,fontFamily:'Arial'}}><p>Error: {error||'Could not load'}</p></div>

  const today   = fmtDate(new Date().toISOString())
  const grouped = groupByPhase(rxItems)
  const groupedDietary = groupDietaryByPhase(dietaryItems)
  let n = 1
  const idx: Record<string,number> = {}
  for (const {items} of grouped) for (const item of items) idx[item.key] = n++
  for (const {items} of groupedDietary) for (const item of items) idx[item.key] = n++

  const Logo=({h}:{h:number})=>(
    <img src="/logo.png" alt="LP" style={{height:h,width:'auto'}}
      onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
  )

  // ── Edit helpers ─────────────────────────────────────────────
  const updateRxItem = (key: string, field: keyof RxItem, val: string) => {
    setRxItems(prev => prev.map(i => i.key === key ? {...i, [field]: val} : i))
  }
  const removeRxItem = (key: string) => {
    setRxItems(prev => prev.map(i => i.key === key ? {...i, removed: true} : i))
  }
  const addRxItem = () => {
    const key = `manual_${Date.now()}`
    setRxItems(prev => [...prev, {
      key, displayName: 'New Item', displaySub: '', frequency: '',
      duration: '', doctorNote: '', contraindications: '', phase: 'Phase 2', removed: false,
    }])
  }

  // ── Edit mode toolbar styles ─────────────────────────────────
  const editInput: React.CSSProperties = editMode ? {
    borderBottom: '1px dashed #C8E9A8', background: 'transparent',
    outline: 'none', width: '100%', fontFamily: 'Arial,sans-serif',
  } : {}

  return (
    <>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:Arial,sans-serif;background:#e8e8e8;color:#1a1a1a;}
        .ab{position:fixed;top:0;left:0;right:0;background:#1A3207;padding:10px 24px;
          display:flex;justify-content:space-between;align-items:center;z-index:500;}
        .ab p{font-size:13px;color:#A8D878;}
        .pb{background:#538A22;color:white;border:none;padding:8px 20px;border-radius:6px;
          font-size:13px;font-weight:bold;cursor:pointer;}
        .eb{background:#1E40AF;color:white;border:none;padding:8px 16px;border-radius:6px;
          font-size:13px;font-weight:bold;cursor:pointer;}
        .wn{font-size:11px;color:#FCD34D;display:flex;align-items:center;gap:6px;}
        table.ptbl{display:block;width:100%;}
        table.ptbl thead{display:none;}
        table.ptbl tfoot{display:none;}
        table.ptbl tbody{display:block;}
        table.ptbl tr{display:block;}
        table.ptbl td{display:block;}
        .pftr{display:none;}
        .page{background:white;max-width:794px;width:794px;margin:68px auto 20px;
          padding:36px 52px 32px;box-shadow:0 4px 24px rgba(0,0,0,.10);}
        .slh{display:flex;align-items:center;justify-content:space-between;
          margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #538A22;}
        .slhl{display:flex;align-items:center;gap:12px;}
        .ct{font-size:11px;color:#538A22;font-style:italic;}
        .lr{text-align:right;font-size:10px;color:#888;line-height:1.6;}
        .pn{font-size:17px;font-weight:bold;text-align:center;margin-bottom:6px;}
        .pd{text-align:right;font-size:12px;color:#333;margin-bottom:14px;}
        .fr{display:flex;gap:16px;font-size:12px;margin-bottom:12px;}
        .fl{flex-shrink:0;font-weight:bold;width:160px;}
        .fc{flex:1;line-height:1.8;color:#333;}
        .ry{font-weight:bold;color:#538A22;}
        .nb{font-size:12px;border-top:1px solid #eee;padding-top:10px;margin-bottom:14px;}
        .nh{font-weight:bold;font-size:13px;margin-bottom:8px;}
        .nr{display:flex;gap:16px;margin-bottom:6px;}
        .nl{flex-shrink:0;width:160px;color:#555;font-weight:bold;}
        .nc{flex:1;color:#333;line-height:1.6;}
        .rxh{font-size:36px;font-weight:bold;color:#1A3207;margin:4px 0 10px;}
        .rxch{display:grid;grid-template-columns:36px 1fr 110px 110px;
          border-bottom:2px solid #1A3207;border-top:1px solid #1A3207;padding:7px 0;}
        .rxch span{font-size:11px;font-weight:bold;color:#1A3207;text-transform:uppercase;letter-spacing:.5px;}
        .rxpd{display:flex;align-items:center;gap:12px;margin:10px 0 4px;
          page-break-after:avoid;break-after:avoid;}
        .rxpl{height:1px;flex:1;background:#E2F3D0;}
        .rxpb{font-size:10px;font-weight:bold;letter-spacing:.8px;text-transform:uppercase;
          padding:2px 10px;border-radius:10px;white-space:nowrap;}
        .rxi{display:block;border-bottom:1px solid #eee;page-break-inside:avoid;break-inside:avoid;}
        .rxir{display:flex;padding:12px 0 10px;align-items:flex-start;}
        .rxno{width:36px;flex-shrink:0;color:#538A22;font-weight:bold;font-size:12px;padding-top:2px;}
        .rxmed{flex:1;}
        .rxfr{width:110px;flex-shrink:0;font-size:12px;color:#333;padding-top:2px;}
        .rxdr{width:110px;flex-shrink:0;font-size:12px;color:#333;padding-top:2px;}
        .mn{font-weight:bold;font-size:13px;color:#1A3207;margin-bottom:2px;}
        .ms{font-size:11px;color:#555;margin-top:2px;}
        .mno{font-size:10px;color:#538A22;margin-top:3px;font-style:italic;}
        .mco{font-size:10px;color:#B91C1C;margin-top:3px;}
        .ss{margin-top:32px;display:flex;justify-content:flex-end;page-break-inside:avoid;break-inside:avoid;}
        .sb{text-align:right;min-width:220px;}
        .si{height:60px;margin-left:auto;display:block;margin-bottom:4px;}
        .sl{border-top:1.5px solid #1A3207;margin-bottom:6px;margin-top:8px;}
        .sle{border-top:1.5px solid #1A3207;margin-bottom:6px;margin-top:48px;}
        .sn{font-size:13px;font-weight:bold;color:#1A3207;}
        .sd{font-size:12px;font-weight:bold;color:#1A3207;}
        .sr{font-size:11px;color:#555;margin-top:2px;}
        .sta{display:inline-block;border:2px solid #538A22;border-radius:6px;padding:5px 14px;margin-bottom:10px;}
        .stt{font-size:11px;font-weight:bold;color:#538A22;letter-spacing:1px;text-transform:uppercase;}
        .std{font-size:10px;color:#538A22;margin-top:2px;}
        .sftr{border-top:1px solid #C8E9A8;padding-top:10px;margin-top:28px;}
        .edit-del{background:#fee2e2;border:none;border-radius:4px;color:#ef4444;
          font-size:10px;padding:2px 6px;cursor:pointer;margin-left:6px;flex-shrink:0;}
        .edit-hint{font-size:9px;color:#C8E9A8;font-style:italic;}
        input.ei,textarea.ei{background:transparent;border:none;border-bottom:1px dashed #C8E9A8;
          outline:none;font-family:inherit;font-size:inherit;color:inherit;
          font-weight:inherit;line-height:inherit;width:100%;resize:none;}
        @media print {
          body{background:white;}
          .ab,.edit-del,.edit-hint,.no-print,
          button[aria-label="Toggle Clinical Assistant"],
          div[style*="width:400px"],div[style*="width: 400px"]{display:none!important;}
          table.ptbl{display:table!important;width:100%;border-collapse:collapse;}
          table.ptbl tr{display:table-row!important;}
          table.ptbl thead{display:table-header-group!important;}
          table.ptbl tfoot{display:none!important;}
          table.ptbl tbody{display:table-row-group!important;}
          table.ptbl td{display:table-cell!important;}
          thead td{padding:10px 52px 8px;border-bottom:2px solid #538A22;background:white;}
          .thead-inner{display:flex;align-items:center;justify-content:space-between;}
          .thead-left{display:flex;align-items:center;gap:10px;}
          .thead-htag{font-size:10px;color:#538A22;font-style:italic;}
          .thead-right{text-align:right;font-size:9.5px;color:#888;line-height:1.7;}
          tbody td{padding:20px 52px 24px;vertical-align:top;}
          .pftr{display:flex!important;position:fixed;bottom:0;left:0;right:0;
            height:46px;background:white;border-top:1px solid #C8E9A8;
            padding:8px 52px;align-items:center;justify-content:space-between;
            font-size:9.5px;color:#555;z-index:200;}
          @page{margin:0 0 54px 0;size:A4;}
          body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}
          .page{margin:0;padding:0;box-shadow:none;background:transparent;max-width:100%;width:100%;}
          .slh,.sftr{display:none!important;}
          .fc{line-height:1.9;}
          input.ei,textarea.ei{border-bottom:none;}
        }
      `}</style>

      {/* Action bar */}
      <div className="ab">
        <p>Prescription — {patientName}</p>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {!doc.signature_data_url&&(
            <div className="wn" style={{display:'flex',alignItems:'center',gap:5}}><AlertTriangle size={12} /> No signature —
              <a href="/mrx/doctor-profile" target="_blank" style={{color:'#FCD34D',textDecoration:'underline'}}>set up profile</a>
            </div>
          )}
          <button className="eb" onClick={()=>setEditMode(e=>!e)} style={{display:'inline-flex',alignItems:'center',gap:5}}>
            {editMode ? <><CheckCircle2 size={12} /> Done Editing</> : <><Pencil size={12} /> Edit</>}
          </button>
          <button className="pb" onClick={()=>window.print()} style={{display:'inline-flex',alignItems:'center',gap:5}}>Download / Print PDF</button>
        </div>
      </div>

      <table className="ptbl">
        <thead>
          <tr><td>
            <div className="thead-inner">
              <div className="thead-left">
                <Logo h={50}/>
                <div><div className="thead-htag">…celebrating health!</div></div>
              </div>
              <div className="thead-right">
                <div>GUT MICROBIOME REPORT</div><div>Prescription Plan</div>
              </div>
            </div>
          </td></tr>
        </thead>
        <tfoot><tr><td></td></tr></tfoot>
        <tbody><tr><td>
          <div className="page">

            <div className="slh">
              <div className="slhl">
                <Logo h={44}/>
                <div><div className="ct">…celebrating health!</div></div>
              </div>
              <div className="lr"><div>GUT MICROBIOME REPORT</div><div>Prescription Plan</div></div>
            </div>

            {/* Patient name + date */}
            <div className="pn">
              {editMode ? (
                <span style={{display:'flex',justifyContent:'center',gap:8}}>
                  <input className="ei" value={patientName} onChange={e=>setPatientName(e.target.value)}
                    style={{textAlign:'center',fontSize:17,fontWeight:'bold',width:'auto'}}/>
                  {patientAgeSex && <>
                    <span>,</span>
                    <input className="ei" value={patientAgeSex} onChange={e=>setPatientAgeSex(e.target.value)}
                      style={{textAlign:'center',fontSize:17,fontWeight:'bold',width:60}}/>
                  </>}
                </span>
              ) : (
                <>{patientName}{patientAgeSex ? `, ${patientAgeSex}` : ''}</>
              )}
            </div>
            <div className="pd">Date: <strong>{today}</strong></div>

            {/* Primary reason */}
            <div className="fr">
              <div className="fl">Primary reason for visit</div>
              <div className="fc">
                {editMode ? (
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    <input className="ei ry" value={rychLabel} onChange={e=>setRychLabel(e.target.value)}
                      style={{fontWeight:'bold',color:'#538A22'}}/>
                    {conditions.map((c,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
                        <input className="ei" value={c}
                          onChange={e=>{const u=[...conditions];u[i]=e.target.value;setConditions(u)}}/>
                        <button className="edit-del" onClick={()=>setConditions(conditions.filter((_,j)=>j!==i))}><X size={11} /></button>
                      </div>
                    ))}
                    <button className="no-print" onClick={()=>setConditions([...conditions,''])}
                      style={{fontSize:10,color:'#538A22',background:'none',border:'1px dashed #C8E9A8',
                        borderRadius:4,padding:'2px 8px',cursor:'pointer',alignSelf:'flex-start',marginTop:2}}>
                      + Add condition
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="ry">{rychLabel}</div>
                    {conditions.map((c,i)=><div key={i}>{c}</div>)}
                  </>
                )}
              </div>
            </div>

            {/* Clinical notes */}
            {(clinicalNote || doctorNote || editMode) && (
              <div className="nb">
                <div className="nh">Notes</div>
                {(clinicalNote || editMode) && (
                  <div className="nr">
                    <div className="nl">Clinical impression</div>
                    <div className="nc">
                      {editMode
                        ? <textarea className="ei" value={clinicalNote} rows={3}
                            onChange={e=>setClinicalNote(e.target.value)}/>
                        : clinicalNote}
                    </div>
                  </div>
                )}
                {(doctorNote || editMode) && (
                  <div className="nr">
                    <div className="nl">Doctors Note for patient</div>
                    <div className="nc">
                      {editMode
                        ? <textarea className="ei" value={doctorNote} rows={3}
                            onChange={e=>setDoctorNote(e.target.value)}/>
                        : doctorNote}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rxh">Rx</div>
            <div className="rxch">
              <span>NO</span><span>MEDICINE</span><span>FREQUENCY</span><span>DURATION</span>
            </div>

            {/* Rx items */}
            {grouped.map(({phase,items})=>{
              const c=PHASE_STYLE[phase]??{bg:'#F2F9EC',text:'#538A22',border:'#C8E9A8'}
              return(
                <div key={phase}>
                  <div className="rxpd">
                    <div className="rxpl"/>
                    <div className="rxpb" style={{background:c.bg,color:c.text,border:`1px solid ${c.border}`}}>{phase}</div>
                    <div className="rxpl"/>
                  </div>
                  {items.map(item=>(
                    <div key={item.key} className="rxi">
                      <div className="rxir">
                        <div className="rxno">{idx[item.key]}.</div>
                        <div className="rxmed">
                          {editMode ? (
                            <>
                              <input className="ei mn" value={item.displayName}
                                onChange={e=>updateRxItem(item.key,'displayName',e.target.value)}
                                style={{fontWeight:'bold',fontSize:13,color:'#1A3207'}}/>
                              <input className="ei ms" value={item.displaySub}
                                onChange={e=>updateRxItem(item.key,'displaySub',e.target.value)}
                                style={{fontSize:11,color:'#555',marginTop:2}}/>
                            </>
                          ) : (
                            <>
                              <div className="mn">{item.displayName}</div>
                              {item.displaySub&&<div className="ms">{item.displaySub}</div>}
                            </>
                          )}
                          {item.doctorNote&&<div className="mno" style={{display:'flex',alignItems:'center',gap:4}}><NotebookPen size={11} /> {item.doctorNote}</div>}
                          {item.contraindications&&<div className="mco" style={{display:'flex',alignItems:'center',gap:4}}><AlertTriangle size={11} /> {item.contraindications}</div>}
                        </div>
                        <div className="rxfr">
                          {editMode
                            ? <input className="ei" value={item.frequency}
                                onChange={e=>updateRxItem(item.key,'frequency',e.target.value)}
                                style={{fontSize:12,color:'#333',width:80}}/>
                            : item.frequency}
                        </div>
                        <div className="rxdr" style={{display:'flex',alignItems:'flex-start',gap:4}}>
                          {editMode ? (
                            <>
                              <input className="ei" value={item.duration}
                                onChange={e=>updateRxItem(item.key,'duration',e.target.value)}
                                style={{fontSize:12,color:'#333',width:80}}/>
                              <button className="edit-del no-print" onClick={()=>removeRxItem(item.key)}><X size={11} /></button>
                            </>
                          ) : item.duration}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}

            {/* Add item button */}
            {editMode && (
              <button className="no-print" onClick={addRxItem}
                style={{marginTop:10,fontSize:11,color:'#538A22',background:'none',
                  border:'1px dashed #C8E9A8',borderRadius:6,padding:'4px 14px',cursor:'pointer'}}>
                + Add medicine
              </button>
            )}

            {/* Dietary Protocol — was previously computed into dietaryItems
                but never rendered anywhere in this page. Uses the exact same
                row structure as the medicine rows above (rxi/rxir/rxno/rxmed)
                and continues the same running number sequence. */}
            {dietaryItems.length > 0 && (
              <>
                <div className="rxh" style={{fontSize:24, marginTop:32, marginBottom:6}}></div>
                {groupedDietary.map(({phase, items}) => {
                  const c = PHASE_STYLE[phase] ?? {bg:'#F2F9EC',text:'#538A22',border:'#C8E9A8'}
                  return (
                    <div key={phase}>
                      <div className="rxpd">
                        <div className="rxpl"/>
                        <div className="rxpb" style={{background:c.bg,color:c.text,border:`1px solid ${c.border}`}}>{phase}</div>
                        <div className="rxpl"/>
                      </div>
                      {items.map(item => (
                        <div key={item.key} className="rxi">
                          <div className="rxir">
                            <div className="rxno">{idx[item.key]}.</div>
                            <div className="rxmed">
                              <div className="mn">{item.label}</div>
                              {item.detail && <div className="ms">{item.detail}</div>}
                              {item.rationale && <div className="ms" style={{marginTop:4,color:'#555'}}>{item.rationale}</div>}
                              {item.doctorNote && <div className="mno" style={{display:'flex',alignItems:'center',gap:4}}><NotebookPen size={11} /> {item.doctorNote}</div>}
                              {item.contraindications && <div className="mco" style={{display:'flex',alignItems:'center',gap:4}}><AlertTriangle size={11} /> {item.contraindications}</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </>
            )}

            {/* Doctor signature */}
            <div className="ss">
              <div className="sb">
                {data.approved_at&&(
                  <div className="sta" style={{marginBottom:10}}>
                    <div className="stt" style={{display:'flex',alignItems:'center',gap:4}}><CheckCircle2 size={12} /> Approved</div>
                    <div className="std">{fmtDate(data.approved_at)}</div>
                  </div>
                )}
                {doc.signature_data_url&&<img src={doc.signature_data_url} className="si" alt="Signature"/>}
                <div className={doc.signature_data_url?'sl':'sle'}/>
                <div className="sn">{doc.name}</div>
                <div className="sd">{doc.degree}</div>
                {doc.reg_no&&<div className="sr">Reg. No.: {doc.reg_no}</div>}
              </div>
            </div>

            <div className="sftr"><FtrRow/></div>
          </div>
        </td></tr></tbody>
      </table>

      <div className="pftr"><FtrRow/></div>
    </>
  )
}