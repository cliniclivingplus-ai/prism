import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Defence in depth behind middleware: call at the top of any server component
// or route handler that must have a user. Middleware already redirected
// anonymous traffic, so this mainly guards against a route being added
// outside the matcher, or middleware being misconfigured later.
export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  return user
}
