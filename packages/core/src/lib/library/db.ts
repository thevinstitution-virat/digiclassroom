/**
 * Read-only access to `trio.library` for the parts a hub search cannot serve: the book's own practice questions
 * (Practest import) and, for the Virat Evaluator only, its printed answers.
 *
 * Two roles, two URLs (PDLMS backend/library-migrations/roles): `dcp_library_reader` (no `library.answer`) in
 * LIBRARY_READER_DATABASE_URL and `dcp_library_evaluator` in LIBRARY_EVALUATOR_DATABASE_URL. Both roles are
 * read-only at the role level; every query here also runs in a READ ONLY transaction.
 */
import { Pool } from 'pg';
import type { PracticeMcqSource } from './practice-mcq';

const g = globalThis as unknown as { __libraryPools?: Record<string, Pool> };

function pool(envName: 'LIBRARY_READER_DATABASE_URL' | 'LIBRARY_EVALUATOR_DATABASE_URL'): Pool {
  const url = process.env[envName];
  if (!url) throw new Error(`${envName} is not set`);
  g.__libraryPools ??= {};
  return (g.__libraryPools[envName] ??= new Pool({ connectionString: url, max: 3 }));
}

export const evaluatorConfigured = (): boolean => Boolean(process.env.LIBRARY_EVALUATOR_DATABASE_URL);

async function readOnly<T>(p: Pool, sql: string, params: unknown[]): Promise<T[]> {
  const c = await p.connect();
  try {
    await c.query('BEGIN TRANSACTION READ ONLY');
    const r = await c.query(sql, params);
    await c.query('COMMIT');
    return r.rows as T[];
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export interface WorkSummary {
  id: string;
  title: string;
  edition: string;
  medium: string;
  canonical_subject: string | null;
  /** Placement codes of the work (`SCH.CBSE.C9.SCIENCE`). */
  placements: string[];
}

export async function publishedWork(workId: string): Promise<WorkSummary | null> {
  const rows = await readOnly<WorkSummary>(
    pool('LIBRARY_READER_DATABASE_URL'),
    `SELECT w.id::text AS id, w.title, w.edition, w.medium, w.canonical_subject,
            COALESCE((SELECT array_agg(DISTINCT pl.node_code) FROM library.placement pl WHERE pl.work_id = w.id AND pl.node_code IS NOT NULL), '{}') AS placements
       FROM library.work w
      WHERE w.id = $1 AND w.status = 'published'`,
    [workId],
  );
  return rows[0] ?? null;
}

/**
 * Practice questions that print lettered options (`Choices: a-d`), of the work's chapters that have a live revision,
 * with the printed answer when the evaluator role is configured.
 */
export async function mcqSources(workId: string, chapterNo: number | null): Promise<PracticeMcqSource[]> {
  const params: unknown[] = [workId];
  let chapterClause = '';
  if (chapterNo !== null) { params.push(chapterNo); chapterClause = 'AND i.chapter_no = $2'; }
  const rows = await readOnly<Omit<PracticeMcqSource, 'answer_text'>>(
    pool('LIBRARY_READER_DATABASE_URL'),
    `SELECT i.block_id AS passage_id, i.chapter_no, i.choices, i.answer_printed,
            w.title AS work_title, w.edition,
            p.page_start, p.text
       FROM library.practice_item i
       JOIN library.work w ON w.id = i.work_id AND w.status = 'published'
       JOIN library.chapter c ON c.work_id = i.work_id AND c.number = i.chapter_no AND c.live_revision_id IS NOT NULL
       CROSS JOIN LATERAL (
         SELECT min(page_start) AS page_start, string_agg(text, E'\n' ORDER BY chunk_order) AS text
           FROM library.passage
          WHERE work_id = i.work_id AND (passage_id = i.block_id OR starts_with(passage_id, i.block_id || '#'))
       ) p
      WHERE i.work_id = $1 AND i.choices IS NOT NULL AND p.text IS NOT NULL ${chapterClause}
      ORDER BY i.chapter_no, i.block_id`,
    params,
  );
  const answers = new Map<string, string>();
  if (evaluatorConfigured() && rows.length) {
    const ids = rows.filter((r) => r.answer_printed).map((r) => r.passage_id);
    if (ids.length) {
      const found = await readOnly<{ question_id: string; text: string }>(
        pool('LIBRARY_EVALUATOR_DATABASE_URL'),
        `SELECT question_id, text FROM library.answer WHERE work_id = $1 AND question_id = ANY($2::text[]) AND part IS NULL`,
        [workId, ids],
      );
      for (const a of found) answers.set(a.question_id, a.text);
    }
  }
  return rows.map((r) => ({ ...r, answer_text: answers.get(r.passage_id) ?? null }));
}
