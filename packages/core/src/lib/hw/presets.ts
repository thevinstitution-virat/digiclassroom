// Question-type presets shown in the assignment builder. Defaults only: the teacher can
// change marks and lines on every question.

import type { HwQuestionType } from '@/db/hw-schema';

export interface QuestionPreset {
  type: HwQuestionType;
  defaultMarks: number;
  /** Allowed range the builder offers; the database only requires marks > 0. */
  marksRange: [number, number];
  answerLines: number;
}

export const QUESTION_PRESETS: Record<HwQuestionType, QuestionPreset> = {
  very_short: { type: 'very_short', defaultMarks: 1, marksRange: [0.5, 1], answerLines: 2 },
  short: { type: 'short', defaultMarks: 2, marksRange: [2, 3], answerLines: 6 },
  long: { type: 'long', defaultMarks: 5, marksRange: [4, 6], answerLines: 16 },
  essay: { type: 'essay', defaultMarks: 10, marksRange: [8, 20], answerLines: 40 },
};
