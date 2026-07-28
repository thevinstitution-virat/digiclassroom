// src/lib/config/feature-flags.ts
// Bug A12 fix: getFeatureFlags() re-read process.env on every call — now memoized at module level.
// MT_RBAC_ENFORCEMENT: documented here but kept false until Phase 2d prerequisite checklist complete.
//
// Phase 2d will set MT_RBAC_ENFORCEMENT=true in .env — do NOT flip it here in code.
// It must remain an env variable so it can be toggled per-environment without a deploy.

export interface FeatureFlags {
  /**
   * Enables LangGraph agent pipeline.
   * When false, falls back to legacy AgentManager.
   */
  useLangGraph: boolean;

  /**
   * Enables unified prompt system across agents.
   */
  useUnifiedPrompts: boolean;

  /**
   * Enables enhanced RAG validation (minScore enforcement, grade filtering).
   */
  useEnhancedValidation: boolean;

  /**
   * Enables Langfuse tracing for LangGraph nodes.
   * Keep off in production until Langfuse is fully configured.
   */
  archLangfuseTracing: boolean;

  /**
   * PHASE 2d gate: enables server-side RBAC enforcement.
   * When true: org-scoped routes reject requests without valid org membership.
   * When false: routes rely on routing/UI-level gating only (Phase 1 state).
   *
   * DO NOT set to true until ALL Phase 2a + 2b + 2c checklist items are complete.
   * Prerequisites:
   *   ✅ D1: clerkId columns nullable
   *   ✅ D5: practest orgId scoping
   *   ✅ D7: userSubscriptions + notifications in scopedQuery
   *   ✅ I5: dev/test routes blocked
   *   ✅ I6: qdrant/clear confirmation gate
   *   ⏳ 2b: route tiering audit complete
   *   ⏳ 2c: x-org-id trust model hardened
   *   ⏳ T4: dual identity tables consolidated
   */
  mtRbacEnforcement: boolean;

  /**
   * Enables hybrid search (dense + BM25 sparse vectors).
   * Keep false until Bug R6 (empty BM25 index) is fixed.
   */
  enableHybridSearch: boolean;
}

// ── Memoized singleton — env is read once at module load time (Bug A12 fix) ──
// Previously: every call to getFeatureFlags() hit process.env fresh.
// Now: read once, cached for the lifetime of the module (per worker process).
// To pick up env changes: restart the server (standard Next.js behaviour).

let _flags: FeatureFlags | null = null;

export function getFeatureFlags(): FeatureFlags {
  if (_flags !== null) return _flags;

  _flags = {
    useLangGraph:          parseFlag('USE_LANGGRAPH',           true),
    useUnifiedPrompts:     parseFlag('USE_UNIFIED_PROMPTS',     false),
    useEnhancedValidation: parseFlag('USE_ENHANCED_VALIDATION', false),
    archLangfuseTracing:   parseFlag('ARCH_LANGFUSE_TRACING',   false),

    // Phase 2d gate — stays false until all prerequisites done
    // Set MT_RBAC_ENFORCEMENT=true in .env when ready
    mtRbacEnforcement:     parseFlag('MT_RBAC_ENFORCEMENT',     false),

    // Off until Bug R6 (empty BM25 index) is fixed
    enableHybridSearch:    parseFlag('ENABLE_HYBRID_SEARCH',    false),
  };

  return _flags;
}

/**
 * For use in tests only — resets the memoized flags so a fresh read happens.
 * Do NOT call in production code.
 */
export function _resetFlagsCache(): void {
  _flags = null;
}

// ── Convenience accessors ─────────────────────────────────────────────────────

export function isRbacEnforced(): boolean {
  return getFeatureFlags().mtRbacEnforcement;
}

export function isLangGraphEnabled(): boolean {
  return getFeatureFlags().useLangGraph;
}

export function isHybridSearchEnabled(): boolean {
  return getFeatureFlags().enableHybridSearch;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function parseFlag(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined || val === '') return defaultValue;
  return val.toLowerCase() === 'true' || val === '1';
}
