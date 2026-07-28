// Single source of truth for Langfuse score names
// Import this everywhere — never hardcode the strings
export const LANGFUSE_SCORES = {
    CITATION_PRECISION: 'pageNumberPrecision',
    WEB_CITATION_RATE: 'webCitationRate',
    SCOPE_VIOLATION: 'scopeViolation',
    CONFIDENCE: 'agentConfidence',
    TOKEN_COST_USD: 'estimatedCostUSD',
} as const;

export type LangfuseScoreName = typeof LANGFUSE_SCORES[keyof typeof LANGFUSE_SCORES];
