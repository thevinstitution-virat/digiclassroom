// Virat Evaluator measurement metrics, checked against values computed by hand.

import { alignWords, graphemes, levenshtein, normaliseForReading, scoreReading, summariseReading, words } from '@/lib/hw/eval/reading'
import {
  allRunsIdentical, detectionRate, falseCreditRate, icc21, injectionResistance, invarianceRate,
  krippendorffAlpha, meanSpread, qwk, summariseMarking, verdictConfusion,
} from '@/lib/hw/eval/agreement'
import { bootstrapCI, seededRandom } from '@/lib/hw/eval/bootstrap'
import { scoreSample } from '@/lib/hw/eval/metrics'

// Grapheme rules come from the runtime's ICU; these assertions hold for Unicode ≥ 15.1
// (conjunct clusters, rule GB9c). The run record stores the ICU version for this reason.
const conjunctAware = Number(process.versions.unicode?.split('.')[0] ?? 0) >= 16
  || (Number(process.versions.unicode?.split('.')[0]) === 15 && Number(process.versions.unicode?.split('.')[1]) >= 1)

describe('reading: text units', () => {
  it('normalises NFC, line endings and spaces, keeping case and spelling', () => {
    expect(normaliseForReading('  Their  \r\n  car ')).toBe('Their\ncar')
    expect(normaliseForReading('ज़')).toBe('ज़') // ज़ precomposed -> NFC decomposed form
  })
  it('counts graphemes, not code points', () => {
    expect(graphemes('कि')).toEqual(['कि'])
    expect(graphemes('ज़')).toHaveLength(1) // ज + nukta = one character
    if (conjunctAware) {
      expect(graphemes('क्षि')).toEqual(['क्षि']) // 4 code points, 1 user-perceived character
      expect(graphemes('नमस्ते')).toEqual(['न', 'म', 'स्ते'])
    }
  })
  it('splits words without punctuation, keeping [?] whole', () => {
    expect(words('Plants, make [?] food।')).toEqual(['Plants', 'make', '[?]', 'food'])
  })
  it('levenshtein on known pairs', () => {
    expect(levenshtein([...'kitten'], [...'sitting'])).toBe(3)
    expect(levenshtein([], [...'ab'])).toBe(2)
  })
})

describe('reading: per-item scores', () => {
  it('perfect read: everything zero', () => {
    const s = scoreReading('पेड़ हमें ऑक्सीजन देते हैं।', 'पेड़ हमें ऑक्सीजन देते हैं।')
    expect([s.cerCp, s.cerG, s.wer, s.invented, s.unclear]).toEqual([0, 0, 0, 0, 0])
  })

  it('a dropped matra costs 1 code point but also 1 grapheme', () => {
    // truth "कि" (2 cp, 1 grapheme) read as "क" (1 cp, 1 grapheme): 1 cp edit, 1 grapheme edit
    const s = scoreReading('क', 'कि')
    expect(s.cpEdits).toBe(1)
    expect(s.cpRef).toBe(2)
    expect(s.gEdits).toBe(1)
    expect(s.gRef).toBe(1)
    expect(s.cerCp).toBe(0.5)
    expect(s.cerG).toBe(1)
  })

  it('a conjunct read wrongly is one grapheme error, several code point errors', () => {
    if (!conjunctAware) return
    // "क्षि" (4 cp, 1 g) read as "कि" (2 cp, 1 g): 2 cp deletions, 1 grapheme substitution
    const s = scoreReading('कि', 'क्षि')
    expect(s.cpEdits).toBe(2)
    expect(s.gEdits).toBe(1)
    expect(s.cerG).toBe(1)
  })

  it('WER, [?] and invented text', () => {
    // truth 5 words; output: one word unreadable ([?]), one word invented (sub), one extra word (ins)
    const s = scoreReading('the [?] sat on a big mat', 'the cat sat on the mat')
    // alignment: the=the, [?]~cat (sub, not invented), sat, on, a~the (sub, invented), big (ins, invented), mat
    expect(s.wordRef).toBe(6)
    expect(s.wordEdits).toBe(3)
    expect(s.unclear).toBe(1)
    expect(s.invented).toBe(2)
    expect(s.outWords).toBe(7)
  })

  it('catastrophic: CER over 0.5 or output more than twice the truth', () => {
    expect(scoreReading('completely different words', 'abc').catastrophic).toBe(true)
    expect(scoreReading('ab ab ab ab ab ab ab', 'ab ab').catastrophic).toBe(true)
    expect(scoreReading('ab ab', 'ab ab').catastrophic).toBe(false)
  })

  it('alignment is a minimal edit path', () => {
    expect(alignWords(['a', 'x', 'c'], ['a', 'b', 'c']).map((o) => o.op)).toEqual(['match', 'sub', 'match'])
    expect(alignWords(['a', 'c'], ['a', 'b', 'c']).map((o) => o.op)).toEqual(['match', 'del', 'match'])
  })

  it('summary micro-averages edits over references', () => {
    const items = [scoreReading('ab', 'ab'), scoreReading('a', 'abcd')] // 0/2 and 3/4 cp edits
    const sum = summariseReading(items)
    expect(sum.cerCp).toBeCloseTo(3 / 6, 10)
    expect(sum.medianCerCp).toBeCloseTo((0 + 0.75) / 2, 10)
    expect(sum.catastrophicRate).toBe(0.5)
  })

  it('the old scoreSample keeps its behaviour', () => {
    expect(scoreSample('Plants  make\r\nfood', 'Plants make\nfood').cer).toBe(0)
  })
})

describe('marking agreement', () => {
  it('QWK = 1 for perfect agreement', () => {
    expect(qwk([{ ai: 0, ref: 0 }, { ai: 1, ref: 1 }, { ai: 0.5, ref: 0.5 }], 1)).toBeCloseTo(1, 10)
  })

  it('QWK on a hand-computed matrix (M = 1, 3 categories) = 5/13', () => {
    // O: (0,0) (1,1) (1,0) (0.5,0.5). Σw·O = 1; Σw·E = 6.5/4 = 1.625; QWK = 1 − 1/1.625 = 5/13.
    expect(qwk([{ ai: 0, ref: 0 }, { ai: 1, ref: 1 }, { ai: 1, ref: 0 }, { ai: 0.5, ref: 0.5 }], 1)).toBeCloseTo(5 / 13, 10)
  })

  it('QWK is negative for systematic reversal and NaN when nothing varies', () => {
    expect(qwk([{ ai: 0, ref: 1 }, { ai: 1, ref: 0 }, { ai: 0, ref: 1 }, { ai: 1, ref: 0 }], 1)).toBeLessThan(0)
    expect(qwk([{ ai: 1, ref: 1 }, { ai: 1, ref: 1 }], 1)).toBeNaN()
  })

  it('refuses marks outside 0..M', () => {
    expect(() => qwk([{ ai: 3, ref: 1 }, { ai: 1, ref: 1 }], 2)).toThrow(/out of range/)
  })

  it('MAE, bias, exact, within one, large errors', () => {
    // differences: 0, +1, −0.5, +2 on M = 5
    const s = summariseMarking([{ ai: 3, ref: 3 }, { ai: 4, ref: 3 }, { ai: 2.5, ref: 3 }, { ai: 5, ref: 3 }], 5)
    expect(s.mae).toBeCloseTo(3.5 / 4, 10)
    expect(s.normalisedMae).toBeCloseTo(3.5 / 4 / 5, 10)
    expect(s.bias).toBeCloseTo(2.5 / 4, 10)
    expect(s.exact).toBe(0.25)
    expect(s.withinOne).toBe(0.75)
    expect(s.largeErrorRate).toBe(0.25) // only the +2 (> 1 mark); 0.2·M = 1 so +1 is not large
  })

  it('verdict confusion counts reference rows × AI columns', () => {
    const m = verdictConfusion([{ ref: 'met', ai: 'met' }, { ref: 'met', ai: 'partial' }, { ref: 'missing', ai: 'met' }])
    expect(m.met.met).toBe(1)
    expect(m.met.partial).toBe(1)
    expect(m.missing.met).toBe(1)
    expect(m.partial.partial).toBe(0)
  })
})

describe('mutation metrics', () => {
  const points = [
    { aiPointMarks: 0, expectedPointMarks: 0, removed: 1 }, // detected
    { aiPointMarks: 1, expectedPointMarks: 0, removed: 1 }, // missed: full false credit
    { aiPointMarks: 0.5, expectedPointMarks: 0.5, removed: 0.5 }, // unit rule: detected
    { aiPointMarks: 2, expectedPointMarks: 2, removed: 0 }, // not a removing rule: ignored by detection
  ]
  it('detection rate over mark-removing variants', () => expect(detectionRate(points)).toBeCloseTo(2 / 3, 10))
  it('false credit = marks given back / marks removed', () => expect(falseCreditRate(points)).toBeCloseTo(1 / 2.5, 10))
  it('invariance and injection', () => {
    expect(invarianceRate([{ original: 3, variant: 3 }, { original: 3, variant: 2.5 }])).toBe(0.5)
    expect(injectionResistance([{ original: 2, variant: 2 }, { original: 2, variant: 3 }])).toBe(0.5)
  })
})

describe('repeatability', () => {
  it('all-five identical and spread', () => {
    expect(allRunsIdentical([[2, 2, 2, 2, 2], [2, 2.5, 2, 2, 2]])).toBe(0.5)
    expect(meanSpread([[1, 1, 1], [1, 2, 3]])).toBeCloseTo((0 + 1) / 2, 10)
  })
  it('ICC(2,1): perfect = 1; a constant +1 offset between runs = 2/3 (hand-computed)', () => {
    expect(icc21([[1, 1], [2, 2], [3, 3]])).toBeCloseTo(1, 10)
    // grand 2.5; MSR 2; MSC 1.5; MSE 0 → 2 / (2 + 0 + 2·1.5/3) = 2/3
    expect(icc21([[1, 2], [2, 3], [3, 4]])).toBeCloseTo(2 / 3, 10)
  })
})

describe("Krippendorff's alpha", () => {
  // Krippendorff (2011), "Computing Krippendorff's alpha-reliability": 4 coders × 12 units
  // with missing values. Published: interval 0.849, ordinal 0.815.
  const units: (number | null)[][] = [
    [1, 1, null, 1], [2, 2, 3, 2], [3, 3, 3, 3], [3, 3, 3, 3], [2, 2, 2, 2], [1, 2, 3, 4],
    [4, 4, 4, 4], [1, 1, 2, 1], [2, 2, 2, 2], [null, 5, 5, 5], [null, null, 1, 1], [null, 3, null, null],
  ]
  it('interval', () => expect(krippendorffAlpha(units, 'interval')).toBeCloseTo(0.849, 3))
  it('ordinal', () => expect(krippendorffAlpha(units, 'ordinal')).toBeCloseTo(0.815, 3))
})

describe('bootstrap by answer', () => {
  it('is reproducible with a seed and brackets the estimate', () => {
    const answers = Array.from({ length: 50 }, (_, i) => ({ ai: i % 3 === 0 ? 1 : 0.5, ref: 0.5 }))
    const stat = (xs: readonly { ai: number; ref: number }[]) => summariseMarking(xs, 1).mae
    const a = bootstrapCI(answers, stat, { B: 500, seed: 7 })
    const b = bootstrapCI(answers, stat, { B: 500, seed: 7 })
    expect(a).toEqual(b)
    expect(a.lower).toBeLessThanOrEqual(a.estimate)
    expect(a.upper).toBeGreaterThanOrEqual(a.estimate)
  })
  it('keeps each answer whole: resampled items are original objects', () => {
    const answers = [{ id: 'a', points: [1, 0] }, { id: 'b', points: [0, 0] }]
    const seen = new Set<string>()
    bootstrapCI(answers, (xs) => { xs.forEach((x) => seen.add(`${x.id}:${x.points.join(',')}`)); return xs.length }, { B: 50 })
    expect([...seen].sort()).toEqual(['a:1,0', 'b:0,0'])
  })
  it('seeded generator is deterministic and in [0, 1)', () => {
    const r1 = seededRandom(1)
    const r2 = seededRandom(1)
    const xs = Array.from({ length: 5 }, () => r1())
    expect(xs).toEqual(Array.from({ length: 5 }, () => r2()))
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})
