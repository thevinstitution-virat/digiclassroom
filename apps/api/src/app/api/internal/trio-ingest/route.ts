import { NextRequest, NextResponse } from 'next/server'
import { enhancedRAG } from '@/lib/ai/rag/enhanced-rag-pipeline'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

/**
 * POST /api/internal/trio-ingest
 *
 * Service-to-service ingestion endpoint — lets another trio app (currently just
 * PDLMS's thin upload proxy) hand DCP a file to process, instead of going through
 * the human-auth-gated /api/super-admin/content/upload route. Auth is a shared
 * secret (TRIO_SERVICE_SECRET, set identically on both apps' backends in Coolify),
 * not a user session — there is no logged-in user on this path.
 *
 * Requires sourceApp/sourceLocalId (unlike the super-admin route, where they're
 * optional) — every request here is registering content in the shared identity
 * model on behalf of a specific app+local record, not DCP's own untagged ingestion.
 */
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
    const file = formData.get('file') as File
    const domain = formData.get('domain') as string
    const course = formData.get('course') as string
    const level = formData.get('level') as string
    const subjectGroup = formData.get('subject') as string
    const book = formData.get('book') as string
    const medium = formData.get('medium') as string
    const bookTitle = formData.get('bookTitle') as string
    const sourceApp = formData.get('sourceApp') as string
    const sourceLocalId = formData.get('sourceLocalId') as string

    if (!file || !bookTitle || !sourceApp || !sourceLocalId) {
      return NextResponse.json(
        { success: false, error: 'file, bookTitle, sourceApp, and sourceLocalId are all required' },
        { status: 400 },
      )
    }
    if (!['pdlms', 'vidyaverse', 'digiclassroom'].includes(sourceApp)) {
      return NextResponse.json({ success: false, error: `Invalid sourceApp: ${sourceApp}` }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'Only PDF files are supported' }, { status: 400 })
    }
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, error: 'File size exceeds 50MB limit' }, { status: 400 })
    }

    console.log(`📚 trio-ingest: ${bookTitle} on behalf of ${sourceApp}:${sourceLocalId}`)

    let tempFilePath: string | null = null
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = `${uuidv4()}_${file.name}`
      tempFilePath = join(process.cwd(), 'tmp', fileName)
      const fs = await import('fs/promises')
      await fs.mkdir(join(process.cwd(), 'tmp'), { recursive: true })
      await writeFile(tempFilePath, buffer)

      const metadata = {
        subject: book || bookTitle,
        subjectGroup: subjectGroup || 'Unknown',
        domain: domain || 'Unknown',
        course: course || 'Unknown',
        level: level || 'Unknown',
        book: book || bookTitle,
        bookTitle,
        classLevel: level || 'Unknown',
        curriculum: course || 'Unknown',
        board: course || 'Unknown',
        language: medium || 'Unknown',
        medium: medium || 'Unknown',
      }

      await enhancedRAG.initialize()
      const result = await enhancedRAG.indexPDF(buffer, metadata, file.name, {
        sourceApp: sourceApp as any,
        sourceLocalId,
        contentTitle: bookTitle,
      })

      if (!result.success) {
        throw new Error(`Ingestion failed: ${result.errors.join(', ')}`)
      }

      return NextResponse.json({
        success: true,
        contentItemId: result.contentItemId,
        chunksIndexed: result.chunks_indexed,
        stats: result.stats,
        validationStats: result.validationStats,
      })
    } finally {
      if (tempFilePath) {
        try {
          await unlink(tempFilePath)
        } catch (error) {
          console.warn('Failed to clean up temporary file:', error)
        }
      }
    }
  } catch (error) {
    console.error('❌ trio-ingest failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Ingestion failed' },
      { status: 500 },
    )
  }
}
