import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../server'
import { db } from '@/db'
import { taxonomyDomains, taxonomyCourses, taxonomyLevels, taxonomySubjects } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'

export const taxonomyRouter = createTRPCRouter({
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
