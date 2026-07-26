import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
        // @ts-ignore
import { institutionSections } from "@/db/schema";
import { withOrgContext, OrgRouteContext } from "@/lib/auth/with-org-context";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { z } from "zod";

const CreateSectionSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1).max(100)
});

/**
 * POST /api/institution/sections
 * Create a new section under a class
 */
export const POST = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const body = await req.json();
    const data = CreateSectionSchema.parse(body);

    await db.insert(institutionSections).values({
      id: crypto.randomUUID(),
      organizationId: orgContext.orgId,
      classId: data.classId,
      name: data.name
    });

    return NextResponse.json({ success: true });
  } catch (error) {
        // @ts-ignore
    logger.error("Failed to create section", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireOrg: true, orgRoles: ['owner', 'org_admin'] });

/**
 * DELETE /api/institution/sections?id=xxx
 */
export const DELETE = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "Missing section ID" }, { status: 400 });

    await db.delete(institutionSections).where(
      and(eq(institutionSections.id, id), eq(institutionSections.organizationId, orgContext.orgId))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
        // @ts-ignore
    logger.error("Failed to delete section", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireOrg: true, orgRoles: ['owner', 'org_admin'] });
