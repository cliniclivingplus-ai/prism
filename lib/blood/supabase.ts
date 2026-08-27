'use client'

// Blood Panel's browser client, delegating to the shared factory. Schema
// stays 'blood'; construction is no longer a private createBrowserClient copy.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getBrowserClient } from '@/lib/supabase/client'

export function getSupabaseClient() {
  return getBrowserClient('blood')
}

export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) =>
    (getBrowserClient('blood') as unknown as Record<string | symbol, unknown>)[prop],
})
