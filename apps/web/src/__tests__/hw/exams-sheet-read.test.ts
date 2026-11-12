// Exam packages: a photographed printed answer-sheet page read box by box (sheet-read.ts), with real sharp and a fake reader.

import { sheetLayout } from '@/lib/hw/exams/sheet';
import { encodeJpeg, loadSharp } from '@/lib/hw/exams/crop';
import { readSheetPhoto } from '@/lib/hw/exams/sheet-read';
import type { ExamAi } from '@/lib/hw/exams/page-reader';
import { drawPage, photograph, toRgb } from '@/test-support/hw/sheet-photo';

const items = [
  ...Array.from({ length: 8 }, (_, i) => ({ number: i + 1, alt: null, choiceGroup: null, marks: 1, qtype: 'mcq', section: 'A' })),
  { number: 9, alt: null, choiceGroup: null, marks: 2, qtype: 'short', section: 'B' },
  { number: 10, alt: null, choiceGroup: null, marks: 3, qtype: 'short', section: 'B' },
  { number: 11, alt: null, choiceGroup: null, marks: 3, qtype: 'short', section: 'B' },
];
const layout = sheetLayout('06cf23e9-b3be-42de-851b-a884acc746d8', items);
const questions = items.map((i) => ({ number: i.number, alternatives: [], choice: i.qtype === 'mcq' }));
const usage = { input: 1000, cached: 0, output: 200 };

function fakeAi() {
  const calls = { box: [] as number[][], page: 0 };
  const ai: ExamAi = {
    async readPage() {
      calls.page++;
      return { read: { sheet: null, grid: [], segments: [{ box: [], numbersSeen: [{ number: 11, confidence: 0.95 }], alternative: null, text: 'continued answer', confidence: 0.95, unclearCount: 0 }] }, result: { json: {}, usage, rawUsage: {}, model: 'test-reader' } };
    },
    async matchAnswers() { throw new Error('not used'); },
    async readBox({ numbers }) {
      calls.box.push(numbers);
      return { read: { numbersSeen: [], alternative: null, text: `written in Q${numbers.join('/')}`, confidence: 0.95, unclearCount: 0 }, result: { json: {}, usage, rawUsage: {}, model: 'test-reader' } };
    },
  };
  return { ai, calls };
}

describe('readSheetPhoto', () => {
  jest.setTimeout(60_000);
  let sharp: typeof import('sharp');
  beforeAll(async () => { sharp = (await loadSharp())!; });
  const photoOf = async (pageNo: number, opts: Parameters<typeof drawPage>[2], l = layout) => encodeJpeg(sharp, toRgb(photograph(drawPage(l, pageNo, opts), { width: 1200, height: 1650 })), 85);

  it('reads the grid by code and sends only the boxes with writing to the reader', async () => {
    const { ai, calls } = fakeAi();
    const r = await readSheetPhoto({ image: await photoOf(1, { marks: { 1: 'C', 4: 'A', 6: ['B', 'D'] }, ink: [10] }), layout, questions, lang: 'en', ai, sharp });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.read.sheet).toEqual({ code: '06CF23', page: 1 });
    expect(r.read.grid).toEqual([{ number: 1, letter: 'C' }, { number: 4, letter: 'A' }]);
    expect(r.read.segments).toEqual([
      { box: [6], numbersSeen: [], alternative: null, text: '[?]', confidence: 0.4, unclearCount: 1 }, // two letters marked: for a person
      { box: [10], numbersSeen: [], alternative: null, text: 'written in Q10', confidence: 0.95, unclearCount: 0 },
    ]);
    expect(calls).toEqual({ box: [[10]], page: 0 });
    expect(r.calls).toHaveLength(1);
  });

  it('an extra page is read as plain writing, with the numbers the learner wrote', async () => {
    const { ai, calls } = fakeAi();
    const extraPage = layout.pages.find((p) => p.blocks.some((b) => b.kind === 'extra'))!.page;
    const r = await readSheetPhoto({ image: await photoOf(extraPage, { extraInk: true }), layout, questions, lang: 'en', ai, sharp });
    expect(r.ok && r.read.segments).toEqual([{ box: [], numbersSeen: [{ number: 11, confidence: 0.95 }], alternative: null, text: 'continued answer', confidence: 0.95, unclearCount: 0 }]);
    expect(calls).toEqual({ box: [], page: 1 });
  });

  it('a page of another set\'s sheet is not read here: the caller reads it as a page', async () => {
    const { ai, calls } = fakeAi();
    const other = sheetLayout('a1b2c3d4-0000-4000-8000-000000000000', items);
    const r = await readSheetPhoto({ image: await photoOf(1, { ink: [9] }, other), layout, questions, lang: 'en', ai, sharp });
    expect(r).toMatchObject({ ok: false, reason: 'a page of sheet A1B2C3, not 06CF23' });
    expect(calls).toEqual({ box: [], page: 0 });
  });

  it('a reader that cannot read boxes leaves every page to the page reader', async () => {
    const { ai } = fakeAi();
    const r = await readSheetPhoto({ image: await photoOf(1, {}), layout, questions, lang: 'en', ai: { readPage: ai.readPage, matchAnswers: ai.matchAnswers }, sharp });
    expect(r).toMatchObject({ ok: false, reason: 'no box reader' });
  });
});
