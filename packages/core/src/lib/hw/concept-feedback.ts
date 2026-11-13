// Virat Evaluator: feedback per concept. A marked submission is read concept by concept from the library's knowledge
// graph: each question is matched to the passages that teach it (the same scoped hub search the tutor uses), those
// passages to the concepts they teach (graph/expand), and the marks a student lost are added up per concept, with what
// to revise first (the concept's prerequisites, with their chapters). Off unless LIBRARY_GRAPH_ENABLED; a question the
// graph cannot place is left out, never guessed.
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { hwAnswer, hwGrade, hwQuestion } from '@/db/hw-schema';
import { num } from './db';
import { submissionForView } from './access/guards';
import { studentCanSeeResult } from './access/policy';
import { HwError } from './errors';
import type { HwActor } from './access/policy';
import { graphExpand, libraryGraphEnabled, mainWork, type GraphExpansion } from '../library/graph-client';
import { searchLibrary } from '../library/search';
import { libraryScopeForUser } from '../library/user-scope';

export { conceptFeedback, type ConceptFeedback, type GradedQuestion } from './concept-feedback-core';
import { conceptFeedback, type GradedQuestion } from './concept-feedback-core';

/** A question's place in the graph, remembered for the process: questions do not change once set. */
const placed = new Map<string, GraphExpansion | null>();

async function graphForQuestion(q: GradedQuestion, scope: Record<string, unknown>): Promise<GraphExpansion | null> {
  if (placed.has(q.id)) return placed.get(q.id)!;
  try {
    const res = await searchLibrary({ query: q.prompt.slice(0, 500), ...scope, limit: 4, window: 0 });
    const workId = mainWork(res.results.map((r) => ({ work_id: r.work_id })));
    const ids = res.results.filter((r) => r.work_id === workId).map((r) => r.passage_id);
    const g = workId ? await graphExpand(workId, ids, { limit: 4 }) : null;
    placed.set(q.id, g);
    return g;
  } catch {
    return null; // not remembered: the hub may answer next time
  }
}

/**
 * A question whose answer key was built from the library already knows its place: the key names the book (work) and the exact passages it
 * was written from. InkBuddy questions are placed this way (13 Nov 2026: searching with the question's words found no place for them, and
 * learners saw "could not be matched to the textbook"). Null when the question has no such key; the search below is then the fallback.
 */
async function graphFromKey(questionId: string): Promise<GraphExpansion | null> {
  if (placed.has(`key:${questionId}`)) return placed.get(`key:${questionId}`)!;
  const r = await db.execute<{ passage_hashes: Record<string, string> | null; source_ref: string | null; work_id: string | null }>(sql`
    SELECT k.passage_hashes, k.source_ref, q.origin_ref ->> 'workId' AS work_id
      FROM hw_question q JOIN hw_question_key k ON k.id = q.active_key_id
     WHERE q.id = ${questionId} AND k.status = 'ready' AND k.scheme_source = 'textbook_key'`);
  const k = r.rows[0];
  if (!k) return null;
  const ids = Object.keys(k.passage_hashes ?? {}).filter((i) => i !== 'given');
  // the work: recorded on the question since 13 Nov 2026; before that, the key's source ("<source>: <work id>|<edition>,...")
  const workId = k.work_id ?? /:\s*([^|,\s]+)\|/.exec(k.source_ref ?? '')?.[1] ?? null;
  if (!workId || !ids.length) return null;
  try {
    const g = await graphExpand(workId, ids, { limit: 4 });
    placed.set(`key:${questionId}`, g);
    return g;
  } catch {
    return null;
  }
}

/** Concept feedback for a marked submission, for its student (once returned) or a teacher who may view it. */
export async function conceptFeedbackForSubmission(actor: HwActor, submissionId: string) {
  if (!libraryGraphEnabled()) throw new HwError('NOT_FOUND', 'Concept feedback is not switched on.');
  const { submission, assignment } = await submissionForView(actor, submissionId);
  if (actor.role === 'student' && (submission.studentId !== actor.userId || !studentCanSeeResult(actor, submission))) {
    throw new HwError('CONFLICT', 'Your teacher has not returned this work yet.');
  }
  const questions = await db.select().from(hwQuestion).where(eq(hwQuestion.assignmentId, assignment.id)).orderBy(asc(hwQuestion.position));
  const answers = await db.select({ questionId: hwAnswer.questionId, marks: hwGrade.marks }).from(hwAnswer)
    .leftJoin(hwGrade, eq(hwGrade.answerId, hwAnswer.id))
    .where(and(eq(hwAnswer.submissionId, submission.id)));
  const graded: GradedQuestion[] = questions.map((q) => {
    const a = answers.find((x) => x.questionId === q.id);
    return { id: q.id, position: q.position, prompt: q.prompt, marks: num(q.marks), awarded: a?.marks == null ? null : num(a.marks) };
  });
  const scope = await libraryScopeForUser(submission.studentId);
  const graphOf = new Map<string, GraphExpansion | null>();
  // the key's own book and passages first; the scoped search only for questions without such a key
  for (const q of graded.filter((x) => x.awarded !== null)) {
    graphOf.set(q.id, (await graphFromKey(q.id)) ?? (scope ? await graphForQuestion(q, scope as Record<string, unknown>) : null));
  }
  if (!scope && [...graphOf.values()].every((g) => !g)) return { weak: [], strong: [], note: 'The student has no learning path, so the questions cannot be placed in a book.' };
  return { ...conceptFeedback(graded, graphOf), note: null };
}
