// Consent records for the pilot (roadmap task 3.1): record, list, withdraw, and the lookups that gate the work.
// Pure rules are in ../eval/consent-rules.ts; the table is hw_eval_consent (migrations 015 and 022). Only a super admin reads or
// writes consent, so the link from a record to an account (accountEmail) never reaches anyone else. Every change writes an audit
// row in the same transaction (admin-audit.ts).

import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { user } from '@/db/schema';
import { hwEvalConsent, hwEvalTask } from '@/db/hw-eval-schema';
import { writeAudit } from '../admin-audit';
import { HwError } from '../errors';
import { CONSENT_SOURCES, CONSENT_USES, covers, coversWithGuardian, scopeOf, type ConsentRecord, type ConsentSource, type ConsentUse } from '../eval/consent-rules';
import { requireRater, requireSuperAdmin, type EvalActor } from './access';
import { dbRefusal } from './admin';
import { evalSource } from './source';

const PSEUDONYM = /^[A-Za-z0-9_-]{3,40}$/;
const EVIDENCE_PREFIX = 'hw-assignments/evals/consent/';

export interface ConsentInput {
  subjectKind: 'student' | 'parent' | 'teacher' | 'volunteer';
  pseudonym: string;
  organizationId?: string | null;
  formVersion: string;
  language: 'en' | 'hi';
  sources: ConsentSource[];
  uses: ConsentUse[];
  /** YYYY-MM-DD */
  signedAt: string;
  /** Who collected the signed form, as free text (a name or a role). */
  collectedBy: string;
  /** A volunteer's or teacher's own account, so that their copy tasks can be gated on this record. Super admin only. */
  subjectEmail?: string;
  /** A student's record needs a parent's. */
  guardianConsentId?: string;
  /** The scanned form, under hw-assignments/evals/consent/. */
  evidenceKey?: string;
}

const toRecord = (r: typeof hwEvalConsent.$inferSelect): ConsentRecord => ({ id: r.id, subjectKind: r.subjectKind, scope: r.scope, withdrawnAt: r.withdrawnAt, guardianConsentId: r.guardianConsentId });

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function recordConsent(a: EvalActor, input: ConsentInput) {
  requireSuperAdmin(a);
  const pseudonym = input.pseudonym.trim();
  if (!PSEUDONYM.test(pseudonym)) throw new HwError('BAD_REQUEST', 'The pseudonym must be 3 to 40 letters, digits, _ or -. It is never a name.');
  if (!input.sources.length || input.sources.some((s) => !CONSENT_SOURCES.includes(s))) throw new HwError('BAD_REQUEST', 'Choose at least one source (A to F) the person agreed to.');
  if (!input.uses.length || input.uses.some((u) => !CONSENT_USES.includes(u))) throw new HwError('BAD_REQUEST', 'Choose at least one use (evaluation, shadow mode, report).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.signedAt) || Number.isNaN(Date.parse(input.signedAt))) throw new HwError('BAD_REQUEST', 'The date signed must be YYYY-MM-DD.');
  if (input.signedAt > isoDay(new Date(Date.now() + 86_400_000))) throw new HwError('BAD_REQUEST', 'The date signed is in the future.');
  const collectedBy = input.collectedBy.trim();
  if (collectedBy.length < 2) throw new HwError('BAD_REQUEST', 'Say who collected the signed form.');
  if (input.evidenceKey && (!input.evidenceKey.startsWith(EVIDENCE_PREFIX) || input.evidenceKey.includes('..'))) throw new HwError('BAD_REQUEST', `The form scan must be stored under ${EVIDENCE_PREFIX}.`);
  const scope = scopeOf([...new Set(input.sources)].sort(), [...new Set(input.uses)].sort());

  let subjectUserId: string | null = null;
  if (input.subjectEmail) {
    const email = input.subjectEmail.trim().toLowerCase();
    const [u] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`).limit(1);
    if (!u) throw new HwError('NOT_FOUND', 'No account with that email.');
    subjectUserId = u.id;
  }
  if ((input.subjectKind === 'volunteer' || input.subjectKind === 'teacher') && input.sources.includes('A') && !subjectUserId) {
    throw new HwError('BAD_REQUEST', 'A volunteer who copies texts by hand (source A) needs their account email, so their copy tasks can be checked against this record.');
  }

  let guardianConsentId: string | null = null;
  if (input.subjectKind === 'student') {
    if (!input.guardianConsentId) throw new HwError('BAD_REQUEST', "A student's work needs a parent's consent first. Record the parent's, then choose it here.");
    const [g] = await db.select().from(hwEvalConsent).where(eq(hwEvalConsent.id, input.guardianConsentId)).limit(1);
    if (!g || g.subjectKind !== 'parent') throw new HwError('BAD_REQUEST', 'The linked record is not a parent\'s consent.');
    if (g.withdrawnAt) throw new HwError('BAD_REQUEST', "That parent's consent has been withdrawn.");
    if (g.organizationId && input.organizationId && g.organizationId !== input.organizationId) throw new HwError('BAD_REQUEST', "The parent's consent is for a different school.");
    const missing = scope.filter((t) => !g.scope.includes(t));
    if (missing.length) throw new HwError('BAD_REQUEST', `The parent's consent does not cover: ${missing.join(', ')}.`);
    guardianConsentId = g.id;
  } else if (input.guardianConsentId) {
    throw new HwError('BAD_REQUEST', 'Only a student\'s record is linked to a parent\'s.');
  }

  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(hwEvalConsent).values({
        id, organizationId: input.organizationId ?? null, subjectKind: input.subjectKind, formVersion: input.formVersion.trim().slice(0, 40), language: input.language, scope,
        signedAt: input.signedAt, evidenceKey: input.evidenceKey ?? null, recordedBy: a.userId, guardianConsentId, pseudonym, subjectUserId, collectedBy: collectedBy.slice(0, 120),
      });
      await writeAudit(tx, {
        actorId: a.userId, action: 'consent_recorded', entity: 'consent', entityId: id,
        newValue: { subjectKind: input.subjectKind, pseudonym, organizationId: input.organizationId ?? null, formVersion: input.formVersion, language: input.language, scope, signedAt: input.signedAt, collectedBy, linkedAccount: Boolean(subjectUserId), guardianConsentId },
      });
    });
  } catch (e) {
    return dbRefusal(e);
  }
  return { id };
}

export type ConsentStatus = 'active' | 'withdrawn' | 'parent_withdrawn';

export async function listConsents(a: EvalActor) {
  requireSuperAdmin(a);
  const rows = await db.select({ c: hwEvalConsent, email: user.email }).from(hwEvalConsent)
    .leftJoin(user, eq(user.id, hwEvalConsent.subjectUserId)).orderBy(desc(hwEvalConsent.createdAt)).limit(500);
  const byId = new Map(rows.map((r) => [r.c.id, toRecord(r.c)]));
  return rows.map(({ c, email }) => {
    const guardian = c.guardianConsentId ? byId.get(c.guardianConsentId) : undefined;
    const status: ConsentStatus = c.withdrawnAt ? 'withdrawn' : c.subjectKind === 'student' && (!guardian || guardian.withdrawnAt) ? 'parent_withdrawn' : 'active';
    return {
      id: c.id, subjectKind: c.subjectKind, pseudonym: c.pseudonym, organizationId: c.organizationId, formVersion: c.formVersion, language: c.language,
      sources: c.scope.filter((t) => t.startsWith('source:')).map((t) => t.slice(7)), uses: c.scope.filter((t) => t.startsWith('use:')).map((t) => t.slice(4)),
      signedAt: c.signedAt, collectedBy: c.collectedBy, hasScan: Boolean(c.evidenceKey), status, withdrawnAt: c.withdrawnAt, withdrawnReason: c.withdrawnReason,
      guardianConsentId: c.guardianConsentId, accountEmail: email ?? null, recordedAt: c.createdAt,
    };
  });
}

/** One action. The next dataset version leaves the person out; open tasks on their items are cancelled here. */
export async function withdrawConsent(a: EvalActor, consentId: string, reason: string) {
  requireSuperAdmin(a);
  const why = reason.trim();
  if (why.length < 3) throw new HwError('BAD_REQUEST', 'Say why the consent is being withdrawn (it is kept in the audit record).');
  const affected = await db.transaction(async (tx) => {
    const [row] = await tx.update(hwEvalConsent).set({ withdrawnAt: new Date(), withdrawnBy: a.userId, withdrawnReason: why })
      .where(and(eq(hwEvalConsent.id, consentId), isNull(hwEvalConsent.withdrawnAt))).returning();
    if (!row) throw new HwError('NOT_FOUND', 'No live consent with that id (it may already be withdrawn).');
    const students = row.subjectKind === 'parent'
      ? await tx.select({ id: hwEvalConsent.id }).from(hwEvalConsent).where(and(eq(hwEvalConsent.guardianConsentId, row.id), isNull(hwEvalConsent.withdrawnAt)))
      : [];
    await writeAudit(tx, {
      actorId: a.userId, action: 'consent_withdrawn', entity: 'consent', entityId: row.id, reason: why,
      oldValue: { status: 'active', pseudonym: row.pseudonym, subjectKind: row.subjectKind, scope: row.scope }, newValue: { status: 'withdrawn', dependentStudentRecords: students.map((s) => s.id) },
    });
    return [row.id, ...students.map((s) => s.id)];
  });
  const cancelled = await cancelOpenTasksFor(affected);
  return { withdrawn: affected.length, cancelledTasks: cancelled };
}

/** Open or started tasks on items that belong to these consent refs stop; finished work stays (datasets and submissions are immutable). */
export async function cancelOpenTasksFor(refs: string[]): Promise<number> {
  if (!refs.length) return 0;
  const set = new Set(refs);
  const datasets = await db.selectDistinct({ ref: hwEvalTask.datasetRef }).from(hwEvalTask).where(inArray(hwEvalTask.status, ['open', 'in_progress']));
  let n = 0;
  for (const d of datasets) {
    let items;
    try { items = await evalSource().items(d.ref); } catch { continue; }
    const ids = items.filter((i) => i.consent.ref && set.has(i.consent.ref)).map((i) => i.id);
    if (!ids.length) continue;
    const r = await db.update(hwEvalTask).set({ status: 'cancelled' })
      .where(and(eq(hwEvalTask.datasetRef, d.ref), inArray(hwEvalTask.targetId, ids), inArray(hwEvalTask.status, ['open', 'in_progress']))).returning({ id: hwEvalTask.id });
    n += r.length;
  }
  return n;
}

/** The records (and the parents' records of students) for these refs, for the rules in consent-rules.ts. */
export async function consentLookup(refs: readonly string[]): Promise<Map<string, ConsentRecord>> {
  const want = [...new Set(refs.filter(Boolean))];
  if (!want.length) return new Map();
  const rows = await db.select().from(hwEvalConsent).where(inArray(hwEvalConsent.id, want));
  const guardians = rows.map((r) => r.guardianConsentId).filter((g): g is string => !!g && !want.includes(g));
  const more = guardians.length ? await db.select().from(hwEvalConsent).where(inArray(hwEvalConsent.id, guardians)) : [];
  return new Map([...rows, ...more].map((r) => [r.id, toRecord(r)]));
}

/** Source A: a volunteer's own copy tasks need a live record of theirs that covers source A for evaluation. */
export async function volunteerHasConsent(userId: string): Promise<boolean> {
  const rows = await db.select().from(hwEvalConsent).where(and(eq(hwEvalConsent.subjectUserId, userId), isNull(hwEvalConsent.withdrawnAt)));
  return rows.some((r) => covers(toRecord(r), 'A', 'evaluation'));
}

export async function requireVolunteerConsent(a: EvalActor): Promise<void> {
  requireRater(a);
  if (!(await volunteerHasConsent(a.userId))) {
    throw new HwError('FORBIDDEN', 'Your consent has not been recorded yet, so copy tasks are not open to you. Please ask the platform team.');
  }
}

export { coversWithGuardian };
