import { auth } from '@/auth';
import { isPlatformStaff, type Role } from '@/auth/permissions';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
/**
 * GET /api/super-admin/materials/google-drive/callback
 * OAuth callback endpoint for Google Drive authorization
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url))
    }

    const userRole = session?.user?.role
    if (!isPlatformStaff((userRole ?? '') as Role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Get the authorization code from query parameters
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')

    if (error) {
      // Handle OAuth error
      const errorDescription = url.searchParams.get('error_description') || 'Unknown error'
      const redirectUrl = new URL('/dashboard/super-admin/materials', request.url)
      redirectUrl.searchParams.set('error', `OAuth Error: ${errorDescription}`)
      return NextResponse.redirect(redirectUrl)
    }

    if (!code) {
      // No authorization code received
      const redirectUrl = new URL('/dashboard/super-admin/materials', request.url)
      redirectUrl.searchParams.set('error', 'No authorization code received')
      return NextResponse.redirect(redirectUrl)
    }

    // Redirect back to admin materials page with the authorization code
    const redirectUrl = new URL('/dashboard/super-admin/materials', request.url)
    redirectUrl.searchParams.set('code', code)
    redirectUrl.searchParams.set('tab', 'settings')
    redirectUrl.searchParams.set('success', 'Authorization code received. Please complete the setup in the Settings tab.')

    return NextResponse.redirect(redirectUrl)

  } catch (error) {
    console.error('Error in Google Drive OAuth callback:', error)
    
    // Redirect to admin materials page with error
    const redirectUrl = new URL('/dashboard/super-admin/materials', request.url)
    redirectUrl.searchParams.set('error', 'OAuth callback failed. Please try again.')
    return NextResponse.redirect(redirectUrl)
  }
}
