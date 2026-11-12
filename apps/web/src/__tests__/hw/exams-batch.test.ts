// Exam packages, phase 5b: the batch path's rules (pure) — the promise, the reading deadline inside it, marking's window, and the file limits.

import { chunkRequests, EXAM_BATCH, markingBatchPlan, readingBatchPlan, requestBytes } from '@/lib/hw/exams/batch';

const at = (h: number) => new Date(Date.UTC(2026, 10, 12, 0, 0) + h * 3_600_000);

describe('readingBatchPlan', () => {
  it('a fresh hand-in: the promise is the window away, reading gets the first 60% of it', () => {
    expect(readingBatchPlan({ now: at(0), windowHours: 24, promisedBy: null })).toEqual({ mode: 'batch', readyBy: at(24), readBy: at(14.4) });
  });
  it('a promise made at hand-in is kept, and reading still leaves marking its 40%', () => {
    expect(readingBatchPlan({ now: at(0.1), windowHours: 24, promisedBy: at(24) })).toEqual({ mode: 'batch', readyBy: at(24), readBy: at(14.4) });
  });
  it('picked up late: reading gets what is left before marking\'s share', () => {
    expect(readingBatchPlan({ now: at(10), windowHours: 24, promisedBy: at(24) })).toEqual({ mode: 'batch', readyBy: at(24), readBy: at(14.4) });
  });
  it('too little time left to wait for a batch: read now', () => {
    expect(readingBatchPlan({ now: at(13.8), windowHours: 24, promisedBy: at(24) })).toMatchObject({ mode: 'standard' });
  });
});

describe('markingBatchPlan', () => {
  it('marking must end a margin before the promise', () => {
    expect(markingBatchPlan({ now: at(15), readyBy: at(24), windowHours: 24 })).toEqual({ batch: true, markBy: at(24 - EXAM_BATCH.markMargin * 24) });
  });
  it('too close to the promise, or no promise: mark now', () => {
    expect(markingBatchPlan({ now: at(21), readyBy: at(24), windowHours: 24 })).toMatchObject({ batch: false });
    expect(markingBatchPlan({ now: at(1), readyBy: null, windowHours: 24 })).toMatchObject({ batch: false });
  });
});

describe('chunkRequests', () => {
  it('keeps every batch inside the request and size limits, in order', () => {
    expect(chunkRequests([1, 1, 1, 1, 1], { maxRequests: 2, maxBytes: 100 })).toEqual([[0, 1], [2, 3], [4]]);
    expect(chunkRequests([60, 30, 20, 90, 5], { maxRequests: 10, maxBytes: 100 })).toEqual([[0, 1], [2], [3, 4]]);
    expect(chunkRequests([], { maxRequests: 2, maxBytes: 100 })).toEqual([]);
  });
  it('one request bigger than the limit still goes, on its own (the provider will say no, and the booklet is read now)', () => {
    expect(chunkRequests([50, 500, 50], { maxRequests: 10, maxBytes: 100 })).toEqual([[0], [1], [2]]);
  });
  it('a real booklet fits in one batch: 40 pages in halves of 300 KB each', () => {
    expect(chunkRequests(Array(80).fill(requestBytes(300_000)))).toHaveLength(1);
  });
});
