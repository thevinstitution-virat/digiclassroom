// A GROUP is the unit eligibility is decided for: subject x question type x language x scheme source (roadmap section 3.1, point 5).
// Pure. The key is what hw_eligibility and hw_eval_gate_result store; the database refuses a key that is not in this exact shape.

export const GROUP_QUESTION_TYPES = ['very_short', 'short', 'long', 'essay'] as const;
export const GROUP_LANGUAGES = ['en', 'hi', 'mixed'] as const;
export const GROUP_SCHEME_SOURCES = ['board_scheme_key', 'passage_key', 'textbook_key', 'teacher_rubric'] as const;
export type GroupQuestionType = (typeof GROUP_QUESTION_TYPES)[number];
export type GroupLanguage = (typeof GROUP_LANGUAGES)[number];
export type GroupSchemeSource = (typeof GROUP_SCHEME_SOURCES)[number];

export interface GroupParts {
  subject: string;
  questionType: GroupQuestionType;
  language: GroupLanguage;
  schemeSource: GroupSchemeSource;
}

/** "Science ", "science" and "SCIENCE" are one subject. A "|" cannot be in a subject (it separates the key's parts). */
export const normaliseSubject = (s: string): string => s.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

export function groupKey(p: GroupParts): string {
  const subject = normaliseSubject(p.subject);
  if (!subject) throw new Error('a group needs a subject');
  return `${subject}|${p.questionType}|${p.language}|${p.schemeSource}`;
}

export function parseGroupKey(key: string): GroupParts | null {
  // The database requires a lower-case key (hw_eligibility_group_key_check); so does this.
  const m = key === key.toLowerCase() ? /^([^|]+)\|(very_short|short|long|essay)\|(en|hi|mixed)\|(board_scheme_key|passage_key|textbook_key|teacher_rubric)$/.exec(key) : null;
  return m ? { subject: m[1], questionType: m[2] as GroupQuestionType, language: m[3] as GroupLanguage, schemeSource: m[4] as GroupSchemeSource } : null;
}

/**
 * The product has four question types; evaluation datasets use finer ones (mcq, case_based, numerical, ...). The same mapping the
 * runner uses when it marks an evaluation item (eval/runner.ts graderType), so a gate result lands in the group the product will check.
 */
export function productQuestionType(evalType: string): GroupQuestionType {
  if (evalType === 'mcq' || evalType === 'assertion_reason' || evalType === 'very_short') return 'very_short';
  if (evalType === 'long' || evalType === 'essay') return evalType;
  return 'short';
}

export const groupLabel = (p: GroupParts): string =>
  `${p.subject} · ${p.questionType.replace('_', ' ')} · ${{ en: 'English', hi: 'Hindi', mixed: 'Hindi + English' }[p.language]} · ${p.schemeSource.replace('_', ' ')}`;
