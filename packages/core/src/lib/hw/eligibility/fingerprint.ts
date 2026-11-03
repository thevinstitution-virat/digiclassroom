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
}

export const normaliseModelId = (m: string): string => m.trim().toLowerCase().replace(/^.*\//, '');

function canonical(parts: FingerprintParts): string {
  const p = { ...parts, model: normaliseModelId(parts.model), reasoning: parts.reasoning.trim().toLowerCase(), thinking: parts.thinking.trim().toLowerCase() };
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
}, gradeModel: string, promptVersion: string): FingerprintParts {
  return {
    model: gradeModel,
    promptVersion,
    chunkSize: cfg.HW_GRADE_BATCH_SIZE,
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
  profiles?: { gradeOptions?: { thinkingLevel?: string; reasoningEffort?: string }; strictMarking?: boolean; valuePointsOnly?: boolean; guards?: boolean };
}

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
  if (p.strictMarking) return { notProduction: 'it used strict marking, which the product does not run yet' };
  if (p.valuePointsOnly) return { notProduction: 'it marked the key points only, while the product marks against the whole scheme' };
  const reasoning = p.gradeOptions?.reasoningEffort ?? '';
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
