import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { SCHEMAS, type ToolKey } from './schemas'

// Service-role client. Bypasses RLS entirely, so it must never be reachable
// from a public (unauthenticated) route. The audit found Compass's public
// patient dashboard doing exactly that with a `select('*')` — the /share
// surface in this app goes through lib/share/publicData.ts instead, which
// column-lists every field it returns.
//
// Import this only from route handlers under app/api/{compass,mrx,blood}/**,
// which middleware gates behind a real session.
export function createAdminClient(tool: ToolKey = 'compass') {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    db: { schema: SCHEMAS[tool] },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
