// Compatibility surface for ported tool code.
//
// Compass shipped three hand-rolled clients (lib/supabase.ts, supabaseMrx.ts,
// supabaseBlood.ts), each lazily constructed behind a Proxy so importing the
// module didn't require env vars at build time. That ergonomics is worth
// keeping — hundreds of call sites do `supabaseAdmin.from(...)` at module
// scope — but the construction now goes through the shared factories in
// ./admin.ts and ./server.ts rather than three private copies.
//
// One behaviour change, deliberate: the originals fell back to the anon key
// and then to the literal string 'placeholder' when SUPABASE_SERVICE_ROLE_KEY
// was missing. That turns a misconfigured deploy into silent, subtly-wrong
// RLS behaviour instead of an error. createAdminClient() throws instead.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from './admin'
import type { ToolKey } from './schemas'

export * from './schemas'
export { createAdminClient } from './admin'
export { createClient } from './server'

function lazyAdmin(tool: ToolKey): SupabaseClient {
  let instance: SupabaseClient | null = null
  const resolve = () => (instance ??= createAdminClient(tool) as unknown as SupabaseClient)

  return new Proxy({} as SupabaseClient, {
    get: (_, prop) => (resolve() as unknown as Record<string | symbol, unknown>)[prop],
  })
}

/** Service-role, `public` schema — Compass's own tables. */
export const supabaseAdmin = lazyAdmin('compass')

/** Service-role, `mrx` schema. Used by the shared patient-linking layer. */
export const supabaseMrx = lazyAdmin('mrx')

/** Service-role, `blood` schema. Used by the shared patient-linking layer. */
export const supabaseBlood = lazyAdmin('blood')

// NOTE: Compass also exported a plain anon-key `supabase`. It is deliberately
// NOT re-exported here. Aliasing it to the service-role client would silently
// escalate every RLS-limited call site; leaving it anon would keep a
// session-blind client in browser code. Its only two consumers
// (knowledge-base, sessions/[sessionId]) now use getBrowserClient() from
// ./client, which carries the logged-in clinician's session.
