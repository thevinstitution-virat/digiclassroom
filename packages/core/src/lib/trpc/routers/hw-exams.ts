// Exam packages API (tRPC), mounted at hw.exams. Phase 2: the super-admin builder only — packages, sets, items, publishing, grants.
// Learner procedures (catalogue, start, timer, upload) arrive with phases 3-4. Every write goes through lib/hw/exams/builder, whose refusals
// (and migration 034's) come back as HwError with a public message; nothing here decides anything.

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure, rateLimit, superAdminProcedure } from '../server';
import { isHwError, type HwErrorCode } from '@/lib/hw/errors';
import { db as hwDb } from '@/lib/hw/db';
import { user } from '@/db/schema';
import * as builder from '@/lib/hw/exams/builder';
import { offeredPapers, paperQuestions } from '@/lib/hw/practice/paper';
import { ANSWER_KINDS } from '@/lib/hw/bank/schema';
import * as learner from '@/lib/hw/exams/learner';
import * as practice from '@/lib/hw/exams/practice';
import { signedReadUrl } from '@/lib/hw/storage/r2';
import * as pages from '@/lib/hw/exams/pages';
import * as revisions from '@/lib/hw/revisions';
import { examPageStore } from '@/lib/hw/storage/exam-pages';

const CODE: Partial<Record<HwErrorCode, TRPCError['code']>> = {
  UNAUTHORIZED: 'UNAUTHORIZED', FORBIDDEN: 'FORBIDDEN', FEATURE_DISABLED: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND', BAD_REQUEST: 'BAD_REQUEST', CONFLICT: 'CONFLICT',
};

/** Runs as the signed-in person (the builder's procedures are also super_admin-gated by their procedure). */
async function admin<T>(ctx: { userId: string | null }, fn: (actor: string) => Promise<T>): Promise<T> {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  try {
    return await fn(ctx.userId);
  } catch (e) {
    if (isHwError(e)) throw new TRPCError({ code: CODE[e.code] ?? 'INTERNAL_SERVER_ERROR', message: e.publicMessage, cause: e });
    throw e;
  }
}

/** A short-lived link to a picture: exam pictures (hw-exams/) through the page store (a local folder in development), bank pictures from R2. */
const pictureUrl = (key: string) => (key.startsWith('hw-exams/') ? examPageStore().readUrl(key) : signedReadUrl(key));

const id = z.string().min(1).max(64);
const halfMarks = z.number().positive().max(1000).refine((n) => Math.round(n * 2) === n * 2, 'Marks must be whole or half marks');
const slug = z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, digits and single hyphens');

const packageInput = z.object({
  board: z.string().trim().min(2).max(20),
  classLevel: z.number().int().min(1).max(12),
  examYear: z.number().int().min(2020).max(2100),
  slug,
  title: z.string().trim().min(3).max(200),
  blurb: z.string().max(4000).optional(),
  attemptsPerSet: z.number().int().min(1).max(50).optional(),
  pricePaise: z.number().int().min(0).max(100_000_00).optional(),
});

const setInput = z.object({
  kind: z.enum(['mock_half', 'mock_full', 'pool']),
  subject: z.string().trim().min(2).max(60),
  subjectCode: z.string().trim().min(1).max(20),
  title: z.string().trim().min(3).max(200),
  maxMarks: halfMarks,
  durationMinutes: z.number().int().min(5).max(360),
  graceMinutes: z.number().int().min(0).max(180).optional(),
  medium: z.enum(['en', 'hi']).optional(),
  syllabusScope: z.array(z.string().trim().min(1).max(200)).max(60).optional(),
});

const valuePoint = z.object({ id: z.string().min(1).max(40), text: z.string().trim().min(1).max(2000), marks: halfMarks, quote: z.string().max(2000).default('') });
const part = z.object({
  label: z.string().max(10),
  alternative: z.enum(['A', 'B', 'C', 'D']).nullable().default(null),
  marks: halfMarks,
  answer_kind: z.enum(ANSWER_KINDS),
  value_points: z.array(valuePoint).min(1).max(30),
});
const authoredInput = z.object({
  number: z.number().int().min(1).max(200).optional(),
  section: z.string().max(10).optional(),
  marks: halfMarks,
  qtype: z.enum(['mcq', 'assertion_reason', 'very_short', 'short', 'long', 'case_based']),
  chapter: z.string().trim().max(200).optional(),
  topic: z.string().trim().max(200).optional(),
  stem: z.string().trim().min(3).max(20_000),
  options: z.array(z.string().trim().min(1).max(2000)).length(4).optional(),
  correctOption: z.enum(['A', 'B', 'C', 'D']).nullable().optional(),
  acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  parts: z.array(part).max(10).optional(),
  schemeText: z.string().max(20_000).optional(),
  diagramParts: z.array(z.string().max(10)).max(10).optional(),
});

export const hwExamsRouter = createTRPCRouter({
  // ── Learner (phase 3): any signed-in person, with or without an institution; off unless HW_EXAMS_ENABLED ──
  enabled: protectedProcedure.query(() => ({ enabled: learner.examsEnabled() })),
  catalogue: protectedProcedure.query(({ ctx }) => admin(ctx, (u) => learner.catalogue(hwDb, u))),
  package: protectedProcedure.input(z.object({ packageId: id })).query(({ ctx, input }) => admin(ctx, (u) => learner.packageForLearner(hwDb, u, input.packageId))),
  /** Starts the next attempt; the server's clock starts now. */
  /** A practice test of the learner's own, drawn from a pool (035): topics and types to include, and how many questions. */
  buildPractice: protectedProcedure.use(rateLimit(10, 60_000))
    .input(z.object({ poolSetId: id, topics: z.array(z.string().trim().max(200)).max(40), types: z.array(z.string().trim().max(40)).max(10), count: z.number().int().min(1).max(30) }))
    .mutation(({ ctx, input }) => admin(ctx, (u) => practice.buildPractice(hwDb, u, input))),
  start: protectedProcedure.use(rateLimit(10, 60_000)).input(z.object({ setId: id }))
    .mutation(({ ctx, input }) => admin(ctx, (u) => learner.startAttempt(hwDb, u, input.setId))),
  attempt: protectedProcedure.input(z.object({ attemptId: id }))
    .query(({ ctx, input }) => admin(ctx, (u) => learner.attemptView(hwDb, u, input.attemptId, {
      sign: pictureUrl, booklet: (attemptId) => pages.bookletPages(hwDb, examPageStore(), attemptId),
    }))),
  /** The printable answer sheet for a set (numbers and boxes, never the questions). */
  sheet: protectedProcedure.input(z.object({ setId: id })).query(({ ctx, input }) => admin(ctx, (u) => learner.sheetForLearner(hwDb, u, input.setId))),
  // the booklet (phase 4); pages themselves are uploaded through POST /api/hw/exams/attempts/:attemptId/pages
  removePage: protectedProcedure.input(z.object({ attemptId: id, pageId: id }))
    .mutation(({ ctx, input }) => admin(ctx, (u) => pages.removePage(hwDb, examPageStore(), u, input.attemptId, input.pageId))),
  reorderPages: protectedProcedure.input(z.object({ attemptId: id, orderedIds: z.array(id).max(60) }))
    .mutation(({ ctx, input }) => admin(ctx, (u) => pages.reorderPages(hwDb, u, input.attemptId, input.orderedIds))),
  submitBooklet: protectedProcedure.input(z.object({ attemptId: id }))
    .mutation(({ ctx, input }) => admin(ctx, (u) => pages.submitBooklet(hwDb, u, input.attemptId))),
  finishWriting: protectedProcedure.input(z.object({ attemptId: id })).mutation(({ ctx, input }) => admin(ctx, (u) => learner.finishWriting(hwDb, u, input.attemptId))),
  abandon: protectedProcedure.input(z.object({ attemptId: id })).mutation(({ ctx, input }) => admin(ctx, (u) => learner.abandonAttempt(hwDb, u, input.attemptId))),

  // ── revising reported attempts (migration 036): the super admin, and the learner's school (its admin, the learner's teachers) ──
  reviews: createTRPCRouter({
    available: protectedProcedure.query(({ ctx }) => admin(ctx, (u) => revisions.canReviseAnyExam(u))),
    list: protectedProcedure.query(({ ctx }) => admin(ctx, (u) => revisions.examReportsForStaff(u))),
    get: protectedProcedure.input(z.object({ attemptId: id })).query(({ ctx, input }) => admin(ctx, (u) => revisions.examReportForStaff(u, input.attemptId))),
    revise: protectedProcedure.input(z.object({
      answerId: id, itemMarks: z.array(z.object({ rubric_item_id: id, marks: z.number().min(0).max(100) })).max(20).optional(), marks: z.number().min(0).max(100).optional(),
      reason: z.string().trim().min(3).max(1000), name: z.string().max(120).optional(), designation: z.string().max(120).optional(),
    })).use(rateLimit(60, 60_000)).mutation(({ ctx, input }) => admin(ctx, (u) => revisions.reviseExamAnswer(u, input))),
  }),

  admin: createTRPCRouter({
    list: superAdminProcedure.query(({ ctx }) => admin(ctx, () => builder.listPackages(hwDb))),
    get: superAdminProcedure.input(z.object({ packageId: id })).query(({ ctx, input }) => admin(ctx, () => builder.getPackage(hwDb, input.packageId))),
    create: superAdminProcedure.input(packageInput).mutation(({ ctx, input }) => admin(ctx, (a) => builder.createPackage(hwDb, a, input))),
    update: superAdminProcedure.input(z.object({ packageId: id, patch: packageInput.partial() }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.updatePackage(hwDb, input.packageId, input.patch))),
    publish: superAdminProcedure.input(z.object({ packageId: id })).mutation(({ ctx, input }) => admin(ctx, () => builder.publishPackage(hwDb, input.packageId))),
    setOpen: superAdminProcedure.input(z.object({ packageId: id, open: z.boolean() }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.setPackageOpen(hwDb, input.packageId, input.open))),

    // sets
    addSet: superAdminProcedure.input(z.object({ packageId: id, set: setInput }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.addSet(hwDb, input.packageId, input.set))),
    /** Published board papers that can become a set (the same list the teacher's picker shows). */
    papers: superAdminProcedure.query(({ ctx }) => admin(ctx, () => offeredPapers(hwDb, 'teacher'))),
    paperQuestions: superAdminProcedure.input(z.object({ paperId: id }))
      .query(({ ctx, input }) => admin(ctx, () => paperQuestions(hwDb, input.paperId, 'teacher'))),
    setFromPaper: superAdminProcedure.input(z.object({ packageId: id, paperId: id, title: z.string().trim().min(3).max(200).optional(), durationMinutes: z.number().int().min(5).max(360).optional() }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.setFromPaper(hwDb, input.packageId, input.paperId, input))),
    getSet: superAdminProcedure.input(z.object({ setId: id })).query(({ ctx, input }) => admin(ctx, () => builder.getSet(hwDb, input.setId, pictureUrl))),
    /** A teacher marks a key the assistant wrote as checked, or takes the check back (037); named by the signed-in account. */
    checkItemKey: superAdminProcedure.input(z.object({ itemId: id, checked: z.boolean() }))
      .mutation(({ ctx, input }) => admin(ctx, async (a) => {
        const u = (await hwDb.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, a)).limit(1))[0];
        return builder.checkItemKey(hwDb, input.itemId, (u?.name || u?.email || a).slice(0, 200), input.checked);
      })),
    sheet: superAdminProcedure.input(z.object({ setId: id })).query(({ ctx, input }) => admin(ctx, () => learner.sheetFor(hwDb, input.setId))),
    updateSet: superAdminProcedure.input(z.object({ setId: id, patch: setInput.omit({ kind: true }).partial() }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.updateSet(hwDb, input.setId, input.patch))),
    publishSet: superAdminProcedure.input(z.object({ setId: id })).mutation(({ ctx, input }) => admin(ctx, () => builder.publishSet(hwDb, input.setId))),
    setSetOpen: superAdminProcedure.input(z.object({ setId: id, open: z.boolean() }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.setSetOpen(hwDb, input.setId, input.open))),
    deleteSet: superAdminProcedure.input(z.object({ setId: id })).mutation(({ ctx, input }) => admin(ctx, () => builder.deleteSet(hwDb, input.setId))),

    // items
    addBankItem: superAdminProcedure.input(z.object({ setId: id, rowId: id, number: z.number().int().min(1).max(200).optional(), chapter: z.string().trim().max(200).optional() }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.addBankItem(hwDb, input.setId, input.rowId, input))),
    addAuthoredItem: superAdminProcedure.input(z.object({ setId: id, item: authoredInput }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.addAuthoredItem(hwDb, input.setId, input.item))),
    updateItem: superAdminProcedure.input(z.object({ itemId: id, patch: authoredInput.partial() }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.updateItem(hwDb, input.itemId, input.patch))),
    removeItem: superAdminProcedure.input(z.object({ itemId: id })).mutation(({ ctx, input }) => admin(ctx, () => builder.removeItem(hwDb, input.itemId))),
    reorderItems: superAdminProcedure.input(z.object({ setId: id, orderedIds: z.array(id).max(300) }))
      .mutation(({ ctx, input }) => admin(ctx, () => builder.reorderItems(hwDb, input.setId, input.orderedIds))),

    /** Give a learner a package without payment (a trial, a scholarship, a tester). Purchases come with phase 3. */
    grant: superAdminProcedure.input(z.object({
      email: z.string().trim().toLowerCase().email(), packageId: id, source: z.enum(['grant', 'trial']).optional(),
      attemptsPerSet: z.number().int().min(1).max(50).nullable().optional(), expiresAt: z.coerce.date().nullable().optional(),
    })).mutation(({ ctx, input }) => admin(ctx, async (a) => {
      const u = (await hwDb.select({ id: user.id }).from(user).where(eq(user.email, input.email)).limit(1))[0];
      if (!u) throw new TRPCError({ code: 'NOT_FOUND', message: 'No account has that email.' });
      return builder.grantEntitlement(hwDb, a, { userId: u.id, packageId: input.packageId, source: input.source, attemptsPerSet: input.attemptsPerSet, expiresAt: input.expiresAt });
    })),
  }),
});
