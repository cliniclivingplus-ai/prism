import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Defence in depth behind middleware: call at the top of any server component
// or route handler that must have a user. Middleware already redirected
// anonymous traffic, so this mainly guards against a route being added
// outside the matcher, or middleware being misconfigured later.
export async function requireUser(): Promise<{ id: string; email: string | null }> {
  const supabase = await createClient()
  // getClaims() verifies the JWT locally (cached signing keys) rather than
  // a second round trip to Supabase Auth on top of the one proxy.ts gate.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (!claims?.sub) redirect('/login')
  return { id: claims.sub, email: (claims.email as string | undefined) ?? null }
}
