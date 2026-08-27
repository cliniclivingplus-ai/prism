import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Everything is gated by default. A path is public only if it matches one of
// these — the inverse of the source repos, where /api/* was exempt wholesale.
//
//   /login      the only unauthenticated page (self-serve signup is retired)
//   /share/*    patient-facing share links (capability URLs, see lib/share)
//   /api/share/*  the read + check-off endpoints those pages call
//
// Anything added outside this list is authenticated automatically.
const PUBLIC_PATHS: RegExp[] = [
  /^\/login(?:\/|$)/,
  /^\/share(?:\/|$)/,
  /^\/api\/share(?:\/|$)/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  // pdf.js worker for the MicrobiomeRx report viewer. A static script with no
  // data in it, served from public/. Listed explicitly rather than exempting
  // every path with a file extension, which would be a much broader hole.
  /^\/pdf\.worker\.min\.mjs$/,
]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((re) => re.test(pathname))
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() over getSession(): it revalidates the JWT against the auth
  // server rather than trusting the cookie, which is what you want at the
  // gate. (getSession() stays fine for reading an already-verified session
  // further in.) This is the confirmed convention for the merged app.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublic(pathname)) {
    // API callers get a 401 they can act on, not an HTML redirect.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}
