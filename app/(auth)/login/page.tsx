'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'
import PasswordInput from '@/components/ui/PasswordInput'

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
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
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

  async function onForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) { setError('Enter your email first.'); return }

    setPending(true)
    try {
      const supabase = getBrowserClient()
      // Supabase always responds success here regardless of whether the
      // address has an account — that's deliberate on their end (an error
      // would let anyone probe which emails are registered), so the same
      // neutral message covers both cases.
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        setError(error.message)
        return
      }
      setNotice(`If an account exists for ${trimmedEmail}, a password reset link is on its way.`)
    } catch {
      setError('Network error — try again.')
    } finally {
      setPending(false)
    }
  }

  function switchMode(next: 'signin' | 'signup' | 'forgot') {
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
          {mode === 'signin' ? 'Sign in to continue.' : mode === 'signup' ? `Create an account with your @${ALLOWED_DOMAIN} email.` : 'Enter your email and we’ll send you a reset link.'}
        </p>

        {notice && (
          <p className="mt-4 text-sm text-[var(--foreground-secondary)]">{notice}</p>
        )}

        <form onSubmit={mode === 'signin' ? onSignIn : mode === 'signup' ? onSignUp : onForgotPassword} className="mt-6 space-y-4">
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

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm text-[var(--foreground-secondary)]">
                  Password
                </label>
                {mode === 'signin' && (
                  <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-medium text-[var(--primary)] hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-[var(--foreground-secondary)]">
                Confirm password
              </label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </div>
          )}

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
            {pending
              ? (mode === 'signin' ? 'Signing in…' : mode === 'signup' ? 'Creating account…' : 'Sending link…')
              : (mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link')}
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
          ) : mode === 'forgot' ? (
            <button type="button" onClick={() => switchMode('signin')} className="font-medium text-[var(--primary)] hover:underline">
              Back to sign in
            </button>
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
