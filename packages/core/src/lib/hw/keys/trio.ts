// Read-only access to Gyankosh's content tables in the shared `trio` database.
//
// The pool's role (content_app) OWNS the content schema, so read-only is enforced here:
// every query runs inside a READ ONLY transaction, which Postgres refuses to write from.
// Nothing in the key service writes to `trio`.

import type { Pool } from 'pg';
import { getContentPool } from '@/lib/db/content-connection';
import type { PracticeRow } from './exercise-match';

export interface ChunkRow {
  id: string;
  contentItemId: string;
  chapter: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  text: string;
  title: string;
  isbn: string | null;
  edition: string | null;
  lang: string | null;
}

export interface TrioReader {
  practiceRows(contentItemIds: readonly string[]): Promise<PracticeRow[]>;
  chunks(ids: readonly string[]): Promise<ChunkRow[]>;
}

async function readOnly<T>(pool: Pool, sql: string, params: unknown[]): Promise<T[]> {
  const c = await pool.connect();
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

export function trioReader(pool: Pool = getContentPool()): TrioReader {
  return {
    async practiceRows(contentItemIds) {
      if (!contentItemIds.length) return [];
      return readOnly<PracticeRow>(pool,
        `SELECT id::text AS "id", content_item_id::text AS "contentItemId", chapter, text
           FROM content.content_chunk
          WHERE retrieval_class = 'practice' AND content_item_id = ANY($1::uuid[])
          ORDER BY content_item_id, chunk_index`,
        [contentItemIds]);
    },
    async chunks(ids) {
      if (!ids.length) return [];
      return readOnly<ChunkRow>(pool,
        `SELECT c.id::text AS "id", c.content_item_id::text AS "contentItemId", c.chapter,
                c.page_start AS "pageStart", c.page_end AS "pageEnd", c.text,
                i.title, i.isbn, i.edition, i.lang
           FROM content.content_chunk c
           JOIN content.content_item i ON i.id = c.content_item_id
          WHERE c.id = ANY($1::uuid[]) AND c.retrieval_class = 'reference'`,
        [ids]);
    },
  };
}
