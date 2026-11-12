// Changing marks after they reached the learner (migration 036; docs/hw-eval/mark-revisions.md). Owner's rule, 12 Nov 2026:
//
//   * who: the platform super admin (the app's owner), an institution's admin, and the learner's assigned teacher. For homework that is
//     exactly who may mark the assignment (canManageAssignment). For an exam attempt (the learner is independent of any school in the exam
//     space) it is the super admin, or a school the learner belongs to: its admin, or a teacher linked to a class the learner is enrolled in
//     (and, when the link names a subject, the test's subject);
//   * when: at any time after the marks were released: returned homework, a reported exam attempt;
//   * what the learner sees: "Revised by <name>, <designation>, <date>" for a school's admin or teacher, who must give both; the app's own
//     staff are recorded the same way but the learner sees the date only.
//
// Every change is a hw_mark_revision row (append-only) beside the grade itself (hw_grade, whose own history trigger keeps every value). An exam
// attempt also gets a new report revision (exams/report.ts, rebuildReport).

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { member, studentEnrollments, user } from '@/db/schema';
import { hwAiGrade, hwAnswer, hwClassTeacher, hwGrade, hwMarkRevision, hwQuestion, type HwItemMark, type HwReviserKind } from '@/db/hw-schema';
import { hwExamAttempt, hwExamPackage, hwExamReport, hwExamSet } from '@/db/hw-exams-schema';
import { HwError } from './errors';
import { db, newId, num, type Exec } from './db';
import { linkCovers, roleFromMember, type HwActor } from './access/policy';
import { answerForMarking, checkItemMarks, currentRubric, writePersonGrade } from './services/marking';
import { EXAM_ORG_ID } from './exams/space';
import { learnerRevisionOf, loadReportAnswers, rebuildReport, reportView, type LearnerRevision } from './exams/report';

export interface RevisionInput {
  answerId: string;
  /** Per key point, when the question has a rubric; otherwise `marks`. */
  itemMarks?: HwItemMark[];
  marks?: number;
  reason: string;
  /** Required from a school's admin or teacher; the app's own staff may leave them empty (their account name is kept, never shown). */
  name?: string;
  designation?: string;
}

export interface Reviser { userId: string; kind: HwReviserKind; orgId: string | null }

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** The name and designation to record, checked. Pure. */
export function reviserLabel(kind: HwReviserKind, input: Pick<RevisionInput, 'name' | 'designation' | 'reason'>, accountName: string): { name: string; designation: string; reason: string } {
  const reason = clean(input.reason);
  if (reason.length < 3 || reason.length > 1000) throw new HwError('BAD_REQUEST', 'Say briefly why the marks are changed (3 to 1000 characters).');
  let name = clean(input.name);
  let designation = clean(input.designation);
  if (kind === 'platform') {
    name ||= clean(accountName) || 'Platform staff';
    designation ||= 'Platform';
  }
  if (name.length < 2 || name.length > 120) throw new HwError('BAD_REQUEST', 'Give your name as it should appear on the report (2 to 120 characters).');
  if (designation.length < 2 || designation.length > 120) throw new HwError('BAD_REQUEST', 'Give your designation, for example Class teacher or Principal (2 to 120 characters).');
  return { name, designation, reason };
}

/** What the reviser's form starts with: their account name, and a designation that fits their role (they may change both). */
export function defaultDesignation(kind: HwReviserKind): string {
  return kind === 'platform' ? 'Platform' : kind === 'admin' ? 'Institution admin' : 'Teacher';
}

/** The marks a revision sets, checked against the question: per key point when it has a rubric, else one total, in half marks. */
async function marksOf(input: RevisionInput, q: { id: string; marks: string }): Promise<{ marks: number; itemMarks: HwItemMark[] }> {
  const qMarks = num(q.marks);
  const rubric = await currentRubric(q.id);
  if (input.itemMarks?.length) {
    if (!rubric.length) throw new HwError('BAD_REQUEST', 'This question has no key points; give one mark for it.');
    return { marks: checkItemMarks(input.itemMarks, rubric, qMarks), itemMarks: input.itemMarks };
  }
  const m = input.marks;
  if (m === undefined || !(m >= 0) || m > qMarks || Math.round(m * 2) !== m * 2) throw new HwError('BAD_REQUEST', `Marks must be between 0 and ${qMarks}, in half marks.`);
  return { marks: m, itemMarks: [] };
}

async function accountName(x: Exec, userId: string): Promise<string> {
  return (await x.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1))[0]?.name ?? '';
}

async function insertRevision(tx: Exec, row: {
  organizationId: string; answerId: string; submissionId: string; examAttemptId: string | null; marksBefore: number | null; marksAfter: number;
  itemMarks: HwItemMark[]; reason: string; reviser: Reviser; name: string; designation: string;
}) {
  await tx.insert(hwMarkRevision).values({
    id: newId(), organizationId: row.organizationId, answerId: row.answerId, submissionId: row.submissionId, examAttemptId: row.examAttemptId,
    marksBefore: row.marksBefore === null ? null : String(row.marksBefore), marksAfter: String(row.marksAfter), itemMarks: row.itemMarks, reason: row.reason,
    revisedBy: row.reviser.userId, reviserName: row.name, reviserDesignation: row.designation, reviserKind: row.reviser.kind,
    showReviser: row.reviser.kind !== 'platform', reviserOrgId: row.reviser.kind === 'platform' ? null : row.reviser.orgId,
  });
}

// ── homework ─────────────────────────────────────────────────────────────────

/** Changes the marks of an answer in RETURNED work. Before the work is returned, marks are simply marked (services/marking.ts). */
export async function reviseHomeworkAnswer(actor: HwActor, input: RevisionInput) {
  const { answer, question, submission } = await answerForMarking(actor, input.answerId);
  if (submission.status !== 'returned') throw new HwError('CONFLICT', 'This work has not been returned yet: change its marks in marking.');
  const reviser: Reviser = { userId: actor.userId, kind: actor.isPlatformStaff ? 'platform' : actor.role === 'admin' ? 'admin' : 'teacher', orgId: actor.isPlatformStaff ? null : actor.orgId };
  const label = reviserLabel(reviser.kind, input, await accountName(db, actor.userId));
  const g = await marksOf(input, question);
  return db.transaction(async (tx) => {
    const [before] = await tx.select({ marks: hwGrade.marks }).from(hwGrade).where(eq(hwGrade.answerId, answer.id)).for('update');
    if (before && num(before.marks) === g.marks && !input.itemMarks?.length) throw new HwError('BAD_REQUEST', 'These are already the marks.');
    await writePersonGrade(tx, answer.organizationId, answer.id, actor.userId, g);
    await insertRevision(tx, {
      organizationId: answer.organizationId, answerId: answer.id, submissionId: submission.id, examAttemptId: null,
      marksBefore: before ? num(before.marks) : null, marksAfter: g.marks, itemMarks: g.itemMarks, reason: label.reason, reviser, name: label.name, designation: label.designation,
    });
    return { marks: g.marks };
  });
}

/** For a learner's (or a parent's) view of returned work: each answer's latest revision, as the learner may see it. */
export async function latestRevisionsFor(x: Exec, answerIds: string[]): Promise<Map<string, LearnerRevision>> {
  const out = new Map<string, LearnerRevision>();
  if (!answerIds.length) return out;
  const rows = await x.select().from(hwMarkRevision).where(inArray(hwMarkRevision.answerId, answerIds)).orderBy(desc(hwMarkRevision.createdAt));
  for (const r of rows) if (!out.has(r.answerId)) out.set(r.answerId, learnerRevisionOf(r));
  return out;
}

/** The reviser's own form defaults for homework (the signed-in person in their institution). */
export async function homeworkReviserDefaults(actor: HwActor) {
  const kind: HwReviserKind = actor.isPlatformStaff ? 'platform' : actor.role === 'admin' ? 'admin' : 'teacher';
  return { kind, name: await accountName(db, actor.userId), designation: defaultDesignation(kind), nameShown: kind !== 'platform' };
}

// ── exam attempts ────────────────────────────────────────────────────────────

/**
 * May this person revise this learner's exam report? The super admin always; otherwise a school the learner is a student of: its admin, or a
 * teacher linked to a class the learner is actively enrolled in (a link naming a subject must name the test's). Null = no.
 */
export async function examReviserFor(x: Exec, userId: string, learnerId: string, subject: string): Promise<Reviser | null> {
  const [u] = await x.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1);
  if (!u) return null;
  if (u.role === 'super_admin') return { userId, kind: 'platform', orgId: null };
  if (userId === learnerId) return null;
  const schools = (await x.select({ org: member.organizationId, role: member.role }).from(member).where(eq(member.userId, learnerId)))
    .filter((m) => roleFromMember(m.role) === 'student').map((m) => m.org);
  if (!schools.length) return null;
  const mine = await x.select({ org: member.organizationId, role: member.role }).from(member).where(and(eq(member.userId, userId), inArray(member.organizationId, schools)));
  // an admin role in any of the learner's schools is enough; a teacher needs a class link that covers the learner
  for (const m of mine) if (roleFromMember(m.role) === 'admin') return { userId, kind: 'admin', orgId: m.org };
  for (const m of mine) {
    if (roleFromMember(m.role) !== 'teacher') continue;
    const links = await x.select({ classId: hwClassTeacher.classId, sectionId: hwClassTeacher.sectionId, subject: hwClassTeacher.subject }).from(hwClassTeacher)
      .where(and(eq(hwClassTeacher.organizationId, m.org), eq(hwClassTeacher.teacherId, userId)));
    const enrolled = await x.select({ classId: studentEnrollments.classId, sectionId: studentEnrollments.sectionId }).from(studentEnrollments)
      .where(and(eq(studentEnrollments.organizationId, m.org), eq(studentEnrollments.userId, learnerId), eq(studentEnrollments.status, 'active')));
    if (enrolled.some((e) => links.some((l) => linkCovers(l, { classId: e.classId, sectionId: e.sectionId, subject })))) return { userId, kind: 'teacher', orgId: m.org };
  }
  return null;
}

async function attemptOf(x: Exec, attemptId: string) {
  const [row] = await x.select({ a: hwExamAttempt, s: hwExamSet, p: hwExamPackage }).from(hwExamAttempt)
    .innerJoin(hwExamSet, eq(hwExamSet.id, hwExamAttempt.setId)).innerJoin(hwExamPackage, eq(hwExamPackage.id, hwExamSet.packageId))
    .where(eq(hwExamAttempt.id, attemptId)).limit(1);
  return row ?? null;
}

/** Someone who may not revise this attempt is told it is not there (as for anyone else's attempt). */
async function reviserForAttempt(x: Exec, userId: string, attemptId: string) {
  const row = await attemptOf(x, attemptId);
  const reviser = row ? await examReviserFor(x, userId, row.a.userId, row.s.subject) : null;
  if (!row || !reviser) throw new HwError('NOT_FOUND', 'Report not found.');
  return { ...row, reviser };
}

/** Changes the marks of one answer of a REPORTED exam attempt (a pending answer gets its first mark this way), then re-makes the report. */
export async function reviseExamAnswer(userId: string, input: RevisionInput) {
  const [ans] = await db.select({ a: hwAnswer, q: hwQuestion }).from(hwAnswer).innerJoin(hwQuestion, eq(hwQuestion.id, hwAnswer.questionId))
    .where(and(eq(hwAnswer.id, input.answerId), eq(hwAnswer.organizationId, EXAM_ORG_ID))).limit(1);
  if (!ans) throw new HwError('NOT_FOUND', 'Answer not found.');
  const [att] = await db.select({ id: hwExamAttempt.id }).from(hwExamAttempt).where(eq(hwExamAttempt.assignmentId, ans.q.assignmentId)).limit(1);
  if (!att) throw new HwError('NOT_FOUND', 'Answer not found.');
  const { a, reviser } = await reviserForAttempt(db, userId, att.id);
  if (a.status !== 'reported') throw new HwError('CONFLICT', 'This attempt has no report yet; marks can be revised once it is reported.');
  const label = reviserLabel(reviser.kind, input, await accountName(db, userId));
  const g = await marksOf(input, ans.q);
  return db.transaction(async (tx) => {
    // the attempt row is the lock: two revisions of one attempt never make the same report revision
    await tx.select({ id: hwExamAttempt.id }).from(hwExamAttempt).where(eq(hwExamAttempt.id, a.id)).for('update');
    const [teacher] = await tx.select({ marks: hwGrade.marks }).from(hwGrade).where(eq(hwGrade.answerId, ans.a.id)).limit(1);
    const [auto] = teacher ? [] : await tx.select({ marks: hwAiGrade.suggestedMarks }).from(hwAiGrade).where(eq(hwAiGrade.answerId, ans.a.id)).orderBy(desc(hwAiGrade.createdAt)).limit(1);
    const before = teacher ? num(teacher.marks) : auto ? num(auto.marks) : null;
    await writePersonGrade(tx, EXAM_ORG_ID, ans.a.id, userId, g);
    await insertRevision(tx, {
      organizationId: EXAM_ORG_ID, answerId: ans.a.id, submissionId: ans.a.submissionId, examAttemptId: a.id,
      marksBefore: before, marksAfter: g.marks, itemMarks: g.itemMarks, reason: label.reason, reviser, name: label.name, designation: label.designation,
    });
    return rebuildReport(tx, a.id);
  });
}

/** Reported exam attempts this person may revise, newest first: every one for the super admin; their schools' learners for a school's staff. */
export async function examReportsForStaff(userId: string, limit = 200) {
  const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1);
  const base = db.select({ a: hwExamAttempt, s: hwExamSet, p: hwExamPackage, learner: { id: user.id, name: user.name } }).from(hwExamAttempt)
    .innerJoin(hwExamSet, eq(hwExamSet.id, hwExamAttempt.setId)).innerJoin(hwExamPackage, eq(hwExamPackage.id, hwExamSet.packageId))
    .innerJoin(user, eq(user.id, hwExamAttempt.userId));
  let rows;
  if (u?.role === 'super_admin') {
    rows = await base.where(eq(hwExamAttempt.status, 'reported')).orderBy(desc(hwExamAttempt.reportedAt)).limit(limit);
  } else {
    // candidates: students of the schools where this person is admin or teacher; each is then checked the way a revision is
    const staffIn = (await db.select({ org: member.organizationId, role: member.role }).from(member).where(eq(member.userId, userId)))
      .filter((m) => ['admin', 'teacher'].includes(roleFromMember(m.role))).map((m) => m.org);
    if (!staffIn.length) return [];
    const learners = [...new Set((await db.select({ id: member.userId, role: member.role }).from(member).where(inArray(member.organizationId, staffIn)))
      .filter((m) => roleFromMember(m.role) === 'student').map((m) => m.id))];
    if (!learners.length) return [];
    const cand = await base.where(and(eq(hwExamAttempt.status, 'reported'), inArray(hwExamAttempt.userId, learners))).orderBy(desc(hwExamAttempt.reportedAt)).limit(limit);
    rows = [];
    for (const r of cand) if (await examReviserFor(db, userId, r.a.userId, r.s.subject)) rows.push(r);
  }
  const ids = rows.map((r) => r.a.id);
  const revised = ids.length ? await db.select({ attemptId: hwMarkRevision.examAttemptId, at: hwMarkRevision.createdAt }).from(hwMarkRevision).where(inArray(hwMarkRevision.examAttemptId, ids)) : [];
  const pending = new Map<string, number>();
  if (ids.length) {
    for (const r of await db.select({ attemptId: hwExamReport.attemptId, revision: hwExamReport.revision, per: hwExamReport.perQuestion }).from(hwExamReport).where(inArray(hwExamReport.attemptId, ids)).orderBy(asc(hwExamReport.revision))) {
      pending.set(r.attemptId, (r.per as { status?: string }[]).filter((q) => q.status === 'pending').length);
    }
  }
  return rows.map((r) => ({
    attemptId: r.a.id, learner: r.learner.name, setTitle: r.s.title, packageTitle: r.p.title, subject: r.s.subject, attemptNo: r.a.attemptNo,
    reportedAt: r.a.reportedAt, marksAwarded: r.a.marksAwarded, maxMarks: r.a.maxMarks, pending: pending.get(r.a.id) ?? 0,
    revisions: revised.filter((x) => x.attemptId === r.a.id).length,
  }));
}

/** One reported attempt for a reviser: the report, every question with its key points and current marks, and the full revision history. */
export async function examReportForStaff(userId: string, attemptId: string) {
  const { a, s, p, reviser } = await reviserForAttempt(db, userId, attemptId);
  const learner = (await db.select({ name: user.name }).from(user).where(eq(user.id, a.userId)).limit(1))[0]?.name ?? '';
  const report = await reportView(db, a);
  const loaded = await loadReportAnswers(db, attemptId);
  const history = await db.select().from(hwMarkRevision).where(eq(hwMarkRevision.examAttemptId, attemptId)).orderBy(asc(hwMarkRevision.createdAt));
  const name = await accountName(db, userId);
  return {
    attempt: { id: a.id, attemptNo: a.attemptNo, status: a.status, reportedAt: a.reportedAt, marksAwarded: a.marksAwarded, maxMarks: a.maxMarks },
    learner, set: { title: s.title, subject: s.subject }, packageTitle: p.title,
    report,
    questions: loaded.answers.map((x) => {
      // reports made before 13 Nov 2026 have no answer ids in their questions: those are matched by number and alternative
      const row = report?.perQuestion.find((q) => q.answerId === x.answerId)
        ?? report?.perQuestion.find((q) => !q.answerId && q.number === x.number && (q.alt ?? null) === (x.alt ?? null));
      const current = x.teacher ? x.teacher.itemMarks : (x.auto?.items ?? []).map((i) => ({ rubric_item_id: i.rubric_item_id, marks: i.marks }));
      return {
        answerId: x.answerId, number: x.number, alt: x.alt, qtype: x.qtype, marks: x.marks, transcript: x.transcript,
        status: row?.status ?? null, awarded: row?.awarded ?? null,
        rubric: x.rubric.map((r) => ({ ...r, awarded: current.find((c) => c.rubric_item_id === r.id)?.marks ?? 0 })),
      };
    }),
    history: history.map((h) => ({
      answerId: h.answerId, marksBefore: h.marksBefore === null ? null : Number(h.marksBefore), marksAfter: Number(h.marksAfter), at: h.createdAt,
      name: h.reviserName, designation: h.reviserDesignation, kind: h.reviserKind, shownToLearner: h.showReviser, reason: h.reason,
    })),
    me: { kind: reviser.kind, name, designation: defaultDesignation(reviser.kind), nameShown: reviser.kind !== 'platform' },
  };
}

/** Whether there is anything this person could revise at all (for showing the menu entry). */
export async function canReviseAnyExam(userId: string): Promise<boolean> {
  const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1);
  if (u?.role === 'super_admin') return true;
  const staff = (await db.select({ role: member.role }).from(member).where(eq(member.userId, userId))).some((m) => ['admin', 'teacher'].includes(roleFromMember(m.role)));
  return staff;
}

