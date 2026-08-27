'use client'

// Blood Panel's client-side auth helpers, re-pointed at the shared session.
// signIn/signUp are gone — the merged app has one invite-only login, and the
// tool's own /login and /signup pages were retired during the port.
import { getBrowserClient } from '@/lib/supabase/client'

export async function getSession() {
  const { data, error } = await getBrowserClient('blood').auth.getSession()
  return error ? null : data.session
}

export async function getUser() {
  const { data, error } = await getBrowserClient('blood').auth.getUser()
  return error ? null : data.user
}

export async function signOut() {
  await getBrowserClient('blood').auth.signOut()
  window.location.href = '/login'
}
