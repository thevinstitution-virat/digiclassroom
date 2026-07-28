import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { enrollments, user as userTable, batches, studentVideoProgress, videoAssets } from "@/db/schema";
import { withOrgContext, OrgRouteContext } from "@/lib/auth/with-org-context";
import { eq, and, isNull, or, sql, gte } from "drizzle-orm";
import { COMPLETION_THRESHOLD } from "@/lib/constants";

export const GET = withOrgContext(async (req: NextRequest, ctx: any, orgContext: OrgRouteContext) => {
  try {
    const batchId = ctx.params?.batchId;
    if (!batchId) {
      return new NextResponse("Missing batch ID", { status: 400 });
    }

    // Verify batch ownership
    const [batch] = await db.select()
      .from(batches)
      .where(and(eq(batches.id, batchId), eq(batches.orgId, orgContext.orgId)))
      .limit(1);

    if (!batch) {
      return new NextResponse("Batch not found or access denied", { status: 404 });
    }

    // Fetch enrollments with user data
    const enrolledStudents = await db.select({
      id: enrollments.id,
      userId: userTable.id,
      name: userTable.name,
      email: userTable.email,
      status: enrollments.status,
      enrolledAt: enrollments.enrolledAt,
    })
    .from(enrollments)
    .innerJoin(userTable, eq(enrollments.userId, userTable.id))
    .where(and(eq(enrollments.batchId, batchId), eq(enrollments.orgId, orgContext.orgId)));

    // Total videos for this batch's level
    const [{ videoCount }] = await db
      .select({ videoCount: sql<number>`COUNT(*)` })
      .from(videoAssets)
      .where(
        and(
          eq(videoAssets.level, batch.levelId),
          or(eq(videoAssets.tenantId, orgContext.orgId), isNull(videoAssets.tenantId))
        )
      );
      
    const totalVideos = Number(videoCount);

    // Get completed videos count for all students in this batch's level
    const userProgress = await db.select({
      userId: studentVideoProgress.userId,
      completedCount: sql<number>`COUNT(*)`,
    })
    .from(studentVideoProgress)
    .innerJoin(videoAssets, eq(videoAssets.id, studentVideoProgress.videoId))
    .where(
      and(
        eq(videoAssets.level, batch.levelId),
        or(eq(videoAssets.tenantId, orgContext.orgId), isNull(videoAssets.tenantId)),
        gte(studentVideoProgress.completionPercentage, COMPLETION_THRESHOLD.toFixed(2))
      )
    )
    .groupBy(studentVideoProgress.userId);

    const progressMap = new Map<string, number>();
    for (const p of userProgress) {
      progressMap.set(p.userId, Number(p.completedCount));
    }

    // Build CSV content
    const csvRows = [
      ['Name', 'Email', 'Status', 'Enrolled At', 'Progress %']
    ];

    for (const student of enrolledStudents) {
      const completedCount = progressMap.get(student.userId) || 0;
      const progressPct = totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;
      
      csvRows.push([
        `"${student.name.replace(/"/g, '""')}"`,
        student.email,
        student.status,
        student.enrolledAt ? student.enrolledAt.toISOString().split('T')[0] : '',
        `${progressPct}%`
      ]);
    }

    const csvContent = csvRows.map(row => row.join(',')).join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="batch-${batch.id}-roster.csv"`,
      },
    });

  } catch (error) {
    console.error("Failed to export batch roster", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}, { requireOrg: true, orgRoles: ['owner', 'org_admin'] });
