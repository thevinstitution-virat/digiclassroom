import { getContentPool } from './content-connection';

export type SourceApp = 'pdlms' | 'vidyaverse' | 'digiclassroom';

export interface ResolvedContentItem {
  contentItemId: string;
  /**
   * True when this file's hash already existed under another content_item — the
   * caller MUST skip embedding entirely rather than re-embedding and deduping
   * rows afterwards. Deduping after the embedding call is not deduping; it's
   * paying twice and discarding one copy.
   */
  deduped: boolean;
}

/**
 * Resolve the canonical content_item for a given app's local content id.
 *
 * Three resolution paths, in order:
 *   1. (app, local_id) already registered  → same item, not a dedupe
 *   2. canonical_sha256 already registered → EXISTING item, link this app's
 *      local id to it, and report deduped=true so the caller skips the run
 *   3. otherwise                           → create item + source_ref
 */
export async function resolveOrCreateContentItem(params: {
  sourceApp: SourceApp;
  sourceLocalId: string;
  title: string;
  kind?: string;
  lang?: string | null;
  canonicalSha256?: string | null;
}): Promise<ResolvedContentItem> {
  const pool = getContentPool();
  const {
    sourceApp,
    sourceLocalId,
    title,
    kind = 'book',
    lang = null,
    canonicalSha256 = null,
  } = params;

  const existing = await pool.query<{ content_item_id: string }>(
    `SELECT content_item_id FROM content.content_source_ref WHERE app = $1 AND local_id = $2`,
    [sourceApp, sourceLocalId],
  );
  if (existing.rows.length > 0) {
    return { contentItemId: existing.rows[0].content_item_id, deduped: false };
  }

  if (canonicalSha256) {
    const byHash = await pool.query<{ id: string }>(
      `SELECT id FROM content.content_item WHERE canonical_sha256 = $1`,
      [canonicalSha256],
    );
    if (byHash.rows.length > 0) {
      const contentItemId = byHash.rows[0].id;
      // Same bytes, different app-local id: link the new local id to the
      // existing canonical item. ON CONFLICT covers a concurrent identical
      // upload racing us to the same insert.
      await pool.query(
        `INSERT INTO content.content_source_ref (content_item_id, app, local_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (app, local_id) DO NOTHING`,
        [contentItemId, sourceApp, sourceLocalId],
      );
      return { contentItemId, deduped: true };
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemRes = await client.query<{ id: string }>(
      `INSERT INTO content.content_item (title, kind, lang, canonical_sha256)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [title, kind, lang, canonicalSha256],
    );
    const contentItemId = itemRes.rows[0].id;
    await client.query(
      `INSERT INTO content.content_source_ref (content_item_id, app, local_id) VALUES ($1, $2, $3)`,
      [contentItemId, sourceApp, sourceLocalId],
    );
    await client.query('COMMIT');
    return { contentItemId, deduped: false };
  } catch (err: any) {
    await client.query('ROLLBACK');
    // Lost a race on content_item_sha_uq: another ingestion inserted the same
    // bytes between our SELECT and our INSERT. Re-resolve by hash and treat it
    // as the dedupe it is, rather than surfacing a constraint violation.
    if (err?.code === '23505' && canonicalSha256) {
      const retry = await pool.query<{ id: string }>(
        `SELECT id FROM content.content_item WHERE canonical_sha256 = $1`,
        [canonicalSha256],
      );
      if (retry.rows.length > 0) {
        const contentItemId = retry.rows[0].id;
        await pool.query(
          `INSERT INTO content.content_source_ref (content_item_id, app, local_id)
           VALUES ($1, $2, $3) ON CONFLICT (app, local_id) DO NOTHING`,
          [contentItemId, sourceApp, sourceLocalId],
        );
        return { contentItemId, deduped: true };
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Record the uploaded original. `storageUri` is `r2://{bucket}/{key}`; the bucket
 * alone can't say which credentials to authenticate with, hence storage_account.
 */
export async function recordSourceAsset(params: {
  contentItemId: string;
  storageAccount: string;
  storageUri: string;
  sha256: string;
  bytes: number;
  pageCount?: number | null;
}): Promise<string> {
  const pool = getContentPool();
  // `asset_sha256`, not `sha256` — trio migration 005 renamed it to keep the
  // per-FILE hash visibly distinct from content_item.canonical_sha256, the
  // per-WORK hash. This insert is the only writer of the column.
  const res = await pool.query<{ id: string }>(
    `INSERT INTO content.content_asset
       (content_item_id, role, storage_account, storage_uri, asset_sha256, bytes, page_count)
     VALUES ($1, 'source', $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      params.contentItemId,
      params.storageAccount,
      params.storageUri,
      params.sha256,
      params.bytes,
      params.pageCount ?? null,
    ],
  );
  return res.rows[0].id;
}

/**
 * The id of this item's `source` rendition, or null if it has none.
 *
 * Every content_item must own the original file it was built from, whatever lane
 * produced its chunks. A chapter ingested from enriched markdown lands perfect
 * chunks with exact printed pages — iTutor answers flawlessly and cites
 * correctly — while the reader has nothing to open. Nothing errors, because
 * chunks and assets are independent tables; the shelf is simply empty. This is
 * the lookup that makes that state detectable.
 */
export async function findSourceAssetId(contentItemId: string): Promise<string | null> {
  const pool = getContentPool();
  const res = await pool.query<{ id: string }>(
    `SELECT id FROM content.content_asset
      WHERE content_item_id = $1 AND role = 'source'
      ORDER BY created_at
      LIMIT 1`,
    [contentItemId],
  );
  return res.rows.length > 0 ? res.rows[0].id : null;
}

export interface ResolvedScope {
  visibility: 'public' | 'restricted';
  grantOrgIds: string[];
}

/**
 * Resolve an app-local organization id to a canonical identity.org id and create
 * the matching content_grant.
 *
 * A null localOrgId means platform-level ingestion (the NCERT base corpus) and is
 * genuinely public. A NON-null one that cannot be resolved THROWS — it does not
 * fall back.
 *
 * The fallbacks are both worse than failing:
 *   - defaulting to public publishes an org's private book to every tenant, and
 *     nothing in the system would ever say so;
 *   - defaulting to a grant nobody holds makes the content invisible, which
 *     reads as a bug and wastes a day before anyone suspects scope.
 * A failed upload that a human fixes in a minute beats either one.
 */
export async function resolveScopeAndGrant(params: {
  contentItemId: string;
  sourceApp: SourceApp;
  localOrgId: string | null;
}): Promise<ResolvedScope> {
  const pool = getContentPool();
  const { contentItemId, sourceApp, localOrgId } = params;

  let orgId: string | null = null;
  if (localOrgId) {
    const res = await pool.query<{ org_id: string }>(
      `SELECT org_id FROM identity.org_app_ref WHERE app = $1 AND local_id = $2`,
      [sourceApp, localOrgId],
    );
    if (res.rows.length === 0) {
      throw new Error(
        `Cannot resolve organization "${localOrgId}" (app=${sourceApp}) to a canonical identity.org. ` +
          `Ingestion aborted rather than defaulting to public — an unresolved org would publish ` +
          `this content to every tenant. Add the identity.org_app_ref row and retry.`,
      );
    }
    orgId = res.rows[0].org_id;
  }

  const visibility: 'public' | 'restricted' = orgId ? 'restricted' : 'public';
  const grantOrgIds = orgId ? [orgId] : [];

  const existing = await pool.query(
    `SELECT id FROM content.content_grant WHERE content_item_id = $1 LIMIT 1`,
    [contentItemId],
  );
  if (existing.rows.length === 0) {
    if (orgId) {
      await pool.query(
        `INSERT INTO content.content_grant (content_item_id, org_id, visibility)
         VALUES ($1, $2, 'org')`,
        [contentItemId, orgId],
      );
    } else {
      await pool.query(
        `INSERT INTO content.content_grant (content_item_id, visibility) VALUES ($1, 'public')`,
        [contentItemId],
      );
    }
  }

  return { visibility, grantOrgIds };
}

/**
 * Replace this item's canonical taxonomy links. Exactly one row carries
 * is_primary — the first node id given, by convention with DCP's dashboard which
 * lists the primary tag first.
 */
export async function replaceTaxonomyLinks(
  contentItemId: string,
  nodeIds: string[],
): Promise<number> {
  const pool = getContentPool();
  if (nodeIds.length === 0) return 0;

  const unique = Array.from(new Set(nodeIds));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM taxonomy.content_taxonomy_link WHERE content_item_id = $1`,
      [contentItemId],
    );
    const values: unknown[] = [];
    const rows = unique.map((nodeId, i) => {
      const base = i * 3;
      values.push(contentItemId, nodeId, i === 0);
      return `($${base + 1}, $${base + 2}, $${base + 3})`;
    });
    await client.query(
      `INSERT INTO taxonomy.content_taxonomy_link (content_item_id, node_id, is_primary)
       VALUES ${rows.join(', ')}`,
      values,
    );
    await client.query('COMMIT');
    return unique.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Insert content_chunk rows and return their generated UUIDs in the same order —
 * those UUIDs become the Qdrant point ids, so a chunk's Postgres row and its
 * vector always share one identity. Step 3 retrieves ids from Qdrant and fetches
 * text from Postgres by that id; if these ever diverge, every retrieval returns
 * ids that resolve to nothing.
 */
export async function insertContentChunks(
  contentItemId: string,
  chunks: Array<{
    chunkIndex: number;
    text: string;
    pageStart?: number | null;
    pageEnd?: number | null;
    chapter?: string | null;
  }>,
): Promise<string[]> {
  if (chunks.length === 0) return [];
  const pool = getContentPool();

  const values: unknown[] = [];
  const rows = chunks.map((c, i) => {
    const base = i * 6;
    values.push(contentItemId, c.chunkIndex, c.pageStart ?? null, c.pageEnd ?? null, c.text, c.chapter ?? null);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });

  const res = await pool.query<{ id: string }>(
    `INSERT INTO content.content_chunk (content_item_id, chunk_index, page_start, page_end, text, chapter)
     VALUES ${rows.join(', ')}
     ON CONFLICT (content_item_id, chunk_index) DO UPDATE SET
       page_start = excluded.page_start,
       page_end = excluded.page_end,
       text = excluded.text,
       chapter = excluded.chapter
     RETURNING id, chunk_index`,
    values,
  );

  // Preserve input order — ON CONFLICT ... RETURNING doesn't guarantee row order matches input.
  const byIndex = new Map(res.rows.map((r: any) => [r.chunk_index, r.id]));
  return chunks.map((c) => byIndex.get(c.chunkIndex) as string);
}

/**
 * Drop chunk rows left over from a previous, longer run. Without this a
 * re-ingest that produces fewer chunks leaves the tail behind, and the
 * "points_count equals chunk count" invariant quietly stops holding.
 */
export async function pruneChunksBeyond(
  contentItemId: string,
  chunkCount: number,
): Promise<number> {
  const pool = getContentPool();
  const res = await pool.query(
    `DELETE FROM content.content_chunk WHERE content_item_id = $1 AND chunk_index >= $2`,
    [contentItemId, chunkCount],
  );
  return res.rowCount ?? 0;
}

export async function startIngestRun(params: {
  contentItemId: string;
  /**
   * The asset whose bytes this run embedded. A run belongs to a FILE, not to a
   * work — fifteen chapter files under one book are fifteen runs, each with its
   * own active slot (see trio migration 004).
   */
  contentAssetId: string | null;
  sourceApp: SourceApp;
  embeddingModel: string;
  embeddingDim: number;
  collection: string;
}): Promise<string> {
  const pool = getContentPool();
  const res = await pool.query<{ id: string }>(
    `INSERT INTO content.ingest_run
       (content_item_id, content_asset_id, source_app, embedding_model, embedding_dim, status, collection)
     VALUES ($1, $2, $3, $4, $5, 'running', $6) RETURNING id`,
    [
      params.contentItemId,
      params.contentAssetId,
      params.sourceApp,
      params.embeddingModel,
      params.embeddingDim,
      params.collection,
    ],
  );
  return res.rows[0].id;
}

/**
 * Whether this item already has a published (active) run — i.e. whether
 * something is currently live for it. Used to tell an operator, when an ingest
 * fails, if the previous version is still serving or if the book is now absent
 * entirely. Those two situations call for very different urgency.
 */
export async function hasActiveIngestRun(contentItemId: string): Promise<boolean> {
  const pool = getContentPool();
  const res = await pool.query(
    `SELECT 1 FROM content.ingest_run WHERE content_item_id = $1 AND status = 'active' LIMIT 1`,
    [contentItemId],
  );
  return res.rows.length > 0;
}

/**
 * Step 1 of 3 in the supersede sequence: mark the previous active run superseded
 * and hand its id back so the caller can delete its points.
 *
 * The three steps are ordered supersede → delete points → activate, deliberately.
 * If the process dies between steps, the collection still holds the OLD run's
 * points and the new run is not yet active — stale but retrievable. Flipping the
 * new run active first would leave a window where an active run claims live
 * points that have just been deleted.
 */
export async function supersedePriorActiveRun(
  contentItemId: string,
  contentAssetId: string | null,
  newRunId: string,
): Promise<string | null> {
  const pool = getContentPool();
  // Scoped to the ASSET, not just the item. Since trio migration 004 an item may
  // hold several concurrently-active runs — one per file — so superseding "any
  // active run for this item" would retire a sibling chapter's run and delete
  // its points, which is precisely the collision 004 exists to prevent. The
  // NULL-safe comparison keeps assetless legacy runs matching each other.
  const res = await pool.query<{ id: string }>(
    `UPDATE content.ingest_run SET status = 'superseded', completed_at = now()
      WHERE content_item_id = $1
        AND content_asset_id IS NOT DISTINCT FROM $2
        AND status = 'active'
        AND id <> $3
      RETURNING id`,
    [contentItemId, contentAssetId, newRunId],
  );
  return res.rows.length > 0 ? res.rows[0].id : null;
}

/** Step 3 of 3: the new run becomes the single active one. */
export async function activateIngestRun(runId: string, chunkCount: number): Promise<void> {
  const pool = getContentPool();
  await pool.query(
    `UPDATE content.ingest_run
        SET status = 'active', chunk_count = $2, completed_at = now()
      WHERE id = $1`,
    [runId, chunkCount],
  );
}

export async function failIngestRun(runId: string, error: string): Promise<void> {
  const pool = getContentPool();
  await pool.query(
    `UPDATE content.ingest_run
        SET status = 'failed', error = $2, completed_at = now()
      WHERE id = $1`,
    [runId, error.slice(0, 2000)],
  );
}
