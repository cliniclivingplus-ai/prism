import Link from 'next/link'
import { IconHome, IconCompass, IconMrx, IconBlood, IconChevron } from './icons'
import { initials, type ToolState } from '@/lib/clinical/derive'

// The patient-scoped sidebar from design-reference/clp-patient-workspace.html:
// the global nav is replaced by a patient switcher plus per-tool nav with
// status dots. Views are addressed by ?view= so tabs survive a refresh and
// work without JavaScript.
const DOT: Record<ToolState, string> = {
  ok: 'var(--pista-500)',
  stale: 'var(--gold-500)',
  empty: '#48605A',
}

export default function PatientSidebar({
  patientId,
  patientName,
  mrn,
  view,
  toolStates,
  toolSubs,
  email,
}: {
  patientId: string
  patientName: string | null
  mrn: string | null
  view: string
  toolStates: { compass: ToolState; mrx: ToolState; blood: ToolState }
  toolSubs: { compass: string; mrx: string; blood: string }
  email: string | null
}) {
  const tools = [
    { key: 'compass', label: 'LP Compass', icon: <IconCompass />, sub: toolSubs.compass },
    { key: 'mrx', label: 'MicrobiomeRx', icon: <IconMrx />, sub: toolSubs.mrx },
    { key: 'blood', label: 'Blood Panel Analyzer', icon: <IconBlood />, sub: toolSubs.blood },
  ] as const

  const navItem = (
    key: string,
    label: string,
    icon: React.ReactNode,
    sub?: string,
    dot?: ToolState
  ) => {
    const active = view === key
    return (
      <Link
        key={key}
        href={`/patients/${patientId}?view=${key}`}
        aria-current={active ? 'page' : undefined}
        className="mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium"
        style={{
          color: active ? '#F8F5E9' : '#B9CCC6',
          background: active ? 'rgba(255,255,255,.07)' : undefined,
          borderLeft: `2px solid ${active ? 'var(--gold-500)' : 'transparent'}`,
        }}
      >
        <span style={{ opacity: 0.85, flexShrink: 0, display: 'flex' }}>{icon}</span>
        <span className="min-w-0 flex-1">
          {label}
          {sub && (
            <span className="font-mono-clp mt-px block text-[10px] font-normal" style={{ color: '#6C8880' }}>
              {sub}
            </span>
          )}
        </span>
        {dot && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: DOT[dot] }} />}
      </Link>
    )
  }

  return (
    <aside
      className="sticky top-0 flex h-screen flex-shrink-0 flex-col"
      style={{ width: 'var(--sidebar-w)', background: 'var(--teal-950)', color: '#DCE8E4' }}
    >
      <div
        className="flex items-center gap-2.5 px-[18px] pb-4 pt-5"
        style={{ borderBottom: '1px solid rgba(220,232,228,.09)' }}
      >
        <div
          className="font-display flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[7px] text-[13px] font-semibold"
          style={{
            background: 'linear-gradient(155deg, var(--gold-400), var(--gold-500))',
            color: 'var(--teal-950)',
          }}
        >
          C
        </div>
        <div className="text-[13px] font-semibold leading-tight" style={{ color: '#F2EEDF' }}>
          Living Plus
          <span className="font-mono-clp mt-px block text-[10px] font-normal" style={{ color: '#7E9A93' }}>
            Clinician Workspace
          </span>
        </div>
      </div>

      <Link
        href="/dashboard"
        title="Back to patient list"
        className="mx-3.5 mb-1.5 mt-3.5 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5"
        style={{ background: 'rgba(255,255,255,.045)', border: '1px solid rgba(220,232,228,.1)' }}
      >
        <div
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: 'var(--gold-500)', color: 'var(--teal-950)' }}
        >
          {initials(patientName)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold leading-tight" style={{ color: '#F2EEDF' }}>
            {patientName ?? 'Unnamed'}
          </div>
          <div className="font-mono-clp mt-px text-[10px]" style={{ color: '#7E9A93' }}>
            {mrn ?? '—'}
          </div>
        </div>
        <span className="ml-auto rotate-180" style={{ color: '#5F7C74' }}>
          <IconChevron size={14} />
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-2.5">
        <div
          className="px-2 pb-1.5 pt-3.5 text-[10px] font-semibold uppercase"
          style={{ letterSpacing: '.09em', color: '#5F7C74' }}
        >
          Patient
        </div>
        {navItem('overview', 'Overview', <IconHome />)}

        <div
          className="px-2 pb-1.5 pt-3.5 text-[10px] font-semibold uppercase"
          style={{ letterSpacing: '.09em', color: '#5F7C74' }}
        >
          Tools
        </div>
        {tools.map((t) => navItem(t.key, t.label, t.icon, t.sub, toolStates[t.key]))}
      </nav>

      <div
        className="flex items-center gap-2.5 px-3.5 pb-4 pt-3"
        style={{ borderTop: '1px solid rgba(220,232,228,.09)' }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: 'var(--teal-600)', color: '#F2EEDF' }}
        >
          {(email?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold leading-tight" style={{ color: '#F2EEDF' }}>
            {email ?? 'Signed in'}
          </div>
          <div className="mt-px text-[10.5px]" style={{ color: '#7E9A93' }}>Clinician</div>
        </div>
      </div>
    </aside>
  )
}
