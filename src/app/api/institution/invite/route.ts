import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { withOrgContext, OrgRouteContext } from "@/lib/auth/with-org-context";
import { logger } from "@/lib/logger";
import { z } from "zod";

const InviteTeacherSchema = z.object({
  email: z.string().email(),
  role: z.enum(['teacher', 'org_admin', 'student']).default('student')
});

const BulkInviteSchema = z.object({
  invitations: z.array(z.object({
    email: z.string().email(),
    role: z.enum(['teacher', 'org_admin', 'student']).default('student')
  }))
});

// Better Auth's org plugin uses 'member' as the base role; our taxonomy calls it 'student'.
const toBetterAuthRole = (r: string) => (r === 'student' ? 'member' : r);

/**
 * POST /api/institution/invite
 * Invite a teacher or admin to the institution
 */
export const POST = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const body = await req.json();

    // Check if bulk invite
    if (body.invitations && Array.isArray(body.invitations)) {
      return handleBulkInvite(body, orgContext);
    }

    const data = InviteTeacherSchema.parse(body);

    // Use BetterAuth's organization invitation API
    const result: any = await auth.api.createInvitation({
      body: {
        organizationId: orgContext.orgId,
        email: data.email,
        role: toBetterAuthRole(data.role) as any,
      },
      headers: await headers()
    });

    logger.info(`Invitation sent to ${data.email} for org ${orgContext.orgId}`, {
      role: data.role,
      invitedBy: orgContext.userId
    });

    // A copyable joining link (works even if email delivery isn't configured).
    const inviteId = result?.id ?? result?.invitation?.id;
    const inviteLink = inviteId ? `${req.nextUrl.origin}/accept-invitation/${inviteId}` : null;

    return NextResponse.json({
      success: true,
      invitation: result,
      inviteLink,
    });
  } catch (error: any) {
    logger.error("Failed to send invitation", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }

    // BetterAuth may throw specific errors
    if (error?.message?.includes('already a member')) {
      return NextResponse.json({ error: "This user is already a member of this institution" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
}, { requireOrg: true, orgRoles: ['owner', 'org_admin'] });

/**
 * Handle bulk teacher invitations
 */
async function handleBulkInvite(body: any, orgContext: OrgRouteContext) {
  try {
    const data = BulkInviteSchema.parse(body);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const invite of data.invitations) {
      try {
        await auth.api.createInvitation({
          body: {
            organizationId: orgContext.orgId,
            email: invite.email,
            role: toBetterAuthRole(invite.role) as any,
          },
          headers: new Headers()
        });
        sent++;
      } catch (err: any) {
        failed++;
        errors.push(`${invite.email}: ${err?.message || 'Failed'}`);
      }
    }

    logger.info(`Bulk invitation: ${sent} sent, ${failed} failed for org ${orgContext.orgId}`);

    return NextResponse.json({
      success: true,
      summary: { total: data.invitations.length, sent, failed },
      errors: errors.slice(0, 50)
    });
  } catch (error) {
    logger.error("Bulk invitation failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
