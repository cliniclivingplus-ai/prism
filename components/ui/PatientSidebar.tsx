'use client'

import { useState } from 'react'
import Link from 'next/link'
import { IconHome, IconCompass, IconMrx, IconBlood, IconChevron, IconMenu } from './icons'
import { initials, type ToolState } from '@/lib/clinical/derive'

// The patient-scoped sidebar from design-reference/clp-patient-workspace.html:
// the global nav is replaced by a patient switcher plus per-tool nav with
// status dots. Views are addressed by ?view= so tabs survive a refresh and
// work without JavaScript.
//
// Same off-canvas mobile treatment as components/ui/Sidebar.tsx — below md
// this was a fixed 248px column with no way to hide it, same problem, same
// fix (hamburger top bar + slide-in drawer + backdrop).
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
  const [open, setOpen] = useState(false)

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
        onClick={() => setOpen(false)}
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
    <>
      <div
        className="relative z-[60] flex items-center gap-3 px-4 py-3 md:hidden"
        style={{ background: 'var(--teal-950)', color: '#DCE8E4', borderBottom: '1px solid rgba(220,232,228,.09)' }}
      >
        <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} style={{ color: '#DCE8E4' }}>
          <IconMenu />
        </button>
        <div className="min-w-0 truncate text-[13px] font-semibold" style={{ color: '#F2EEDF' }}>
          {patientName ?? 'Unnamed'}
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[248px] flex-shrink-0 flex-col transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--teal-950)', color: '#DCE8E4' }}
      >
        {/* Hidden below md — same reasoning as components/ui/Sidebar.tsx:
            the mobile top bar already shows a wordmark, so duplicating one
            here (under that bar's z-index) just peeked out behind it. */}
        <div
          className="hidden items-center gap-2.5 px-[18px] pb-4 pt-5 md:flex"
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

        {/* mt-[52px] below md: the drawer's own header is hidden there now
            (see above), so without this this link would render right under
            the fixed mobile top bar and be covered by it. */}
        <Link
          href="/dashboard"
          title="Back to patient list"
          onClick={() => setOpen(false)}
          className="mx-3.5 mb-1.5 mt-[52px] flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 md:mt-3.5"
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
    </>
  )
}
