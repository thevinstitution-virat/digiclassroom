// Pure helpers for showing transcripts: word offsets for the student's misread taps, and
// spans for the teacher's view (unclear words, student flags, AI-quoted evidence).

/** Words with their character offsets, so a tap maps to an exact span of the transcript. */
export function wordsOf(text: string): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = []
  for (const m of text.matchAll(/\S+/g)) out.push({ start: m.index!, end: m.index! + m[0].length, text: m[0] })
  return out
}

/** Split the transcript into spans marked as unclear, student-flagged or AI-quoted. */
export function annotate(text: string, flags: { start: number; end: number }[], quotes: string[]) {
  const marks = new Array<{ flag?: boolean; quote?: boolean; unclear?: boolean }>(text.length).fill({})
  const mark = (s: number, e: number, k: 'flag' | 'quote' | 'unclear') => { for (let i = Math.max(0, s); i < Math.min(text.length, e); i++) marks[i] = { ...marks[i], [k]: true } }
  for (const f of flags) mark(f.start, f.end, 'flag')
  for (const q of quotes) {
    if (!q.trim()) continue
    const at = text.indexOf(q)
    if (at >= 0) mark(at, at + q.length, 'quote')
  }
  for (const m of text.matchAll(/\[\?\]/g)) mark(m.index!, m.index! + 3, 'unclear')
  const spans: { text: string; flag?: boolean; quote?: boolean; unclear?: boolean }[] = []
  for (let i = 0; i < text.length; i++) {
    const k = marks[i]
    const last = spans[spans.length - 1]
    if (last && last.flag === k.flag && last.quote === k.quote && last.unclear === k.unclear) last.text += text[i]
    else spans.push({ text: text[i], ...k })
  }
  return spans
}
