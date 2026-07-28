/**
 * Golden Test Types — Phase 5.4
 *
 * Uses ACTUAL NCERTCitation fields from src/types/citations.ts:
 *   - chapter (string)         ✅
 *   - pageNumber (number)      ✅
 *   - contentExcerpt (string)  ✅
 *   - sectionHeading (string)  ✅  (optional)
 *
 * NEVER assert on:
 *   - chapterNumber    ❌ (does not exist)
 *   - verbatimKeyword  ❌ (does not exist)
 *   - textbookEdition  ❌ (does not exist)
 */

export interface GoldenTestCase {
    id: string;
    query: string;
    subject: string;
    grade: number;
    expected: {
        /** Chapter name (string, e.g. "Nutrition in Plants") */
        chapter: string;
        /** Exact page from NCERT PDF. 0 = metadata unavailable in Qdrant. */
        pageNumber: number;
        /** Keyword that MUST appear in contentExcerpt */
        contentExcerptContains: string;
        /** Key concepts that MUST appear in the generated response */
        mustContainInResponse: string[];
    };
    /** If true, the query is out-of-scope — expect scope validation to catch it */
    expectScopeViolation?: boolean;
}

export interface GoldenTestResult {
    id: string;
    passed: boolean;
    precision: number;
    failures: string[];
}
