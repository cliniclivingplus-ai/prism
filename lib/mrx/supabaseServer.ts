// MicrobiomeRx's server-side clients, delegating to the shared factories.
//
// createSupabaseAdmin() previously read the non-canonical SUPABASE_SERVICE_ROLE_KEY
// in some routes and SUPABASE_SERVICE_ROLE_KEY in others; createAdminClient()
// reads only the canonical name and throws if it's missing rather than
// silently falling back to the anon key.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export function createSupabaseServerClient() {
  return createClient('mrx')
}

export function createSupabaseAdmin() {
  return createAdminClient('mrx')
}
