/**
 * ingest-part.ts — the first caller of ingestPart().
 *
 * Deliberately NOT an HTTP endpoint and NOT a console. Minting a valid session
 * has blocked verification once already, and an ingest that can only be started
 * from a browser cannot be run from a container on the coolify network — which
 * is the path that has actually been proven to reach production. This is a
 * one-shot script: bundle it, drop it in a throwaway container, run it.
 *
 *   node ingest-part.cjs
 *     --isbn 978-93-5729-100-2
 *     --edition "First Edition, June 2026"
 *     --title "Understanding Society - India and Beyond"
 *     --chapter 8=/work/ch8.md  [--chapter 9=/work/ch9.md ...]
 *     [--asset <role>[:<part>][:<variant>]=<path> ...]
 *     [--app digiclassroom] [--local-id <id>] [--org <local org id>]
 *     [--dry-run] [--force "<reason>"]
 *
 * A work is a hierarchy of slots, (role, part_index, variant), not one file.
 * The chapters carry the chunks; --asset registers every other rendition of the
 * same work against the same identity:
 *
 *     --asset source=/work/original.pdf      the file the chapters came from
 *     --asset pdf_paginated=/work/book.pdf   what a reader opens
 *     --asset epub=/work/book.epub
 *     --asset audio:8:female=/work/ch8-f.m4a per-chapter, per-voice narration
 *     --asset cover=/work/cover.jpg
 *
 * All of them are optional, INCLUDING source. The chapter markdown is itself an
 * obtainable rendition, so a book uploaded as chapter files alone is a complete,
 * publishable work.
 *
 * --dry-run parses, chunks, lints, and looks the slot up READ-ONLY, then stops
 * before embedding. It writes nothing at all — not even identity rows. The point
 * of it is to see what a chapter would produce before the first OpenAI call in
 * this project's history costs anything, and a dry run that mutates the database
 * is not a dry run.
 *
 * Exit codes: 0 every chapter succeeded or was skipped as unchanged; 1 at least
 * one chapter failed; 2 usage error.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { parseEnrichedMarkdown } from '@/lib/content/markdown-ingest-parser';
import { enhancedRAG, type SpineIngestResult } from '@/lib/ai/rag/enhanced-rag-pipeline';
import {
  resolveOrCreateContentItem,
  registerAsset,
} from '@/lib/db/content-identity';
import { getContentPool } from '@/lib/db/content-connection';
import { OpenAIService } from '@/lib/services/openai_service';

/**
 * Every rendition role the shared schema allows (trio migration 005's CHECK).
 * A work is a hierarchy of slots — (role, part_index, variant) — not one file:
 * chapter markdown, a paginated PDF, an EPUB, per-chapter narration in two
 * voices, a cover. All of them can be uploaded for the same work.
 */
const ASSET_ROLES = [
  'source', 'enriched_md', 'pdf_paginated', 'epub',
  'audio', 'audio_sync', 'cover', 'thumbnail',
];

/** Content types by extension, so a rendition is stored as what it actually is. */
const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf', '.epub': 'application/epub+zip', '.md': 'text/markdown; charset=utf-8',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

/** $ per 1M tokens, text-embedding-3-large. Stated so the number below is checkable. */
const EMBEDDING_USD_PER_MILLION = 0.13;

interface Args {
  isbn: string;
  edition: string | null;
  title: string;
  assets: Array<{ role: string; partIndex: number; variant: string; file: string }>;
  chapters: Array<{ partIndex: number; file: string }>;
  app: 'pdlms' | 'vidyaverse' | 'digiclassroom';
  localId: string;
  org: string | null;
  dryRun: boolean;
  force: string | null;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | null => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  const chapters: Array<{ partIndex: number; file: string }> = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--chapter') continue;
    const spec = argv[i + 1] ?? '';
    const eq = spec.indexOf('=');
    if (eq === -1) fail(`--chapter expects <partIndex>=<path>, got "${spec}"`);
    chapters.push({ partIndex: parseInt(spec.slice(0, eq), 10), file: spec.slice(eq + 1) });
  }

  // Other renditions of the same work: --asset <role>[:<partIndex>][:<variant>]=<path>
  // e.g. --asset epub=/work/book.epub
  //      --asset audio:3:female=/work/ch3-female.m4a
  //      --asset cover=/work/cover.jpg
  const assets: Array<{ role: string; partIndex: number; variant: string; file: string }> = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--asset') continue;
    const spec = argv[i + 1] ?? '';
    const eq = spec.indexOf('=');
    if (eq === -1) fail(`--asset expects <role>[:<partIndex>][:<variant>]=<path>, got "${spec}"`);
    const [role, partRaw, variantRaw] = spec.slice(0, eq).split(':');
    const file = spec.slice(eq + 1);
    if (!ASSET_ROLES.includes(role)) {
      fail(`--asset role "${role}" is not one of: ${ASSET_ROLES.join(', ')}`);
    }
    if (!existsSync(file)) fail(`asset file not found: ${file}`);
    assets.push({
      role,
      partIndex: partRaw ? parseInt(partRaw, 10) : 0,
      variant: variantRaw || 'default',
      file,
    });
  }

  const isbn = get('isbn');
  const title = get('title');
  // --source-pdf is the old spelling of --asset source=<path>; both accepted.
  const sourcePdf = get('source-pdf') ?? get('source');
  if (sourcePdf) {
    if (!existsSync(sourcePdf)) fail(`source file not found: ${sourcePdf}`);
    assets.unshift({ role: 'source', partIndex: 0, variant: 'default', file: sourcePdf });
  }
  if (!isbn || !title || chapters.length === 0) {
    fail('required: --isbn --title and at least one --chapter <partIndex>=<path>');
  }
  for (const c of chapters) {
    if (!Number.isFinite(c.partIndex) || c.partIndex < 1) {
      fail(`--chapter part index must be a positive integer (part_index 0 is reserved for the whole work)`);
    }
    if (!existsSync(c.file)) fail(`chapter file not found: ${c.file}`);
  }

  const forceIdx = argv.indexOf('--force');
  const force =
    forceIdx === -1 ? null : (argv[forceIdx + 1] && !argv[forceIdx + 1].startsWith('--')
      ? argv[forceIdx + 1]
      : 'no reason given');

  return {
    isbn: isbn!,
    edition: get('edition'),
    title: title!,
    assets,
    chapters: chapters.sort((a, b) => a.partIndex - b.partIndex),
    app: (get('app') as Args['app']) ?? 'digiclassroom',
    // One work, one app-local id. Every chapter of a book shares it — that is
    // what makes fifteen files resolve to one content_item.
    localId: get('local-id') ?? `isbn:${isbn}`,
    org: get('org'),
    dryRun: argv.includes('--dry-run'),
    force,
  };
}

function fail(msg: string): never {
  console.error(`usage error: ${msg}`);
  process.exit(2);
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Run the prep skill's own linter over the bytes about to be ingested.
 *
 * This runs HERE, at ingestion, not only at authoring. The one real chapter on
 * hand arrives markdown-escaped and fails this linter 86 times — the check
 * existed the whole time and was simply never run against the file. Whether a
 * defect is introduced by the author or by whatever moved the file, the bytes
 * that arrive are the bytes that get indexed, so this is the gate that matters.
 */
function lint(file: string): { ok: boolean; output: string } {
  const linter = path.join(__dirname, 'lint-enriched-md.mjs');
  if (!existsSync(linter)) {
    return { ok: false, output: `linter not found next to this script at ${linter}` };
  }
  try {
    const out = execFileSync(process.execPath, [linter, file], { encoding: 'utf8' });
    return { ok: true, output: out };
  } catch (err: any) {
    return { ok: false, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/**
 * Put the chapter's own bytes in R2 and hand back the URI the slot should record.
 *
 * The slot used to record `r2://…/parts/N.md` as a formatted string while only
 * the source PDF was ever uploaded, so every enriched_md row pointed at a key
 * with nothing behind it. Nothing errored — chunks and objects are independent —
 * and the chapter retrieved and cited perfectly while the file it came from could
 * not be fetched by anything, ever.
 *
 * Uploaded BEFORE the slot is registered, deliberately. If this succeeds and the
 * ingest then fails, R2 holds an orphan object no row references, which costs a
 * few kilobytes. The other order costs a row that lies about where its bytes are,
 * and that is only discoverable by trying to fetch one.
 *
 * The bucket comes back from the upload rather than being spelled out here: the
 * bucket in the URI has to be the bucket that was actually written to, and
 * `digiclassroom-pro` was hardcoded in both places purely because R2_BUCKET_NAME
 * happens to equal the storage-account name today.
 */
async function ensurePartUploaded(params: {
  contentItemId: string;
  partIndex: number;
  markdown: string;
  fileSha: string;
  slotSha: string | null;
}): Promise<{ storageUri: string; uploaded: boolean }> {
  const { uploadContentAssetToR2, contentAssetExistsInR2 } = await import('@/lib/services/r2');
  const key = `content/${params.contentItemId}/parts/${params.partIndex}.md`;

  // Unchanged bytes AND the object is really there: nothing to do. Checking the
  // sha alone would skip the upload for every slot registered before this
  // existed, leaving exactly the rows that need repairing unrepaired.
  if (params.slotSha === params.fileSha && (await contentAssetExistsInR2(key))) {
    return { storageUri: `r2://${process.env.R2_BUCKET_NAME}/${key}`, uploaded: false };
  }

  const { bucket } = await uploadContentAssetToR2({
    buffer: Buffer.from(params.markdown, 'utf8'),
    key,
    contentType: 'text/markdown; charset=utf-8',
  });
  return { storageUri: `r2://${bucket}/${key}`, uploaded: true };
}

/** Read-only: what occupies this slot right now, if anything. */
async function peekSlot(contentItemId: string | null, partIndex: number) {
  if (!contentItemId) return null;
  const pool = getContentPool();
  const r = await pool.query<{ id: string; asset_sha256: string | null }>(
    `SELECT id, asset_sha256 FROM content.content_asset
      WHERE content_item_id = $1 AND role = 'enriched_md' AND part_index = $2 AND variant = 'default'`,
    [contentItemId, partIndex],
  );
  return r.rows[0] ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.dryRun ? 'DRY RUN — nothing will be written, nothing embedded' : 'FULL RUN';
  console.log(`\n=== ingest-part — ${mode} ===`);
  console.log(`work    : ${args.title}`);
  console.log(`isbn    : ${args.isbn}${args.edition ? `  edition: ${args.edition}` : ''}`);
  console.log(`identity: app=${args.app} local_id=${args.localId}`);
  console.log(`renditions: ${args.assets.length ? args.assets.map((a) => `${a.role}${a.partIndex ? `/${a.partIndex}` : ''}${a.variant !== 'default' ? `/${a.variant}` : ''}`).join(', ') : '(none beyond the chapters themselves)'}`);
  console.log(`chapters: ${args.chapters.map((c) => c.partIndex).join(', ')}`);
  if (args.force) console.log(`FORCE   : ${args.force}`);
  console.log();

  const pool = getContentPool();

  // ── The work ────────────────────────────────────────────────────────────
  let contentItemId: string | null = null;
  if (args.dryRun) {
    const r = await pool.query<{ id: string }>(
      `SELECT ci.id FROM content.content_item ci
         JOIN content.content_source_ref sr ON sr.content_item_id = ci.id
        WHERE sr.app = $1 AND sr.local_id = $2`,
      [args.app, args.localId],
    );
    contentItemId = r.rows[0]?.id ?? null;
    console.log(`work resolution : ${contentItemId ? `existing ${contentItemId}` : 'would be CREATED'}`);
  } else {
    const resolved = await resolveOrCreateContentItem({
      sourceApp: args.app,
      sourceLocalId: args.localId,
      title: args.title,
      isbn: args.isbn,
      edition: args.edition,
    });
    contentItemId = resolved.contentItemId;
    console.log(`work resolution : ${contentItemId} (${resolved.matchedBy})`);
  }

  // ── Other renditions of the work ────────────────────────────────────────
  // A work is a hierarchy of slots — (role, part_index, variant) — not one
  // file. Registered here rather than inside ingestPart because none of these
  // is a PART: they are alternative renditions of the same work, or of one of
  // its parts, and they carry no chunks.
  //
  // All of them are OPTIONAL, including `source`. The chapter files being
  // ingested are themselves an obtainable rendition, so a book uploaded as
  // chapter markdown alone is publishable. Demanding a separate source file
  // did not make a work more obtainable — a blank stub PDF satisfied it — it
  // just made a fake file the price of admission.
  if (!args.dryRun) {
    for (const a of args.assets) {
      const buf = readFileSync(a.file);
      const digest = sha256(buf);
      const ext = path.extname(a.file).toLowerCase();
      const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
      const name = a.role === 'source' ? `source${ext}` : `${a.role}${a.partIndex ? `-${a.partIndex}` : ''}${a.variant !== 'default' ? `-${a.variant}` : ''}${ext}`;
      const key = `content/${contentItemId}/${name}`;

      const { uploadContentAssetToR2 } = await import('@/lib/services/r2');
      const { bucket } = await uploadContentAssetToR2({ buffer: buf, key, contentType });
      const { assetId, created, changed } = await registerAsset({
        contentItemId: contentItemId!,
        role: a.role,
        partIndex: a.partIndex,
        variant: a.variant,
        storageAccount: 'digiclassroom-pro',
        storageUri: `r2://${bucket}/${key}`,
        sha256: digest,
        bytes: buf.length,
      });
      const state = created ? 'registered' : changed ? 'replaced' : 'unchanged';
      console.log(
        `  ${a.role.padEnd(14)}: ${state} ${assetId} ` +
          `(${(buf.length / 1024).toFixed(1)} KB, sha ${digest.slice(0, 12)}…) -> r2://${bucket}/${key}`,
      );
    }
    await enhancedRAG.initialize();
  }
  console.log();

  // ── Each chapter ────────────────────────────────────────────────────────
  const results: Array<{
    partIndex: number;
    file: string;
    outcome: string;
    detail: string;
    tokens: number;
    chunks: number;
    points: number;
  }> = [];

  for (const ch of args.chapters) {
    const name = path.basename(ch.file);
    console.log(`── part ${ch.partIndex}: ${name} ${'─'.repeat(Math.max(0, 46 - name.length))}`);

    const md = readFileSync(ch.file, 'utf8');
    const bytes = statSync(ch.file).size;
    const fileSha = sha256(Buffer.from(md, 'utf8'));

    // Gate 1 — the prep skill's linter, on the bytes about to be ingested.
    const linted = lint(ch.file);
    const lintErrors = linted.ok ? 0 : (linted.output.match(/ERROR/g) || []).length;
    console.log(`  lint          : ${linted.ok ? 'clean' : `${lintErrors} error(s)`}`);

    // Gate 2 — the parser's own refusals (frontmatter, page bounds).
    const parsed = parseEnrichedMarkdown(md);
    const { meta, chunks, skipped, warnings, errors } = parsed;

    const practice = chunks.filter((c: any) => c.retrieval_class === 'practice').length;
    const pages = [...new Set(chunks.map((c: any) => c.metadata.page))].sort((a, b) => a - b);
    console.log(`  chapter       : ${meta.chapter_number || '?'} — ${meta.chapter_title || '(untitled)'}`);
    console.log(`  chunks        : ${chunks.length}  (${chunks.length - practice} reference, ${practice} practice)`);
    console.log(`  page map      : ${pages.length ? `${pages[0]}–${pages[pages.length - 1]} [${pages.join(',')}]` : '(none)'}`);
    console.log(`  declared range: ${meta.chapter_pages ?? '(not declared)'}`);
    console.log(`  skipped       : ${skipped.length}${skipped.length ? ` — ${skipped[0]}` : ''}`);
    if (warnings.length) console.log(`  warnings      : ${warnings.join(' | ')}`);
    if (errors.length) console.log(`  parse errors  : ${errors.join(' | ')}`);

    // Gate 3 — human validation.
    const approved = meta.validation_status === 'APPROVED';
    console.log(`  validation    : ${meta.validation_status}${approved ? '' : ' (not APPROVED)'}`);

    const blockers: string[] = [];
    if (!linted.ok) blockers.push(`${lintErrors} linter error(s)`);
    if (errors.length) blockers.push(`${errors.length} parse error(s)`);
    if (!approved) blockers.push(`validation_status=${meta.validation_status}`);

    if (blockers.length > 0 && !args.force) {
      console.log(`  OUTCOME       : REFUSED — ${blockers.join('; ')}`);
      if (!linted.ok) {
        console.log(linted.output.split('\n').slice(0, 6).map((l) => `      ${l}`).join('\n'));
      }
      console.log();
      results.push({
        partIndex: ch.partIndex, file: name, outcome: 'failed',
        detail: blockers.join('; '), tokens: 0, chunks: 0, points: 0,
      });
      continue;
    }
    if (blockers.length > 0) {
      console.log(`  OVERRIDDEN    : ${blockers.join('; ')} — proceeding because --force was given`);
    }

    if (args.dryRun) {
      const slot = await peekSlot(contentItemId, ch.partIndex);
      const slotState = !slot
        ? 'would be CREATED'
        : slot.asset_sha256 === fileSha
          ? `exists ${slot.id} — IDENTICAL bytes, would be skipped without embedding`
          : `exists ${slot.id} — bytes CHANGED, would re-ingest`;
      console.log(`  slot          : enriched_md/part ${ch.partIndex}/default — ${slotState}`);
      console.log(`  OUTCOME       : dry run, stopped before embedding`);
      console.log();
      results.push({
        partIndex: ch.partIndex, file: name, outcome: 'dry-run',
        detail: slotState, tokens: 0, chunks: chunks.length, points: 0,
      });
      continue;
    }

    // ── The real thing ────────────────────────────────────────────────────
    const slotNow = await peekSlot(contentItemId, ch.partIndex);
    let part: { storageUri: string; uploaded: boolean };
    try {
      part = await ensurePartUploaded({
        contentItemId: contentItemId!,
        partIndex: ch.partIndex,
        markdown: md,
        fileSha,
        slotSha: slotNow?.asset_sha256 ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  OUTCOME       : failed — could not store the chapter in R2: ${msg}`);
      console.log();
      results.push({
        partIndex: ch.partIndex, file: name, outcome: 'failed',
        detail: `R2 upload failed: ${msg}`, tokens: 0, chunks: 0, points: 0,
      });
      continue;
    }
    console.log(`  r2            : ${part.uploaded ? 'uploaded' : 'already present, unchanged'} ${part.storageUri}`);

    OpenAIService.resetEmbeddingUsage();
    const started = Date.now();

    let result: SpineIngestResult;
    try {
      result = await enhancedRAG.ingestPart({
        sourceApp: args.app,
        sourceLocalId: args.localId,
        contentTitle: args.title,
        // The chapter's OWN frontmatter isbn, not the --isbn flag. That is what
        // makes a chapter carrying the wrong book's ISBN get refused instead of
        // silently attaching to whatever work the local id points at.
        isbn: meta.isbn ?? args.isbn,
        edition: meta.edition ?? args.edition,
        lang: meta.medium ?? null,
        organizationId: args.org,
        part: {
          role: 'enriched_md',
          partIndex: ch.partIndex,
          partLabel: meta.chapter_title
            ? `Chapter ${meta.chapter_number}: ${meta.chapter_title}`
            : `Part ${ch.partIndex}`,
          variant: 'default',
          sha256: fileSha,
          storageAccount: 'digiclassroom-pro',
          storageUri: part.storageUri,
          bytes,
          pageCount: pages.length,
        },
        chunks: chunks.map((c: any) => ({
          text: c.text,
          pageStart: c.metadata.pageNumber ?? c.metadata.page ?? null,
          pageEnd: c.metadata.pageEndNumber ?? c.metadata.pageNumber ?? null,
          chapter: c.metadata.chapter ?? null,
          retrievalClass: c.retrieval_class,
          metadata: c.metadata,
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  OUTCOME       : failed — ${msg}`);
      console.log();
      results.push({
        partIndex: ch.partIndex, file: name, outcome: 'failed', detail: msg,
        tokens: 0, chunks: 0, points: 0,
      });
      continue;
    }

    const usage = OpenAIService.getEmbeddingUsage();

    // Record the override ON THE RUN, so "what is live that never passed its
    // gates" is a query rather than an archaeology exercise.
    if (args.force && result.ingestRunId && blockers.length > 0) {
      await pool.query(
        `UPDATE content.ingest_run SET forced = true, force_reason = $2 WHERE id = $1`,
        [result.ingestRunId, `${args.force} | overrode: ${blockers.join('; ')}`],
      );
      console.log(`  forced        : recorded on run ${result.ingestRunId}`);
    }

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `  OUTCOME       : ${result.status}` +
        (result.reason ? ` — ${result.reason}` : '') +
        `  [${result.chunksWritten} row(s), ${result.pointsUpserted} point(s), ${secs}s]`,
    );
    console.log(
      `  tokens        : ${usage.promptTokens} prompt / ${usage.totalTokens} total ` +
        `across ${usage.calls} embedding call(s)`,
    );
    console.log();

    results.push({
      partIndex: ch.partIndex,
      file: name,
      outcome:
        result.status === 'indexed' ? 'succeeded'
        : result.status === 'skipped_unchanged' ? 'skipped-as-duplicate'
        : 'failed',
      detail: result.reason ?? '',
      tokens: usage.totalTokens,
      chunks: result.chunksWritten,
      points: result.pointsUpserted,
    });
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('═══ per-chapter outcome ═══');
  for (const r of results) {
    console.log(
      `  part ${String(r.partIndex).padStart(2)}  ${r.outcome.padEnd(21)} ` +
        `rows=${String(r.chunks).padStart(4)} points=${String(r.points).padStart(4)} ` +
        `tokens=${String(r.tokens).padStart(6)}` +
        (r.detail ? `\n              ${r.detail}` : ''),
    );
  }

  const totalTokens = results.reduce((a, r) => a + r.tokens, 0);
  const cost = (totalTokens / 1_000_000) * EMBEDDING_USD_PER_MILLION;
  console.log();
  console.log(
    `total embedding tokens: ${totalTokens} ` +
      `≈ $${cost.toFixed(4)} at $${EMBEDDING_USD_PER_MILLION}/1M (text-embedding-3-large)`,
  );

  const failed = results.filter((r) => r.outcome === 'failed').length;
  console.log(failed > 0 ? `\n${failed} chapter(s) FAILED` : '\nno failures');
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('ingest-part threw:', err);
  process.exit(1);
});
