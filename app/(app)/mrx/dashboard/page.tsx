'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/mrx/supabase'
import ClinicalAssistant from '@/components/mrx/ClinicalAssistant'
import UploadModal from '@/components/mrx/UploadModal'
import { Microscope } from 'lucide-react'

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
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRychColor(score: number | null | undefined) {
  if (score == null) return '#9CA3AF'
  if (score >= 70)   return '#538A22'
  if (score >= 45)   return '#D97706'
  return '#DC2626'
}

function getRychLabel(score: number | null | undefined) {
  if (score == null) return '-'
  if (score >= 70)   return 'Good'
  if (score >= 45)   return 'Moderate'
  return 'Poor'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RychBar({ score }: { score: number | null | undefined }) {
  const color = getRychColor(score)
  const pct   = score != null ? Math.min(100, Math.max(0, score)) : 0
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-7 text-right"
        style={{ color }}>
        {score != null ? score : '-'}
      </span>
    </div>
  )
}

function StatusPill({ score }: { score: number | null | undefined }) {
  const label = getRychLabel(score)
  const styles = {
    'Good':     'bg-[#E2F3D0] text-[#3D6B16] border-[#C8E9A8]',
    'Moderate': 'bg-amber-50   text-amber-700  border-amber-200',
    'Poor':     'bg-red-50     text-red-700    border-red-200',
    '-':        'bg-gray-50    text-gray-400   border-gray-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold
      uppercase tracking-wider px-2.5 py-1 rounded-full border
      ${styles[label as keyof typeof styles]}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: getRychColor(score) }} />
      {label}
    </span>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [reports,  setReports]  = useState<Report[]>([])
  const [loading,  setLoading]  = useState(true)
  const [isDash,   setIsDash]   = useState(false)
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8FAF6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Sign out button - fixed top-right corner ── */}
      <div className="fixed top-4 right-5 z-50 flex items-center gap-2">
        {userEmail && (
          <span className="text-[11px] text-gray-400 font-mono hidden sm:block">
            {userEmail}
          </span>
        )}
        <button
          onClick={handleSignOut}
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

      {/* ── Page content ── */}
      {isDash
        ? <DashboardContent reports={reports} loading={loading} />
        : children
      }

      <ClinicalAssistant />
    </div>
  )
}

// ─── Dashboard page content ───────────────────────────────────────────────────

function DashboardContent({ reports, loading }: { reports: Report[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'good' | 'moderate' | 'poor'>('all')

  const filtered = reports.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      r.patient_name.toLowerCase().includes(q) ||
      (r.patient_age_sex ?? '').toLowerCase().includes(q)

    const s = r.report_data?.rych_index
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'good'     ? (s != null && s >= 70) :
      filter === 'moderate' ? (s != null && s >= 45 && s < 70) :
                              (s == null || s < 45)

    return matchSearch && matchFilter
  })

  return (
    <div className="max-w-[1100px] mx-auto py-10 px-8">

      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#538A22] flex items-center
              justify-center text-lg"><Microscope size={18} color="#fff" /></div>
            <span className="text-[13px] font-semibold text-[#538A22] tracking-wide
              uppercase">
              MicrobiomeRx
            </span>
          </div>
          <h1 className="text-[28px] font-light text-[#1A3207] tracking-tight">
            Patient Reports
          </h1>
          <p className="text-[13px] text-gray-400 mt-1">
            {reports.length} report{reports.length !== 1 ? 's' : ''} · gut microbiome analysis
          </p>
        </div>
        <Link
          href="/mrx/upload"
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
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        {[
          { label: 'Total reports',    value: reports.length,
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
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#F2F9EC]">
              {['Patient', 'Age / Sex', 'Rych Index', 'Status', 'Diversity', 'Uploaded', 'File', ''].map(h => (
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
                <td colSpan={8} className="px-5 py-16 text-center">
                  <div className="w-5 h-5 border-2 border-[#538A22]
                    border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-[12px] text-gray-400">Loading reports…</p>
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center">
                  <p className="text-[13px] text-gray-400 mb-4">
                    {search || filter !== 'all'
                      ? 'No reports match your filter.'
                      : 'No reports yet. Upload your first BugSpeaks PDF.'}
                  </p>
                  {!search && filter === 'all' && (
                    <Link href="/mrx/upload"
                      className="btn-primary-mrx inline-flex items-center gap-2 px-4 py-2 bg-[#538A22]
                        text-white text-[12px] font-medium rounded-lg
                        hover:bg-[#3D6B16] transition-colors">
                      Upload first report →
                    </Link>
                  )}
                </td>
              </tr>
            )}

            {!loading && filtered.map(report => {
              const score   = report.report_data?.rych_index
              const shannon = report.report_data?.diversity?.shannon
              const absent  = report.report_data?.probiotics?.absent?.length ?? 0

              return (
                <tr key={report.id}
                  className="roster-row border-b border-[#F2F9EC] last:border-0
                    hover:bg-[#F8FAF6] transition-colors group cursor-pointer"
                  onClick={() => window.location.href = `/mrx/report/${report.id}`}
                >
                  {/* Patient */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center
                        text-white text-[11px] font-semibold flex-shrink-0"
                        style={{ background: getRychColor(score) }}>
                        {initials(report.patient_name)}
                      </div>
                      <span className="text-[13px] font-medium text-[#1A3207] whitespace-nowrap">
                        {report.patient_name}
                      </span>
                    </div>
                  </td>

                  {/* Age/sex */}
                  <td className="px-5 py-3.5">
                    <span className="text-[12px] text-gray-500 font-mono">
                      {report.patient_age_sex ?? '-'}
                    </span>
                  </td>

                  {/* Rych bar */}
                  <td className="px-5 py-3.5"><RychBar score={score} /></td>

                  {/* Status */}
                  <td className="px-5 py-3.5"><StatusPill score={score} /></td>

                  {/* Diversity */}
                  <td className="px-5 py-3.5">
                    <div className="text-[12px] text-gray-500">
                      {shannon != null
                        ? <span>Shannon <span className="font-mono text-[#538A22]">{shannon.toFixed(2)}</span></span>
                        : <span className="text-gray-300">-</span>}
                    </div>
                    {absent > 0 && (
                      <div className="text-[10px] text-red-400 mt-0.5">
                        {absent} probiotics absent
                      </div>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-5 py-3.5">
                    <span className="text-[12px] text-gray-400 font-mono whitespace-nowrap">
                      {formatDate(report.created_at)}
                    </span>
                  </td>

                  {/* Filename */}
                  <td className="px-5 py-3.5 max-w-[140px]">
                    <span className="text-[11px] text-gray-400 truncate block font-mono"
                      title={report.pdf_filename ?? ''}>
                      {report.pdf_filename ?? '-'}
                    </span>
                  </td>

                  {/* Open */}
                  <td className="px-5 py-3.5">
                    <Link href={`/mrx/report/${report.id}`}
                      onClick={e => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 transition-opacity
                        text-[11px] font-semibold text-[#538A22] border border-[#C8E9A8]
                        px-3 py-1.5 rounded-lg hover:bg-[#F2F9EC] whitespace-nowrap">
                      Open →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

