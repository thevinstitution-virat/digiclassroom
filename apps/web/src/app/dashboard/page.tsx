// src/app/dashboard/page.tsx
// Server component — resolves the correct dashboard for each role and redirects.
// Replaces the previous client-side or switch(role) redirect logic.

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/**
 * Dashboard router.
 * Calls /api/me (which runs getOrgContext() server-side) to get the
 * authoritative dashboard target, then redirects.
 *
 * Role → dashboard:
 *   super_admin / admin          → /dashboard/super-admin
 *   orgRole: owner / org_admin   → /dashboard/institution
 *   teacher                      → /dashboard/teacher
 *   student / parent / default   → /dashboard/user
 */
export default async function DashboardPage() {
  // Forward the cookies/headers so the API route gets the session
  const incomingHeaders = await headers();
  const cookie = incomingHeaders.get('cookie') ?? '';

  let dashboard: string = '/dashboard/user';

  try {
    // Use absolute URL with the host header so fetch works in server components
    const host = incomingHeaders.get('host') ?? 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';

    const res = await fetch(`${protocol}://${host}/api/me`, {
      headers: {
        cookie,
        'x-org-id': incomingHeaders.get('x-org-id') ?? '',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      dashboard = data.dashboard ?? '/dashboard/user';
    } else if (res.status === 401) {
      // Not authenticated — send to sign-in
      redirect('/sign-in');
    }
  } catch {
    // Network error or /api/me unavailable — safe fallback
    dashboard = '/dashboard/user';
  }

  redirect(dashboard);
}
