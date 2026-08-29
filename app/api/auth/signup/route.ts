import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// The one deliberate exception to "self-serve signup is retired" (see
// lib/auth/middleware.ts) — an account can only be created here, and only
// with a @cliniclivingplus.com address, so this reopens signup without
// reopening it to the public. Domain check happens server-side (never trust
// the client) using the service-role client's auth.admin API, which is the
// only way to both enforce that and mark the account pre-confirmed (an
// already-domain-restricted address has no need for an email-verification
// round trip).
//
// This route itself must stay in middleware.ts's PUBLIC_PATHS — it's the
// entry point a not-yet-authenticated visitor calls to get an account in
// the first place, so it can't sit behind the same gate as everything else.
//
// For this to be watertight rather than just this route's own front door,
// Supabase's own "Allow new users to sign up" toggle (Authentication >
// Sign In / Providers > Email) should be OFF at the project level — that
// closes the anon-key public signUp() endpoint directly, which nothing in
// this app's own code can enforce.
const ALLOWED_DOMAIN = 'cliniclivingplus.com'

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }
  const domain = email.split('@')[1]
  if (domain !== ALLOWED_DOMAIN) {
    return NextResponse.json({ error: `Only @${ALLOWED_DOMAIN} email addresses can create an account.` }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    // Supabase's own message for a duplicate email is fine to surface as-is
    // ("A user with this email address has already been registered") —
    // nothing in it leaks anything beyond what the submitter already knows.
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
