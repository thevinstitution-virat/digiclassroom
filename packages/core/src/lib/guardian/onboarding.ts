// Guardian onboarding and links, for both modes (migration 030). Off unless GUARDIAN_INVITES_ENABLED is set.
//
//   B2B: an institution admin picks a student of THEIR institution and invites the guardian by e-mail.
//   B2C: the super admin picks a student who joined as an independent learner (no institution) and invites the guardian.
// The guardian opens the link, signs up or signs in with the invited address, and accepts: that creates the platform-wide link
// (guardian_link) between guardian and ward. Every screen that shows a ward's data starts from that table.
//
// The token is never stored (only its sha256); an invitation names the guardian's address, and only an account with that verified address
// can accept it. Nothing here is deleted: links are ended, invitations are revoked, each with who and when.

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { member, organization, studentEnrollments, user } from '@/db/schema';
import { db, type Exec } from '@/lib/hw/db';
import { getHwConfig } from '@/lib/hw/config';
import { HwError } from '@/lib/hw/errors';
import { roleFromMember } from '@/lib/hw/access/policy';
import { writeAudit } from '@/lib/hw/admin-audit';
import { emailLayout, sendEmail } from '@/lib/email/send-email';
import { defaultAppUrl } from '@/lib/hw/eval-tools/invite-content';

export const INVITATION_VALID_DAYS = 14;

export interface Caller {
  userId: string;
  email: string;
  emailVerified: boolean;
  globalRole: string;
  orgId: string | null;
  orgRole: string | null;
}

export interface OnboardingDeps {
  send: typeof sendEmail;
  appUrl: () => string;
  now: () => Date;
}
const realDeps: OnboardingDeps = { send: sendEmail, appUrl: defaultAppUrl, now: () => new Date() };

export function requireInvitesOn(): void {
  if (!getHwConfig().GUARDIAN_INVITES_ENABLED) throw new HwError('FEATURE_DISABLED', 'Guardian invitations are not switched on.');
}

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
export const normaliseEmail = (e: string) => e.trim().toLowerCase();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const isSuperAdmin = (c: Caller) => c.globalRole === 'super_admin';
/** An institution admin of the institution the caller is working in (a super admin acting inside an institution counts). */
export const isInstitutionAdmin = (c: Caller) =>
  !!c.orgId && (isSuperAdmin(c) || roleFromMember(c.orgRole) === 'admin' || (c.globalRole === 'admin' && c.orgRole !== null));

function requireInstitutionAdmin(c: Caller): string {
  if (!isInstitutionAdmin(c) || !c.orgId) throw new HwError('FORBIDDEN', 'Only an institution admin can do this.');
  return c.orgId;
}
function requireSuper(c: Caller): void {
  if (!isSuperAdmin(c)) throw new HwError('FORBIDDEN', 'Only the platform owner can do this.');
}

// ── Who can be invited for ───────────────────────────────────────────────────

/** B2B: the students of the caller's institution. */
export async function institutionStudents(c: Caller) {
  requireInvitesOn();
  const orgId = requireInstitutionAdmin(c);
  const rows = await db.select({ id: user.id, name: user.name, email: user.email, role: member.role }).from(member)
    .innerJoin(user, eq(user.id, member.userId)).where(eq(member.organizationId, orgId)).orderBy(user.name).limit(2000);
  return rows.filter((r) => roleFromMember(r.role) === 'student').map(({ id, name, email }) => ({ id, name, email }));
}

/** B2C: students with no institution at all (not a member of any, not enrolled in any class), matching a name or e-mail search. */
export async function independentLearners(c: Caller, search = '') {
  requireInvitesOn();
  requireSuper(c);
  const q = `%${search.trim().replace(/[%_\\]/g, '\\$&')}%`;
  const r = await db.execute<{ id: string; name: string; email: string }>(sql`
    SELECT u.id, u.name, u.email FROM "user" u
     WHERE u.role = 'student'
       AND NOT EXISTS (SELECT 1 FROM member m WHERE m.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM student_enrollments e WHERE e.user_id = u.id)
       AND (${search.trim() === ''} OR u.name ILIKE ${q} OR u.email ILIKE ${q})
     ORDER BY u.name LIMIT 50`);
  return r.rows;
}

async function assertStudentOfInstitution(x: Exec, orgId: string, studentId: string): Promise<void> {
  const [m] = await x.select({ role: member.role }).from(member).where(and(eq(member.organizationId, orgId), eq(member.userId, studentId))).limit(1);
  if (!m || roleFromMember(m.role) !== 'student') throw new HwError('BAD_REQUEST', 'That person is not a student of this institution.');
}
async function assertIndependentLearner(x: Exec, studentId: string): Promise<void> {
  const [u] = await x.select({ role: user.role }).from(user).where(eq(user.id, studentId)).limit(1);
  if (!u || u.role !== 'student') throw new HwError('BAD_REQUEST', 'That account is not a student.');
  const [m] = await x.select({ id: member.id }).from(member).where(eq(member.userId, studentId)).limit(1);
  const [e] = await x.select({ id: studentEnrollments.id }).from(studentEnrollments).where(eq(studentEnrollments.userId, studentId)).limit(1);
  if (m || e) throw new HwError('BAD_REQUEST', 'That student belongs to an institution: the institution admin sends the guardian invitation.');
}

// ── Inviting ─────────────────────────────────────────────────────────────────

export interface InviteResult { id: string; link: string; emailSent: boolean; emailError?: string; expiresAt: Date }

export async function invite(c: Caller, input: { mode: 'institution' | 'independent'; studentId: string; email: string }, deps: OnboardingDeps = realDeps): Promise<InviteResult> {
  requireInvitesOn();
  const email = normaliseEmail(input.email);
  if (!EMAIL.test(email) || email.length > 254) throw new HwError('BAD_REQUEST', 'Enter a valid e-mail address for the guardian.');
  const orgId = input.mode === 'institution' ? requireInstitutionAdmin(c) : null;
  if (input.mode === 'independent') requireSuper(c);

  const token = randomBytes(32).toString('base64url');
  const created = await db.transaction(async (tx) => {
    if (orgId) await assertStudentOfInstitution(tx, orgId, input.studentId); else await assertIndependentLearner(tx, input.studentId);
    const [student] = await tx.select({ id: user.id, name: user.name, email: user.email }).from(user).where(eq(user.id, input.studentId)).limit(1);
    if (!student) throw new HwError('NOT_FOUND', 'Student not found.');
    if (normaliseEmail(student.email) === email) throw new HwError('BAD_REQUEST', 'The guardian needs an e-mail address of their own, not the student\'s.');

    // Someone already linked with this address: nothing to invite.
    const linked = await tx.execute(sql`
      SELECT 1 FROM guardian_link l JOIN "user" g ON g.id = l.guardian_user_id
       WHERE lower(g.email) = ${email} AND l.student_user_id = ${input.studentId} AND l.ended_at IS NULL AND COALESCE(l.organization_id, '') = ${orgId ?? ''}`);
    if (linked.rows.length) throw new HwError('CONFLICT', 'That guardian is already linked to this student.');

    const now = deps.now();
    // An earlier invitation that ran out is closed so a new one can be made; one still open must be revoked on purpose.
    await tx.execute(sql`UPDATE guardian_invitation SET revoked_at = ${now}, revoked_by = ${'system:expired'}
      WHERE guardian_email = ${email} AND student_user_id = ${input.studentId} AND COALESCE(organization_id, '') = ${orgId ?? ''} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at <= ${now}`);
    const open = await tx.execute(sql`SELECT 1 FROM guardian_invitation WHERE guardian_email = ${email} AND student_user_id = ${input.studentId} AND COALESCE(organization_id, '') = ${orgId ?? ''} AND accepted_at IS NULL AND revoked_at IS NULL`);
    if (open.rows.length) throw new HwError('CONFLICT', 'An invitation to this address for this student is already open. Revoke it first to send a new one.');

    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + INVITATION_VALID_DAYS * 86_400_000);
    await tx.execute(sql`INSERT INTO guardian_invitation (id, token_hash, guardian_email, student_user_id, organization_id, issuer_kind, issuer_user_id, created_at, expires_at)
      VALUES (${id}, ${sha(token)}, ${email}, ${input.studentId}, ${orgId}, ${orgId ? 'institution_admin' : 'super_admin'}, ${c.userId}, ${now}, ${expiresAt})`);
    await writeAudit(tx, { actorId: c.userId, action: 'guardian_invited', entity: 'guardian_invitation', entityId: id, newValue: { organizationId: orgId, studentId: input.studentId, guardianEmail: email } });
    let orgName: string | null = null;
    if (orgId) orgName = (await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, orgId)).limit(1))[0]?.name ?? null;
    return { id, expiresAt, studentName: student.name, orgName };
  });

  const link = `${deps.appUrl().replace(/\/$/, '')}/accept-guardian/${token}`;
  const first = (created.studentName || 'your child').split(/\s+/)[0];
  const where = created.orgName ?? 'DigiClassroom';
  const sent = await deps.send({
    to: email,
    subject: `${where}: you are invited to follow ${first}'s learning / ${first} की पढ़ाई देखने का निमंत्रण`,
    html: emailLayout({
      heading: `Follow ${first}'s learning`,
      body: `${where} has invited you as a parent or guardian of ${first}. Open the link, create your account with THIS e-mail address (or sign in if you already have one), and confirm your e-mail. The invitation is valid for ${INVITATION_VALID_DAYS} days. ` +
        `${where} ने आपको ${first} के अभिभावक के रूप में आमंत्रित किया है। लिंक खोलें, इसी ईमेल पते से अपना खाता बनाएँ (या पहले से खाता हो तो साइन इन करें) और ईमेल की पुष्टि करें। निमंत्रण ${INVITATION_VALID_DAYS} दिन तक मान्य है।`,
      ctaLabel: 'Accept the invitation', ctaUrl: link,
    }),
  }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  if (sent.ok) await db.execute(sql`UPDATE guardian_invitation SET email_sent_at = ${deps.now()} WHERE id = ${created.id}`);
  // When the mail could not be sent the invitation still exists: the issuer can pass the link on by hand.
  return { id: created.id, link, expiresAt: created.expiresAt, emailSent: sent.ok, ...(sent.ok ? {} : { emailError: sent.error ?? 'not sent' }) };
}

// ── Listing and ending (institution admin: their institution; super admin: independent learners) ──

type InvStatus = 'open' | 'accepted' | 'revoked' | 'expired';

export async function listInvitations(c: Caller) {
  requireInvitesOn();
  const scope = isSuperAdmin(c) && !c.orgId ? null : requireInstitutionAdmin(c);
  const r = await db.execute<{ id: string; guardian_email: string; student_name: string; created_at: Date; expires_at: Date; email_sent_at: Date | null; accepted_at: Date | null; revoked_at: Date | null }>(sql`
    SELECT i.id, i.guardian_email, s.name AS student_name, i.created_at, i.expires_at, i.email_sent_at, i.accepted_at, i.revoked_at
      FROM guardian_invitation i JOIN "user" s ON s.id = i.student_user_id
     WHERE ${scope === null ? sql`i.organization_id IS NULL` : sql`i.organization_id = ${scope}`} ORDER BY i.created_at DESC LIMIT 300`);
  const now = Date.now();
  return r.rows.map((x) => ({
    id: x.id, guardianEmail: x.guardian_email, studentName: x.student_name, createdAt: x.created_at, expiresAt: x.expires_at, emailSent: !!x.email_sent_at,
    status: (x.accepted_at ? 'accepted' : x.revoked_at ? 'revoked' : +new Date(x.expires_at) <= now ? 'expired' : 'open') as InvStatus,
  }));
}

export async function revokeInvitation(c: Caller, invitationId: string) {
  requireInvitesOn();
  const scope = isSuperAdmin(c) && !c.orgId ? null : requireInstitutionAdmin(c);
  await db.transaction(async (tx) => {
    const r = await tx.execute<{ id: string }>(sql`
      UPDATE guardian_invitation SET revoked_at = now(), revoked_by = ${c.userId}
       WHERE id = ${invitationId} AND accepted_at IS NULL AND revoked_at IS NULL AND ${scope === null ? sql`organization_id IS NULL` : sql`organization_id = ${scope}`} RETURNING id`);
    if (!r.rows.length) throw new HwError('NOT_FOUND', 'No open invitation with that id.');
    await writeAudit(tx, { actorId: c.userId, action: 'guardian_invitation_revoked', entity: 'guardian_invitation', entityId: invitationId });
  });
}

export async function listLinks(c: Caller) {
  requireInvitesOn();
  const scope = isSuperAdmin(c) && !c.orgId ? null : requireInstitutionAdmin(c);
  const r = await db.execute<{ id: string; guardian_name: string; guardian_email: string; student_name: string; created_at: Date; ended_at: Date | null }>(sql`
    SELECT l.id, g.name AS guardian_name, g.email AS guardian_email, s.name AS student_name, l.created_at, l.ended_at
      FROM guardian_link l JOIN "user" g ON g.id = l.guardian_user_id JOIN "user" s ON s.id = l.student_user_id
     WHERE ${scope === null ? sql`l.organization_id IS NULL` : sql`l.organization_id = ${scope}`} ORDER BY (l.ended_at IS NULL) DESC, l.created_at DESC LIMIT 500`);
  return r.rows.map((x) => ({ id: x.id, guardianName: x.guardian_name, guardianEmail: x.guardian_email, studentName: x.student_name, createdAt: x.created_at, endedAt: x.ended_at }));
}

export async function endLink(c: Caller, linkId: string) {
  requireInvitesOn();
  const scope = isSuperAdmin(c) && !c.orgId ? null : requireInstitutionAdmin(c);
  await db.transaction(async (tx) => {
    const r = await tx.execute<{ id: string }>(sql`
      UPDATE guardian_link SET ended_at = now(), ended_by = ${c.userId}
       WHERE id = ${linkId} AND ended_at IS NULL AND ${scope === null ? sql`organization_id IS NULL` : sql`organization_id = ${scope}`} RETURNING id`);
    if (!r.rows.length) throw new HwError('NOT_FOUND', 'No active link with that id.');
    await writeAudit(tx, { actorId: c.userId, action: 'guardian_unlinked', entity: 'guardian_link', entityId: linkId });
  });
}

// ── The guardian: preview, accept, wards ─────────────────────────────────────

const mask = (e: string) => e.replace(/^(.).*(@.*)$/, '$1***$2');

type InvRow = { id: string; guardian_email: string; student_user_id: string; organization_id: string | null; issuer_kind: string; created_at: Date; expires_at: Date; accepted_at: Date | null; revoked_at: Date | null; student_name: string; org_name: string | null };

async function findByToken(x: Exec, token: string): Promise<InvRow | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const r = await x.execute<InvRow>(sql`
    SELECT i.id, i.guardian_email, i.student_user_id, i.organization_id, i.issuer_kind, i.created_at, i.expires_at, i.accepted_at, i.revoked_at, s.name AS student_name, o.name AS org_name
      FROM guardian_invitation i JOIN "user" s ON s.id = i.student_user_id LEFT JOIN organization o ON o.id = i.organization_id WHERE i.token_hash = ${sha(token)}`);
  return r.rows[0] ?? null;
}

function problemWith(inv: InvRow | null, now: Date): string | null {
  if (!inv) return 'This invitation link is not valid.';
  if (inv.accepted_at) return 'This invitation has already been used.';
  if (inv.revoked_at) return 'This invitation was cancelled. Please ask for a new one.';
  if (+new Date(inv.expires_at) <= +now) return 'This invitation has expired. Please ask for a new one.';
  return null;
}

/** What the guardian is told before accepting (they are signed in): who invited them, for which ward, and which address it is for. */
export async function previewInvitation(c: Caller, token: string, deps: OnboardingDeps = realDeps) {
  requireInvitesOn();
  const inv = await findByToken(db, token);
  const problem = problemWith(inv, deps.now());
  if (problem || !inv) return { valid: false as const, problem: problem ?? 'This invitation link is not valid.' };
  return {
    valid: true as const, studentFirstName: (inv.student_name || '').split(/\s+/)[0], organizationName: inv.org_name, forEmail: mask(inv.guardian_email),
    addressMatches: normaliseEmail(c.email) === inv.guardian_email,
  };
}

export async function acceptInvitation(c: Caller, token: string, deps: OnboardingDeps = realDeps) {
  requireInvitesOn();
  return db.transaction(async (tx) => {
    const inv = await findByToken(tx, token);
    const problem = problemWith(inv, deps.now());
    if (problem || !inv) throw new HwError('BAD_REQUEST', problem ?? 'This invitation link is not valid.');
    if (!c.emailVerified) throw new HwError('FORBIDDEN', 'Please confirm your e-mail address first.');
    if (normaliseEmail(c.email) !== inv.guardian_email) throw new HwError('FORBIDDEN', `This invitation is for ${mask(inv.guardian_email)}. You are signed in with a different address.`);
    if (c.userId === inv.student_user_id) throw new HwError('FORBIDDEN', 'A student cannot accept the invitation for their own guardian.');

    // The invitation turns an account into a guardian account, so it must not be an account that is already something else: a student, a teacher, an admin.
    const [me] = await tx.select({ role: user.role, createdAt: user.createdAt }).from(user).where(eq(user.id, c.userId)).limit(1);
    if (!me) throw new HwError('NOT_FOUND', 'Account not found.');
    const isGuardianAlready = me.role === 'parent' || me.role === 'parent_guardian';
    const madeAfterInvite = +new Date(me.createdAt) >= +new Date(inv.created_at) - 60_000;
    if (!isGuardianAlready && !(me.role === 'student' && madeAfterInvite)) {
      throw new HwError('FORBIDDEN', 'This e-mail address already has another kind of account here (for example a student account). Please ask for the invitation to be sent to a different address.');
    }
    if (inv.organization_id) {
      const [m] = await tx.select({ role: member.role }).from(member).where(and(eq(member.organizationId, inv.organization_id), eq(member.userId, c.userId))).limit(1);
      if (m && roleFromMember(m.role) !== 'parent') throw new HwError('FORBIDDEN', 'This account already has another role in the institution.');
      if (!m) await tx.insert(member).values({ id: randomUUID(), organizationId: inv.organization_id, userId: c.userId, role: 'parent', createdAt: deps.now() });
    }
    if (me.role === 'student') await tx.update(user).set({ role: 'parent' }).where(and(eq(user.id, c.userId), eq(user.role, 'student')));

    const exists = await tx.execute<{ id: string }>(sql`SELECT id FROM guardian_link WHERE guardian_user_id = ${c.userId} AND student_user_id = ${inv.student_user_id} AND COALESCE(organization_id, '') = ${inv.organization_id ?? ''} AND ended_at IS NULL`);
    const linkId = exists.rows[0]?.id ?? randomUUID();
    if (!exists.rows.length) {
      await tx.execute(sql`INSERT INTO guardian_link (id, guardian_user_id, student_user_id, organization_id, created_via, invitation_id, created_by)
        VALUES (${linkId}, ${c.userId}, ${inv.student_user_id}, ${inv.organization_id}, ${inv.organization_id ? 'institution_invite' : 'platform_invite'}, ${inv.id}, ${c.userId})`);
    }
    await tx.execute(sql`UPDATE guardian_invitation SET accepted_at = ${deps.now()}, accepted_by = ${c.userId}, link_id = ${linkId} WHERE id = ${inv.id}`);
    await writeAudit(tx, { actorId: c.userId, action: 'guardian_invitation_accepted', entity: 'guardian_link', entityId: linkId, newValue: { invitationId: inv.id, organizationId: inv.organization_id, studentId: inv.student_user_id } });
    return { linkId, studentFirstName: (inv.student_name || '').split(/\s+/)[0], organizationName: inv.org_name };
  });
}

/** The guardian's live wards, across institutions and independent learners. */
export async function myWards(userId: string) {
  requireInvitesOn();
  const r = await db.execute<{ id: string; student_user_id: string; name: string; organization_id: string | null; org_name: string | null; created_at: Date }>(sql`
    SELECT l.id, l.student_user_id, s.name, l.organization_id, o.name AS org_name, l.created_at
      FROM guardian_link l JOIN "user" s ON s.id = l.student_user_id LEFT JOIN organization o ON o.id = l.organization_id
     WHERE l.guardian_user_id = ${userId} AND l.ended_at IS NULL ORDER BY s.name`);
  return r.rows.map((x) => ({ linkId: x.id, studentId: x.student_user_id, name: x.name, organizationId: x.organization_id, organizationName: x.org_name, since: x.created_at }));
}

