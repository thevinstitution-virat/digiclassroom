import type { HwAiGradeItem, HwQuestionType, HwRubricKind } from '@/db/hw-schema';

export interface GradeRubricItem {
  id: string;
  kind: HwRubricKind;
  description: string;
  marks: number;
}

export interface GradeQuestion {
  id: string;
  type: HwQuestionType;
  prompt: string;
  marks: number;
  modelAnswer: string | null;
  acceptedAnswers: string[];
  rubricVersion: number;
  rubric: GradeRubricItem[];
  /** For a per-subject partial-credit rule (HW_PARTIAL_CREDIT_BY_SUBJECT). */
  subject?: string;
}

export interface GradeInput {
  question: GradeQuestion;
  answers: { answerId: string; transcript: string }[];
}

/** One suggestion, ready to insert into hw_ai_grade. Never written to hw_grade. */
export interface GradeResult {
  answerId: string;
  model: string;
  promptVersion: string;
  rubricVersion: number;
  items: HwAiGradeItem[];
  suggestedMarks: number;
  confidence: number;
  validationNotes: string[];
  /** How this suggestion was produced. Set only while a cost flag that records it is on. */
  markSource?: 'ai' | 'code' | 'reuse';
  /** reuse: the answer whose suggestion this one copies. */
  reusedFromAnswerId?: string;
  /** Hashes that make a suggestion reusable (see grader/dedupe.ts). */
  transcriptHash?: string;
  keyVersionHash?: string;
}

export interface AnswerGrader {
  grade(input: GradeInput): Promise<GradeResult[]>;
}
