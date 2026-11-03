// "Draft with AI" rules (roadmap task 3.4). Pure, so the server and the teacher's screen apply the same ones.
//
// A draft is made only from the teacher's own model answer: a question without one cannot be drafted. A drafted point is stored with
// source 'ai_draft' and stays an AI draft until the teacher saves the key points (saving writes them as source 'teacher'). An
// assignment cannot be published while any question still holds an unsaved AI-draft point.

export const DRAFT_NEEDS_MODEL_ANSWER = 'Add a model answer first.';

/** Why a question cannot be drafted, or null when it can. */
export function draftBlockedReason(q: { modelAnswer: string | null | undefined }): string | null {
  return q.modelAnswer && q.modelAnswer.trim() ? null : DRAFT_NEEDS_MODEL_ANSWER;
}

/** A key point the teacher has not saved yet: it is still the AI's draft. */
export const isUnsavedDraft = (r: { source: string }): boolean => r.source === 'ai_draft';

/** Question numbers (1-based, as the teacher sees them) that still hold an unsaved AI-draft point. */
export function unsavedDraftQuestions(questions: { position: number; rubric: { source: string }[] }[]): number[] {
  return questions.filter((q) => q.rubric.some(isUnsavedDraft)).map((q) => q.position + 1);
}

export function publishBlockedByDraft(questions: { position: number; rubric: { source: string }[] }[]): string | null {
  const nums = unsavedDraftQuestions(questions);
  return nums.length
    ? `Question ${nums.join(', ')} still has AI-drafted key points. Check them and save the key points before publishing.`
    : null;
}
