import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, desc } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../server';
import { db } from '@/db';
import { batches, taxonomyLevels, taxonomyCourses, taxonomyDomains } from '@/db/schema';
import { generateJoinCode } from '@/lib/utils/joinCode';

// ── Guards ────────────────────────────────────────────────────────────────────

function requireSuperAdmin(role: string): void {
  if (role !== 'super_admin')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super Admin access required.' });
}

function requireInstitutionAdmin(role: string): void {
  if (role !== 'org_admin' && role !== 'owner')
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Institution Admin access required.' });
}

function handleBatchDeleteConflict(error: unknown): never {
  if ((error as { code?: string })?.code === '23503')
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Cannot delete a batch that has enrolled students. Remove all enrollments first.',
    });
  throw error;
}

// ── Shared select shape ───────────────────────────────────────────────────────

const BATCH_SELECT = {
  id:          batches.id,
  name:        batches.name,
  description: batches.description,
  orgId:       batches.orgId,
  levelId:     batches.levelId,
  price:       batches.price,
  startDate:   batches.startDate,
  isActive:    batches.isActive,
  maxStudents: batches.maxStudents,
  createdAt:   batches.createdAt,
  levelName:   taxonomyLevels.name,
  courseId:    taxonomyCourses.id,
  courseName:  taxonomyCourses.name,
  domainId:    taxonomyDomains.id,
  domainName:  taxonomyDomains.name,
};

// ── Shared Zod ────────────────────────────────────────────────────────────────

const uuid = z.string().uuid();

const WRITE = {
  name:        z.string().min(1, 'Name is required').max(120),
  description: z.string().max(500).optional().nullable(),
  levelId:     uuid,
  price:       z.number().min(0).default(0),
  startDate:   z.string().optional().nullable(),
  isActive:    z.boolean().default(true),
  maxStudents: z.number().int().positive().nullable().optional(),
};

const UPDATE = {
  name:        z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  levelId:     uuid.optional(),
  price:       z.number().min(0).optional(),
  startDate:   z.string().optional().nullable(),
  isActive:    z.boolean().optional(),
  maxStudents: z.number().int().positive().nullable().optional(),
};

// ── Ownership check helper ────────────────────────────────────────────────────

async function assertOwnership(batchId: string, orgId: string) {
  const [row] = await db
    .select({ orgId: batches.orgId })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Batch not found.' });
  if (row.orgId !== orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied.' });
}

function buildUpdates(fields: Record<string, any>) {
  const updates: Record<string, unknown> = {};
  if (fields.name        !== undefined) updates.name        = fields.name;
  if (fields.description !== undefined) updates.description = fields.description;
  if (fields.levelId     !== undefined) updates.levelId     = fields.levelId;
  if (fields.price       !== undefined) updates.price       = String(fields.price);
  if (fields.startDate   !== undefined) updates.startDate   = fields.startDate ? new Date(fields.startDate) : null;
  if (fields.isActive    !== undefined) updates.isActive    = fields.isActive;
  if (fields.maxStudents !== undefined) updates.maxStudents = fields.maxStudents;
  if (Object.keys(updates).length === 0)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Provide at least one field to update.' });
  return updates;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const batchesRouter = createTRPCRouter({

  // ── Institution Admin ──────────────────────────────────────────────────────

  list: protectedProcedure.query(async ({ ctx }) => {
    requireInstitutionAdmin(ctx.userRole);
    return db
      .select(BATCH_SELECT)
      .from(batches)
      .leftJoin(taxonomyLevels,  eq(batches.levelId,         taxonomyLevels.id))
      .leftJoin(taxonomyCourses, eq(taxonomyLevels.courseId,  taxonomyCourses.id))
      .leftJoin(taxonomyDomains, eq(taxonomyCourses.domainId, taxonomyDomains.id))
      .where(eq(batches.orgId, ctx.tenantId!))
      .orderBy(desc(batches.createdAt));
  }),

  getById: protectedProcedure
    .input(z.object({ id: uuid }))
    .query(async ({ ctx, input }) => {
      requireInstitutionAdmin(ctx.userRole);
      const [row] = await db
        .select(BATCH_SELECT)
        .from(batches)
        .leftJoin(taxonomyLevels,  eq(batches.levelId,         taxonomyLevels.id))
        .leftJoin(taxonomyCourses, eq(taxonomyLevels.courseId,  taxonomyCourses.id))
        .leftJoin(taxonomyDomains, eq(taxonomyCourses.domainId, taxonomyDomains.id))
        .where(eq(batches.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Batch not found.' });
      if (row.orgId !== ctx.tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied.' });
      return row;
    }),

  create: protectedProcedure
    .input(z.object(WRITE))
    .mutation(async ({ ctx, input }) => {
      requireInstitutionAdmin(ctx.userRole);
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        const code = generateJoinCode();
        try {
          await db.insert(batches).values({
            orgId: ctx.tenantId!,
            name:        input.name,
            description: input.description,
            levelId:     input.levelId,
            price:       String(input.price),
            startDate:   input.startDate ? new Date(input.startDate) : null,
            isActive:    input.isActive,
            maxStudents: input.maxStudents ?? null,
            joinCode:    code,
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

  update: protectedProcedure
    .input(z.object({ id: uuid, ...UPDATE }))
    .mutation(async ({ ctx, input }) => {
      requireInstitutionAdmin(ctx.userRole);
      const { id, ...fields } = input;
      await assertOwnership(id, ctx.tenantId!);
      await db
        .update(batches)
        .set(buildUpdates(fields))
        .where(eq(batches.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      requireInstitutionAdmin(ctx.userRole);
      await assertOwnership(input.id, ctx.tenantId!);
      try { await db.delete(batches).where(eq(batches.id, input.id)); return { success: true }; }
      catch (e) { handleBatchDeleteConflict(e); }
    }),

  // ── Super Admin ────────────────────────────────────────────────────────────

  sa: createTRPCRouter({

    list: protectedProcedure
      .input(z.object({ targetOrgId: uuid }))
      .query(async ({ ctx, input }) => {
        requireSuperAdmin(ctx.userRole);
        return db
          .select(BATCH_SELECT)
          .from(batches)
          .leftJoin(taxonomyLevels,  eq(batches.levelId,         taxonomyLevels.id))
          .leftJoin(taxonomyCourses, eq(taxonomyLevels.courseId,  taxonomyCourses.id))
          .leftJoin(taxonomyDomains, eq(taxonomyCourses.domainId, taxonomyDomains.id))
          .where(eq(batches.orgId, input.targetOrgId))
          .orderBy(desc(batches.createdAt));
      }),

    getById: protectedProcedure
      .input(z.object({ id: uuid }))
      .query(async ({ ctx, input }) => {
        requireSuperAdmin(ctx.userRole);
        const [row] = await db
          .select(BATCH_SELECT)
          .from(batches)
          .leftJoin(taxonomyLevels,  eq(batches.levelId,         taxonomyLevels.id))
          .leftJoin(taxonomyCourses, eq(taxonomyLevels.courseId,  taxonomyCourses.id))
          .leftJoin(taxonomyDomains, eq(taxonomyCourses.domainId, taxonomyDomains.id))
          .where(eq(batches.id, input.id))
          .limit(1);
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Batch not found.' });
        return row;
      }),

    create: protectedProcedure
      .input(z.object({ targetOrgId: uuid, ...WRITE }))
      .mutation(async ({ ctx, input }) => {
        requireSuperAdmin(ctx.userRole);
        const [row] = await db
          .insert(batches)
          .values({
            orgId: input.targetOrgId,
            name:        input.name,
            description: input.description,
            levelId:     input.levelId,
            price:       String(input.price),
            startDate:   input.startDate ? new Date(input.startDate) : null,
            isActive:    input.isActive,
            maxStudents: input.maxStudents ?? null,
          });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({ id: uuid, ...UPDATE }))
      .mutation(async ({ ctx, input }) => {
        requireSuperAdmin(ctx.userRole);
        const { id, ...fields } = input;
        const [exists] = await db.select({ id: batches.id }).from(batches).where(eq(batches.id, id)).limit(1);
        if (!exists) throw new TRPCError({ code: 'NOT_FOUND', message: 'Batch not found.' });
        await db.update(batches).set(buildUpdates(fields)).where(eq(batches.id, id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: uuid }))
      .mutation(async ({ ctx, input }) => {
        requireSuperAdmin(ctx.userRole);
        const [exists] = await db.select({ id: batches.id }).from(batches).where(eq(batches.id, input.id)).limit(1);
        if (!exists) throw new TRPCError({ code: 'NOT_FOUND', message: 'Batch not found.' });
        try { await db.delete(batches).where(eq(batches.id, input.id)); return { success: true }; }
        catch (e) { handleBatchDeleteConflict(e); }
      }),
  }),
});
