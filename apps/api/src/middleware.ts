import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// CORS for the headless API. The web app is served from a different subdomain
// (app.<domain>) and calls this API with credentials, so responses must echo an
// explicit allowed origin (never "*" when credentials are included) and answer
// preflight OPTIONS requests.
const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ||
  process.env.WEB_ORIGIN ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3001'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function applyCors(headers: Headers, origin: string | null): Headers {
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.append('Vary', 'Origin')
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    headers.set('Access-Control-Max-Age', '86400')
  }
  return headers
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: applyCors(new Headers(), origin) })
  }

  const res = NextResponse.next()
  applyCors(res.headers, origin)
  return res
}

export const config = {
  matcher: '/api/:path*',
}
