// A photographed page of the printed answer sheet, read box by box (docs/hw-eval/printed-sheet-read-1.md): code finds the page and which
// one it is, reads the multiple-choice grid from the ink, and finds the boxes with writing; the reader model transcribes each such box, cut out
// at full size. What comes back is an ordinary page read (page-reader.ts), so placement (assemble.ts, mapping.ts) is unchanged: a box's
// question is certain, a grid letter is the letter, and nothing here asks a model which question an answer belongs to.
//
// Split in two so the reads can run now or in a provider batch (evaluate.ts): planSheetPhoto (code only: what to read) and sheetPageRead
// (the reads back into a page). Any page the plan cannot settle (not this set's sheet, no corners, a strip that does not check out) returns the
// reason, and the caller reads the page as before. A grid row with two letters marked becomes an answer a person looks at, never a guess.

import type { AiResult } from '../ai';
import { decodeRaster, encodeJpeg } from './crop';
import type { BoxRead, ExamAi, PageRead, PaperQuestionRef, ReadSegment } from './page-reader';
import type { SheetLayout } from './sheet';
import { pageGeometry } from './sheet-geometry';
import { boxHasWriting, cropMm, findCorners, readGrid, readStrip, rectify, toGrey, type GridMark } from './sheet-vision';

/** One read the page needs: an answer box (its question known), or an extra page's writing area (numbers written by the learner). */
export type SheetRequest = { kind: 'box'; numbers: number[]; alternatives: string[]; image: Uint8Array } | { kind: 'extra'; image: Uint8Array };

export type SheetPlan =
  | { ok: true; sheet: { code: string; page: number }; grid: PageRead['grid']; marks: GridMark[]; fixed: ReadSegment[]; requests: SheetRequest[] }
  | { ok: false; reason: string };

/** Code only: find the page, read its grid, cut out the boxes with writing. No model is called. */
export async function planSheetPhoto(input: { image: Uint8Array; layout: SheetLayout; sharp: import('./crop').SharpFn }): Promise<SheetPlan> {
  const { sharp, layout } = input;
  const photo = await decodeRaster(sharp, input.image);
  const corners = findCorners(toGrey(photo));
  if (!('points' in corners)) return { ok: false, reason: corners.reason };
  const page = rectify(photo, corners.points);
  const id = readStrip(page);
  if (!id) return { ok: false, reason: 'the page code strip could not be read' };
  if (id.code !== layout.code) return { ok: false, reason: `a page of sheet ${id.code}, not ${layout.code}` };
  const sp = layout.pages.find((p) => p.page === id.page);
  if (!sp) return { ok: false, reason: `sheet page ${id.page} does not exist` };

  const grid: PageRead['grid'] = [];
  const marks: GridMark[] = [];
  const fixed: ReadSegment[] = [];
  const requests: SheetRequest[] = [];
  for (const [i, g] of pageGeometry(sp, true).entries()) {
    if (g.kind === 'grid') {
      for (const m of readGrid(page, g)) {
        marks.push(m);
        if (m.state === 'marked') for (const n of m.numbers) grid.push({ number: n, letter: m.letter });
        // two letters marked: a person decides (an unreadable answer in that question's box, which placement sends to review)
        if (m.state === 'several') fixed.push({ box: m.numbers, numbersSeen: [], alternative: null, text: '[?]', confidence: 0.4, unclearCount: 1 });
      }
      continue;
    }
    if (!boxHasWriting(page, g.box)) continue;
    if (g.kind === 'answer') {
      const block = sp.blocks[i]!;
      // the box with its printed label and "Answering: [] A [] B" beside it
      const image = await encodeJpeg(sharp, cropMm(page, { x: g.gutter.x, y: g.rect.y, w: g.gutter.w + g.box.w, h: g.rect.h }));
      requests.push({ kind: 'box', numbers: g.numbers, alternatives: block.kind === 'answer' ? block.alternatives : [], image });
    } else {
      requests.push({ kind: 'extra', image: await encodeJpeg(sharp, cropMm(page, g.box)) });
    }
  }
  return { ok: true, sheet: id, grid, marks, fixed, requests };
}

export type SheetOutput = { kind: 'box'; read: BoxRead } | { kind: 'page'; read: PageRead };

/** The plan's reads (in the plan's order) back into one page read. */
export function sheetPageRead(plan: Extract<SheetPlan, { ok: true }>, outputs: SheetOutput[]): PageRead {
  const segments: ReadSegment[] = [...plan.fixed];
  plan.requests.forEach((req, i) => {
    const out = outputs[i];
    if (!out) throw new Error(`sheet page ${plan.sheet.page}: read ${i} is missing`);
    if (req.kind === 'box' && out.kind === 'box') {
      if (out.read.text || out.read.numbersSeen.length) segments.push({ box: req.numbers, ...out.read });
    } else if (req.kind === 'extra' && out.kind === 'page') {
      // an extra page: answers with their own written numbers, read like plain paper
      for (const s of out.read.segments) segments.push({ ...s, box: [] });
    } else throw new Error(`sheet page ${plan.sheet.page}: read ${i} is the wrong kind`);
  });
  return { sheet: plan.sheet, grid: plan.grid, segments };
}

export type SheetPhoto =
  | { ok: true; read: PageRead; calls: AiResult[]; page: number; boxesRead: number[][]; grid: GridMark[] }
  | { ok: false; reason: string; calls: AiResult[] };

/** Plan and read now (the standard path; the batch path uses the two halves above). */
export async function readSheetPhoto(input: {
  image: Uint8Array;
  layout: SheetLayout;
  questions: PaperQuestionRef[];
  lang: 'en' | 'hi';
  ai: ExamAi;
  sharp: import('./crop').SharpFn;
}): Promise<SheetPhoto> {
  const calls: AiResult[] = [];
  const { ai } = input;
  if (!ai.readBox) return { ok: false, reason: 'no box reader', calls };
  const plan = await planSheetPhoto(input);
  if (!plan.ok) return { ok: false, reason: plan.reason, calls };
  const outputs: SheetOutput[] = [];
  for (const req of plan.requests) {
    if (req.kind === 'box') {
      const { read, result } = await ai.readBox({ image: req.image, mime: 'image/jpeg', numbers: req.numbers, alternatives: req.alternatives, lang: input.lang });
      calls.push(result);
      outputs.push({ kind: 'box', read });
    } else {
      const { read, result } = await ai.readPage({ image: req.image, mime: 'image/jpeg', questions: input.questions, lang: input.lang });
      calls.push(result);
      outputs.push({ kind: 'page', read });
    }
  }
  return {
    ok: true, read: sheetPageRead(plan, outputs), calls, page: plan.sheet.page,
    boxesRead: plan.requests.map((r) => (r.kind === 'box' ? r.numbers : [])), grid: plan.marks,
  };
}
