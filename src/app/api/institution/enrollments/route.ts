import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
        // @ts-ignore
import { studentEnrollments, user as userTable } from "@/db/schema";
import { withOrgContext, OrgRouteContext } from "@/lib/auth/with-org-context";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { z } from "zod";

const EnrollStudentSchema = z.object({
  userId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().optional(),
  rollNumber: z.string().optional(),
  academicYear: z.string().optional()
});

const BulkEnrollSchema = z.object({
  students: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    classId: z.string().min(1),
    sectionId: z.string().optional(),
    rollNumber: z.string().optional()
  })),
  academicYear: z.string().optional()
});

/**
 * GET /api/institution/enrollments
 * List all student enrollments for the active organization
 */
export const GET = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');
    const sectionId = searchParams.get('sectionId');

    let query = db.select().from(studentEnrollments)
      .where(eq(studentEnrollments.organizationId, orgContext.orgId));

    // Additional filtering handled in application layer for simplicity
    const rows = await query;

    const filtered = rows.filter(r => {
      if (classId && r.classId !== classId) return false;
      if (sectionId && r.sectionId !== sectionId) return false;
      return true;
    });

    return NextResponse.json({ enrollments: filtered, total: filtered.length });
  } catch (error) {
        // @ts-ignore
    logger.error("Failed to fetch enrollments", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireOrg: true });

/**
 * POST /api/institution/enrollments
 * Enroll a single student
 */
export const POST = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const body = await req.json();

    // Check if this is a bulk enrollment request
    if (body.students && Array.isArray(body.students)) {
      return handleBulkEnroll(body, orgContext);
    }

    const data = EnrollStudentSchema.parse(body);

    await db.insert(studentEnrollments).values({
      id: crypto.randomUUID(),
      organizationId: orgContext.orgId,
      userId: data.userId,
      classId: data.classId,
      sectionId: data.sectionId || null,
      rollNumber: data.rollNumber || null,
      academicYear: data.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    });

    return NextResponse.json({ success: true });
  } catch (error) {
        // @ts-ignore
    logger.error("Failed to enroll student", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireOrg: true, orgRoles: ['owner', 'org_admin'] });

/**
 * DELETE /api/institution/enrollments?id=xxx
 */
export const DELETE = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "Missing enrollment ID" }, { status: 400 });

    await db.delete(studentEnrollments).where(
      and(eq(studentEnrollments.id, id), eq(studentEnrollments.organizationId, orgContext.orgId))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
        // @ts-ignore
    logger.error("Failed to delete enrollment", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireOrg: true, orgRoles: ['owner', 'org_admin'] });

/**
 * Handle bulk enrollment from CSV import
 * Processes students in batches of 500 for scale
 */
async function handleBulkEnroll(body: any, orgContext: OrgRouteContext) {
  try {
    const data = BulkEnrollSchema.parse(body);
    const BATCH_SIZE = 500;
    const academicYear = data.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    let enrolled = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process in batches
    for (let i = 0; i < data.students.length; i += BATCH_SIZE) {
      const batch = data.students.slice(i, i + BATCH_SIZE);

      const values = batch.map(student => ({
        id: crypto.randomUUID(),
        organizationId: orgContext.orgId,
        userId: '', // Will be resolved or created
        classId: student.classId,
        sectionId: student.sectionId || null,
        rollNumber: student.rollNumber || null,
        academicYear
      }));

      // For each student in the batch, try to find existing user by email
      for (let j = 0; j < batch.length; j++) {
        try {
          const existingUsers = await db.select().from(userTable)
            .where(eq(userTable.email, batch[j].email));

          if (existingUsers.length > 0) {
            values[j].userId = existingUsers[0].id;
          } else {
            // Skip students who don't have accounts yet - they'll be enrolled on signup
            skipped++;
            errors.push(`${batch[j].email}: No account found, skipped`);
            continue;
          }

          await db.insert(studentEnrollments).values(values[j]);
          enrolled++;
        } catch (err: any) {
          if (err?.code === 'ER_DUP_ENTRY') {
            skipped++;
            errors.push(`${batch[j].email}: Already enrolled for ${academicYear}`);
          } else {
            errors.push(`${batch[j].email}: ${err?.message || 'Unknown error'}`);
          }
        }
      }
    }

    logger.info(`Bulk enrollment complete: ${enrolled} enrolled, ${skipped} skipped`, {
      orgId: orgContext.orgId,
      total: data.students.length
    });

    return NextResponse.json({
      success: true,
      summary: { total: data.students.length, enrolled, skipped, errorCount: errors.length },
      errors: errors.slice(0, 50) // Cap error list
    });
  } catch (error) {
        // @ts-ignore
    logger.error("Bulk enrollment failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid CSV data", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
