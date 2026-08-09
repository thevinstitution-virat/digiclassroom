/**
 * Throwaway verification harness for the spine identity layer.
 * Runs the REAL compiled content-identity.js against the REAL trio database.
 * Deletes everything it created before exiting, and reports what it deleted.
 */
const ci = require('./content-identity.js');
const { getContentPool } = require('./content-connection.js');

/**
 * The sentinel work. Not an ISBN — deliberately unmistakable, so no real book
 * can ever collide with it and nobody can mistake a sentinel row for content.
 */
const SENTINEL_ISBN = 'TRIO-HARNESS-SENTINEL-DO-NOT-USE';

const APP = 'digiclassroom';
const LOCAL_ID = `__spine_harness_${Date.now()}`;
const ISBN = SENTINEL_ISBN;

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

/**
 * REFUSE TO RUN IF ANY ROW BELONGS TO A WORK THIS HARNESS DOES NOT OWN.
 *
 * The first version of this guard demanded an empty schema. That was right for
 * about a day and then permanently wrong: the moment the first real chapter
 * lands the harness locks itself out, and a test you cannot run is a test you
 * stop maintaining.
 *
 * Ownership is the real property being protected, not emptiness. This harness
 * writes throwaway rows and deletes them by cascading from content_item, which
 * takes assets, chunks, runs and grants with it. What must never happen is that
 * cascade reaching a work it did not create. So: the sentinel work is fair game,
 * everything else is off limits, and the check is per-row rather than per-table.
 */
async function assertOnlySentinelRows(pool) {
  const foreign = [];

  const checks = [
    ['content_item', `SELECT count(*)::int c FROM content.content_item WHERE isbn IS DISTINCT FROM $1`],
    ['content_asset', `SELECT count(*)::int c FROM content.content_asset a
                         JOIN content.content_item i ON i.id = a.content_item_id
                        WHERE i.isbn IS DISTINCT FROM $1`],
    ['content_chunk', `SELECT count(*)::int c FROM content.content_chunk ch
                         JOIN content.content_item i ON i.id = ch.content_item_id
                        WHERE i.isbn IS DISTINCT FROM $1`],
    ['ingest_run', `SELECT count(*)::int c FROM content.ingest_run r
                      JOIN content.content_item i ON i.id = r.content_item_id
                     WHERE i.isbn IS DISTINCT FROM $1`],
    ['content_grant', `SELECT count(*)::int c FROM content.content_grant g
                         JOIN content.content_item i ON i.id = g.content_item_id
                        WHERE i.isbn IS DISTINCT FROM $1`],
    ['content_source_ref', `SELECT count(*)::int c FROM content.content_source_ref s
                              JOIN content.content_item i ON i.id = s.content_item_id
                             WHERE i.isbn IS DISTINCT FROM $1`],
    ['content_asset_version', `SELECT count(*)::int c FROM content.content_asset_version v
                                 JOIN content.content_asset a ON a.id = v.asset_id
                                 JOIN content.content_item i ON i.id = a.content_item_id
                                WHERE i.isbn IS DISTINCT FROM $1`],
  ];

  for (const [name, sql] of checks) {
    const r = await pool.query(sql, [SENTINEL_ISBN]);
    if (r.rows[0].c > 0) foreign.push(`${name}=${r.rows[0].c}`);
  }

  if (foreign.length > 0) {
    console.error('REFUSING TO RUN — the content schema holds rows this harness does not own.');
    console.error(`  not mine: ${foreign.join(', ')}`);
    console.error(
      `  This harness deletes by cascading from content_item. It may only ever touch the\n` +
      `  sentinel work (isbn = "${SENTINEL_ISBN}"). Anything else is real content, and a\n` +
      `  cascade that reaches it is data loss, not a test.`,
    );
    await pool.end();
    process.exit(3);
  }
  console.log('Pre-flight: no rows outside the sentinel work — safe to run.\n');
}

/** Clear anything a previous run left behind. Sentinel-scoped, so it can only reach its own rows. */
async function clearSentinel(pool) {
  const r = await pool.query(`DELETE FROM content.content_item WHERE isbn = $1`, [SENTINEL_ISBN]);
  if (r.rowCount > 0) console.log(`  cleared ${r.rowCount} sentinel work(s) left by a previous run`);
}

async function main() {
  const pool = getContentPool();
  await assertOnlySentinelRows(pool);
  await clearSentinel(pool);

  // ── 1. Work identity: two different app-local ids, one ISBN, one work ──
  console.log('\n[1] work key resolution');
  const a = await ci.resolveOrCreateContentItem({
    sourceApp: APP, sourceLocalId: LOCAL_ID, title: 'Harness Book', isbn: ISBN, edition: '2024',
  });
  check('first call creates', a.matchedBy === 'created', a.matchedBy);

  const again = await ci.resolveOrCreateContentItem({
    sourceApp: APP, sourceLocalId: LOCAL_ID, title: 'Harness Book', isbn: ISBN, edition: '2024',
  });
  check('same local id -> source_ref', again.matchedBy === 'source_ref' && again.contentItemId === a.contentItemId, again.matchedBy);

  const byWork = await ci.resolveOrCreateContentItem({
    sourceApp: APP, sourceLocalId: LOCAL_ID + '_other', title: 'Harness Book', isbn: ISBN, edition: '2024',
  });
  check('different local id, same ISBN -> SAME work', byWork.contentItemId === a.contentItemId, `${byWork.matchedBy} ${byWork.contentItemId}`);
  check('work-key match is NOT a dedupe', byWork.deduped === false, String(byWork.deduped));

  const itemId = a.contentItemId;

  // ── 2. Slots ──
  console.log('\n[2] slots');
  const src = await ci.registerAsset({
    contentItemId: itemId, role: 'source', partIndex: 0,
    storageAccount: 'digiclassroom-pro', storageUri: 'r2://x/harness/source.pdf',
    sha256: 'a'.repeat(64), bytes: 10,
  });
  check('source asset created', src.created === true && src.changed === true);

  const ch1 = await ci.registerAsset({
    contentItemId: itemId, role: 'enriched_md', partIndex: 1, partLabel: 'Chapter 1',
    storageAccount: 'digiclassroom-pro', storageUri: 'r2://x/harness/ch1.md',
    sha256: 'b'.repeat(64), pageOffset: 136,
  });
  const ch2 = await ci.registerAsset({
    contentItemId: itemId, role: 'enriched_md', partIndex: 2, partLabel: 'Chapter 2',
    storageAccount: 'digiclassroom-pro', storageUri: 'r2://x/harness/ch2.md',
    sha256: 'c'.repeat(64), pageOffset: 150,
  });
  check('two chapter slots are distinct rows', ch1.assetId !== ch2.assetId);

  const ch1Same = await ci.registerAsset({
    contentItemId: itemId, role: 'enriched_md', partIndex: 1,
    storageAccount: 'digiclassroom-pro', storageUri: 'r2://x/harness/ch1.md',
    sha256: 'b'.repeat(64),
  });
  check('identical bytes -> same slot, changed=false', ch1Same.assetId === ch1.assetId && ch1Same.changed === false, String(ch1Same.changed));

  const ch1Edit = await ci.registerAsset({
    contentItemId: itemId, role: 'enriched_md', partIndex: 1,
    storageAccount: 'digiclassroom-pro', storageUri: 'r2://x/harness/ch1.md',
    sha256: 'd'.repeat(64),
  });
  check('corrected file -> SAME slot id, changed=true', ch1Edit.assetId === ch1.assetId && ch1Edit.changed === true);

  const versions = await pool.query(
    `SELECT asset_sha256 FROM content.content_asset_version WHERE asset_id = $1 ORDER BY created_at`, [ch1.assetId]);
  check('slot history kept both files', versions.rows.length === 2, JSON.stringify(versions.rows.map(r => r.asset_sha256[0])));

  const offset = await pool.query(`SELECT page_offset, part_label FROM content.content_asset WHERE id = $1`, [ch1.assetId]);
  check('page_offset persisted', offset.rows[0].page_offset === 136, String(offset.rows[0].page_offset));
  check('part_label persisted', offset.rows[0].part_label === 'Chapter 1', String(offset.rows[0].part_label));

  // ── 3. THE 007 BUG: two chapters both numbered from 0 ──
  console.log('\n[3] chunk_index is per asset (the 007 bug)');
  const ids1 = await ci.insertContentChunks(itemId, ch1.assetId, [
    { chunkIndex: 0, text: 'chapter one, chunk zero', pageStart: 1, pageEnd: 1, chapter: 'Ch1', retrievalClass: 'reference' },
    { chunkIndex: 1, text: 'chapter one, chunk one', pageStart: 2, pageEnd: 3, chapter: 'Ch1', retrievalClass: 'practice' },
    { chunkIndex: 2, text: 'chapter one, chunk two', pageStart: 4, pageEnd: 4, chapter: 'Ch1' },
  ]);
  const ids2 = await ci.insertContentChunks(itemId, ch2.assetId, [
    { chunkIndex: 0, text: 'chapter two, chunk zero', pageStart: 20, pageEnd: 20, chapter: 'Ch2', retrievalClass: 'reference' },
    { chunkIndex: 1, text: 'chapter two, chunk one', pageStart: 21, pageEnd: 21, chapter: 'Ch2' },
  ]);
  check('ch1 returned 3 uuids', ids1.length === 3 && ids1.every(Boolean));
  check('ch2 returned 2 uuids', ids2.length === 2 && ids2.every(Boolean));

  const survived = await pool.query(
    `SELECT content_asset_id, chunk_index, text, page_start, page_end, retrieval_class
       FROM content.content_chunk WHERE content_item_id = $1 ORDER BY content_asset_id, chunk_index`, [itemId]);
  check('BOTH chapters survived (was: ch2 overwrote ch1)', survived.rows.length === 5, `${survived.rows.length} rows`);
  const ch1Zero = survived.rows.find(r => r.content_asset_id === ch1.assetId && r.chunk_index === 0);
  check('ch1 chunk 0 still says chapter one', ch1Zero && ch1Zero.text.startsWith('chapter one'), ch1Zero && ch1Zero.text);
  check('multi-page range preserved', survived.rows.some(r => r.page_start === 2 && r.page_end === 3));
  check('retrieval_class persisted', survived.rows.filter(r => r.retrieval_class === 'practice').length === 1);
  check('unclassified stays NULL', survived.rows.filter(r => r.retrieval_class === null).length === 2);

  // ── 4. Re-ingest of one chapter must not touch its siblings ──
  console.log('\n[4] prune is asset-scoped');
  await ci.insertContentChunks(itemId, ch1.assetId, [
    { chunkIndex: 0, text: 'ch1 rewritten', pageStart: 1, pageEnd: 1, chapter: 'Ch1' },
  ]);
  const prunedRows = await ci.pruneChunksBeyond(ch1.assetId, 1);
  check('pruned ch1 tail only', prunedRows === 2, String(prunedRows));
  const after = await pool.query(
    `SELECT content_asset_id, count(*)::int c FROM content.content_chunk WHERE content_item_id = $1 GROUP BY 1`, [itemId]);
  const ch2Count = after.rows.find(r => r.content_asset_id === ch2.assetId);
  check('chapter 2 untouched by chapter 1 prune', ch2Count && ch2Count.c === 2, JSON.stringify(after.rows));
  check('ON CONFLICT updated rather than duplicated', after.rows.find(r => r.content_asset_id === ch1.assetId).c === 1);

  // ── 5. Runs are per asset, and siblings do not supersede each other ──
  console.log('\n[5] run lifecycle per asset');
  const run1 = await ci.startIngestRun({ contentItemId: itemId, contentAssetId: ch1.assetId, sourceApp: APP, embeddingModel: 'text-embedding-3-large', embeddingDim: 3072, collection: 'harness' });
  await ci.activateIngestRun(run1, 1);
  const run2 = await ci.startIngestRun({ contentItemId: itemId, contentAssetId: ch2.assetId, sourceApp: APP, embeddingModel: 'text-embedding-3-large', embeddingDim: 3072, collection: 'harness' });
  await ci.activateIngestRun(run2, 2);
  const active = await pool.query(`SELECT count(*)::int c FROM content.ingest_run WHERE content_item_id = $1 AND status = 'active'`, [itemId]);
  check('both chapters can be active at once', active.rows[0].c === 2, String(active.rows[0].c));

  check('hasActiveRunForAsset true for ch1', (await ci.hasActiveRunForAsset(ch1.assetId)) === true);
  check('hasActiveRunForAsset false for the source slot', (await ci.hasActiveRunForAsset(src.assetId)) === false);

  const run1b = await ci.startIngestRun({ contentItemId: itemId, contentAssetId: ch1.assetId, sourceApp: APP, embeddingModel: 'text-embedding-3-large', embeddingDim: 3072, collection: 'harness' });
  const superseded = await ci.supersedePriorActiveRun(itemId, ch1.assetId, run1b);
  check('re-ingesting ch1 supersedes only ch1 run', superseded === run1, `${superseded} vs ${run1}`);
  const stillActive = await pool.query(`SELECT status FROM content.ingest_run WHERE id = $1`, [run2]);
  check('chapter 2 run still active', stillActive.rows[0].status === 'active', stillActive.rows[0].status);
  await ci.activateIngestRun(run1b, 1);

  check('findSourceAssetId finds the source', (await ci.findSourceAssetId(itemId)) === src.assetId);

  // ── cleanup ──
  console.log('\n[cleanup]');
  const del = await pool.query(`DELETE FROM content.content_item WHERE id = $1`, [itemId]);
  console.log(`  deleted content_item: ${del.rowCount}`);
  for (const t of ['content_chunk', 'content_asset', 'ingest_run', 'content_grant', 'content_source_ref', 'content_item']) {
    const r = await pool.query(`SELECT count(*)::int c FROM content.${t}`);
    console.log(`  content.${t} now has ${r.rows[0].c} row(s)`);
  }
  const av = await pool.query(`SELECT count(*)::int c FROM content.content_asset_version`);
  console.log(`  content.content_asset_version now has ${av.rows[0].c} row(s)`);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  await pool.end();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('HARNESS THREW:', e); process.exit(2); });
