import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { enhancedRAG, type SpineIngestResult } from '@/lib/ai/rag/enhanced-rag-pipeline'
import { parseEnrichedMarkdown } from '@/lib/content/markdown-ingest-parser'
import { resolveOrCreateContentItem } from '@/lib/db/content-identity'

/**
 * POST /api/internal/trio-ingest
 *
 * Service-to-service ingestion — lets another trio app hand DCP a chapter to
 * process without a logged-in user. Auth is a shared secret
 * (TRIO_SERVICE_SECRET, set identically on both backends in Coolify).
 *
 * `sourceApp` + `sourceLocalId` are required here, unlike the human console:
 * every request registers content on behalf of a specific app's local record.
 * That pair becomes `content.content_source_ref`, and it is the ONLY thing that
 * ties a PDLMS `Book` row to a canonical work — which is what lets Varta scope a
 * book-chat question to the right book instead of refusing.
 *
 * ENRICHED MARKDOWN, NOT PDF. This used to call `indexPDF`, which refuses
 * unless ENABLE_PDF_EXTRACT_LANE=true; that lane spawns a Python toolchain that
 * exists on no deployed host, so every call through here failed at the last step
 * after uploading and buffering the whole file. Chapters reach the spine as
 * human-validated markdown carrying the PRINTED page numbers, which is what
 * makes citations exact — a PDF would have to be OCR'd back into worse text.
 */

const MAX_BYTES = 5 * 1024 * 1024
const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex')

export async function POST(request: NextRequest) {
  const providedSecret = request.headers.get('x-trio-service-secret')
  const expectedSecret = process.env.TRIO_SERVICE_SECRET
  if (!expectedSecret) {
    console.error('❌ trio-ingest: TRIO_SERVICE_SECRET is not configured on this backend')
    return NextResponse.json({ success: false, error: 'Service not configured' }, { status: 503 })
  }
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sourceApp = formData.get('sourceApp') as string
    const sourceLocalId = formData.get('sourceLocalId') as string
    const bookTitle = (formData.get('bookTitle') as string | null)?.trim() || ''
    // The calling app's own ISBN. `resolveOrCreateContentItem` keys identity on
    // (isbn, edition), so a chapter ingested without one creates a work nothing
    // can ever match by ISBN again — the same book uploaded twice becomes two
    // works, and neither is wrong enough to look wrong. PDLMS holds an ISBN on
    // the Book row that the frontmatter may not repeat, so it can supply it.
    const isbnOverride = (formData.get('isbn') as string | null)?.trim() || null
    const organizationId = (formData.get('organizationId') as string | null)?.trim() || null
    const force = (formData.get('force') as string) === 'true'
    const partOverride = formData.get('partIndex') as string | null

    if (!file || !sourceApp || !sourceLocalId) {
      return NextResponse.json(
        { success: false, error: 'file, sourceApp and sourceLocalId are all required' },
        { status: 400 },
      )
    }
    if (!['pdlms', 'vidyaverse', 'digiclassroom'].includes(sourceApp)) {
      return NextResponse.json({ success: false, error: `Invalid sourceApp: ${sourceApp}` }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'File exceeds 5MB' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.md')) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This lane takes enriched Markdown (.md), not PDFs. The PDF extraction lane is ' +
            'disabled on every deployed host — it spawns a Python toolchain that is not in the ' +
            'image — so a PDF here would fail after the upload rather than before it. Attach the ' +
            "book's PDF as a reader rendition; send the validated markdown for retrieval.",
          code: 'MARKDOWN_REQUIRED',
        },
        { status: 415 },
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const { meta, chunks, warnings, errors, skipped } = parseEnrichedMarkdown(buf.toString('utf8'))

    if (errors.length > 0) {
      return NextResponse.json({ success: false, error: 'Parser refused the chapter', errors, warnings }, { status: 422 })
    }
    if (meta.validation_status !== 'APPROVED' && !force) {
      return NextResponse.json(
        {
          success: false,
          error: `validation_status is "${meta.validation_status}", not APPROVED — a human has to ` +
            `confirm the transcription matches the printed page before it becomes citable.`,
        },
        { status: 422 },
      )
    }
    if (chunks.length === 0) {
      return NextResponse.json({ success: false, error: 'No indexable chunks — check PAGE/SECTION markers', warnings }, { status: 422 })
    }

    const partIndex = partOverride ? parseInt(partOverride, 10) : parseInt(String(meta.chapter_number ?? ''), 10)
    if (!Number.isFinite(partIndex) || partIndex < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'No usable chapter number, so there is no slot to put this in. part_index orders ' +
            'the chapters of a book and 0 is reserved for the whole work.',
        },
        { status: 422 },
      )
    }

    const title = bookTitle || meta.book_title || ''
    const isbn = isbnOverride ?? meta.isbn ?? null
    if (!title) {
      return NextResponse.json({ success: false, error: 'No book title, in the request or the frontmatter' }, { status: 422 })
    }
    // Both sides claiming a DIFFERENT ISBN means the caller has attached this
    // chapter to the wrong book, which is invisible once it is indexed: the text
    // is right, the citations are right, and it answers as a different book.
    // Cheap to refuse here, near-impossible to notice later.
    if (isbnOverride && meta.isbn && isbnOverride !== meta.isbn) {
      return NextResponse.json(
        {
          success: false,
          error:
            `ISBN mismatch: the request says ${isbnOverride} but the chapter's frontmatter says ` +
            `${meta.isbn}. One of them belongs to a different book — attaching a chapter to the ` +
            `wrong work cannot be detected once it is indexed.`,
        },
        { status: 422 },
      )
    }

    console.log(`📚 trio-ingest: "${title}" part ${partIndex} on behalf of ${sourceApp}:${sourceLocalId}`)

    // Resolve identity FIRST so the R2 key is under the canonical work, and so
    // content_source_ref(app, local_id) exists even if the embed step later
    // fails — that row is what the calling app needs to find this work again.
    const resolved = await resolveOrCreateContentItem({
      sourceApp: sourceApp as 'pdlms' | 'vidyaverse' | 'digiclassroom',
      sourceLocalId,
      title,
      isbn,
      edition: meta.edition ?? null,
    })
    const contentItemId = resolved.contentItemId

    const { uploadContentAssetToR2 } = await import('@/lib/services/r2')
    const key = `content/${contentItemId}/parts/${partIndex}.md`
    const { bucket } = await uploadContentAssetToR2({
      buffer: buf, key, contentType: 'text/markdown; charset=utf-8',
    })

    await enhancedRAG.initialize()

    const pages = [...new Set(chunks.map((c: any) => c.metadata.page as number))].sort((a, b) => a - b)
    let result: SpineIngestResult
    try {
      result = await enhancedRAG.ingestPart({
        sourceApp: sourceApp as 'pdlms' | 'vidyaverse' | 'digiclassroom',
        sourceLocalId,
        contentTitle: title,
        // The RESOLVED isbn, not the frontmatter's: identity was already settled
        // above, and passing a different value here would have the run disagree
        // with the work it belongs to.
        isbn: isbn ?? undefined,
        edition: meta.edition ?? null,
        lang: meta.medium ?? null,
        organizationId,
        part: {
          role: 'enriched_md',
          partIndex,
          partLabel: meta.chapter_title ? `Chapter ${meta.chapter_number}: ${meta.chapter_title}` : `Part ${partIndex}`,
          variant: 'default',
          sha256: sha256(buf),
          storageAccount: 'digiclassroom-pro',
          storageUri: `r2://${bucket}/${key}`,
          bytes: buf.length,
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
      })
    } catch (err) {
      return NextResponse.json(
        { success: false, error: err instanceof Error ? err.message : 'Ingest failed', contentItemId },
        { status: 500 },
      )
    }

    if (result.status === 'failed') {
      return NextResponse.json(
        { success: false, error: result.reason ?? 'Ingest failed', contentItemId },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      contentItemId,
      // The caller records this: it is how a PDLMS Book row finds its work again.
      sourceRef: { app: sourceApp, localId: sourceLocalId, matchedBy: resolved.matchedBy },
      partIndex,
      status: result.status,               // 'indexed' | 'skipped_unchanged'
      chunksIndexed: result.chunksWritten,
      pointsUpserted: result.pointsUpserted,
      pages: pages.length ? `${pages[0]}-${pages[pages.length - 1]}` : null,
      skipped,
      warnings,
    })
  } catch (error) {
    console.error('❌ trio-ingest failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Ingestion failed' },
      { status: 500 },
    )
  }
}
