import Link from 'next/link'
import Topbar from '@/components/ui/Topbar'
import { requireUser } from '@/lib/auth/guard'
import { loadRoster, type RosterPatient } from '@/lib/clinical/roster'
import { initials, relativeDays } from '@/lib/clinical/derive'
import {
  IconPatients, IconCheck, IconAlert, IconCalendar, IconChevron, IconPlus,
} from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'review', label: 'Needs review' },
  { key: 'paused', label: 'Paused' },
] as const

const STATUS_STYLE: Record<RosterPatient['status'], { bg: string; fg: string; label: string }> = {
  active: { bg: 'var(--teal-100)', fg: 'var(--teal-700)', label: 'Active' },
  review: { bg: 'var(--gold-100)', fg: 'var(--amber-600)', label: 'Needs review' },
  paused: { bg: 'var(--line-soft)', fg: 'var(--ink-faint)', label: 'Paused' },
  draft: { bg: 'var(--line-soft)', fg: 'var(--ink-faint)', label: 'Draft' },
}

const DOT: Record<string, string> = {
  ok: 'var(--pista-500)',
  stale: 'var(--gold-500)',
  empty: 'var(--line)',
}

const ROW_COLS = '2.2fr 1.3fr 1fr .9fr 1.1fr 32px'

function StatCard({
  icon, iconBg, iconFg, trend, trendTone, num, label,
}: {
  icon: React.ReactNode; iconBg: string; iconFg: string
  trend: string; trendTone?: 'up' | 'warn'; num: string; label: string
}) {
  const trendColor =
    trendTone === 'up' ? 'var(--pista-600)'
    : trendTone === 'warn' ? 'var(--amber-600)'
    : 'var(--ink-faint)'

  return (
    <div
      className="flex flex-col gap-2 rounded-[14px] px-[18px] py-[17px]"
      style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
          style={{ background: iconBg, color: iconFg }}
        >
          {icon}
        </div>
        <span
          className="font-mono-clp whitespace-nowrap text-[11px]"
          style={{ color: trendColor }}
        >
          {trend}
        </span>
      </div>
      <div className="font-mono-clp text-[25px] font-medium" style={{ color: 'var(--ink)' }}>
        {num}
      </div>
      <div className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>{label}</div>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const user = await requireUser()
  const { filter = 'all', q } = await searchParams
  const { patients, stats } = await loadRoster()

  const needle = q?.trim().toLowerCase() ?? ''
  const shown = patients
    .filter((p) => (filter === 'all' ? true : p.status === filter))
    .filter((p) =>
      !needle ||
      (p.name ?? '').toLowerCase().includes(needle) ||
      (p.mrn ?? '').toLowerCase().includes(needle)
    )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const who = user.email?.split('@')[0] ?? 'there'

  return (
    <>
      <Topbar email={user.email ?? null} />

      <main className="flex-1 px-[30px] pb-[70px] pt-7" style={{ maxWidth: 1240 }}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3.5">
          <div>
            <h1
              className="font-display m-0 mb-1 text-[27px] font-medium"
              style={{ color: 'var(--teal-900)' }}
            >
              {greeting}, {who}
            </h1>
            <div className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              {stats.sessionsToday} session{stats.sessionsToday === 1 ? '' : 's'} today
              {' · '}
              {stats.awaitingReview} session{stats.awaitingReview === 1 ? '' : 's'} awaiting review
            </div>
          </div>
          <Link
            href="/patients/new"
            className="flex items-center gap-[7px] rounded-[9px] px-[17px] py-2.5 text-[13px] font-semibold text-white"
            style={{ background: 'var(--teal-700)' }}
          >
            <IconPlus /> Add patient
          </Link>
        </div>

        <div className="stat-grid mb-[30px] grid gap-3.5">
          <StatCard
            icon={<IconPatients />} iconBg="var(--teal-100)" iconFg="var(--teal-700)"
            trend="on file" num={String(stats.totalPatients)} label="Total patients"
          />
          <StatCard
            icon={<IconCheck />} iconBg="var(--pista-100)" iconFg="var(--pista-600)"
            trend="finalised" trendTone="up"
            num={String(stats.activePrograms)} label="Active programs"
          />
          <StatCard
            icon={<IconAlert />} iconBg="var(--gold-100)" iconFg="var(--amber-600)"
            trend={stats.awaitingReview > 0 ? 'needs review' : 'all clear'}
            trendTone={stats.awaitingReview > 0 ? 'warn' : 'up'}
            num={String(stats.awaitingReview)} label="Sessions awaiting review"
          />
          <StatCard
            icon={<IconCalendar />} iconBg="var(--rust-100)" iconFg="var(--rust-600)"
            trend={stats.sessionsToday > 0 ? 'scheduled' : 'none today'}
            num={String(stats.sessionsToday)} label="Sessions today"
          />
        </div>

        <div className="mb-3.5 mt-2 flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="font-display m-0 text-[19px] font-medium" style={{ color: 'var(--teal-900)' }}>
            Patients
          </h2>
          <div
            className="flex gap-1.5 rounded-[10px] p-[3px]"
            style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
          >
            {FILTERS.map((f) => {
              const active = filter === f.key
              return (
                <Link
                  key={f.key}
                  href={`/dashboard?${new URLSearchParams({ ...(f.key === 'all' ? {} : { filter: f.key }), ...(q ? { q } : {}) })}`}
                  className="rounded-[7px] px-[13px] py-1.5 text-[12px] font-semibold"
                  style={{
                    background: active ? 'var(--teal-100)' : undefined,
                    color: active ? 'var(--teal-700)' : 'var(--ink-faint)',
                  }}
                >
                  {f.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div
          className="overflow-hidden rounded-[14px]"
          style={{ background: 'var(--paper-raised)', border: '1px solid var(--line-soft)' }}
        >
          <div
            className="roster-head grid items-center gap-3 px-5 py-3.5 text-[10.5px] font-semibold uppercase"
            style={{
              gridTemplateColumns: ROW_COLS,
              background: 'var(--paper)',
              borderBottom: '1px solid var(--line-soft)',
              letterSpacing: '.06em',
              color: 'var(--ink-faint)',
            }}
          >
            <div>Patient</div><div className="col-hide">Program</div><div>Status</div>
            <div className="col-hide">Tools</div><div className="col-hide">Last activity</div><div />
          </div>

          {shown.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              No patients match this filter.
            </div>
          ) : (
            shown.map((p) => {
              const st = STATUS_STYLE[p.status]
              return (
                <Link
                  key={p.id}
                  href={`/patients/${p.id}`}
                  className="roster-row grid items-center gap-3 px-5 py-3.5"
                  style={{
                    gridTemplateColumns: ROW_COLS,
                    borderBottom: '1px solid var(--line-soft)',
                  }}
                >
                  <div className="flex min-w-0 items-center gap-[11px]">
                    <div
                      className="font-display flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold"
                      style={{ background: 'var(--gold-100)', color: 'var(--amber-600)' }}
                    >
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <div
                        className="truncate text-[13.5px] font-semibold leading-tight"
                        style={{ color: 'var(--ink)' }}
                      >
                        {p.name ?? 'Unnamed'}
                      </div>
                      <div className="font-mono-clp mt-px text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                        {p.mrn ?? '—'}
                      </div>
                    </div>
                  </div>

                  <div className="col-hide text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
                    {p.program ?? '—'}
                    <div className="font-mono-clp mt-px text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                      {p.currentWeek && p.totalWeeks
                        ? `Week ${p.currentWeek} of ${p.totalWeeks}`
                        : 'No roadmap'}
                    </div>
                  </div>

                  <div>
                    <span
                      className="inline-block w-fit rounded-full px-[9px] py-[3px] text-[11px] font-semibold"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {st.label}
                    </span>
                  </div>

                  <div className="col-hide flex gap-1.5">
                    {(['compass', 'mrx', 'blood'] as const).map((k) => (
                      <span
                        key={k}
                        title={`${k} — ${p.tools[k]}`}
                        className="h-2 w-2 rounded-full"
                        style={{ background: DOT[p.tools[k]] }}
                      />
                    ))}
                  </div>

                  <div className="col-hide text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                    {relativeDays(p.lastActivity)}
                  </div>

                  <div className="flex justify-end" style={{ color: 'var(--ink-faint)' }}>
                    <IconChevron />
                  </div>
                </Link>
              )
            })
          )}

          <div
            className="font-mono-clp flex items-center justify-between px-5 py-[11px] text-[11.5px]"
            style={{ color: 'var(--ink-faint)' }}
          >
            <span>Showing {shown.length} of {patients.length} patients{q ? ` matching “${q}”` : ''}</span>
            <span>Sorted by newest</span>
          </div>
        </div>
      </main>
    </>
  )
}
