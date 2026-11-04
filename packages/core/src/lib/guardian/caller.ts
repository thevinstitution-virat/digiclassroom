// Who is calling, for the guardian endpoints: the signed-in user, their global role, and (when they are working inside an institution)
// their membership role there. Same organisation rule as the handwritten-assignments actor: the x-org-id header, else the session's active institution.

import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { member } from '@/db/schema';
import { HwError } from '@/lib/hw/errors';
import type { Caller } from './onboarding';

export async function resolveCaller(headers: Headers): Promise<Caller> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new HwError('UNAUTHORIZED', 'Please sign in.');
  const u = session.user as { id: string; email: string; emailVerified?: boolean; role?: string | null };
  const orgId = ((headers.get('x-org-id') ?? '').trim() || ((session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? '').trim()) || null;
  let orgRole: string | null = null;
  if (orgId) {
    const [m] = await db.select({ role: member.role }).from(member).where(and(eq(member.userId, u.id), eq(member.organizationId, orgId))).limit(1);
    orgRole = m?.role ?? null;
  }
  return { userId: u.id, email: u.email, emailVerified: u.emailVerified !== false, globalRole: u.role ?? 'student', orgId, orgRole };
}
