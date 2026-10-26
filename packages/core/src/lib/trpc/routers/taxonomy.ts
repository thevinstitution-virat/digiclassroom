import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, publicProcedure, superAdminProcedure } from '../server'
import { db } from '@/db'
import { taxonomyDomains, taxonomyCourses, taxonomyLevels, taxonomySubjects } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import {
  CurriculumServiceError,
  getCurriculumChildren,
  getCurriculumCombinations,
  getCurriculumNode,
  isCurriculumV2Enabled,
  searchCurriculum,
} from '@/lib/taxonomy/curriculum'

/** Curriculum v2 reads, for the super-admin taxonomy page. Off (FORBIDDEN) unless TAXONOMY_V2_ENABLED=true. */
async function curriculumRead<T>(read: () => Promise<T>): Promise<T> {
  if (!isCurriculumV2Enabled()) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Curriculum v2 is not enabled on this deployment' })
  }
  try {
    return await read()
  } catch (err) {
    if (err instanceof CurriculumServiceError) {
      throw new TRPCError({ code: err.status === 404 ? 'NOT_FOUND' : 'BAD_GATEWAY', message: err.message })
    }
    throw err
  }
}

/**
 * Book Buddy's education taxonomy as Vidyaverse serves it (lib/taxonomy/curriculum.ts). Read-only: it changes by a
 * new taxonomy release, never from this screen.
 */
const curriculumRouter = createTRPCRouter({
  status: superAdminProcedure.query(() => ({ enabled: isCurriculumV2Enabled() })),
  children: superAdminProcedure
    .input(z.object({ parentId: z.string().uuid().nullable() }))
    .query(({ input }) => curriculumRead(() => getCurriculumChildren(input.parentId))),
  node: superAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) => curriculumRead(() => getCurriculumNode(input.id))),
  combinations: superAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input }) => curriculumRead(() => getCurriculumCombinations(input.id))),
  search: superAdminProcedure
    .input(z.object({ q: z.string().max(100), domain: z.string().max(20).optional() }))
    .query(({ input }) => curriculumRead(() => searchCurriculum(input.q, { domain: input.domain, limit: 30 }))),
})

export const taxonomyRouter = createTRPCRouter({
  curriculum: curriculumRouter,

  domains: createTRPCRouter({
    list: publicProcedure.query(async () => {
      return await db.select().from(taxonomyDomains).orderBy(asc(taxonomyDomains.sortOrder))
    }),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), sortOrder: z.number().default(0) }))
      .mutation(async ({ input }) => {
        await db.insert(taxonomyDomains).values(input)
        return { success: true }
      }),
    update: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await db.update(taxonomyDomains).set({ name: input.name }).where(eq(taxonomyDomains.id, input.id))
        return { success: true }
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.delete(taxonomyDomains).where(eq(taxonomyDomains.id, input.id))
        return { success: true }
      }),
  }),

  courses: createTRPCRouter({
    list: publicProcedure
      .input(z.object({ domainId: z.string() }))
      .query(async ({ input }) => {
        return await db.select().from(taxonomyCourses).where(eq(taxonomyCourses.domainId, input.domainId)).orderBy(asc(taxonomyCourses.sortOrder))
      }),
    create: protectedProcedure
      .input(z.object({ domainId: z.string(), name: z.string().min(1), sortOrder: z.number().default(0) }))
      .mutation(async ({ input }) => {
        await db.insert(taxonomyCourses).values(input)
        return { success: true }
      }),
    update: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await db.update(taxonomyCourses).set({ name: input.name }).where(eq(taxonomyCourses.id, input.id))
        return { success: true }
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.delete(taxonomyCourses).where(eq(taxonomyCourses.id, input.id))
        return { success: true }
      }),
  }),

  levels: createTRPCRouter({
    list: publicProcedure
      .input(z.object({ courseId: z.string() }))
      .query(async ({ input }) => {
        return await db.select().from(taxonomyLevels).where(eq(taxonomyLevels.courseId, input.courseId)).orderBy(asc(taxonomyLevels.sortOrder))
      }),
    create: protectedProcedure
      .input(z.object({ courseId: z.string(), name: z.string().min(1), sortOrder: z.number().default(0) }))
      .mutation(async ({ input }) => {
        await db.insert(taxonomyLevels).values(input)
        return { success: true }
      }),
    update: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await db.update(taxonomyLevels).set({ name: input.name }).where(eq(taxonomyLevels.id, input.id))
        return { success: true }
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.delete(taxonomyLevels).where(eq(taxonomyLevels.id, input.id))
        return { success: true }
      }),
  }),

  subjects: createTRPCRouter({
    list: publicProcedure
      .input(z.object({ levelId: z.string() }))
      .query(async ({ input }) => {
        return await db.select().from(taxonomySubjects).where(eq(taxonomySubjects.levelId, input.levelId)).orderBy(asc(taxonomySubjects.sortOrder))
      }),
    create: protectedProcedure
      .input(z.object({ levelId: z.string(), name: z.string().min(1), sortOrder: z.number().default(0) }))
      .mutation(async ({ input }) => {
        await db.insert(taxonomySubjects).values(input)
        return { success: true }
      }),
    update: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await db.update(taxonomySubjects).set({ name: input.name }).where(eq(taxonomySubjects.id, input.id))
        return { success: true }
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.delete(taxonomySubjects).where(eq(taxonomySubjects.id, input.id))
        return { success: true }
      }),
  }),
})
