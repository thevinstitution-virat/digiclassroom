import { createTRPCRouter, superAdminProcedure } from '../server';
import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq, count, desc, sql } from 'drizzle-orm';

export const superAdminAnalyticsRouter = createTRPCRouter({
  getPlatformStats: superAdminProcedure.query(async () => {
    // Total Institutions (from institutionProfiles)
    const [instResult] = await db
      .select({ count: count() })
      .from(schema.institutionProfiles);

    // Total Students
    const [studentResult] = await db
      .select({ count: count() })
      .from(schema.member)
      .where(eq(schema.member.role, 'student'));

    // Total Active Batches
    const [batchResult] = await db
      .select({ count: count() })
      .from(schema.batches)
      .where(eq(schema.batches.isActive, true));

    // Total Video Assets
    const [videoResult] = await db
      .select({ count: count() })
      .from(schema.videoAssets);

    return {
      totalInstitutions: instResult.count,
      totalStudents: studentResult.count,
      totalBatches: batchResult.count,
      totalVideos: videoResult.count,
    };
  }),

  getInstitutionBreakdown: superAdminProcedure.query(async () => {
    // Institutions list
    const insts = await db
      .select({
        id: schema.organization.id,
        name: schema.organization.name,
        type: schema.institutionProfiles.type,
      })
      .from(schema.organization)
      .innerJoin(schema.institutionProfiles, eq(schema.organization.id, schema.institutionProfiles.organizationId));

    // Get batch counts per org
    const batchCounts = await db
      .select({
        orgId: schema.batches.orgId,
        count: count()
      })
      .from(schema.batches)
      .where(eq(schema.batches.isActive, true))
      .groupBy(schema.batches.orgId);

    // Get student counts per org
    const studentCounts = await db
      .select({
        orgId: schema.member.organizationId,
        count: count()
      })
      .from(schema.member)
      .where(eq(schema.member.role, 'student'))
      .groupBy(schema.member.organizationId);

    return insts.map(inst => {
      const bCount = batchCounts.find(b => b.orgId === inst.id)?.count || 0;
      const sCount = studentCounts.find(s => s.orgId === inst.id)?.count || 0;
      return {
        ...inst,
        activeBatches: bCount,
        totalStudents: sCount,
      };
    }).sort((a, b) => b.totalStudents - a.totalStudents);
  }),

  getTopContent: superAdminProcedure.query(async () => {
    // Top batches by enrollment count
    const topBatches = await db
      .select({
        id: schema.batches.id,
        name: schema.batches.name,
        orgName: schema.organization.name,
        enrollmentCount: count(schema.enrollments.id)
      })
      .from(schema.batches)
      .leftJoin(schema.organization, eq(schema.batches.orgId, schema.organization.id))
      .leftJoin(schema.enrollments, eq(schema.batches.id, schema.enrollments.batchId))
      .groupBy(schema.batches.id, schema.batches.name, schema.organization.name)
      .orderBy(desc(count(schema.enrollments.id)))
      .limit(10);

    return topBatches;
  }),

  getRevenueAnalytics: superAdminProcedure.query(async () => {
    const [monthly, byOrg] = await Promise.all([
      // ── Monthly aggregates (last 12 months) ─────────────────────────────
      db
        .select({
          month:                sql<string>`DATE_FORMAT(${schema.payments.capturedAt}, '%Y-%m')`.as('month'),
          totalRevenuePaise:    sql<number>`SUM(${schema.orders.amountPaise})`.as('totalRevenuePaise'),
          platformFeePaise:     sql<number>`SUM(${schema.orders.platformFeePaise})`.as('platformFeePaise'),
          institutionPaise:     sql<number>`SUM(${schema.orders.institutionPaise})`.as('institutionPaise'),
          paymentCount:         sql<number>`COUNT(${schema.payments.id})`.as('paymentCount'),
        })
        .from(schema.payments)
        .innerJoin(schema.orders, eq(schema.orders.id, schema.payments.orderId))
        .where(eq(schema.payments.status, 'captured'))
        .groupBy(sql`DATE_FORMAT(${schema.payments.capturedAt}, '%Y-%m')`)
        .orderBy(sql`month DESC`)
        .limit(12),

      // ── By-institution totals ────────────────────────────────────────────
      db
        .select({
          orgId:             schema.orders.orgId,
          orgName:           schema.organization.name,
          totalRevenuePaise: sql<number>`SUM(${schema.orders.amountPaise})`.as('totalRevenuePaise'),
          platformFeePaise:  sql<number>`SUM(${schema.orders.platformFeePaise})`.as('platformFeePaise'),
          paymentCount:      sql<number>`COUNT(${schema.payments.id})`.as('paymentCount'),
        })
        .from(schema.payments)
        .innerJoin(schema.orders, eq(schema.orders.id, schema.payments.orderId))
        .innerJoin(schema.organization, eq(schema.organization.id, schema.orders.orgId))
        .where(eq(schema.payments.status, 'captured'))
        .groupBy(schema.orders.orgId, schema.organization.name)
        .orderBy(sql`totalRevenuePaise DESC`)
        .limit(50),
    ])

    // Derive all-time totals from the monthly data (already filtered to captured)
    const allTime = {
      revenuePaise:    byOrg.reduce((s, r) => s + Number(r.totalRevenuePaise), 0),
      platformPaise:   byOrg.reduce((s, r) => s + Number(r.platformFeePaise), 0),
      paymentCount:    byOrg.reduce((s, r) => s + Number(r.paymentCount), 0),
    }

    const thisMonthKey = new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
    const thisMonth = monthly.find(r => r.month === thisMonthKey)

    return {
      allTime,
      thisMonth: {
        revenuePaise: Number(thisMonth?.totalRevenuePaise ?? 0),
        paymentCount: Number(thisMonth?.paymentCount ?? 0),
      },
      monthly: [...monthly].reverse(),   // chronological for the chart
      byOrg,
    }
  }),
});
