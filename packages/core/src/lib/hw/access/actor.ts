// Resolves who is calling and in which institution, for every hw endpoint.
//
// Why not ctx.tenantId: on main, tRPC's tenantId is read from a user field that does not
// exist, so it is always 'default'. And tRPC requests go straight from the browser to the
// API subdomain, where nothing sets x-org-id. So the institution is taken from the
// x-org-id header when present, else from the session's activeOrganizationId (server-side,
// set by Better Auth), and is honoured ONLY after a (userId, orgId) membership check.

import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { member } from '@/db/schema';
import { HwError } from '../errors';
import { roleFromMember, type HwActor } from './policy';

export async function resolveHwActor(headers: Headers): Promise<HwActor> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new HwError('UNAUTHORIZED', 'Please sign in.');

  const userId = session.user.id;
  const globalRole = (session.user as { role?: string | null }).role ?? 'student';
  const headerOrg = (headers.get('x-org-id') ?? '').trim();
  const sessionOrg = ((session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? '').trim();
  let orgId = headerOrg || sessionOrg;

  if (globalRole === 'super_admin') {
    if (!orgId) throw new HwError('FORBIDDEN', 'Choose an institution first.');
    return { userId, orgId, role: 'admin', isPlatformStaff: true };
  }

  let memberRole: string | null = null;
  if (orgId) {
    const [row] = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
      .limit(1);
    if (!row) throw new HwError('FORBIDDEN', 'You are not a member of this institution.');
    memberRole = row.role;
  } else {
    // Nothing selected: someone in exactly one institution is in that one. Several -> they choose.
    const rows = await db.select({ orgId: member.organizationId, role: member.role }).from(member).where(eq(member.userId, userId)).limit(2);
    if (rows.length !== 1) {
      throw new HwError('FORBIDDEN', 'Handwritten assignments are available inside an institution. Choose your institution first.');
    }
    orgId = rows[0].orgId;
    memberRole = rows[0].role;
  }

  const role = roleFromMember(memberRole);
  if (role === 'none') throw new HwError('FORBIDDEN', 'Your role in this institution has no access to assignments.');
  return { userId, orgId, role, isPlatformStaff: false };
}
