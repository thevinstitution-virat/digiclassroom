/**
 * Browser client for the learning path and the learners' read-only curriculum routes (apps/api: /api/user/learning-path,
 * /api/curriculum/*). The same functions and bodies as Book Buddy's and PDLMS's clients, so the ported picker,
 * selector and editor (apps/web components/curriculum) are the same code. No server imports here.
 */
export interface TaxonomyNode {
  id: string;
  code: string;
  name: string;
  nameHi: string | null;
  nodeType: string;
  depth: number;
  hasChildren: boolean;
  verification: 'sourced' | 'verify' | 'template';
  completeness: string;
  canonicalSubject: string | null;
  /** "School Education > CBSE > Class 10" */
  path: string;
  gradeFrom: number | null;
  gradeTo: number | null;
  localName: string | null;
}

export interface LearningGoal {
  nodeId: string;
  isPrimary: boolean;
  code: string;
  name: string;
  nodeType: string;
  path: string;
  verification: 'sourced' | 'verify' | 'template';
  gradeLevel: number | null;
  combination: { code: string; name: string } | null;
  /** `institution`: the class a learner's Vidyaverse institution assigned; shown, not editable here. */
  source: 'self' | 'institution';
}

export interface LearningPath {
  prompt: boolean;
  skipped: boolean;
  medium: string | null;
  goals: LearningGoal[];
  legacy: { board: string | null; gradeLevel: number | null; stream: string | null; medium: string | null };
}

export interface GoalInput {
  nodeId: string;
  isPrimary?: boolean;
  combinationCode?: string | null;
}

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

export const MAX_GOALS = 4;
/** The study mediums offered (ISO 639-1), as the books' `medium`. */
export const MEDIUMS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
] as const;
/** Levels a learner steps through to say what they study. */
export const STRUCTURAL_TYPES: readonly string[] = ['SUBDOMAIN', 'PROGRAM', 'SPECIALISATION', 'CLASS', 'EXAM', 'LEVEL', 'PERIOD'];
/** What counts as a learning goal: a place one studies for (a class, a programme, an exam), never a subject. */
export const GOAL_TYPES: readonly string[] = ['CLASS', 'PROGRAM', 'SPECIALISATION', 'PERIOD', 'LEVEL', 'EXAM'];

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      credentials: 'include',
      cache: 'no-store',
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? body?.error;
      return { success: false, error: message || `Request failed (${res.status})` };
    }
    return { success: true, data: body as T };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Network error' };
  }
}

const CURRICULUM = '/api/curriculum';
const PATH = '/api/user/learning-path';

export const getTaxonomyChildren = (parentId?: string | null) =>
  call<TaxonomyNode[]>(`${CURRICULUM}/nodes${parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''}`);
export const getTaxonomyNode = (id: string) =>
  call<{ node: TaxonomyNode; ancestors: TaxonomyNode[] }>(`${CURRICULUM}/nodes/${encodeURIComponent(id)}`);
export const getClassStreams = (classNodeId: string) =>
  call<Array<{ code: string; name: string }>>(`${CURRICULUM}/nodes/${encodeURIComponent(classNodeId)}/combinations`);
export const searchTaxonomy = (query: string, opts: { types?: string[]; limit?: number } = {}) => {
  const q = new URLSearchParams({ q: query });
  if (opts.types?.length) q.set('types', opts.types.join(','));
  if (opts.limit) q.set('limit', String(opts.limit));
  return call<TaxonomyNode[]>(`${CURRICULUM}/search?${q.toString()}`);
};

export const getLearningPath = () => call<LearningPath>(PATH);
/** Replace the goals, or `{ skip: true }` for "just exploring". `medium` absent leaves the saved one as it is. */
export const setLearningPath = (input: { goals?: GoalInput[]; skip?: boolean; medium?: string }) =>
  call<LearningPath>(PATH, { method: 'PUT', body: JSON.stringify(input) });

/** Whether this server asks "What are you studying?" (curriculum v2 on) or board, class and stream (off). */
export async function getLearningPathStatus(): Promise<boolean> {
  const res = await call<{ enabled: boolean }>(`${PATH}/status`);
  return res.success && res.data.enabled;
}
