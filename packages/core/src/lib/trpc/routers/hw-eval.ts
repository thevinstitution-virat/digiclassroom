// Virat Evaluator tools API (tRPC). Every procedure checks HW_EVAL_TOOLS_ENABLED, resolves
// the caller with resolveEvalActor (active rater row / super admin), and leaves access rules
// to lib/hw/eval-tools. Images are served by GET /api/hw-eval/media and pad copies uploaded
// by POST /api/hw-eval/copies, not here.

import { z } from 'zod';
import { TRPCError, type inferRouterOutputs } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../server';
import { isHwError, type HwErrorCode } from '@/lib/hw/errors';
import { requireToolsEnabled, type EvalActor } from '@/lib/hw/eval-tools/access';
import { resolveEvalActor } from '@/lib/hw/eval-tools/actor';
import * as admin from '@/lib/hw/eval-tools/admin';
import * as work from '@/lib/hw/eval-tools/work';
import { copyDatasets, copyQueue } from '@/lib/hw/eval-tools/copies';
import { getHwConfig } from '@/lib/hw/config';

const TRPC_CODE: Record<HwErrorCode, TRPCError['code']> = {
  UNAUTHORIZED: 'UNAUTHORIZED', FORBIDDEN: 'FORBIDDEN', FEATURE_DISABLED: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST', CONFLICT: 'CONFLICT', QUOTA_EXCEEDED: 'TOO_MANY_REQUESTS', PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  NOT_CONFIGURED: 'PRECONDITION_FAILED', PROVIDER_ERROR: 'BAD_GATEWAY', INVALID_PROVIDER_OUTPUT: 'BAD_GATEWAY',
};

async function run<T>(ctx: { req: Request }, fn: (a: EvalActor) => Promise<T>): Promise<T> {
  try {
    requireToolsEnabled();
    return await fn(await resolveEvalActor(ctx.req.headers));
  } catch (e) {
    if (isHwError(e)) throw new TRPCError({ code: TRPC_CODE[e.code], message: e.publicMessage, cause: e });
    throw e;
  }
}

const id = z.string().min(1).max(64);
const datasetRef = z.string().regex(/^[a-z0-9][a-z0-9_-]*@v[0-9]+$/, 'dataset must be name@vN');
const kind = z.enum(['transcribe', 'blind_mark', 'key_audit', 'deidentify']);
const timeMs = z.number().int().min(0).max(86_400_000);

export const hwEvalRouter = createTRPCRouter({
  /** For page guards: never throws for "not a rater" or "switched off". */
  me: protectedProcedure.query(async ({ ctx }) => {
    if (!getHwConfig().HW_EVAL_TOOLS_ENABLED) return { enabled: false, isRater: false, isSuperAdmin: false, pseudonym: null, skills: [] as string[], copyDatasets: [] as string[] };
    const a = await resolveEvalActor(ctx.req.headers);
    return { enabled: true, isRater: !!a.rater, isSuperAdmin: a.isSuperAdmin, pseudonym: a.rater?.pseudonym ?? null, skills: a.rater?.skills ?? [], copyDatasets: a.rater ? copyDatasets() : [] };
  }),

  // ── Raters ───────────────────────────────────────────────────────────────
  queue: protectedProcedure.query(({ ctx }) => run(ctx, (a) => work.myQueue(a))),
  /** Idempotent: records the start only the first time. */
  open: protectedProcedure.input(z.object({ assignmentId: id })).query(({ ctx, input }) => run(ctx, (a) => work.openAssignment(a, input.assignmentId))),
  submit: protectedProcedure.input(z.object({ assignmentId: id, payload: z.record(z.unknown()), timeMs }))
    .mutation(({ ctx, input }) => run(ctx, (a) => work.submitAssignment(a, input))),
  adjudications: protectedProcedure.query(({ ctx }) => run(ctx, (a) => work.adjudicationQueue(a))),
  openAdjudication: protectedProcedure.input(z.object({ taskId: id })).query(({ ctx, input }) => run(ctx, (a) => work.openAdjudication(a, input.taskId))),
  adjudicate: protectedProcedure.input(z.object({ taskId: id, payload: z.record(z.unknown()), reason: z.string().max(2000), timeMs }))
    .mutation(({ ctx, input }) => run(ctx, (a) => work.submitAdjudication(a, input))),
  copies: protectedProcedure.query(({ ctx }) => run(ctx, (a) => copyQueue(a))),

  // ── Super admin ──────────────────────────────────────────────────────────
  admin: createTRPCRouter({
    raters: protectedProcedure.query(({ ctx }) => run(ctx, (a) => admin.listRaters(a))),
    createRater: protectedProcedure
      .input(z.object({ email: z.string().email().max(255), pseudonym: z.string().trim().regex(/^[A-Za-z0-9_-]{3,40}$/, '3–40 letters, digits, _ or -'), skills: z.array(z.string().max(80)).max(30) }))
      .mutation(({ ctx, input }) => run(ctx, (a) => admin.createRater(a, input))),
    updateRater: protectedProcedure.input(z.object({ raterId: id, skills: z.array(z.string().max(80)).max(30).optional(), active: z.boolean().optional() }))
      .mutation(({ ctx, input }) => run(ctx, (a) => admin.updateRater(a, input))),
    datasets: protectedProcedure.query(({ ctx }) => run(ctx, (a) => admin.datasetsWithTasks(a))),
    progress: protectedProcedure.input(z.object({ datasetRef })).query(({ ctx, input }) => run(ctx, (a) => admin.progress(a, input))),
    createTasks: protectedProcedure.input(z.object({ datasetRef, kind })).mutation(({ ctx, input }) => run(ctx, (a) => admin.createTasks(a, input))),
    assign: protectedProcedure.input(z.object({ datasetRef })).mutation(({ ctx, input }) => run(ctx, (a) => admin.assignOpenTasks(a, input))),
    exportReference: protectedProcedure.input(z.object({ datasetRef })).mutation(({ ctx, input }) => run(ctx, (a) => admin.exportReference(a, input))),
  }),
});

export type HwEvalRouterOutputs = inferRouterOutputs<typeof hwEvalRouter>;
