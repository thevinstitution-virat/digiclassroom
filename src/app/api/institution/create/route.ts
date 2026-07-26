import { NextRequest, NextResponse } from "next/server";
import { InstitutionService } from "@/lib/services/institution-service";
import { withOrgContext, OrgRouteContext } from "@/lib/auth/with-org-context";
import { z } from "zod";
import { logger } from "@/lib/logger";

const CreateInstitutionSchema = z.object({
  name: z.string().min(3),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  type: z.enum(['school', 'college', 'tuition_center'])
});

/**
 * POST /api/institution/create
 * Provision a new institution (organization). Platform-staff action:
 * only super_admin / admin may create institutions (mirrors Better Auth
 * `allowUserToCreateOrganization` in auth/index.ts). Platform staff bypass
 * the org gate; everyone else is rejected by the global-role check.
 */
export const POST = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const body = await req.json();
    const validatedData = CreateInstitutionSchema.parse(body);

    const organization = await InstitutionService.createInstitution({
      name: validatedData.name,
      slug: validatedData.slug,
      type: validatedData.type,
      userId: orgContext.userId
    });

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    logger.error("Failed to create institution API", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireOrg: false, roles: ['super_admin', 'admin'] });
