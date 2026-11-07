import { auth } from '@/auth';
import { isPlatformStaff, type Role } from '@/auth/permissions';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getContentPool } from '@/lib/db/content-connection';
import { listWorks } from '@/lib/db/content-works';

/**
 * GET /api/super-admin/content/works?q=<text>
 *
 * The books (works) in the shared content spine, with the chapters each already has, so the upload page can ask the
 * super-admin WHICH BOOK a set of chapters belongs to instead of guessing it from a file.
 *
 * `q` filters on title or ISBN (hyphens in the search are ignored for the ISBN). At most 200 books are returned. The
 * query itself lives in lib/db/content-works.ts, where it is run against a real Postgres by
 * scripts/verify-content-works.mjs.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!isPlatformStaff((session.user.role ?? '') as Role)) {
      return NextResponse.json({ success: false, error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const works = await listWorks(getContentPool(), request.nextUrl.searchParams.get('q') ?? '');
    return NextResponse.json({ success: true, works });
  } catch (error) {
    console.error('❌ Listing books failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Could not list books' },
      { status: 500 },
    );
  }
}
