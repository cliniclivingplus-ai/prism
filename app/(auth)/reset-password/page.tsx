'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'

// Where a "forgot password" email link lands. Supabase's browser client
// exchanges the URL's recovery token into a real (temporary) session
// automatically on load and fires a PASSWORD_RECOVERY auth event — this
// page just waits for that, then lets the visitor set a new password via
// auth.updateUser(). No email/token handling of our own; the client
// library does that part.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = getBrowserClient()

    // If the recovery session is already there by the time this effect
    // runs (the client processed the URL hash before React mounted),
    // this fires immediately with the existing session instead of
    // waiting for a fresh SIGNED_IN/PASSWORD_RECOVERY event.
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (data.session) setStatus('ready')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
    })

    // A real link always resolves to a session almost instantly; if
    // nothing shows up after a few seconds this is someone who opened
    // the page directly (or an expired/already-used link), not a race
    // that just needs more time.
    const timeout = setTimeout(() => {
      setStatus((s) => (s === 'checking' ? 'invalid' : s))
    }, 4000)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords don’t match.'); return }

    setPending(true)
    try {
      const supabase = getBrowserClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message)
        setPending(false)
        return
      }
      setDone(true)
      setTimeout(() => {
        router.replace('/dashboard')
        router.refresh()
      }, 1500)
    } catch {
      setError('Network error — try again.')
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div
        className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-8"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Set a new password</h1>

        {status === 'checking' && (
          <p className="mt-4 text-sm text-[var(--foreground-secondary)]">Checking your reset link…</p>
        )}

        {status === 'invalid' && (
          <>
            <p className="mt-4 text-sm text-[var(--foreground-secondary)]">
              This reset link is invalid or has expired. Request a new one from the login page.
            </p>
            <a href="/login" className="mt-4 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
              Back to login
            </a>
          </>
        )}

        {status === 'ready' && !done && (
          <>
            <p className="mt-1 text-sm text-[var(--foreground-secondary)]">Choose a new password for your account.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm text-[var(--foreground-secondary)]">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm text-[var(--foreground-secondary)]">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium text-[var(--danger)]"
                  style={{ background: 'rgba(154,69,47,.08)', borderColor: 'rgba(154,69,47,.3)' }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="btn-primary w-full rounded-[var(--radius-sm)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          </>
        )}

        {done && (
          <p className="mt-4 text-sm text-[var(--foreground-secondary)]">Password updated. Taking you to your dashboard…</p>
        )}
      </div>
    </main>
  )
}
