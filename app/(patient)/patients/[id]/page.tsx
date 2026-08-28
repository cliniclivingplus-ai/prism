import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/guard'
import PatientSidebar from '@/components/ui/PatientSidebar'
import { Ring, WeeklyBars, Donut, RangeBar, BarTrack } from '@/components/ui/charts'
import {
  IconCompass, IconMrx, IconBlood, IconArrowOut, IconUpload, IconLock,
} from '@/components/ui/icons'
import { loadPatientWorkspace, rangePosition } from '@/lib/clinical/patient'
import { ageFrom, formatDate, relativeDays } from '@/lib/clinical/derive'

export const dynamic = 'force-dynamic'

const VIEW_TITLES: Record<string, string> = {
  overview: 'Overview',
  compass: 'LP Compass',
  mrx: 'MicrobiomeRx',
  blood: 'Blood Panel Analyzer',
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`mb-[18px] rounded-[14px] px-6 py-[22px] ${className}`}
      style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
    >
      {children}
    </div>
  )
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="mb-3.5 mt-[30px] flex items-baseline gap-2.5">
      <h2 className="font-display m-0 text-[19px] font-medium" style={{ color: 'var(--teal-900)' }}>
        {title}
      </h2>
      <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
    </div>
  )
}

function PanelTitle({ children, mt = 0 }: { children: React.ReactNode; mt?: number }) {
  return (
    <h3
      className="font-display mb-3.5 text-[15.5px] font-medium"
      style={{ color: 'var(--ink)', marginTop: mt }}
    >
      {children}
    </h3>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2.5 text-[10.5px] font-semibold uppercase"
      style={{ letterSpacing: '.07em', color: 'var(--ink-faint)' }}
    >
      {children}
    </div>
  )
}

function ToolHeader({
  tone, icon, title, desc, action,
}: {
  tone: 'teal' | 'pista' | 'rust'
  icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode
}) {
  const bg = tone === 'teal' ? 'var(--teal-100)' : tone === 'pista' ? 'var(--pista-100)' : 'var(--rust-100)'
  const fg = tone === 'teal' ? 'var(--teal-700)' : tone === 'pista' ? 'var(--pista-600)' : 'var(--rust-600)'
  return (
    <div className="mb-[22px] flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: bg, color: fg }}
        >
          {icon}
        </div>
        <div>
          <h1 className="font-display m-0 mb-0.5 text-[24px] font-medium" style={{ color: 'var(--ink)' }}>
            {title}
          </h1>
          <div className="text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>{desc}</div>
        </div>
      </div>
      {action}
    </div>
  )
}

export default async function PatientWorkspacePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const { view: rawView } = await searchParams
  const view = rawView && VIEW_TITLES[rawView] ? rawView : 'overview'

  const ws = await loadPatientWorkspace(id)
  if (!ws) notFound()

  const { patient, compass, mrx, blood, toolStates, activity } = ws
  const age = ageFrom(patient.date_of_birth)
  const adh = compass.adherence

  const toolSubs = {
    compass: compass.hasData ? `${compass.sessionCount} session${compass.sessionCount === 1 ? '' : 's'}` : 'No data',
    mrx: mrx.hasData ? 'Gut microbiome' : 'Not linked',
    blood: blood.hasData ? `${blood.markers.length} markers` : 'Not yet run',
  }

  return (
    <>
      <PatientSidebar
        patientId={patient.id}
        patientName={patient.full_name}
        mrn={patient.clinic_patient_id}
        view={view}
        toolStates={toolStates}
        toolSubs={toolSubs}
        email={user.email ?? null}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-[5] flex h-[58px] flex-shrink-0 items-center justify-between px-7"
          style={{ background: 'var(--paper-raised)', borderBottom: '1px solid var(--line-soft)' }}
        >
          <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
            <Link href="/dashboard">Patients</Link>
            <span>/</span>
            <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{patient.full_name ?? 'Unnamed'}</b>
            <span>/</span>
            <span>{VIEW_TITLES[view]}</span>
          </div>
          <span className="font-mono-clp text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </header>

        <main className="flex-1 px-7 pb-[70px] pt-[26px]" style={{ maxWidth: 1180 }}>

          {/* ══════════ OVERVIEW ══════════ */}
          {view === 'overview' && (
            <>
              <div
                className="mb-6 flex flex-wrap justify-between gap-6 rounded-[14px] px-[26px] py-6"
                style={{ background: 'var(--teal-950)', color: '#F2EEDF' }}
              >
                <div style={{ minWidth: 220 }}>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <span
                      className="font-mono-clp rounded-full px-[9px] py-[3px] text-[10.5px]"
                      style={{
                        background: 'rgba(201,162,39,.15)',
                        border: '1px solid rgba(201,162,39,.35)',
                        color: 'var(--gold-400)',
                        letterSpacing: '.03em',
                      }}
                    >
                      {compass.roadmapStatus === 'final' ? 'Active' : compass.roadmapStatus === 'draft' ? 'Draft roadmap' : 'No roadmap'}
                    </span>
                    <span className="font-mono-clp text-[11px]" style={{ color: '#7E9A93' }}>
                      MRN {patient.clinic_patient_id ?? '—'}
                    </span>
                  </div>
                  <h1 className="font-display m-0 mb-1 text-[26px] font-medium" style={{ color: '#FBF8EF' }}>
                    {patient.full_name ?? 'Unnamed patient'}
                  </h1>
                  <div className="text-[13px]" style={{ color: '#A9C1BA' }}>
                    {patient.coachName ? (
                      <>Assigned to <b style={{ color: '#DCEAE5', fontWeight: 600 }}>{patient.coachName}</b></>
                    ) : (
                      'No coach assigned'
                    )}
                  </div>
                </div>

                <div className="detail-grid grid gap-x-[34px] gap-y-5">
                  {[
                    ['Age / Sex', [age !== null ? String(age) : '—', patient.gender ?? '—'].join(' · ')],
                    ['Program week', adh?.currentWeek && adh.totalWeeks ? `Week ${adh.currentWeek} of ${adh.totalWeeks}` : '—'],
                    ['Enrolled', formatDate(patient.created_at)],
                    ['Last session', formatDate(compass.lastSessionDate)],
                    ['Primary concern', patient.primary_concern ?? '—'],
                    ['Focus theme', adh?.focusTheme ?? '—'],
                    ['Contact', patient.phone ?? '—'],
                    ['Sessions', String(compass.sessionCount)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ minWidth: 88 }}>
                      <div
                        className="mb-1 text-[10px] font-medium uppercase"
                        style={{ letterSpacing: '.07em', color: '#7E9A93' }}
                      >
                        {k}
                      </div>
                      <div className="text-[14px] font-medium" style={{ color: '#F0EDE1' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <SectionHead title="Tools" />
              <div className="tool-grid grid gap-4">
                {/* Compass */}
                <Link
                  href={`/patients/${patient.id}?view=compass`}
                  className="tool-card flex flex-col overflow-hidden rounded-[14px]"
                  style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
                >
                  <div
                    className="flex items-center justify-between px-[15px] py-3"
                    style={{ background: 'var(--teal-100)', borderBottom: '1px solid var(--line-soft)' }}
                  >
                    <span
                      className="font-mono-clp rounded-[5px] px-2 py-[3px] text-[10px] font-medium uppercase text-white"
                      style={{ background: 'var(--teal-600)', letterSpacing: '.06em' }}
                    >
                      LP Compass
                    </span>
                    <span
                      className="font-mono-clp text-[10px]"
                      style={{ color: toolStates.compass === 'ok' ? 'var(--pista-600)' : toolStates.compass === 'stale' ? 'var(--amber-600)' : 'var(--ink-faint)' }}
                    >
                      {compass.updatedAt ? `Updated ${relativeDays(compass.updatedAt)}` : 'No data'}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-[15px]">
                    <h3 className="font-display m-0 text-[15.5px] font-medium" style={{ color: 'var(--ink)' }}>
                      Coaching co-pilot
                    </h3>
                    {adh?.overallPct !== null && adh ? (
                      <>
                        <div className="text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>
                          <b className="font-mono-clp block text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                            {adh.overallPct}%
                          </b>
                          adherence{adh.currentWeek && adh.totalWeeks ? `, week ${adh.currentWeek} of ${adh.totalWeeks}` : ''}
                        </div>
                        <BarTrack pct={adh.overallPct ?? 0} color="var(--teal-600)" />
                      </>
                    ) : (
                      <div className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
                        No roadmap check-ins recorded yet.
                      </div>
                    )}
                    <div
                      className="mt-auto flex items-center gap-1.5 text-[12px] font-semibold"
                      style={{ color: 'var(--teal-700)' }}
                    >
                      Open tool <IconArrowOut />
                    </div>
                  </div>
                </Link>

                {/* MicrobiomeRx */}
                <Link
                  href={mrx.reportId ? `/mrx/report/${mrx.reportId}` : `/patients/${patient.id}?view=mrx`}
                  className="tool-card flex flex-col overflow-hidden rounded-[14px]"
                  style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
                >
                  <div
                    className="flex items-center justify-between px-[15px] py-3"
                    style={{ background: 'var(--pista-100)', borderBottom: '1px solid var(--line-soft)' }}
                  >
                    <span
                      className="font-mono-clp rounded-[5px] px-2 py-[3px] text-[10px] font-medium uppercase text-white"
                      style={{ background: 'var(--pista-600)', letterSpacing: '.06em' }}
                    >
                      MicrobiomeRx
                    </span>
                    <span
                      className="font-mono-clp text-[10px]"
                      style={{ color: toolStates.mrx === 'ok' ? 'var(--pista-600)' : toolStates.mrx === 'stale' ? 'var(--amber-600)' : 'var(--ink-faint)' }}
                    >
                      {mrx.hasData ? `Updated ${relativeDays(mrx.reportDate)}` : 'No report'}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-[15px]">
                    <h3 className="font-display m-0 text-[15.5px] font-medium" style={{ color: 'var(--ink)' }}>
                      Gut microbiome analysis
                    </h3>
                    {mrx.hasData && mrx.rychIndex !== null ? (
                      <>
                        <div className="text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>
                          <b className="font-mono-clp block text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                            {mrx.rychIndex}
                          </b>
                          Rych Index{mrx.rychTier ? ` — ${mrx.rychTier.toLowerCase()}` : ''}
                        </div>
                        <BarTrack pct={mrx.rychIndex} color="var(--pista-600)" />
                        {mrx.prescriptionApprovedAt && (
                          <span
                            className="font-mono-clp w-fit rounded-full px-2 py-[3px] text-[10px] font-medium"
                            style={{ background: 'var(--pista-100)', color: 'var(--pista-600)' }}
                          >
                            ✓ Supplement plan approved
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
                        No microbiome report linked to this patient.
                      </div>
                    )}
                    <div
                      className="mt-auto flex items-center gap-1.5 text-[12px] font-semibold"
                      style={{ color: 'var(--pista-600)' }}
                    >
                      {mrx.hasData ? 'Open full report' : 'Open tool'} <IconArrowOut />
                    </div>
                  </div>
                </Link>

                {/* Blood */}
                <Link
                  href={
                    blood.hasData && blood.bloodPatientId
                      ? `/blood/patient/${blood.bloodPatientId}`
                      : `/blood/start?patient=${patient.id}`
                  }
                  className="tool-card flex flex-col overflow-hidden rounded-[14px]"
                  style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
                >
                  <div
                    className="flex items-center justify-between px-[15px] py-3"
                    style={{ background: 'var(--rust-100)', borderBottom: '1px solid var(--line-soft)' }}
                  >
                    <span
                      className="font-mono-clp rounded-[5px] px-2 py-[3px] text-[10px] font-medium uppercase text-white"
                      style={{ background: 'var(--rust-600)', letterSpacing: '.06em' }}
                    >
                      Blood Panel
                    </span>
                    <span className="font-mono-clp text-[10px]" style={{ color: blood.hasData ? 'var(--pista-600)' : 'var(--ink-faint)' }}>
                      {blood.hasData ? `Updated ${relativeDays(blood.reportDate)}` : 'No report yet'}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-[15px]">
                    <h3 className="font-display m-0 text-[15.5px] font-medium" style={{ color: 'var(--ink)' }}>
                      Blood panel analysis
                    </h3>
                    {blood.hasData ? (
                      <>
                        <div className="text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>
                          <b className="font-mono-clp block text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                            {blood.abnormal.length}
                          </b>
                          markers outside range of {blood.markers.length}
                        </div>
                        <BarTrack
                          pct={blood.markers.length ? (blood.abnormal.length / blood.markers.length) * 100 : 0}
                          color="var(--rust-600)"
                        />
                      </>
                    ) : (
                      <div className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
                        No panel uploaded. Upload a PDF to generate the first analysis.
                      </div>
                    )}
                    <div
                      className="mt-auto flex items-center gap-1.5 text-[12px] font-semibold"
                      style={{ color: 'var(--rust-600)' }}
                    >
                      {blood.hasData ? 'Open tool' : 'Upload & open'} <IconArrowOut />
                    </div>
                  </div>
                </Link>
              </div>

              <SectionHead title="Recent activity" />
              <Panel>
                {activity.length === 0 ? (
                  <p className="m-0 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
                    Nothing recorded for this patient yet.
                  </p>
                ) : (
                  activity.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 py-2.5"
                      style={{ borderBottom: i === activity.length - 1 ? 'none' : '1px solid var(--line-soft)' }}
                    >
                      <span
                        className="mt-[5px] h-[7px] w-[7px] flex-shrink-0 rounded-full"
                        style={{ background: a.tone === 'ok' ? 'var(--pista-500)' : 'var(--gold-500)' }}
                      />
                      <div>
                        <b className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>{a.label}</b>
                        <span className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>{a.meta}</span>
                      </div>
                    </div>
                  ))
                )}
              </Panel>
            </>
          )}

          {/* ══════════ COMPASS ══════════ */}
          {view === 'compass' && (
            <>
              <ToolHeader
                tone="teal"
                icon={<IconCompass size={20} />}
                title="LP Compass"
                desc={`Coaching roadmap & session intelligence for ${patient.full_name ?? 'this patient'}`}
                action={
                  <div className="flex flex-wrap items-center gap-2.5">
                    {compass.shareToken && (
                      <Link
                        href={`/share/roadmap/${compass.shareToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-[7px] rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white"
                        style={{ background: 'var(--teal-700)' }}
                      >
                        Open roadmap dashboard <IconArrowOut />
                      </Link>
                    )}
                    {/* Always the same destination — this patient's own
                        Compass account page (sessions, reports, roadmap
                        history, "Edit roadmap"). The label used to read
                        "New session note" once a roadmap existed, which
                        described a different action than what the link
                        actually opens. */}
                    <Link
                      href={`/compass/patients/${patient.id}`}
                      className="flex items-center gap-[7px] rounded-lg px-4 py-2.5 text-[13px] font-semibold"
                      style={
                        compass.shareToken
                          ? { border: '1px solid var(--line)', color: 'var(--ink-soft)' }
                          : { background: 'var(--teal-700)', color: '#fff' }
                      }
                    >
                      <IconArrowOut /> Open in LP Compass
                    </Link>
                  </div>
                }
              />

              {adh && adh.overallPct !== null ? (
                <div className="panel-grid-2 grid gap-[18px]">
                  <Panel>
                    <Eyebrow>Program adherence</Eyebrow>
                    <div className="flex items-center gap-[18px]">
                      <Ring pct={adh.overallPct} />
                      <div>
                        <div className="font-mono-clp text-[26px] font-medium" style={{ color: 'var(--ink)' }}>
                          {adh.overallPct}%
                        </div>
                        <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
                          across weeks elapsed so far
                        </div>
                      </div>
                    </div>

                    <PanelTitle mt={22}>Weekly adherence trend</PanelTitle>
                    <WeeklyBars
                      weeks={adh.weeks.map((w) => ({ week: w.week, pct: w.pct }))}
                      currentWeek={adh.currentWeek}
                    />
                  </Panel>

                  <Panel>
                    <PanelTitle>Roadmap position</PanelTitle>
                    <div className="mb-2 text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>
                      <b className="font-mono-clp block text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                        {adh.currentWeek && adh.totalWeeks ? `Week ${adh.currentWeek} of ${adh.totalWeeks}` : '—'}
                      </b>
                      {adh.focusTheme ?? 'No focus theme recorded'}
                    </div>
                    <BarTrack
                      pct={adh.currentWeek && adh.totalWeeks ? (adh.currentWeek / adh.totalWeeks) * 100 : 0}
                      color="var(--teal-600)"
                    />

                    <PanelTitle mt={20}>Weeks below 50% adherence</PanelTitle>
                    {adh.weeks.filter((w) => w.planned > 0 && w.pct < 50 && (adh.currentWeek === null || w.week <= adh.currentWeek)).length === 0 ? (
                      <div className="flex items-start gap-2.5 py-2.5">
                        <span className="mt-[5px] h-[7px] w-[7px] rounded-full" style={{ background: 'var(--pista-500)' }} />
                        <div className="flex-text">
                          <b className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>On track</b>
                          <span className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
                            No elapsed week fell below 50%.
                          </span>
                        </div>
                      </div>
                    ) : (
                      adh.weeks
                        .filter((w) => w.planned > 0 && w.pct < 50 && (adh.currentWeek === null || w.week <= adh.currentWeek))
                        .map((w) => (
                          <div key={w.week} className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: '1px solid var(--line-soft)' }}>
                            <span className="mt-[5px] h-[7px] w-[7px] rounded-full" style={{ background: 'var(--gold-500)' }} />
                            <div>
                              <b className="block text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
                                Week {w.week}
                              </b>
                              <span className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
                                {w.done} of {w.planned} actions checked off ({w.pct}%)
                              </span>
                            </div>
                          </div>
                        ))
                    )}
                  </Panel>
                </div>
              ) : (
                <Panel>
                  <p className="m-0 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                    No roadmap with a weekly schedule exists for this patient yet, so there is nothing
                    to compute adherence from.
                  </p>
                </Panel>
              )}

              <Panel>
                <PanelTitle>Latest session note</PanelTitle>
                <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                  {compass.lastSessionSummary ?? 'No session summary recorded.'}
                </p>
              </Panel>
            </>
          )}

          {/* ══════════ MICROBIOMERX ══════════ */}
          {view === 'mrx' && (
            <>
              <ToolHeader
                tone="pista"
                icon={<IconMrx size={20} />}
                title="MicrobiomeRx"
                desc={mrx.hasData ? `Stool panel analysis · report from ${formatDate(mrx.reportDate)}` : 'No stool panel linked to this patient'}
                action={
                  <div className="flex flex-wrap items-center gap-2.5">
                    {mrx.reportId && (
                      <Link
                        href={`/mrx/report/${mrx.reportId}`}
                        className="flex items-center gap-[7px] rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white"
                        style={{ background: 'var(--pista-600)' }}
                      >
                        Open full report <IconArrowOut />
                      </Link>
                    )}
                    <Link
                      href={`/mrx/upload?patient=${patient.id}`}
                      className="flex items-center gap-[7px] rounded-lg px-4 py-2.5 text-[13px] font-semibold"
                      style={
                        mrx.reportId
                          ? { border: '1px solid var(--line)', color: 'var(--ink-soft)' }
                          : { background: 'var(--pista-600)', color: '#fff' }
                      }
                    >
                      <IconUpload size={14} /> {mrx.reportId ? 'Upload new report' : 'Upload report'}
                    </Link>
                  </div>
                }
              />

              {mrx.hasData ? (
                <>
                  <div className="panel-grid-2 grid gap-[18px]">
                    <Panel>
                      <Eyebrow>SCFA profile</Eyebrow>
                      {mrx.scfa.length ? (
                        <Donut slices={mrx.scfa} />
                      ) : (
                        <p className="m-0 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
                          No SCFA values in this report.
                        </p>
                      )}
                    </Panel>

                    <Panel>
                      <PanelTitle>Key indices</PanelTitle>
                      <RangeBar
                        name="Rych Index"
                        value={mrx.rychIndex !== null ? `${mrx.rychIndex} / 100` : '—'}
                        position={mrx.rychIndex}
                        labels={['Dysbiotic', 'Balanced', 'Optimal']}
                      />
                      <RangeBar
                        name="Diversity (Shannon)"
                        value={mrx.shannon !== null ? mrx.shannon.toFixed(2) : '—'}
                        position={mrx.shannon !== null ? Math.min(98, (mrx.shannon / 6) * 100) : null}
                      />
                      <RangeBar
                        name="Species detected"
                        value={mrx.speciesCount !== null ? String(mrx.speciesCount) : '—'}
                        position={mrx.speciesCount !== null ? Math.min(98, (mrx.speciesCount / 200) * 100) : null}
                      />
                      {mrx.rychTier && (
                        <p className="mt-3 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
                          Tier: <b style={{ color: 'var(--ink-soft)' }}>{mrx.rychTier}</b>
                        </p>
                      )}
                    </Panel>
                  </div>

                  <Panel>
                    <PanelTitle>Flagged markers</PanelTitle>
                    {mrx.flagged.length === 0 ? (
                      <p className="m-0 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>No markers flagged.</p>
                    ) : (
                      <div className="flex flex-col">
                        {mrx.flagged.map((f, i) => {
                          const sev = (f.severity ?? '').toLowerCase()
                          const color = sev.includes('severe') ? 'var(--rust-500)' : sev.includes('moderate') ? 'var(--gold-500)' : 'var(--pista-500)'
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-4 py-2.5"
                              style={{ borderBottom: i === mrx.flagged.length - 1 ? 'none' : '1px solid var(--line-soft)' }}
                            >
                              <div className="flex min-w-0 items-center gap-2.5 text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
                                <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full" style={{ background: color }} />
                                <span className="truncate">{f.name}</span>
                              </div>
                              <div className="font-mono-clp flex-shrink-0 text-right text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                                {f.severity ?? '—'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Panel>

                  <Panel>
                    <PanelTitle>Supplement plan</PanelTitle>
                    {mrx.prescriptionApprovedAt ? (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span
                            className="font-mono-clp inline-block rounded-full px-2.5 py-1 text-[10.5px] font-medium"
                            style={{ background: 'var(--pista-100)', color: 'var(--pista-600)' }}
                          >
                            ✓ Approved {formatDate(mrx.prescriptionApprovedAt)}
                          </span>
                          <p className="m-0 mt-2 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                            Doctor-approved supplements, therapies and dietary protocol for this patient.
                          </p>
                        </div>
                        <Link
                          href={`/mrx/report/${mrx.reportId}/prescription-print`}
                          target="_blank"
                          className="flex flex-shrink-0 items-center gap-[7px] rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white"
                          style={{ background: 'var(--pista-600)' }}
                        >
                          Open PDF <IconArrowOut />
                        </Link>
                      </div>
                    ) : (
                      <p className="m-0 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
                        No prescription has been approved for this report yet — the doctor reviews and
                        approves it from within MicrobiomeRx.
                      </p>
                    )}
                  </Panel>
                </>
              ) : (
                <Panel>
                  <p className="m-0 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                    No stool panel for this patient yet. Uploading one from here attaches it to
                    this record by id — indices and flagged markers appear on this tab as soon
                    as it is processed.
                  </p>
                </Panel>
              )}
            </>
          )}

          {/* ══════════ BLOOD PANEL ══════════ */}
          {view === 'blood' && (
            <>
              <ToolHeader
                tone="rust"
                icon={<IconBlood size={20} />}
                title="Blood Panel Analyzer"
                desc={blood.hasData ? `Panel from ${formatDate(blood.reportDate)}` : `No report on file for ${patient.full_name ?? 'this patient'} yet`}
                action={
                  <div className="flex flex-wrap items-center gap-2.5">
                    {blood.hasData && blood.bloodPatientId && (
                      <Link
                        href={`/blood/patient/${blood.bloodPatientId}`}
                        className="flex items-center gap-[7px] rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white"
                        style={{ background: 'var(--rust-600)' }}
                      >
                        Open full analysis <IconArrowOut />
                      </Link>
                    )}
                    <Link
                      href={`/blood/start?patient=${patient.id}`}
                      className="flex items-center gap-[7px] rounded-lg px-4 py-2.5 text-[13px] font-semibold"
                      style={
                        blood.hasData
                          ? { border: '1px solid var(--line)', color: 'var(--ink-soft)' }
                          : { background: 'var(--rust-600)', color: '#fff' }
                      }
                    >
                      <IconUpload size={14} /> {blood.hasData ? 'Upload new panel' : 'Upload panel'}
                    </Link>
                  </div>
                }
              />

              {blood.hasData ? (
                <div className="panel-grid-2 grid gap-[18px]">
                  <Panel>
                    <PanelTitle>Markers by result</PanelTitle>
                    {blood.markers.slice(0, 8).map((m) => (
                      <RangeBar
                        key={m.name}
                        name={m.name}
                        value={`${m.result}${m.unit ? ' ' + m.unit : ''}`}
                        position={rangePosition(m)}
                        labels={['Low', 'Reference', 'High']}
                      />
                    ))}
                    {blood.markers.length > 8 && (
                      <p className="font-mono-clp mt-2 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                        Showing 8 of {blood.markers.length} markers
                      </p>
                    )}
                  </Panel>

                  <Panel>
                    <PanelTitle>Flagged results</PanelTitle>
                    {blood.abnormal.length === 0 ? (
                      <p className="m-0 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
                        All markers within reference range.
                      </p>
                    ) : (
                      blood.abnormal.map((m, i) => (
                        <div
                          key={m.name}
                          className="flex items-center justify-between gap-4 py-2.5"
                          style={{ borderBottom: i === blood.abnormal.length - 1 ? 'none' : '1px solid var(--line-soft)' }}
                        >
                          <div className="flex min-w-0 items-center gap-2.5 text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
                            <span
                              className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                              style={{ background: m.flag === 'H' ? 'var(--rust-500)' : 'var(--gold-500)' }}
                            />
                            <span className="truncate">{m.name}</span>
                          </div>
                          <div
                            className="font-mono-clp min-w-0 truncate text-right text-[11px]"
                            style={{ color: 'var(--ink-faint)', maxWidth: '55%' }}
                            title={`ref ${m.refRange ?? '—'}`}
                          >
                            {m.result}{m.unit ? ' ' + m.unit : ''} · ref {m.refRange ?? '—'}
                          </div>
                        </div>
                      ))
                    )}
                  </Panel>
                </div>
              ) : (
                <>
                  <Panel>
                    <div
                      className="rounded-xl px-5 py-[34px] text-center"
                      style={{ border: '1.5px dashed var(--line)', background: 'var(--paper)' }}
                    >
                      <div
                        className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[10px]"
                        style={{ background: 'var(--rust-100)', color: 'var(--rust-600)' }}
                      >
                        <IconUpload />
                      </div>
                      <h4 className="font-display m-0 mb-1.5 text-[15.5px] font-medium" style={{ color: 'var(--ink)' }}>
                        Upload a blood panel to begin
                      </h4>
                      <p className="m-0 mb-4 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
                        Drop in a PDF or a photo of a printed report.{' '}
                        {patient.full_name?.split(' ')[0] ?? 'This patient'}&apos;s markers are read
                        out and checked against their reference ranges. Scanned reports are OCR&apos;d
                        in your browser, so the file itself never leaves this machine.
                      </p>
                      <Link
                        href={`/blood/start?patient=${patient.id}`}
                        className="inline-flex items-center gap-[7px] rounded-lg px-4 py-2.5 text-[12.5px] font-semibold text-white"
                        style={{ background: 'var(--rust-600)' }}
                      >
                        <IconUpload size={14} /> Choose file
                      </Link>
                      <div className="font-mono-clp text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                        PDF · up to 15MB
                      </div>
                    </div>
                  </Panel>

                  <SectionHead title="What you'll see after the first upload" />
                  <div className="relative overflow-hidden rounded-xl" style={{ border: '1px solid var(--line-soft)' }}>
                    <div className="px-[22px] py-5" style={{ filter: 'blur(3.5px) grayscale(.3)', opacity: 0.55 }}>
                      <PanelTitle>Markers by system</PanelTitle>
                      <RangeBar name="Hemoglobin" value="—" position={55} />
                      <RangeBar name="Fasting glucose" value="—" position={44} />
                      <RangeBar name="TSH" value="—" position={70} />
                    </div>
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                      style={{ background: 'rgba(250,246,238,.35)' }}
                    >
                      <div
                        className="flex items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[11.5px] font-semibold"
                        style={{ background: 'var(--paper-raised)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}
                      >
                        <IconLock /> Unlocks after first upload
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
