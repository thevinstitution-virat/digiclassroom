/**
 * Shared cross-repo curriculum taxonomy -- proxies the Vidyaverse-hosted Taxonomy
 * Service's tree so the admin book-tagging UI can render a picker without exposing
 * the hub's API key to the browser.
 * GET /api/super-admin/taxonomy/tree?domain=school
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformStaff } from '@/lib/auth/require-platform-staff';
import { getTaxonomyTree } from '@/lib/taxonomy/client';

export async function GET(request: NextRequest) {
  const guard = await requirePlatformStaff();
  if (!guard.ok) return guard.response;

  const domain = request.nextUrl.searchParams.get('domain');
  if (!domain) {
    return NextResponse.json({ success: false, error: 'domain query parameter is required' }, { status: 400 });
  }

  const tree = await getTaxonomyTree(domain);
  return NextResponse.json({ success: true, data: tree });
}
