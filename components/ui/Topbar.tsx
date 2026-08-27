'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconSearch } from './icons'

// Topbar from design-reference/home.html: search on the left, date + avatar
// on the right. The mockup's notification bell is omitted — there is no
// notification source in the schema, and a permanently-dotted bell that does
// nothing is worse than no bell.
export default function Topbar({
  email,
  breadcrumb,
}: {
  email: string | null
  breadcrumb?: React.ReactNode
}) {
  const router = useRouter()
  const [q, setQ] = useState('')

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  return (
    <header
      className="sticky top-0 z-[5] flex h-[58px] flex-shrink-0 items-center justify-between gap-5 px-7"
      style={{ background: 'var(--paper-raised)', borderBottom: '1px solid var(--line-soft)' }}
    >
      {breadcrumb ?? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            router.push(q.trim() ? `/dashboard?q=${encodeURIComponent(q.trim())}` : '/dashboard')
          }}
          className="flex max-w-[380px] flex-1 items-center gap-2.5 rounded-[9px] px-3 py-2"
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--line-soft)',
            color: 'var(--ink-faint)',
          }}
        >
          <IconSearch />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="text"
            placeholder="Search patients, MRN, coach…"
            aria-label="Search patients"
            className="w-full border-none bg-transparent text-[13px] outline-none"
            style={{ color: 'var(--ink)' }}
          />
        </form>
      )}

      <div className="flex items-center gap-3.5">
        <span className="font-mono-clp text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
          {today}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white"
          style={{ background: 'var(--teal-700)' }}
          title={email ?? undefined}
        >
          {(email?.[0] ?? '?').toUpperCase()}
        </div>
      </div>
    </header>
  )
}
