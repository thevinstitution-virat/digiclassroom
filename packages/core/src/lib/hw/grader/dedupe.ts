// Marking identical answers once (HW_DEDUPE_MARKING_ENABLED).
//
// An AI suggestion is reused only when ALL of these are identical:
//   - the normalised transcript (Unicode NFC, zero-width characters removed, spacing collapsed;
//     case, spelling and punctuation are kept, because marks depend on them),
//   - the question, and
//   - the key version: the question's prompt, marks, type, model answer, accepted answers, rubric
//     version and every rubric item.
// Anything else is marked on its own, exactly as before.

import { createHash } from 'node:crypto';
import { normaliseForQuote } from '../text/normalise';
import type { GradeQuestion } from './types';

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

export const transcriptHash = (transcript: string): string => sha256(normaliseForQuote(transcript));

/** Everything about the question that can change a mark. A new rubric version or an edited item is a new key version. */
export function keyVersionHash(q: GradeQuestion): string {
  return sha256(JSON.stringify([
    q.id, q.type, q.prompt, q.marks, q.modelAnswer ?? null, [...q.acceptedAnswers], q.rubricVersion,
    q.rubric.map((r) => [r.id, r.kind, r.description, r.marks]),
  ]));
}

export interface PendingAnswer { answerId: string; transcript: string }

export interface DuplicatePlan {
  /** One answer per distinct transcript: these go to the AI. */
  toAi: PendingAnswer[];
  /** representative answer id -> the later answers with the same transcript, in order. */
  followers: Record<string, string[]>;
}

/** Group pending answers (of ONE question) by transcript. The earliest of each group is the representative. */
export function planDuplicates(pending: readonly PendingAnswer[]): DuplicatePlan {
  const rep = new Map<string, string>();
  const toAi: PendingAnswer[] = [];
  const followers: Record<string, string[]> = {};
  for (const p of pending) {
    const h = transcriptHash(p.transcript);
    const r = rep.get(h);
    if (r === undefined) {
      rep.set(h, p.answerId);
      toAi.push(p);
    } else {
      (followers[r] ??= []).push(p.answerId);
    }
  }
  return { toAi, followers };
}

/** Note shown to the teacher on a reused suggestion. */
export const REUSE_NOTE = 'Same answer as another student\'s: this suggestion was reused, not marked again.';
