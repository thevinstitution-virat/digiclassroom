import { auth } from '@/auth';
import { isPlatformStaff, type Role } from '@/auth/permissions';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { enhancedRAG, type SpineIngestResult } from '@/lib/ai/rag/enhanced-rag-pipeline';
import { parseEnrichedMarkdown } from '@/lib/content/markdown-ingest-parser';
import { identityMismatch, normaliseEdition } from '@/lib/content/chapter-batch';
import { resolveOrCreateContentItem, registerAsset, type SourceApp } from '@/lib/db/content-identity';
import { getContentPool } from '@/lib/db/content-connection';
import { getBook, ensureWorkSourceRef, listBooksWithIsbn } from '@/lib/db/content-works';

/**
 * POST /api/super-admin/content/ingest-markdown
 *
 * CURATED LANE — upload human-validated enriched-markdown chapters into the
 * shared content spine. No OCR and no PDF toolchain: the markdown already
 * carries clean text, the PRINTED page numbers (so citations are exact),
 * section structure and typed blocks.
 *
 * This lane was closed, and for a good reason: it wrote chunks and vectors
 * through `indexMarkdownChunks`, which opens no shared run. Those points carried
 * no content_item_id, visibility, level or run_id — so Varta could not see them,
 * no ingest_run tracked them, nothing could ever supersede or delete them, and
 * finding them afterwards would have meant searching for the ABSENCE of a field.
 * It now runs through `ingestPart`, the same path the CLI has been proven on, so
 * every upload registers a work, a slot, chunk rows and a run.
 *
 * IDENTITY COMES FROM THE FRONTMATTER. The console posts a file and nothing
 * else, which is the right shape: `isbn`, `edition`, `book_title` and
 * `chapter_number` are already in the file, they were validated by a human, and
 * asking an operator to retype them into a form is how a chapter ends up
 * attached to the wrong book. Form fields may override, but nothing is required.
 *
 * A work is a hierarchy: one content_item keyed on (isbn, edition), and slots
 * keyed (role, part_index, variant). Three request shapes are accepted:
 *   file                              one chapter; part index from its frontmatter
 *   chapter:<n>                       explicit part index, repeatable
 *   asset:<role>[:<part>][:<variant>] any other rendition — pdf, epub, cover, audio
 * Only chapters produce vectors.
 *
 * WHICH BOOK, chosen by a person. The upload page lets the super-admin pick the book and then sends its chapters one at
 * a time. Two optional fields carry that choice and are ENFORCED here, never trusted from the browser:
 *   contentItemId   the chosen book. Every chapter's frontmatter must belong to it (same ISBN, ISBN-10 and ISBN-13 forms
 *                   of one number count as the same; if both editions are written they must agree), or the request is
 *                   refused with 422 before anything is stored. The chapter is attached to THAT work, through its own
 *                   existing source reference, so it cannot become a second copy of the book.
 *   newBook=true    a new book is meant. If a book with that ISBN and edition already exists the request is refused with
 *                   409 and the person is told to select it, instead of the chapter silently joining it.
 * Without either, behaviour is unchanged (identity from the frontmatter), so existing callers keep working.
 */

/** Roles the shared schema allows (trio migration 005's CHECK constraint). */
const ASSET_ROLES = new Set([
  'source', 'enriched_md', 'pdf_paginated', 'epub',
  'audio', 'audio_sync', 'cover', 'thumbnail',
]);

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf', epub: 'application/epub+zip', md: 'text/markdown; charset=utf-8',
  m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', json: 'application/json',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};

const MAX_CHAPTER_BYTES = 5 * 1024 * 1024;

interface PartOutcome {
  partIndex: number;
  filename: string;
  outcome: 'succeeded' | 'skipped-as-duplicate' | 'failed';
  detail?: string;
  chunks: number;
  points: number;
  pages?: string;
  /** Guessed block boundaries and the like. Surfaced, never swallowed — a moved
   *  boundary is a moved citation and nothing downstream can tell. */
  warnings?: string[];
}

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase();

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!isPlatformStaff((session.user.role ?? '') as Role)) {
      return NextResponse.json({ success: false, error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    const formData = await request.formData();
    const uploadId = (formData.get('uploadId') as string) || undefined;
    const organizationId = (formData.get('organizationId') as string | null)?.trim() || null;
    const force = (formData.get('force') as string) === 'true';
    const forceReason = (formData.get('forceReason') as string | null)?.trim() || null;
    const selectedWorkId = (formData.get('contentItemId') as string | null)?.trim() || null;
    const newBook = (formData.get('newBook') as string) === 'true';

    const emit = async (step: number, total: number, label: string) => {
      if (!uploadId) return;
      try {
        const { getProgressEmitter, emitProgress } = await import('@/lib/utils/progress-bus');
        getProgressEmitter(uploadId);
        emitProgress(uploadId, step, total, label);
      } catch { /* progress is a nicety; never fail an ingest over it */ }
    };
    const emitDone = async () => {
      if (!uploadId) return;
      try { const { emitEnd } = await import('@/lib/utils/progress-bus'); emitEnd(uploadId); } catch {}
    };

    // ── Collect files ────────────────────────────────────────────────────────
    const chapterFiles: Array<{ partIndex: number | null; file: File }> = [];
    const assetFiles: Array<{ role: string; partIndex: number; variant: string; file: File }> = [];

    for (const [key, value] of formData.entries()) {
      if (!(value instanceof File) || value.size === 0) continue;
      if (key === 'file') {
        chapterFiles.push({ partIndex: null, file: value });        // index from frontmatter
      } else if (key.startsWith('chapter:')) {
        const n = parseInt(key.slice('chapter:'.length), 10);
        if (!Number.isFinite(n) || n < 1) {
          return NextResponse.json(
            { success: false, error: `Chapter part index must be a positive integer (0 is reserved for the whole work); got "${key}".` },
            { status: 400 },
          );
        }
        chapterFiles.push({ partIndex: n, file: value });
      } else if (key.startsWith('asset:')) {
        const [role, partRaw, variantRaw] = key.slice('asset:'.length).split(':');
        if (!ASSET_ROLES.has(role)) {
          return NextResponse.json(
            { success: false, error: `Unknown rendition role "${role}". Allowed: ${[...ASSET_ROLES].join(', ')}.` },
            { status: 400 },
          );
        }
        assetFiles.push({ role, partIndex: partRaw ? parseInt(partRaw, 10) || 0 : 0, variant: variantRaw || 'default', file: value });
      }
    }

    if (chapterFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Choose an enriched Markdown (.md) chapter to upload.' },
        { status: 400 },
      );
    }
    for (const c of chapterFiles) {
      if (extOf(c.file.name) !== 'md') {
        return NextResponse.json(
          { success: false, error: `"${c.file.name}" is not a .md file. This lane takes enriched markdown; PDFs and other formats attach as renditions.` },
          { status: 400 },
        );
      }
      if (c.file.size > MAX_CHAPTER_BYTES) {
        return NextResponse.json({ success: false, error: `"${c.file.name}" exceeds 5MB.` }, { status: 400 });
      }
    }

    await emit(1, 3, 'Parsing enriched markdown');

    // ── Parse and gate EVERY chapter before writing anything ─────────────────
    // A batch that fails halfway leaves a work half-populated, so every cheap
    // refusal happens up front: nothing is uploaded, embedded or registered
    // until all of them have passed.
    const parsed: Array<{
      partIndex: number; file: File; buf: Buffer; sha: string;
      meta: any; chunks: any[]; warnings: string[]; skipped: string[];
    }> = [];

    for (const c of chapterFiles) {
      const buf = Buffer.from(await c.file.arrayBuffer());
      const { meta, chunks, warnings, errors, skipped } = parseEnrichedMarkdown(buf.toString('utf8'));

      if (errors.length > 0) {
        await emitDone();
        return NextResponse.json(
          { success: false, error: `"${c.file.name}" was refused by the parser.`, errors, warnings, skipped },
          { status: 422 },
        );
      }
      if (meta.validation_status !== 'APPROVED' && !force) {
        await emitDone();
        return NextResponse.json(
          {
            success: false,
            error: `"${c.file.name}" has validation_status "${meta.validation_status}", not APPROVED. ` +
              `A human has to confirm the transcription matches the printed page before it becomes citable. ` +
              `Re-submit with force to override.`,
            skipped,
          },
          { status: 422 },
        );
      }
      if (chunks.length === 0) {
        await emitDone();
        return NextResponse.json(
          { success: false, error: `"${c.file.name}" produced no indexable chunks — check its PAGE and SECTION markers.`, warnings, skipped },
          { status: 422 },
        );
      }

      const partIndex = c.partIndex ?? parseInt(String(meta.chapter_number ?? ''), 10);
      if (!Number.isFinite(partIndex) || partIndex < 1) {
        await emitDone();
        return NextResponse.json(
          {
            success: false,
            error: `"${c.file.name}" has no usable chapter_number in its frontmatter, so there is no slot to put it in. ` +
              `part_index orders the chapters of a book and 0 is reserved for the whole work.`,
          },
          { status: 422 },
        );
      }

      parsed.push({ partIndex, file: c.file, buf, sha: sha256(buf), meta, chunks, warnings, skipped });
    }
    parsed.sort((a, b) => a.partIndex - b.partIndex);

    // ── The chosen book, when the page names one ─────────────────────────────
    // The person picked a book; the files must belong to it. Checked here, with the same rules the page used, because
    // a browser can be wrong or out of date and a chapter attached to the wrong book is invisible once it is indexed.
    let selected: { id: string; title: string; isbn: string | null; edition: string | null; sourceApp: SourceApp; localId: string } | null = null;
    if (selectedWorkId) {
      const pool = getContentPool();
      const work = await getBook(pool, selectedWorkId);
      if (!work) {
        await emitDone();
        return NextResponse.json({ success: false, error: 'The selected book no longer exists. Reload the page and choose it again.' }, { status: 404 });
      }
      for (const p of parsed) {
        const why = identityMismatch({ isbn: p.meta.isbn ?? null, edition: p.meta.edition ?? null }, { isbn: work.isbn, edition: work.edition }, `"${work.title}"`);
        if (why) {
          await emitDone();
          return NextResponse.json(
            { success: false, error: `"${p.file.name}" does not belong to "${work.title}". ${why} Nothing was stored.` },
            { status: 422 },
          );
        }
      }
      // Attach through the work's OWN source reference, so the chapter resolves to this exact work and can never become
      // a second copy of the book. Prefer this app's reference, else the oldest one.
      const ref = await ensureWorkSourceRef(pool, work.id);
      selected = { ...work, sourceApp: ref.app, localId: ref.localId };
    } else if (newBook) {
      // A NEW book was meant. If that ISBN and edition already exist, joining it silently is exactly the mistake this
      // upload exists to prevent: say so and let the person select the book.
      const f0 = parsed[0].meta;
      const existing = await listBooksWithIsbn(getContentPool());
      const clash = existing.find(
        (b) => identityMismatch({ isbn: f0.isbn ?? null, edition: f0.edition ?? null }, b) === null
          && normaliseEdition(b.edition) === normaliseEdition(f0.edition),
      );
      if (clash) {
        await emitDone();
        return NextResponse.json(
          {
            success: false,
            error: `A book with ISBN ${clash.isbn}${clash.edition ? ` (${clash.edition})` : ''} already exists: "${clash.title}". ` +
              `Select it from the list instead of creating a new one. Nothing was stored.`,
            existingBookId: clash.id,
          },
          { status: 409 },
        );
      }
    }

    // ── Work identity: the chosen book, else the frontmatter; form fields may override ──
    const first = parsed[0].meta;
    const isbn = selected?.isbn ?? ((formData.get('isbn') as string | null)?.trim() || first.isbn || '').trim();
    const title = selected?.title ?? ((formData.get('bookTitle') as string | null)?.trim() || first.book_title || '').trim();
    const edition = selected ? (selected.edition ?? first.edition ?? null) : ((formData.get('edition') as string | null)?.trim() || first.edition || null);

    if (!isbn || !title) {
      await emitDone();
      return NextResponse.json(
        {
          success: false,
          error: 'This chapter carries no work identity — its frontmatter needs an isbn and a book_title. ' +
            'Without them the chapter cannot be tied to a book, and "chat with this book" would silently mean "chat with this chapter".',
        },
        { status: 422 },
      );
    }
    // With a chosen book the normalised check above already ran (ISBN-10 and -13 forms of one number agree), so an exact
    // string comparison here would wrongly refuse "81-7450-518-0" against a book recorded as "8174505180".
    const mismatch = selected ? undefined : parsed.find((p) => p.meta.isbn && p.meta.isbn !== isbn);
    if (mismatch) {
      await emitDone();
      return NextResponse.json(
        {
          success: false,
          error: `"${mismatch.file.name}" carries ISBN ${mismatch.meta.isbn} but this upload is for ${isbn}. ` +
            `Attaching a chapter to the wrong book is invisible once it is indexed.`,
        },
        { status: 422 },
      );
    }

    const localId = selected?.localId ?? ((formData.get('localId') as string | null)?.trim() || `isbn:${isbn}`);
    const workSourceApp: SourceApp = selected?.sourceApp ?? 'digiclassroom';
    const resolved = await resolveOrCreateContentItem({
      sourceApp: workSourceApp, sourceLocalId: localId, title, isbn, edition,
    });
    if (selected && resolved.contentItemId !== selected.id) {
      // Cannot happen while the reference points at the chosen work; if it ever does, storing the chapter under another
      // work would be the very mistake this lane is built to prevent, so stop.
      await emitDone();
      return NextResponse.json(
        { success: false, error: `Internal check failed: the chapter resolved to a different book than "${selected.title}". Nothing was stored.` },
        { status: 500 },
      );
    }
    const contentItemId = resolved.contentItemId;

    const { uploadContentAssetToR2 } = await import('@/lib/services/r2');
    await enhancedRAG.initialize();

    // ── Other renditions ─────────────────────────────────────────────────────
    const renditions: Array<{ role: string; partIndex: number; variant: string; assetId: string; storageUri: string }> = [];
    for (const a of assetFiles) {
      const buf = Buffer.from(await a.file.arrayBuffer());
      const ext = extOf(a.file.name);
      const name = a.role === 'source'
        ? `source.${ext}`
        : `${a.role}${a.partIndex ? `-${a.partIndex}` : ''}${a.variant !== 'default' ? `-${a.variant}` : ''}.${ext}`;
      const key = `content/${contentItemId}/${name}`;
      const { bucket } = await uploadContentAssetToR2({
        buffer: buf, key, contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
      });
      const { assetId } = await registerAsset({
        contentItemId, role: a.role, partIndex: a.partIndex, variant: a.variant,
        storageAccount: 'digiclassroom-pro', storageUri: `r2://${bucket}/${key}`,
        sha256: sha256(buf), bytes: buf.length,
      });
      renditions.push({ role: a.role, partIndex: a.partIndex, variant: a.variant, assetId, storageUri: `r2://${bucket}/${key}` });
    }

    // ── Each chapter ─────────────────────────────────────────────────────────
    const totalChunks = parsed.reduce((a, p) => a + p.chunks.length, 0);
    await emit(2, 3, `Embedding and indexing ${totalChunks} chunk(s)`);

    const results: PartOutcome[] = [];
    const allSkipped: string[] = [];
    const allWarnings: string[] = [];

    for (const p of parsed) {
      allSkipped.push(...p.skipped);
      allWarnings.push(...p.warnings);

      const key = `content/${contentItemId}/parts/${p.partIndex}.md`;
      let storageUri: string;
      try {
        // Uploaded BEFORE the slot is registered. An orphan object costs a few
        // kilobytes; a row pointing at bytes that do not exist is only
        // discoverable by trying to fetch one.
        const { bucket } = await uploadContentAssetToR2({
          buffer: p.buf, key, contentType: 'text/markdown; charset=utf-8',
        });
        storageUri = `r2://${bucket}/${key}`;
      } catch (err) {
        results.push({
          partIndex: p.partIndex, filename: p.file.name, outcome: 'failed',
          detail: `Could not store the chapter file: ${err instanceof Error ? err.message : String(err)}`,
          chunks: 0, points: 0,
        });
        continue;
      }

      const pages = [...new Set(p.chunks.map((c: any) => c.metadata.page as number))].sort((a, b) => a - b);

      let result: SpineIngestResult;
      try {
        result = await enhancedRAG.ingestPart({
          sourceApp: workSourceApp,
          sourceLocalId: localId,
          contentTitle: title,
          // The chosen book's own ISBN and edition, exactly as recorded: the pipeline compares them as plain strings,
          // and a file that writes the same ISBN with different hyphens must not be refused as a different book.
          isbn: selected ? isbn : p.meta.isbn ?? isbn,
          edition: selected ? edition : p.meta.edition ?? edition,
          lang: p.meta.medium ?? null,
          organizationId,
          // `force` reaches the pipeline, not just the validation gate.
          // Without this it only relaxed the validation_status check, so a
          // forced re-upload of unchanged bytes still short-circuited on
          // "byte-identical and already live" and re-indexed nothing — which
          // made re-embedding after a chunker fix impossible.
          force,
          part: {
            role: 'enriched_md',
            partIndex: p.partIndex,
            partLabel: p.meta.chapter_title
              ? `Chapter ${p.meta.chapter_number}: ${p.meta.chapter_title}`
              : `Part ${p.partIndex}`,
            variant: 'default',
            sha256: p.sha,
            storageAccount: 'digiclassroom-pro',
            storageUri,
            bytes: p.buf.length,
            pageCount: pages.length,
          },
          chunks: p.chunks.map((c: any) => ({
            text: c.text,
            pageStart: c.metadata.pageNumber ?? c.metadata.page ?? null,
            pageEnd: c.metadata.pageEndNumber ?? c.metadata.pageNumber ?? null,
            chapter: c.metadata.chapter ?? null,
            retrievalClass: c.retrieval_class,
            metadata: c.metadata,
          })),
        });
      } catch (err) {
        results.push({
          partIndex: p.partIndex, filename: p.file.name, outcome: 'failed',
          detail: err instanceof Error ? err.message : String(err), chunks: 0, points: 0,
        });
        continue;
      }

      results.push({
        partIndex: p.partIndex,
        filename: p.file.name,
        outcome: result.status === 'indexed' ? 'succeeded'
          : result.status === 'skipped_unchanged' ? 'skipped-as-duplicate'
          : 'failed',
        detail: result.reason ?? undefined,
        chunks: result.chunksWritten,
        points: result.pointsUpserted,
        pages: pages.length ? `${pages[0]}-${pages[pages.length - 1]}` : undefined,
        warnings: p.warnings.length ? p.warnings : undefined,
      });

      if (force && result.ingestRunId) {
        // Recorded ON THE RUN, so "what is live that never passed its gates" is
        // a query rather than an archaeology exercise.
        try {
          const { getContentPool } = await import('@/lib/db/content-connection');
          await getContentPool().query(
            `UPDATE content.ingest_run SET forced = true, force_reason = $2 WHERE id = $1`,
            [result.ingestRunId, forceReason ?? 'forced from the upload console'],
          );
        } catch (e) {
          console.warn('⚠️ could not record the force flag on the run:', e);
        }
      }
    }

    await emitDone();

    const failed = results.filter((r) => r.outcome === 'failed');
    const succeeded = results.filter((r) => r.outcome === 'succeeded').length;
    const duplicate = results.filter((r) => r.outcome === 'skipped-as-duplicate').length;
    const pagesAll = new Set(parsed.flatMap((p) => p.chunks.map((c: any) => c.metadata.page)));
    const totalWords = parsed.reduce(
      (a, p) => a + p.chunks.reduce((n: number, c: any) => n + (c.text ? c.text.split(/\s+/).length : 0), 0), 0,
    );

    return NextResponse.json(
      {
        success: failed.length === 0,
        message: failed.length === 0
          ? `${succeeded} chapter(s) indexed${duplicate ? `, ${duplicate} unchanged and skipped` : ''} — "${title}"`
          : `${failed.length} of ${results.length} chapter(s) failed`,
        // The console's existing result panel reads these.
        stats: {
          totalPages: pagesAll.size,
          totalChunks,
          totalWords,
          uploadedChunks: results.reduce((a, r) => a + r.chunks, 0),
          processingTime: Date.now() - startedAt,
        },
        extractionMethod: 'curated-markdown (embedded_text) → shared content spine',
        errors: failed.map((f) => `${f.filename}: ${f.detail ?? 'failed'}`),
        skipped: allSkipped,
        warnings: allWarnings,
        // The spine detail, for anything that wants more than a summary.
        work: { contentItemId, title, isbn, edition, matchedBy: resolved.matchedBy, chosen: selected !== null },
        renditions,
        parts: results,
        totals: {
          chapters: results.length, succeeded, skippedAsDuplicate: duplicate, failed: failed.length,
          points: results.reduce((a, r) => a + r.points, 0),
        },
      },
      { status: failed.length === 0 ? 200 : 207 },
    );
  } catch (error) {
    console.error('❌ Markdown ingest failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Ingest failed' },
      { status: 500 },
    );
  }
}
