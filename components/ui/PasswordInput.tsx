'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// A plain password <input> with a show/hide toggle — used on the login
// and reset-password forms, the only two places in the app that collect
// a password. Kept as one shared component instead of copy-pasting the
// toggle button into each form.
export default function PasswordInput({
  id, value, onChange, autoComplete, required = true,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  required?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
        className="absolute right-2 top-[calc(50%+2px)] -translate-y-1/2 text-[var(--foreground-muted)] hover:text-[var(--foreground-secondary)]"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
