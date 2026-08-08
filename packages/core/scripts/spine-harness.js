/**
 * Throwaway verification harness for the spine identity layer.
 * Runs the REAL compiled content-identity.js against the REAL trio database.
 * Deletes everything it created before exiting, and reports what it deleted.
 */
const ci = require('./content-identity.js');
const { getContentPool } = require('./content-connection.js');

const APP = 'digiclassroom';
const LOCAL_ID = `__spine_harness_${Date.now()}`;
const ISBN = `__harness-${Date.now()}`;

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
 * REFUSE TO RUN AGAINST A DATABASE THAT HOLDS ANYTHING.
 *
 * This harness creates rows and then deletes them, and its cleanup ends with
 * `DELETE FROM content.content_item WHERE id = $1`, which cascades. That was
 * correct while every content table was empty and the only rows in the database
 * were the ones it had just made. It stops being correct the moment a real book
 * lands: a bug in the id it tracks, or an edit that widens a cleanup query,
 * deletes published content, and content_item cascades to assets, chunks, runs
 * and grants.
 *
 * The guard is emptiness, not a flag, because a flag is something you set when
 * you are already sure — and being already sure is exactly the state in which
 * this goes wrong.
 */
async function assertDatabaseIsEmpty(pool) {
  const tables = [
    'content_item', 'content_asset', 'content_chunk',
    'ingest_run', 'content_grant', 'content_source_ref', 'content_asset_version',
  ];
  const populated = [];
  for (const t of tables) {
    const r = await pool.query(`SELECT count(*)::int c FROM content.${t}`);
    if (r.rows[0].c > 0) populated.push(`${t}=${r.rows[0].c}`);
  }
  if (populated.length > 0) {
    console.error('REFUSING TO RUN — the content schema is not empty.');
    console.error(`  populated: ${populated.join(', ')}`);
    console.error(
      '  This harness writes throwaway rows and deletes them by cascading from content_item.\n' +
      '  Against a database holding real books that is a data-loss tool, not a test.\n' +
      '  Run it against an empty database, or write assertions that never delete.',
    );
    await pool.end();
    process.exit(3);
  }
  console.log('Pre-flight: content schema is empty — safe to run.\n');
}

async function main() {
  const pool = getContentPool();
  await assertDatabaseIsEmpty(pool);

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
