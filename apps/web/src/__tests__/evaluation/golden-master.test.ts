/**
 * Golden Master Test Runner — Phase 5.4
 *
 * Runs all golden test cases against LIVE Qdrant + OpenAI.
 * Produces a precision report in afterAll.
 *
 * RULES:
 * - Tests use REAL Qdrant data, never mocked embeddings
 * - Asserts ONLY on ACTUAL NCERTCitation fields (chapter, pageNumber, contentExcerpt)
 * - Hard assertion at ≥95% only AFTER baseline is established
 */

import { INITIAL_20_GOLDEN } from './golden-set/initial-20.golden';
import { SCIENCE_EXTENDED_GOLDEN } from './golden-set/science-extended.golden';
import { MATHEMATICS_GOLDEN } from './golden-set/mathematics.golden';
import { SOCIAL_SCIENCE_GOLDEN } from './golden-set/social-science.golden';
import { LANGUAGE_GOLDEN } from './golden-set/language.golden';
import { OUT_OF_SCOPE_EXTENDED_GOLDEN } from './golden-set/out-of-scope-extended.golden';
import type { GoldenTestResult } from './types';

const ALL_GOLDEN_CASES = [
    ...INITIAL_20_GOLDEN,
    ...SCIENCE_EXTENDED_GOLDEN,
    ...MATHEMATICS_GOLDEN,
    ...SOCIAL_SCIENCE_GOLDEN,
    ...LANGUAGE_GOLDEN,
    ...OUT_OF_SCOPE_EXTENDED_GOLDEN,
];

// Dynamic imports since these services may need runtime config
let RetrievalService: any;
let isNCERTCitation: any;

beforeAll(async () => {
    const retrievalMod = await import('@/lib/agents/core/services/retrieval.service');
    RetrievalService = retrievalMod.RetrievalService;
    const citationMod = await import('@/types/citations');
    isNCERTCitation = citationMod.isNCERTCitation;
});

const results: GoldenTestResult[] = [];

describe(`NCERT Citation Golden Set — 100 Cases (${ALL_GOLDEN_CASES.length} loaded)`, () => {
    afterAll(() => {
        const passCount = results.filter((r) => r.passed).length;
        const baselinePrecision = results.length > 0 ? passCount / results.length : 0;

        // Print baseline report
        console.log('\n' + '═'.repeat(60));
        console.log('📊 GOLDEN SET BASELINE REPORT');
        console.log('═'.repeat(60));
        console.log(`Total cases: ${results.length}`);
        console.log(`Passed: ${passCount}`);
        console.log(`Failed: ${results.length - passCount}`);
        console.log(`Precision: ${(baselinePrecision * 100).toFixed(1)}%`);
        console.log('');

        if (baselinePrecision < 0.7) {
            console.log('🔴 CRITICAL: Precision below 70% — Qdrant indexing issue');
            console.log('   Do NOT expand to 100 cases. Fix data first.');
        } else if (baselinePrecision < 0.95) {
            console.log('🟡 WARNING: Precision below 95% target');
            const failed = results.filter((r) => !r.passed);
            console.log('   Failing cases:');
            failed.forEach((r) => console.log(`   - ${r.id}: ${r.failures.join(', ')}`));
        } else {
            console.log('✅ Precision ≥ 95% — Ready to expand to 100 cases');
        }
        console.log('═'.repeat(60));

        // Uncomment once you've seen the baseline and fixed data issues:
        // expect(baselinePrecision).toBeGreaterThanOrEqual(0.95);
    });

    ALL_GOLDEN_CASES.forEach((testCase) => {
        it(
            `[${testCase.id}] "${testCase.query.slice(0, 50)}..."`,
            async () => {
                const failures: string[] = [];

                const retrievalService = new RetrievalService();
                const context = await retrievalService.searchRelevantContent({
                    query: testCase.query,
                    subject: testCase.subject,
                    grade_level: testCase.grade,
                    board_type: 'CBSE',
                    limit: 10,
                });

                if (testCase.expectScopeViolation) {
                    // Out-of-scope test: retrieval should return low-confidence results
                    const topScore = context.results?.[0]?.score ?? 0;
                    if (topScore > 0.7) {
                        failures.push(
                            `Expected out-of-scope but got high-confidence result (score: ${topScore.toFixed(3)})`
                        );
                    }
                } else {
                    // In-scope test: check NCERT citation quality
                    const ncertCitations = (context.results || [])
                        .filter((r: any) => r.metadata?.page && r.metadata.page > 0)
                        .map((r: any) => ({
                            chapter: r.metadata?.chapter || '',
                            pageNumber: r.metadata?.page || 0,
                            contentExcerpt: (r.text || r.content || '').slice(0, 200),
                            sectionHeading: r.metadata?.section_title || '',
                            subject: r.metadata?.subject || '',
                            classLevel: r.metadata?.class_level || '',
                        }));

                    // Assertion 1: At least one result with page metadata
                    if (ncertCitations.length === 0) {
                        failures.push('No results with valid pageNumber returned');
                    } else {
                        const top = ncertCitations[0];

                        // Assertion 2: pageNumber > 0
                        if (top.pageNumber === 0) {
                            failures.push(
                                'pageNumber is 0 — PDF extraction did not capture page for this chunk'
                            );
                        }

                        // Assertion 3: pageNumber matches expected (if expected > 0)
                        if (
                            testCase.expected.pageNumber > 0 &&
                            top.pageNumber !== testCase.expected.pageNumber
                        ) {
                            failures.push(
                                `pageNumber: got ${top.pageNumber}, expected ${testCase.expected.pageNumber}`
                            );
                        }

                        // Assertion 4: chapter matches (fuzzy — contains check)
                        if (
                            testCase.expected.chapter &&
                            !top.chapter
                                .toLowerCase()
                                .includes(testCase.expected.chapter.toLowerCase())
                        ) {
                            failures.push(
                                `chapter: got "${top.chapter}", expected to contain "${testCase.expected.chapter}"`
                            );
                        }

                        // Assertion 5: contentExcerpt contains keyword
                        if (
                            testCase.expected.contentExcerptContains &&
                            !top.contentExcerpt
                                .toLowerCase()
                                .includes(
                                    testCase.expected.contentExcerptContains.toLowerCase()
                                )
                        ) {
                            failures.push(
                                `contentExcerpt missing keyword: "${testCase.expected.contentExcerptContains}"`
                            );
                        }
                    }
                }

                const passed = failures.length === 0;
                results.push({
                    id: testCase.id,
                    passed,
                    precision: passed ? 1 : 0,
                    failures,
                });

                if (!passed) {
                    console.warn(`[${testCase.id}] FAILED: ${failures.join(' | ')}`);
                }

                expect(failures).toHaveLength(0);
            },
            30000 // 30s timeout for live Qdrant + embedding calls
        );
    });
});
