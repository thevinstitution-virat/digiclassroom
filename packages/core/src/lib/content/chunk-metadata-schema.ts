/**
 * Canonical Chunk Metadata Schema
 * Uses Zod for validation (consistent with your tRPC patterns)
 */

import { z } from 'zod';

/**
 * Canonical metadata schema - ALL processors must produce this
 */
export const ChunkMetadataSchema = z.object({
  // ===== REQUIRED FIELDS =====
  class: z.string().min(1, 'Class is required'),
  subject: z.string().min(1, 'Subject is required'),
  book_title: z.string().min(1, 'Book title is required'),
  page: z.number().int().positive('Page must be positive'),
  
  // ===== CONTEXTUAL FIELDS (with defaults) =====
  chapter: z.string().default('General Chapter'),
  section_title: z.string().default('General Section'),
  board: z.string().default('CBSE'),
  medium: z.string().default('English'),
  curriculum: z.string().default('CBSE'),
  language: z.string().default('English'),
  section_level: z.number().int().min(0).default(0),
  
  // ===== SOURCE TRACKING =====
  source: z.string(),
  extraction_method: z.enum(['embedded_text', 'pdf_extract_kit', 'ocr', 'docling']),
  content_type: z.string().default('text'),
  confidence: z.number().min(0).max(1).default(0.85),
  
  // ===== CONTENT FLAGS =====
  contains_equation: z.boolean().default(false),
  contains_table: z.boolean().default(false),
  contains_figure: z.boolean().default(false),
});

export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;

/**
 * Raw metadata from Python processors (before normalization)
 */
export const RawChunkMetadataSchema = z.object({
  // Allow flexible input
  class: z.string().optional(),
  classLevel: z.string().optional(),
  subject: z.string().optional(),
  book_title: z.string().optional(),
  bookTitle: z.string().optional(),
  page: z.number().optional(),
  chapter: z.string().optional(),
  section_title: z.string().optional(),
  board: z.string().optional(),
  medium: z.string().optional(),
  curriculum: z.string().optional(),
  language: z.string().optional(),
  section_level: z.number().optional(),
  source: z.string().optional(),
  extraction_method: z.string().optional(),
  content_type: z.string().optional(),
  confidence: z.number().optional(),
  contains_equation: z.boolean().optional(),
  contains_table: z.boolean().optional(),
  contains_figure: z.boolean().optional(),
}).passthrough(); // Allow extra fields

export type RawChunkMetadata = z.infer<typeof RawChunkMetadataSchema>;

/**
 * Normalize class level to "Class X" format
 */
export function normalizeClassLevel(classLevel: string): string {
  // Remove common prefixes
  let normalized = classLevel
    .replace(/^(class|grade|std)\s*/i, '')
    .trim();
  
  // Convert Roman numerals to Arabic
  const romanToArabic: Record<string, string> = {
    'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
    'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10',
    'XI': '11', 'XII': '12'
  };
  
  if (romanToArabic[normalized.toUpperCase()]) {
    normalized = romanToArabic[normalized.toUpperCase()];
  }
  
  // Ensure "Class X" format
  return `Class ${normalized}`;
}

/**
 * Validate and normalize raw metadata to canonical schema
 * @throws {z.ZodError} if validation fails
 */
export function validateAndNormalizeMetadata(
  rawMetadata: any,
  pdfPath: string
): ChunkMetadata {
  // Parse raw metadata (allows flexible input)
  const raw = RawChunkMetadataSchema.parse(rawMetadata);

  // STRICT VALIDATION: Check required fields are present
  // Don't provide defaults for critical fields - fail if missing
  const hasClass = raw.class || raw.classLevel;
  const hasSubject = raw.subject;
  const hasBookTitle = raw.book_title || raw.bookTitle;
  const hasPage = raw.page !== undefined && raw.page !== null;

  if (!hasClass) {
    throw new z.ZodError([{
      code: 'custom',
      path: ['class'],
      message: 'Missing required field: class or classLevel'
    }]);
  }

  if (!hasSubject) {
    throw new z.ZodError([{
      code: 'custom',
      path: ['subject'],
      message: 'Missing required field: subject'
    }]);
  }

  if (!hasBookTitle) {
    throw new z.ZodError([{
      code: 'custom',
      path: ['book_title'],
      message: 'Missing required field: book_title or bookTitle'
    }]);
  }

  if (!hasPage) {
    throw new z.ZodError([{
      code: 'custom',
      path: ['page'],
      message: 'Missing required field: page'
    }]);
  }

  // Extract book title
  const bookTitle = raw.book_title || raw.bookTitle!;

  // Normalize class level
  const classLevel = normalizeClassLevel(raw.class || raw.classLevel!);

  // Build canonical metadata
  const canonical: ChunkMetadata = {
    // Required fields (validated above)
    class: classLevel,
    subject: raw.subject!,
    book_title: bookTitle,
    page: raw.page!,

    // Contextual fields (can have defaults)
    chapter: raw.chapter || 'General Chapter',
    section_title: raw.section_title || 'General Section',
    board: raw.board || raw.curriculum || 'CBSE',
    medium: raw.medium || raw.language || 'English',
    curriculum: raw.curriculum || 'CBSE',
    language: raw.language || 'English',
    section_level: raw.section_level || 0,

    // Source tracking
    source: raw.source || bookTitle,
    extraction_method: (raw.extraction_method as any) || 'pdf_extract_kit',
    content_type: raw.content_type || 'text',
    confidence: raw.confidence || 0.85,

    // Content flags
    contains_equation: raw.contains_equation || false,
    contains_table: raw.contains_table || false,
    contains_figure: raw.contains_figure || false,
  };

  // Validate canonical schema, then hand back the raw fields alongside it.
  //
  // `canonical` is an explicit field list with no spread, so returning it alone
  // DISCARDED every field this schema does not name — silently, at the one point
  // every chunk passes through. The payload builder in enhanced-rag-pipeline
  // reads `domain`, `course`, `level`, `book`, `subjectGroup`, `quality_score`,
  // `content_source` and `validation_status` from this object and got `undefined`
  // for all of them, so indexPDF's careful per-chunk hierarchy injection never
  // reached a single Qdrant point, and the curated lane's human-validation
  // provenance was dropped on the way to the payload that was supposed to carry
  // it. Nothing errored; the fields simply read 'Unknown'.
  //
  // Canonical spreads LAST so normalization (class level, defaults, coercions)
  // still wins over whatever the raw metadata said.
  const validated = ChunkMetadataSchema.parse(canonical);
  return { ...(raw as Record<string, unknown>), ...validated } as ChunkMetadata;
}

/**
 * Validation error with helpful message
 */
export class MetadataValidationError extends Error {
  constructor(
    public chunkId: string,
    public zodError: z.ZodError,
    public rawMetadata: any
  ) {
    const issues = zodError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    super(`Chunk ${chunkId} validation failed: ${issues}`);
    this.name = 'MetadataValidationError';
  }
}

/**
 * Validate chunk with helpful error messages
 */
export function validateChunk(chunk: any): {
  valid: boolean;
  metadata?: ChunkMetadata;
  error?: MetadataValidationError;
} {
  try {
    const metadata = validateAndNormalizeMetadata(
      chunk.metadata,
      chunk.metadata?.source || 'unknown.pdf'
    );
    
    return { valid: true, metadata };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: new MetadataValidationError(
          chunk.id || 'unknown',
          error,
          chunk.metadata
        )
      };
    }
    throw error;
  }
}

/**
 * Batch validate chunks and return valid/invalid split
 */
export function validateChunkBatch(chunks: any[]): {
  valid: Array<{ chunk: any; metadata: ChunkMetadata }>;
  invalid: Array<{ chunk: any; error: MetadataValidationError }>;
  stats: {
    total: number;
    validCount: number;
    invalidCount: number;
    validationRate: number;
  };
} {
  const valid: Array<{ chunk: any; metadata: ChunkMetadata }> = [];
  const invalid: Array<{ chunk: any; error: MetadataValidationError }> = [];
  
  for (const chunk of chunks) {
    const result = validateChunk(chunk);
    
    if (result.valid && result.metadata) {
      valid.push({ chunk, metadata: result.metadata });
    } else if (result.error) {
      invalid.push({ chunk, error: result.error });
      console.error(`❌ Chunk validation failed:`, result.error.message);
    }
  }
  
  const stats = {
    total: chunks.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    validationRate: chunks.length > 0 ? valid.length / chunks.length : 0
  };
  
  return { valid, invalid, stats };
}

/**
 * Configuration validation (fits your existing env-validation pattern)
 */
export const TEXT_EXTRACTION_STRATEGIES = [
  'auto',
  'text_only',
  'ocr_only',
  'hybrid',
  'force_pdf_extract_kit'
] as const;

export type TextExtractionStrategy = typeof TEXT_EXTRACTION_STRATEGIES[number];

export function getValidatedExtractionStrategy(): TextExtractionStrategy {
  const raw = process.env.TEXT_EXTRACTION_STRATEGY;
  
  if (!raw) {
    console.log('ℹ️  TEXT_EXTRACTION_STRATEGY not set, using default: auto');
    return 'auto';
  }
  
  if (!TEXT_EXTRACTION_STRATEGIES.includes(raw as TextExtractionStrategy)) {
    console.error(`❌ Invalid TEXT_EXTRACTION_STRATEGY: "${raw}"`);
    console.error(`   Valid options: ${TEXT_EXTRACTION_STRATEGIES.join(', ')}`);
    console.error(`   Falling back to: auto`);
    return 'auto';
  }
  
  console.log(`✅ Using TEXT_EXTRACTION_STRATEGY: ${raw}`);
  return raw as TextExtractionStrategy;
}

