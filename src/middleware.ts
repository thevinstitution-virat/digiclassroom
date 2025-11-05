import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { UserRole } from '@/lib/validations'

// Define route matchers using the correct Clerk approach
const isPublicRoute = createRouteMatcher([
  '/',
  '/about',
  '/contact',
  '/pricing',
  '/features',
  '/theme-test',
  '/api/webhook(.*)',
  '/api/health',
  '/api/ai/health',
  '/api/scan-books',
  '/api/test-ocr',

  '/test-auth',
])

const isAuthRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
])

// Define protected routes with required roles (cleaned up)
const protectedRoutes: Record<string, UserRole[]> = {
  '/api/admin': ['admin'],
  '/api/content/create': ['admin'],
  '/api/content/vectorize': ['admin'],
}

// Routes that don't require role checking (but still need authentication)
const authOnlyRoutes = [
  '/dashboard', // Dashboard router handles role assignment
  '/setup-role', // Role setup page - needs auth but no role
  '/role-assignment-pending', // Role assignment pending page
  '/api/assign-role', // Role assignment API
  '/api/debug', // Debug endpoint for troubleshooting
  '/api/ai/chat', // AI chat API - requires auth but no specific role
  '/api/teacher/register', // Teacher registration - needs auth but no approval
  '/api/teacher/status', // Teacher status check - needs auth but no approval
  '/dashboard/teacher/pending-approval', // Pending approval page for teachers
]

// Teacher routes that require approval
const teacherApprovedRoutes = [
  '/dashboard/teacher',
  '/api/teacher/classes',
  '/api/teacher/students',
  '/api/teacher/validation-queue',
]

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, sessionClaims } = await auth()
  const { pathname } = req.nextUrl

  // Special handling for API routes - return JSON errors instead of redirects
  const isApiRoute = pathname.startsWith('/api/')

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // Handle authentication routes
  if (isAuthRoute(req)) {
    if (userId) {
      // User is authenticated, redirect to dashboard for role processing
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // Require authentication for all other routes
  if (!userId) {
    if (isApiRoute) {
      // Return JSON error for API routes
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Get user role and tenant
  const metadata = sessionClaims?.metadata as Record<string, any> || {}
  const userRole = metadata.role as UserRole
  const tenantId = metadata.tenantId as string

  // Check if this is an auth-only route (doesn't require role)
  if (authOnlyRoutes.some(route => pathname.startsWith(route))) {
    // Allow access to auth-only routes even without role
    const response = NextResponse.next()
    response.headers.set('x-user-id', userId)
    if (userRole) {
      response.headers.set('x-user-role', userRole)
    }
    if (tenantId) {
      response.headers.set('x-tenant-id', tenantId)
    }
    return response
  }

  // B2C: Removed approval status check - all teachers get instant access
  // Teachers are now differentiated by verification_status (unverified/verified_email/verified_document)
  // Feature access is controlled by subscription tier and verification level, not approval status

  // Optional: Add verification status to request headers for downstream use
  if (teacherApprovedRoutes.some(route => pathname.startsWith(route))) {
    const verificationStatus = metadata.verificationStatus as string
    if (verificationStatus) {
      // Make verification status available to API routes and pages
      const response = NextResponse.next()
      response.headers.set('x-verification-status', verificationStatus)
      // Continue processing - no blocking based on verification status
    }
  }

  // Check if user has a role assigned for protected routes
  if (!userRole) {
    if (isApiRoute) {
      // Return JSON error for API routes when user has no role
      return NextResponse.json(
        { error: 'Role assignment required', message: 'Please complete your profile setup' },
        { status: 403 }
      )
    }
    // User doesn't have a role - redirect to dashboard for role assignment
    console.log(`User ${userId} has no role assigned, redirecting to dashboard for auto-assignment`)
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Check route-specific permissions
  const requiredRoles = getRequiredRoles(pathname)
  if (requiredRoles && !requiredRoles.includes(userRole)) {
    if (isApiRoute) {
      // Return JSON error for API routes when user lacks permission
      return NextResponse.json(
        { error: 'Insufficient permissions', message: 'Access denied for this resource' },
        { status: 403 }
      )
    }
    // User doesn't have permission, redirect to sign-in with error message
    return NextResponse.redirect(new URL('/sign-in?message=insufficient-permissions', req.url))
  }

  // Add user context to headers for server components
  const response = NextResponse.next()
  response.headers.set('x-user-id', userId)
  response.headers.set('x-user-role', userRole)
  if (tenantId) {
    response.headers.set('x-tenant-id', tenantId)
  }

  return response
})

// Helper function to get required roles for a route
function getRequiredRoles(pathname: string): UserRole[] | null {
  // Find exact match first
  if (protectedRoutes[pathname]) {
    return protectedRoutes[pathname]
  }

  // Find pattern match
  const matchingPattern = Object.keys(protectedRoutes).find(pattern =>
    pathname.startsWith(pattern)
  )

  return matchingPattern ? protectedRoutes[matchingPattern] : null
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
