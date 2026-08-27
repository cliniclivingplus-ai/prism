import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/auth/middleware'

// Next 16 renamed the `middleware` file convention to `proxy`. The gating
// logic itself still lives in lib/auth/middleware.ts, per the target layout.
export default async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
