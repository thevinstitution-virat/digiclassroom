// src/lib/agents/core/services/scope-validation.service.ts

import { ContentVerificationEngine, ConstrainedContentGenerator, SourceChunk, VerificationResult, TextbookOnlyResponse } from '@/lib/agents/source_validation';

/**
 * Scope Validation Service
 * Encapsulates the logic ensuring AI tutors never hallucinate outside
 * the bounds of the provided Indian textbook curriculum.
 */
export class ScopeValidationService {
    private verificationEngine: ContentVerificationEngine;
    private constrainedGenerator: ConstrainedContentGenerator;

    constructor() {
        this.verificationEngine = new ContentVerificationEngine();
        this.constrainedGenerator = new ConstrainedContentGenerator();
    }

    /**
     * Verify that an LLM's raw output maps correctly back to known source chunks
     */
    public async verifyContentSource(
        generatedContent: string,
        sourceChunks: SourceChunk[],
        requireCitations: boolean = true
    ): Promise<VerificationResult> {
        return this.verificationEngine.verify_content_source(generatedContent, sourceChunks, requireCitations);
    }

    /**
     * Loop generation until output passes strict textbook boundaries,
     * dropping or repairing hallucinated sentences.
     */
    public async generateConstrainedAnswer(
        query: string,
        sourceChunks: SourceChunk[],
        gradeLevel: number,
        subject: string,
        boardType: string = 'CBSE',
        maxIterations: number = 3
    ): Promise<TextbookOnlyResponse> {
        return this.constrainedGenerator.generate_textbook_only_answer(
            query, sourceChunks, gradeLevel, subject, boardType, maxIterations
        );
    }
}
