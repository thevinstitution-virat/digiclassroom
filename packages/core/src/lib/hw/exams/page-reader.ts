// Phase 5: reading a booklet page and matching answers by content. The calls go through the same AI layer as the rest of the Virat Evaluator
// (provider routing, usage, cost); the parsers are pure and defensive — the model's JSON is validated again here, and anything malformed
// becomes an empty, low-confidence result rather than an exception that loses the page.

import { generate, imagePart, routed, textPart, type AiResult } from '../ai';
import type { GeminiCall } from '../gemini/client';
import {
  EXAM_PAGE_READ_PROMPT_VERSION, EXAM_PAGE_READ_SCHEMA, EXAM_PAGE_READ_SYSTEM_PROMPT, examPageLabel,
} from '../prompts/exam-page-read.v1';
import { ANSWER_MATCH_PROMPT_VERSION, ANSWER_MATCH_SCHEMA, ANSWER_MATCH_SYSTEM_PROMPT, answerMatchInput, type MatchQuestion } from '../prompts/answer-match.v1';
import { EXAM_BOX_READ_PROMPT_VERSION, EXAM_BOX_READ_SCHEMA, EXAM_BOX_READ_SYSTEM_PROMPT, examBoxLabel } from '../prompts/exam-box-read.v1';
import { CONFIDENCE_VALUE } from '../reader/parse';
import { parseWritingProfile, WRITING_PROFILE_SCHEMA, WRITING_PROFILE_SYSTEM_PROMPT, writingProfileInput, type WritingProfile } from '../prompts/writing-profile.v1';
import type { KeyMatch, NumberSeen } from './mapping';

export { EXAM_PAGE_READ_PROMPT_VERSION, ANSWER_MATCH_PROMPT_VERSION, EXAM_BOX_READ_PROMPT_VERSION };

export interface PaperQuestionRef { number: number; alternatives: string[]; choice: boolean }

export interface ReadSegment {
  /** Question numbers of the printed box the writing sits in (parsed from labels like "Q12"); empty when not in a box. */
  box: number[];
  numbersSeen: NumberSeen[];
  alternative: string | null;
  text: string;
  confidence: number;
  unclearCount: number;
}
export interface PageRead {
  sheet: { code: string; page: number } | null;
  grid: { number: number; letter: 'A' | 'B' | 'C' | 'D' | null }[];
  segments: ReadSegment[];
}

const conf = (v: unknown): number => CONFIDENCE_VALUE[(v as keyof typeof CONFIDENCE_VALUE)] ?? CONFIDENCE_VALUE.low;
/** Unreadable-word markers; the model sometimes writes [??] for a longer unreadable stretch, which counts once. */
const unclear = (t: string) => (t.match(/\[\?+\]/g) ?? []).length;
const qNumber = (label: unknown): number | null => {
  const m = /(\d{1,3})/.exec(String(label ?? ''));
  return m ? Number(m[1]) : null;
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The model's page JSON, checked field by field. */
export function parsePageRead(json: unknown): PageRead {
  const o = isObj(json) ? json : {};
  const sheetRaw = isObj(o.sheet) ? o.sheet : null;
  const code = sheetRaw && typeof sheetRaw.code === 'string' ? sheetRaw.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
  const page = sheetRaw && Number.isInteger(sheetRaw.page) ? (sheetRaw.page as number) : NaN;
  const sheet = code.length >= 4 && page >= 1 ? { code: code.slice(0, 12), page } : null;

  const grid = (Array.isArray(o.grid) ? o.grid : []).flatMap((g) => {
    if (!isObj(g) || !Number.isInteger(g.number)) return [];
    const letter = typeof g.letter === 'string' && /^[A-D]$/.test(g.letter.toUpperCase()) ? (g.letter.toUpperCase() as 'A' | 'B' | 'C' | 'D') : null;
    return [{ number: g.number as number, letter }];
  });

  const segments = (Array.isArray(o.segments) ? o.segments : []).flatMap((s): ReadSegment[] => {
    if (!isObj(s)) return [];
    const text = typeof s.text === 'string' ? s.text.trim() : '';
    const box = (Array.isArray(s.box) ? s.box : []).map(qNumber).filter((n): n is number => n !== null);
    const numbersSeen = (Array.isArray(s.written_numbers) ? s.written_numbers : []).flatMap((w) =>
      isObj(w) && Number.isInteger(w.number) ? [{ number: w.number as number, confidence: conf(w.confidence) }] : []);
    const alt = typeof s.alternative === 'string' && /^[A-Da-d]$/.test(s.alternative.trim()) ? s.alternative.trim().toUpperCase() : null;
    if (!text && !box.length && !numbersSeen.length) return [];
    return [{ box: [...new Set(box)], numbersSeen, alternative: alt, text, confidence: conf(s.confidence), unclearCount: unclear(text) }];
  });
  return { sheet, grid, segments };
}

/** One cut-out answer box, read: the same fields as a page segment, without the placement (code already knows the box). */
export interface BoxRead { numbersSeen: NumberSeen[]; alternative: string | null; text: string; confidence: number; unclearCount: number }

export function parseBoxRead(json: unknown): BoxRead {
  const o = isObj(json) ? json : {};
  const text = typeof o.text === 'string' ? o.text.trim() : '';
  const numbersSeen = (Array.isArray(o.written_numbers) ? o.written_numbers : []).flatMap((w) =>
    isObj(w) && Number.isInteger(w.number) ? [{ number: w.number as number, confidence: conf(w.confidence) }] : []);
  const alt = typeof o.alternative === 'string' && /^[A-Da-d]$/.test(o.alternative.trim()) ? o.alternative.trim().toUpperCase() : null;
  return { numbersSeen, alternative: alt, text, confidence: conf(o.confidence), unclearCount: unclear(text) };
}

export function boxReadCall(model: string, image: Uint8Array, mime: 'image/png' | 'image/jpeg' | 'image/webp', numbers: number[], alternatives: string[], lang: 'en' | 'hi'): GeminiCall {
  return {
    model,
    systemInstruction: EXAM_BOX_READ_SYSTEM_PROMPT,
    schema: EXAM_BOX_READ_SCHEMA,
    parts: [textPart(examBoxLabel(numbers, alternatives, lang)), imagePart(image, mime, 'HIGH')],
  };
}

export function writingProfileCall(model: string, answers: { label: string; text: string }[]): GeminiCall {
  return { model, systemInstruction: WRITING_PROFILE_SYSTEM_PROMPT, schema: WRITING_PROFILE_SCHEMA, parts: [textPart(writingProfileInput(answers))] };
}

export function pageReadCall(model: string, image: Uint8Array, mime: 'image/png' | 'image/jpeg' | 'image/webp', questions: PaperQuestionRef[], lang: 'en' | 'hi'): GeminiCall {
  return {
    model,
    systemInstruction: EXAM_PAGE_READ_SYSTEM_PROMPT,
    schema: EXAM_PAGE_READ_SCHEMA,
    parts: [textPart(examPageLabel(questions, lang)), imagePart(image, mime, 'HIGH')],
  };
}

/** The model's answer-match JSON: for each answer id asked about, its scores (clamped to 0..1), only for questions on the paper. */
export function parseAnswerMatch(json: unknown, askedIds: string[], paperNumbers: number[]): Map<string, KeyMatch[]> {
  const out = new Map<string, KeyMatch[]>(askedIds.map((id) => [id, []]));
  const o = isObj(json) ? json : {};
  for (const a of Array.isArray(o.answers) ? o.answers : []) {
    if (!isObj(a) || typeof a.id !== 'string' || !out.has(a.id)) continue;
    const ms = (Array.isArray(a.matches) ? a.matches : []).flatMap((m) =>
      isObj(m) && Number.isInteger(m.number) && paperNumbers.includes(m.number as number) && typeof m.score === 'number' && Number.isFinite(m.score)
        ? [{ number: m.number as number, score: Math.max(0, Math.min(1, m.score)) }] : []);
    // one score per question: the highest the model gave
    const best = new Map<number, number>();
    for (const m of ms) best.set(m.number, Math.max(best.get(m.number) ?? 0, m.score));
    out.set(a.id, [...best].map(([number, score]) => ({ number, score })));
  }
  return out;
}

export function answerMatchCall(model: string, questions: MatchQuestion[], answers: { id: string; text: string }[]): GeminiCall {
  return {
    model,
    systemInstruction: ANSWER_MATCH_SYSTEM_PROMPT,
    schema: ANSWER_MATCH_SCHEMA,
    parts: [textPart(answerMatchInput(questions, answers))],
  };
}

/** What the evaluation needs from the model; the real one calls the provider, tests pass a fake. */
export interface ExamAi {
  readPage(input: { image: Uint8Array; mime: 'image/png' | 'image/jpeg' | 'image/webp'; questions: PaperQuestionRef[]; lang: 'en' | 'hi' }): Promise<{ read: PageRead; result: AiResult }>;
  matchAnswers(input: { questions: MatchQuestion[]; answers: { id: string; text: string }[] }): Promise<{ matches: Map<string, KeyMatch[]>; result: AiResult }>;
  /** One answer box cut out of a printed sheet page (sheet-read.ts). Absent: printed pages are read whole, like plain paper. */
  readBox?(input: { image: Uint8Array; mime: 'image/png' | 'image/jpeg' | 'image/webp'; numbers: number[]; alternatives: string[]; lang: 'en' | 'hi' }): Promise<{ read: BoxRead; result: AiResult }>;
  /** The report's writing check (exams/report.ts), text only. Absent: the three writing parameters are reported as not checked. */
  writingProfile?(input: { answers: { label: string; text: string }[] }): Promise<{ profile: WritingProfile | null; result: AiResult }>;
}

export function liveExamAi(models: { read: string; match: string }): ExamAi {
  return {
    async readPage(i) {
      const result = await generate(routed(pageReadCall(models.read, i.image, i.mime, i.questions, i.lang), 'read'));
      return { read: parsePageRead(result.json), result };
    },
    async matchAnswers(i) {
      const result = await generate(routed(answerMatchCall(models.match, i.questions, i.answers), 'grade'));
      return { matches: parseAnswerMatch(result.json, i.answers.map((a) => a.id), i.questions.map((q) => q.number)), result };
    },
    async readBox(i) {
      const result = await generate(routed(boxReadCall(models.read, i.image, i.mime, i.numbers, i.alternatives, i.lang), 'read'));
      return { read: parseBoxRead(result.json), result };
    },
    async writingProfile(i) {
      const result = await generate(routed(writingProfileCall(models.match, i.answers), 'grade'));
      return { profile: parseWritingProfile(result.json), result };
    },
  };
}
