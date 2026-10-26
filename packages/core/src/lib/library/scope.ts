/**
 * Which library scope a DigiClassroom reader searches in: the learner's goals and medium (the learning path, Phase 6),
 * or, for a caller that only has the old board and class, the class node's code. The hub resolves either through the
 * placements of its books; DigiClassroom never maps a goal to a book itself.
 */
import type { HubSearchRequest } from './hub-client';

export type HubScope = Pick<HubSearchRequest, 'nodeIds' | 'nodeCodes' | 'medium'>;

/** Old `board_type` values -> the school board segment of curriculum v2 codes (`SCH.<board>.C<grade>`). */
const BOARD_SEGMENT: Record<string, string> = { CBSE: 'CBSE', ICSE: 'CISCE', CISCE: 'CISCE' };

/** `SCH.CBSE.C9` for CBSE Class 9, or null when the board has no curriculum node (State Board: ask the learner's path). */
export function classNodeCode(board: string | null | undefined, grade: number | null | undefined): string | null {
  const segment = board ? BOARD_SEGMENT[board.trim().toUpperCase()] : undefined;
  if (!segment || !grade || !Number.isInteger(grade) || grade < 1 || grade > 12) return null;
  return `SCH.${segment}.C${grade}`;
}

export const mediumCode = (m: string | null | undefined): 'en' | 'hi' | undefined => {
  const s = m?.trim().toLowerCase();
  if (s === 'hi' || s === 'hindi') return 'hi';
  if (s === 'en' || s === 'english') return 'en';
  return undefined;
};

/** A learner's goals (a learning path) as a scope; null when they have none. */
export function scopeFromPath(path: { goals: { nodeId: string }[]; medium: string | null }): HubScope | null {
  if (!path.goals.length) return null;
  return { nodeIds: path.goals.map((g) => g.nodeId), medium: mediumCode(path.medium) };
}

/** Learner scope first, then the legacy class code; null when neither says anything. */
export function resolveScope(args: {
  path?: { goals: { nodeId: string }[]; medium: string | null } | null;
  board?: string | null;
  grade?: number | null;
  medium?: string | null;
}): HubScope | null {
  const fromPath = args.path ? scopeFromPath(args.path) : null;
  if (fromPath) return { ...fromPath, medium: fromPath.medium ?? mediumCode(args.medium) };
  const code = classNodeCode(args.board, args.grade);
  return code ? { nodeCodes: [code], medium: mediumCode(args.medium) } : null;
}

/** A stable string for a scope, for cache keys: two learners with different goals or mediums never share an entry. */
export const scopeToken = (s: HubScope | null | undefined): string =>
  s ? JSON.stringify([[...(s.nodeIds ?? [])].sort(), [...(s.nodeCodes ?? [])].sort(), s.medium ?? '']) : 'noscope';

/**
 * The scope a tutor search runs in: the one the caller resolved from the learner's path, else the class code of the
 * old board and grade. Cache keys use `scopeToken` of it while the hub is on.
 */
export const scopeOfContext = (c: { hubScope?: HubScope | null; board_type?: string | null; grade_level?: number | null }): HubScope | null =>
  c.hubScope ?? resolveScope({ board: c.board_type, grade: c.grade_level });
