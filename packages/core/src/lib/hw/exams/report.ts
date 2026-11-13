// Phase 6: the exam report (docs/hw-eval/exam-packages.md, section 14). Made once per attempt, when automatic marking has finished, and kept
// as it was made (hw_exam_report is append-only):
//
//   * marks, question by question, each value point with its verdict and the learner's own words the marking pass quoted. A mark comes from
//     the teacher's final grade when there is one, else the latest automatic grade (a rule's or the model's); an answer neither has is listed
//     as waiting for a person, and its marks are left out of the total, never guessed;
//   * an internal choice counts once, at the better of the alternatives answered (CBSE's rule);
//   * the eight parameters, each from the pass that can see it (rules.ts, PARAMETER_SOURCE); the writing check is advice and never moves a mark;
//   * weak areas by chapter and by topic, and where the board blueprint is known, study priorities by unit.
//
// Pure assembly first (tested exactly), then the database side: which attempts are ready, loading them, writing the row.

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { hwAiGrade, hwAiJob, hwAnswer, hwGrade, hwMarkRevision, hwQuestion, hwRubricItem, hwSubmission } from '@/db/hw-schema';
import { hwExamAttempt, hwExamPackage, hwExamReport, hwExamSet, hwExamSetItem } from '@/db/hw-exams-schema';
import { hwBankQuestion } from '@/db/hw-bank-schema';
import { getHwConfig, requireModel } from '../config';
import { db, newId, type Exec } from '../db';
import { describeError } from '../errors';
import { recordUsage } from '../cost/usage';
import { isRuleModel } from '../eligibility/decision';
import type { AiResult } from '../ai';
import { WRITING_PROFILE_PROMPT_VERSION, type WritingProfile } from '../prompts/writing-profile.v1';
import { blueprintFor, studyPriorities, type Blueprint, type StudyPriority } from './blueprint';
import { liveExamAi, type ExamAi } from './page-reader';
import { profileFrom, weakAreas, type ParameterId, type ParameterResult, type WeakArea } from './rules';
import { EXAM_ORG_ID } from './space';
import { percentileOf } from '../practice/pace';

export const REPORT_VERSION = 'exam-report.v1';

const CHOICE = new Set(['mcq', 'assertion_reason']);
const BLANK_MODEL = 'rule:blank';
const round2 = (n: number) => Math.round(n * 100) / 100;
const words = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;
const DRAWING_ASK = /\b(draw|diagram|sketch|tabulate|table)\b/i;
const DRAWN = /\[(diagram|table)\]/i;

// ── inputs ───────────────────────────────────────────────────────────────────

export interface GradeItemLike {
  rubric_item_id: string;
  marks: number;
  verdict?: 'met' | 'partial' | 'missing';
  quote?: string;
  fact?: 'same_fact' | 'right_idea_wrong_detail' | 'different_fact' | 'absent';
}

/** One answer of the attempt, with everything the report needs to know about it. */
export interface ReportAnswer {
  answerId: string;
  /** The marking record's question (the writing check is booked against the first one it reads). */
  questionId?: string;
  number: number;
  alt: string | null;
  choiceGroup: string | null;
  qtype: string;
  chapter: string;
  topic: string;
  /** What the question is marked out of here; `itemMarks` is the set's own mark (more when a drawing part is left out of the mark). */
  marks: number;
  itemMarks: number;
  prompt: string;
  /** The board row's drawing parts (left out of the mark), or empty. */
  diagramParts: string[];
  transcript: string | null;
  transcriptStatus: string;
  transcriptConfidence: number | null;
  unclearCount: number;
  failureReason: string | null;
  handOnly: string | null;
  rubric: { id: string; description: string; marks: number }[];
  /** The teacher's final grade, if any. */
  teacher: { marks: number; itemMarks: { rubric_item_id: string; marks: number }[] } | null;
  /** The latest automatic grade (a rule's or the model's), if any. */
  auto: { model: string; marks: number; items: GradeItemLike[] } | null;
}

// ── output ───────────────────────────────────────────────────────────────────

export type QuestionStatus = 'marked' | 'blank' | 'pending' | 'not_counted';

export interface ReportPoint { text: string; marks: number; awarded: number; verdict: 'met' | 'partial' | 'missing'; quote: string }

export interface ReportQuestion {
  /** The marking record's answer (reports made before 13 Nov 2026 lack it). */
  answerId?: string;
  number: number;
  alt: string | null;
  qtype: string;
  chapter: string;
  topic: string;
  marks: number;
  /** null while it waits for a person, or when it is the alternative not counted. */
  awarded: number | null;
  status: QuestionStatus;
  source: 'teacher' | 'ai' | 'rule' | null;
  points: ReportPoint[];
  /** Marks of the question left out here (a drawing part), said so in the report. */
  excludedMarks: number;
  /** Why it waits for a person. */
  reason: string | null;
}

export interface ReportWeakArea extends WeakArea { level: 'chapter' | 'topic'; topic: string | null }

export interface ReportBody {
  marksAwarded: number;
  maxMarks: number;
  /** Marks of the questions marked (blank ones included): what the total is out of until the pending ones are marked. */
  markedMarks: number;
  pendingMarks: number;
  excludedMarks: number;
  perQuestion: ReportQuestion[];
  profile: { version: string; parameters: ReportParameter[]; writing: WritingProfile | null; priorities: StudyPriority[] };
  weakAreas: ReportWeakArea[];
}

// ── pure assembly ────────────────────────────────────────────────────────────

const verdictOf = (awarded: number, marks: number): ReportPoint['verdict'] => (awarded >= marks - 1e-9 ? 'met' : awarded > 0 ? 'partial' : 'missing');

function pendingReason(a: ReportAnswer): string {
  if (a.handOnly) return 'This question is marked by a person.';
  if (a.transcriptStatus === 'needs_review') return 'A person is checking how your writing was read before it is marked.';
  if (a.transcriptStatus === 'failed') return 'Your answer could not be read; a person will look at it.';
  if (a.failureReason) return 'A person will mark this answer.';
  return 'Not marked yet.';
}

/** One answer's final mark and value points, or null while it waits for a person. */
export function finalOf(a: ReportAnswer): Pick<ReportQuestion, 'awarded' | 'status' | 'source' | 'points'> | null {
  const byId = new Map(a.rubric.map((r) => [r.id, r]));
  const autoItems = new Map((a.auto?.items ?? []).map((i) => [i.rubric_item_id, i]));
  const pointsFrom = (marksOf: (id: string) => number | undefined): ReportPoint[] =>
    a.rubric.map((r) => {
      const awarded = Math.min(r.marks, Math.max(0, marksOf(r.id) ?? 0));
      const ai = autoItems.get(r.id);
      return { text: r.description, marks: r.marks, awarded, verdict: ai?.verdict && !a.teacher ? ai.verdict : verdictOf(awarded, r.marks), quote: ai?.quote ?? '' };
    });
  if (a.teacher) {
    const m = new Map(a.teacher.itemMarks.map((i) => [i.rubric_item_id, i.marks]));
    return { awarded: Math.min(a.marks, Math.max(0, a.teacher.marks)), status: 'marked', source: 'teacher', points: pointsFrom((id) => m.get(id)) };
  }
  if (a.auto) {
    const blank = a.auto.model === BLANK_MODEL;
    // rubric items the grade does not know (a retired rubric) are kept as the grade has them
    const known = a.auto.items.every((i) => byId.has(i.rubric_item_id));
    const points = known ? pointsFrom((id) => autoItems.get(id)?.marks) : [];
    return {
      awarded: blank ? 0 : Math.min(a.marks, Math.max(0, a.auto.marks)),
      status: blank ? 'blank' : 'marked',
      source: isRuleModel(a.auto.model) ? 'rule' : 'ai',
      points,
    };
  }
  if (a.transcriptStatus === 'done' && !(a.transcript ?? '').trim()) return { awarded: 0, status: 'blank', source: 'rule', points: [] };
  return null;
}

/** Per question, with each internal choice counted once (the better alternative answered; CBSE's rule). */
export function perQuestionOf(answers: ReportAnswer[]): ReportQuestion[] {
  const rows = answers.map((a) => {
    const f = finalOf(a);
    const q: ReportQuestion = {
      answerId: a.answerId, number: a.number, alt: a.alt, qtype: a.qtype, chapter: a.chapter, topic: a.topic, marks: a.marks,
      awarded: f?.awarded ?? null, status: f?.status ?? 'pending', source: f?.source ?? null, points: f?.points ?? [],
      excludedMarks: round2(Math.max(0, a.itemMarks - a.marks)), reason: f ? null : pendingReason(a),
    };
    return { a, q };
  });
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.a.choiceGroup ? `g:${r.a.choiceGroup}` : `n:${r.a.number}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const rank = (q: ReportQuestion) => (q.status === 'marked' ? 3 + (q.awarded ?? 0) / Math.max(q.marks, 1) : q.status === 'pending' ? 2 : 1);
    const best = g.reduce((b, r) => (rank(r.q) > rank(b.q) ? r : b));
    for (const r of g) if (r !== best) { r.q.status = 'not_counted'; r.q.awarded = null; r.q.reason = null; }
  }
  return rows.map((r) => r.q);
}

/** The text the writing check reads: the learner's own written answers (not the letters of a multiple choice), or why there is too little. */
export function writingInputOf(answers: ReportAnswer[], minWords = 25, maxChars = 8000): { answers: { label: string; text: string }[]; questionId?: string } | { skip: 'too_little_writing' } {
  const out: { label: string; text: string }[] = [];
  let questionId: string | undefined;
  let n = 0;
  let chars = 0;
  for (const a of answers) {
    if (CHOICE.has(a.qtype)) continue;
    const text = (a.transcript ?? '').trim();
    // only reads that stand: a read waiting for a person to check it would show its misreads as the learner's spelling
    if (!text || a.transcriptStatus !== 'done') continue;
    if (chars + text.length > maxChars) break;
    out.push({ label: `Q${a.number}${a.alt ? ` (${a.alt})` : ''}`, text });
    questionId ??= a.questionId;
    n += words(text);
    chars += text.length;
  }
  return n >= minWords ? { answers: out, ...(questionId ? { questionId } : {}) } : { skip: 'too_little_writing' };
}

/** Why a parameter has no score, for the learner's screen (which says it in the learner's language). */
export type ParameterWhy = 'nothing_marked' | 'no_steps' | 'nothing_read' | 'no_drawing_asked' | 'too_little_writing' | 'writing_off' | 'writing_failed' | 'library';

/** A parameter as the report keeps it: the score and band (rules.ts), the counts behind it, and why it is missing when it is. */
export interface ReportParameter extends ParameterResult {
  facts: Record<string, number>;
  why: ParameterWhy | null;
  /** Spelling, grammar, punctuation: real examples from the answers. */
  examples: { written: string; correct: string }[];
}

/** The eight parameters from what the passes found. Nothing is guessed: a parameter with nothing to go on says why. */
export function parametersOf(answers: ReportAnswer[], questions: ReportQuestion[], writing: WritingProfile | null, writingWhy: ParameterWhy | null): ReportParameter[] {
  const counted = answers.map((a, i) => ({ a, q: questions[i]! })).filter(({ q }) => q.status !== 'not_counted');
  const scores: Partial<Record<ParameterId, number>> = {};
  const notes: Partial<Record<ParameterId, string>> = {};
  const facts: Partial<Record<ParameterId, Record<string, number>>> = {};
  const why: Partial<Record<ParameterId, ParameterWhy>> = { textbook_adherence: 'library' };

  // factual correctness: of what the learner wrote, how much was right (a blank point is not a wrong fact)
  let factN = 0;
  let factSum = 0;
  for (const { a, q } of counted) {
    if (q.status !== 'marked' || !a.auto) continue;
    if (CHOICE.has(a.qtype)) { factN++; factSum += (q.awarded ?? 0) >= q.marks ? 1 : 0; continue; }
    for (const i of a.auto.items) {
      if (i.fact) {
        if (i.fact === 'absent') continue;
        factN++;
        factSum += i.fact === 'same_fact' ? 1 : i.fact === 'right_idea_wrong_detail' ? 0.5 : 0;
      } else if ((i.quote ?? '').trim()) {
        factN++;
        factSum += i.verdict === 'met' ? 1 : i.verdict === 'partial' ? 0.5 : 0;
      }
    }
  }
  if (factN) {
    scores.factual_correctness = factSum / factN;
    facts.factual_correctness = { right: round2(factSum), of: factN };
    notes.factual_correctness = `${round2(factSum)} of ${factN} points you wrote were right.`;
  } else { why.factual_correctness = 'nothing_marked'; notes.factual_correctness = 'nothing written was marked yet'; }

  // step marking: on answers with several value points, the step marks earned
  let stepMarks = 0;
  let stepGot = 0;
  let stepQs = 0;
  for (const { q } of counted) {
    if (q.status !== 'marked' || q.points.length < 2) continue;
    stepQs++;
    for (const p of q.points) { stepMarks += p.marks; stepGot += p.awarded; }
  }
  if (stepMarks > 0) {
    scores.step_marking = stepGot / stepMarks;
    facts.step_marking = { got: round2(stepGot), of: round2(stepMarks), answers: stepQs };
    notes.step_marking = `On ${stepQs} answer(s) with several steps you earned ${round2(stepGot)} of ${round2(stepMarks)} step marks.`;
  } else { why.step_marking = 'no_steps'; notes.step_marking = 'no answer with several steps was marked'; }

  // presentation: how readable the pages were to the reader
  const read = counted.filter(({ a }) => !CHOICE.has(a.qtype) && (a.transcript ?? '').trim());
  if (read.length) {
    const total = read.reduce((n, { a }) => n + words(a.transcript ?? ''), 0);
    const unclear = read.reduce((n, { a }) => n + a.unclearCount, 0);
    const rate = total ? unclear / total : 0;
    const confs = read.map(({ a }) => a.transcriptConfidence).filter((c): c is number => c !== null);
    const base = confs.length ? confs.reduce((s, c) => s + c, 0) / confs.length : 1;
    scores.presentation = base - (confs.length ? 2 : 4) * rate;
    facts.presentation = { unclear, words: total };
    notes.presentation = `${unclear} of ${total} words could not be made out.`;
  } else { why.presentation = 'nothing_read'; notes.presentation = 'no written answer was read'; }

  // diagrams and tables: of the questions that asked for one, how many have one drawn
  const asked = counted.filter(({ a }) => !CHOICE.has(a.qtype) && (a.diagramParts.length > 0 || DRAWING_ASK.test(a.prompt)));
  if (asked.length) {
    const drawn = asked.filter(({ a }) => DRAWN.test(a.transcript ?? '')).length;
    scores.diagrams_and_tables = drawn / asked.length;
    facts.diagrams_and_tables = { drawn, asked: asked.length };
    notes.diagrams_and_tables = `${drawn} of ${asked.length} question(s) asking for a diagram or table had one.`;
  } else { why.diagrams_and_tables = 'no_drawing_asked'; notes.diagrams_and_tables = 'no question asked for a diagram or table'; }

  const WRITING = ['spelling', 'grammar', 'punctuation'] as const;
  if (writing) for (const k of WRITING) scores[k] = writing[k].score / 10;
  else for (const k of WRITING) { why[k] = writingWhy ?? 'writing_failed'; notes[k] = why[k]!.replace(/_/g, ' '); }

  return profileFrom({
    scores,
    ranPasses: { marking: counted.some(({ q }) => q.status === 'marked'), writing: writing !== null, reader: read.length > 0, library: false },
    notes,
  }).map((p) => ({
    ...p,
    facts: facts[p.id] ?? {},
    why: p.band === 'unavailable' ? why[p.id] ?? 'nothing_marked' : null,
    examples: writing && (WRITING as readonly string[]).includes(p.id) ? writing[p.id as (typeof WRITING)[number]].examples : [],
  }));
}

/** The whole report body. `maxMarks` is the set's (the attempt's) maximum. */
export function assembleReport(answers: ReportAnswer[], opts: { maxMarks: number; writing: WritingProfile | null; writingWhy?: ParameterWhy | null; blueprint: Blueprint | null }): ReportBody {
  const perQuestion = perQuestionOf(answers);
  const counted = perQuestion.filter((q) => q.status !== 'not_counted');
  const marked = counted.filter((q) => q.status === 'marked' || q.status === 'blank');
  const marksAwarded = round2(Math.min(opts.maxMarks, marked.reduce((s, q) => s + (q.awarded ?? 0), 0)));
  const outcomes = marked.map((q, i) => ({
    itemId: String(i), chapter: q.chapter, marks: q.marks, awarded: q.awarded ?? 0,
    // weak areas list the kinds of question where marks were lost
    missedKinds: (q.awarded ?? 0) < q.marks ? [q.qtype] : [],
  }));
  const chapters: ReportWeakArea[] = weakAreas(outcomes).map((w) => ({ ...w, level: 'chapter', topic: null }));
  const topics: ReportWeakArea[] = marked.some((q) => q.topic)
    ? weakAreas(marked.map((q, i) => ({ ...outcomes[i]!, chapter: `${q.chapter || 'unlabelled'}\u0000${q.topic || '—'}` })))
      .map((w) => { const [chapter, topic] = w.chapter.split('\u0000'); return { ...w, chapter: chapter!, level: 'topic' as const, topic: topic! }; })
    : [];
  return {
    marksAwarded,
    maxMarks: opts.maxMarks,
    markedMarks: round2(marked.reduce((s, q) => s + q.marks, 0)),
    pendingMarks: round2(counted.filter((q) => q.status === 'pending').reduce((s, q) => s + q.marks, 0)),
    excludedMarks: round2(counted.reduce((s, q) => s + q.excludedMarks, 0)),
    perQuestion,
    profile: {
      version: REPORT_VERSION,
      parameters: parametersOf(answers, perQuestion, opts.writing, opts.writingWhy ?? null),
      writing: opts.writing,
      priorities: opts.blueprint ? studyPriorities(opts.blueprint, outcomes) : [],
    },
    weakAreas: [...chapters, ...topics],
  };
}

// ── the database side ────────────────────────────────────────────────────────

export interface ReportDeps {
  /** The writing check; absent or null = the three writing parameters are reported as not checked. */
  ai?: Pick<ExamAi, 'writingProfile'> | null;
}

export function liveReportDeps(): ReportDeps {
  if (!getHwConfig().HW_EXAMS_WRITING_PROFILE) return { ai: null };
  try {
    return { ai: liveExamAi({ read: requireModel('read'), match: requireModel('grade') }) };
  } catch {
    return { ai: null };
  }
}

/**
 * Attempts whose report can be made: read and handed to marking (the submission has left 'processing'), with no grade job still to run and no
 * answer key still being built for any of their questions, and no report yet.
 */
async function readyAttempts(limit: number): Promise<string[]> {
  const r = await db.execute<{ id: string }>(sql`
    SELECT a.id FROM hw_exam_attempt a
      JOIN hw_submission s ON s.assignment_id = a.assignment_id AND s.student_id = a.user_id
     WHERE a.status = 'evaluating' AND a.assignment_id IS NOT NULL
       AND s.status NOT IN ('draft', 'submitted', 'processing')
       AND NOT EXISTS (SELECT 1 FROM hw_exam_report r WHERE r.attempt_id = a.id)
       AND NOT EXISTS (SELECT 1 FROM hw_answer w WHERE w.submission_id = s.id AND w.transcript_status = 'pending')
       AND NOT EXISTS (SELECT 1 FROM hw_question q JOIN hw_ai_job j ON j.question_id = q.id
                        WHERE q.assignment_id = a.assignment_id AND j.kind = 'grade' AND j.status IN ('queued', 'running', 'batch_pending'))
       AND NOT EXISTS (SELECT 1 FROM hw_question q JOIN hw_question_key k ON k.question_id = q.id
                        WHERE q.assignment_id = a.assignment_id AND k.status = 'building' AND k.superseded_at IS NULL)
     ORDER BY a.submitted_at NULLS LAST
     LIMIT ${limit}`);
  return r.rows.map((x) => x.id);
}

/** Everything about one attempt's answers that the report reads. */
export async function loadReportAnswers(x: Exec, attemptId: string) {
  const attempt = (await x.select().from(hwExamAttempt).where(eq(hwExamAttempt.id, attemptId)).limit(1))[0];
  if (!attempt?.assignmentId) throw new Error(`attempt ${attemptId} has no marking record`);
  const set = (await x.select().from(hwExamSet).where(eq(hwExamSet.id, attempt.setId)).limit(1))[0]!;
  const pkg = (await x.select().from(hwExamPackage).where(eq(hwExamPackage.id, set.packageId)).limit(1))[0]!;
  const sub = (await x.select().from(hwSubmission).where(and(eq(hwSubmission.assignmentId, attempt.assignmentId), eq(hwSubmission.studentId, attempt.userId))).limit(1))[0];
  if (!sub) throw new Error(`attempt ${attemptId} has no submission`);
  const items = await x.select({ i: hwExamSetItem, b: { alt: hwBankQuestion.alt, group: hwBankQuestion.choiceGroup } }).from(hwExamSetItem)
    .leftJoin(hwBankQuestion, eq(hwBankQuestion.id, hwExamSetItem.bankQuestionId)).where(eq(hwExamSetItem.setId, set.id));
  const itemById = new Map(items.map((r) => [r.i.id, r]));
  const rows = await x.select({ q: hwQuestion, a: hwAnswer }).from(hwQuestion)
    .innerJoin(hwAnswer, and(eq(hwAnswer.questionId, hwQuestion.id), eq(hwAnswer.submissionId, sub.id)))
    .where(eq(hwQuestion.assignmentId, attempt.assignmentId)).orderBy(asc(hwQuestion.position));
  const qIds = rows.map((r) => r.q.id);
  const aIds = rows.map((r) => r.a.id);
  // every rubric row, retired ones too: a grade made before a rubric changed still names its own points
  const rubric = qIds.length ? await x.select().from(hwRubricItem).where(inArray(hwRubricItem.questionId, qIds)).orderBy(asc(hwRubricItem.position), asc(hwRubricItem.createdAt)) : [];
  const teacher = aIds.length ? await x.select().from(hwGrade).where(inArray(hwGrade.answerId, aIds)) : [];
  const autos = aIds.length ? await x.select().from(hwAiGrade).where(inArray(hwAiGrade.answerId, aIds)).orderBy(desc(hwAiGrade.createdAt)) : [];
  const latest = new Map<string, (typeof autos)[number]>();
  for (const g of autos) if (!latest.has(g.answerId)) latest.set(g.answerId, g);

  const answers: ReportAnswer[] = rows.map(({ q, a }) => {
    const it = itemById.get(q.originRef.examItemId ?? '');
    const g = latest.get(a.id);
    const t = teacher.find((x) => x.answerId === a.id);
    const used = new Set((g?.items ?? []).map((i) => i.rubric_item_id));
    // the points shown: the grade's own (by id), else the live rubric
    const ownRubric = rubric.filter((r) => r.questionId === q.id);
    const points = ownRubric.filter((r) => used.size ? used.has(r.id) : r.retiredAt === null);
    return {
      answerId: a.id, questionId: q.id, number: it?.i.number ?? Number(q.originRef.examNumber ?? q.position + 1), alt: it?.b?.alt ?? null, choiceGroup: it?.b?.group ?? null,
      qtype: it?.i.qtype ?? q.type, chapter: it?.i.chapter ?? '', topic: it?.i.topic ?? '', marks: Number(q.marks), itemMarks: it?.i.marks ?? Number(q.marks),
      prompt: q.prompt, diagramParts: it?.i.diagramParts ?? [],
      transcript: a.transcript, transcriptStatus: a.transcriptStatus, transcriptConfidence: a.transcriptConfidence === null ? null : Number(a.transcriptConfidence),
      unclearCount: a.unclearCount, failureReason: a.failureReason, handOnly: q.originRef.handOnly ?? null,
      rubric: points.map((r) => ({ id: r.id, description: r.description, marks: Number(r.marks) })),
      teacher: t ? { marks: Number(t.marks), itemMarks: t.itemMarks } : null,
      auto: g ? { model: g.model, marks: Number(g.suggestedMarks), items: g.items } : null,
    };
  });
  return { attempt, set, pkg, submissionId: sub.id, answers, gradeModels: [...new Set([...latest.values()].map((g) => g.model))], gradePrompts: [...new Set([...latest.values()].map((g) => g.promptVersion))] };
}

export type ReportOutcome = { attemptId: string; ok: true; marks: number; max: number; pending: number; costPaise: number } | { attemptId: string; ok: false; error: string };

/** Makes the reports that are ready. A no-op unless HW_EXAMS_ENABLED. */
export async function runExamReports(limit = 5, deps?: ReportDeps): Promise<ReportOutcome[]> {
  if (!getHwConfig().HW_EXAMS_ENABLED) return [];
  const ids = await readyAttempts(limit);
  if (!ids.length) return [];
  const d = deps ?? liveReportDeps();
  const out: ReportOutcome[] = [];
  for (const id of ids) out.push(await reportAttempt(id, d));
  return out;
}

/** One attempt's report. Never throws; a second runner that gets there first wins (one report per attempt), and this one writes nothing. */
export async function reportAttempt(attemptId: string, deps: ReportDeps): Promise<ReportOutcome> {
  try {
    const r = await loadReportAnswers(db, attemptId);
    const bp = blueprintFor({ board: r.pkg.board, classLevel: r.pkg.classLevel, examYear: r.pkg.examYear, subjectCode: r.set.subjectCode });

    let writing: WritingProfile | null = null;
    let writingWhy: ParameterWhy | null = null;
    let writingCall: AiResult | null = null;
    let writingQuestion: string | null = null;
    const input = writingInputOf(r.answers);
    if ('skip' in input) writingWhy = input.skip;
    else if (!deps.ai?.writingProfile) writingWhy = 'writing_off';
    else {
      try {
        const w = await deps.ai.writingProfile({ answers: input.answers });
        writingCall = w.result;
        writingQuestion = input.questionId ?? null;
        writing = w.profile;
        if (!writing) writingWhy = 'writing_failed';
      } catch (e) {
        writingWhy = 'writing_failed';
        console.error(`[hw] exam report ${attemptId}: writing check failed: ${describeError(e)}`);
      }
    }

    const body = assembleReport(r.answers, { maxMarks: r.attempt.maxMarks, writing, writingWhy, blueprint: bp });
    const reader = (await db.execute<{ model: string | null }>(sql`
      SELECT model FROM hw_ai_job WHERE submission_id = ${r.submissionId} AND kind = 'read' AND model IS NOT NULL ORDER BY created_at DESC LIMIT 1`)).rows[0]?.model ?? 'none';
    const grader = r.gradeModels.filter((m) => !isRuleModel(m)).sort()[0] ?? (r.gradeModels.length ? 'rules' : 'none');
    const prompts = [...r.gradePrompts.sort(), ...(writing ? [WRITING_PROFILE_PROMPT_VERSION] : []), REPORT_VERSION].join('+');

    return await db.transaction(async (tx) => {
      const [a] = await tx.select({ status: hwExamAttempt.status }).from(hwExamAttempt).where(eq(hwExamAttempt.id, attemptId)).for('update');
      if (a?.status !== 'evaluating') return { attemptId, ok: false as const, error: `attempt is ${a?.status ?? 'gone'}` };
      // a grade-kind job names a question: the first one the check read; the submission ties the cost to this attempt
      if (writingCall && writingQuestion) {
        const jobId = newId();
        await tx.insert(hwAiJob).values({
          id: jobId, organizationId: EXAM_ORG_ID, kind: 'grade', status: 'done', submissionId: r.submissionId, questionId: writingQuestion, provider: 'openai', model: writingCall.model,
          attempts: 1, startedAt: new Date(), finishedAt: new Date(), error: 'exam report: writing check',
        });
        await recordUsage(tx, { jobId, orgId: EXAM_ORG_ID, model: writingCall.model, usage: writingCall.usage, batch: false, costUsd: writingCall.costUsd });
      }
      // everything this attempt cost: its reads, its marking, the writing check (its questions are its own: one learner per exam assignment)
      const cost = (await tx.execute<{ paise: string | null }>(sql`
        SELECT COALESCE(sum(j.cost_estimate_paise), 0) AS paise FROM hw_ai_job j
         WHERE j.organization_id = ${EXAM_ORG_ID}
           AND (j.submission_id = ${r.submissionId} OR j.question_id IN (SELECT id FROM hw_question WHERE assignment_id = ${r.attempt.assignmentId}))`)).rows[0]?.paise;
      const costPaise = Number(cost ?? 0);
      const inserted = await tx.insert(hwExamReport).values({
        id: newId(), attemptId, marksAwarded: body.marksAwarded, maxMarks: body.maxMarks,
        perQuestion: body.perQuestion as unknown[],
        profile: { ...body.profile, markedMarks: body.markedMarks, pendingMarks: body.pendingMarks, excludedMarks: body.excludedMarks } as Record<string, unknown>,
        weakAreas: body.weakAreas as unknown[], readerModel: reader, graderModel: grader, promptVersion: prompts, costPaise,
      }).onConflictDoNothing().returning({ id: hwExamReport.id });
      if (!inserted.length) return { attemptId, ok: false as const, error: 'already reported' };
      await tx.update(hwExamAttempt).set({ status: 'reported', reportedAt: new Date(), marksAwarded: body.marksAwarded, failureReason: null, updatedAt: new Date() })
        .where(eq(hwExamAttempt.id, attemptId));
      return { attemptId, ok: true as const, marks: body.marksAwarded, max: body.maxMarks, pending: body.perQuestion.filter((q) => q.status === 'pending').length, costPaise };
    });
  } catch (e) {
    const error = describeError(e);
    console.error(`[hw] exam report ${attemptId} failed: ${error}`);
    return { attemptId, ok: false, error };
  }
}

// ── revising a report (migration 036) ───────────────────────────────────────

/**
 * After a person changed marks on a reported attempt (revisions.ts): a NEW report row, the next revision, assembled from the marks as they now
 * stand (a person's grade beats the automatic one). The writing check and the models are carried over from the latest row, never re-run.
 * Runs in the caller's transaction; returns the new revision's marks.
 */
export async function rebuildReport(tx: Exec, attemptId: string): Promise<{ revision: number; marksAwarded: number }> {
  const [latest] = await tx.select().from(hwExamReport).where(eq(hwExamReport.attemptId, attemptId)).orderBy(desc(hwExamReport.revision)).limit(1);
  if (!latest) throw new Error(`attempt ${attemptId} has no report to revise`);
  const r = await loadReportAnswers(tx, attemptId);
  const bp = blueprintFor({ board: r.pkg.board, classLevel: r.pkg.classLevel, examYear: r.pkg.examYear, subjectCode: r.set.subjectCode });
  const prev = latest.profile as Partial<ReportBody['profile']>;
  const writingWhy = (prev.parameters ?? []).find((x) => x.id === 'spelling')?.why ?? null;
  const body = assembleReport(r.answers, { maxMarks: r.attempt.maxMarks, writing: prev.writing ?? null, writingWhy, blueprint: bp });
  const revision = latest.revision + 1;
  await tx.insert(hwExamReport).values({
    id: newId(), attemptId, revision, marksAwarded: body.marksAwarded, maxMarks: body.maxMarks,
    perQuestion: body.perQuestion as unknown[],
    profile: { ...body.profile, markedMarks: body.markedMarks, pendingMarks: body.pendingMarks, excludedMarks: body.excludedMarks } as Record<string, unknown>,
    weakAreas: body.weakAreas as unknown[], readerModel: latest.readerModel, graderModel: latest.graderModel, promptVersion: latest.promptVersion, costPaise: latest.costPaise,
  });
  await tx.update(hwExamAttempt).set({ marksAwarded: body.marksAwarded, updatedAt: new Date() }).where(eq(hwExamAttempt.id, attemptId));
  return { revision, marksAwarded: body.marksAwarded };
}

// ── reading a report ─────────────────────────────────────────────────────────

/** A change of marks as the learner sees it: who only when the reviser is a school's admin or teacher; the app's own staff, the date only. */
export interface LearnerRevision {
  answerId: string;
  marksBefore: number | null;
  marksAfter: number;
  at: Date;
  by: { name: string; designation: string } | null;
}

export interface ReportView extends ReportBody {
  createdAt: Date;
  /** 0 = as made; 1, 2, ... after each revision of its marks. */
  revision: number;
  /** The changes of marks behind the revisions, oldest first. */
  revisions: LearnerRevision[];
  /** Where this score stands among other learners' FIRST attempts at the same set (owner, 13 Nov 2026); a percentile only with 20 of them. */
  standing: { percentile: number | null; peers: number };
  /** This learner's earlier reports on the same set, oldest first, for progress. */
  progress: { attemptNo: number; marksAwarded: number; maxMarks: number; reportedAt: Date; parameters: { id: ParameterId; score: number | null }[] }[];
}

/** The score among other learners' first attempts at the same set, each at its latest revision. Anonymous: only the number comes back. */
async function setStanding(x: Exec, attempt: { userId: string; setId: string }, share: number): Promise<{ percentile: number | null; peers: number }> {
  const r = await x.execute<{ share: string | null }>(sql`
    SELECT DISTINCT ON (a.user_id) r.marks_awarded / NULLIF(r.max_marks, 0) AS share
      FROM hw_exam_report r JOIN hw_exam_attempt a ON a.id = r.attempt_id
     WHERE a.set_id = ${attempt.setId} AND a.user_id <> ${attempt.userId} AND a.attempt_no = 1
     ORDER BY a.user_id, r.revision DESC
     LIMIT 5000`);
  const others = r.rows.map((y) => (y.share === null ? null : Number(y.share))).filter((v): v is number => v !== null && Number.isFinite(v));
  return { percentile: percentileOf(share, others), peers: others.length };
}

/** An attempt's revisions as its learner may see them. */
export async function learnerRevisions(x: Exec, attemptId: string): Promise<LearnerRevision[]> {
  const rows = await x.select().from(hwMarkRevision).where(eq(hwMarkRevision.examAttemptId, attemptId)).orderBy(asc(hwMarkRevision.createdAt));
  return rows.map(learnerRevisionOf);
}

export const learnerRevisionOf = (r: typeof hwMarkRevision.$inferSelect): LearnerRevision => ({
  answerId: r.answerId, marksBefore: r.marksBefore === null ? null : Number(r.marksBefore), marksAfter: Number(r.marksAfter), at: r.createdAt,
  by: r.showReviser ? { name: r.reviserName, designation: r.reviserDesignation } : null,
});

/** The report of an attempt (null before it is made), at its latest revision, with the learner's earlier attempts at the same set. The caller has checked access. */
export async function reportView(x: Exec, attempt: { id: string; userId: string; setId: string; attemptNo: number }): Promise<ReportView | null> {
  const row = (await x.select().from(hwExamReport).where(eq(hwExamReport.attemptId, attempt.id)).orderBy(desc(hwExamReport.revision)).limit(1))[0];
  if (!row) return null;
  const p = row.profile as Partial<ReportBody['profile']> & { markedMarks?: number; pendingMarks?: number; excludedMarks?: number };
  const all = await x.select({ r: hwExamReport, a: { attemptNo: hwExamAttempt.attemptNo, reportedAt: hwExamAttempt.reportedAt } })
    .from(hwExamReport).innerJoin(hwExamAttempt, eq(hwExamAttempt.id, hwExamReport.attemptId))
    .where(and(eq(hwExamAttempt.userId, attempt.userId), eq(hwExamAttempt.setId, attempt.setId)))
    .orderBy(asc(hwExamAttempt.attemptNo), asc(hwExamReport.revision));
  // one row per attempt: its latest revision
  const latestOf = new Map<number, (typeof all)[number]>();
  for (const e of all) latestOf.set(e.a.attemptNo, e);
  return {
    marksAwarded: row.marksAwarded, maxMarks: row.maxMarks,
    markedMarks: p.markedMarks ?? row.maxMarks, pendingMarks: p.pendingMarks ?? 0, excludedMarks: p.excludedMarks ?? 0,
    perQuestion: row.perQuestion as ReportQuestion[],
    profile: { version: p.version ?? REPORT_VERSION, parameters: p.parameters ?? [], writing: p.writing ?? null, priorities: p.priorities ?? [] },
    weakAreas: row.weakAreas as ReportWeakArea[],
    createdAt: row.createdAt,
    revision: row.revision,
    revisions: await learnerRevisions(x, attempt.id),
    standing: await setStanding(x, attempt, row.maxMarks > 0 ? row.marksAwarded / row.maxMarks : 0),
    progress: [...latestOf.values()].filter((e) => e.a.attemptNo <= attempt.attemptNo).map((e) => ({
      attemptNo: e.a.attemptNo, marksAwarded: e.r.marksAwarded, maxMarks: e.r.maxMarks, reportedAt: e.a.reportedAt ?? e.r.createdAt,
      parameters: (((e.r.profile as { parameters?: ReportParameter[] }).parameters) ?? []).map((x) => ({ id: x.id, score: x.score })),
    })),
  };
}
