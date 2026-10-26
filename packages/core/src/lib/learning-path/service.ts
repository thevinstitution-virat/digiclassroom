/**
 * What a learner is studying (curriculum v2 goals) and their medium, in the shape every app shares
 * (docs/learning-path.md). For a learner signed in with Vidyaverse, Vidyaverse holds the path (its institutions can
 * assign a class) and DigiClassroom keeps a copy; for every other account DigiClassroom's copy is the only one.
 * Saving a path also writes the legacy profile fields older code reads (./legacy.ts) and completes onboarding.
 *
 * Needs curriculum v2 (TAXONOMY_V2_ENABLED and the Vidyaverse curriculum service). While it is off, onboarding asks
 * board, class and stream as before and none of this is called.
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { account, enhancedUserProfiles, userLearningGoal } from '@/db/schema';
import {
  CurriculumServiceError,
  getCurriculumCombinations,
  getCurriculumNode,
  isCurriculumV2Enabled,
} from '@/lib/taxonomy/curriculum';
import { dcpProfileFields } from './legacy';
import {
  GOAL_NODE_TYPES,
  type Goal,
  type LearningPath,
  LearningPathInputError,
  deriveLegacy,
  gradeOf,
  normalizeInput,
} from './rules';

/** An error with the HTTP status the route answers with. */
export class LearningPathError extends Error {
  constructor(message: string, readonly status: 400 | 503) {
    super(message);
    this.name = 'LearningPathError';
  }
}

const TIMEOUT_MS = 5000;

export const learningPathEnabled = (): boolean => isCurriculumV2Enabled();

// ── Vidyaverse's copy (federated learners) ─────────────────────────────────────

class RemoteUnavailable extends Error {}

/**
 * GET/PUT Vidyaverse's /api/v1/academic/my-learning-path with the learner's OIDC access token. `null`: not
 * Vidyaverse's to answer (no Vidyaverse account, no issuer, or a Vidyaverse without the endpoint).
 */
async function remote(userId: string, method: 'GET' | 'PUT', body?: unknown): Promise<LearningPath | null> {
  const issuer = process.env.VIDYAVERSE_ISSUER;
  if (!issuer) return null;
  const row = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, 'vidyaverse')),
    columns: { accessToken: true },
  });
  if (!row?.accessToken) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${issuer.replace(/\/$/, '')}/api/v1/academic/my-learning-path`, {
      method,
      headers: { authorization: `Bearer ${row.accessToken}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new RemoteUnavailable(`Vidyaverse did not answer: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  const payload = (await res.json().catch(() => null)) as { success?: boolean; data?: LearningPath; error?: string; message?: string } | null;
  if (res.status === 404) return null;
  if (res.status === 400) throw new LearningPathError(payload?.error || payload?.message || 'Vidyaverse refused the learning path', 400);
  if (!res.ok || !payload?.success || !payload.data) throw new RemoteUnavailable(`Vidyaverse answered ${res.status}`);
  return payload.data;
}

// ── DigiClassroom's copy ─────────────────────────────────────────────────────

async function store(userId: string, path: Pick<LearningPath, 'goals' | 'medium'>, skipped: boolean): Promise<void> {
  const legacy = dcpProfileFields(deriveLegacy(path.goals, path.medium));
  // Board, class, stream and medium decide what a subscription plan opens, and are locked once onboarding is done
  // (the profile page says so). So the path fills them at onboarding only: a later change (here, or in PDLMS for a
  // Vidyaverse learner) updates the goals and leaves the plan's fields alone.
  const existing = await db.query.enhancedUserProfiles.findFirst({
    where: eq(enhancedUserProfiles.userId, userId),
    columns: { isOnboardingComplete: true },
  });
  const locked = Boolean(existing?.isOnboardingComplete);
  // Only what the path knows: a non-school goal leaves the board and grade as they were.
  const profile = {
    ...(!locked && legacy.boardType ? { boardType: legacy.boardType } : {}),
    ...(!locked && legacy.gradeLevel !== null ? { gradeLevel: legacy.gradeLevel } : {}),
    ...(!locked && legacy.stream ? { stream: legacy.stream, specializationSubjects: legacy.specializationSubjects } : {}),
    ...(!locked && legacy.medium ? { medium: legacy.medium, languagePreference: legacy.languagePreference as string } : {}),
    learningPathSkippedAt: path.goals.length ? null : skipped ? new Date() : null,
    isOnboardingComplete: true,
  };
  await db.transaction(async (tx) => {
    await tx.delete(userLearningGoal).where(eq(userLearningGoal.userId, userId));
    if (path.goals.length)
      await tx.insert(userLearningGoal).values(
        path.goals.map((g) => ({
          userId, nodeId: g.nodeId, isPrimary: g.isPrimary, nodeCode: g.code, nodeName: g.name, nodeType: g.nodeType,
          nodePath: g.path, verification: g.verification, gradeLevel: g.gradeLevel, combinationCode: g.combination?.code ?? null,
          combinationName: g.combination?.name ?? null, source: g.source,
        })),
      );
    await tx
      .insert(enhancedUserProfiles)
      .values({ userId, role: 'student', ...profile })
      .onConflictDoUpdate({ target: enhancedUserProfiles.userId, set: profile });
  });
}

async function local(userId: string): Promise<LearningPath> {
  const [rows, profile] = await Promise.all([
    db.select().from(userLearningGoal).where(eq(userLearningGoal.userId, userId)).orderBy(desc(userLearningGoal.isPrimary), asc(userLearningGoal.createdAt)),
    db.query.enhancedUserProfiles.findFirst({
      where: eq(enhancedUserProfiles.userId, userId),
      columns: { languagePreference: true, learningPathSkippedAt: true },
    }),
  ]);
  const goals: Goal[] = rows.map((r) => ({
    nodeId: r.nodeId, isPrimary: r.isPrimary, code: r.nodeCode, name: r.nodeName, nodeType: r.nodeType, path: r.nodePath,
    verification: r.verification, gradeLevel: r.gradeLevel,
    combination: r.combinationCode ? { code: r.combinationCode, name: r.combinationName ?? r.combinationCode } : null,
    source: r.source === 'institution' ? 'institution' : 'self',
  }));
  const lang = profile?.languagePreference?.toLowerCase();
  // Only an explicit choice counts: the column defaults to 'english' for every profile.
  const medium = goals.length || profile?.learningPathSkippedAt ? (lang === 'hindi' ? 'hi' : lang === 'english' ? 'en' : null) : null;
  const skipped = Boolean(profile?.learningPathSkippedAt);
  return { prompt: goals.length === 0 && !skipped, skipped, medium, goals, legacy: deriveLegacy(goals, medium) };
}

// ── The API ──────────────────────────────────────────────────────────────────

function requireEnabled() {
  if (!learningPathEnabled()) throw new LearningPathError('Learning paths need curriculum v2, which is off on this server', 503);
}

export async function getLearningPath(userId: string): Promise<LearningPath> {
  requireEnabled();
  try {
    const r = await remote(userId, 'GET');
    if (r) {
      await store(userId, r, r.skipped);
      return r;
    }
  } catch (err) {
    // Reading: the last copy is better than nothing while Vidyaverse is away.
    if (!(err instanceof RemoteUnavailable)) throw err;
    console.warn(`[learning-path] ${err.message}; answering from DigiClassroom's copy for ${userId}`);
  }
  return local(userId);
}

export async function setLearningPath(userId: string, body: unknown): Promise<LearningPath> {
  requireEnabled();
  let input: ReturnType<typeof normalizeInput>;
  try {
    input = normalizeInput(body);
  } catch (err) {
    if (err instanceof LearningPathInputError) throw new LearningPathError(err.message, 400);
    throw err;
  }

  try {
    const r = await remote(userId, 'PUT', body);
    if (r) {
      await store(userId, r, r.skipped);
      return r;
    }
  } catch (err) {
    // Writing: Vidyaverse holds this learner's path, so a change saved only here would be overwritten later.
    if (err instanceof RemoteUnavailable) throw new LearningPathError('Your profile could not be saved just now. Please try again.', 503);
    throw err;
  }

  const goals: Goal[] = [];
  for (const g of input.goals) {
    let node;
    try {
      node = (await getCurriculumNode(g.nodeId)).node;
    } catch (err) {
      if (err instanceof CurriculumServiceError && err.status === 404) throw new LearningPathError(`No curriculum node ${g.nodeId}`, 400);
      throw new LearningPathError(`The curriculum service did not answer: ${(err as Error).message}`, 503);
    }
    if (!(GOAL_NODE_TYPES as readonly string[]).includes(node.nodeType))
      throw new LearningPathError(`${node.name} is a ${node.nodeType.toLowerCase()}: choose a class, programme or exam`, 400);
    let combination: Goal['combination'] = null;
    if (g.combinationCode) {
      const offered = await getCurriculumCombinations(g.nodeId).catch((err: Error) => {
        throw new LearningPathError(`The curriculum service did not answer: ${err.message}`, 503);
      });
      const c = offered.find((x) => x.code === g.combinationCode);
      if (!c) throw new LearningPathError('That stream is not offered for the class you chose', 400);
      combination = c;
    }
    goals.push({
      nodeId: node.id, isPrimary: node.id === input.primaryId, code: node.code, name: node.name, nodeType: node.nodeType,
      path: node.path, verification: node.verification, gradeLevel: gradeOf(node), combination, source: 'self',
    });
  }
  const medium = input.medium === undefined ? (await local(userId)).medium : input.medium;
  await store(userId, { goals, medium }, !goals.length && input.skip);
  return local(userId);
}

/** True when the learner has said what they study (or chose "just exploring"): onboarding is done for v2. */
export async function hasLearningPath(userId: string): Promise<boolean> {
  const p = await local(userId);
  return p.goals.length > 0 || p.skipped;
}
