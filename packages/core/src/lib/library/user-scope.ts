/**
 * The signed-in learner's library scope, from their learning path (lib/learning-path). Kept apart from ./scope.ts so
 * the pure rules need no database.
 *
 * A path that cannot be read must not break the tutor: it gives no learner scope and the caller falls back to the
 * class code from the old board and grade, exactly what the tutor knew before the learning path existed.
 */
import { getLearningPath, learningPathEnabled } from '../learning-path/service';
import { resolveScope, type HubScope } from './scope';

export async function libraryScopeForUser(userId: string, legacy: { board?: string | null; grade?: number | null; medium?: string | null } = {}): Promise<HubScope | null> {
  let path = null;
  if (learningPathEnabled()) {
    try {
      path = await getLearningPath(userId);
    } catch (err) {
      console.warn(`[library] learning path unavailable for ${userId}; using the class code (${(err as Error).message})`);
    }
  }
  return resolveScope({ path, ...legacy });
}
