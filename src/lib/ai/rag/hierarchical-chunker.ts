export interface HierarchicalChunk {
  id: string
  text: string
  metadata: Record<string, unknown>
}

interface RawChunk {
  id?: string
  text?: string
  content?: string
  metadata?: Record<string, unknown>
}

/**
 * Convert raw doc-extract chunks into paragraph-level chunks that follow the NCERT structure.
 */
export function transformToHierarchicalChunks(chunks: RawChunk[]): HierarchicalChunk[] {
  const hierarchical: HierarchicalChunk[] = []
  let currentChapter = ''
  let currentSection = ''

  chunks.forEach((chunk) => {
    const metadata = chunk.metadata || {}
    const bookTitle = readMetaString(metadata, ['bookTitle', 'book_title'], 'NCERT Textbook')
    const subject = readMetaString(metadata, ['subject'], 'General')
    const board = readMetaString(metadata, ['curriculum', 'board'], 'CBSE')
    const classLevel = readMetaString(metadata, ['classLevel', 'class'], 'Unknown')
    const medium = readMetaString(metadata, ['language', 'medium'], 'English')
    const chapter = readMetaString(metadata, ['chapter', 'section_title'], currentChapter || 'General Chapter')
    const section = readMetaString(metadata, ['section_title'], currentSection || 'General Section')
    const pageNumber = readMetaNumber(metadata, ['pageNumber', 'page'], 1)

    if (chapter && chapter !== currentChapter) {
      currentChapter = chapter
    }

    if (section && section !== currentSection) {
      currentSection = section
    }

    const paragraphs = splitIntoParagraphs(chunk.text || chunk.content || '')
    paragraphs.forEach((paragraph, idx) => {
      hierarchical.push({
        id: `${chunk.id || 'chunk'}_${idx}`,
        text: paragraph,
        metadata: {
          bookTitle,
          subject,
          board,
          classLevel,
          class: classLevel,
          medium,
          chapter: currentChapter,
          section: currentSection,
          pageNumber,
          page: pageNumber,
          paragraphIndex: idx + 1,
          hierarchyPath: [
            { level: 'book', value: bookTitle },
            { level: 'chapter', value: currentChapter },
            { level: 'section', value: currentSection }
          ],
          chunkType: readMetaString(metadata, ['chunkType', 'content_type'], 'text'),
          section_level: readMetaNumber(metadata, ['section_level'], 0),
          hasFormulas: readMetaBoolean(metadata, ['hasFormulas', 'contains_equation']),
          hasTables: readMetaBoolean(metadata, ['hasTables', 'contains_table']),
          source_chunk_id: chunk.id,
          // CRITICAL: Preserve quality metadata from ContentQualityEnhancer
          quality_score: metadata.quality_score,
          quality_grade: metadata.quality_grade,
          ocr_quality_score: metadata.ocr_quality_score,
          ocr_corrections_made: metadata.ocr_corrections_made,
          chapter_extraction_confidence: metadata.chapter_extraction_confidence,
          metadata_detection_confidence: metadata.metadata_detection_confidence,
          detected_formulas_count: metadata.detected_formulas_count,
          detected_tables_count: metadata.detected_tables_count,
          detected_sections_count: metadata.detected_sections_count,
          isAtomic: metadata.isAtomic,
          minChunkSize: metadata.minChunkSize
        }
      })
    })
  })

  return hierarchical
}

function splitIntoParagraphs(text: string): string[] {
  if (!text) return []
  return text
    .split(/\r?\n\r?\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
}

function readMetaString(meta: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = meta[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return fallback
}

function readMetaNumber(meta: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = meta[key]
    if (typeof value === 'number') {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
  }
  return fallback
}

function readMetaBoolean(meta: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = meta[key]
    if (typeof value === 'boolean') {
      return value
    }
  }
  return false
}
