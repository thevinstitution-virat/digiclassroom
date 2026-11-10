// Exam packages: the printed answer sheet's layout, and matching answer pages to questions from the reader's evidence (both pure).

import { A4, SHEET, answerHeightMm, pageLabel, sheetCode, sheetLayout, type SheetItem } from '@/lib/hw/exams/sheet';
import { mapPages, type PageEvidence, type Segment } from '@/lib/hw/exams/mapping';

const item = (number: number, marks: number, qtype = 'short', over: Partial<SheetItem> = {}): SheetItem =>
  ({ number, alt: null, choiceGroup: null, marks, qtype, section: 'A', ...over });
const SET = 'c3f245f2-5aa2-4325-af7b-9c3007b9affe';
const usable = (page: number) => A4.heightMm - 2 * SHEET.marginMm - SHEET.headerMm - SHEET.footerMm - (page === 1 ? SHEET.firstPageExtraMm : 0);

describe('sheetLayout', () => {
  it('a readable code and page labels', () => {
    expect(sheetCode(SET)).toBe('C3F245');
    expect(pageLabel('C3F245', 3)).toBe('C3F245-3');
  });

  it('multiple choice answers go into one grid; each written answer gets space by its marks', () => {
    const l = sheetLayout(SET, [item(1, 1, 'mcq'), item(2, 1, 'assertion_reason'), item(3, 3), item(4, 5, 'long')]);
    const blocks = l.pages.flatMap((p) => p.blocks);
    expect(blocks[0]).toMatchObject({ kind: 'grid', entries: [{ label: 'Q1', numbers: [1] }, { label: 'Q2', numbers: [2] }] });
    expect(blocks.filter((b) => b.kind === 'answer').map((b) => b.kind === 'answer' && [b.label, b.heightMm])).toEqual([['Q3', answerHeightMm(3)], ['Q4', answerHeightMm(5)]]);
  });

  it('an internal choice is one box, saying which alternatives there are', () => {
    const l = sheetLayout(SET, [
      item(2, 2, 'very_short', { alt: 'A', choiceGroup: 'g2' }), item(2, 2, 'very_short', { alt: 'B', choiceGroup: 'g2' }),
      item(5, 3, 'short', { choiceGroup: 'x' }), item(6, 3, 'short', { choiceGroup: 'x' }),
    ]);
    const answers = l.pages.flatMap((p) => p.blocks).filter((b) => b.kind === 'answer');
    expect(answers).toEqual([
      expect.objectContaining({ label: 'Q2', numbers: [2], alternatives: ['A', 'B'] }),
      expect.objectContaining({ label: 'Q5 / Q6', numbers: [5, 6], alternatives: [] }),
    ]);
  });

  it('no box is split across pages, no page overflows, and two extra pages close the sheet', () => {
    const items = Array.from({ length: 12 }, (_, i) => item(i + 1, [2, 3, 5, 4][i % 4]!, i % 4 === 2 ? 'long' : 'short'));
    const l = sheetLayout(SET, items);
    for (const p of l.pages) {
      const used = p.blocks.reduce((s, b) => s + b.heightMm, 0) + SHEET.gapMm * Math.max(0, p.blocks.length - 1);
      expect(used).toBeLessThanOrEqual(usable(p.page));
    }
    expect(l.pages.slice(-2).every((p) => p.blocks.length === 1 && p.blocks[0]!.kind === 'extra' && p.numbers.length === 0)).toBe(true);
    // every question's box is on exactly one page, and the pages list them
    expect(l.pages.flatMap((p) => p.numbers).sort((a, b) => a - b)).toEqual(items.map((i) => i.number));
    expect(l.totalPages).toBe(l.pages.length);
    expect(l.pages.map((p) => p.label)).toEqual(l.pages.map((p) => `C3F245-${p.page}`));
  });

  it('a long run of multiple choice is split into grids that each fit a page', () => {
    const l = sheetLayout(SET, Array.from({ length: 200 }, (_, i) => item(i + 1, 1, 'mcq')));
    const grids = l.pages.flatMap((p) => p.blocks).filter((b) => b.kind === 'grid');
    expect(grids.length).toBeGreaterThan(1);
    expect(grids.reduce((n, g) => n + (g.kind === 'grid' ? g.entries.length : 0), 0)).toBe(200);
    for (const g of grids) expect(g.heightMm).toBeLessThanOrEqual(usable(2));
  });

  it('even the biggest answer fits a page', () => {
    expect(answerHeightMm(20)).toBe(SHEET.maxBlockMm);
    expect(SHEET.maxBlockMm).toBeLessThanOrEqual(usable(1));
  });
});

describe('mapPages', () => {
  const seg = (id: string, over: Partial<Segment> = {}): Segment => ({ id, sheetBox: null, numbersSeen: [], keyMatches: [], ...over });
  const boxes = new Map([[1, [1, 2, 3]], [2, [4, 5]]]);
  const all = [1, 2, 3, 4, 5];
  const page = (pageId: string, sheet: PageEvidence['sheet'], segments: Segment[]): PageEvidence => ({ pageId, sheet, segments });

  it('writing inside a printed box of the right sheet page is that question, whatever else the reader thinks', () => {
    const r = mapPages([page('p1', { code: 'c3f245', page: 1 }, [seg('s1', { sheetBox: [2], keyMatches: [{ number: 5, score: 0.7 }] })])], 'C3F245', boxes, all);
    expect(r.assignments).toEqual([{ segmentId: 's1', pageId: 'p1', numbers: [2], source: 'sheet_box' }]);
    expect(r.notAttempted).toEqual([1, 3, 4, 5]);
  });

  it('a page from another set’s sheet, or a sheet page that does not exist, goes to review', () => {
    const r = mapPages([
      page('p1', { code: 'AAAAAA', page: 1 }, [seg('s1', { sheetBox: [1] })]),
      page('p2', { code: 'C3F245', page: 9 }, [seg('s2', { sheetBox: [1] })]),
    ], 'C3F245', boxes, all);
    expect(r.assignments).toEqual([]);
    expect(r.review.map((x) => x.reason)).toEqual(['wrong_sheet', 'sheet_page_unknown']);
  });

  it('a different number written inside a printed box is not decided either way', () => {
    const r = mapPages([page('p1', { code: 'C3F245', page: 1 }, [seg('s1', { sheetBox: [2], numbersSeen: [{ number: 4, confidence: 0.95 }] })])], 'C3F245', boxes, all);
    expect(r.review).toEqual([expect.objectContaining({ segmentId: 's1', reason: 'numbers_disagree' })]);
  });

  it('on plain or extra paper, a confidently read number decides; a doubtful one does not', () => {
    const r = mapPages([page('p1', null, [
      seg('s1', { numbersSeen: [{ number: 4, confidence: 0.9 }] }),
      seg('s2', { numbersSeen: [{ number: 5, confidence: 0.5 }] }),
    ])], 'C3F245', boxes, all);
    expect(r.assignments).toEqual([{ segmentId: 's1', pageId: 'p1', numbers: [4], source: 'written_number' }]);
    expect(r.review).toEqual([expect.objectContaining({ segmentId: 's2', reason: 'nothing_conclusive' })]);
  });

  it('without a number, the answer key decides only when one question is clearly closest', () => {
    const r = mapPages([page('p1', null, [
      seg('clear', { keyMatches: [{ number: 3, score: 0.82 }, { number: 1, score: 0.4 }] }),
      seg('close-call', { keyMatches: [{ number: 3, score: 0.7 }, { number: 1, score: 0.62 }] }),
      seg('weak', { keyMatches: [{ number: 2, score: 0.45 }] }),
    ])], 'C3F245', boxes, all);
    expect(r.assignments).toEqual([{ segmentId: 'clear', pageId: 'p1', numbers: [3], source: 'answer_match' }]);
    expect(r.review.map((x) => [x.segmentId, x.reason])).toEqual([['close-call', 'nothing_conclusive'], ['weak', 'nothing_conclusive']]);
  });

  it('a confident number that the answer strongly contradicts goes to review', () => {
    const r = mapPages([page('p1', null, [seg('s1', { numbersSeen: [{ number: 1, confidence: 0.9 }], keyMatches: [{ number: 4, score: 0.9 }, { number: 1, score: 0.2 }] })])], 'C3F245', boxes, all);
    expect(r.review).toEqual([expect.objectContaining({ reason: 'numbers_disagree', detail: 'numbered Q1 but reads like the answer to Q4' })]);
  });

  it('two numbers on one stretch of writing go to review; numbers outside the paper are ignored', () => {
    const r = mapPages([page('p1', null, [
      seg('two', { numbersSeen: [{ number: 1, confidence: 0.9 }, { number: 2, confidence: 0.9 }] }),
      seg('stray', { numbersSeen: [{ number: 99, confidence: 0.99 }, { number: 5, confidence: 0.9 }] }),
    ])], 'C3F245', boxes, all);
    expect(r.review.map((x) => x.segmentId)).toEqual(['two']);
    expect(r.assignments).toEqual([expect.objectContaining({ segmentId: 'stray', numbers: [5] })]);
  });

  it('an answer continued on an extra page joins the same question, in page order', () => {
    const r = mapPages([
      page('p1', { code: 'C3F245', page: 2 }, [seg('box', { sheetBox: [4] })]),
      page('p9', { code: 'C3F245', page: 3 }, [seg('cont', { numbersSeen: [{ number: 4, confidence: 0.85 }] })]),
    ], 'C3F245', new Map([...boxes, [3, []]]), all);
    expect(r.byQuestion.get(4)!.map((a) => a.segmentId)).toEqual(['box', 'cont']);
  });
});
