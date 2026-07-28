// src/lib/agents/core/services/citation.service.ts

import { CitationAgent, CitationResult } from '@/lib/agents/citation_agent';
import { SourceChunk } from '@/lib/agents/source_verification_agent';

export interface CitationReference {
    subject: string;
    class_level: string;
    chapter: string;
    page?: number;
}

/**
 * Citation Service
 * Provides utilities for extracting source bounds and applying strict 
 * textbook citations to generated AI content.
 */
export class CitationService {
    private citationAgent: CitationAgent;

    constructor() {
        this.citationAgent = new CitationAgent();
    }

    /**
     * Extract unique textbook sources from raw retrieval results for metadata mapping
     */
    public extractTextbookSources(results: Record<string, unknown>[]): CitationReference[] {
        const sources: CitationReference[] = [];
        const seen = new Set<string>();

        for (const result of results) {
            if (!result.metadata) continue;

        // @ts-ignore
            const key = `${result.metadata.subject}-${result.metadata.class_level}-${result.metadata.chapter}-${result.metadata.page || ''}`;

            if (!seen.has(key)) {
                seen.add(key);
                sources.push({
        // @ts-ignore
                    subject: result.metadata.subject || 'Unknown Subject',
        // @ts-ignore
                    class_level: result.metadata.class_level || 'Unknown Class',
        // @ts-ignore
                    chapter: result.metadata.chapter || 'Unknown Chapter',
        // @ts-ignore
                    page: result.metadata.page
                });
            }
        }

        return sources;
    }

    /**
     * Validates and injects hard citations into an LLM answer string
     */
    public async addCitationsToText(text: string, sourceChunks: SourceChunk[]): Promise<CitationResult> {
        return this.citationAgent.add_citations(text, sourceChunks);
    }
}
