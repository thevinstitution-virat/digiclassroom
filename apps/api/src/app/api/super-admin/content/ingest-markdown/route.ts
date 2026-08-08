import { auth } from '@/auth';
import { isPlatformStaff, type Role } from '@/auth/permissions';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { enhancedRAG } from '@/lib/ai/rag/enhanced-rag-pipeline';
import { parseEnrichedMarkdown } from '@/lib/content/markdown-ingest-parser';

/**
 * POST /api/super-admin/content/ingest-markdown
 *
 * CURATED LANE — ingest a human-validated, skill-produced enriched markdown
 * chapter file straight into the vector store. No PDF-Extract-Kit / OCR: the
 * markdown already carries clean text, printed page numbers (exact citations),
 * chapter/section structure, and typed content blocks.
 *
 * Guardrails:
 *   - platform-staff only
 *   - refuses any file whose frontmatter validation_status !== APPROVED
 *     (unless force=true is explicitly passed)
 */
/**
 * TEMPORARY: this lane is closed until it is wired to the shared content spine.
 *
 * It writes chunks and vectors but NO content_item, content_chunk, content_asset
 * or ingest_run — it never opens a shared run at all. The points it produces
 * therefore carry no content_item_id, visibility, level or run_id, which means:
 *
 *   - Varta cannot see them (it filters on exactly those fields)
 *   - no ingest_run tracks them, so no supersede can ever collect them
 *   - the run-close guard requiring a role='source' asset never fires, because
 *     there is no run to close
 *
 * Until today this failed safe by accident: the write path used vector names the
 * collection does not define, so every upsert was rejected. Fixing the vector
 * names and enabling ENABLE_HYBRID_SEARCH removed that accidental brake — this
 * lane would now succeed at writing permanently-orphaned points into the shared
 * collection, and identifying them afterwards means searching for the ABSENCE of
 * a field.
 *
 * Remove this block in the same change that routes this lane through
 * beginSharedContentRun / finalizeSharedContentRun.
 */
const MARKDOWN_LANE_WIRED = false;

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!isPlatformStaff((session.user.role ?? '') as Role)) {
      return NextResponse.json({ success: false, error: 'Forbidden. Admin access required.' }, { status: 403 });
    }

    // Closed until wired — see MARKDOWN_LANE_WIRED above. Refuses BEFORE reading
    // the upload, so nothing is parsed, embedded, or written.
    if (!MARKDOWN_LANE_WIRED) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The enriched-markdown lane is temporarily closed. It is not yet connected to the shared ' +
            'content library: it would index your chapter for iTutor but register no book, no chapters ' +
            'and no source file, so Varta could never find it and the content could not be corrected ' +
            'or removed later. Use the PDF lane meanwhile, or wait for the markdown lane to be wired.',
          code: 'MARKDOWN_LANE_NOT_WIRED',
        },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const uploadId = (formData.get('uploadId') as string) || undefined;
    const organizationId = (formData.get('organizationId') as string) || undefined;
    const force = (formData.get('force') as string) === 'true';

    if (!file) {
      return NextResponse.json({ success: false, error: 'A markdown (.md) file is required' }, { status: 400 });
    }
    const isMd = file.name.toLowerCase().endsWith('.md') || /markdown|text\/plain/.test(file.type || '');
    if (!isMd) {
      return NextResponse.json({ success: false, error: 'Only enriched Markdown (.md) files are supported on this lane' }, { status: 400 });
    }
    // 5MB is plenty for a single chapter of text.
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File exceeds 5MB' }, { status: 400 });
    }

    // Pre-create the progress emitter (parity with the PDF lane's SSE).
    if (uploadId) {
      try {
        const { getProgressEmitter, emitProgress } = await import('@/lib/utils/progress-bus');
        getProgressEmitter(uploadId);
        emitProgress(uploadId, 1, 3, 'Parsing enriched markdown');
      } catch (e) {
        console.warn('⚠️ ingest-markdown: progress emitter setup failed:', e);
      }
    }

    const md = await file.text();
    const { meta, chunks, skipped, warnings } = parseEnrichedMarkdown(md);

    // Fallback/Override metadata from formData
    const formBookTitle = (formData.get('bookTitle') as string) || undefined;
    const formClassLevel = (formData.get('classLevel') as string) || undefined;
    const formSubject = (formData.get('subject') as string) || undefined;
    const formBoard = (formData.get('board') as string) || undefined;
    const formMedium = (formData.get('medium') as string) || undefined;

    if (formBookTitle) meta.book_title = formBookTitle;
    if (formSubject) meta.subject = formSubject;
    if (formClassLevel) meta.class_level = formClassLevel;
    if (formBoard) meta.board = formBoard;
    if (formMedium) meta.medium = formMedium;

    // Ensure all chunks carry valid metadata so Zod validation and Qdrant filtering pass
    for (const chunk of chunks) {
      if (!chunk.metadata) {
        chunk.metadata = {};
      }
      if (meta.book_title) {
        chunk.metadata.book_title = meta.book_title;
        chunk.metadata.bookTitle = meta.book_title;
      }
      if (meta.subject) {
        chunk.metadata.subject = meta.subject;
      }
      if (meta.class_level) {
        chunk.metadata.class = meta.class_level;
        chunk.metadata.classLevel = meta.class_level;
      }
      if (meta.board) {
        chunk.metadata.board = meta.board;
      }
      if (meta.medium) {
        chunk.metadata.medium = meta.medium;
      }
    }

    // Validation-status guard.
    if (meta.validation_status !== 'APPROVED' && !force) {
      return NextResponse.json({
        success: false,
        error: `Refusing to index: validation_status is "${meta.validation_status}", not APPROVED. ` +
          `Have the chapter human-validated first, or re-submit with force to override.`,
        meta,
      }, { status: 422 });
    }

    if (!meta.book_title || !meta.subject || !meta.class_level) {
      return NextResponse.json({
        success: false,
        error: 'Frontmatter is missing required BOOK_METADATA (book_title, subject, class_level). Fill in form metadata or frontmatter.',
        warnings,
      }, { status: 422 });
    }

    if (chunks.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No indexable chunks found. Check the PAGE/SECTION markers and content blocks.',
        warnings,
      }, { status: 422 });
    }

    // Parsing correctness gate for multi-page block declarations
    for (const chunk of chunks) {
      const rawBlockText = chunk.text || '';
      const rangeMatch = rawBlockText.match(/\bPage\s+(\d+)\s*[-–—]\s*(\d+)/i);
      if (rangeMatch) {
        const expectedStart = parseInt(rangeMatch[1], 10);
        const expectedEnd = parseInt(rangeMatch[2], 10);
        const actualStart = chunk.metadata.pageNumber;
        const actualEnd = chunk.metadata.pageEndNumber;

        if (actualStart !== expectedStart || actualEnd !== expectedEnd) {
          return NextResponse.json({
            success: false,
            error: `Block declares a page range ("Page ${expectedStart}-${expectedEnd}") but parser captured ("Page ${actualStart}-${actualEnd}"). Check regex/em-dash handling before ingesting.`
          }, { status: 422 });
        }
      }
    }

    if (uploadId) {
      try {
        const { emitProgress } = await import('@/lib/utils/progress-bus');
        emitProgress(uploadId, 2, 3, `Embedding ${chunks.length} chunks`);
      } catch {}
    }

    await enhancedRAG.initialize();
    const result = await enhancedRAG.indexMarkdownChunks(chunks, { organizationId, materialId: null });

    if (uploadId) {
      try {
        const { emitEnd } = await import('@/lib/utils/progress-bus');
        emitEnd(uploadId);
      } catch {}
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: `Indexing failed: ${result.errors.join(', ') || 'no chunks indexed'}`,
        skipped,
        warnings,
      }, { status: 500 });
    }

    const totalWords = chunks.reduce((acc, c) => acc + (c.text ? c.text.split(/\s+/).length : 0), 0);
    const pagesSet = new Set(chunks.map(c => c.metadata?.page).filter(Boolean));

    return NextResponse.json({
      success: true,
      message: 'Enriched markdown indexed successfully',
      book: {
        title: meta.book_title,
        subject: meta.subject,
        classLevel: meta.class_level,
        board: meta.board,
        medium: meta.medium,
        chapter: meta.chapter_number ? `Chapter ${meta.chapter_number}: ${meta.chapter_title}` : meta.chapter_title,
        validatedBy: meta.validated_by,
      },
      stats: {
        totalChunks: chunks.length,
        uploadedChunks: result.chunks_indexed,
        totalWords,
        totalPages: pagesSet.size || 1,
        processingTime: Date.now() - ((globalThis as any).__ingestStartTime || Date.now()),
        validationRate: result.validationStats.validationRate,
        skippedCount: skipped.length,
      },
      extractionMethod: 'curated-markdown (embedded_text)',
      skipped,          // audit trail: SKIP blocks + UNCLEAR flags for reviewer
      warnings,
      validationStats: result.validationStats,
    });
  } catch (error) {
    console.error('❌ Markdown ingest failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Ingest failed' },
      { status: 500 }
    );
  }
}
