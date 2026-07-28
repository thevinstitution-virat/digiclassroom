/**
 * Canonical Citation & Source Types for DigiClassroom Pro
 * 
 * This file unifies the THREE competing Citation interfaces and TWO competing
 * SourceChunk interfaces that previously existed across the codebase:
 * 
 *   Citation shapes:
 *     1. citation_agent.ts       → { id, textbook_title, chapter, page_number, ... }
 *     2. role-aware-citation.ts  → { id, source, chapter, page, content, confidence, isValid }
 *     3. source_verification_agent.ts → nested in VerificationResult
 *
 *   SourceChunk shapes:
 *     1. source_validation.ts    → { content, source, chapter?, page?, section?, confidence_score }
 *     2. source_verification_agent.ts → { content, metadata: { page_number?, textbook_title?, ... } }
 *
 * MIGRATION STRATEGY:
 *   - New code should import from this file: `import { NCERTCitation, NCERTSourceChunk } from '@/types/citations'`
 *   - Old code continues to work via @deprecated bridge aliases at the bottom of this file
 *   - Migrate file-by-file; VS Code will show yellow squiggles on deprecated imports
 * 
 * NON-NEGOTIABLE: pageNumber and contentExcerpt fields must NEVER be removed.
 * They are the trust mechanism for exact page-level NCERT citations.
 */

// =============================================================================
// Canonical Citation Type
// =============================================================================

/**
 * The single source of truth for NCERT textbook citations.
 * Every agent response that references textbook content uses this type.
 * 
 * pageNumber is EXACT — never a range, never "various pages", never 0 unless
 * the source genuinely lacks page metadata.
 */
export interface NCERTCitation {
    /** Unique citation identifier (e.g. "cite_1", "citation_3") */
    id: string;

    /** Full textbook title (e.g. "NCERT Class 9 Geography") */
    textbookTitle: string;

    /** Chapter name or number as string (e.g. "2" or "Physical Features of India") */
    chapter: string;

    /** EXACT page number from the NCERT textbook. 0 = metadata unavailable. NEVER remove this field. */
    pageNumber: number;

    /** Section heading within the chapter, if available */
    sectionHeading?: string;

    /** Class/grade level (e.g. "Class 9", "10") */
    classLevel: string;

    /** Subject name (e.g. "Geography", "Mathematics") */
    subject: string;

    /** Excerpt from the source text that this citation references (first ~100 chars) */
    contentExcerpt: string;

    /** Human-readable formatted citation string (e.g. "NCERT Class 9 Geography, Chapter 2, Page 14") */
    citationFormat: string;

    /** Confidence score from retrieval (0.0–1.0). Used for trust indicators. */
    confidence?: number;

    /** Whether this citation has been validated against known textbook structure */
    isValid?: boolean;

    /** Extraction method used (e.g. "pdf-extract-kit", "docling") */
    extractionMethod?: string;
}

// =============================================================================
// Phase 3 Track C: Web Citations (Current Affairs / Supplemental)
// =============================================================================

/**
 * Web citations — completely separate from NCERTCitation.
 * isNCERTVerified is always false. Used for current affairs queries in
 * Economics, Political Science, etc. NEVER used for STEM subjects.
 */
export interface WebCitation {
    url: string;
    title: string;
    domain: string;
    publishedDate: string | null;
    contentExcerpt: string;
    subject: string;
    isNCERTVerified: false;       // literal type — always false
    isGovernmentSource: boolean;  // true for pib.gov.in, rbi.org.in, etc.
    retrievedAt: string;          // ISO timestamp
}

// Union type for mixed citations in a response
export type AnyCitation = NCERTCitation | WebCitation;

// Type guard to distinguish them
export function isNCERTCitation(c: AnyCitation): c is NCERTCitation {
    return 'pageNumber' in c && 'textbookTitle' in c;
}

// =============================================================================
// Canonical Source Chunk Type
// =============================================================================

/**
 * A chunk of NCERT textbook content retrieved from Qdrant with its metadata.
 * This is the input to citation extraction and content verification.
 * 
 * Unifies the two previous SourceChunk shapes:
 *   - Flat shape from source_validation.ts (content, source, chapter, page, section)
 *   - Nested shape from source_verification_agent.ts (content, metadata: { ... })
 */
export interface NCERTSourceChunk {
    /** The actual text content of the chunk */
    content: string;

    /** Source identifier (e.g. textbook title or "NCERT Class 9 Geography") */
    source: string;

    /** Chapter name or number */
    chapter?: string;

    /** EXACT page number. 0 = unavailable. */
    page?: number;

    /** Section heading within the chapter */
    section?: string;

    /** Relevance/similarity score from vector search (0.0–1.0) */
    confidenceScore: number;

    /** Content type classification (e.g. "text", "definition", "formula", "table") */
    contentType?: string;

    /** Subject (e.g. "Geography") */
    subject?: string;

    /** Class level (e.g. "Class 9") */
    classLevel?: string;

    /** Textbook title */
    textbookTitle?: string;

    /** Chunk level in hierarchical chunking ("atomic" | "paragraph" | "section") */
    chunkLevel?: 'atomic' | 'paragraph' | 'section';

    /** Parent chunk ID for hierarchical retrieval */
    parentChunkId?: string;
}

// =============================================================================
// Citation Result Type (used by CitationAgent)
// =============================================================================

export interface NCERTCitationResult {
    /** The answer text with inline citation markers like [1], [2] */
    answer: string;

    /** Array of citations referenced in the answer */
    citations: NCERTCitation[];

    /** Total number of citations added */
    citationCount: number;

    /** Percentage of answer sentences that have citations (0–100) */
    coveragePercentage: number;
}

// =============================================================================
// Verification Result Type
// =============================================================================

export interface ContentVerificationResult {
    isVerified: boolean;
    overallFidelityScore: number;
    sentenceScores: number[];
    failedSentences: string[];
    verificationDetails: {
        totalSentences: number;
        verifiedSentences: number;
        failedSentences: number;
        similarityMethod: string;
        sourceChunksUsed: number;
        overallScore: number;
        citationsFound: number;
        verificationPassed: boolean;
    };
    citations: string[];
}

// =============================================================================
// DEPRECATED BRIDGE ALIASES
// =============================================================================
// These allow old code to keep compiling while we migrate file-by-file.
// VS Code will show yellow squiggles on deprecated imports.
// Remove these once all files have been migrated to NCERTCitation/NCERTSourceChunk.

/**
 * @deprecated Use NCERTCitation instead. Import from '@/types/citations'.
 * Bridge alias for citation_agent.ts Citation interface.
 */
export type Citation = NCERTCitation;

/**
 * @deprecated Use NCERTSourceChunk instead. Import from '@/types/citations'.
 * Bridge alias for source_validation.ts SourceChunk interface.
 */
export type SourceChunk = NCERTSourceChunk;

/**
 * @deprecated Use NCERTCitationResult instead. Import from '@/types/citations'.
 */
export type CitationResult = NCERTCitationResult;
