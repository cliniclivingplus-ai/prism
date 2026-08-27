'use client'

// MicrobiomeRx's browser client. The tool's ~30 pages do
// `import { supabase } from '@/lib/mrx/supabase'` and then `supabase.from(...)`
// at module scope, so the shape is preserved — but construction now goes
// through the shared getBrowserClient('mrx') factory rather than MRX's own
// private createBrowserClient copy. Schema stays 'mrx'.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBrowserClient } from '@/lib/supabase/client'

export function getSupabaseClient() {
  return getBrowserClient('mrx')
}

export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) =>
    (getBrowserClient('mrx') as unknown as Record<string | symbol, unknown>)[prop],
})
