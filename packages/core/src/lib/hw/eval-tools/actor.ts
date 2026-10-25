// Resolves the caller of an evaluator endpoint from the session: super admin or not, and
// their active rater row if any. Access rules are in access.ts.

import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { hwEvalRater } from '@/db/hw-eval-schema';
import { HwError } from '../errors';
import type { EvalActor } from './access';

export async function resolveEvalActor(headers: Headers): Promise<EvalActor> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new HwError('UNAUTHORIZED', 'Please sign in.');
  const userId = session.user.id;
  const isSuperAdmin = (session.user as { role?: string | null }).role === 'super_admin';
  const [row] = await db.select({ id: hwEvalRater.id, pseudonym: hwEvalRater.pseudonym, skills: hwEvalRater.skills, active: hwEvalRater.active })
    .from(hwEvalRater).where(eq(hwEvalRater.userId, userId)).limit(1);
  return { userId, isSuperAdmin, rater: row?.active ? { id: row.id, pseudonym: row.pseudonym, skills: row.skills } : null };
}
