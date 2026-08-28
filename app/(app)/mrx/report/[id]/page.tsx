'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/mrx/supabase'
import RecommendationsPanel from '@/components/mrx/RecommendationsPanel'
import ReportPdfActions from '@/components/mrx/ReportPdfActions'
import { getUser } from '@/lib/mrx/auth'

type Report = {
  id: string
  doctor_id: string
  patient_name: string
  patient_age_sex: string
  patient_diet: string
  patient_history: string
  patient_allergies: string
  pdf_filename: string
  created_at: string
  report_data: any
  recommendations: any
}

const NAV_GROUPS = [
  { label: 'Clinical overview', items: [
    { section: 'rych-index',        label: 'Rych Index' },
    { section: 'health-indicators', label: 'Health indicators' },
    { section: 'disease-risk',      label: 'Disease risk' },
  ]},
  { label: 'Microbiome profile', items: [
    { section: 'diversity',         label: 'Diversity' },
    { section: 'foundation',        label: 'Foundation' },
    { section: 'probiotics',        label: 'Probiotics' },
    { section: 'pathogens',         label: 'Pathogens' },
  ]},
  { label: 'Production potential', items: [
    { section: 'scfa',              label: 'SCFA' },
    { section: 'vitamins',          label: 'Vitamins' },
    { section: 'neurotransmitters', label: 'Neurotransmitters' },
  ]},
  { label: 'Metabolism & function', items: [
    { section: 'macronutrients', label: 'Macronutrients' },
    { section: 'gut-function',   label: 'Gut function' },
    { section: 'intolerance',    label: 'Intolerance' },
    { section: 'endurance',      label: 'Endurance' },
  ]},
  { label: 'Resistance', items: [
    { section: 'antibiotic', label: 'Antibiotic' },
    { section: 'abundant-species',  label: 'Abundant Species' },
  ]}, 
  { label: 'Clinical tools', items: [
  { section: 'aic-supplements',  label: 'AIC Supplement Plan' },
]},
]



export default function ReportPage() {
  const params   = useParams()
  const router   = useRouter()
  const pathname = usePathname()

  const id             = typeof params?.id === 'string' ? params.id : undefined
  const currentSection = pathname?.split('/').pop() || ''

  const [report,  setReport]  = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [prescription, setPrescription] = useState<{ id: string; approved_at: string | null } | null>(null)
  // This sidebar was a fixed 256px column with no mobile handling at all —
  // same problem as the two shared hub sidebars, same fix: off-canvas
  // drawer below md, static above it.
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        if (!id) return
        const currentUser = await getUser()
        if (!currentUser) { router.push('/login'); return }

        const { data, error } = await supabase
          .from('reports').select('*').eq('id', id).single()

        if (error || !data) { router.push('/mrx/dashboard'); return }
        setReport(data)

        // Separate, non-blocking: lets the header link straight to the
        // review/approve screen without a doctor having to click
        // "Generate recommendations" again just to reach an existing one.
        const { data: rx } = await supabase
          .from('prescriptions').select('id, approved_at').eq('report_id', id).maybeSingle()
        if (rx) setPrescription(rx)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: '#F8FAF6' }}>
      <div className="w-8 h-8 rounded-full animate-spin"
        style={{ border: '3px solid #E2F3D0', borderTopColor: '#538A22' }} />
    </div>
  )

  if (!report) return null

  const rd       = report.report_data
  const isActive = (s: string) => currentSection === s
  const score    = rd?.rych_index ?? null

  return (
    <div className="flex h-screen flex-col overflow-hidden md:flex-row" style={{ background: '#F8FAF6' }}>

      {/* Mobile top bar — only way to reach the sidebar below md, since the
          sidebar itself is off-screen until toggled there. */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 md:hidden"
        style={{ background: '#F2F9EC', borderBottom: '1px solid #C8E9A8' }}>
        <button onClick={() => setNavOpen(true)} aria-label="Open menu" style={{ color: '#1A3207' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold truncate" style={{ color: '#1A3207' }}>{report.patient_name}</span>
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />
      )}

      {/* ── Sidebar ── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 flex flex-col overflow-hidden transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#F2F9EC', borderRight: '1px solid #C8E9A8' }}>

        {/* Patient card */}
        <div className="p-4" style={{ borderBottom: '1px solid #C8E9A8' }}>
          <div className="rounded-2xl p-4 space-y-2"
            style={{ background: '#FFFFFF', border: '1px solid #C8E9A8' }}>

            <div className="rounded-xl px-3 py-2"
              style={{ background: '#F8FAF6', border: '1px solid #E2F3D0' }}>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5"
                style={{ color: '#538A22' }}>Patient</p>
              <p className="text-sm font-semibold" style={{ color: '#1A3207' }}>
                {report.patient_name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl px-3 py-2"
                style={{ background: '#F8FAF6', border: '1px solid #E2F3D0' }}>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5"
                  style={{ color: '#538A22' }}>Age / Sex</p>
                <p className="text-sm font-mono font-medium" style={{ color: '#1A3207' }}>
                  {report.patient_age_sex || '-'}
                </p>
              </div>
              <div className="rounded-xl px-3 py-2"
                style={{ background: '#F8FAF6', border: '1px solid #E2F3D0' }}>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5"
                  style={{ color: '#538A22' }}>Patient ID</p>
                <p className="text-[11px] font-mono font-medium" style={{ color: '#1A3207' }}>
                  {rd?.patient?.sample_id || '-'}
                </p>
              </div>
            </div>

            {score != null && (
              <div className="rounded-xl px-3 py-2 flex items-center justify-between"
                style={{ background: '#F8FAF6', border: '1px solid #E2F3D0' }}>
                <p className="text-[9px] font-mono uppercase tracking-widest"
                  style={{ color: '#538A22' }}>Rych Index</p>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: score >= 70 ? '#E2F3D0' : score >= 45 ? '#FEF3C7' : '#FEE2E2',
                    color:      score >= 70 ? '#1A3207' : score >= 45 ? '#92400E' : '#991B1B',
                  }}>
                  {score}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9px] font-mono uppercase tracking-widest px-2 mb-1.5"
                style={{ color: '#538A22' }}>
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(item => {
                  const active = isActive(item.section)
                  return (
                    <Link
                      key={item.section}
                      href={`/mrx/report/${id}/${item.section}`}
                      onClick={() => setNavOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: active ? '#FFFFFF' : 'transparent',
                        border:     `1px solid ${active ? '#C8E9A8' : 'transparent'}`,
                        color:      active ? '#1A3207' : '#3D6B16',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background  = '#FFFFFF'
                          e.currentTarget.style.borderColor = '#C8E9A8'
                          e.currentTarget.style.color       = '#1A3207'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background  = 'transparent'
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.color       = '#3D6B16'
                        }
                      }}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Back to dashboard */}
        <div className="p-4" style={{ borderTop: '1px solid #C8E9A8' }}>
          <Link
            href="/mrx/dashboard"
            onClick={() => setNavOpen(false)}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: '#FFFFFF', border: '1px solid #C8E9A8', color: '#538A22' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F2F9EC' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">

          {/* ── Page header ── */}
          <div className="flex justify-between items-center mb-10">
            <p className="text-xs font-mono uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
              Clinical Report
            </p>
            <ReportPdfActions reportId={report.id} initialPdfStored={!!report.pdf_filename} />
          </div>

          {!rd && (
            <div className="rounded-2xl p-6 mb-8"
              style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}>
              ⚠️ No detailed report data found. Please re-upload the PDF for full analysis.
            </div>
          )}

          {/* ── AI Recommendations Panel ── */}
          {rd && (
            <RecommendationsPanel
              reportId={report.id}
              reportData={rd}
              existingRecs={report.recommendations || null}
              patient={{
                name:            report.patient_name,
                age_sex:         report.patient_age_sex,
                diet_type:       report.patient_diet,
                medical_history: report.patient_history,
                allergies:       report.patient_allergies,
              }}
            />
          )}

          {/* Sits right under the AI Recommendation Engine card so a doctor
              lands on the approved document from one screen, without going
              through "Generate recommendations" again to get there. */}
          {prescription && (
            <Link
              href={
                prescription.approved_at
                  ? `/mrx/report/${id}/prescription-print`
                  : `/mrx/report/${id}/review`
              }
              target={prescription.approved_at ? '_blank' : undefined}
              className="mt-6 flex items-center justify-between rounded-2xl p-5 transition-all"
              style={
                prescription.approved_at
                  ? { background: '#F2F9EC', border: '1px solid #C8E9A8' }
                  : { background: '#FFFFFF', border: '1px solid #E2F3D0' }
              }
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: '#1A3207' }}>
                  {prescription.approved_at ? '✓ Approved prescription' : 'Prescription draft saved'}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#538A22' }}>
                  {prescription.approved_at
                    ? `Approved ${new Date(prescription.approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — view the signed PDF`
                    : 'Not yet approved — open the review screen to finish and approve it'}
                </div>
              </div>
              <span className="text-xs font-medium flex-shrink-0" style={{ color: '#538A22' }}>
                {prescription.approved_at ? 'Open PDF →' : 'Open draft →'}
              </span>
            </Link>
          )}

        </div>
      </div>
    </div>
  )
}