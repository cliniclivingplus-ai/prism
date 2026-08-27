'use client'

// MicrobiomeRx's client-side auth helpers, re-pointed at the shared session.
//
// signUp() is deliberately gone: self-serve registration was retired when the
// three tools merged behind one invite-only login. signIn() is gone too — the
// merged app has a single /login page. What remains is what the ported pages
// actually still need: reading the current session/user and signing out.
import { getBrowserClient } from '@/lib/supabase/client'

export async function getSession() {
  const { data, error } = await getBrowserClient('mrx').auth.getSession()
  return error ? null : data.session
}

export async function getUser() {
  const { data, error } = await getBrowserClient('mrx').auth.getUser()
  return error ? null : data.user
}

export async function signOut() {
  await getBrowserClient('mrx').auth.signOut()
  window.location.href = '/login'
}
