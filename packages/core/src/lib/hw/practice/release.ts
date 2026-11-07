// The job runner's practice step (docs/hw-eval/self-practice.md). It lives outside jobs/ on purpose: the AI handlers in jobs/ never
// touch final marks, and "AI never finalises a mark" is checked by no-ai-final-grades.test.ts. The single exception, the practice
// space where no teacher exists, is written in services/marking.ts (releasePracticeSubmissions) and reached only from here.

import { releasePracticeSubmissions } from '../services/marking';

/** Return the practice submissions that are ready. Zero unless HW_SELF_PRACTICE_ENABLED. */
export const runPracticeRelease = (): Promise<number> => releasePracticeSubmissions();
