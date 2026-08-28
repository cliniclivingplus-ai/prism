'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'
import {
  IconGrid, IconCompass, IconMrx, IconBlood, IconSignOut,
} from './icons'
import { initials } from '@/lib/clinical/derive'

// The shared dark-teal shell sidebar from design-reference/home.html.
type NavEntry = { href: string; label: string; icon: React.ReactNode; badge?: string }

export default function Sidebar({
  email,
}: {
  email: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()

  // "Patients" used to be a second entry here, but /patients was only ever
  // a redirect to this same page — both links opened identical content, so
  // it was dropped rather than kept as a second way to reach the one page.
  const workspace: NavEntry[] = [
    { href: '/dashboard', label: 'Dashboard', icon: <IconGrid /> },
  ]
  const tools: NavEntry[] = [
    { href: '/compass', label: 'LP Compass', icon: <IconCompass /> },
    { href: '/mrx', label: 'MicrobiomeRx', icon: <IconMrx /> },
    { href: '/blood', label: 'Blood Panel Analyzer', icon: <IconBlood /> },
  ]

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  async function signOut() {
    await getBrowserClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const item = (e: NavEntry) => {
    const active = isActive(e.href)
    return (
      <Link
        key={e.href}
        href={e.href}
        aria-current={active ? 'page' : undefined}
        className="mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium transition-colors"
        style={{
          color: active ? '#F8F5E9' : '#B9CCC6',
          background: active ? 'rgba(255,255,255,.07)' : undefined,
          borderLeft: `2px solid ${active ? 'var(--gold-500)' : 'transparent'}`,
        }}
      >
        <span style={{ opacity: 0.85, flexShrink: 0, display: 'flex' }}>{e.icon}</span>
        {e.label}
        {e.badge && (
          <span
            className="font-mono-clp ml-auto rounded-full px-[7px] py-px text-[10px]"
            style={{ background: 'rgba(255,255,255,.08)', color: '#9DB6AF' }}
          >
            {e.badge}
          </span>
        )}
      </Link>
    )
  }

  const groupLabel = (t: string) => (
    <div
      className="px-2 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase"
      style={{ letterSpacing: '.09em', color: '#5F7C74' }}
    >
      {t}
    </div>
  )

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
          <span
            className="font-mono-clp mt-px block text-[10px] font-normal"
            style={{ color: '#7E9A93' }}
          >
            Clinician Workspace
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-3.5">
        {groupLabel('Workspace')}
        {workspace.map(item)}
        {groupLabel('Tools overview')}
        {tools.map(item)}
      </nav>

      <div
        className="flex items-center gap-2.5 px-3.5 pb-4 pt-3"
        style={{ borderTop: '1px solid rgba(220,232,228,.09)' }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: 'var(--teal-600)', color: '#F2EEDF' }}
        >
          {initials(email?.split('@')[0] ?? null)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold leading-tight" style={{ color: '#F2EEDF' }}>
            {email ?? 'Signed in'}
          </div>
          <div className="mt-px text-[10.5px]" style={{ color: '#7E9A93' }}>
            Clinician
          </div>
        </div>
        <button onClick={signOut} title="Sign out" className="ml-auto" style={{ color: '#6C8880' }}>
          <IconSignOut />
        </button>
      </div>
    </aside>
  )
}
