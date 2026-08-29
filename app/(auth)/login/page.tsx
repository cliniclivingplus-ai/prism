'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'

const ALLOWED_DOMAIN = 'cliniclivingplus.com'

// Single login for all three tools. Self-serve signup was retired, then
// reopened in one deliberate, narrow form: an account can only be created
// via /api/auth/signup, which enforces the @cliniclivingplus.com domain
// server-side (never trust a client-side check alone) — this form's own
// domain check below is just so the mistake surfaces before a submit round
// trip, not the actual enforcement. Clinician accounts for other domains
// still go through the Supabase dashboard directly.
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function afterSignIn() {
    // Only ever bounce back to an in-app path, so a crafted ?next= can't
    // turn the login page into an open redirect.
    const next = searchParams.get('next')
    const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
    router.replace(dest)
    router.refresh()
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const supabase = getBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setPending(false)
      return
    }

    afterSignIn()
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail.endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only @${ALLOWED_DOMAIN} email addresses can create an account.`)
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords don’t match.')
      return
    }

    setPending(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error || 'Could not create the account.')
        setPending(false)
        return
      }

      // Account is created pre-confirmed — sign straight in rather than
      // making them retype credentials on a second screen.
      const supabase = getBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password })
      if (signInError) {
        // Account exists but the immediate sign-in failed for some other
        // reason (rare) — hand them back to sign-in mode with a clear next step.
        setNotice('Account created. Sign in below to continue.')
        setMode('signin')
        setPassword('')
        setConfirmPassword('')
        setPending(false)
        return
      }

      afterSignIn()
    } catch {
      setError('Network error — try again.')
      setPending(false)
    }
  }

  function switchMode(next: 'signin' | 'signup') {
    setMode(next)
    setError(null)
    setNotice(null)
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div
        className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-8"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <h1 className="text-xl font-semibold text-[var(--foreground)]">LP Workspace</h1>
        <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
          {mode === 'signin' ? 'Sign in to continue.' : `Create an account with your @${ALLOWED_DOMAIN} email.`}
        </p>

        {notice && (
          <p className="mt-4 text-sm text-[var(--foreground-secondary)]">{notice}</p>
        )}

        <form onSubmit={mode === 'signin' ? onSignIn : onSignUp} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-[var(--foreground-secondary)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-[var(--foreground-secondary)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-[var(--foreground-secondary)]">
                Confirm password
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
          )}

          {error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[var(--radius-sm)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            {pending ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--foreground-secondary)]">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <button type="button" onClick={() => switchMode('signup')} className="font-medium text-[var(--primary)] hover:underline">
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('signin')} className="font-medium text-[var(--primary)] hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
