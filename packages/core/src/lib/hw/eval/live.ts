// Live sections of the evaluation report: daily monitoring and shadow-mode comparisons.
// Pure: the caller queries the tables (scripts/hw-eval-live-report.ts) and passes rows in.

import { scoreReading, summariseReading } from './reading';

export interface MonitorRow {
  day: string;
  subject: string;
  questionType: string;
  answersMarked: number;
  aiSuggested: number;
  overrides: number;
  overrideAbsSum: number;
  transcriptFixes: number;
  misreadFlags: number;
}

export interface MonitorSummary {
  subject: string;
  questionType: string;
  days: number;
  answersMarked: number;
  aiSuggested: number;
  /** Share of AI-suggested answers whose final mark differs from the suggestion. */
  overrideRate: number;
  /** Mean |final − suggestion| over the overridden answers. */
  meanOverride: number;
  transcriptFixes: number;
  misreadFlags: number;
}

export function summariseMonitoring(rows: readonly MonitorRow[]): MonitorSummary[] {
  const by = new Map<string, MonitorRow[]>();
  for (const r of rows) by.set(`${r.subject}|${r.questionType}`, [...(by.get(`${r.subject}|${r.questionType}`) ?? []), r]);
  return [...by].map(([k, rs]) => {
    const [subject, questionType] = k.split('|');
    const s = (f: (r: MonitorRow) => number) => rs.reduce((a, r) => a + f(r), 0);
    const suggested = s((r) => r.aiSuggested);
    const overrides = s((r) => r.overrides);
    return {
      subject, questionType, days: new Set(rs.map((r) => r.day)).size, answersMarked: s((r) => r.answersMarked), aiSuggested: suggested,
      overrideRate: suggested ? overrides / suggested : NaN, meanOverride: overrides ? s((r) => r.overrideAbsSum) / overrides : NaN,
      transcriptFixes: s((r) => r.transcriptFixes), misreadFlags: s((r) => r.misreadFlags),
    };
  }).sort((a, b) => b.answersMarked - a.answersMarked);
}

export interface ShadowRow {
  kind: 'read' | 'mark';
  configHash: string;
  status: 'ok' | 'failed';
  predictedTranscript: string | null;
  productionTranscript: string | null;
  /** The answer's transcript now, and whether a teacher corrected it (then it is the best truth we have). */
  currentTranscript: string | null;
  teacherCorrected: boolean;
  predictedMarks: number | null;
  productionMarks: number | null;
  finalMarks: number | null;
  costPaise: number;
}

export interface ShadowSummary {
  configHash: string;
  kind: 'read' | 'mark';
  n: number;
  failed: number;
  costInr: number;
  /** read: candidate vs production transcript. */
  cerVsProduction?: number;
  /** read, teacher-corrected answers only: candidate and production vs the corrected text. */
  corrected?: { n: number; candidateCer: number; productionCer: number };
  /** mark: candidate vs production suggestion. */
  sameAsProduction?: number;
  meanAbsVsProduction?: number;
  /** mark, answers with a final teacher mark: MAE of candidate and of production against it. */
  final?: { n: number; candidateMae: number; productionMae: number; candidateExact: number; productionExact: number };
}

export function summariseShadow(rows: readonly ShadowRow[]): ShadowSummary[] {
  const by = new Map<string, ShadowRow[]>();
  for (const r of rows) by.set(`${r.configHash}|${r.kind}`, [...(by.get(`${r.configHash}|${r.kind}`) ?? []), r]);
  return [...by].map(([k, rs]) => {
    const [configHash, kind] = k.split('|') as [string, 'read' | 'mark'];
    const ok = rs.filter((r) => r.status === 'ok');
    const out: ShadowSummary = { configHash, kind, n: ok.length, failed: rs.length - ok.length, costInr: rs.reduce((a, r) => a + r.costPaise, 0) / 100 };
    if (kind === 'read') {
      const vsProd = ok.filter((r) => r.predictedTranscript !== null && r.productionTranscript !== null);
      if (vsProd.length) out.cerVsProduction = summariseReading(vsProd.map((r) => scoreReading(r.predictedTranscript!, r.productionTranscript!))).cerCp;
      const corr = ok.filter((r) => r.teacherCorrected && r.currentTranscript !== null && r.predictedTranscript !== null && r.productionTranscript !== null);
      if (corr.length) {
        out.corrected = {
          n: corr.length,
          candidateCer: summariseReading(corr.map((r) => scoreReading(r.predictedTranscript!, r.currentTranscript!))).cerCp,
          productionCer: summariseReading(corr.map((r) => scoreReading(r.productionTranscript!, r.currentTranscript!))).cerCp,
        };
      }
    } else {
      const both = ok.filter((r) => r.predictedMarks !== null && r.productionMarks !== null);
      if (both.length) {
        out.sameAsProduction = both.filter((r) => r.predictedMarks === r.productionMarks).length / both.length;
        out.meanAbsVsProduction = both.reduce((a, r) => a + Math.abs(r.predictedMarks! - r.productionMarks!), 0) / both.length;
      }
      const fin = both.filter((r) => r.finalMarks !== null);
      if (fin.length) {
        const mae = (f: (r: ShadowRow) => number) => fin.reduce((a, r) => a + Math.abs(f(r) - r.finalMarks!), 0) / fin.length;
        const exact = (f: (r: ShadowRow) => number) => fin.filter((r) => f(r) === r.finalMarks).length / fin.length;
        out.final = { n: fin.length, candidateMae: mae((r) => r.predictedMarks!), productionMae: mae((r) => r.productionMarks!), candidateExact: exact((r) => r.predictedMarks!), productionExact: exact((r) => r.productionMarks!) };
      }
    }
    return out;
  });
}

const f = (x: number | undefined, d = 3) => (x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(d));
const pct = (x: number | undefined) => (x === undefined || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(1)}%`);

export function renderLiveMarkdown(input: { from: string; to: string; monitoring: MonitorSummary[]; shadow: ShadowSummary[] }): string {
  const out = [`# Live monitoring ${input.from} to ${input.to}`, ''];
  out.push('## Teachers and the AI suggestions', '');
  if (!input.monitoring.length) out.push('No marking in this period.', '');
  else {
    out.push('| Subject | Question type | Answers marked | With AI suggestion | Changed by teacher | Mean change | Transcript fixes | Misread flags |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const m of input.monitoring) out.push(`| ${m.subject} | ${m.questionType} | ${m.answersMarked} | ${m.aiSuggested} | ${pct(m.overrideRate)} | ${f(m.meanOverride, 2)} | ${m.transcriptFixes} | ${m.misreadFlags} |`);
    out.push('', 'A high "changed by teacher" rate in a subject and question type is the first sign the AI is not marking it well there.', '');
  }
  out.push('## Shadow mode (candidate configurations, never shown to anyone)', '');
  if (!input.shadow.length) out.push('No shadow results in this period.', '');
  for (const s of input.shadow) {
    out.push(`**${s.kind === 'read' ? 'Reading' : 'Marking'} · config \`${s.configHash.slice(0, 12)}\`**: ${s.n} answers, ${s.failed} failed, ₹${s.costInr.toFixed(2)}.`, '');
    if (s.kind === 'read') {
      out.push(`- Candidate vs production transcript: CER ${pct(s.cerVsProduction)}.`);
      if (s.corrected) out.push(`- On ${s.corrected.n} transcripts a teacher corrected: candidate CER ${pct(s.corrected.candidateCer)}, production CER ${pct(s.corrected.productionCer)}.`);
    } else {
      out.push(`- Same suggestion as production: ${pct(s.sameAsProduction)}; mean difference ${f(s.meanAbsVsProduction, 2)} marks.`);
      if (s.final) out.push(`- Against ${s.final.n} final teacher marks: candidate MAE ${f(s.final.candidateMae, 2)} (exact ${pct(s.final.candidateExact)}), production MAE ${f(s.final.productionMae, 2)} (exact ${pct(s.final.productionExact)}).`);
    }
    out.push('');
  }
  return out.join('\n');
}

