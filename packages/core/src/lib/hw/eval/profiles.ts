// Named eval profiles for the cost work (docs/hw-eval/cost-phase1.md). A profile is a
// configuration to MEASURE, not one to ship: nothing here changes what production does, and no
// model change goes live without the Evaluator's gates on real handwriting.
//
// A run takes one profile per stage (reading, escalation, marking, keys). Loading a combination
// checks the family rules and refuses a combination that breaks them:
//   - the key verifier's model family differs from the key writer's;
//   - the mutation generator's model family differs from the grader's.

import { modelFamily } from '../keys/checks';

export type StageId = 'reading' | 'escalation' | 'marking' | 'keys';
export type Provider = 'gemini' | 'openrouter';

export interface ModelCall {
  provider: Provider;
  model: string;
  /** Gemini thinking level (OpenRouter maps it to reasoning.effort). */
  thinkingLevel?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  /** Reasoning effort for models that do not use Gemini's scale, e.g. gpt-6-luna: 'none' | 'low'. Wins over thinkingLevel. */
  reasoningEffort?: string;
  mediaResolution?: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface Base {
  id: string;
  label: string;
  /** Run through the provider's batch API (half price, up to 24 h). In a profile run the tokens are measured on the standard path and priced at the batch rate. */
  batch: boolean;
  notes: string;
}

export interface ReadingProfile extends Base {
  stage: 'reading';
  call: ModelCall;
  /** Only items in this language are read (a profile that is not meant for the other languages). */
  onlyLanguage?: 'en';
}
export interface EscalationProfile extends Base {
  stage: 'escalation';
  /** 'sarvam' is a per-page document reader, not a token-priced model. */
  call: ModelCall | { vendor: 'sarvam'; inrPerPage: number };
  /** Cannot be run yet, and why. */
  notRunnable?: string;
}
export interface MarkingProfile extends Base {
  stage: 'marking';
  call: ModelCall;
  /** Answers per marking call. One answer per call means one answer's text can never sit beside another student's. */
  answersPerCall: number;
  /** Mark from the key's value points only (no reference-answer paragraph). */
  valuePointsOnly: boolean;
}
export interface KeyProfile extends Base {
  stage: 'keys';
  writer: ModelCall;
  verifier: ModelCall;
}

export type Profile = ReadingProfile | EscalationProfile | MarkingProfile | KeyProfile;

const FLASH_LITE = 'google/gemini-3.5-flash-lite';
const FLASH_36 = 'google/gemini-3.6-flash';
const FLASH_35 = 'google/gemini-3.5-flash';
const LUNA = 'openai/gpt-6-luna';

/** The model that writes mutation variants; its family must differ from the grader's. */
export const DEFAULT_MUTATION_MODEL = 'anthropic/claude-haiku-5.5';

export const PROFILES: readonly Profile[] = [
  // ── Reading ─────────────────────────────────────────────────────────────────
  { id: 'R0', stage: 'reading', label: "today's settings", batch: false,
    call: { provider: 'openrouter', model: FLASH_LITE, thinkingLevel: 'MINIMAL', mediaResolution: 'LOW' },
    notes: 'docs/hw-eval/configs/production.json: tier 1 on the standard path, minimal thinking, low image resolution.' },
  { id: 'R1', stage: 'reading', label: 'flash-lite, batch, minimal thinking, lowest resolution', batch: true,
    call: { provider: 'openrouter', model: FLASH_LITE, thinkingLevel: 'MINIMAL', mediaResolution: 'LOW' },
    notes: 'The same request as R0; only the price differs (batch). LOW is already the lowest level, so R1 changes cost, not tokens.' },
  { id: 'R2', stage: 'reading', label: 'R1 one resolution up', batch: true,
    call: { provider: 'openrouter', model: FLASH_LITE, thinkingLevel: 'MINIMAL', mediaResolution: 'MEDIUM' },
    notes: 'Image resolution MEDIUM. Through OpenRouter the image "detail" has two settings (low / high), so MEDIUM is sent as high.' },
  { id: 'R-luna', stage: 'reading', label: 'gpt-6-luna, low effort, English only', batch: false,
    call: { provider: 'openrouter', model: LUNA, reasoningEffort: 'low', mediaResolution: 'LOW' },
    onlyLanguage: 'en',
    notes: 'English items only; Hindi is not run on this profile.' },

  // ── Escalation (tier 2) ─────────────────────────────────────────────────────
  { id: 'E0', stage: 'escalation', label: "today's escalation model", batch: false,
    call: { provider: 'openrouter', model: FLASH_36, thinkingLevel: 'MINIMAL', mediaResolution: 'LOW' },
    notes: 'Baseline added for the comparison: production.json escalates to gemini-3.6-flash on the standard path.' },
  { id: 'E1', stage: 'escalation', label: 'gemini-3.6-flash, batch', batch: true,
    call: { provider: 'openrouter', model: FLASH_36, thinkingLevel: 'MINIMAL', mediaResolution: 'LOW' },
    notes: 'Added after the first measurements: the request E0 sends, priced as batch. gemini-3.5-flash costs twice as much per token as 3.6-flash and wrote more output, so E-gemini is dearer than E0 even at the batch rate.' },
  { id: 'E-gemini', stage: 'escalation', label: 'gemini-3.5-flash, batch', batch: true,
    call: { provider: 'openrouter', model: FLASH_35, thinkingLevel: 'MINIMAL', mediaResolution: 'LOW' },
    notes: 'Escalation runs synchronously in production today (read-handler); batching it adds up to 24 h to the doubtful answers.' },
  { id: 'E-sarvam', stage: 'escalation', label: 'Sarvam Vision, per page', batch: false,
    call: { vendor: 'sarvam', inrPerPage: 0.5 },
    notRunnable: 'no SARVAM_API_KEY in this environment, and SarvamReader is not implemented (reader/sarvam-reader.ts). Priced at the published ₹0.50 per page only.',
    notes: 'Sarvam Document Intelligence "Parse" price. One page per answer is assumed.' },

  // ── Marking ─────────────────────────────────────────────────────────────────
  { id: 'M0', stage: 'marking', label: "today's settings", batch: false,
    call: { provider: 'openrouter', model: FLASH_LITE, thinkingLevel: 'MINIMAL' }, answersPerCall: 10, valuePointsOnly: false,
    notes: 'grade.v1, ten answers to one question per call, reference answer and marking scheme in the prompt.' },
  { id: 'M1', stage: 'marking', label: 'gpt-6-luna, low effort, one answer per call', batch: false,
    call: { provider: 'openrouter', model: LUNA, reasoningEffort: 'low' }, answersPerCall: 1, valuePointsOnly: true,
    notes: 'One answer per call so an injection line in one answer cannot reach another student\'s mark.' },
  { id: 'M2', stage: 'marking', label: 'M1 with effort none', batch: false,
    call: { provider: 'openrouter', model: LUNA, reasoningEffort: 'none' }, answersPerCall: 1, valuePointsOnly: true,
    notes: 'As M1, reasoning off.' },

  // ── Keys ────────────────────────────────────────────────────────────────────
  { id: 'K0', stage: 'keys', label: "today's settings", batch: false,
    writer: { provider: 'openrouter', model: FLASH_36, thinkingLevel: 'MINIMAL' },
    verifier: { provider: 'openrouter', model: 'openai/gpt-5.4-mini', thinkingLevel: 'MINIMAL' },
    notes: 'The writer and verifier of the small run.' },
  { id: 'K1', stage: 'keys', label: 'gpt-6-luna writes, Gemini verifies, in batch', batch: true,
    writer: { provider: 'openrouter', model: LUNA, reasoningEffort: 'low' },
    verifier: { provider: 'openrouter', model: FLASH_36, thinkingLevel: 'MINIMAL' },
    notes: 'Writer and verifier are different families (openai, google). The Gemini verifier is gemini-3.6-flash; the request named only "Gemini".' },
];

export class ProfileError extends Error {}

export function profileById<T extends Profile = Profile>(id: string, stage?: StageId): T {
  const p = PROFILES.find((x) => x.id === id);
  if (!p) throw new ProfileError(`unknown profile "${id}" (known: ${PROFILES.map((x) => x.id).join(', ')})`);
  if (stage && p.stage !== stage) throw new ProfileError(`profile ${id} is a ${p.stage} profile, not a ${stage} profile`);
  return p as T;
}

export interface ProfileSet {
  reading: ReadingProfile;
  escalation?: EscalationProfile;
  marking: MarkingProfile;
  keys?: KeyProfile;
  /** Writes the mutation variants of a dataset; checked against the grader. */
  mutationModel: string;
}

/** Picks profiles by id. Refuses a combination that breaks a family rule. */
export function loadProfileSet(ids: { reading: string; escalation?: string; marking: string; keys?: string }, mutationModel = DEFAULT_MUTATION_MODEL): ProfileSet {
  const set: ProfileSet = {
    reading: profileById<ReadingProfile>(ids.reading, 'reading'),
    escalation: ids.escalation ? profileById<EscalationProfile>(ids.escalation, 'escalation') : undefined,
    marking: profileById<MarkingProfile>(ids.marking, 'marking'),
    keys: ids.keys ? profileById<KeyProfile>(ids.keys, 'keys') : undefined,
    mutationModel,
  };
  assertFamilyRules(set);
  return set;
}

export function assertFamilyRules(set: Pick<ProfileSet, 'marking' | 'keys' | 'mutationModel'>): void {
  if (set.keys) {
    const w = modelFamily(set.keys.writer.model);
    const v = modelFamily(set.keys.verifier.model);
    if (w === v) throw new ProfileError(`key profile ${set.keys.id}: writer (${set.keys.writer.model}) and verifier (${set.keys.verifier.model}) are both ${w}; the verifier must be another model family`);
  }
  const g = modelFamily(set.marking.call.model);
  const m = modelFamily(set.mutationModel);
  if (g === m) throw new ProfileError(`marking profile ${set.marking.id}: the grader (${set.marking.call.model}) and the mutation generator (${set.mutationModel}) are both ${g}; the generator must be another model family`);
}
