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
  /** Which resolution path matched. Reported so a surprise is visible in logs. */
  matchedBy: 'source_ref' | 'work_key' | 'content_hash' | 'created';
}

/**
 * Resolve the canonical content_item for a given app's local content id.
 *
 * Four resolution paths, in order:
 *   1. (app, local_id) already registered  → same item, not a dedupe
 *   2. work key (isbn, edition) matches    → the SAME WORK, being extended by
 *      another part. Link this app's local id to it; NOT a dedupe — chapter 7 of
 *      a book already holding chapters 1-6 must still be ingested.
 *   3. canonical_sha256 already registered → identical BYTES already ingested;
 *      link the local id and report deduped=true so the caller skips the run
 *   4. otherwise                           → create item + source_ref
 *
 * Why the work key outranks the content hash: a hash says "these exact bytes
 * were seen before", which is a statement about a FILE. An ISBN is a human
 * assertion about a WORK, and a work made of fifteen chapter files has fifteen
 * different hashes and one identity. Ordering them the other way would give a
 * multi-part book a second content_item the first time a part arrived whose
 * bytes happened to match something else.
 */
export async function resolveOrCreateContentItem(params: {
  sourceApp: SourceApp;
  sourceLocalId: string;
  title: string;
  kind?: string;
  lang?: string | null;
  canonicalSha256?: string | null;
  /** Work key. `content_item_work_key_uq` is UNIQUE (isbn, edition) NULLS NOT DISTINCT WHERE isbn IS NOT NULL. */
  isbn?: string | null;
  edition?: string | null;
}): Promise<ResolvedContentItem> {
  const pool = getContentPool();
  const {
    sourceApp,
    sourceLocalId,
    title,
    kind = 'book',
    lang = null,
    canonicalSha256 = null,
    isbn = null,
    edition = null,
  } = params;

  const existing = await pool.query<{ content_item_id: string }>(
    `SELECT content_item_id FROM content.content_source_ref WHERE app = $1 AND local_id = $2`,
    [sourceApp, sourceLocalId],
  );
  if (existing.rows.length > 0) {
    const contentItemId = existing.rows[0].content_item_id;
    // A work registered before anyone knew its ISBN gains one the first time a
    // part supplies it. COALESCE, never overwrite: a differing ISBN on a later
    // part is a data problem to look at, not something to silently adopt.
    if (isbn) {
      try {
        await pool.query(
          `UPDATE content.content_item
              SET isbn = coalesce(isbn, $2), edition = coalesce(edition, $3), updated_at = now()
            WHERE id = $1`,
          [contentItemId, isbn, edition],
        );
      } catch (err: any) {
        // Another item already claims this work key. Backfilling is a nicety;
        // failing the ingest over it would be absurd.
        console.warn(
          `⚠️ Could not backfill work key (isbn=${isbn}, edition=${edition ?? 'null'}) onto ` +
            `content_item ${contentItemId}: ${err?.message ?? err}`,
        );
      }
    }
    return { contentItemId, deduped: false, matchedBy: 'source_ref' };
  }

  if (isbn) {
    const byWork = await pool.query<{ id: string }>(
      `SELECT id FROM content.content_item
        WHERE isbn = $1 AND edition IS NOT DISTINCT FROM $2`,
      [isbn, edition],
    );
    if (byWork.rows.length > 0) {
      const contentItemId = byWork.rows[0].id;
      await pool.query(
        `INSERT INTO content.content_source_ref (content_item_id, app, local_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (app, local_id) DO NOTHING`,
        [contentItemId, sourceApp, sourceLocalId],
      );
      return { contentItemId, deduped: false, matchedBy: 'work_key' };
    }
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
      return { contentItemId, deduped: true, matchedBy: 'content_hash' };
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemRes = await client.query<{ id: string }>(
      `INSERT INTO content.content_item (title, kind, lang, canonical_sha256, isbn, edition)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title, kind, lang, canonicalSha256, isbn, edition],
    );
    const contentItemId = itemRes.rows[0].id;
    await client.query(
      `INSERT INTO content.content_source_ref (content_item_id, app, local_id) VALUES ($1, $2, $3)`,
      [contentItemId, sourceApp, sourceLocalId],
    );
    await client.query('COMMIT');
    return { contentItemId, deduped: false, matchedBy: 'created' };
  } catch (err: any) {
    await client.query('ROLLBACK');
    // Lost a race between our SELECT and our INSERT. Two indexes can produce
    // this, and they mean different things:
    //   content_item_work_key_uq — a sibling PART of the same work got there
    //     first. Not a dedupe: this part still has to be ingested.
    //   content_item_sha_uq      — the same BYTES got there first. A real dedupe.
    // Re-resolve rather than surfacing a constraint violation to the operator.
    if (err?.code === '23505') {
      if (isbn) {
        const retryWork = await pool.query<{ id: string }>(
          `SELECT id FROM content.content_item WHERE isbn = $1 AND edition IS NOT DISTINCT FROM $2`,
          [isbn, edition],
        );
        if (retryWork.rows.length > 0) {
          const contentItemId = retryWork.rows[0].id;
          await pool.query(
            `INSERT INTO content.content_source_ref (content_item_id, app, local_id)
             VALUES ($1, $2, $3) ON CONFLICT (app, local_id) DO NOTHING`,
            [contentItemId, sourceApp, sourceLocalId],
          );
          return { contentItemId, deduped: false, matchedBy: 'work_key' };
        }
      }
      if (canonicalSha256) {
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
          return { contentItemId, deduped: true, matchedBy: 'content_hash' };
        }
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * The work key currently recorded on an item, for the mismatch check that has to
 * happen before anything is written.
 */
export async function getWorkKey(
  contentItemId: string,
): Promise<{ isbn: string | null; edition: string | null; title: string } | null> {
  const pool = getContentPool();
  const res = await pool.query<{ isbn: string | null; edition: string | null; title: string }>(
    `SELECT isbn, edition, title FROM content.content_item WHERE id = $1`,
    [contentItemId],
  );
  return res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * Register a file against a SLOT on a work, creating the row or updating the
 * file that occupies it.
 *
 * A slot is (content_item_id, role, part_index, variant): "chapter 3's markdown",
 * "the source PDF", "chapter 3's female narration". Different files occupy the
 * same slot over time as content is corrected, and the slot's identity must not
 * change when the bytes do — the ingest_run points at this row, and a stable id
 * is what lets a re-ingest supersede the previous one.
 *
 * Deliberately a SELECT-then-INSERT/UPDATE rather than ON CONFLICT: this ships
 * BEFORE trio migration 006 creates the slot unique index, and an ON CONFLICT
 * clause naming an index that does not exist yet would fail at runtime. This
 * form is correct under both the old key and the new one — the expand step of
 * expand → deploy → migrate → contract.
 *
 * `storageUri` is `r2://{bucket}/{key}`; the bucket alone cannot say which
 * credentials to authenticate with, hence storage_account.
 */
export async function registerAsset(params: {
  contentItemId: string;
  role: string;
  partIndex?: number;
  partLabel?: string | null;
  variant?: string;
  storageAccount: string;
  storageUri: string;
  sha256: string;
  bytes?: number | null;
  pageCount?: number | null;
  /**
   * printed page = file page + pageOffset. A chapter PDF cut out of a textbook
   * starts at file page 1 while the book calls it page 137; without this a
   * citation points at the wrong page and reads as a hallucination.
   */
  pageOffset?: number | null;
}): Promise<{ assetId: string; changed: boolean; created: boolean }> {
  const pool = getContentPool();
  const partIndex = params.partIndex ?? 0;
  const variant = params.variant ?? 'default';

  const existing = await pool.query<{ id: string; asset_sha256: string | null }>(
    `SELECT id, asset_sha256 FROM content.content_asset
      WHERE content_item_id = $1
        AND role = $2
        AND coalesce(part_index, 0) = $3
        AND coalesce(variant, 'default') = $4
      LIMIT 1`,
    [params.contentItemId, params.role, partIndex, variant],
  );

  if (existing.rows.length > 0) {
    const { id, asset_sha256 } = existing.rows[0];
    // Byte-identical re-upload: nothing to do. The caller uses `changed` to skip
    // re-embedding, which is the whole point — an unchanged chapter must not
    // cost a single OpenAI token.
    if (asset_sha256 === params.sha256) {
      return { assetId: id, changed: false, created: false };
    }
    await pool.query(
      `UPDATE content.content_asset
          SET asset_sha256 = $2, storage_uri = $3, storage_account = $4,
              bytes = $5, page_count = coalesce($6, page_count),
              page_offset = coalesce($7, page_offset),
              part_label = coalesce($8, part_label)
        WHERE id = $1`,
      [
        id,
        params.sha256,
        params.storageUri,
        params.storageAccount,
        params.bytes ?? null,
        params.pageCount ?? null,
        params.pageOffset ?? null,
        params.partLabel ?? null,
      ],
    );
    // The slot row is updated in place, so the bytes that used to occupy it
    // would otherwise leave no trace. Append-only history, best-effort: losing
    // an audit row must not fail an ingest that has otherwise succeeded.
    await recordAssetVersion(id, params.sha256, params.storageUri);
    return { assetId: id, changed: true, created: false };
  }

  const res = await pool.query<{ id: string }>(
    `INSERT INTO content.content_asset
       (content_item_id, role, part_index, part_label, variant, storage_account, storage_uri,
        asset_sha256, bytes, page_count, page_offset)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      params.contentItemId,
      params.role,
      partIndex,
      params.partLabel ?? null,
      variant,
      params.storageAccount,
      params.storageUri,
      params.sha256,
      params.bytes ?? null,
      params.pageCount ?? null,
      params.pageOffset ?? null,
    ],
  );
  await recordAssetVersion(res.rows[0].id, params.sha256, params.storageUri);
  return { assetId: res.rows[0].id, changed: true, created: true };
}

/**
 * Append this file to the slot's history (trio migration 006).
 *
 * Best-effort by design: `content_asset_version` answers "which bytes did we
 * publish in March", which is worth having and never worth failing a good
 * ingest over. The unique index on (asset_id, asset_sha256) makes a repeat
 * registration of the same bytes a no-op rather than a duplicate row.
 */
async function recordAssetVersion(assetId: string, sha256: string, storageUri: string): Promise<void> {
  try {
    const pool = getContentPool();
    await pool.query(
      `INSERT INTO content.content_asset_version (asset_id, asset_sha256, r2_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (asset_id, asset_sha256) DO NOTHING`,
      [assetId, sha256, storageUri],
    );
  } catch (err: any) {
    console.warn(`⚠️ Could not record asset version for ${assetId}: ${err?.message ?? err}`);
  }
}

/** The source PDF of a work. Thin wrapper over registerAsset for the PDF lane. */
export async function recordSourceAsset(params: {
  contentItemId: string;
  storageAccount: string;
  storageUri: string;
  sha256: string;
  bytes: number;
  pageCount?: number | null;
}): Promise<string> {
  const { assetId } = await registerAsset({ ...params, role: 'source', partIndex: 0, variant: 'default' });
  return assetId;
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
  contentAssetId: string,
  chunks: Array<{
    chunkIndex: number;
    text: string;
    pageStart?: number | null;
    pageEnd?: number | null;
    chapter?: string | null;
    /**
     * 'reference' (explanatory prose) vs 'practice' (a question, prompt or
     * activity). Per CHUNK, not per file — one chapter carries both, and
     * answering a student's question with the textbook's own question back at
     * them is the failure this exists to make filterable. NULL = unclassified.
     */
    retrievalClass?: 'reference' | 'practice' | null;
  }>,
): Promise<string[]> {
  if (chunks.length === 0) return [];
  const pool = getContentPool();

  const values: unknown[] = [];
  const rows = chunks.map((c, i) => {
    const base = i * 8;
    values.push(
      contentItemId,
      contentAssetId,
      c.chunkIndex,
      c.pageStart ?? null,
      c.pageEnd ?? null,
      c.text,
      c.chapter ?? null,
      c.retrievalClass ?? null,
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  });

  // Keyed on the ASSET, not the work. chunk_index is contiguous 0..N-1 within a
  // file; book order is (part_index, chunk_index). Under the old
  // (content_item_id, chunk_index) key, chapter 2's indexes 0..38 collided with
  // chapter 1's and this DO UPDATE silently overwrote chapter 1's text — a book
  // that keeps only its last-ingested chapter, with nothing reported.
  const res = await pool.query<{ id: string }>(
    `INSERT INTO content.content_chunk
       (content_item_id, content_asset_id, chunk_index, page_start, page_end, text, chapter, retrieval_class)
     VALUES ${rows.join(', ')}
     ON CONFLICT (content_asset_id, chunk_index) DO UPDATE SET
       page_start = excluded.page_start,
       page_end = excluded.page_end,
       text = excluded.text,
       chapter = excluded.chapter,
       retrieval_class = excluded.retrieval_class
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
  contentAssetId: string,
  chunkCount: number,
): Promise<number> {
  const pool = getContentPool();
  // Scoped to the ASSET. Scoped to the work — as it was — a re-ingest of
  // chapter 2 that produced fewer chunks would delete every row with a higher
  // chunk_index across the whole book, taking chapters 3..15 with it.
  const res = await pool.query(
    `DELETE FROM content.content_chunk WHERE content_asset_id = $1 AND chunk_index >= $2`,
    [contentAssetId, chunkCount],
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
 * Whether THIS SLOT is currently published — i.e. whether the file occupying it
 * has a live run.
 *
 * This is what makes "the bytes did not change, skip it" safe. Unchanged bytes
 * alone are not enough: if the previous run for this asset failed halfway, or
 * was never activated, nothing is live for the chapter and re-uploading the
 * identical file must actually re-ingest it. Skipping on bytes alone would tell
 * an operator "already ingested" about a chapter that is missing from the
 * library — the one message guaranteed to stop them investigating.
 */
export async function hasActiveRunForAsset(contentAssetId: string): Promise<boolean> {
  const pool = getContentPool();
  const res = await pool.query(
    `SELECT 1 FROM content.ingest_run
      WHERE content_asset_id = $1 AND status = 'active' LIMIT 1`,
    [contentAssetId],
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
