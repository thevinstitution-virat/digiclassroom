// A photographed page of the printed answer sheet, read box by box (docs/hw-eval/real-handwriting-read-1.md): code finds the page and which
// one it is, reads the multiple-choice grid from the ink, and finds the boxes with writing; the reader model transcribes each such box, cut out
// at full size. What comes back is an ordinary page read (page-reader.ts), so placement (assemble.ts, mapping.ts) is unchanged: a box's
// question is certain, a grid letter is the letter, and nothing here asks a model which question an answer belongs to.
//
// Any page this cannot settle (not this set's sheet, no corners, a strip that does not check out) returns the reason, and the caller reads the
// page as before. A row of the grid with two letters marked becomes an answer a person looks at, never a guess.

import type { AiResult } from '../ai';
import { decodeRaster, encodeJpeg } from './crop';
import type { ExamAi, PageRead, PaperQuestionRef, ReadSegment } from './page-reader';
import type { SheetLayout } from './sheet';
import { pageGeometry } from './sheet-geometry';
import { boxHasWriting, cropMm, findCorners, readGrid, readStrip, rectify, toGrey, type GridMark } from './sheet-vision';

export type SheetPhoto =
  | { ok: true; read: PageRead; calls: AiResult[]; page: number; boxesRead: number[][]; grid: GridMark[] }
  | { ok: false; reason: string; calls: AiResult[] };

export async function readSheetPhoto(input: {
  image: Uint8Array;
  layout: SheetLayout;
  questions: PaperQuestionRef[];
  lang: 'en' | 'hi';
  ai: ExamAi;
  sharp: typeof import('sharp');
}): Promise<SheetPhoto> {
  const calls: AiResult[] = [];
  const { ai, sharp, layout } = input;
  if (!ai.readBox) return { ok: false, reason: 'no box reader', calls };
  const photo = await decodeRaster(sharp, input.image);
  const corners = findCorners(toGrey(photo));
  if (!('points' in corners)) return { ok: false, reason: corners.reason, calls };
  const page = rectify(photo, corners.points);
  const id = readStrip(page);
  if (!id) return { ok: false, reason: 'the page code strip could not be read', calls };
  if (id.code !== layout.code) return { ok: false, reason: `a page of sheet ${id.code}, not ${layout.code}`, calls };
  const sp = layout.pages.find((p) => p.page === id.page);
  if (!sp) return { ok: false, reason: `sheet page ${id.page} does not exist`, calls };

  const geo = pageGeometry(sp, true);
  const grid: PageRead['grid'] = [];
  const marks: GridMark[] = [];
  const segments: ReadSegment[] = [];
  const boxesRead: number[][] = [];
  for (const [i, g] of geo.entries()) {
    if (g.kind === 'grid') {
      for (const m of readGrid(page, g)) {
        marks.push(m);
        if (m.state === 'marked') for (const n of m.numbers) grid.push({ number: n, letter: m.letter });
        // two letters marked: a person decides (an unreadable answer in that question's box, which placement sends to review)
        if (m.state === 'several') segments.push({ box: m.numbers, numbersSeen: [], alternative: null, text: '[?]', confidence: 0.4, unclearCount: 1 });
      }
      continue;
    }
    if (!boxHasWriting(page, g.box)) continue;
    if (g.kind === 'answer') {
      const block = sp.blocks[i]!;
      const alternatives = block.kind === 'answer' ? block.alternatives : [];
      // the box with its printed label and "Answering: [] A [] B" beside it
      const image = await encodeJpeg(sharp, cropMm(page, { x: g.gutter.x, y: g.rect.y, w: g.gutter.w + g.box.w, h: g.rect.h }));
      const { read, result } = await ai.readBox({ image, mime: 'image/jpeg', numbers: g.numbers, alternatives, lang: input.lang });
      calls.push(result);
      boxesRead.push(g.numbers);
      if (read.text || read.numbersSeen.length) segments.push({ box: g.numbers, ...read });
    } else {
      // an extra page: answers with their own written numbers, read like plain paper
      const image = await encodeJpeg(sharp, cropMm(page, g.box));
      const { read, result } = await ai.readPage({ image, mime: 'image/jpeg', questions: input.questions, lang: input.lang });
      calls.push(result);
      boxesRead.push([]);
      for (const s of read.segments) segments.push({ ...s, box: [] });
    }
  }
  return { ok: true, read: { sheet: id, grid, segments }, calls, page: id.page, boxesRead, grid: marks };
}
