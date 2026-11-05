// The marking configuration's fingerprint (roadmap 5.3): "configuration changed" means this value changed. Pure.
//
// It covers what decides the suggestions a teacher sees: the model, the prompt, how many answers go to the model in one call, how much
// it reasons, and the two code-side guards that change which answers are marked how (the instruction screen, and exact-match marking
// in code). Deliberately NOT in it: the provider route (direct or through OpenRouter: the same model), prices, batching or timing,
// the confidence threshold for bulk accept, and things that do not change a suggestion. Model ids are compared without their vendor
// prefix ("google/gemini-3.5-flash-lite" and "gemini-3.5-flash-lite" are one model), so an evaluation run through OpenRouter and the
// production setting can be compared.

import { createHash } from 'node:crypto';

export interface FingerprintParts {
  model: string;
  promptVersion: string;
  chunkSize: number;
  /** Reasoning effort for models that use one (for example "low"), else "". */
  reasoning: string;
  /** Gemini's thinking level, else "". */
  thinking: string;
  instructionGuard: boolean;
  codeMarking: boolean;
  /** Strict marking (one answer per call, verdicts, marks computed in code). Counted only when true, so every fingerprint made before it existed is unchanged. */
  strict?: boolean;
}

export const normaliseModelId = (m: string): string => m.trim().toLowerCase().replace(/^.*\//, '');

function canonical(parts: FingerprintParts): string {
  const { strict, ...rest } = parts;
  const p = { ...rest, ...(strict ? { strict: true } : {}), model: normaliseModelId(parts.model), reasoning: parts.reasoning.trim().toLowerCase(), thinking: parts.thinking.trim().toLowerCase() };
  return JSON.stringify(Object.keys(p).sort().map((k) => [k, (p as Record<string, unknown>)[k]]));
}

export const fingerprint = (parts: FingerprintParts): string => createHash('sha256').update(canonical(parts)).digest('hex');

/** The production configuration, from the settings in force (config.ts) and the model the grade step would call. */
export function runningParts(cfg: {
  HW_GRADE_BATCH_SIZE: number;
  HW_GRADE_REASONING_EFFORT?: string;
  HW_THINKING_LEVEL: string;
  HW_INSTRUCTION_GUARD_ENABLED: boolean;
  HW_CODE_MARKING_ENABLED: boolean;
  HW_STRICT_MARKING_ENABLED?: boolean;
}, gradeModel: string, promptVersion: string): FingerprintParts {
  const strict = Boolean(cfg.HW_STRICT_MARKING_ENABLED);
  return {
    model: gradeModel,
    promptVersion,
    // Strict marking always sends one answer per call (grader/mark-mode.ts).
    chunkSize: strict ? 1 : cfg.HW_GRADE_BATCH_SIZE,
    ...(strict ? { strict: true } : {}),
    reasoning: cfg.HW_GRADE_REASONING_EFFORT ?? '',
    // A model that is given a reasoning effort ignores the thinking level (config.ts), so the level is not part of what it does.
    thinking: cfg.HW_GRADE_REASONING_EFFORT ? '' : cfg.HW_THINKING_LEVEL,
    instructionGuard: cfg.HW_INSTRUCTION_GUARD_ENABLED,
    codeMarking: cfg.HW_CODE_MARKING_ENABLED,
  };
}

/** The recorded run configuration (run.json meta.config) as far as the fingerprint reads it. */
export interface RunConfigLike {
  thinkingLevel?: string;
  grader?: { model?: string; chunkSize?: number };
  prompts?: { grade?: string };
  profiles?: { gradeOptions?: { thinkingLevel?: string; reasoningEffort?: string }; strictMarking?: boolean; strictVersion?: 1 | 2; valuePointsOnly?: boolean; guards?: boolean };
}

/** The strict prompt the product runs (grade-strict.v2). A run made with another strict prompt measured something else. */
const PRODUCT_STRICT_PROMPT = 'grade-strict.v2';

export type RunParts = { parts: FingerprintParts } | { notProduction: string };

/**
 * The same parts from an evaluation run's recorded configuration, or the reason the run is not the product's marking and so cannot
 * stand for it. A run that used strict marking, or marked key points only, measured something the product does not run: it can be
 * reported, but never promoted. The code-marking flag is not recorded in a run, so the importer declares it.
 */
export function partsFromRunConfig(config: RunConfigLike, declared: { promptVersion: string; codeMarking: boolean }): RunParts {
  const g = config.grader;
  if (!g?.model || !g.chunkSize) return { notProduction: 'the run did not record its grader model and call size' };
  const p = config.profiles ?? {};
  const reasoning = p.gradeOptions?.reasoningEffort ?? '';
  if (p.strictMarking) {
    // The product runs strict marking only as grade-strict.v2, one answer per call, marking the key points (HW_STRICT_MARKING_ENABLED).
    if (p.strictVersion !== 2) return { notProduction: 'it used a strict marking prompt other than grade-strict.v2, which is the only one the product runs' };
    if (g.chunkSize !== 1) return { notProduction: 'it marked more than one answer per call, while strict marking in the product marks one' };
    return {
      parts: {
        model: g.model, promptVersion: PRODUCT_STRICT_PROMPT, chunkSize: 1, strict: true, reasoning,
        thinking: reasoning ? '' : (p.gradeOptions?.thinkingLevel ?? config.thinkingLevel ?? 'MINIMAL'),
        instructionGuard: Boolean(p.guards), codeMarking: declared.codeMarking,
      },
    };
  }
  if (p.valuePointsOnly) return { notProduction: 'it marked the key points only, while the product marks against the whole scheme' };
  return {
    parts: {
      model: g.model,
      promptVersion: config.prompts?.grade ?? declared.promptVersion,
      chunkSize: g.chunkSize,
      reasoning,
      thinking: reasoning ? '' : (p.gradeOptions?.thinkingLevel ?? config.thinkingLevel ?? 'MINIMAL'),
      instructionGuard: Boolean(p.guards),
      codeMarking: declared.codeMarking,
    },
  };
}
