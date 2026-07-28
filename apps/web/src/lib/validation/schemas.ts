import { z } from 'zod';

// ─── NCERTCitation Schema ──────────────────────────────────────────────────
// Runtime enforcement of the citation contract.
// pageNumber must be a positive integer — not 0, not negative, not undefined.
export const NCERTCitationSchema = z.object({
    id: z.string().min(1),
    textbookTitle: z.string().min(1),
    chapter: z.string().min(1),
    pageNumber: z.number().int().positive({
        message: 'Page number must be a positive integer — citation is incomplete without it'
    }),
    classLevel: z.string(),
    subject: z.string().min(1),
    contentExcerpt: z.string().min(10, {
        message: 'Content excerpt too short to be a meaningful citation'
    }),
    citationFormat: z.string(),
});

// ─── WebCitation Schema ────────────────────────────────────────────────────
// Runtime enforcement for Phase 3 Track C
export const WebCitationSchema = z.object({
    url: z.string().url(),
    title: z.string().min(1),
    domain: z.string().min(1),
    publishedDate: z.string().nullable(),
    contentExcerpt: z.string().min(10),
    subject: z.string(),
    isNCERTVerified: z.literal(false),
    isGovernmentSource: z.boolean(),
    retrievedAt: z.string(),
});

// ─── AnyCitation Schema ────────────────────────────────────────────────────
export const AnyCitationSchema = z.union([NCERTCitationSchema, WebCitationSchema]);

// ─── AgentRequest Schema ───────────────────────────────────────────────────
export const AgentRequestSchema = z.object({
    query: z.string().min(1).max(2000),
    studentName: z.string().min(1).optional().default('Student'),
    grade: z.number().int().min(1).max(12).optional().default(9),
    subject: z.string().min(1).optional().default('Unknown'),
    language: z.enum(['english', 'hindi', 'bilingual']).optional().default('english'),
    sessionId: z.string().uuid().optional(),
    conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
        timestamp: z.any().optional(),
    })).max(50).optional().default([]), // cap conversation history to prevent prompt overflow
}).catchall(z.any());

// ─── Raw LLM Response Schema (Refinement) ──────────────────────────────────
// Validates the raw JSON output from the LLM before any internal mapping
export const RawLLMResponseSchema = z.object({
    // Agents return different shapes, but typically involve an answer or explanation.
    // We use this schema in LLMFactory or Agent's generate call to ensure basic JSON integrity.
}).catchall(z.any());

// ─── AgentResponse Schema ──────────────────────────────────────────────────
// Fixes the missing boolean flags (cultural_context_used etc.) from Phase 1
export const AgentResponseSchema = z.object({
    content: z.string().min(1),
    citations: z.array(AnyCitationSchema).optional().default([]),
    agentName: z.string().min(1).optional().default('Unknown Agent'),
    confidenceScore: z.number().min(0).max(1).optional().default(1),
    scopeValid: z.boolean().optional().default(true),
    metadata: z.object({
        retrievalTimeMs: z.number().nonnegative().optional().default(0),
        generationTimeMs: z.number().nonnegative().optional().default(0),
        chunksRetrieved: z.number().nonnegative().optional().default(0),
        formulaPreservationRate: z.number().min(0).max(1).optional().default(1.0),
        culturalContextUsed: z.boolean().optional().default(false), // fixes missing flag
        bilingualModeActive: z.boolean().optional().default(false),
        gradeAdaptationApplied: z.boolean().optional().default(false),
        cacheHit: z.boolean().optional().default(false),             // for Phase 2 Redis
        rerankingApplied: z.boolean().optional().default(false),     // for cross-encoder fix
        validationFailed: z.boolean().optional().default(false),
    }).catchall(z.any()).optional().default({}),

    // Phase 3 Track B — TTS Audio Lesson Integration
    audio: z.object({
        audioBase64: z.string(),
        durationSeconds: z.number(),
        language: z.string(),
        format: z.literal('wav'),
        textLength: z.number(),
        wasTruncated: z.boolean(),
    }).nullable().optional(),
}).catchall(z.any());

// Type exports — these replace the manually defined interfaces
export type ValidatedNCERTCitation = z.infer<typeof NCERTCitationSchema>;
export type ValidatedAgentRequest = z.infer<typeof AgentRequestSchema>;
export type ValidatedAgentResponse = z.infer<typeof AgentResponseSchema>;
export type ValidatedRawLLMResponse = z.infer<typeof RawLLMResponseSchema>;
