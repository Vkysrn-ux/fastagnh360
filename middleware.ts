import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const session = req.cookies.get('user-session')?.value
  const url = req.nextUrl.clone()
  const isApi = url.pathname.startsWith('/api')

  // Always allow Next internals and static assets
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/static') ||
    url.pathname.startsWith('/favicon.ico') ||
    url.pathname.startsWith('/robots.txt') ||
    url.pathname.startsWith('/sitemap.xml')
  ) {
    return NextResponse.next()
  }

  // If hitting API without a session -> 401 JSON
  if (isApi) {
    // Allow CORS preflight to pass through
    if (req.method === 'OPTIONS') {
      return NextResponse.next()
    }

    // Support non-expiring API key via header
    const configuredKey = process.env.API_KEY?.trim()
    const providedKey = req.headers.get('x-api-key')?.trim()
    if (configuredKey && providedKey && providedKey === configuredKey) {
      // Attach a service identifier for downstream logging
      const newHeaders = new Headers(req.headers)
      newHeaders.set('x-user-id', 'api-key')
      return NextResponse.next({ request: { headers: newHeaders } })
    }

    if (!session) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      })
    }
    // Attach user id (if present) for server-side logging/attribution
    try {
      const data = JSON.parse(session)
      const newHeaders = new Headers(req.headers)
      if (data?.id) newHeaders.set('x-user-id', String(data.id))
      return NextResponse.next({ request: { headers: newHeaders } })
    } catch {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      })
    }
  }

  // Guard app pages by role
  const protectedPrefixes = ['/admin', '/agent', '/employee', '/user']
  const isProtected = protectedPrefixes.some(prefix => url.pathname.startsWith(prefix))

  if (isProtected) {
    if (!session) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    try {
      const data = JSON.parse(session) // expects: { userType: 'admin' | 'agent' | ... }
      const allowedPrefix = `/${data.userType}`
      if (url.pathname.startsWith(allowedPrefix)) {
        return NextResponse.next()
      } else {
        url.pathname = `${allowedPrefix}/dashboard`
        return NextResponse.redirect(url)
      }
    } catch {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

// Protect pages under role paths and all API routes
export const config = {
  matcher: [
    '/admin/:path*',
    '/agent/:path*',
    '/employee/:path*',
    '/user/:path*',
    '/api/:path*',
  ]
}
