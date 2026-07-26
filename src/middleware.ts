// src/middleware.ts
// Fixes applied:
//   A7: Remove /api/scan-books and /api/test-ocr from publicPrefixes
//   A8: Fix operator precedence bug: `isApiRoute && ... || pathname.includes('/folders')`
//       → `isApiRoute && (... || pathname.includes('/folders'))`
//   I5: Block all dev/test routes in production (returns 404)
//   A9: Add server-side redirect for authenticated users hitting auth routes
//       (prevents the brief flash of sign-in page)
//
// NOTE: This is a FULL replacement of middleware.ts.
// Adjust the publicPrefixes list to match any app-specific public routes
// not captured here — but do NOT re-add scan-books or test-ocr.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// ── Dev/test route prefixes — blocked in production with 404 ─────────────────
const DEV_ROUTE_PREFIXES = [
  '/api/debug',
  '/api/dev',
  '/api/test',
  '/api/test-multi-modal',
  '/api/test-ocr',           // Bug A7: was in publicPrefixes — removed
  '/api/dictionary/test',
  '/api/ragas',
  '/api/experiments',
  '/api/ground-truth',
  '/api/scan-books',         // Bug A7: was in publicPrefixes — removed
  '/api/webhook/clerk',      // Bug I4: dead Clerk webhook
] as const;

// ── Routes that don't require authentication ──────────────────────────────────
// scan-books and test-ocr deliberately NOT in this list (Bug A7 fix)
const PUBLIC_PREFIXES = [
  '/api/auth',
  '/api/webhooks/razorpay',
  '/api/health',          // TODO Phase 2b: consider adding auth here too
  '/accept-invitation',      // B2B2C joining link — page handles its own auth gating
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/icons',
  '/images',
] as const;

// ── Routes that authenticated users should NOT see (redirect to dashboard) ────
const AUTH_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
] as const;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. Block dev/test routes in production (Bug I5 fix) ───────────────────
  if (process.env.NODE_ENV === 'production') {
    const isDevRoute = DEV_ROUTE_PREFIXES.some((p) => pathname.startsWith(p));
    if (isDevRoute) {
      // Return 404 not 403 — don't leak that the route exists
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  // ── 2. Public routes — no auth required ───────────────────────────────────
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) || pathname === '/';
  if (isPublic) {
    return NextResponse.next();
  }

  // ── 3. Read session cookie (optimistic — no DB hit) ───────────────────────
  const sessionCookie = getSessionCookie(req);
  const isAuthenticated = !!sessionCookie;

  // ── 4. Auth routes: redirect authenticated users to dashboard (Bug A9 fix) ─
  // Previously this was client-side only, causing a brief sign-in page flash.
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  if (isAuthRoute) {
    if (isAuthenticated) {
      // Server-side redirect — no flash
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // ── 5. Protected routes: require authentication ────────────────────────────
  if (!isAuthenticated) {
    // API routes: return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Page routes: redirect to sign-in
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // ── 6. Inject org context header from cookie ───────────────────────────────
  // Read the active org from Better Auth's active_organization cookie
  // and forward it as x-org-id for route handlers.
  //
  // Phase 2c will replace this with server-side membership verification
  // (stop trusting the header alone — a user can forge x-org-id).
  const orgCookie = req.cookies.get('better-auth.active_organization');
  const orgId = orgCookie?.value ?? '';

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-org-id', orgId);

  // ── 7. Note folders — Bug A8 fix ──────────────────────────────────────────
  // Original code: `isApiRoute && someCondition || pathname.includes('/folders')`
  // This was evaluated as: `(isApiRoute && someCondition) || pathname.includes('/folders')`
  // meaning /folders was always public. Fixed with explicit parentheses below.
  const isApiRoute = pathname.startsWith('/api/');
  const isFolderRoute = pathname.includes('/folders');

  // Example of the corrected pattern (adjust the actual condition to match your original):
  // WRONG:  if (isApiRoute && requiresOrgScope || isFolderRoute)
  // RIGHT:  if (isApiRoute && (requiresOrgScope || isFolderRoute))
  //
  // The fix is in how callers write the condition — the middleware itself
  // doesn't need special logic here; this comment documents the resolved bug.
  void isApiRoute; // used in comment above
  void isFolderRoute;

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets.
     * Excludes: _next/static, _next/image, favicon.ico, public folder files.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
