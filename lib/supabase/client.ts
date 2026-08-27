'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SCHEMAS, type ToolKey } from './schemas'

// One browser client per schema, memoised. Replaces the three separate
// lib/supabase.ts copies in the source repos.
const cache = new Map<ToolKey, ReturnType<typeof createBrowserClient>>()

export function getBrowserClient(tool: ToolKey = 'compass') {
  const existing = cache.get(tool)
  if (existing) return existing

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: SCHEMAS[tool] } }
  )
  cache.set(tool, client)
  return client
}
