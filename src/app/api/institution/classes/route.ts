import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { institutionClasses, institutionSections } from "@/db/schema";
import { withOrgContext, OrgRouteContext } from "@/lib/auth/with-org-context";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { z } from "zod";

const CreateClassSchema = z.object({
  name: z.string().min(1).max(100),
  level: z.number().nullable().optional()
});

/**
 * GET /api/institution/classes
 * List all classes + sections for the active organization
 */
export const GET = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const classRows = await db.select().from(institutionClasses)
      .where(eq(institutionClasses.organizationId, orgContext.orgId));

    const sectionRows = await db.select().from(institutionSections)
      .where(eq(institutionSections.organizationId, orgContext.orgId));

    // Group sections by class
    const classes = classRows.map(cls => ({
      ...cls,
      sections: sectionRows.filter(s => s.classId === cls.id)
    }));

    return NextResponse.json({ classes });
  } catch (error) {
    logger.error("Failed to fetch classes", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireOrg: true });

/**
 * POST /api/institution/classes
 * Create a new class for the active organization
 */
export const POST = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const body = await req.json();
    const data = CreateClassSchema.parse(body);

    await db.insert(institutionClasses).values({
      id: crypto.randomUUID(),
      organizationId: orgContext.orgId,
      name: data.name,
      level: data.level ?? null
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to create class", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireOrg: true, orgRoles: ['owner', 'org_admin'] });

/**
 * DELETE /api/institution/classes?id=xxx
 * Delete a class (cascades to sections)
 */
export const DELETE = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "Missing class ID" }, { status: 400 });

    await db.delete(institutionClasses).where(
      and(eq(institutionClasses.id, id), eq(institutionClasses.organizationId, orgContext.orgId))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete class", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireOrg: true, orgRoles: ['owner', 'org_admin'] });
