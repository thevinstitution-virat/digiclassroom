// src/app/dashboard/page.tsx
// Server component — resolves the correct dashboard for each role and redirects.
// Replaces the previous client-side or switch(role) redirect logic.

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

/** redirect() signals via a thrown Error with a `NEXT_REDIRECT`-prefixed digest — not a real failure. */
function isNextRedirectError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'digest' in err &&
    typeof (err as { digest: unknown }).digest === 'string' &&
    (err as { digest: string }).digest.startsWith('NEXT_REDIRECT');
}

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
    } else {
      // Any non-2xx (401, 403, 404, 500, ...) means we could not confirm an
      // authenticated session. Fail closed to sign-in — the previous code only
      // did this for a clean 401 and silently defaulted to /dashboard/user
      // for everything else, which is indistinguishable from "authenticated
      // as a student" to anyone reading the network tab.
      redirect('/sign-in');
    }
  } catch (err) {
    if (isNextRedirectError(err)) throw err; // redirect() throws internally — let it propagate
    // Network error or /api/me unreachable: fail closed, not open.
    redirect('/sign-in');
  }

  redirect(dashboard);
}
