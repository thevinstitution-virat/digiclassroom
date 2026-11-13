// One pass over the queue, within a time budget. Called by the cron route every minute in
// production, and in a loop by `npm run hw:worker` locally.

import { getHwConfig } from '../config';
import { describeError } from '../errors';
import { pollGradeBatches, runGradeJobs } from './grade-handler';
import { recoverStale } from './queue';
import { pollReadBatches, runReadJobs } from './read-handler';
import { monitorTick } from '../shadow/monitor';
import { runKeyBuilds } from '../keys/product';
import { runPracticeRelease } from '../practice/release';
import { runTeacherPen } from '../practice/teacher-pen';
import { pollExamBatches, runExamEvaluations } from '../exams/evaluate';
import { runExamReports } from '../exams/report';

export interface DrainSummary {
  recovered: number;
  readPolled: number;
  gradePolled: number;
  readTaken: number;
  gradeTaken: number;
  /** Answer keys built or settled (roadmap 5.2). */
  keysBuilt: number;
  /** Monitoring rows written (at most every 15 minutes). */
  monitored: number;
  /** Self-practice submissions returned with AI practice estimates (zero unless HW_SELF_PRACTICE_ENABLED). */
  practiceReleased: number;
  /** InkBuddy answers given the teacher's pen (remark and notes) this pass. */
  penWritten: number;
  /** Handed-in exam booklets read and handed to marking (zero unless HW_EXAMS_ENABLED). */
  examsEvaluated: number;
  /** Exam reports made, once an attempt's marking has finished (zero unless HW_EXAMS_ENABLED). */
  examsReported: number;
  errors: string[];
  ms: number;
}

export async function drain(workerId: string, budgetMs: number): Promise<DrainSummary> {
  const started = Date.now();
  const deadline = started + budgetMs;
  const s: DrainSummary = { recovered: 0, readPolled: 0, gradePolled: 0, readTaken: 0, gradeTaken: 0, keysBuilt: 0, monitored: 0, practiceReleased: 0, penWritten: 0, examsEvaluated: 0, examsReported: 0, errors: [], ms: 0 };

  // Each step is isolated: one failing step must not stop the others, and is reported.
  const step = async (name: string, fn: () => Promise<number>, into: keyof Omit<DrainSummary, 'errors' | 'ms'>) => {
    if (Date.now() >= deadline) return;
    try {
      s[into] += await fn();
    } catch (e) {
      s.errors.push(`${name}: ${describeError(e)}`);
      console.error(`[hw] ${name} failed:`, e);
    }
  };

  await step('recover', () => recoverStale(getHwConfig().HW_JOB_STALE_MINUTES), 'recovered');
  await step('poll read batches', () => pollReadBatches(workerId), 'readPolled');
  await step('poll grade batches', () => pollGradeBatches(workerId), 'gradePolled');
  // Reading first: grading needs transcripts.
  // exam booklets first: what they hand over is marked by the grade step of this same pass
  await step('poll exam batches', async () => (await pollExamBatches()).filter((o) => o.state !== 'waiting').length, 'examsEvaluated');
  await step('exams', async () => (await runExamEvaluations()).filter((o) => o.ok).length, 'examsEvaluated');
  await step('read', () => runReadJobs(workerId, deadline), 'readTaken');
  await step('grade', () => runGradeJobs(workerId, deadline), 'gradeTaken');
  // an exam attempt whose marking this pass finished gets its report (one text-only writing check per report)
  await step('exam reports', async () => (await runExamReports()).filter((o) => o.ok).length, 'examsReported');
  // Independent learners have no teacher: return what is ready, with AI practice estimates (a no-op unless HW_SELF_PRACTICE_ENABLED).
  await step('practice release', () => runPracticeRelease(), 'practiceReleased');
  await step('teacher pen', () => runTeacherPen(), 'penWritten');
  // Keys after reading and marking: a teacher waiting for a key is waiting on an authoring step, not on a student's work.
  await step('keys', () => runKeyBuilds(workerId, deadline), 'keysBuilt');
  // Last, and only with time left: monitoring never delays reading or marking.
  await step('monitor', () => monitorTick(), 'monitored');

  s.ms = Date.now() - started;
  return s;
}
