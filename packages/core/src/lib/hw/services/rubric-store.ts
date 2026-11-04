// Replacing a question's whole marking scheme: old items are retired, never edited, and the question's rubric_version goes up, so AI suggestions always
// point at the wording they judged. Shared by the teacher's rubric (services/assignments.ts) and by an answer key applied as the rubric (keys/product.ts).

import { and, eq, isNull, sql } from 'drizzle-orm';
import { hwQuestion, hwRubricItem, type HwRubricKind } from '@/db/hw-schema';
import { newId, type Exec } from '../db';

export interface RubricRow { kind: HwRubricKind; description: string; marks: number }

export async function replaceRubric(tx: Exec, orgId: string, questionId: string, items: readonly RubricRow[], source: 'teacher' | 'ai_draft' | 'key'): Promise<number> {
  const [{ version }] = await tx.update(hwQuestion).set({ rubricVersion: sql`${hwQuestion.rubricVersion} + 1` })
    .where(eq(hwQuestion.id, questionId)).returning({ version: hwQuestion.rubricVersion });
  await tx.update(hwRubricItem).set({ retiredAt: new Date() }).where(and(eq(hwRubricItem.questionId, questionId), isNull(hwRubricItem.retiredAt)));
  if (items.length) {
    await tx.insert(hwRubricItem).values(items.map((it, i) => ({
      id: newId(),
      organizationId: orgId,
      questionId,
      position: i,
      kind: it.kind,
      description: it.description.trim(),
      marks: String(it.marks),
      version,
      source,
    })));
  }
  return version;
}
