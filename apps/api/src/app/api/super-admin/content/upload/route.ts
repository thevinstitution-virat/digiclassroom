import { auth } from '@/auth';
import { isPlatformStaff, type Role } from '@/auth/permissions';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
// 🔧 TEMPORARY FIX: Revert to working system while debugging infinite loop
import { enhancedRAG } from '@/lib/ai/rag/enhanced-rag-pipeline'
// Simplified architecture: doc-extract-engine only
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

/**
 * Normalize class level to Arabic numbers for consistent storage
 * Converts "Class IX" → "9", "Class 9" → "9", etc.
 */
function normalizeClassLevel(classLevel: string): string {
  if (!classLevel)
  return classLevel;

  const romanToArabic: { [key: string]: string } = {
    'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
    'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10',
    'XI': '11', 'XII': '12'
  };

  // Extract Roman numeral (e.g., "Class IX" → "IX")
  const romanMatch = classLevel.match(/\b([IVX]+)\b/);
  if (romanMatch && romanToArabic[romanMatch[1]]) {
    console.log(`📝 Normalized class: "${classLevel}" → "${romanToArabic[romanMatch[1]]}"`);
    return romanToArabic[romanMatch[1]];
  }

  // Extract Arabic number (e.g., "Class 9" → "9")
  const numberMatch = classLevel.match(/(\d+)/);
  if (numberMatch) {
    console.log(`📝 Normalized class: "${classLevel}" → "${numberMatch[1]}"`);
    return numberMatch[1];
  }

  console.log(`⚠️ Could not normalize class: "${classLevel}"`);
  return classLevel;
}

/**
 * POST /api/super-admin/content/upload
 * Enhanced PDF upload with Docling processing and Qdrant indexing
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = session?.user?.role
    if (!isPlatformStaff((userRole ?? '') as Role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Parse form data — new content hierarchy:
    // domain → course → level → subject (umbrella) → book (leaf) → medium → title
    const formData = await request.formData()
    const file = formData.get('file') as File
    const domain = formData.get('domain') as string
    const course = formData.get('course') as string
    const level = formData.get('level') as string
    const subjectGroup = formData.get('subject') as string   // umbrella, e.g. "Social Science"
    const book = formData.get('book') as string              // leaf, e.g. "Economics"
    const medium = formData.get('medium') as string
    const bookTitle = formData.get('bookTitle') as string
    const uploadId = (formData.get('uploadId') as string) || undefined
    // Optional: scope this content to a specific institution's vectors.
    // Omitted = global content (NCERT base), readable by every org.
    const organizationId = (formData.get('organizationId') as string) || undefined
    console.log(`📋 Upload Route: Received uploadId: ${uploadId}`);

    // CRITICAL: Create progress emitter BEFORE processing starts to avoid race condition
    if (uploadId) {
      try {
        const { getProgressEmitter } = await import('@/lib/utils/progress-bus');
        getProgressEmitter(uploadId); // Create emitter early
        console.log(`✅ Upload Route: Progress emitter pre-created for ${uploadId}`);
      } catch (error) {
        console.warn(`⚠️ Upload Route: Failed to create progress emitter:`, error);
      }
    }

    // Clean up any stuck processes before starting new upload
    if (uploadId) {
      try {
        const { cleanupAllStuckProcesses } = await import('@/lib/utils/upload-process-manager');
        const cleanup = await cleanupAllStuckProcesses();
        if (cleanup.cleaned.length > 0) {
          console.log(`🧹 Upload Route: Cleaned up ${cleanup.cleaned.length} stuck processes: ${cleanup.cleaned.join(', ')}`);
        }
      } catch (error) {
        console.warn(`⚠️ Upload Route: Cleanup failed:`, error);
      }
    }

    if (!file || !domain || !course || !level || !subjectGroup || !book || !medium || !bookTitle) {
      return NextResponse.json(
        { success: false, error: 'File, domain, course, level, subject, book, medium, and book title are all required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    console.log(`📚 Starting enhanced upload for: ${file.name}`)
    console.log(`📋 Hierarchy: ${domain} / ${course} / ${level} / ${subjectGroup} > ${book} (${medium}) - ${bookTitle}`)

    let tempFilePath: string | null = null

    try {
      // Create temporary file
      const buffer = Buffer.from(await file.arrayBuffer())

      // Hash in memory, before anything else touches the file. The hash is what
      // decides whether this is a new book or one we already hold, and that
      // decision has to happen before the R2 upload and before embedding — a
      // duplicate should cost neither storage nor OpenAI tokens.
      const { createHash } = await import('crypto')
      const sha256 = createHash('sha256').update(buffer).digest('hex')
      console.log(`🔑 Source sha256: ${sha256}`)

      const fileName = `${uuidv4()}_${file.name}`
      tempFilePath = join(process.cwd(), 'tmp', fileName)

      // Ensure tmp directory exists
      await ensureTmpDirectory()

      // Write file to disk
      await writeFile(tempFilePath, buffer)

      // Prepare metadata for enhanced processing with normalization.
      // Mapping rationale (see content-taxonomy.ts): the tutor retrieves by the
      // LEAF the student studies, which is `book` — so the searchable `subject`
      // payload = book, and the umbrella subject is preserved as `subjectGroup`.
      const normalizedClassLevel = normalizeClassLevel(level);
      const metadata = {
        // Searchable leaf (e.g. "Economics") — what the AI tutor filters on
        subject: book,
        // Umbrella subject (e.g. "Social Science")
        subjectGroup,
        // Full content hierarchy (human-readable labels)
        domain,
        course,
        level,
        book,
        bookTitle,
        // Legacy/compat fields consumed by existing retrieval + payload builder
        classLevel: normalizedClassLevel,  // Arabic number (e.g., "9")
        curriculum: course,                // board === course in the new model
        board: course,
        language: medium,
        medium
      }

      console.log(`📝 Level normalization: "${level}" → "${normalizedClassLevel}"`);

      // Always use doc-extract-engine for all document processing
      console.log('🚀 Using doc-extract-engine Pipeline (Single-Tier Processing)')

      try {
        // Initialize enhanced RAG if needed
        await enhancedRAG.initialize()

        // Process with doc-extract-engine (simplified single-tier processing)
        console.log(`🚀 Upload Route: Starting PDF processing with uploadId: ${uploadId}`);
        const result = await enhancedRAG.indexPDF(buffer, metadata, file.name, {
          uploadId,
          organizationId,
          sourceFile: {
            buffer,
            contentType: file.type,
            sha256,
            bytes: file.size,
          },
        })

          // Identical file already held. Say so explicitly rather than returning a
          // generic success — the user uploaded a book and is entitled to know it
          // was linked to an existing one, not freshly processed. A silent
          // "success, 0 chunks" reads as a broken upload.
          if ((result as any).deduped) {
            if (uploadId) {
              try {
                const { emitEnd } = await import('@/lib/utils/progress-bus');
                emitEnd(uploadId);
              } catch (error) {
                console.warn(`⚠️ Upload Route: Failed to emit end event:`, error);
              }
            }
            return NextResponse.json({
              success: true,
              deduped: true,
              message:
                'This exact file is already in the library. It has been linked to the existing book — no re-processing was needed.',
              contentItemId: (result as any).contentItemId,
              stats: { totalChunks: 0, uploadedChunks: 0 },
            })
          }

          if (result.success) {
            console.log(`✅ doc-extract-engine processing completed: ${result.chunks_indexed} chunks indexed`)

            // Emit end event now that indexing is complete
            if (uploadId) {
              try {
                const { emitEnd } = await import('@/lib/utils/progress-bus');
                emitEnd(uploadId);
                console.log(`🏁 Upload Route: Emitted end event for uploadId: ${uploadId}`);
              } catch (error) {
                console.warn(`⚠️ Upload Route: Failed to emit end event:`, error);
              }
            }

            return NextResponse.json({
              success: true,
              message: 'PDF processed successfully with doc-extract-engine',
              stats: {
                totalPages: result.stats?.total_pages || 0,
                totalChunks: result.stats?.total_chunks || result.chunks_indexed,
                totalWords: result.stats?.total_words || 0,
                uploadedChunks: result.chunks_indexed,
                processingTime: result.stats?.processing_time || 0
              },
              extractionMethod: result.stats?.extraction_method || 'doc-extract-engine + Qdrant',
              errors: result.errors,
              additionalStats: result.stats ? {
                tablesFound: result.stats.tables_found,
                equationsFound: result.stats.equations_found,
                figuresFound: result.stats.figures_found
              } : undefined,
              // PHASE 3: Include validation statistics
              validationStats: result.validationStats,
              strategy: result.strategy
            })
          } else {
            throw new Error(`doc-extract-engine processing failed: ${result.errors.join(', ')}`)
          }

        } catch (error) {
          console.error('❌ doc-extract-engine processing failed:', error)

          // Emit end event on error too
          if (uploadId) {
            try {
              const { emitEnd } = await import('@/lib/utils/progress-bus');
              emitEnd(uploadId);
            } catch {}
          }

          throw error // Re-throw error instead of falling back
        }

    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        try {
          await unlink(tempFilePath)
        } catch (error) {
          console.warn('Failed to clean up temporary file:', error)
        }
      }
    }

  } catch (error) {
    console.error('❌ Content upload failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed',
        message: 'Failed to process PDF'
      },
      { status: 500 }
    )
  }
}

// Advanced processing function removed to fix infinite loop
// Will be re-implemented with proper safeguards

/**
 * Ensure tmp directory exists
 */
async function ensureTmpDirectory() {
  const tmpDir = join(process.cwd(), 'tmp')
  try {
    const fs = await import('fs/promises')
    await fs.mkdir(tmpDir, { recursive: true })
  } catch (error) {
    // Directory might already exist, ignore error
  }
}
