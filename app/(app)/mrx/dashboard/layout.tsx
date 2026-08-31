'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/mrx/supabase'
import ClinicalAssistant from '@/components/mrx/ClinicalAssistant'
import UploadModal from '@/components/mrx/UploadModal'
import Link from 'next/link'


// ─── Types ────────────────────────────────────────────────────────────────────

interface Report {
  id: string
  patient_name: string
  patient_age_sex: string | null
  pdf_filename: string | null
  created_at: string
  report_data: {
    rych_index?: number | null
    diversity?: { shannon?: number | null }
    probiotics?: { absent?: string[] }
    patient?: {
      sample_id?: string | null
      sample_type?: string | null
      collection_date?: string | null
      report_date?: string | null
    }
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRychColor(score: number | null | undefined) {
  if (score == null) return '#9CA3AF'
  if (score >= 70)   return '#538A22'
  if (score >= 45)   return '#D97706'
  return '#DC2626'
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [reports,   setReports]   = useState<Report[]>([])
  const [loading,   setLoading]   = useState(true)
  const [isDash,    setIsDash]    = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    setIsDash(window.location.pathname === '/mrx/dashboard')
  })

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUserEmail(session.user.email ?? '')

      const { data } = await supabase
        .from('reports')
        .select('id, patient_name, patient_age_sex, pdf_filename, created_at, report_data')
        .eq('doctor_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setReports(data ?? [])
      setLoading(false)
    }
    init()
  }, [router])

  const refreshReports = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('reports')
      .select('id, patient_name, patient_age_sex, pdf_filename, created_at, report_data')
      .eq('doctor_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setReports(data ?? [])
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8FAF6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {isDash
        ? <DashboardContent
            reports={reports}
            loading={loading}
            userEmail={userEmail}
            onSignOut={handleSignOut}
            onReportSaved={refreshReports}
          />
        : children
      }
      <ClinicalAssistant />
    </div>
  )
}

// ─── Dashboard page content ───────────────────────────────────────────────────

function DashboardContent({
  reports,
  loading,
  userEmail,
  onSignOut,
  onReportSaved,
}: {
  reports: Report[]
  loading: boolean
  userEmail: string
  onSignOut: () => void
  onReportSaved: () => void
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'good' | 'moderate' | 'poor'>('all')

  const filtered = reports.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      r.patient_name.toLowerCase().includes(q) ||
      (r.patient_age_sex ?? '').toLowerCase().includes(q) ||
      (r.report_data?.patient?.sample_id ?? '').toLowerCase().includes(q)

    const s = r.report_data?.rych_index
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'good'     ? (s != null && s >= 70) :
      filter === 'moderate' ? (s != null && s >= 45 && s < 70) :
                              (s == null || s < 45)

    return matchSearch && matchFilter
  })

  const TABLE_HEADERS = [
    'Patient ID',
    'Patient Name',
    'Age / Sex',
    'Sample Collection Date',
    'Sample Received Date',
    'Report Generated Date',
  ]

  return (
    <div className="flex flex-col min-h-screen">

      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-40 bg-[#F8FAF6]/90 backdrop-blur-sm
        border-b border-[#E2F3D0] px-8 py-3 flex items-center justify-between">

        {/* Left - brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#538A22] flex items-center
            justify-center text-base leading-none">🦠</div>
          <span className="text-[20px] font-semibold text-[#538A22] tracking-wide uppercase">
            MicrobiomeRx
          </span>
          <span className="text-gray-300 mx-1 select-none">·</span>
        </div>

        {/* Right - email + sign out + feedback */}
<div className="flex flex-col items-end gap-2">
  <div className="flex items-center gap-3">
    {userEmail && (
      <span className="text-[11px] text-gray-400 font-mono hidden sm:block">
        {userEmail}
      </span>
    )}
    <button
      onClick={onSignOut}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium
        text-gray-500 bg-white border border-gray-200 rounded-lg
        hover:border-red-200 hover:text-red-600 hover:bg-red-50
        transition-all shadow-sm"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
        <path d="M10 2h3a1 1 0 011 1v10a1 1 0 01-1 1h-3M6.5 11L10 8l-3.5-3M10 8H2"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          strokeLinejoin="round"/>
      </svg>
      Sign out
    </button>
  </div>

  <Link
    href="/mrx/feedback"
    className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400
      hover:text-[#538A22] transition-colors"
  >
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M7 8h10M7 12h6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
    Suggest an improvement
  </Link>
</div>
      </header>

      {/* ── Scrollable body ── */}
      <div className="flex-1 max-w-[1200px] w-full mx-auto py-8 px-8">

        {/* Page title + upload */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-light text-[#1A3207] tracking-tight">
              Patient Reports
            </h1>
            <p className="text-[13px] text-gray-400 mt-1">
              {reports.length} report{reports.length !== 1 ? 's' : ''} · gut microbiome analysis
            </p>
          </div>

          

          {/* Upload button */}
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) setUploadFile(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary-mrx flex items-center gap-2 px-5 py-2.5 bg-[#538A22] text-white
                text-[13px] font-medium rounded-xl hover:bg-[#3D6B16] transition-colors
                shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
                <path d="M8 2v8M5 5l3-3 3 3M3 11v2a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-2"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  strokeLinejoin="round"/>
              </svg>
              Upload new report
            </button>
          </>
        </div>

       
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          {[
            { label: 'Total reports',
              value: reports.length,
              sub: 'all patients', color: '#538A22' },
            { label: 'Good gut health',
              value: reports.filter(r => (r.report_data?.rych_index ?? 0) >= 70).length,
              sub: 'Rych ≥ 70', color: '#538A22' },
            { label: 'Needs attention',
              value: reports.filter(r => { const s = r.report_data?.rych_index; return s != null && s >= 45 && s < 70 }).length,
              sub: 'Rych 45–69', color: '#D97706' },
            { label: 'Critical',
              value: reports.filter(r => { const s = r.report_data?.rych_index; return s != null && s < 45 }).length,
              sub: 'Rych < 45', color: '#DC2626' },
          ].map(card => (
            <div key={card.label}
              className="bg-white border border-[#E2F3D0] rounded-xl px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest
                text-gray-400 mb-2">
                {card.label}
              </div>
              <div className="text-[28px] font-light leading-none mb-1"
                style={{ color: card.color }}>
                {card.value}
              </div>
              <div className="text-[11px] text-gray-400">{card.sub}</div>
            </div>
          ))}
        </div>
        
        

        {/* Table card */}
        <div className="bg-white border border-[#E2F3D0] rounded-2xl overflow-hidden">

          {/* Toolbar */}
          <div className="px-5 py-4 border-b border-[#E2F3D0] flex items-center gap-3">
            <div className="relative flex-1 max-w-[260px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                text-gray-400" fill="none" viewBox="0 0 16 16">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patient…"
                className="w-full pl-8 pr-3 py-2 text-[12px] bg-[#F8FAF6] border
                  border-[#E2F3D0] rounded-lg outline-none focus:border-[#538A22]
                  text-gray-700 placeholder-gray-400 transition"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {(['all', 'good', 'moderate', 'poor'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium
                    uppercase tracking-wider border transition-all ${
                    filter === f
                      ? f === 'all'      ? 'bg-[#538A22] text-white border-[#538A22]'
                      : f === 'good'     ? 'bg-[#E2F3D0] text-[#3D6B16] border-[#A8D878]'
                      : f === 'moderate' ? 'bg-amber-50 text-amber-700 border-amber-300'
                      :                   'bg-red-50 text-red-700 border-red-300'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}>
                  {f}
                </button>
              ))}
            </div>

            <div className="ml-auto text-[11px] text-gray-400 font-mono">
              {filtered.length} of {reports.length}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#F2F9EC]">
                  {TABLE_HEADERS.map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold
                      uppercase tracking-widest text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {loading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="w-5 h-5 border-2 border-[#538A22]
                        border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-[12px] text-gray-400">Loading reports…</p>
                    </td>
                  </tr>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <p className="text-[13px] text-gray-400 mb-4">
                        {search || filter !== 'all'
                          ? 'No reports match your filter.'
                          : 'No reports yet. Upload your first BugSpeaks PDF.'}
                      </p>
                      {!search && filter === 'all' && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-primary-mrx inline-flex items-center gap-2 px-4 py-2 bg-[#538A22]
                            text-white text-[12px] font-medium rounded-lg
                            hover:bg-[#3D6B16] transition-colors"
                        >
                          Upload first report →
                        </button>
                      )}
                    </td>
                  </tr>
                )}

                {!loading && filtered.map(report => {
                  const patient = report.report_data?.patient
                  const score   = report.report_data?.rych_index

                  return (
                    <tr
                      key={report.id}
                      className="roster-row border-b border-[#F2F9EC] last:border-0
                        hover:bg-[#F8FAF6] transition-colors cursor-pointer"
                      onClick={() => router.push(`/mrx/report/${report.id}`)}
                    >
                      {/* Patient ID */}
                      <td className="px-5 py-4">
                        <span className="text-[11px] font-mono text-gray-500">
                          {patient?.sample_id ?? '-'}
                        </span>
                      </td>

                      {/* Patient Name */}
                      <td className="px-5 py-4">
                        <span className="text-[13px] font-medium text-[#1A3207] whitespace-nowrap">
                          {report.patient_name}
                        </span>
                      </td>

                      {/* Age / Sex */}
                      <td className="px-5 py-4">
                        <span className="text-[12px] text-gray-500 font-mono">
                          {report.patient_age_sex ?? '-'}
                        </span>
                      </td>

                      {/* Sample Collection Date */}
                      <td className="px-5 py-4">
                        <span className="text-[12px] text-gray-400 font-mono whitespace-nowrap">
                          {formatDate(patient?.collection_date)}
                        </span>
                      </td>

                      {/* Sample Received Date */}
                      <td className="px-5 py-4">
                        <span className="text-[12px] text-gray-400 font-mono whitespace-nowrap">
                          {formatDate(patient?.collection_date)}
                        </span>
                      </td>

                      {/* Report Generated Date */}
                      <td className="px-5 py-4">
                        <span className="text-[12px] text-gray-400 font-mono whitespace-nowrap">
                          {formatDate(patient?.report_date)}
                        </span>
                      </td>
                    </tr>
                  )
                })}

              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {uploadFile && (
        <UploadModal
          initialFile={uploadFile}
          onClose={() => setUploadFile(null)}
        />
      )}

    </div>
  )
}
