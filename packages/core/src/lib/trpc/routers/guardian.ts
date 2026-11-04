// Guardian onboarding API (migration 030). Every procedure checks GUARDIAN_INVITES_ENABLED and resolves the caller; the rules are in lib/guardian/onboarding.ts.
// Institution admins use the institution* procedures for their own institution; the super admin uses the platform* ones for independent learners.

import { z } from 'zod';
import { TRPCError, type inferRouterOutputs } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../server';
import { isHwError, type HwErrorCode } from '@/lib/hw/errors';
import { getHwConfig } from '@/lib/hw/config';
import { resolveCaller } from '@/lib/guardian/caller';
import * as g from '@/lib/guardian/onboarding';

const TRPC_CODE: Record<HwErrorCode, TRPCError['code']> = {
  UNAUTHORIZED: 'UNAUTHORIZED', FORBIDDEN: 'FORBIDDEN', FEATURE_DISABLED: 'FORBIDDEN', NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST', CONFLICT: 'CONFLICT', QUOTA_EXCEEDED: 'TOO_MANY_REQUESTS', PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  NOT_CONFIGURED: 'PRECONDITION_FAILED', PROVIDER_ERROR: 'BAD_GATEWAY', INVALID_PROVIDER_OUTPUT: 'BAD_GATEWAY',
};

async function run<T>(ctx: { req: Request }, fn: (c: g.Caller) => Promise<T>): Promise<T> {
  try {
    return await fn(await resolveCaller(ctx.req.headers));
  } catch (e) {
    if (isHwError(e)) throw new TRPCError({ code: TRPC_CODE[e.code], message: e.publicMessage, cause: e });
    throw e;
  }
}

const id = z.string().min(1).max(64);
const email = z.string().trim().max(254);
const token = z.string().min(20).max(100);

export const guardianRouter = createTRPCRouter({
  /** For page guards: never throws. */
  enabled: protectedProcedure.query(() => ({ enabled: getHwConfig().GUARDIAN_INVITES_ENABLED })),

  // ── Institution admin (B2B): their institution's students ──
  institutionStudents: protectedProcedure.query(({ ctx }) => run(ctx, (c) => g.institutionStudents(c))),
  inviteForInstitution: protectedProcedure.input(z.object({ studentId: id.max(255), email }))
    .mutation(({ ctx, input }) => run(ctx, (c) => g.invite(c, { mode: 'institution', studentId: input.studentId, email: input.email }))),

  // ── Super admin (B2C): independent learners ──
  independentLearners: protectedProcedure.input(z.object({ search: z.string().max(100).optional() }).optional())
    .query(({ ctx, input }) => run(ctx, (c) => g.independentLearners(c, input?.search ?? ''))),
  inviteForIndependent: protectedProcedure.input(z.object({ studentId: id.max(255), email }))
    .mutation(({ ctx, input }) => run(ctx, (c) => g.invite(c, { mode: 'independent', studentId: input.studentId, email: input.email }))),

  // ── Both: the list of what was sent and who is linked (the caller's own scope) ──
  invitations: protectedProcedure.query(({ ctx }) => run(ctx, (c) => g.listInvitations(c))),
  revokeInvitation: protectedProcedure.input(z.object({ invitationId: id }))
    .mutation(({ ctx, input }) => run(ctx, (c) => g.revokeInvitation(c, input.invitationId))),
  links: protectedProcedure.query(({ ctx }) => run(ctx, (c) => g.listLinks(c))),
  endLink: protectedProcedure.input(z.object({ linkId: id }))
    .mutation(({ ctx, input }) => run(ctx, (c) => g.endLink(c, input.linkId))),

  // ── The guardian ──
  preview: protectedProcedure.input(z.object({ token })).query(({ ctx, input }) => run(ctx, (c) => g.previewInvitation(c, input.token))),
  accept: protectedProcedure.input(z.object({ token })).mutation(({ ctx, input }) => run(ctx, (c) => g.acceptInvitation(c, input.token))),
  wards: protectedProcedure.query(({ ctx }) => run(ctx, (c) => g.myWards(c.userId))),
});

export type GuardianRouterOutputs = inferRouterOutputs<typeof guardianRouter>;
