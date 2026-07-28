import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, or, inArray, isNull, isNotNull, count, sql, avg, max, countDistinct, desc } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { sendAnnouncementEmails } from '@/lib/email';
import {
  enrollments,
  batches,
  videoAssets,
  studentVideoProgress,
  member,
  user,
  taxonomyLevels,
  batchTemplates,
  announcements
} from '@/db/schema';
import { COMPLETION_THRESHOLD } from '@/lib/constants';
import { generateJoinCode } from '@/lib/utils/joinCode';
import { createLinkedAccount, createOnboardingLink } from '@/lib/razorpay';

// â”€â”€ Guards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const orgAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const role = ctx.userRole as string;
  if (role !== 'org_admin' && role !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Institution Admin access required.' });
  }
  if (!ctx.tenantId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No institution scope found.' });
  }
  return next();
});

// â”€â”€ Router â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const institutionAdminRouter = createTRPCRouter({
  
  getDashboardStats: orgAdminProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId!;

    const [
      [{ count: studentCount }],
      [{ count: batchCount }],
      [{ count: videoCount }],
      [{ avg: avgCompletion }]
    ] = await Promise.all([
      // 1. Active enrolled students
      db.select({ count: count() }).from(enrollments)
        .where(and(eq(enrollments.orgId, tenantId), eq(enrollments.status, 'active'))),

      // 2. Active batches
      db.select({ count: count() }).from(batches)
        .where(and(eq(batches.orgId, tenantId), eq(batches.isActive, true))),

      // 3. Total videos (institution + global)
      db.select({ count: count() }).from(videoAssets)
        .where(or(eq(videoAssets.tenantId, tenantId), isNull(videoAssets.tenantId))),

      // 4. Avg completion across all progress rows for students in this org
      db.select({ avg: avg(studentVideoProgress.completionPercentage) })
        .from(studentVideoProgress)
        .innerJoin(member, eq(member.userId, studentVideoProgress.userId))
        .where(eq(member.organizationId, tenantId))
    ]);

    return {
      activeStudents: Number(studentCount) || 0,
      activeBatches: Number(batchCount) || 0,
      totalVideos: Number(videoCount) || 0,
      platformCompletionRate: Number(avgCompletion) || 0,
    };
  }),

  getStudentProgressList: orgAdminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20)
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;

      // Step 1: get all student members of this org (paginated)
      const studentsQuery = await db.select({
        userId: member.userId,
        name: user.name,
        email: user.email,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(eq(member.organizationId, tenantId), eq(member.role, 'student')))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);

      const [{ count: totalStudents }] = await db.select({ count: count() })
        .from(member)
        .where(and(eq(member.organizationId, tenantId), eq(member.role, 'student')));

      const userIds = studentsQuery.map(s => s.userId);

      // Step 2: single batch query for all progress stats
      const progressStats = userIds.length > 0
        ? await db.select({
            userId:         studentVideoProgress.userId,
            videosWatched:  countDistinct(studentVideoProgress.videoId),
            completedVideos: sql<number>`SUM(CASE WHEN ${studentVideoProgress.completionPercentage} >= ${COMPLETION_THRESHOLD} THEN 1 ELSE 0 END)`,
            avgCompletion:  avg(studentVideoProgress.completionPercentage),
            lastActiveAt:   max(studentVideoProgress.lastWatchedAt),
          })
          .from(studentVideoProgress)
          .where(inArray(studentVideoProgress.userId, userIds))
          .groupBy(studentVideoProgress.userId)
        : [];

      // Step 3: enrollment counts
      const enrollmentCounts = userIds.length > 0
        ? await db.select({ userId: enrollments.userId, count: count() })
          .from(enrollments)
          .where(and(
            inArray(enrollments.userId, userIds),
            eq(enrollments.orgId, tenantId),
            eq(enrollments.status, 'active')
          ))
          .groupBy(enrollments.userId)
        : [];

      // Map results
      const progressMap = new Map(progressStats.map(p => [p.userId, p]));
      const enrollmentsMap = new Map(enrollmentCounts.map(e => [e.userId, e.count]));

      const mappedStudents = studentsQuery.map(student => {
        const p = progressMap.get(student.userId);
        const enrolled = enrollmentsMap.get(student.userId);
        return {
          userId: student.userId,
          name: student.name,
          email: student.email,
          enrolledBatches: Number(enrolled) || 0,
          videosWatched: Number(p?.videosWatched) || 0,
          completedVideos: Number(p?.completedVideos) || 0,
          avgCompletion: Number(p?.avgCompletion) || 0,
          lastActiveAt: p?.lastActiveAt ? (p.lastActiveAt as unknown as Date) : null,
        };
      });

      return {
        students: mappedStudents,
        total: Number(totalStudents),
      };
    }),

  getBatchStats: orgAdminProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId!;

    const batchesData = await db.select({
      batchId: batches.id,
      batchName: batches.name,
      levelId: batches.levelId,
      levelName: taxonomyLevels.name,
      isActive: batches.isActive,
    })
    .from(batches)
    .innerJoin(taxonomyLevels, eq(taxonomyLevels.id, batches.levelId))
    .where(eq(batches.orgId, tenantId));

    if (batchesData.length === 0) return [];

    const batchIds = batchesData.map(b => b.batchId);
    
    // Enrollments per batch
    const enrollmentCounts = await db.select({ batchId: enrollments.batchId, count: count() })
      .from(enrollments)
      .where(and(inArray(enrollments.batchId, batchIds), eq(enrollments.status, 'active')))
      .groupBy(enrollments.batchId);
    
    // Average completion per batch
    // This involves enrollments -> studentVideoProgress for this batch's videos
    // To do this strictly:
    // avg(studentVideoProgress.completionPercentage) for users enrolled in this batch, on videos belonging to this batch's level
    // Wait, let's do a simpler approach: get avg completion per batch by joining enrollments -> studentVideoProgress
    // We only care about videos that belong to this batch's level
    
    const avgCompletions = await db.select({
      batchId: enrollments.batchId,
      avgCompletion: avg(studentVideoProgress.completionPercentage)
    })
    .from(enrollments)
    .innerJoin(batches, eq(batches.id, enrollments.batchId))
    .innerJoin(videoAssets, and(
      eq(videoAssets.level, batches.levelId),
      or(eq(videoAssets.tenantId, tenantId), isNull(videoAssets.tenantId))
    ))
    .innerJoin(studentVideoProgress, and(
      eq(studentVideoProgress.userId, enrollments.userId),
      eq(studentVideoProgress.videoId, videoAssets.id)
    ))
    .where(and(inArray(enrollments.batchId, batchIds), eq(enrollments.status, 'active')))
    .groupBy(enrollments.batchId);

    // Video count per level
    const levelIds = Array.from(new Set(batchesData.map(b => b.levelId)));
    const videoCounts = await db.select({ levelId: videoAssets.level, count: count() })
      .from(videoAssets)
      .where(and(
        inArray(videoAssets.level, levelIds),
        or(eq(videoAssets.tenantId, tenantId), isNull(videoAssets.tenantId))
      ))
      .groupBy(videoAssets.level);

    const enrollmentMap = new Map(enrollmentCounts.map(e => [e.batchId, e.count]));
    const completionMap = new Map(avgCompletions.map(c => [c.batchId, c.avgCompletion]));
    const videoMap = new Map(videoCounts.map(v => [v.levelId, v.count]));

    return batchesData.map(b => ({
      batchId: b.batchId,
      batchName: b.batchName,
      levelName: b.levelName,
      isActive: b.isActive ?? false,
      enrolledCount: Number(enrollmentMap.get(b.batchId)) || 0,
      videoCount: Number(videoMap.get(b.levelId)) || 0,
      avgCompletion: Number(completionMap.get(b.batchId)) || 0,
    }));
  }),

  getAvailableTemplates: orgAdminProcedure
    .input(z.object({ levelId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db
        .select({
          id: batchTemplates.id,
          name: batchTemplates.name,
          description: batchTemplates.description,
        })
        .from(batchTemplates)
        .where(eq(batchTemplates.levelId, input.levelId));
    }),

  cloneTemplate: orgAdminProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;

      const [template] = await db.select()
        .from(batchTemplates)
        .where(eq(batchTemplates.id, input.templateId))
        .limit(1);

      if (!template) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
      }

      for (let attempt = 1; attempt <= 3; attempt++) {
        const code = generateJoinCode();
        try {
          await db.insert(batches).values({
            orgId: tenantId,
            levelId: template.levelId,
            templateId: template.id,
            name: input.name,
            description: template.description,
            joinCode: code,
            isActive: true,
          });
          return { success: true };
        } catch (e: any) {
          if (attempt === 3) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not generate unique code, please try again' });
          }
        }
      }

      return { success: true };
    }),

  getBatchJoinCode: orgAdminProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      const [batch] = await db.select({ joinCode: batches.joinCode })
        .from(batches)
        .where(and(eq(batches.id, input.batchId), eq(batches.orgId, tenantId)))
        .limit(1);
      
      if (!batch) throw new TRPCError({ code: 'NOT_FOUND' });
      return { joinCode: batch.joinCode };
    }),

  rotateBatchJoinCode: orgAdminProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      const [batch] = await db.select({ id: batches.id })
        .from(batches)
        .where(and(eq(batches.id, input.batchId), eq(batches.orgId, tenantId)))
        .limit(1);
      
      if (!batch) throw new TRPCError({ code: 'NOT_FOUND' });

      for (let attempt = 1; attempt <= 3; attempt++) {
        const code = generateJoinCode();
        try {
          await db.update(batches)
            .set({ joinCode: code })
            .where(eq(batches.id, input.batchId));
          return { joinCode: code };
        } catch (e: any) {
          if (attempt === 3) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not generate unique code, please try again' });
          }
        }
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    }),

  disableBatchJoinCode: orgAdminProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      await db.update(batches)
        .set({ joinCode: null })
        .where(and(eq(batches.id, input.batchId), eq(batches.orgId, tenantId)));
      return { success: true };
    }),

  createAnnouncement: orgAdminProcedure
    .input(z.object({
      batchId: z.string(),
      title: z.string().min(1).max(150),
      body: z.string().min(1).max(2000),
      isPinned: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;

      const [batch] = await db.select({ id: batches.id, orgId: batches.orgId })
        .from(batches)
        .where(eq(batches.id, input.batchId))
        .limit(1);

      if (!batch || batch.orgId !== tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this batch.' });
      }

      if (input.isPinned) {
        const [{ count: pinnedCount }] = await db.select({ count: count() })
          .from(announcements)
          .where(and(eq(announcements.batchId, input.batchId), eq(announcements.isPinned, true)));

        if (Number(pinnedCount) >= 3) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You can only pin up to 3 announcements per batch.'
          });
        }
      }

      const [newAnnouncement] = await Promise.all([
        db.insert(announcements).values({
          batchId: input.batchId,
          orgId: tenantId,
          authorId: ctx.userId!,
          title: input.title,
          body: input.body,
          isPinned: input.isPinned,
        }),
      ]);

      // â”€â”€ Phase 17: Email notification dispatch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Run both lookups in parallel â€” they're independent reads
      const [org, students] = await Promise.all([
        db.query.organization.findFirst({
          where: eq(schema.organization.id, ctx.tenantId),
          columns: { name: true },
        }),
        db
          .select({
            email: schema.user.email,
            name:  schema.user.name,
          })
          .from(schema.enrollments)
          .innerJoin(schema.user, eq(schema.enrollments.userId, schema.user.id))
          .where(
            and(
              eq(schema.enrollments.batchId, input.batchId),
              eq(schema.enrollments.orgId,   ctx.tenantId),
              eq(schema.enrollments.status,  'active'),
              eq(schema.enrollments.emailOptOut, false),   // respect opt-out
            )
          ),
      ]);

      // Fire-and-forget â€” announcement creation returns immediately to the IA;
      // email dispatch runs in the background.
      void sendAnnouncementEmails({
        students,
        title:   input.title,
        body:    input.body,
        orgName: org?.name ?? 'Your Institution',
        batchId: input.batchId,
      }).catch(err => {
        console.error('[Phase 17] Announcement email dispatch failed', {
          batchId: input.batchId,
          err,
        });
      });
      // â”€â”€ End Phase 17 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

      return { success: true };
    }),

  listBatchAnnouncements: orgAdminProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;

      const [batch] = await db.select({ id: batches.id, orgId: batches.orgId })
        .from(batches)
        .where(eq(batches.id, input.batchId))
        .limit(1);

      if (!batch || batch.orgId !== tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this batch.' });
      }

      return db.select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        isPinned: announcements.isPinned,
        createdAt: announcements.createdAt,
        authorName: user.name,
      })
      .from(announcements)
      .leftJoin(user, eq(user.id, announcements.authorId))
      .where(eq(announcements.batchId, input.batchId))
      .orderBy(sql`${announcements.isPinned} DESC`, sql`${announcements.createdAt} DESC`);
    }),

  deleteAnnouncement: orgAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;

      const [announcement] = await db.select({ id: announcements.id, orgId: announcements.orgId })
        .from(announcements)
        .where(eq(announcements.id, input.id))
        .limit(1);

      if (!announcement || announcement.orgId !== tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this announcement.' });
      }

      await db.delete(announcements).where(eq(announcements.id, input.id));
      return { success: true };
    }),

  togglePinAnnouncement: orgAdminProcedure
    .input(z.object({
      id: z.string(),
      isPinned: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;

      const [announcement] = await db.select({ 
        id: announcements.id, 
        orgId: announcements.orgId,
        batchId: announcements.batchId 
      })
      .from(announcements)
      .where(eq(announcements.id, input.id))
      .limit(1);

      if (!announcement || announcement.orgId !== tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this announcement.' });
      }

      if (input.isPinned) {
        const [{ count: pinnedCount }] = await db.select({ count: count() })
          .from(announcements)
          .where(and(eq(announcements.batchId, announcement.batchId), eq(announcements.isPinned, true)));

        if (Number(pinnedCount) >= 3) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You can only pin up to 3 announcements per batch.'
          });
        }
      }

      await db.update(announcements)
        .set({ isPinned: input.isPinned })
        .where(eq(announcements.id, input.id));

      return { success: true };
    }),

  getRevenueAnalytics: orgAdminProcedure.query(async ({ ctx }) => {
    const [monthly, byBatch] = await Promise.all([
      db
        .select({
          month:           sql<string>`DATE_FORMAT(${schema.payments.capturedAt}, '%Y-%m')`.as('month'),
          institutionPaise: sql<number>`SUM(${schema.orders.institutionPaise})`.as('institutionPaise'),
          paymentCount:    sql<number>`COUNT(${schema.payments.id})`.as('paymentCount'),
        })
        .from(schema.payments)
        .innerJoin(schema.orders, eq(schema.orders.id, schema.payments.orderId))
        .where(
          and(
            eq(schema.payments.status, 'captured'),
            eq(schema.orders.orgId, ctx.tenantId!),
          )
        )
        .groupBy(sql`DATE_FORMAT(${schema.payments.capturedAt}, '%Y-%m')`)
        .orderBy(sql`month DESC`)
        .limit(12),

      db
        .select({
          batchId:          schema.orders.batchId,
          batchName:        schema.batches.name,
          institutionPaise: sql<number>`SUM(${schema.orders.institutionPaise})`.as('institutionPaise'),
          paymentCount:     sql<number>`COUNT(${schema.payments.id})`.as('paymentCount'),
        })
        .from(schema.payments)
        .innerJoin(schema.orders, eq(schema.orders.id, schema.payments.orderId))
        .innerJoin(schema.batches, eq(schema.batches.id, schema.orders.batchId))
        .where(
          and(
            eq(schema.payments.status, 'captured'),
            eq(schema.orders.orgId, ctx.tenantId!),
          )
        )
        .groupBy(schema.orders.batchId, schema.batches.name)
        .orderBy(sql`institutionPaise DESC`),
    ])

    const allTime = {
      institutionPaise: byBatch.reduce((s, r) => s + Number(r.institutionPaise), 0),
      paymentCount:     byBatch.reduce((s, r) => s + Number(r.paymentCount), 0),
    }

    const thisMonthKey = new Date().toISOString().slice(0, 7)
    const thisMonth = monthly.find(r => r.month === thisMonthKey)

    return {
      allTime,
      thisMonth: {
        institutionPaise: Number(thisMonth?.institutionPaise ?? 0),
        paymentCount:     Number(thisMonth?.paymentCount ?? 0),
      },
      monthly: [...monthly].reverse(),
      byBatch,
    }
  }),

  getRazorpayKycStatus: orgAdminProcedure.query(async ({ ctx }) => {
    const org = await db.query.organization.findFirst({
      where: eq(schema.organization.id, ctx.tenantId!),
      columns: { razorpayLinkedAccountId: true },
    });
    return {
      isLinked: !!org?.razorpayLinkedAccountId,
      accountId: org?.razorpayLinkedAccountId || null,
    };
  }),

  setupRazorpayAccount: orgAdminProcedure
    .input(z.object({
      category: z.string().min(1),
      subcategory: z.string().min(1),
      street1: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      postal_code: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch org
      const org = await db.query.organization.findFirst({
        where: eq(schema.organization.id, ctx.tenantId!),
        columns: { name: true, id: true, razorpayLinkedAccountId: true },
      });
      const currentUser = await db.query.user.findFirst({
        where: eq(schema.user.id, ctx.userId!),
        columns: { email: true, name: true },
      });

      if (!org || !currentUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Org or user not found' });
      }

      let accountId = org.razorpayLinkedAccountId;

      // 2. Call Razorpay API to create linked account if not exists
      if (!accountId) {
        const accountPayload = {
          email: currentUser.email,
          legal_business_name: org.name,
          business_type: 'route',
          profile: {
            category: input.category,
            subcategory: input.subcategory,
            addresses: {
              registered: {
                street1: input.street1,
                city: input.city,
                state: input.state,
                postal_code: input.postal_code,
                country: 'IN',
              }
            }
          }
        };

        let accountRes;
        try {
          accountRes = await createLinkedAccount(accountPayload);
        } catch (e: any) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e.message || 'Failed to create Razorpay account' });
        }

        accountId = accountRes.id;
        if (!accountId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No account ID returned from Razorpay' });
        }

        // 3. Save to DB
        await db.update(schema.organization)
          .set({ razorpayLinkedAccountId: accountId })
          .where(eq(schema.organization.id, org.id));
      }

      // 4. Generate onboarding link
      try {
        const onboardingData = await createOnboardingLink(accountId, currentUser.name || "Business Owner");
        return { 
          success: true, 
          accountId,
          onboardingUrl: onboardingData?.requested_configuration?.activation_url || onboardingData?.activation_url || null
        };
      } catch (e: any) {
        console.error('Failed to generate onboarding link', e);
        // Do not hard-fail if link generation fails, account is already created
        return {
          success: true,
          accountId,
          onboardingUrl: null
        };
      }
    }),

  listBatchCoupons: orgAdminProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const batch = await db.query.batches.findFirst({
        where: and(eq(schema.batches.id, input.batchId), eq(schema.batches.orgId, ctx.tenantId!))
      });
      if (!batch) throw new TRPCError({ code: 'FORBIDDEN' });

      return db.select()
        .from(schema.batchCoupons)
        .where(eq(schema.batchCoupons.batchId, input.batchId))
        .orderBy(sql`${schema.batchCoupons.createdAt} DESC`);
    }),

  createBatchCoupon: orgAdminProcedure
    .input(z.object({
      batchId: z.string(),
      code: z.string().min(3).max(50),
      discountType: z.enum(['percentage', 'fixed']),
      discountValue: z.number().min(0),
      usageLimit: z.number().nullable(),
      expiresAt: z.string().nullable()
    }))
    .mutation(async ({ ctx, input }) => {
      const batch = await db.query.batches.findFirst({
        where: and(eq(schema.batches.id, input.batchId), eq(schema.batches.orgId, ctx.tenantId!))
      });
      if (!batch) throw new TRPCError({ code: 'FORBIDDEN' });

      try {
        await db.insert(schema.batchCoupons).values({
          batchId: input.batchId,
          code: input.code.toUpperCase(),
          discountType: input.discountType,
          discountValue: input.discountValue.toString(),
          usageLimit: input.usageLimit,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        });
        return { success: true };
      } catch (e: any) {
        if (e.message?.includes('Duplicate') || e.code === 'ER_DUP_ENTRY') {
          throw new TRPCError({ code: 'CONFLICT', message: 'A coupon with this code already exists for this batch' });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create coupon' });
      }
    }),

  deleteBatchCoupon: orgAdminProcedure
    .input(z.object({ batchId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const batch = await db.query.batches.findFirst({
        where: and(eq(schema.batches.id, input.batchId), eq(schema.batches.orgId, ctx.tenantId!))
      });
      if (!batch) throw new TRPCError({ code: 'FORBIDDEN' });

      await db.delete(schema.batchCoupons)
        .where(and(
          eq(schema.batchCoupons.id, input.id),
          eq(schema.batchCoupons.batchId, input.batchId)
        ));
      
      return { success: true };
    }),

  // â”€â”€ Phase 24: MCQ Quiz Module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  listBatchQuizzes: orgAdminProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const batch = await db.query.batches.findFirst({
        where: and(eq(schema.batches.id, input.batchId), eq(schema.batches.orgId, ctx.tenantId!))
      });
      if (!batch) throw new TRPCError({ code: 'FORBIDDEN' });

      const quizzes = await db.select({
        id: schema.quizzes.id,
        title: schema.quizzes.title,
        timeLimitMinutes: schema.quizzes.timeLimitMinutes,
        passingScore: schema.quizzes.passingScore,
        shuffleQuestions: schema.quizzes.shuffleQuestions,
        allowMultipleAttempts: schema.quizzes.allowMultipleAttempts,
        createdAt: schema.quizzes.createdAt,
      })
      .from(schema.quizzes)
      .where(eq(schema.quizzes.batchId, input.batchId))
      .orderBy(schema.quizzes.createdAt);

      const quizIds = quizzes.map(q => q.id);

      const questionCounts = quizIds.length > 0 ? await db.select({
        quizId: schema.quizQuestions.quizId,
        count: count()
      })
      .from(schema.quizQuestions)
      .where(inArray(schema.quizQuestions.quizId, quizIds))
      .groupBy(schema.quizQuestions.quizId) : [];

      const attemptCounts = quizIds.length > 0 ? await db.select({
        quizId: schema.quizAttempts.quizId,
        count: count()
      })
      .from(schema.quizAttempts)
      .where(and(
        inArray(schema.quizAttempts.quizId, quizIds),
        sql`${schema.quizAttempts.completedAt} IS NOT NULL`
      ))
      .groupBy(schema.quizAttempts.quizId) : [];

      const questionCountMap = new Map(questionCounts.map(q => [q.quizId, q.count]));
      const attemptCountMap = new Map(attemptCounts.map(a => [a.quizId, a.count]));

      return quizzes.map(q => ({
        ...q,
        questionCount: Number(questionCountMap.get(q.id)) || 0,
        attemptCount: Number(attemptCountMap.get(q.id)) || 0,
      }));
    }),

  createQuiz: orgAdminProcedure
    .input(z.object({
      batchId: z.string(),
      title: z.string().min(1).max(200),
      timeLimitMinutes: z.number().min(1).nullable(),
      passingScore: z.number().min(0).max(100).nullable(),
      shuffleQuestions: z.boolean(),
      allowMultipleAttempts: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const batch = await db.query.batches.findFirst({
        where: and(eq(schema.batches.id, input.batchId), eq(schema.batches.orgId, ctx.tenantId!))
      });
      if (!batch) throw new TRPCError({ code: 'FORBIDDEN' });

      const quizId = crypto.randomUUID();
      await db.insert(schema.quizzes).values({
        id: quizId,
        batchId: input.batchId,
        orgId: ctx.tenantId!,
        title: input.title,
        timeLimitMinutes: input.timeLimitMinutes,
        passingScore: input.passingScore ? input.passingScore.toString() : null,
        shuffleQuestions: input.shuffleQuestions,
        allowMultipleAttempts: input.allowMultipleAttempts,
      });

      return { id: quizId };
    }),

  updateQuiz: orgAdminProcedure
    .input(z.object({
      quizId: z.string(),
      title: z.string().min(1).max(200).optional(),
      timeLimitMinutes: z.number().min(1).nullable().optional(),
      passingScore: z.number().min(0).max(100).nullable().optional(),
      shuffleQuestions: z.boolean().optional(),
      allowMultipleAttempts: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [quiz] = await db.select().from(schema.quizzes)
        .where(and(eq(schema.quizzes.id, input.quizId), eq(schema.quizzes.orgId, ctx.tenantId!)))
        .limit(1);
      if (!quiz) throw new TRPCError({ code: 'FORBIDDEN' });

      await db.update(schema.quizzes).set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.timeLimitMinutes !== undefined && { timeLimitMinutes: input.timeLimitMinutes }),
        ...(input.passingScore !== undefined && { passingScore: input.passingScore ? input.passingScore.toString() : null }),
        ...(input.shuffleQuestions !== undefined && { shuffleQuestions: input.shuffleQuestions }),
        ...(input.allowMultipleAttempts !== undefined && { allowMultipleAttempts: input.allowMultipleAttempts }),
      }).where(eq(schema.quizzes.id, input.quizId));

      return { success: true };
    }),

  getQuizQuestions: orgAdminProcedure
    .input(z.object({ quizId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [quiz] = await db.select({ id: schema.quizzes.id })
        .from(schema.quizzes)
        .where(and(eq(schema.quizzes.id, input.quizId), eq(schema.quizzes.orgId, ctx.tenantId!)))
        .limit(1);
      if (!quiz) throw new TRPCError({ code: 'FORBIDDEN' });

      const questions = await db.select({
        id: schema.quizQuestions.id,
        questionText: schema.quizQuestions.questionText,
        explanation: schema.quizQuestions.explanation,
        sortOrder: schema.quizQuestions.sortOrder,
      })
      .from(schema.quizQuestions)
      .where(eq(schema.quizQuestions.quizId, input.quizId))
      .orderBy(schema.quizQuestions.sortOrder);

      const qIds = questions.map(q => q.id);
      const options = qIds.length > 0 ? await db.select({
        id: schema.quizOptions.id,
        questionId: schema.quizOptions.questionId,
        optionText: schema.quizOptions.optionText,
        isCorrect: schema.quizOptions.isCorrect,
        sortOrder: schema.quizOptions.sortOrder,
      })
      .from(schema.quizOptions)
      .where(inArray(schema.quizOptions.questionId, qIds))
      .orderBy(schema.quizOptions.sortOrder) : [];

      const optionsMap = new Map<string, typeof options>();
      options.forEach(o => {
        if (!optionsMap.has(o.questionId)) optionsMap.set(o.questionId, []);
        optionsMap.get(o.questionId)!.push(o);
      });

      return questions.map(q => ({
        ...q,
        options: optionsMap.get(q.id) || [],
      }));
    }),

  deleteQuiz: orgAdminProcedure
    .input(z.object({ quizId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [quiz] = await db.select().from(schema.quizzes)
        .where(and(eq(schema.quizzes.id, input.quizId), eq(schema.quizzes.orgId, ctx.tenantId!)))
        .limit(1);
      if (!quiz) throw new TRPCError({ code: 'FORBIDDEN' });

      await db.delete(schema.quizzes).where(eq(schema.quizzes.id, input.quizId));
      return { success: true };
    }),

  addQuestion: orgAdminProcedure
    .input(z.object({
      quizId: z.string(),
      questionText: z.string().min(1),
      explanation: z.string().nullable().optional(),
      sortOrder: z.number().default(0),
      options: z.array(z.object({
        optionText: z.string().min(1).max(500),
        isCorrect: z.boolean(),
        sortOrder: z.number().default(0),
      })).min(2),
    }))
    .mutation(async ({ ctx, input }) => {
      const [quiz] = await db.select().from(schema.quizzes)
        .where(and(eq(schema.quizzes.id, input.quizId), eq(schema.quizzes.orgId, ctx.tenantId!)))
        .limit(1);
      if (!quiz) throw new TRPCError({ code: 'FORBIDDEN' });

      const correctCount = input.options.filter(o => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Exactly one correct option required' });
      }

      const questionId = crypto.randomUUID();
      
      await db.transaction(async (tx) => {
        await tx.insert(schema.quizQuestions).values({
          id: questionId,
          quizId: input.quizId,
          questionText: input.questionText,
          explanation: input.explanation ?? null,
          sortOrder: input.sortOrder,
        });

        const optionsToInsert = input.options.map((opt, i) => ({
          id: crypto.randomUUID(),
          questionId,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
          sortOrder: opt.sortOrder || i,
        }));

        await tx.insert(schema.quizOptions).values(optionsToInsert);
      });

      return { id: questionId };
    }),

  updateQuestion: orgAdminProcedure
    .input(z.object({
      questionId: z.string(),
      questionText: z.string().min(1).optional(),
      explanation: z.string().nullable().optional(),
      sortOrder: z.number().optional(),
      options: z.array(z.object({
        optionText: z.string().min(1).max(500),
        isCorrect: z.boolean(),
        sortOrder: z.number().default(0),
      })).min(2).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [question] = await db.select({ id: schema.quizQuestions.id, quizId: schema.quizQuestions.quizId })
        .from(schema.quizQuestions)
        .innerJoin(schema.quizzes, eq(schema.quizzes.id, schema.quizQuestions.quizId))
        .where(and(eq(schema.quizQuestions.id, input.questionId), eq(schema.quizzes.orgId, ctx.tenantId!)))
        .limit(1);
      if (!question) throw new TRPCError({ code: 'FORBIDDEN' });

      if (input.options) {
        const correctCount = input.options.filter(o => o.isCorrect).length;
        if (correctCount !== 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Exactly one correct option required' });
        }
      }

      await db.transaction(async (tx) => {
        if (input.questionText !== undefined || input.explanation !== undefined || input.sortOrder !== undefined) {
          await tx.update(schema.quizQuestions).set({
            ...(input.questionText !== undefined && { questionText: input.questionText }),
            ...(input.explanation !== undefined && { explanation: input.explanation }),
            ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          }).where(eq(schema.quizQuestions.id, input.questionId));
        }

        if (input.options) {
          await tx.delete(schema.quizOptions).where(eq(schema.quizOptions.questionId, input.questionId));
          const optionsToInsert = input.options.map((opt, i) => ({
            id: crypto.randomUUID(),
            questionId: input.questionId,
            optionText: opt.optionText,
            isCorrect: opt.isCorrect,
            sortOrder: opt.sortOrder || i,
          }));
          await tx.insert(schema.quizOptions).values(optionsToInsert);
        }
      });

      return { success: true };
    }),

  deleteQuestion: orgAdminProcedure
    .input(z.object({ questionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [question] = await db.select({ id: schema.quizQuestions.id })
        .from(schema.quizQuestions)
        .innerJoin(schema.quizzes, eq(schema.quizzes.id, schema.quizQuestions.quizId))
        .where(and(eq(schema.quizQuestions.id, input.questionId), eq(schema.quizzes.orgId, ctx.tenantId!)))
        .limit(1);
      if (!question) throw new TRPCError({ code: 'FORBIDDEN' });

      await db.delete(schema.quizQuestions).where(eq(schema.quizQuestions.id, input.questionId));
      return { success: true };
    }),

  // ============================================================================
  // PHASE 25A — STUDENT ANALYTICS
  // ============================================================================

  getBatchAnalytics: orgAdminProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      const [batch] = await db.select().from(schema.batches).where(and(eq(schema.batches.id, input.batchId), eq(schema.batches.orgId, tenantId))).limit(1);
      if (!batch) throw new TRPCError({ code: 'NOT_FOUND', message: 'Batch not found or access denied.' });

      const enrolled = await db.select({
        userId: schema.enrollments.userId,
        name: schema.user.name,
        email: schema.user.email,
      }).from(schema.enrollments)
        .innerJoin(schema.user, eq(schema.user.id, schema.enrollments.userId))
        .where(and(eq(schema.enrollments.batchId, input.batchId), eq(schema.enrollments.status, 'active')));

      // Fetch batch quizzes
      const batchQuizzes = await db.select({ id: schema.quizzes.id }).from(schema.quizzes).where(eq(schema.quizzes.batchId, input.batchId));
      const totalQuizzesInBatch = batchQuizzes.length || 1; // avoid division by zero
      const quizIds = batchQuizzes.map(q => q.id);

      // Fetch learning events for this batch
      const events = await db.select().from(schema.learningEvents).where(eq(schema.learningEvents.batchId, input.batchId));
      
      // Fetch video progress
      const videoProg = await db.select().from(schema.studentVideoProgress)
        .innerJoin(schema.videoAssets, eq(schema.videoAssets.id, schema.studentVideoProgress.videoId))
        .where(and(
          eq(schema.videoAssets.level, batch.levelId),
          or(eq(schema.videoAssets.tenantId, tenantId), isNull(schema.videoAssets.tenantId))
        ));

      // Fetch quiz attempts
      const quizAtt = quizIds.length > 0 
        ? await db.select().from(schema.quizAttempts).where(and(inArray(schema.quizAttempts.quizId, quizIds), isNotNull(schema.quizAttempts.completedAt)))
        : [];

      // Compute analytics using dynamic import to avoid top-level issues if any
      const { computeEngagementScore, computeRiskScore } = await import('@/lib/analytics');

      const today = new Date();
      let activeTodayCount = 0;
      let atRiskCount = 0;
      let sumCompletion = 0;
      let sumQuizAvg = 0;
      let usersWithQuizzes = 0;

      const students = enrolled.map(student => {
        // Completion
        const myVideos = videoProg.filter(v => v.student_video_progress.userId === student.userId);
        const completionPct = myVideos.length > 0 ? myVideos.reduce((sum, v) => sum + Number(v.student_video_progress.completionPercentage), 0) / myVideos.length : 0;
        
        // Quiz
        const myQuizzes = quizAtt.filter(q => q.userId === student.userId);
        const quizzesTaken = new Set(myQuizzes.map(q => q.quizId)).size;
        const quizAvg = myQuizzes.length > 0 ? myQuizzes.reduce((sum, q) => sum + Number(q.score || 0), 0) / myQuizzes.length : 0;
        
        // Events
        const myEvents = events.filter(e => e.userId === student.userId);
        const lastActiveEvent = myEvents.reduce((latest, e) => (!latest || e.createdAt > latest.createdAt) ? e : latest, null as typeof myEvents[0] | null);
        const lastActive = lastActiveEvent?.createdAt || null;
        
        const isToday = lastActive && lastActive.toDateString() === today.toDateString();
        if (isToday) activeTodayCount++;

        const daysSinceLastActive = lastActive ? Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 3600 * 24)) : 30;
        
        // Consistency
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const activeDays = new Set(myEvents.filter(e => e.createdAt >= thirtyDaysAgo).map(e => e.createdAt.toDateString())).size;
        
        // Streak
        const eventDatesDesc = Array.from(new Set(myEvents.map(e => e.createdAt.toDateString()))).map(d => new Date(d)).sort((a,b) => b.getTime() - a.getTime());
        let streakDays = 0;
        let currDate = new Date(today.toDateString());
        // allow missing today
        if (eventDatesDesc.length > 0 && (eventDatesDesc[0].getTime() === currDate.getTime() || eventDatesDesc[0].getTime() === currDate.getTime() - 86400000)) {
           let checkDate = eventDatesDesc[0];
           for (const d of eventDatesDesc) {
             if (d.getTime() === checkDate.getTime()) {
               streakDays++;
               checkDate = new Date(checkDate.getTime() - 86400000);
             } else {
               break;
             }
           }
        }

        // Depth
        const interactionDepth = Math.min(100, myEvents.filter(e => e.eventType === 'video_pause' || e.eventType === 'video_seek').length);
        
        const engagementScore = computeEngagementScore({
          completionPct,
          quizParticipationRate: (quizzesTaken / totalQuizzesInBatch) * 100,
          studyConsistencyScore: (activeDays / 30) * 100,
          interactionDepth
        });

        const riskScore = computeRiskScore(engagementScore, daysSinceLastActive);
        let riskLevel = 'high';
        if (engagementScore >= 80) riskLevel = 'none';
        else if (engagementScore >= 60) riskLevel = 'low';
        else if (engagementScore >= 40) riskLevel = 'medium';

        if (riskLevel === 'high' || riskLevel === 'medium') atRiskCount++;
        
        sumCompletion += completionPct;
        if (quizzesTaken > 0) {
          sumQuizAvg += quizAvg;
          usersWithQuizzes++;
        }

        return {
          userId: student.userId,
          name: student.name,
          email: student.email,
          completion: completionPct,
          quizAvg: quizzesTaken > 0 ? quizAvg : null,
          engagementScore,
          riskScore,
          riskLevel,
          lastActive,
          streakDays
        };
      });

      return {
        kpis: {
          avgCompletion: enrolled.length > 0 ? sumCompletion / enrolled.length : 0,
          avgQuizScore: usersWithQuizzes > 0 ? sumQuizAvg / usersWithQuizzes : 0,
          atRiskCount,
          activeTodayCount
        },
        students
      };
    }),

  getStudentDetail: orgAdminProcedure
    .input(z.object({ batchId: z.string().uuid(), studentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      const [batch] = await db.select().from(schema.batches).where(and(eq(schema.batches.id, input.batchId), eq(schema.batches.orgId, tenantId))).limit(1);
      if (!batch) throw new TRPCError({ code: 'NOT_FOUND' });

      const videoProg = await db.select().from(schema.studentVideoProgress)
        .innerJoin(schema.videoAssets, eq(schema.videoAssets.id, schema.studentVideoProgress.videoId))
        .where(and(
          eq(schema.studentVideoProgress.userId, input.studentId),
          eq(schema.videoAssets.level, batch.levelId),
          or(eq(schema.videoAssets.tenantId, tenantId), isNull(schema.videoAssets.tenantId))
        ));
      
      const batchQuizzes = await db.select({ id: schema.quizzes.id, title: schema.quizzes.title }).from(schema.quizzes).where(eq(schema.quizzes.batchId, input.batchId));
      const quizIds = batchQuizzes.map(q => q.id);
      
      const quizAtt = quizIds.length > 0 
        ? await db.select().from(schema.quizAttempts)
            .where(and(eq(schema.quizAttempts.userId, input.studentId), inArray(schema.quizAttempts.quizId, quizIds), isNotNull(schema.quizAttempts.completedAt)))
        : [];

      const snapshots = await db.select().from(schema.studentEngagementSnapshots)
        .where(and(eq(schema.studentEngagementSnapshots.userId, input.studentId), eq(schema.studentEngagementSnapshots.batchId, input.batchId)))
        .orderBy(schema.studentEngagementSnapshots.weekOf);

      // Topic weakness could be implemented by joining quizAnswers with questions that have tags (topic).
      // Assuming questions might not have topic yet in schema, we return an empty array or basic data.

      return {
        videoProgress: videoProg.map(v => ({ videoId: v.video_assets.id, title: v.video_assets.title, completion: Number(v.student_video_progress.completionPercentage) })),
        quizHistory: quizAtt.map(q => ({
          attemptId: q.id,
          quizId: q.quizId,
          quizTitle: batchQuizzes.find(bq => bq.id === q.quizId)?.title || 'Quiz',
          score: Number(q.score),
          completedAt: q.completedAt
        })),
        weeklyTrend: snapshots.map(s => ({
          weekOf: s.weekOf,
          engagementScore: Number(s.engagementScore)
        })),
        topicWeakness: []
      };
    }),

  getBatchEngagementTrend: orgAdminProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      const [batch] = await db.select().from(schema.batches).where(and(eq(schema.batches.id, input.batchId), eq(schema.batches.orgId, tenantId))).limit(1);
      if (!batch) throw new TRPCError({ code: 'NOT_FOUND' });

      const snapshots = await db.select({
        weekOf: schema.studentEngagementSnapshots.weekOf,
        avgEngagement: avg(schema.studentEngagementSnapshots.engagementScore),
        countRisk: sql<number>`SUM(CASE WHEN engagement_score < 60 THEN 1 ELSE 0 END)`
      }).from(schema.studentEngagementSnapshots)
        .where(eq(schema.studentEngagementSnapshots.batchId, input.batchId))
        .groupBy(schema.studentEngagementSnapshots.weekOf)
        .orderBy(desc(schema.studentEngagementSnapshots.weekOf))
        .limit(12);

      return snapshots.reverse().map(s => ({
        weekOf: s.weekOf,
        avgEngagement: Number(s.avgEngagement),
        atRiskCount: Number(s.countRisk)
      }));
    }),

});

