'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { extractFromPDF } from '@/lib/mrx/extractSpecies'
import { uploadReportPdf } from '@/lib/mrx/reportPdf'
import { supabase } from '@/lib/mrx/supabase'

type PatientForm = {
  name: string; clinic_id: string; age_sex: string; patient_id: string; sample_type: string
  sample_collection_date: string; sample_received_date: string; report_generated_date: string
}

type StepStatus = 'pending' | 'active' | 'done' | 'error'

const STEPS = [
  'Reading patient details',
  'Reading PDF pages',
  'Parsing report sections',
  'Filling patient form',
]

export default function UploadPage() {
  const router       = useRouter()
  // Set when the upload was started from a patient's workspace
  // (/patients/<id> -> MicrobiomeRx -> Upload). Carries the hub record's
  // real id so the report links by foreign key instead of by name.
  const hubPatientId = useSearchParams().get('patient')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragOver,     setDragOver]     = useState(false)
  const [file,         setFile]         = useState<File | null>(null)
  const [processing,   setProcessing]   = useState(false)
  const [done,         setDone]         = useState(false)
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(Array(4).fill('pending'))
  const [species,      setSpecies]      = useState<string[]>([])
  const [reportData,   setReportData]   = useState<any>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [form, setForm] = useState<PatientForm>({
    name:'', clinic_id:'', age_sex:'', patient_id:'', sample_type:'',
    sample_collection_date:'', sample_received_date:'', report_generated_date:'',
  })

  const setStep = (i: number, s: StepStatus) =>
    setStepStatuses(prev => prev.map((v, idx) => idx === i ? s : v))

  const reset = () => {
    setFile(null); setDone(false); setSpecies([]); setReportData(null)
    setError(null); setProcessing(false)
    setStepStatuses(Array(4).fill('pending'))
    setForm({ name:'', clinic_id:'', age_sex:'', patient_id:'', sample_type:'',
      sample_collection_date:'', sample_received_date:'', report_generated_date:'' })
  }

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith('.pdf')) { setError('Please upload a PDF file.'); return }
    setFile(f); setError(null); setProcessing(true); setDone(false)
    setSpecies([]); setReportData(null)
    setStepStatuses(Array(4).fill('pending'))

    try {
      setStep(0, 'active')
      const result = await extractFromPDF(f)
      setStep(0, 'done')

      setStep(1, 'active')
      if (result.species.length === 0) {
        setStep(1, 'error')
        setError('No species found. Make sure this is a microbiome report with selectable text.')
        setProcessing(false); return
      }
      setSpecies(result.species)
      setStep(1, 'done')

      setStep(2, 'active')
      if (result.reportData) {
        setReportData(result.reportData)
        setStep(2, 'done')
      } else {
        setStep(2, 'error')
      }

      setStep(3, 'active')
      const p = result.patient
      if (p?.name) {
        setForm(prev => ({
          ...prev,
          name:                   p.name || '',
          age_sex:                p.age_sex || '',
          patient_id:             result.reportData?.patient?.sample_id || '',
          sample_type:            result.reportData?.patient?.sample_type || 'Stool',
          sample_collection_date: result.reportData?.patient?.collection_date || '',
          sample_received_date:   result.reportData?.patient?.collection_date || '',
          report_generated_date:  result.reportData?.patient?.report_date || '',
        }))
        setStep(3, 'done')
      } else {
        setStep(3, 'error')
      }

      setDone(true)

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setProcessing(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Patient name is required.'); return }
    if (!form.clinic_id.trim()) { setError('Clinicea ID is required — it\'s what lets this report be found and linked from the clinic\'s other systems.'); return }
    if (species.length < 3) { setError('Not enough species detected.'); return }
    setSaving(true); setError(null)

    try {
      // ── 0-1. Create the report through the server route ──────────────────
      // Linking lives in /api/mrx/reports so both upload paths do it the same
      // way: hub FK (clp_patient_id) when the upload was started from a
      // patient's workspace, the tool's own mrx.patients id, and the
      // mrx_patient_links row. Clinicea ID remains the tool-side identity key —
      // two patients can share a name, never a Clinicea ID.
      const clinicId = form.clinic_id.trim()
      const res = await fetch('/api/mrx/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hubPatientId:  hubPatientId ?? null,
          clinicId,
          patientName:   form.name,
          patientAgeSex: form.age_sex || null,
          pdfFilename:   file?.name || null,
          speciesList:   species,
          speciesCount:  species.length,
          reportData:    reportData || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save report')

      // ── 2. Navigate immediately - don't block on PDF upload ──────────────
      // PDF is only needed when the doctor clicks "View PDF", not at page load.
      router.push(`/mrx/report/${data.id}`)

      // ── 3. Upload PDF in the background after navigation ─────────────────
      if (file) {
        uploadReportPdf(data.id, file).catch(err =>
          console.warn('[upload] background PDF upload failed:', err)
        )
      }

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
    // Note: setSaving(false) intentionally omitted on success -
    // the component unmounts on navigation so it doesn't matter.
  }

  const StepIcon = ({ status }: { status: StepStatus }) => {
    if (status === 'done')   return <div className="w-5 h-5 rounded-full bg-[#E2F3D0] flex items-center justify-center flex-shrink-0"><svg className="w-3 h-3 text-[#538A22]" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
    if (status === 'active') return <div className="w-5 h-5 rounded-full border-2 border-[#538A22] border-t-transparent animate-spin flex-shrink-0" />
    if (status === 'error')  return <div className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0 text-amber-600 text-xs font-bold">!</div>
    return <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
  }

  const nutritionObj = reportData?.nutrition ?? reportData?.nutrition_data
  const foodCount = nutritionObj
    ? Object.values(nutritionObj as Record<string, Record<string, unknown>>)
        .reduce((s: number, c) => s + Object.keys(c).length, 0)
    : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto py-10 px-6">

        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/mrx/dashboard" className="text-xs font-mono text-gray-400 hover:text-[#538A22] transition mb-2 block">← Dashboard</Link>
            <h1 className="text-2xl font-light text-gray-900">Upload report</h1>
            <p className="text-xs text-gray-400 font-mono mt-1">BugSpeaks PDF - all data extracted automatically</p>
          </div>
        </div>

        {/* Drop zone */}
        {!processing && !done && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all mb-6
              ${dragOver ? 'border-green-400 bg-[#F2F9EC]' : 'border-gray-200 bg-white hover:border-green-300 hover:bg-[#F2F9EC]'}`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm font-medium text-gray-700 mb-1">Drop your PDF here or click to browse</p>
            <p className="text-xs text-gray-400 font-mono">BugSpeaks gut microbiome reports</p>
          </div>
        )}

        {/* Steps */}
        {(processing || done) && (
          <div className="bg-white border border-[#E2F3D0] rounded-2xl overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-[#E2F3D0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-lg">📄</div>
                <div>
                  <div className="text-xs font-medium text-gray-900">{file?.name}</div>
                  <div className="text-xs font-mono text-gray-400 mt-0.5">
                    {processing
                      ? 'Processing…'
                      : `✓ ${species.length} species · ${foodCount > 0 ? `${foodCount} foods extracted` : 'dietary data unavailable'}`}
                  </div>
                </div>
              </div>
              {done && <button onClick={reset} className="text-xs font-mono text-gray-400 hover:text-[#538A22] transition">Change file</button>}
            </div>
            <div className="px-5 py-4 space-y-3">
              {STEPS.map((label, i) => (
                <div key={i} className="flex items-center gap-3">
                  <StepIcon status={stepStatuses[i]} />
                  <span className={`text-xs transition-colors
                    ${stepStatuses[i]==='done'   ? 'text-gray-700'
                    : stepStatuses[i]==='active'  ? 'text-gray-900 font-medium'
                    : stepStatuses[i]==='error'   ? 'text-amber-600'
                    : 'text-gray-300'}`}>
                    {label}
                    {stepStatuses[i] === 'error' && (
                      <span className="text-xs ml-2 font-mono text-amber-500">(fill manually)</span>
                    )}
                  </span>
                </div>
              ))}
              {done && (
                <div className="flex items-center gap-3 pt-1 border-t border-[#E2F3D0] mt-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${foodCount > 0 ? 'bg-[#E2F3D0]' : 'bg-amber-100 border border-amber-300'}`}>
                    {foodCount > 0
                      ? <svg className="w-3 h-3 text-[#538A22]" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <span className="text-amber-600 text-xs font-bold">!</span>}
                  </div>
                  <span className={`text-xs ${foodCount > 0 ? 'text-gray-700' : 'text-amber-600'}`}>
                    {foodCount > 0
                      ? `Nutrition data - ${foodCount} foods across ${Object.keys(nutritionObj).length} categories`
                      : 'Nutrition data unavailable - re-upload or check PDF'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Species */}
        {species.length > 0 && (
          <div className="bg-white border border-[#E2F3D0] rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Species detected</p>
              <span className="text-xs font-mono text-[#538A22] bg-[#F2F9EC] border border-[#E2F3D0] px-2 py-0.5 rounded">{species.length} found</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {species.map(s => <span key={s} className="text-xs font-mono italic px-2 py-0.5 bg-[#F2F9EC] text-[#1A3207] border border-[#E2F3D0] rounded">{s}</span>)}
            </div>
          </div>
        )}

        {/* Patient form */}
        {done && (
          <div className="bg-white border border-[#E2F3D0] rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-[#E2F3D0] flex items-center justify-between">
              <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Patient details</p>
              {form.name && <span className="text-xs font-mono text-[#538A22] bg-[#F2F9EC] border border-[#E2F3D0] px-2 py-0.5 rounded">auto-filled from report</span>}
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              {[
                { name:'name',                   label:'Patient name *',  placeholder:'Full name'  },
                { name:'clinic_id',              label:'Clinicea ID *',     placeholder:'CLP1212'    },
                { name:'age_sex',                label:'Age / Sex',       placeholder:'63M'        },
                { name:'patient_id',             label:'Patient ID',      placeholder:'BS041850'   },
                { name:'sample_type',            label:'Sample type',     placeholder:'Stool'      },
                { name:'sample_collection_date', label:'Collection date', placeholder:'2026-05-05' },
                { name:'sample_received_date',   label:'Received date',   placeholder:'2026-05-06' },
                { name:'report_generated_date',  label:'Report date',     placeholder:'2026-05-19' },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-1.5">{field.label}</label>
                  <input
                    name={field.name}
                    value={form[field.name as keyof PatientForm]}
                    onChange={e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                    placeholder={field.placeholder}
                    className={`w-full border rounded-lg px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#538A22] focus:ring-1 focus:ring-[#E2F3D0] transition font-mono
                      ${form[field.name as keyof PatientForm] ? 'bg-[#F2F9EC] border-green-200' : 'bg-background border-gray-200'}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 mb-4 font-mono">{error}</div>}

        {done && (
          <button
            onClick={handleSave} disabled={saving}
            className="btn-primary-mrx w-full py-3 text-white font-medium rounded-xl text-sm transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#538A22' }}
            onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3D6B16' }}
            onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#538A22' }}
          >
            {saving ? 'Saving report…' : `Save and open report for ${form.name || 'patient'} →`}
          </button>
        )}

      </div>
    </div>
  )
}
