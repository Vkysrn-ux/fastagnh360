import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const session = req.cookies.get('user-session')?.value
  const url = req.nextUrl.clone()
  const isApi = url.pathname.startsWith('/api')
  const ERP_ONLY = process.env.ERP_ONLY === 'true'

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

  // Forward pathname so server layouts can conditionally render chrome
  const reqHeaders = new Headers(req.headers)
  reqHeaders.set('x-pathname', url.pathname)

  // ERP-only mode: block public site and route root to ERP login/dashboard
  if (ERP_ONLY) {
    const allowedRoots = ['/login', '/admin', '/agent', '/employee', '/user', '/api']
    const isAllowed = allowedRoots.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))
    if (!isAllowed) {
      // If session present, send to respective dashboard; else to login
      if (session) {
        try {
          const data = JSON.parse(session)
          const allowedPrefix = `/${data.userType}`
          url.pathname = `${allowedPrefix}/tickets`
          return NextResponse.redirect(url)
        } catch {}
      }
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // WhatsApp webhook is public — no session required
  if (url.pathname.startsWith('/api/whatsapp')) {
    return NextResponse.next({ request: { headers: reqHeaders } })
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

      // Special restriction: employees can only access /employee/tickets routes
      if (data.userType === 'employee') {
        const isTicketsRoute = url.pathname === '/employee/tickets' || url.pathname.startsWith('/employee/tickets/')
        const isLoginRoute = url.pathname === '/employee/login'
        if (!isTicketsRoute && !isLoginRoute) {
          const to = url.clone()
          to.pathname = '/employee/tickets'
          return NextResponse.redirect(to)
        }
      }

      if (url.pathname.startsWith(allowedPrefix)) {
        // If user hits the role root (e.g., /admin), send them to tickets by default
        if (url.pathname === allowedPrefix || url.pathname === `${allowedPrefix}/`) {
          const to = url.clone()
          to.pathname = `${allowedPrefix}/tickets`
          return NextResponse.redirect(to)
        }
        return NextResponse.next({ request: { headers: reqHeaders } })
      } else {
        url.pathname = `${allowedPrefix}/tickets`
        return NextResponse.redirect(url)
      }
    } catch {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next({ request: { headers: reqHeaders } })
}

// Run on all routes so x-pathname is always forwarded to layouts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
