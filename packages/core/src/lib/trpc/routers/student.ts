import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, or, inArray, isNull, count, sql, gte, desc, avg } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../server';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { COMPLETION_THRESHOLD } from '@/lib/constants';
import { sendEmail, emailLayout } from '@/lib/email/send-email';

// ── Guards ────────────────────────────────────────────────────────────────────

const studentProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.userRole !== 'student') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

// ── Router ────────────────────────────────────────────────────────────────────

export const studentRouter = createTRPCRouter({
  getEnrolledBatches: studentProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId || !ctx.userId) throw new TRPCError({ code: 'FORBIDDEN' });

    // Step 1: get active and pending enrollments + active batches for this student
    const rows = await db
      .select({ 
        batch: schema.batches,
        enrollmentStatus: schema.enrollments.status,
        razorpayOrderId: schema.orders.razorpayOrderId,
        amountPaise: schema.orders.amountPaise,
        domain: { id: schema.taxonomyDomains.id, name: schema.taxonomyDomains.name },
        course: { id: schema.taxonomyCourses.id, name: schema.taxonomyCourses.name },
        level: { id: schema.taxonomyLevels.id, name: schema.taxonomyLevels.name },
      })
      .from(schema.enrollments)
      .innerJoin(schema.batches, eq(schema.batches.id, schema.enrollments.batchId))
      .innerJoin(schema.taxonomyLevels, eq(schema.taxonomyLevels.id, schema.batches.levelId))
      .innerJoin(schema.taxonomyCourses, eq(schema.taxonomyCourses.id, schema.taxonomyLevels.courseId))
      .innerJoin(schema.taxonomyDomains, eq(schema.taxonomyDomains.id, schema.taxonomyCourses.domainId))
      .leftJoin(schema.orders, and(
        eq(schema.orders.batchId, schema.batches.id),
        eq(schema.orders.studentId, schema.enrollments.userId),
        eq(schema.orders.status, 'created') // Open orders
      ))
      .where(and(
        eq(schema.enrollments.orgId, ctx.tenantId),
        eq(schema.enrollments.userId, ctx.userId),
        inArray(schema.enrollments.status, ['active', 'pending_payment']),
        eq(schema.batches.isActive, true)
      ));

    // Step 2: for each batch, fetch videoCount and completedCount
    const enriched = await Promise.all(rows.map(async (row) => {
      const [{ videoCount }] = await db
        .select({ videoCount: count() })
        .from(schema.videoAssets)
        .where(and(
          eq(schema.videoAssets.level, row.batch.levelId),
          or(eq(schema.videoAssets.tenantId, ctx.tenantId), isNull(schema.videoAssets.tenantId))
        ));

      const [{ completedCount }] = await db
        .select({ completedCount: count() })
        .from(schema.studentVideoProgress)
        .innerJoin(schema.videoAssets, eq(schema.videoAssets.id, schema.studentVideoProgress.videoId))
        .where(and(
          eq(schema.studentVideoProgress.userId, ctx.userId!),
          gte(schema.studentVideoProgress.completionPercentage, COMPLETION_THRESHOLD.toFixed(2)),
          eq(schema.videoAssets.level, row.batch.levelId),
          or(eq(schema.videoAssets.tenantId, ctx.tenantId), isNull(schema.videoAssets.tenantId))
        ));

      let enrollmentCount = 0;
      if (row.batch.maxStudents !== null) {
        const [{ seatsTaken }] = await db
          .select({ seatsTaken: count() })
          .from(schema.enrollments)
          .where(and(
            eq(schema.enrollments.batchId, row.batch.id),
            inArray(schema.enrollments.status, ['active', 'pending_payment'])
          ));
        enrollmentCount = seatsTaken;
      }

      return {
        batchId: row.batch.id,
        batchName: row.batch.name,
        enrollmentStatus: row.enrollmentStatus,
        pendingOrder: row.enrollmentStatus === 'pending_payment' && row.razorpayOrderId ? {
          razorpayOrderId: row.razorpayOrderId,
          amountPaise: row.amountPaise!
        } : null,
        domain: row.domain,
        course: row.course,
        level: row.level,
        videoCount,
        completedCount,
        maxStudents: row.batch.maxStudents,
        enrollmentCount,
      };
    }));

    return enriched;
  }),

  getMyPurchases: studentProcedure.query(async ({ ctx }) => {
    // No tenantId filter — students see ALL their receipts regardless of institution.
    // orgName on each row provides context. 100-row limit is a practical safeguard.
    const rows = await db
      .select({
        orderId:           schema.orders.id,
        batchId:           schema.orders.batchId,
        batchName:         schema.batches.name,
        orgName:           schema.organization.name,
        amountPaise:       schema.orders.amountPaise,
        currency:          schema.orders.currency,
        razorpayPaymentId: schema.payments.razorpayPaymentId,
        capturedAt:        schema.payments.capturedAt,
        status:            schema.payments.status,
      })
      .from(schema.orders)
      .innerJoin(
        schema.payments,
        eq(schema.payments.orderId, schema.orders.id),
      )
      .innerJoin(
        schema.batches,
        eq(schema.batches.id, schema.orders.batchId),
      )
      .innerJoin(
        schema.organization,
        eq(schema.organization.id, schema.orders.orgId),
      )
      .where(
        and(
          eq(schema.orders.studentId, ctx.userId!),
          inArray(schema.payments.status, ['captured', 'refunded']),   // successful and refunded payments
        )
      )
      .orderBy(desc(schema.payments.capturedAt))
      .limit(100)

    return rows
  }),

  joinBatchByCode: studentProcedure
    .input(z.object({
      code: z.string().length(8).toUpperCase(),
      couponCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // 1. Look up the batch and organization by joinCode
      const [batchRecord] = await db.select({
        batch: schema.batches,
        org: schema.organization
      })
      .from(schema.batches)
      .innerJoin(schema.organization, eq(schema.batches.orgId, schema.organization.id))
      .where(eq(schema.batches.joinCode, input.code))
      .limit(1);

      if (!batchRecord) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid join code.' });
      }

      const { batch, org } = batchRecord;

      // 2. Check batch.isActive
      if (!batch.isActive) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This batch is no longer accepting enrollments.' });
      }

      if (batch.maxStudents !== null) {
        const [{ seatsTaken }] = await db
          .select({ seatsTaken: sql<number>`COUNT(*)` })
          .from(schema.enrollments)
          .where(
            and(
              eq(schema.enrollments.batchId, batch.id),
              inArray(schema.enrollments.status, ['active', 'pending_payment'])
            )
          );
        if (Number(seatsTaken) >= batch.maxStudents) {
          await db.insert(schema.batchWaitlist).values({
            batchId: batch.id,
            userId: ctx.userId,
            orgId: org.id
          }).onConflictDoUpdate({ target: [schema.batchWaitlist.batchId, schema.batchWaitlist.userId], set: { batchId: batch.id } });
          throw new TRPCError({ code: 'FORBIDDEN', message: 'This batch is full. You have been added to the waitlist.' });
        }
      }

      // 3. Idempotency check for enrollments
      const [existingEnrollment] = await db.select()
        .from(schema.enrollments)
        .where(and(
          eq(schema.enrollments.userId, ctx.userId),
          eq(schema.enrollments.batchId, batch.id)
        ))
        .limit(1);

      if (existingEnrollment) {
        if (existingEnrollment.status === 'pending_payment') {
          return { success: false, batchId: batch.id, pendingPayment: true, message: 'Payment is pending for this batch.' };
        }
        return { success: true, batchId: batch.id, alreadyEnrolled: true };
      }

      let basePriceRupees = parseFloat(batch.price ?? '0');
      let finalPriceRupees = basePriceRupees;
      let couponId: string | null = null;

      if (input.couponCode && basePriceRupees > 0) {
        const [coupon] = await db.select().from(schema.batchCoupons)
          .where(and(
            eq(schema.batchCoupons.batchId, batch.id),
            eq(schema.batchCoupons.code, input.couponCode.toUpperCase())
          ))
          .limit(1);

        if (!coupon) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Invalid coupon code.' });
        }
        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Coupon code has expired.' });
        }
        
        couponId = coupon.id;
        const discountValue = parseFloat(coupon.discountValue);
        
        if (coupon.discountType === 'percentage') {
          finalPriceRupees = basePriceRupees * (1 - (discountValue / 100));
        } else {
          finalPriceRupees = basePriceRupees - discountValue;
        }
        
        finalPriceRupees = Math.max(0, finalPriceRupees);
      }

      const amountPaise = Math.round(finalPriceRupees * 100);

      // === FREE BATCH FLOW ===
      if (amountPaise <= 0) {
        await db.transaction(async (tx) => {
          if (couponId) {
            const [result] = await tx
              .update(schema.batchCoupons)
              .set({ usageCount: sql`${schema.batchCoupons.usageCount} + 1` })
              .where(
                and(
                  eq(schema.batchCoupons.id, couponId),
                  or(
                    isNull(schema.batchCoupons.usageLimit),
                    sql`${schema.batchCoupons.usageCount} < ${schema.batchCoupons.usageLimit}`
                  )
                )
              );
            if (result.affectedRows === 0) {
              throw new TRPCError({ code: 'CONFLICT', message: 'Coupon is fully used' });
            }
          }

          await tx.insert(schema.member)
            .values({
              id: crypto.randomUUID(),
              organizationId: batch.orgId,
              userId: ctx.userId!,
              role: 'student',
              createdAt: new Date(),
            })
            .onConflictDoUpdate({ target: [schema.member.userId, schema.member.organizationId], set: { organizationId: batch.orgId } });

          await tx.insert(schema.enrollments)
            .values({
              batchId: batch.id,
              userId: ctx.userId!,
              orgId: batch.orgId,
              status: 'active',
            })
            .onConflictDoUpdate({ target: [schema.enrollments.batchId, schema.enrollments.userId], set: { status: 'active' } });
        });

        return { success: true, batchId: batch.id, alreadyEnrolled: false, amountPaise: 0 };
      }

      // === PAID BATCH FLOW ===
      if (!org.razorpayLinkedAccountId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Institution is not configured to receive payments.' });
      }

      // 4. Calculate Split
      const platformFeeRate = parseFloat(org.platformFeeRate ?? '0.0500');
      const platformFeePaise = Math.round(amountPaise * platformFeeRate);
      const institutionPaise = amountPaise - platformFeePaise;

      // 5. Generate Razorpay Order
      const Razorpay = (await import('razorpay')).default;
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || 'dummy',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy'
      });

      const orderOptions = {
        amount: amountPaise,
        currency: "INR",
        transfers: [
          {
            account: org.razorpayLinkedAccountId,
            amount: institutionPaise,
            currency: "INR",
            on_hold: 0
          }
        ]
      };

      let razorpayOrder;
      try {
        if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'dummy') {
          razorpayOrder = await razorpay.orders.create(orderOptions);
        } else {
          razorpayOrder = { id: 'order_mock_' + crypto.randomUUID() };
        }
      } catch (error: any) {
        console.error('Razorpay Order Error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Payment gateway error. Please try again later.' });
      }

      // 6. Database Transaction
      const orderId = crypto.randomUUID();
      await db.transaction(async (tx) => {
        if (couponId) {
          const [result] = await tx
            .update(schema.batchCoupons)
            .set({ usageCount: sql`${schema.batchCoupons.usageCount} + 1` })
            .where(
              and(
                eq(schema.batchCoupons.id, couponId),
                or(
                  isNull(schema.batchCoupons.usageLimit),
                  sql`${schema.batchCoupons.usageCount} < ${schema.batchCoupons.usageLimit}`
                )
              )
            );
          if (result.affectedRows === 0) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Coupon is fully used' });
          }
        }

        // Optimistic enrollment
        await tx.insert(schema.enrollments)
          .values({
            batchId: batch.id,
            userId: ctx.userId!,
            orgId: batch.orgId,
            status: 'pending_payment',
          })
          .onConflictDoUpdate({ target: [schema.enrollments.batchId, schema.enrollments.userId], set: { status: 'pending_payment' } });

        // Insert Order
        await tx.insert(schema.orders)
          .values({
            id: orderId,
            studentId: ctx.userId!,
            batchId: batch.id,
            orgId: batch.orgId,
            amountPaise,
            platformFeePaise,
            platformFeeRate: platformFeeRate.toString(),
            institutionPaise,
            currency: 'INR',
            status: 'created',
            razorpayOrderId: razorpayOrder.id,
          });
      });

      return {
        success: true,
        batchId: batch.id,
        alreadyEnrolled: false,
        amountPaise,
        orderId,
        razorpayOrderId: razorpayOrder.id,
        batchName: batch.name
      };
    }),

  resumeOrReplacePaymentOrder: studentProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      // 1. Fetch the existing order row for (studentId, batchId) where status IN ('created', 'failed')
      const [existingOrder] = await db.select()
        .from(schema.orders)
        .where(and(
          eq(schema.orders.studentId, ctx.userId),
          eq(schema.orders.batchId, input.batchId),
          inArray(schema.orders.status, ['created', 'failed'])
        ))
        .orderBy(schema.orders.createdAt)
        .limit(1);

      if (!existingOrder) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No pending order found for this batch.' });
      }

      const Razorpay = (await import('razorpay')).default;
      let razorpay;
      try {
        razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID || 'dummy',
          key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy'
        });
      } catch (e) {
        // Just fail safe if env missing
      }

      let isExpired = false;

      // 2. Check Razorpay order status if it was not already failed
      if (existingOrder.status === 'failed') {
        isExpired = true;
      } else {
        try {
          if (razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'dummy') {
            const rzpOrder = await razorpay.orders.fetch(existingOrder.razorpayOrderId);
            if (rzpOrder.status !== 'created' && rzpOrder.status !== 'attempted') {
              isExpired = true;
            }
          }
        } catch (error: any) {
          if (error?.statusCode === 400 || error?.statusCode === 404) {
            isExpired = true;
          } else {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to verify payment status.' });
          }
        }
      }

      // 3. Return existing if not expired
      if (!isExpired) {
        return {
          razorpayOrderId: existingOrder.razorpayOrderId,
          amountPaise: existingOrder.amountPaise
        };
      }

      // 4. Expired: Create new order
      const orderOptions = {
        amount: existingOrder.amountPaise,
        currency: "INR",
        transfers: [
          {
            account: await db.query.organization.findFirst({ where: eq(schema.organization.id, existingOrder.orgId) }).then(o => o?.razorpayLinkedAccountId),
            amount: existingOrder.institutionPaise,
            currency: "INR",
            on_hold: 0
          }
        ]
      };

      let newRazorpayOrder;
      try {
        if (razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'dummy') {
          newRazorpayOrder = await razorpay.orders.create(orderOptions);
        } else {
          newRazorpayOrder = { id: 'order_mock_' + crypto.randomUUID() };
        }
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create new payment order.' });
      }

      await db.update(schema.orders)
        .set({ razorpayOrderId: newRazorpayOrder.id, updatedAt: new Date() })
        .where(eq(schema.orders.id, existingOrder.id));

      return {
        razorpayOrderId: newRazorpayOrder.id,
        amountPaise: existingOrder.amountPaise
      };
    }),

  getBatchContent: studentProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId || !ctx.userId) throw new TRPCError({ code: 'FORBIDDEN' });

      // 1. Verify active enrollment for this specific batch
      const [enrollment] = await db.select()
        .from(schema.enrollments)
        .where(and(
          eq(schema.enrollments.orgId, ctx.tenantId),
          eq(schema.enrollments.userId, ctx.userId),
          eq(schema.enrollments.batchId, input.batchId),
          eq(schema.enrollments.status, 'active')
        ))
        .limit(1);
      if (!enrollment) throw new TRPCError({ code: 'FORBIDDEN' });

      // 2. Verify batch is active (and belongs to this org)
      const [batchData] = await db.select({
        batch: schema.batches,
        domain: { id: schema.taxonomyDomains.id, name: schema.taxonomyDomains.name },
        course: { id: schema.taxonomyCourses.id, name: schema.taxonomyCourses.name },
        level: { id: schema.taxonomyLevels.id, name: schema.taxonomyLevels.name },
      })
        .from(schema.batches)
        .innerJoin(schema.taxonomyLevels, eq(schema.taxonomyLevels.id, schema.batches.levelId))
        .innerJoin(schema.taxonomyCourses, eq(schema.taxonomyCourses.id, schema.taxonomyLevels.courseId))
        .innerJoin(schema.taxonomyDomains, eq(schema.taxonomyDomains.id, schema.taxonomyCourses.domainId))
        .where(and(
          eq(schema.batches.id, input.batchId),
          eq(schema.batches.orgId, ctx.tenantId),
          eq(schema.batches.isActive, true)
        ))
        .limit(1);
      if (!batchData) throw new TRPCError({ code: 'FORBIDDEN' });

      // 3. Fetch videos for batch taxonomy (institution + global)
      const videos = await db.select()
        .from(schema.videoAssets)
        .where(and(
          eq(schema.videoAssets.level, batchData.batch.levelId),
          or(
            eq(schema.videoAssets.tenantId, ctx.tenantId),
            isNull(schema.videoAssets.tenantId)
          )
        ))
        .orderBy(schema.videoAssets.sortOrder, schema.videoAssets.createdAt);

      // 4. Fetch progress for this student for these videos
      const videoIds = videos.map(v => v.id);
      const progressRows = videoIds.length > 0
        ? await db.select()
            .from(schema.studentVideoProgress)
            .where(and(
              eq(schema.studentVideoProgress.userId, ctx.userId),
              inArray(schema.studentVideoProgress.videoId, videoIds)
            ))
        : [];

      // 5. Merge
      const progressMap = new Map(progressRows.map(p => [p.videoId, p]));
      const enrichedVideos = videos.map(v => {
        const p = progressMap.get(v.id);
        return {
          id: v.id,
          title: v.title,
          provider: v.provider,
          providerVideoId: v.providerVideoId,
          thumbnailUrl: v.thumbnailUrl ?? null,
          duration: v.durationSeconds ?? null,
          bookTag: v.bookTag ?? null,
          progress: p
            ? {
                watchedSeconds: p.maxWatchedSeconds ?? 0,
                completed: Number(p.completionPercentage ?? 0) >= COMPLETION_THRESHOLD,
                lastWatchedAt: p.lastWatchedAt ?? null,
              }
            : null,
        };
      });

      return {
        batch: {
          batchId: batchData.batch.id,
          batchName: batchData.batch.name,
          domain: batchData.domain,
          course: batchData.course,
          level: batchData.level,
        },
        videos: enrichedVideos,
      };
    }),

  getBatchAnnouncements: studentProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId || !ctx.userId) throw new TRPCError({ code: 'FORBIDDEN' });

      // Dual-gate enrollment check
      const [enrollment] = await db.select()
        .from(schema.enrollments)
        .innerJoin(schema.batches, eq(schema.batches.id, schema.enrollments.batchId))
        .where(and(
          eq(schema.enrollments.orgId, ctx.tenantId),
          eq(schema.enrollments.userId, ctx.userId),
          eq(schema.enrollments.batchId, input.batchId),
          eq(schema.enrollments.status, 'active'),
          eq(schema.batches.isActive, true)
        ))
        .limit(1);

      if (!enrollment) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this batch.' });
      }

      return db.select({
        id: schema.announcements.id,
        title: schema.announcements.title,
        body: schema.announcements.body,
        isPinned: schema.announcements.isPinned,
        createdAt: schema.announcements.createdAt,
        authorName: schema.user.name,
      })
      .from(schema.announcements)
      .leftJoin(schema.user, eq(schema.user.id, schema.announcements.authorId))
      .where(eq(schema.announcements.batchId, input.batchId))
      .orderBy(sql`${schema.announcements.isPinned} DESC`, sql`${schema.announcements.createdAt} DESC`)
      .limit(20);
    }),

  getProgressSummary: studentProcedure.query(async ({ ctx }) => {
    // 1. Get user's active batches
    const activeEnrollments = await db.select({
      batchId: schema.enrollments.batchId,
      levelId: schema.batches.levelId,
      batchName: schema.batches.name,
      courseName: schema.taxonomyCourses.name,
      domainName: schema.taxonomyDomains.name,
    })
      .from(schema.enrollments)
      .innerJoin(schema.batches, eq(schema.batches.id, schema.enrollments.batchId))
      .innerJoin(schema.taxonomyLevels, eq(schema.taxonomyLevels.id, schema.batches.levelId))
      .innerJoin(schema.taxonomyCourses, eq(schema.taxonomyCourses.id, schema.taxonomyLevels.courseId))
      .innerJoin(schema.taxonomyDomains, eq(schema.taxonomyDomains.id, schema.taxonomyCourses.domainId))
      .where(and(
        eq(schema.enrollments.userId, ctx.userId!),
        eq(schema.enrollments.orgId, ctx.tenantId!),
        eq(schema.enrollments.status, 'active'),
        eq(schema.batches.isActive, true)
      ));

    if (activeEnrollments.length === 0) {
      return { overallStats: { videosWatched: 0, completedVideos: 0, avgCompletion: 0 }, batches: [] };
    }

    const levelIds = Array.from(new Set(activeEnrollments.map(e => e.levelId)));

    // 2. Fetch all videos for these levels
    const videos = await db.select({
      id: schema.videoAssets.id,
      level: schema.videoAssets.level,
    })
      .from(schema.videoAssets)
      .where(and(
        inArray(schema.videoAssets.level, levelIds),
        or(
          eq(schema.videoAssets.tenantId, ctx.tenantId!),
          isNull(schema.videoAssets.tenantId)
        )
      ));

    const videoIds = videos.map(v => v.id);

    // 3. Fetch progress for these videos in one query
    const progressRows = videoIds.length > 0
      ? await db.select({
          videoId: schema.studentVideoProgress.videoId,
          completionPercentage: schema.studentVideoProgress.completionPercentage,
          lastWatchedAt: schema.studentVideoProgress.lastWatchedAt,
        })
          .from(schema.studentVideoProgress)
          .where(and(
            eq(schema.studentVideoProgress.userId, ctx.userId!),
            inArray(schema.studentVideoProgress.videoId, videoIds)
          ))
      : [];

    const progressMap = new Map(progressRows.map(p => [p.videoId, p]));

    let totalVideosWatched = 0;
    let totalCompleted = 0;
    let totalPctSum = 0;

    // Group videos by levelId
    const videosByLevel = new Map<string, typeof videos>();
    videos.forEach(v => {
      if (!videosByLevel.has(v.level)) videosByLevel.set(v.level, []);
      videosByLevel.get(v.level)!.push(v);
    });

    const batchSummaries = activeEnrollments.map(enroll => {
      const levelVideos = videosByLevel.get(enroll.levelId) || [];
      const totalVideos = levelVideos.length;
      let watched = 0;
      let completed = 0;
      let pctSum = 0;

      levelVideos.forEach(v => {
        const p = progressMap.get(v.id);
        if (p) {
          watched++;
          const pct = Number(p.completionPercentage ?? 0);
          pctSum += pct;
          if (pct >= COMPLETION_THRESHOLD) completed++;
        }
      });

      totalVideosWatched += watched;
      totalCompleted += completed;
      totalPctSum += pctSum;

      return {
        batchId: enroll.batchId,
        batchName: enroll.batchName,
        courseName: enroll.courseName,
        domainName: enroll.domainName,
        stats: {
          totalVideos,
          videosWatched: watched,
          completedVideos: completed,
          avgCompletion: watched > 0 ? pctSum / watched : 0,
        }
      };
    });

    return {
      overallStats: {
        videosWatched: totalVideosWatched,
        completedVideos: totalCompleted,
        avgCompletion: totalVideosWatched > 0 ? totalPctSum / totalVideosWatched : 0,
      },
      batches: batchSummaries
    };
  }),

  upsertVideoProgress: studentProcedure
    .input(z.object({
      videoId:        z.string(),
      watchedSeconds: z.number().int().min(0),
      duration:       z.number().int().min(1),
      completed:      z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId || !ctx.userId) throw new TRPCError({ code: 'FORBIDDEN' });

      // Find the video
      const [video] = await db.select()
        .from(schema.videoAssets)
        .where(eq(schema.videoAssets.id, input.videoId))
        .limit(1);
      if (!video) throw new TRPCError({ code: 'FORBIDDEN' });

      // Verify the student has an active enrollment in a batch whose taxonomy matches this video
      const [valid] = await db.select({ one: sql`1` })
        .from(schema.enrollments)
        .innerJoin(schema.batches, eq(schema.batches.id, schema.enrollments.batchId))
        .where(and(
          eq(schema.enrollments.orgId, ctx.tenantId),
          eq(schema.enrollments.userId, ctx.userId),
          eq(schema.enrollments.status, 'active'),
          eq(schema.batches.isActive, true),
          eq(schema.batches.levelId, video.level)
        ))
        .limit(1);
      if (!valid) throw new TRPCError({ code: 'FORBIDDEN' });

      const completionPercentage = input.completed
        ? 100.00
        : Math.min(99.99, (input.watchedSeconds / input.duration) * 100);

      const completionString = completionPercentage.toFixed(2);

      await db.insert(schema.studentVideoProgress)
        .values({
          userId: ctx.userId,
          videoId: input.videoId,
          tenantId: ctx.tenantId,
          maxWatchedSeconds: input.watchedSeconds,
          completionPercentage: completionString,
          lastWatchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.studentVideoProgress.userId, schema.studentVideoProgress.videoId],
          set: {
            maxWatchedSeconds: sql`GREATEST(max_watched_seconds, ${input.watchedSeconds})`,
            completionPercentage: sql`GREATEST(completion_percentage, ${completionString})`,
            lastWatchedAt: new Date(),
          },
        });
    }),

  claimBatchCertificate: studentProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId || !ctx.userId) throw new TRPCError({ code: 'FORBIDDEN' });

      // 1. Dual-gate: verify active enrollment and active batch
      const [enrollment] = await db
        .select({ 
          batchName: schema.batches.name,
          levelId: schema.batches.levelId,
          userEmail: schema.user.email
        })
        .from(schema.enrollments)
        .innerJoin(schema.batches, eq(schema.batches.id, schema.enrollments.batchId))
        .innerJoin(schema.user, eq(schema.user.id, schema.enrollments.userId))
        .where(and(
          eq(schema.enrollments.batchId, input.batchId),
          eq(schema.enrollments.userId, ctx.userId),
          eq(schema.enrollments.status, 'active'),
          eq(schema.batches.isActive, true)
        ))
        .limit(1);

      if (!enrollment) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No active enrollment in this batch' });
      }

      // 2. Idempotency check: already claimed?
      const [existing] = await db
        .select()
        .from(schema.certificates)
        .where(and(
          eq(schema.certificates.userId, ctx.userId),
          eq(schema.certificates.batchId, input.batchId)
        ))
        .limit(1);

      if (existing) {
        return existing;
      }

      // 3. Completion check
      const [{ videoCount }] = await db
        .select({ videoCount: count() })
        .from(schema.videoAssets)
        .where(and(
          eq(schema.videoAssets.level, enrollment.levelId),
          or(eq(schema.videoAssets.tenantId, ctx.tenantId), isNull(schema.videoAssets.tenantId))
        ));

      if (videoCount === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No videos to complete' });
      }

      const [{ completedCount }] = await db
        .select({ completedCount: count() })
        .from(schema.studentVideoProgress)
        .innerJoin(schema.videoAssets, eq(schema.videoAssets.id, schema.studentVideoProgress.videoId))
        .where(and(
          eq(schema.studentVideoProgress.userId, ctx.userId),
          gte(schema.studentVideoProgress.completionPercentage, COMPLETION_THRESHOLD.toFixed(2)),
          eq(schema.videoAssets.level, enrollment.levelId),
          or(eq(schema.videoAssets.tenantId, ctx.tenantId), isNull(schema.videoAssets.tenantId))
        ));

      if (completedCount < videoCount) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not all videos are completed' });
      }

      // 4. Generate Certificate
      const year = new Date().getFullYear();
      const randomPart = crypto.randomUUID().slice(0, 8).toUpperCase();
      const certificateNumber = `CERT-${year}-${randomPart}`;
      const certId = crypto.randomUUID();

      await db.insert(schema.certificates).values({
        id: certId,
        userId: ctx.userId,
        batchId: input.batchId,
        orgId: ctx.tenantId,
        certificateNumber
      });

      const [newCert] = await db.select()
        .from(schema.certificates)
        .where(eq(schema.certificates.id, certId));

      // 5. Send notification email
      if (enrollment.userEmail) {
        // App URL from env, with fallback for local dev
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const certUrl = `${appUrl}/dashboard/student/certificates/${certId}`;
        
        await sendEmail({
          to: enrollment.userEmail,
          subject: `Your Certificate for ${enrollment.batchName} is ready!`,
          html: emailLayout({
            heading: `Congratulations!`,
            body: `<p>You have successfully completed all videos for <b>${enrollment.batchName}</b>.</p><p>Your completion certificate (ID: ${certificateNumber}) is now available.</p>`,
            ctaLabel: 'View Certificate',
            ctaUrl: certUrl
          })
        });
      }

      return newCert;
    }),

  getMyCertificates: studentProcedure
    .query(async ({ ctx }) => {
      if (!ctx.userId) throw new TRPCError({ code: 'FORBIDDEN' });

      // Return certificates joined with batch and org details
      const rows = await db
        .select({
          certificate: schema.certificates,
          batchName: schema.batches.name,
          orgName: schema.organization.name
        })
        .from(schema.certificates)
        .innerJoin(schema.batches, eq(schema.batches.id, schema.certificates.batchId))
        .innerJoin(schema.organization, eq(schema.organization.id, schema.certificates.orgId))
        .where(eq(schema.certificates.userId, ctx.userId))
        .orderBy(desc(schema.certificates.issuedAt));

      return rows.map(r => ({
        id: r.certificate.id,
        certificateNumber: r.certificate.certificateNumber,
        issuedAt: r.certificate.issuedAt,
        batchName: r.batchName,
        orgName: r.orgName
      }));
    }),

  // ── Phase 24: MCQ Quiz Module ───────────────────────────────────────────────

  getBatchQuizzes: studentProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 1. Dual-gate: verify active enrollment
      const [enrollment] = await db.select()
        .from(schema.enrollments)
        .where(and(
          eq(schema.enrollments.userId, ctx.userId!),
          eq(schema.enrollments.batchId, input.batchId),
          eq(schema.enrollments.status, 'active')
        ))
        .limit(1);
      if (!enrollment) throw new TRPCError({ code: 'FORBIDDEN' });

      const quizzes = await db.select({
        id: schema.quizzes.id,
        title: schema.quizzes.title,
        timeLimitMinutes: schema.quizzes.timeLimitMinutes,
        passingScore: schema.quizzes.passingScore,
        allowMultipleAttempts: schema.quizzes.allowMultipleAttempts,
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

      const attempts = quizIds.length > 0 ? await db.select({
        quizId: schema.quizAttempts.quizId,
        score: schema.quizAttempts.score,
        completedAt: schema.quizAttempts.completedAt,
      })
      .from(schema.quizAttempts)
      .where(and(
        inArray(schema.quizAttempts.quizId, quizIds),
        eq(schema.quizAttempts.userId, ctx.userId!)
      )) : [];

      const questionCountMap = new Map(questionCounts.map(q => [q.quizId, Number(q.count)]));
      
      const quizAttemptsMap = new Map<string, typeof attempts>();
      attempts.forEach(a => {
        if (!quizAttemptsMap.has(a.quizId)) quizAttemptsMap.set(a.quizId, []);
        quizAttemptsMap.get(a.quizId)!.push(a);
      });

      return quizzes.map(q => {
        const qAttempts = quizAttemptsMap.get(q.id) || [];
        const completedAttempts = qAttempts.filter(a => a.completedAt !== null);
        let bestScore = null;
        if (completedAttempts.length > 0) {
          bestScore = Math.max(...completedAttempts.map(a => Number(a.score) || 0));
        }
        return {
          ...q,
          questionCount: questionCountMap.get(q.id) || 0,
          attemptCount: completedAttempts.length,
          bestScore,
        };
      }).filter(q => q.questionCount > 0);
    }),

  startQuizAttempt: studentProcedure
    .input(z.object({ quizId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [quiz] = await db.select({
        id: schema.quizzes.id,
        batchId: schema.quizzes.batchId,
        orgId: schema.quizzes.orgId,
        allowMultipleAttempts: schema.quizzes.allowMultipleAttempts,
        shuffleQuestions: schema.quizzes.shuffleQuestions,
        timeLimitMinutes: schema.quizzes.timeLimitMinutes,
      })
      .from(schema.quizzes)
      .where(eq(schema.quizzes.id, input.quizId))
      .limit(1);
      if (!quiz) throw new TRPCError({ code: 'NOT_FOUND' });

      // Dual-gate: verify active enrollment
      const [enrollment] = await db.select()
        .from(schema.enrollments)
        .where(and(
          eq(schema.enrollments.userId, ctx.userId!),
          eq(schema.enrollments.batchId, quiz.batchId),
          eq(schema.enrollments.status, 'active')
        ))
        .limit(1);
      if (!enrollment) throw new TRPCError({ code: 'FORBIDDEN' });

      if (!quiz.allowMultipleAttempts) {
        const [existing] = await db.select()
          .from(schema.quizAttempts)
          .where(and(
            eq(schema.quizAttempts.quizId, input.quizId),
            eq(schema.quizAttempts.userId, ctx.userId!),
            sql`${schema.quizAttempts.completedAt} IS NOT NULL`
          ))
          .limit(1);
        if (existing) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Multiple attempts are not allowed for this quiz.' });
        }
      }

      const questionsData = await db.select({
        id: schema.quizQuestions.id,
        text: schema.quizQuestions.questionText,
      })
      .from(schema.quizQuestions)
      .where(eq(schema.quizQuestions.quizId, input.quizId))
      .orderBy(schema.quizQuestions.sortOrder);

      if (questionsData.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quiz has no questions.' });
      }

      const qIds = questionsData.map(q => q.id);
      const optionsData = await db.select({
        id: schema.quizOptions.id,
        questionId: schema.quizOptions.questionId,
        text: schema.quizOptions.optionText,
      })
      .from(schema.quizOptions)
      .where(inArray(schema.quizOptions.questionId, qIds))
      .orderBy(schema.quizOptions.sortOrder);

      let questions = questionsData.map(q => ({
        id: q.id,
        text: q.text,
        options: optionsData.filter(o => o.questionId === q.id).map(o => ({ id: o.id, text: o.text })),
      }));

      if (quiz.shuffleQuestions) {
        // Fisher-Yates shuffle questions
        for (let i = questions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questions[i], questions[j]] = [questions[j], questions[i]];
        }
        // Shuffle options within each question
        questions.forEach(q => {
          for (let i = q.options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
          }
        });
      }

      const attemptId = crypto.randomUUID();
      const startedAt = new Date();

      await db.insert(schema.quizAttempts).values({
        id: attemptId,
        quizId: input.quizId,
        userId: ctx.userId!,
        orgId: quiz.orgId,
        totalQuestions: questions.length,
        startedAt,
      });

      return {
        attemptId,
        questions,
        timeLimitMinutes: quiz.timeLimitMinutes,
        startedAt,
      };
    }),

  submitQuizAttempt: studentProcedure
    .input(z.object({
      attemptId: z.string(),
      answers: z.array(z.object({
        questionId: z.string(),
        selectedOptionId: z.string().nullable(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const [attempt] = await db.select({
        id: schema.quizAttempts.id,
        userId: schema.quizAttempts.userId,
        quizId: schema.quizAttempts.quizId,
        totalQuestions: schema.quizAttempts.totalQuestions,
        completedAt: schema.quizAttempts.completedAt,
      })
      .from(schema.quizAttempts)
      .where(eq(schema.quizAttempts.id, input.attemptId))
      .limit(1);

      if (!attempt) throw new TRPCError({ code: 'NOT_FOUND' });
      if (attempt.userId !== ctx.userId!) throw new TRPCError({ code: 'FORBIDDEN' });
      if (attempt.completedAt !== null) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Attempt already completed.' });

      const [quiz] = await db.select({ passingScore: schema.quizzes.passingScore })
        .from(schema.quizzes)
        .where(eq(schema.quizzes.id, attempt.quizId))
        .limit(1);

      const optionsData = await db.select({
        id: schema.quizOptions.id,
        questionId: schema.quizOptions.questionId,
        isCorrect: schema.quizOptions.isCorrect,
      })
      .from(schema.quizOptions)
      .innerJoin(schema.quizQuestions, eq(schema.quizQuestions.id, schema.quizOptions.questionId))
      .where(eq(schema.quizQuestions.quizId, attempt.quizId));

      const correctOptionMap = new Map<string, string>();
      optionsData.forEach(o => {
        if (o.isCorrect) correctOptionMap.set(o.questionId, o.id);
      });

      let correctAnswers = 0;
      const answerInserts = input.answers.map(ans => {
        const correctOptionId = correctOptionMap.get(ans.questionId);
        const isCorrect = ans.selectedOptionId !== null && ans.selectedOptionId === correctOptionId;
        if (isCorrect) correctAnswers++;

        return {
          id: crypto.randomUUID(),
          attemptId: input.attemptId,
          questionId: ans.questionId,
          selectedOptionId: ans.selectedOptionId,
          isCorrect,
        };
      });

      const score = (correctAnswers / attempt.totalQuestions) * 100;
      const passed = quiz?.passingScore ? score >= Number(quiz.passingScore) : null;

      await db.transaction(async (tx) => {
        if (answerInserts.length > 0) {
          await tx.insert(schema.quizAnswers).values(answerInserts);
        }
        await tx.update(schema.quizAttempts).set({
          score: score.toString(),
          correctAnswers,
          completedAt: new Date(),
        }).where(eq(schema.quizAttempts.id, input.attemptId));
      });

      return {
        score,
        correctAnswers,
        totalQuestions: attempt.totalQuestions,
        passed,
      };
    }),

  getAttemptResult: studentProcedure
    .input(z.object({ attemptId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [attempt] = await db.select({
        id: schema.quizAttempts.id,
        userId: schema.quizAttempts.userId,
        quizId: schema.quizAttempts.quizId,
        score: schema.quizAttempts.score,
        totalQuestions: schema.quizAttempts.totalQuestions,
        correctAnswers: schema.quizAttempts.correctAnswers,
      })
      .from(schema.quizAttempts)
      .where(eq(schema.quizAttempts.id, input.attemptId))
      .limit(1);

      if (!attempt) throw new TRPCError({ code: 'NOT_FOUND' });
      if (attempt.userId !== ctx.userId!) throw new TRPCError({ code: 'FORBIDDEN' });

      const [quiz] = await db.select({ passingScore: schema.quizzes.passingScore })
        .from(schema.quizzes)
        .where(eq(schema.quizzes.id, attempt.quizId))
        .limit(1);

      const passed = quiz?.passingScore ? Number(attempt.score) >= Number(quiz.passingScore) : null;

      const answers = await db.select({
        questionId: schema.quizAnswers.questionId,
        selectedOptionId: schema.quizAnswers.selectedOptionId,
        isCorrect: schema.quizAnswers.isCorrect,
      })
      .from(schema.quizAnswers)
      .where(eq(schema.quizAnswers.attemptId, input.attemptId));

      const questions = await db.select({
        id: schema.quizQuestions.id,
        text: schema.quizQuestions.questionText,
        explanation: schema.quizQuestions.explanation,
      })
      .from(schema.quizQuestions)
      .where(eq(schema.quizQuestions.quizId, attempt.quizId))
      .orderBy(schema.quizQuestions.sortOrder);

      const options = await db.select({
        id: schema.quizOptions.id,
        questionId: schema.quizOptions.questionId,
        isCorrect: schema.quizOptions.isCorrect,
      })
      .from(schema.quizOptions)
      .where(inArray(schema.quizOptions.questionId, questions.map(q => q.id)));

      const correctOptionMap = new Map<string, string>();
      options.forEach(o => {
        if (o.isCorrect) correctOptionMap.set(o.questionId, o.id);
      });

      const answerMap = new Map(answers.map(a => [a.questionId, a]));

      const breakdown = questions.map(q => {
        const ans = answerMap.get(q.id);
        return {
          questionId: q.id,
          questionText: q.text,
          selectedOptionId: ans?.selectedOptionId ?? null,
          correctOptionId: correctOptionMap.get(q.id)!,
          explanation: q.explanation,
          isCorrect: ans?.isCorrect ?? false,
        };
      });

      return {
        score: Number(attempt.score) || 0,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers || 0,
        passed,
        breakdown,
      };
    }),

  // ============================================================================
  // PHASE 25A — STUDENT ANALYTICS
  // ============================================================================

  logLearningEvent: studentProcedure
    .input(z.object({
      batchId:   z.string().uuid().optional(),
      eventType: z.enum(['video_play','video_pause','video_seek','video_complete',
                         'video_speed_change','quiz_start','quiz_submit',
                         'session_start','session_end']),
      metadata:  z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      await db.insert(schema.learningEvents).values({
        id: crypto.randomUUID(),
        userId: ctx.userId!,
        orgId: tenantId,
        batchId: input.batchId,
        eventType: input.eventType,
        metadata: input.metadata || null
      });
      return { success: true };
    }),

  getMyActivityHeatmap: studentProcedure
    .input(z.object({ batchId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      // Get events from the last 28 days
      const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
      
      let conditions = [
        eq(schema.learningEvents.userId, ctx.userId!),
        eq(schema.learningEvents.orgId, tenantId),
        gte(schema.learningEvents.createdAt, twentyEightDaysAgo),
        eq(schema.learningEvents.eventType, 'video_complete')
      ];

      if (input.batchId) {
        conditions.push(eq(schema.learningEvents.batchId, input.batchId));
      }

      const rows = await db.select({
        dateStr: sql<string>`DATE(${schema.learningEvents.createdAt})`,
        metadata: schema.learningEvents.metadata
      }).from(schema.learningEvents)
        .where(and(...conditions));

      const dateMap = new Map<string, number>();
      for (const row of rows) {
        let watchedSeconds = 0;
        if (row.metadata && typeof row.metadata === 'object') {
          const meta = row.metadata as any;
          if (typeof meta.watchedSeconds === 'number') {
            watchedSeconds = meta.watchedSeconds;
          }
        }
        const min = Math.round(watchedSeconds / 60);
        dateMap.set(row.dateStr, (dateMap.get(row.dateStr) || 0) + min);
      }

      return Array.from(dateMap.entries()).map(([date, minutes]) => ({ date, minutes }));
    }),

  getMyBatchAnalytics: studentProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      // Enrollment dual-gate
      const [enrollment] = await db.select().from(schema.enrollments)
        .where(and(
          eq(schema.enrollments.userId, ctx.userId!),
          eq(schema.enrollments.batchId, input.batchId),
          eq(schema.enrollments.orgId, tenantId),
          eq(schema.enrollments.status, 'active')
        )).limit(1);

      if (!enrollment) throw new TRPCError({ code: 'FORBIDDEN', message: 'Not actively enrolled in this batch.' });

      // Fetch snapshot for current user to get rank
      const snapshots = await db.select({
        userId: schema.studentEngagementSnapshots.userId,
        engagementScore: schema.studentEngagementSnapshots.engagementScore,
        myRank: sql<number>`RANK() OVER (PARTITION BY ${schema.studentEngagementSnapshots.batchId} ORDER BY ${schema.studentEngagementSnapshots.engagementScore} DESC)`,
        totalStudents: sql<number>`COUNT(*) OVER (PARTITION BY ${schema.studentEngagementSnapshots.batchId})`
      }).from(schema.studentEngagementSnapshots)
        .where(and(
          eq(schema.studentEngagementSnapshots.batchId, input.batchId),
          eq(schema.studentEngagementSnapshots.weekOf, sql`(SELECT MAX(week_of) FROM ${schema.studentEngagementSnapshots} WHERE batch_id = ${input.batchId})`)
        ));

      if (snapshots.length === 0) {
        return {
          rankAvailable: false,
          myRank: null,
          totalStudents: 0,
          percentile: null,
          myEngagementScore: 0,
          myCompletion: 0,
          myQuizAvg: null,
          myStreakDays: 0,
          batchAvgCompletion: 0,
          batchAvgQuizScore: null
        };
      }

      const mySnap = snapshots.find(s => s.userId === ctx.userId!);
      
      const [batchAvg] = await db.select({
        avgQuiz: sql<number>`AVG(${schema.studentEngagementSnapshots.avgQuizScore})`
      }).from(schema.studentEngagementSnapshots)
        .where(and(
          eq(schema.studentEngagementSnapshots.batchId, input.batchId),
          eq(schema.studentEngagementSnapshots.weekOf, sql`(SELECT MAX(week_of) FROM ${schema.studentEngagementSnapshots} WHERE batch_id = ${input.batchId})`)
        ));

      if (!mySnap) {
        // Edge case: snapshot ran but user wasn't in it
        return { rankAvailable: false, myRank: null, totalStudents: snapshots[0].totalStudents, percentile: null, myEngagementScore: 0, myCompletion: 0, myQuizAvg: null, myStreakDays: 0, batchAvgCompletion: 0, batchAvgQuizScore: batchAvg?.avgQuiz || 0 };
      }

      const rank = Number(mySnap.myRank);
      const total = Number(mySnap.totalStudents);
      const percentile = total > 0 ? Math.round((1 - rank / total) * 100) : 100;

      return {
        rankAvailable: true,
        myRank: rank,
        totalStudents: total,
        percentile,
        myEngagementScore: Number(mySnap.engagementScore),
        myCompletion: 0, // This could be fetched from DB
        myQuizAvg: 0, // This could be fetched from DB
        myStreakDays: 0, // This could be fetched from DB
        batchAvgCompletion: 0, // This could be fetched from DB
        batchAvgQuizScore: Number(batchAvg?.avgQuiz) || 0
      };
    }),

  getMyAnonymousRanking: studentProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenantId!;
      const [enrollment] = await db.select().from(schema.enrollments)
        .where(and(
          eq(schema.enrollments.userId, ctx.userId!),
          eq(schema.enrollments.batchId, input.batchId),
          eq(schema.enrollments.orgId, tenantId),
          eq(schema.enrollments.status, 'active')
        )).limit(1);

      if (!enrollment) throw new TRPCError({ code: 'FORBIDDEN' });

      const snapshots = await db.select({
        userId: schema.studentEngagementSnapshots.userId,
        engagementScore: schema.studentEngagementSnapshots.engagementScore,
      }).from(schema.studentEngagementSnapshots)
        .where(and(
          eq(schema.studentEngagementSnapshots.batchId, input.batchId),
          eq(schema.studentEngagementSnapshots.weekOf, sql`(SELECT MAX(week_of) FROM ${schema.studentEngagementSnapshots} WHERE batch_id = ${input.batchId})`)
        )).orderBy(desc(schema.studentEngagementSnapshots.engagementScore));

      return snapshots.map(s => ({
        score: Number(s.engagementScore),
        isYou: s.userId === ctx.userId!
      }));
    }),

  getMyYearlyGrowth: studentProcedure
    .query(async ({ ctx }) => {
      const currentYear = new Date().getFullYear();
      
      const rows = await db.select().from(schema.studentYearlyGrowth)
        .where(eq(schema.studentYearlyGrowth.userId, ctx.userId!))
        .orderBy(schema.studentYearlyGrowth.year);

      let hasCurrentYear = rows.some(r => r.year === currentYear);
      if (!hasCurrentYear) {
        // Compute live
        const [[{ sumWatched }]] = await Promise.all([
          db.select({ sumWatched: sql<number>`SUM(max_watched_seconds)` }).from(schema.studentVideoProgress).where(eq(schema.studentVideoProgress.userId, ctx.userId!))
        ]);
        
        const enrollmentsQuery = await db.select({ status: schema.enrollments.status }).from(schema.enrollments).where(eq(schema.enrollments.userId, ctx.userId!));
        const coursesEnrolled = enrollmentsQuery.length;
        const coursesCompleted = enrollmentsQuery.filter(e => e.status === 'completed').length;
        
        const [{ certCount }] = await db.select({ certCount: count() }).from(schema.certificates).where(eq(schema.certificates.userId, ctx.userId!));
        
        const [{ avgQuiz }] = await db.select({ avgQuiz: avg(schema.quizAttempts.score) }).from(schema.quizAttempts).where(eq(schema.quizAttempts.userId, ctx.userId!));

        rows.push({
          id: 'live',
          userId: ctx.userId!,
          year: currentYear,
          totalMinutes: sumWatched ? Math.round(Number(sumWatched) / 60) : 0,
          coursesEnrolled,
          coursesCompleted,
          certificatesEarned: certCount,
          avgQuizScore: avgQuiz ? String(avgQuiz) : null,
          computedAt: new Date()
        } as any);
      }

      return rows.map(r => ({
        ...r,
        avgQuizScore: r.avgQuizScore ? Number(r.avgQuizScore) : null
      }));
    }),

});
