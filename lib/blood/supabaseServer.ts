// Blood Panel's server-side clients, delegating to the shared factories.
// createAdminClient() reads only the canonical SUPABASE_SERVICE_ROLE_KEY and
// throws when it is missing, rather than silently falling back to the anon key.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export function createSupabaseServerClient() {
  return createClient('blood')
}

export function createSupabaseAdmin() {
  return createAdminClient('blood')
}
