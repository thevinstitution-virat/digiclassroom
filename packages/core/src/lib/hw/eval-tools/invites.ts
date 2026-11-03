// Rater invitations (roadmap task 3.2). A super admin invites an email address with a pseudonym and skills. The invitee signs up
// (self sign-up is open), verifies their email, and the rater row is created here, by the server, from the email-verified hook
// (auth/index.ts). The verified address is the proof: only the person who can read the invitation email can verify it.
//
// "Add a rater by account email" (admin.createRater) stays for people who already have an account.
//
// Everything that changes state also writes an audit row (admin-audit.ts), in the same transaction.

import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { user } from '@/db/schema';
import { hwEvalRater, hwEvalRaterInvite } from '@/db/hw-eval-schema';
import { sendEmail } from '@/lib/email/send-email';
import { writeAudit } from '../admin-audit';
import { HwError } from '../errors';
import { requireSuperAdmin, type EvalActor } from './access';
import { dbRefusal, normaliseSkills } from './admin';
import { INVITE_VALID_DAYS, defaultAppUrl, inviteEmailContent, normaliseInviteEmail, signUpLink } from './invite-content';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PSEUDONYM_RE = /^[A-Za-z0-9_-]{3,40}$/;

export { INVITE_VALID_DAYS, inviteEmailContent, normaliseInviteEmail, signUpLink };

export interface InviteDeps {
  send: typeof sendEmail;
  appUrl: string;
  now: () => Date;
}
const realDeps = (): InviteDeps => ({ send: sendEmail, appUrl: defaultAppUrl(), now: () => new Date() });

export async function inviteRater(a: EvalActor, input: { email: string; pseudonym: string; skills: string[] }, deps: InviteDeps = realDeps()) {
  requireSuperAdmin(a);
  const email = normaliseInviteEmail(input.email);
  const pseudonym = input.pseudonym.trim();
  if (!EMAIL_RE.test(email)) throw new HwError('BAD_REQUEST', 'That is not an email address.');
  if (!PSEUDONYM_RE.test(pseudonym)) throw new HwError('BAD_REQUEST', 'The pseudonym must be 3 to 40 letters, digits, _ or -.');
  const skills = normaliseSkills(input.skills);

  const [existing] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`).limit(1);
  if (existing) throw new HwError('CONFLICT', 'That email already has an account. Use "Add rater" with the account email instead.');
  const [taken] = await db.select({ id: hwEvalRater.id }).from(hwEvalRater).where(sql`lower(${hwEvalRater.pseudonym}) = ${pseudonym.toLowerCase()}`).limit(1);
  if (taken) throw new HwError('CONFLICT', 'That pseudonym is already used by a rater.');

  const expiresAt = new Date(deps.now().getTime() + INVITE_VALID_DAYS * 86_400_000);
  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(hwEvalRaterInvite).values({ id, email, pseudonym, skills, invitedBy: a.userId, expiresAt });
      await writeAudit(tx, { actorId: a.userId, action: 'rater_invited', entity: 'rater_invite', entityId: id, newValue: { email, pseudonym, skills, expiresAt: expiresAt.toISOString() } });
    });
  } catch (e) {
    return dbRefusal(e);
  }

  const link = signUpLink(email, deps.appUrl);
  const content = inviteEmailContent({ pseudonym, link, expiresAt });
  const sent = await deps.send({ to: email, subject: content.subject, html: content.html }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  if (sent.ok) await db.update(hwEvalRaterInvite).set({ emailSentAt: deps.now() }).where(eq(hwEvalRaterInvite.id, id));
  // When the email could not be sent the invitation still exists: the owner can send the link by hand.
  return { id, emailSent: sent.ok, link, expiresAt, ...(sent.ok ? {} : { emailError: sent.error ?? 'not sent' }) };
}

export async function listInvites(a: EvalActor) {
  requireSuperAdmin(a);
  return db.select({
    id: hwEvalRaterInvite.id, email: hwEvalRaterInvite.email, pseudonym: hwEvalRaterInvite.pseudonym, skills: hwEvalRaterInvite.skills,
    state: sql<'pending' | 'expired' | 'accepted' | 'cancelled' | 'blocked'>`CASE WHEN ${hwEvalRaterInvite.status} = 'pending' AND ${hwEvalRaterInvite.expiresAt} < now() THEN 'expired' ELSE ${hwEvalRaterInvite.status} END`,
    emailSentAt: hwEvalRaterInvite.emailSentAt, createdAt: hwEvalRaterInvite.createdAt, expiresAt: hwEvalRaterInvite.expiresAt, blockedReason: hwEvalRaterInvite.blockedReason,
  }).from(hwEvalRaterInvite).orderBy(desc(hwEvalRaterInvite.createdAt)).limit(200);
}

export async function cancelInvite(a: EvalActor, inviteId: string, reason?: string) {
  requireSuperAdmin(a);
  await db.transaction(async (tx) => {
    const [row] = await tx.update(hwEvalRaterInvite).set({ status: 'cancelled', resolvedAt: new Date() })
      .where(and(eq(hwEvalRaterInvite.id, inviteId), eq(hwEvalRaterInvite.status, 'pending')))
      .returning({ id: hwEvalRaterInvite.id, email: hwEvalRaterInvite.email, pseudonym: hwEvalRaterInvite.pseudonym });
    if (!row) throw new HwError('NOT_FOUND', 'No pending invitation with that id.');
    await writeAudit(tx, { actorId: a.userId, action: 'rater_invite_cancelled', entity: 'rater_invite', entityId: inviteId, oldValue: { status: 'pending', email: row.email, pseudonym: row.pseudonym }, newValue: { status: 'cancelled' }, reason: reason ?? null });
  });
}

export type AcceptOutcome = { outcome: 'none' } | { outcome: 'accepted'; raterId: string } | { outcome: 'blocked'; reason: string };

const pgMessage = (e: unknown): string => {
  const x = e as { cause?: { message?: string }; message?: string };
  return (x.cause?.message ?? x.message ?? 'refused').replace(/^error: /i, '');
};

/**
 * Called when an account's email has been verified. If a pending, unexpired invitation exists for that address, the account becomes
 * a rater with the invited pseudonym and skills. Never throws for an ineligible account: the invitation is marked blocked, with the
 * reason, so the owner sees why. The database decides eligibility (the account check of migration 021): an institution's student
 * or a parent cannot be a rater.
 */
export async function acceptRaterInvites(account: { id: string; email: string }, now: Date = new Date()): Promise<AcceptOutcome> {
  const email = normaliseInviteEmail(account.email);
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ id: user.id, verified: user.emailVerified }).from(user).where(eq(user.id, account.id)).limit(1);
    if (!u || !u.verified) return { outcome: 'none' } as const; // the address is the proof; unverified proves nothing
    const [inv] = await tx.select().from(hwEvalRaterInvite)
      .where(and(eq(hwEvalRaterInvite.email, email), eq(hwEvalRaterInvite.status, 'pending'))).for('update').limit(1);
    if (!inv) return { outcome: 'none' } as const;

    const block = async (reason: string) => {
      await tx.update(hwEvalRaterInvite).set({ status: 'blocked', blockedReason: reason, resolvedAt: now }).where(eq(hwEvalRaterInvite.id, inv.id));
      await writeAudit(tx, { actorId: account.id, action: 'rater_invite_blocked', entity: 'rater_invite', entityId: inv.id, oldValue: { status: 'pending' }, newValue: { status: 'blocked' }, reason });
      return { outcome: 'blocked', reason } as const;
    };

    if (inv.expiresAt.getTime() < now.getTime()) return block('The invitation had expired.');
    const [already] = await tx.select({ id: hwEvalRater.id }).from(hwEvalRater).where(eq(hwEvalRater.userId, account.id)).limit(1);
    let raterId = already?.id;
    if (!raterId) {
      try {
        // A nested transaction is a savepoint: a refusal by the database leaves the outer transaction usable.
        const [r] = await tx.transaction(async (sp) => sp.insert(hwEvalRater)
          .values({ id: randomUUID(), pseudonym: inv.pseudonym, userId: account.id, skills: inv.skills, active: true, createdBy: inv.invitedBy })
          .returning({ id: hwEvalRater.id }));
        raterId = r.id;
      } catch (e) {
        const msg = pgMessage(e);
        return block(/pseudonym|unique/i.test(msg) ? 'The pseudonym was taken before the invitation was accepted.' : msg);
      }
    }
    await tx.update(hwEvalRaterInvite).set({ status: 'accepted', acceptedUserId: account.id, resolvedAt: now }).where(eq(hwEvalRaterInvite.id, inv.id));
    await writeAudit(tx, { actorId: account.id, action: 'rater_invite_accepted', entity: 'rater_invite', entityId: inv.id, oldValue: { status: 'pending' }, newValue: { status: 'accepted', raterId, pseudonym: inv.pseudonym, skills: inv.skills } });
    return { outcome: 'accepted', raterId } as const;
  });
}

/** For the auth hooks: never lets a failure here break signing in or verifying an email. */
export async function acceptRaterInvitesSafely(account: { id: string; email: string }): Promise<void> {
  try {
    await acceptRaterInvites(account);
  } catch (e) {
    console.error('[hw-eval] accepting a rater invitation failed:', e instanceof Error ? e.message : e);
  }
}
