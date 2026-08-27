import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SCHEMAS, type ToolKey } from './schemas'

// Cookie-aware server client for server components and route handlers.
// Carries the caller's session, so RLS applies as the logged-in user.
export async function createClient(tool: ToolKey = 'compass') {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: SCHEMAS[tool] },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component render pass can't set cookies; middleware
            // already refreshes the session on every matched request.
          }
        },
      },
    }
  )
}
