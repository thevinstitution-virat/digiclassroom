const { PDFExtractKitProcessor } = require('../../lib/content/pdf-extract-kit-processor')

/**
 * Unit tests for doc-extract-engine normalization and stats backfill
 */

describe('doc-extract-engine normalizer', () => {
  const metadata = {
    classLevel: 'IX',
    subject: 'Science',
    bookTitle: 'NCERT Science Class 9',
    curriculum: 'CBSE',
    language: 'eng'
  }

  test('normalizes raw engine output and backfills missing stats', () => {
    const raw = {
      success: true,
      chunks: [
        { id: 'c1', text: 'Table: Data A', metadata: { page: 1, content_type: 'table', confidence: 0.95 } },
        { id: 'c2', text: 'E = mc^2', metadata: { page: 1, content_type: 'equation', confidence: 0.9 } },
        { id: 'c3', text: 'Figure 1: Diagram', metadata: { page: 2, content_type: 'figure', confidence: 0.92 } },
        { id: 'c4', text: 'This is some normal paragraph content with multiple words.', metadata: { page: 2, content_type: 'text', confidence: 0.93 } }
      ],
      document_structure: { title: 'NCERT Science Class 9', chapters: [] },
      stats: { total_pages: 2 },
      errors: []
    }

    const processor = new PDFExtractKitProcessor({ enabled: true })
    const result = processor.normalizeDocExtractResult(raw, metadata, 'sample.pdf')

    expect(result.success).toBe(true)
    expect(result.chunks.length).toBe(4)

    // Metadata fallbacks
    for (const ch of result.chunks) {
      expect(ch.metadata.class).toBe('IX')
      expect(ch.metadata.subject).toBe('Science')
      expect(ch.metadata.source).toBe('NCERT Science Class 9')
      expect(ch.metadata.curriculum).toBe('CBSE')
    }

    // Backfilled stats
    expect(result.stats.total_chunks).toBe(4)
    expect(result.stats.total_pages).toBe(2)
    expect(result.stats.total_words).toBeGreaterThan(0)
    // Visual counts inferred from content_type
    expect(result.stats.tables_found).toBe(1)
    expect(result.stats.equations_found).toBe(1)
    expect(result.stats.figures_found).toBe(1)

    // Extraction method label set
    expect(result.stats.extraction_method).toBe('doc-extract-engine')
  })

  test('preserves provided visual-element counts in stats', () => {
    const raw = {
      success: true,
      chunks: [
        { id: 'c1', text: 'Text A', metadata: { page: 1, content_type: 'text', confidence: 0.95 } }
      ],
      stats: {
        total_pages: 1,
        total_chunks: 1,
        total_words: 2,
        tables_found: 5,
        equations_found: 6,
        figures_found: 7
      },
      errors: []
    }

    const processor = new PDFExtractKitProcessor({ enabled: true })
    const result = processor.normalizeDocExtractResult(raw, metadata, 'sample.pdf')

    expect(result.stats.total_chunks).toBe(1)
    expect(result.stats.tables_found).toBe(5)
    expect(result.stats.equations_found).toBe(6)
    expect(result.stats.figures_found).toBe(7)
  })
})

