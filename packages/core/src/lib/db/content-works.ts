/**
 * Reads of the shared content spine that the chapter-upload page and its ingest route share: which books exist, which
 * chapters each has, and the one source reference a chosen book is attached through.
 *
 * Kept apart from the route so the SQL can be run against a real Postgres built from the trio migrations
 * (scripts/verify-content-works.mjs) rather than trusted by reading it.
 *
 * A "book" is `content.content_item` with kind 'book', identified by (isbn, edition). Its chapters are
 * `content.content_asset` rows with role 'enriched_md' and part_index >= 1; part 0 is the whole work.
 */

/** The only part of a pg Pool these functions need, so tests can pass a plain Pool or a fake. */
export interface Queryable {
  query<R = any>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

export interface WorkChapter {
  partIndex: number;
  label: string | null;
  sha256: string | null;
  bytes: number | null;
  pages: number | null;
  updatedAt: string;
  /**
   * The latest ingest run for this chapter's file, or null if it never had one. Statuses are pending, running, active,
   * superseded and failed. A chapter's LATEST run can be failed while an earlier one is still live (a failed re-upload
   * leaves the previous version indexed), which is why `live` is reported separately.
   */
  run: { status: string; chunks: number | null; at: string | null; error: string | null; forced: boolean } | null;
  /** The run whose passages are currently searchable for this chapter, or null if none is (never indexed, or only failed). */
  live: { chunks: number | null; at: string | null; forced: boolean } | null;
}

export interface Work {
  id: string;
  title: string;
  isbn: string | null;
  edition: string | null;
  lang: string | null;
  updatedAt: string;
  chapters: WorkChapter[];
  refs: Array<{ app: string; localId: string }>;
}

export interface BookRow {
  id: string;
  title: string;
  isbn: string | null;
  edition: string | null;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * The books, with their chapters, optionally filtered by title or ISBN. At most 200.
 * Hyphens and spaces in the search are ignored for the ISBN, so "81-7450" finds an ISBN stored as "8174505180".
 */
export async function listWorks(pool: Queryable, search = ''): Promise<Work[]> {
  const raw = search.trim().slice(0, 100);
  const likeTitle = raw ? `%${escapeLike(raw)}%` : null;
  const compact = raw.replace(/[\s-]/g, '');
  const likeIsbn = compact ? `%${escapeLike(compact)}%` : likeTitle;

  const { rows } = await pool.query(
    `SELECT i.id, i.title, i.isbn, i.edition, i.lang, i.updated_at,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'partIndex', a.part_index,
                       'label',     a.part_label,
                       'sha256',    btrim(a.asset_sha256),
                       'bytes',     a.bytes,
                       'pages',     a.page_count,
                       'updatedAt', a.created_at,
                       'run',       r.run,
                       'live',      l.live
                     ) ORDER BY a.part_index)
                FROM content.content_asset a
                LEFT JOIN LATERAL (
                  SELECT json_build_object(
                           'chunks', lr.chunk_count,
                           'at',     coalesce(lr.completed_at, lr.started_at),
                           'forced', lr.forced
                         ) AS live
                    FROM content.ingest_run lr
                   WHERE lr.content_asset_id = a.id AND lr.status = 'active'
                   ORDER BY lr.started_at DESC
                   LIMIT 1
                ) l ON true
                LEFT JOIN LATERAL (
                  SELECT json_build_object(
                           'status', ir.status,
                           'chunks', ir.chunk_count,
                           'at',     coalesce(ir.completed_at, ir.started_at),
                           'error',  ir.error,
                           'forced', ir.forced
                         ) AS run
                    FROM content.ingest_run ir
                   WHERE ir.content_asset_id = a.id
                   ORDER BY ir.started_at DESC
                   LIMIT 1
                ) r ON true
               WHERE a.content_item_id = i.id
                 AND a.role = 'enriched_md'
                 AND coalesce(a.part_index, 0) >= 1
            ), '[]'::json) AS chapters,
            COALESCE((
              SELECT json_agg(json_build_object('app', s.app, 'localId', s.local_id) ORDER BY s.created_at)
                FROM content.content_source_ref s
               WHERE s.content_item_id = i.id
            ), '[]'::json) AS refs
       FROM content.content_item i
      WHERE i.kind = 'book'
        AND ($1::text IS NULL
             OR i.title ILIKE $1
             OR regexp_replace(coalesce(i.isbn, ''), '[\\s-]', '', 'g') ILIKE $2)
      ORDER BY i.title, i.edition NULLS LAST
      LIMIT 200`,
    [likeTitle, likeIsbn],
  );

  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    isbn: r.isbn ?? null,
    edition: r.edition ?? null,
    lang: r.lang ?? null,
    updatedAt: r.updated_at,
    chapters: r.chapters ?? [],
    refs: r.refs ?? [],
  }));
}

/** One book by id, or null when there is no such book (or the id is not a book). */
export async function getBook(pool: Queryable, id: string): Promise<BookRow | null> {
  const { rows } = await pool.query<BookRow>(
    `SELECT id, title, isbn, edition FROM content.content_item WHERE id = $1 AND kind = 'book'`,
    [id],
  );
  return rows[0] ?? null;
}

/** Every book that has an ISBN, for the "does this book already exist" check. */
export async function listBooksWithIsbn(pool: Queryable): Promise<BookRow[]> {
  const { rows } = await pool.query<BookRow>(
    `SELECT id, title, isbn, edition FROM content.content_item WHERE kind = 'book' AND isbn IS NOT NULL`,
  );
  return rows;
}

/**
 * The reference a chosen book is attached through, so a chapter resolves to that exact work and can never become a
 * second copy of it. This app's own reference is preferred, otherwise the oldest one. If the work has none (it should
 * always have one), a reference of this app is created for it.
 */
export async function ensureWorkSourceRef(
  pool: Queryable,
  workId: string,
): Promise<{ app: 'pdlms' | 'vidyaverse' | 'digiclassroom'; localId: string }> {
  const { rows } = await pool.query<{ app: 'pdlms' | 'vidyaverse' | 'digiclassroom'; local_id: string }>(
    `SELECT app, local_id FROM content.content_source_ref
      WHERE content_item_id = $1
      ORDER BY (app = 'digiclassroom') DESC, created_at
      LIMIT 1`,
    [workId],
  );
  if (rows.length > 0) return { app: rows[0].app, localId: rows[0].local_id };
  const localId = `work:${workId}`;
  await pool.query(
    `INSERT INTO content.content_source_ref (content_item_id, app, local_id) VALUES ($1, 'digiclassroom', $2)
     ON CONFLICT (app, local_id) DO NOTHING`,
    [workId, localId],
  );
  return { app: 'digiclassroom', localId };
}
