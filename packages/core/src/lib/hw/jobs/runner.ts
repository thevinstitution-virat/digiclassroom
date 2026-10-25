// One pass over the queue, within a time budget. Called by the cron route every minute in
// production, and in a loop by `npm run hw:worker` locally.

import { getHwConfig } from '../config';
import { describeError } from '../errors';
import { pollGradeBatches, runGradeJobs } from './grade-handler';
import { recoverStale } from './queue';
import { pollReadBatches, runReadJobs } from './read-handler';

export interface DrainSummary {
  recovered: number;
  readPolled: number;
  gradePolled: number;
  readTaken: number;
  gradeTaken: number;
  errors: string[];
  ms: number;
}

export async function drain(workerId: string, budgetMs: number): Promise<DrainSummary> {
  const started = Date.now();
  const deadline = started + budgetMs;
  const s: DrainSummary = { recovered: 0, readPolled: 0, gradePolled: 0, readTaken: 0, gradeTaken: 0, errors: [], ms: 0 };

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
  await step('read', () => runReadJobs(workerId, deadline), 'readTaken');
  await step('grade', () => runGradeJobs(workerId, deadline), 'gradeTaken');

  s.ms = Date.now() - started;
  return s;
}
