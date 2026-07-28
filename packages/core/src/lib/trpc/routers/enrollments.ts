import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, like, or, sql, asc, isNull, inArray } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../server';
import { db } from '@/db';
import {
  batches,
  enrollments,
  member,
  taxonomyCourses,
  taxonomyDomains,
  taxonomyLevels,
  user,
  batchWaitlist,
} from '@/db/schema';
import { sendEmail } from '@/lib/email/send-email';

// ── Guards ────────────────────────────────────────────────────────────────────

function requireIA(role: string): void {
  if (role !== 'org_admin' && role !== 'owner')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Institution Admin access required.' });
}

function requireSA(role: string): void {
  if (role !== 'super_admin')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super Admin access required.' });
}

// ── MySQL duplicate enrollment guard ──────────────────────────────────────────
// Postgres uses code '23505'; MySQL uses ER_DUP_ENTRY / errno 1062.

function handleDuplicateEnrollment(error: unknown): never {
  const e = error as { code?: string; errno?: number };
  if (e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062)
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Student is already enrolled in this batch.',
    });
  throw error;
}

// ── Batch ownership check (IA only) ───────────────────────────────────────────

async function assertBatchOwnership(batchId: string, tenantId: string): Promise<void> {
  const [row] = await db
    .select({ orgId: batches.orgId })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);
  if (!row)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Batch not found.' });
  if (row.orgId !== tenantId)
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied.' });
}

// ── Waitlist Capacity Check ───────────────────────────────────────────────────

async function checkWaitlist(batchId: string) {
  const [batch] = await db.select({ maxStudents: batches.maxStudents, name: batches.name }).from(batches).where(eq(batches.id, batchId));
  if (!batch || batch.maxStudents === null) return;
  
  const [{ seatsTaken }] = await db
    .select({ seatsTaken: sql<number>`COUNT(*)` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.batchId, batchId),
        inArray(enrollments.status, ['active', 'pending_payment'])
      )
    );

  if (Number(seatsTaken) < batch.maxStudents) {
    const [waitlistEntry] = await db
      .select({ id: batchWaitlist.id, userId: batchWaitlist.userId, email: user.email })
      .from(batchWaitlist)
      .innerJoin(user, eq(batchWaitlist.userId, user.id))
      .where(and(eq(batchWaitlist.batchId, batchId), isNull(batchWaitlist.notifiedAt)))
      .orderBy(asc(batchWaitlist.joinedAt))
      .limit(1);

    if (waitlistEntry) {
      await sendEmail({
        to: waitlistEntry.email,
        subject: `A seat opened in ${batch.name}`,
        html: `<p>A seat has opened up in <strong>${batch.name}</strong>. You can now enroll by visiting your dashboard.</p>`,
      });
      await db.update(batchWaitlist).set({ notifiedAt: sql`CURRENT_TIMESTAMP` }).where(eq(batchWaitlist.id, waitlistEntry.id));
    }
  }
}

// ── Shared select shape ───────────────────────────────────────────────────────

const ENROLLMENT_SELECT = {
  id:         enrollments.id,
  batchId:    enrollments.batchId,
  userId:     enrollments.userId,
  orgId:      enrollments.orgId,
  status:     enrollments.status,
  enrolledAt: enrollments.enrolledAt,
  userName:   user.name,
  userEmail:  user.email,
};

// ── Shared Zod ────────────────────────────────────────────────────────────────

const uuid        = z.string().uuid();
const statusEnum  = z.enum(['active', 'suspended', 'completed']);

// ── Router ────────────────────────────────────────────────────────────────────

export const enrollmentsRouter = createTRPCRouter({

  // ── Institution Admin ──────────────────────────────────────────────────────

  listForBatch: protectedProcedure
    .input(z.object({ batchId: uuid }))
    .query(async ({ ctx, input }) => {
      requireIA(ctx.userRole);
      await assertBatchOwnership(input.batchId, ctx.tenantId!);
      return db
        .select(ENROLLMENT_SELECT)
        .from(enrollments)
        .innerJoin(user, eq(enrollments.userId, user.id))
        .where(eq(enrollments.batchId, input.batchId))
        .orderBy(desc(enrollments.enrolledAt));
    }),

  enroll: protectedProcedure
    .input(z.object({ batchId: uuid, userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireIA(ctx.userRole);
      await assertBatchOwnership(input.batchId, ctx.tenantId!);
      try {
        await db.insert(enrollments).values({
          batchId: input.batchId,
          userId:  input.userId,
          orgId:   ctx.tenantId!,
          status:  'active',
        });
        return { success: true as const };
      } catch (e) {
        handleDuplicateEnrollment(e);
      }
    }),

  unenroll: protectedProcedure
    .input(z.object({ batchId: uuid, userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireIA(ctx.userRole);
      await assertBatchOwnership(input.batchId, ctx.tenantId!);
      await db
        .delete(enrollments)
        .where(
          and(
            eq(enrollments.batchId, input.batchId),
            eq(enrollments.userId,  input.userId),
          ),
        );
        
      await checkWaitlist(input.batchId);
      
      return { success: true as const };
    }),

  setStatus: protectedProcedure
    .input(z.object({ batchId: uuid, userId: z.string(), status: statusEnum }))
    .mutation(async ({ ctx, input }) => {
      requireIA(ctx.userRole);
      await assertBatchOwnership(input.batchId, ctx.tenantId!);
      await db
        .update(enrollments)
        .set({ status: input.status })
        .where(
          and(
            eq(enrollments.batchId, input.batchId),
            eq(enrollments.userId,  input.userId),
          ),
        );
        
      await checkWaitlist(input.batchId);
      
      return { success: true as const };
    }),

  // ── Student search ─────────────────────────────────────────────────────────
  // Searches members of the caller's organisation; marks already-enrolled users.

  searchStudents: protectedProcedure
    .input(z.object({ batchId: uuid, query: z.string().min(2).max(100) }))
    .query(async ({ ctx, input }) => {
      requireIA(ctx.userRole);
      await assertBatchOwnership(input.batchId, ctx.tenantId!);

      const pattern = `%${input.query}%`;

      // 1 — Collect already-enrolled user IDs for this batch
      const alreadyEnrolled = await db
        .select({ userId: enrollments.userId })
        .from(enrollments)
        .where(eq(enrollments.batchId, input.batchId));
      const enrolledSet = new Set(alreadyEnrolled.map((e) => e.userId));

      // 2 — Search org members by name or email
      const results = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .innerJoin(member, eq(user.id, member.userId))
        .where(
          and(
            eq(member.organizationId, ctx.tenantId!),
            or(
              like(user.name,  pattern),
              like(user.email, pattern),
            ),
          ),
        )
        .limit(20);

      return results.map((u) => ({ ...u, enrolled: enrolledSet.has(u.id) }));
    }),

  // ── Student-facing ─────────────────────────────────────────────────────────
  // Returns the batches the current user is actively enrolled in.
  // Replaces the defunct api.batches.listEnrolled consumed by StudentClassroomClient.

  myBatches: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId)
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated.' });

    return db
      .select({
        id:          batches.id,
        name:        batches.name,
        description: batches.description,
        levelId:     batches.levelId,
        courseId:    taxonomyCourses.id,
        domainId:    taxonomyDomains.id,
        status:      enrollments.status,
        enrolledAt:  enrollments.enrolledAt,
      })
      .from(enrollments)
      .innerJoin(batches,         eq(enrollments.batchId,      batches.id))
      .innerJoin(taxonomyLevels,  eq(batches.levelId,          taxonomyLevels.id))
      .innerJoin(taxonomyCourses, eq(taxonomyLevels.courseId,  taxonomyCourses.id))
      .innerJoin(taxonomyDomains, eq(taxonomyCourses.domainId, taxonomyDomains.id))
      .where(
        and(
          eq(enrollments.userId,  ctx.userId),
          eq(enrollments.status,  'active'),
          eq(batches.isActive,    true),
        ),
      )
      .orderBy(desc(enrollments.enrolledAt));
  }),

  // ── Super Admin ────────────────────────────────────────────────────────────

  sa: createTRPCRouter({

    listForBatch: protectedProcedure
      .input(z.object({ batchId: uuid }))
      .query(async ({ ctx, input }) => {
        requireSA(ctx.userRole);
        return db
          .select(ENROLLMENT_SELECT)
          .from(enrollments)
          .innerJoin(user, eq(enrollments.userId, user.id))
          .where(eq(enrollments.batchId, input.batchId))
          .orderBy(desc(enrollments.enrolledAt));
      }),

    enroll: protectedProcedure
      .input(z.object({ batchId: uuid, userId: z.string(), targetOrgId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        requireSA(ctx.userRole);
        try {
          await db.insert(enrollments).values({
            batchId: input.batchId,
            userId:  input.userId,
            orgId:   input.targetOrgId,
            status:  'active',
          });
          return { success: true as const };
        } catch (e) {
          handleDuplicateEnrollment(e);
        }
      }),

    unenroll: protectedProcedure
      .input(z.object({ batchId: uuid, userId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        requireSA(ctx.userRole);
        await db
          .delete(enrollments)
          .where(
            and(
              eq(enrollments.batchId, input.batchId),
              eq(enrollments.userId,  input.userId),
            ),
          );
        return { success: true as const };
      }),

    setStatus: protectedProcedure
      .input(z.object({ batchId: uuid, userId: z.string(), status: statusEnum }))
      .mutation(async ({ ctx, input }) => {
        requireSA(ctx.userRole);
        await db
          .update(enrollments)
          .set({ status: input.status })
          .where(
            and(
              eq(enrollments.batchId, input.batchId),
              eq(enrollments.userId,  input.userId),
            ),
          );
        return { success: true as const };
      }),
  }),
});
