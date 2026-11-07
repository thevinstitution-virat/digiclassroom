// The board-paper bank, phase 2: the rules of the person check, without a database (bank-review-db.test.ts has the database side).

import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, rowKey, type ExpandedPaper } from '@/lib/hw/bank/expand';
import {
  paperTotalMarks, parseVerdictFile, planReview, renderReviewPlan, reviewStatus, REVIEW_FORMAT,
  type LastReview, type ReviewPaper, type ReviewRow, type VerdictFile, type VerdictIn,
} from '@/lib/hw/bank/review';
import { renderReviewSheet, type ReviewSheetData } from '@/lib/hw/bank/review-sheet';

const paperX: ExpandedPaper = expandBank(cloneBank());

function rows(edit: (r: ReviewRow[]) => void = () => {}): ReviewRow[] {
  const out: ReviewRow[] = paperX.questions.map((q, i) => ({
    id: `id-${i}`, number: q.number, alt: q.alt, variant: q.variant, status: 'draft', contentHash: q.contentHash, version: 1, needsCheck: q.needsCheck, marks: q.marks, choiceGroup: q.choiceGroup,
  }));
  edit(out);
  return out;
}
const paper = (status: ReviewPaper['status'] = 'draft'): ReviewPaper => ({ id: 'p1', status, maxMarks: 10 });
const find = (rs: ReviewRow[], number: number, alt: string | null = null, variant: string | null = null) => rs.find((r) => rowKey(r) === rowKey({ number, alt, variant }))!;

function verdict(r: ReviewRow, v: Partial<VerdictIn> = {}): VerdictIn {
  return { q: r.number, alt: r.alt as VerdictIn['alt'], variant: r.variant as VerdictIn['variant'], content_hash: r.contentHash, verdict: 'ok', confirmed: [...r.needsCheck], note: '', ...v };
}
const fileOf = (verdicts: VerdictIn[], reviewer = 'Mrs Rao'): VerdictFile => ({
  format: REVIEW_FORMAT, paper: { board: 'TESTBOARD', klass: 10, code: 'T-001', year: '2099-00', kind: 'sqp' }, reviewer, verdicts,
});
const allOk = (rs: ReviewRow[]) => fileOf(rs.map((r) => verdict(r)));

describe('verdict file', () => {
  const good = JSON.stringify(fileOf([verdict(find(rows(), 1))]));
  it('parses a good file and fills in alt and variant', () => {
    const f = JSON.parse(good);
    delete f.verdicts[0].alt;
    delete f.verdicts[0].variant;
    const r = parseVerdictFile(JSON.stringify(f));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.verdicts[0]).toMatchObject({ alt: null, variant: null, confirmed: [] });
  });
  it.each([
    ['not json', '{nope', /not valid JSON/],
    ['a short hash', JSON.stringify({ ...JSON.parse(good), verdicts: [{ ...JSON.parse(good).verdicts[0], content_hash: 'abc' }] }), /content hash/],
    ['no reviewer name', JSON.stringify({ ...JSON.parse(good), reviewer: ' ' }), /name/],
    ['no verdicts', JSON.stringify({ ...JSON.parse(good), verdicts: [] }), /no verdicts/],
    ['another format', JSON.stringify({ ...JSON.parse(good), format: 'x/1' }), /format/],
    ['an unknown verdict', JSON.stringify({ ...JSON.parse(good), verdicts: [{ ...JSON.parse(good).verdicts[0], verdict: 'maybe' }] }), /verdict/],
  ])('refuses %s', (_n, text, re) => {
    const r = parseVerdictFile(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join('\n')).toMatch(re);
  });
});

describe('planReview — ok', () => {
  it('checks a row with nothing to look at', () => {
    const rs = rows();
    const q1 = find(rs, 1);
    expect(q1.needsCheck).toEqual([]);
    const p = planReview(paper(), rs, [], fileOf([verdict(q1)]));
    expect(p.problems).toEqual([]);
    expect(p.counts.check).toBe(1);
    expect(p.paperAfter).toBeNull();
    expect(p.remaining).toBe(8);
  });

  it('needs every flagged item confirmed, word for word', () => {
    const rs = rows();
    const q4 = find(rs, 4);
    expect(q4.needsCheck.length).toBeGreaterThanOrEqual(4);
    const none = planReview(paper(), rs, [], fileOf([verdict(q4, { confirmed: [] })]));
    expect(none.problems[0]).toMatch(/Q4: ok, but \d+ things to look at were not confirmed/);
    expect(none.counts.check).toBe(0);
    const some = planReview(paper(), rs, [], fileOf([verdict(q4, { confirmed: q4.needsCheck.slice(1) })]));
    expect(some.problems[0]).toContain(JSON.stringify(q4.needsCheck[0]));
    const all = planReview(paper(), rs, [], fileOf([verdict(q4)]));
    expect(all.problems).toEqual([]);
    expect(all.counts.check).toBe(1);
  });

  it('refuses a confirmation of something the question does not list (a sheet made for other flags)', () => {
    const rs = rows();
    const p = planReview(paper(), rs, [], fileOf([verdict(find(rs, 1), { confirmed: ['something else'] })]));
    expect(p.problems[0]).toMatch(/Q1: confirms something the question does not list/);
  });

  it('is already recorded when the row is checked', () => {
    const rs = rows((r) => { find(r, 1).status = 'checked'; });
    const p = planReview(paper(), rs, [], fileOf([verdict(find(rs, 1))]));
    expect(p.problems).toEqual([]);
    expect(p.counts).toMatchObject({ unchanged: 1, check: 0 });
    expect(p.changes).toBe(false);
  });

  it('refuses ok on a rejected row', () => {
    const rs = rows((r) => { find(r, 1).status = 'rejected'; });
    expect(planReview(paper(), rs, [], fileOf([verdict(find(rs, 1))])).problems[0]).toMatch(/Q1: rejected/);
  });
});

describe('planReview — what a verdict is bound to', () => {
  it('refuses a verdict for content that has changed since the sheet', () => {
    const rs = rows();
    const p = planReview(paper(), rs, [], fileOf([verdict(find(rs, 1), { content_hash: 'a'.repeat(64) })]));
    expect(p.problems[0]).toMatch(/Q1: the question changed after this sheet was made/);
  });
  it('refuses a question that is not in the bank, and two verdicts for one question', () => {
    const rs = rows();
    const q1 = find(rs, 1);
    const p = planReview(paper(), rs, [], fileOf([verdict(q1, { q: 99 }), verdict(q1), verdict(q1)]));
    expect(p.problems).toEqual(['Q99: not in the bank', 'Q1: two verdicts for the same question']);
  });
  it('tells the alternatives and the visually impaired versions apart', () => {
    const rs = rows();
    const p = planReview(paper(), rs, [], fileOf([verdict(find(rs, 2, 'A')), verdict(find(rs, 2, 'B')), verdict(find(rs, 1, null, 'vi')), verdict(find(rs, 1))]));
    expect(p.problems).toEqual([]);
    expect(p.counts.check).toBe(4);
  });
  it('is all or nothing: a good verdict next to a bad one still reports the problem', () => {
    const rs = rows();
    const p = planReview(paper(), rs, [], fileOf([verdict(find(rs, 1)), verdict(find(rs, 4), { confirmed: [] })]));
    expect(p.problems).toHaveLength(1);
    expect(renderReviewPlan(p, 'Mrs Rao')).toContain('PROBLEM Q4');
  });
  it('does not review a published paper or a published row', () => {
    const rs = rows((r) => { find(r, 1).status = 'published'; });
    expect(planReview(paper(), rs, [], fileOf([verdict(find(rs, 1))])).problems[0]).toMatch(/Q1: published/);
    expect(planReview(paper('published'), rows(), [], fileOf([verdict(find(rows(), 1))])).problems[0]).toMatch(/paper is published/);
  });
});

describe('planReview — fix and reject', () => {
  it('must say what is wrong', () => {
    const rs = rows();
    expect(planReview(paper(), rs, [], fileOf([verdict(find(rs, 1), { verdict: 'fix', note: '  ' })])).problems[0]).toMatch(/Q1: fix must say what is wrong/);
    expect(planReview(paper(), rs, [], fileOf([verdict(find(rs, 1), { verdict: 'reject' })])).problems[0]).toMatch(/Q1: reject must say what is wrong/);
  });
  it('notes a fix on a draft row, once', () => {
    const rs = rows();
    const q = find(rs, 1);
    const v = verdict(q, { verdict: 'fix', confirmed: [], note: 'Option B is wrong in the scheme' });
    const first = planReview(paper(), rs, [], fileOf([v]));
    expect(first.counts.note_fix).toBe(1);
    const last: LastReview[] = [{ questionId: q.id, contentHash: q.contentHash, verdict: 'fix', note: 'Option B is wrong in the scheme', reviewer: 'Mrs Rao' }];
    const again = planReview(paper(), rs, last, fileOf([v]));
    expect(again.counts).toMatchObject({ note_fix: 0, unchanged: 1 });
    expect(again.changes).toBe(false);
    // a different note is a new decision
    expect(planReview(paper(), rs, last, fileOf([{ ...v, note: 'Also the marks' }])).counts.note_fix).toBe(1);
  });
  it('withdraws the check of a checked row on a fix, and the paper goes back to draft', () => {
    const rs = rows((r) => r.forEach((x) => { x.status = 'checked'; }));
    const p = planReview(paper('checked'), rs, [], fileOf([verdict(find(rs, 3, 'C'), { verdict: 'fix', confirmed: [], note: 'D is Fungi, not Mould' })]));
    expect(p.counts.withdraw).toBe(1);
    expect(p.paperAfter).toBe('draft');
    expect(p.remaining).toBe(1);
  });
  it('rejects a row, and a rejected row stays rejected on a second file', () => {
    const rs = rows();
    const v = verdict(find(rs, 4), { verdict: 'reject', confirmed: [], note: 'The figure cannot be read' });
    expect(planReview(paper(), rs, [], fileOf([v])).counts.reject).toBe(1);
    const rs2 = rows((r) => { find(r, 4).status = 'rejected'; });
    const p = planReview(paper(), rs2, [], fileOf([v]));
    expect(p.counts).toMatchObject({ unchanged: 1, reject: 0 });
    expect(p.changes).toBe(false);
  });
});

describe('planReview — the paper as a whole', () => {
  it('becomes checked when every row is, and the marks add up', () => {
    const rs = rows();
    const p = planReview(paper(), rs, [], allOk(rs));
    expect(p.problems).toEqual([]);
    expect(p.counts.check).toBe(9);
    expect(p.paperAfter).toBe('checked');
    expect(p.remaining).toBe(0);
  });
  it('stays as it is while one row is not checked', () => {
    const rs = rows();
    const p = planReview(paper(), rs, [], fileOf(rs.slice(1).map((r) => verdict(r))));
    expect(p.paperAfter).toBeNull();
    expect(p.remaining).toBe(1);
  });
  it('is not checked with a rejected row in it', () => {
    const rs = rows();
    const p = planReview(paper(), rs, [], fileOf(rs.map((r) => (r.number === 4 ? verdict(r, { verdict: 'reject', confirmed: [], note: 'unreadable' }) : verdict(r)))));
    expect(p.problems).toEqual([]);
    expect(p.paperAfter).toBeNull();
    expect(p.remaining).toBe(1);
  });
  it('refuses when everything is checked but the marks do not add up to the paper', () => {
    const rs = rows();
    const p = planReview({ ...paper(), maxMarks: 11 }, rs, [], allOk(rs));
    expect(p.problems).toEqual(['all rows would be checked but they add to 10 marks, the paper says 11']);
  });
  it('counts an internal choice once and leaves the visually impaired versions out of the total', () => {
    expect(paperTotalMarks(rows())).toEqual({ total: 10, problems: [] });
    const odd = rows((r) => { find(r, 2, 'B').marks = 3; });
    expect(paperTotalMarks(odd).problems[0]).toMatch(/Q2: its alternatives carry different marks/);
  });
});

describe('reviewStatus', () => {
  it('counts the rows and lists the fixes that are waiting', () => {
    const rs = rows((r) => { find(r, 1).status = 'checked'; find(r, 4).status = 'rejected'; });
    const q3 = find(rs, 3, 'C');
    const last: LastReview[] = [{ questionId: q3.id, contentHash: q3.contentHash, verdict: 'fix', note: 'wrong organism', reviewer: 'Mrs Rao' }];
    const s = reviewStatus(paper(), rs, last);
    expect(s.counts).toMatchObject({ total: 9, checked: 1, rejected: 1, draft: 7 });
    expect(s.openFixes).toEqual([{ label: 'Q3C', note: 'wrong organism', reviewer: 'Mrs Rao' }]);
    expect(s.unreviewed).toBe(6);
    // a fix for content that has since changed is no longer waiting
    const stale = reviewStatus(paper(), rs, [{ ...last[0], contentHash: 'b'.repeat(64) }]);
    expect(stale.openFixes).toEqual([]);
    expect(stale.unreviewed).toBe(7);
  });
});

describe('the review sheet', () => {
  const data = (stem = 'Which gas do plants take in?'): ReviewSheetData => ({
    paper: { board: 'TESTBOARD', klass: 10, subject: 'Science', code: 'T-001', year: '2099-00', kind: 'sqp', title: 'TEST <PAPER> & "SAMPLE"', maxMarks: 10, status: 'draft', version: 1 },
    rows: paperX.questions.slice(0, 3).map((q, i) => ({
      number: q.number, alt: q.alt, variant: q.variant, section: q.section, marks: q.marks, qtype: q.qtype, stem: i === 0 ? stem : q.stem, options: q.options, correctOption: q.correctOption,
      parts: q.parts, schemeText: q.schemeText, equations: q.equations, diagramParts: q.diagramParts, needsCheck: q.needsCheck, status: 'draft', version: 1, contentHash: q.contentHash,
      checkedBy: null, choiceGroup: q.choiceGroup,
      figures: q.figures.map((f) => ({ figureId: f.figureId, side: f.side, description: f.description, labels: f.labels, readings: f.readings, confidence: f.confidence, needsPersonCheck: f.needsPersonCheck, note: f.note })),
    })),
  });
  const embedded = (html: string) => JSON.parse(/<script type="application\/json" id="sheet-data">([\s\S]*?)<\/script>/.exec(html)![1]);

  it('carries every row and its content hash, and the format the review command reads', () => {
    const html = renderReviewSheet(data());
    const d = embedded(html);
    expect(d.format).toBe(REVIEW_FORMAT);
    expect(d.rows).toHaveLength(3);
    expect(d.rows[0].contentHash).toBe(paperX.questions[0].contentHash);
    expect(d.paper).toEqual({ board: 'TESTBOARD', klass: 10, code: 'T-001', year: '2099-00', kind: 'sqp' });
  });
  it('cannot be broken out of by the paper text', () => {
    const html = renderReviewSheet(data('</script><script>alert(1)</script> <!-- &  '));
    expect(html.match(/<\/script>/g)).toHaveLength(2);   // the data block and the page script, nothing from the paper
    expect(embedded(html).rows[0].stem).toBe('</script><script>alert(1)</script> <!-- &  ');
    expect(html).toContain('TEST &lt;PAPER&gt; &amp; &quot;SAMPLE&quot;');
  });
  it('has a page script that parses', () => {
    const script = /<script>([\s\S]*)<\/script>\s*<\/body>/.exec(renderReviewSheet(data()))![1];
    expect(() => new Function(script)).not.toThrow();
  });
});
