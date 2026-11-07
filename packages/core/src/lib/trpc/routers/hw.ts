// Handwritten Assignments API (tRPC). Every procedure resolves the caller with
// resolveHwActor (verified membership of the active institution) instead of ctx.tenantId,
// and every access rule lives in lib/hw/access. Ink files are uploaded through the REST
// route /api/hw/submissions/[submissionId]/ink, not here.

import { z } from 'zod';
import { TRPCError, type inferRouterOutputs } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, rateLimit } from '../server';
import { resolveHwActor } from '@/lib/hw/access/actor';
import { isHwEnabled } from '@/lib/hw/access/guards';
import type { HwActor } from '@/lib/hw/access/policy';
import { isHwError, type HwErrorCode } from '@/lib/hw/errors';
import { QUESTION_PRESETS } from '@/lib/hw/presets';
import * as assignments from '@/lib/hw/services/assignments';
import * as submissions from '@/lib/hw/services/submissions';
import * as marking from '@/lib/hw/services/marking';
import * as guardian from '@/lib/hw/services/guardian';
import { getHwConfig } from '@/lib/hw/config';
import { institutionMonitor } from '@/lib/hw/monitoring/views';
import { conceptFeedbackForSubmission } from '@/lib/hw/concept-feedback';
import { libraryGraphEnabled } from '@/lib/library/graph-client';
import { PRACTICE_ORG_ID } from '@/lib/hw/practice/rules';
import { practiceOverview, startTrial } from '@/lib/hw/practice/trial';
import { parseScope, practiceReady, practiceScopes, searchPracticeQuestions } from '@/lib/hw/practice/catalog';
import { db as hwDb } from '@/lib/hw/db';
import { retryAttempt, startAttempt } from '@/lib/hw/practice/attempt';

const TRPC_CODE: Record<HwErrorCode, TRPCError['code']> = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  FEATURE_DISABLED: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  QUOTA_EXCEEDED: 'TOO_MANY_REQUESTS',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  NOT_CONFIGURED: 'PRECONDITION_FAILED',
  PROVIDER_ERROR: 'BAD_GATEWAY',
  INVALID_PROVIDER_OUTPUT: 'BAD_GATEWAY',
};

/** Resolve the actor, run, and turn HwError into a TRPCError carrying only the public message. */
async function run<T>(ctx: { req: Request }, fn: (actor: HwActor) => Promise<T>): Promise<T> {
  try {
    return await fn(await resolveHwActor(ctx.req.headers));
  } catch (e) {
    if (isHwError(e)) {
      if (e.code === 'NOT_CONFIGURED' || e.code === 'PROVIDER_ERROR' || e.code === 'INVALID_PROVIDER_OUTPUT') console.error(`[hw] ${e.code}: ${e.message}`);
      throw new TRPCError({ code: TRPC_CODE[e.code], message: e.publicMessage, cause: e });
    }
    throw e;
  }
}

/** The same error mapping as run(), for calls that belong to a person rather than to an institution (an independent learner has none). */
async function runUser<T>(ctx: { userId: string | null }, fn: (userId: string) => Promise<T>): Promise<T> {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  try {
    return await fn(ctx.userId);
  } catch (e) {
    if (isHwError(e)) {
      if (e.code === 'NOT_CONFIGURED' || e.code === 'PROVIDER_ERROR' || e.code === 'INVALID_PROVIDER_OUTPUT') console.error(`[hw] ${e.code}: ${e.message}`);
      throw new TRPCError({ code: TRPC_CODE[e.code], message: e.publicMessage, cause: e });
    }
    throw e;
  }
}

const id = z.string().min(1).max(64);
const practiceScope = z.object({
  classLevel: z.union([z.string().trim().min(1).max(20), z.number().int().min(1).max(12)]),
  subject: z.string().trim().min(2).max(60),
  medium: z.enum(['en', 'hi']),
});
const mode = z.enum(['typed', 'ink', 'photo']);
const marks = z.number().positive().max(100).refine((n) => Math.round(n * 2) === n * 2, 'Marks must be whole or half marks');
const itemMarks = z.array(z.object({ rubric_item_id: id, marks: z.number().min(0).max(100) })).max(20);

const assignmentInput = z.object({
  classId: id,
  sectionId: id.nullable(),
  subject: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  instructions: z.string().max(10_000).nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  allowedModes: z.array(mode).min(1).max(3),
});

const questionInput = z.object({
  type: z.enum(['very_short', 'short', 'long', 'essay']),
  // May be blank while drafting; publishing refuses blank questions.
  prompt: z.string().trim().max(10_000),
  marks,
  modelAnswer: z.string().max(20_000).nullable().optional(),
  acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  languageHint: z.enum(['en', 'hi', 'mixed']).optional(),
  answerLines: z.number().int().min(1).max(200).optional(),
  // Roadmap 5.2: where the question comes from, and the passage it is about. The answer key is built from these (and the textbook).
  origin: z.enum(['textbook_exercise', 'board_paper', 'custom']).optional(),
  originRef: z.record(z.string().trim().max(200)).refine((o) => Object.keys(o).length <= 8, 'too many fields').optional(),
  passage: z.string().max(20_000).nullable().optional(),
});

const rubricItem = z.object({
  kind: z.enum(['key_point', 'content', 'structure', 'language']),
  description: z.string().trim().min(1).max(1000),
  marks,
});

export const hwRouter = createTRPCRouter({
  presets: protectedProcedure.query(() => QUESTION_PRESETS),

  /** For navigation and page guards: never throws for "not in an institution" or "switched off". */
  status: protectedProcedure.query(async ({ ctx }) => {
    try {
      const actor = await resolveHwActor(ctx.req.headers);
      // practice: this person works in the self-practice institution (an independent learner), not a school.
      return { enabled: await isHwEnabled(actor.orgId), role: actor.role, orgId: actor.orgId, practice: actor.orgId === PRACTICE_ORG_ID };
    } catch (e) {
      if (isHwError(e) && (e.code === 'FORBIDDEN' || e.code === 'UNAUTHORIZED')) return { enabled: false, role: 'none' as const, orgId: null, practice: false, reason: e.publicMessage };
      throw e;
    }
  }),

  // ── Independent learners: self-practice (docs/hw-eval/self-practice.md) ───────
  practice: createTRPCRouter({
    /** For the tab and the sidebar: never throws for "off" or "not for you". */
    status: protectedProcedure.query(({ ctx }) => runUser(ctx, async (u) => {
      const o = await practiceOverview(u);
      // ready: the library and the answer keys are wired and a group can be marked, so starting the trial is worth the learner's days.
      return o.enabled ? { ...o, ready: await practiceReady(hwDb), scopes: practiceScopes() } : o;
    })),
    start: protectedProcedure.use(rateLimit(10, 60_000))
      .mutation(({ ctx }) => runUser(ctx, async (u) => { const r = await startTrial(u); return { started: r.started, endsAt: r.endsAt }; })),
    /** Book exercise questions about a topic, for the learner's class, subject and medium. */
    search: protectedProcedure.use(rateLimit(20, 60_000))
      .input(practiceScope.extend({ query: z.string().trim().min(2).max(200) }))
      .query(({ ctx, input }) => runUser(ctx, async () => {
        const { query, ...scope } = input;
        return searchPracticeQuestions(parseScope(scope), query);
      })),
    /** "Write it again": a practice answer that got no mark becomes a draft again, on the same question. */
    retry: protectedProcedure.use(rateLimit(10, 60_000))
      .input(z.object({ submissionId: id }))
      .mutation(({ ctx, input }) => runUser(ctx, (u) => retryAttempt(u, input.submissionId))),
    /** Start one picked question; returns the assignment to open (the ordinary student answer screen). */
    startQuestion: protectedProcedure.use(rateLimit(20, 60_000))
      .input(practiceScope.extend({ passageId: z.string().min(1).max(200), index: z.number().int().min(0).max(99), text: z.string().trim().min(8).max(2000) }))
      .mutation(({ ctx, input }) => runUser(ctx, (u) => startAttempt(u, input))),
  }),

  // ── Teacher: build ────────────────────────────────────────────────────────
  assignments: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({ status: z.enum(['draft', 'published', 'closed']).optional() }).optional())
      .query(({ ctx, input }) => run(ctx, (a) => assignments.listForTeacher(a, input ?? {}))),
    get: protectedProcedure.input(z.object({ assignmentId: id }))
      .query(({ ctx, input }) => run(ctx, (a) => assignments.getForManage(a, input.assignmentId))),
    targets: protectedProcedure.query(({ ctx }) => run(ctx, (a) => assignments.assignmentTargets(a))),
    create: protectedProcedure.input(assignmentInput)
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.createAssignment(a, input))),
    update: protectedProcedure.input(z.object({ assignmentId: id, patch: assignmentInput.partial() }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.updateAssignment(a, input.assignmentId, input.patch))),
    delete: protectedProcedure.input(z.object({ assignmentId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.deleteAssignment(a, input.assignmentId))),
    /** Before publishing: which questions will be hand-marked, and why. */
    publishPreview: protectedProcedure.input(z.object({ assignmentId: id }))
      .query(({ ctx, input }) => run(ctx, (a) => assignments.publishPreview(a, input.assignmentId))),
    publish: protectedProcedure.input(z.object({ assignmentId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.publishAssignment(a, input.assignmentId))),
    close: protectedProcedure.input(z.object({ assignmentId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.setAssignmentOpen(a, input.assignmentId, false))),
    reopen: protectedProcedure.input(z.object({ assignmentId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.setAssignmentOpen(a, input.assignmentId, true))),
  }),

  questions: createTRPCRouter({
    add: protectedProcedure.input(z.object({ assignmentId: id, question: questionInput }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.addQuestion(a, input.assignmentId, input.question))),
    update: protectedProcedure.input(z.object({ questionId: id, patch: questionInput.partial() }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.updateQuestion(a, input.questionId, input.patch))),
    remove: protectedProcedure.input(z.object({ questionId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.removeQuestion(a, input.questionId))),
    reorder: protectedProcedure.input(z.object({ assignmentId: id, orderedIds: z.array(id).max(200) }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.reorderQuestions(a, input.assignmentId, input.orderedIds))),
    // Answer keys (roadmap 5.2)
    useOwnRubric: protectedProcedure.input(z.object({ questionId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.useOwnRubric(a, input.questionId))),
    useAnswerKey: protectedProcedure.input(z.object({ questionId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.useAnswerKey(a, input.questionId))),
    retryKey: protectedProcedure.input(z.object({ questionId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.retryKey(a, input.questionId))),
  }),

  rubric: createTRPCRouter({
    set: protectedProcedure.input(z.object({ questionId: id, items: z.array(rubricItem).max(10) }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.setRubric(a, input.questionId, input.items))),
    draft: protectedProcedure.input(z.object({ questionId: id, replace: z.boolean().default(false) }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.draftRubric(a, input.questionId, { replace: input.replace }))),
  }),

  classTeachers: createTRPCRouter({
    list: protectedProcedure.query(({ ctx }) => run(ctx, (a) => assignments.listClassTeachers(a))),
    options: protectedProcedure.query(({ ctx }) => run(ctx, (a) => assignments.classTeacherOptions(a))),
    assign: protectedProcedure
      .input(z.object({ classId: id, sectionId: id.nullable(), teacherId: id, subject: z.string().trim().max(100).nullable() }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.assignClassTeacher(a, input))),
    remove: protectedProcedure.input(z.object({ linkId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => assignments.removeClassTeacher(a, input.linkId))),
  }),

  // ── Student ───────────────────────────────────────────────────────────────
  student: createTRPCRouter({
    assignments: protectedProcedure.query(({ ctx }) => run(ctx, (a) => submissions.myAssignments(a))),
    start: protectedProcedure.input(z.object({ assignmentId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => submissions.startSubmission(a, input.assignmentId))),
    saveAnswer: protectedProcedure
      .input(z.object({
        submissionId: id,
        questionId: id,
        mode,
        typedText: z.string().max(50_000).nullable().optional(),
        timeSpentMs: z.number().int().min(0).max(24 * 3600 * 1000),
        typingStats: z.record(z.unknown()).optional(),
      }))
      .mutation(({ ctx, input }) => run(ctx, (a) => submissions.saveAnswer(a, input.submissionId, input.questionId, input))),
    submit: protectedProcedure.input(z.object({ submissionId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => submissions.submit(a, input.submissionId))),
    flagWords: protectedProcedure
      .input(z.object({ submissionId: id, questionId: id, flags: z.array(z.object({ start: z.number().int().min(0), end: z.number().int().min(1), text: z.string().min(1).max(200) })).max(50) }))
      .mutation(({ ctx, input }) => run(ctx, (a) => submissions.flagWords(a, input.submissionId, input.questionId, input.flags))),
    result: protectedProcedure.input(z.object({ submissionId: id }))
      .query(({ ctx, input }) => run(ctx, (a) => submissions.myResult(a, input.submissionId))),
    // Marks read concept by concept from the library's knowledge graph; { enabled: false } while the graph is off,
    // so the screen shows nothing rather than an error.
    conceptFeedback: protectedProcedure.input(z.object({ submissionId: id }))
      .query(({ ctx, input }) => run(ctx, async (a) =>
        libraryGraphEnabled() ? { enabled: true as const, ...(await conceptFeedbackForSubmission(a, input.submissionId)) } : { enabled: false as const })),
  }),

  // ── Teacher: mark ─────────────────────────────────────────────────────────
  marking: createTRPCRouter({
    overview: protectedProcedure.input(z.object({ assignmentId: id }))
      .query(({ ctx, input }) => run(ctx, (a) => marking.classOverview(a, input.assignmentId))),
    queue: protectedProcedure
      .input(z.object({ questionId: id, filter: z.enum(['all', 'needs_review', 'low_confidence', 'flagged', 'ungraded']).default('all') }))
      .query(({ ctx, input }) => run(ctx, (a) => marking.questionQueue(a, input.questionId, input.filter))),
    answer: protectedProcedure.input(z.object({ answerId: id }))
      .query(({ ctx, input }) => run(ctx, (a) => marking.answerDetail(a, input.answerId))),
    accept: protectedProcedure.input(z.object({ answerId: id, aiGradeId: id, comment: z.string().max(5000).nullable().optional() }))
      .mutation(({ ctx, input }) => run(ctx, (a) => marking.acceptAiGrade(a, input.answerId, input.aiGradeId, input.comment))),
    editAndAccept: protectedProcedure.input(z.object({ answerId: id, aiGradeId: id, itemMarks, comment: z.string().max(5000).nullable().optional() }))
      .mutation(({ ctx, input }) => run(ctx, (a) => marking.editAiGrade(a, input.answerId, input.aiGradeId, input.itemMarks, input.comment))),
    manual: protectedProcedure
      .input(z.object({ answerId: id, marks: z.number().min(0).max(100).optional(), itemMarks: itemMarks.optional(), comment: z.string().max(5000).nullable().optional() }))
      .mutation(({ ctx, input }) => run(ctx, (a) => marking.manualGrade(a, input.answerId, input))),
    comment: protectedProcedure.input(z.object({ answerId: id, comment: z.string().max(5000).nullable() }))
      .mutation(({ ctx, input }) => run(ctx, (a) => marking.setComment(a, input.answerId, input.comment))),
    notAnInstruction: protectedProcedure.input(z.object({ answerId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => marking.notAnInstruction(a, input.answerId))),
    bulkAcceptPreview: protectedProcedure.input(z.object({ questionId: id }))
      .query(({ ctx, input }) => run(ctx, (a) => marking.bulkAcceptPreview(a, input.questionId))),
    bulkAccept: protectedProcedure.input(z.object({ questionId: id, confirmedCount: z.number().int().min(1) }))
      .mutation(({ ctx, input }) => run(ctx, (a) => marking.bulkAccept(a, input.questionId, input.confirmedCount))),
    fixTranscript: protectedProcedure
      .input(z.object({ answerId: id, text: z.string().max(50_000).optional(), confirm: z.boolean().optional() }))
      .mutation(({ ctx, input }) => run(ctx, (a) => marking.fixTranscript(a, input.answerId, input))),
    returnAssignment: protectedProcedure.input(z.object({ assignmentId: id }))
      .mutation(({ ctx, input }) => run(ctx, (a) => marking.returnAssignment(a, input.assignmentId))),
  }),

  // ── A parent's view of a linked child's returned work (off unless HW_PARENT_VIEW_ENABLED). Links are made through guardian invitations (guardian router). ──
  guardian: createTRPCRouter({
    enabled: protectedProcedure.query(() => ({ enabled: getHwConfig().HW_PARENT_VIEW_ENABLED })),
    // parent
    children: protectedProcedure.query(({ ctx }) => run(ctx, (a) => guardian.myChildren(a))),
    assignments: protectedProcedure.input(z.object({ studentId: z.string().min(1).max(255) }))
      .query(({ ctx, input }) => run(ctx, (a) => guardian.childAssignments(a, input.studentId))),
    result: protectedProcedure.input(z.object({ studentId: z.string().min(1).max(255), submissionId: id }))
      .query(({ ctx, input }) => run(ctx, (a) => guardian.childResult(a, input.studentId, input.submissionId))),
  }),

  // ── Institution admin / platform ──────────────────────────────────────────
  admin: createTRPCRouter({
    usage: protectedProcedure.query(({ ctx }) => run(ctx, (a) => marking.usageThisMonth(a))),
    /** Roadmap 5.4: this institution's own marking figures, aggregates only, with the minimum group size. */
    monitoring: protectedProcedure.query(({ ctx }) => run(ctx, (a) => institutionMonitor(a))),
    setQuota: protectedProcedure
      .input(z.object({ orgId: id, enabled: z.boolean(), monthlyAnswerQuota: z.number().int().min(0).max(10_000_000) }))
      .mutation(({ ctx, input }) => run(ctx, (a) => marking.setQuota(a, input.orgId, input))),
  }),
});

/** Output types for the web app (inferred with core's own @trpc/server copy). */
export type HwRouterOutputs = inferRouterOutputs<typeof hwRouter>;
