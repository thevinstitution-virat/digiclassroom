// Eval reports (stage1-design.md §10): Markdown, HTML and CSV from run records, plus a public
// summary with no student data (no item ids, no rater pseudonyms, no small groups). Pure:
// the caller loads runs and writes files.

import type { EvalItem } from './dataset';
import { gateTable, type GateConfig, type GateInputs, type GateRow, DEFAULT_GATES } from './gates';
import { groupBreakdown, teacherBaseline, type GroupStats, type RaterMarks, type TeacherBaseline } from './groups';
import { median } from './reading';
import type { ItemRow, RunRecord } from './runner';
import { summariseRun, type RunSummary } from './summary';

export interface LoadedRun { record: RunRecord; rows: ItemRow[] }

export interface ReportInput {
  title: string;
  datasetRef: string;
  manifestSha256: string;
  items: readonly EvalItem[];
  runs: readonly LoadedRun[];
  raters?: RaterMarks;
  keyAudits?: GateInputs['keyAudits'];
  keySupport?: GateInputs['keySupport'];
  gates?: GateConfig;
}

export interface RunSection {
  runId: string;
  mode: string;
  status: string;
  configHash: string;
  gitCommit: string;
  repeat: number;
  costInr: number;
  tokens: { input: number; cached: number; output: number };
  counts: Record<string, number>;
  failures: number;
  summary: RunSummary;
  groups: GroupStats[];
  latencyMs: { median: number; p90: number };
  /** ₹ per answer that was processed (ok rows of repeat 0). */
  costPerAnswerInr: number;
}

export interface ReportModel {
  title: string;
  generatedAt: string;
  datasetRef: string;
  manifestSha256: string;
  runs: RunSection[];
  teacher: TeacherBaseline | null;
  gates: GateRow[];
}

const p90 = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(0.9 * (xs.length - 1)))] : NaN);

export function buildReport(input: ReportInput): ReportModel {
  const items = new Map(input.items.map((x) => [x.id, x]));
  const runs: RunSection[] = input.runs.map(({ record, rows }) => {
    const ok = rows.filter((r) => r.status === 'ok');
    const lat = ok.map((r) => r.latencyMs).filter((x) => x > 0);
    const answers = ok.filter((r) => r.repeat === 0).length;
    return {
      runId: record.runId, mode: record.mode, status: record.status, configHash: String(record.meta.configHash ?? ''),
      gitCommit: String(record.meta.gitCommit ?? 'unknown'), repeat: record.repeat, costInr: record.costPaise / 100,
      tokens: record.tokens, counts: record.counts, failures: record.failures.length,
      summary: summariseRun(record.mode, rows, input.items),
      groups: record.mode === 'key' ? [] : groupBreakdown(rows, input.items),
      latencyMs: { median: median(lat), p90: p90(lat) },
      costPerAnswerInr: answers ? record.costPaise / 100 / answers : NaN,
    };
  });
  const markRun = input.runs.find((r) => r.record.mode === 'mark' && r.record.repeat === 1) ?? input.runs.find((r) => r.record.mode === 'mark') ?? input.runs.find((r) => r.record.mode === 'e2e');
  const repeatRun = input.runs.find((r) => r.record.mode === 'mark' && r.record.repeat >= 5);
  return {
    title: input.title, generatedAt: new Date().toISOString(), datasetRef: input.datasetRef, manifestSha256: input.manifestSha256, runs,
    teacher: input.raters ? teacherBaseline(input.raters, items) : null,
    gates: markRun ? gateTable({ items: input.items, markRows: markRun.rows, repeatRows: repeatRun?.rows, raters: input.raters, keyAudits: input.keyAudits, keySupport: input.keySupport }, input.gates ?? DEFAULT_GATES) : [],
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────────────────

const f = (x: number | undefined, d = 3) => (x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(d));
const pct = (x: number | undefined) => (x === undefined || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(1)}%`);
const ci = (c: { estimate: number; lower: number; upper: number }) => `${f(c.estimate)} [${f(c.lower)}, ${f(c.upper)}]`;
const insufficient = (n: number) => `Insufficient data (n = ${n})`;

function table(head: string[], rows: string[][]): string {
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function groupRows(groups: GroupStats[]): string[][] {
  return groups.map((g) => [
    g.dimension === 'all' ? '**all**' : `${g.dimension}: ${g.value}`,
    g.reading ? (g.reading.insufficient ? insufficient(g.reading.n) : `CER ${pct(g.reading.cerCp)} · graphemes ${pct(g.reading.cerG)} · WER ${pct(g.reading.wer)} · invented ${pct(g.reading.inventedRate)} (n=${g.reading.n})`) : '',
    g.marking ? (g.marking.insufficient ? insufficient(g.marking.n) : `nMAE ${ci(g.marking.normalisedMaeCi)} · large ${pct(g.marking.largeErrorRate)} · bias ${f(g.marking.bias, 2)} · ${g.marking.byScale.map((s) => `QWK M=${s.maxMarks} ${ci(s.ci)} (n=${s.n})`).join(', ')}`) : '',
  ]);
}

export function renderMarkdown(m: ReportModel): string {
  const out: string[] = [`# ${m.title}`, '', `Dataset **${m.datasetRef}** (manifest sha256 \`${m.manifestSha256.slice(0, 12)}…\`), generated ${m.generatedAt}.`, ''];
  out.push('## Runs', '', table(['Run', 'Mode', 'Status', 'Config', 'Commit', 'Rows', 'Failures', 'Cost', '₹ / answer', 'Latency median / p90'],
    m.runs.map((r) => [r.runId, `${r.mode}${r.repeat > 1 ? ` ×${r.repeat}` : ''}`, r.status, `\`${r.configHash.slice(0, 10)}\``, `\`${r.gitCommit.slice(0, 7)}\``,
      Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(', '), String(r.failures), `₹${r.costInr.toFixed(2)}`, f(r.costPerAnswerInr, 3), `${f(r.latencyMs.median / 1000, 1)}s / ${f(r.latencyMs.p90 / 1000, 1)}s`])), '');

  out.push('## AI against the teacher baseline', '');
  const mark = m.runs.find((r) => r.summary.marking);
  if (!mark?.summary.marking) out.push('No marking run in this report.', '');
  else if (mark.summary.marking.insufficient) out.push(`${insufficient(mark.summary.marking.n)}: at least ${DEFAULT_GATES.minAnswers} marked answers are needed before AI and teacher agreement are compared.`, '');
  else {
    const scales = mark.summary.marking.qwkByMax;
    out.push(table(['Measure', 'AI vs reference', 'Teacher vs teacher'], [
      ...scales.map((s) => [`QWK, ${s.maxMarks}-mark questions`, `${ci(s.ci)} (n=${s.n})`, m.teacher?.byScale.find((t) => t.maxMarks === s.maxMarks) ? `${f(m.teacher!.byScale.find((t) => t.maxMarks === s.maxMarks)!.qwk)} (n=${m.teacher!.byScale.find((t) => t.maxMarks === s.maxMarks)!.n})` : '—']),
      ['Normalised MAE', ci(mark.summary.marking.normalisedMaeCi), m.teacher ? f(m.teacher.normalisedMae) : '—'],
      ['Exact', pct(mark.summary.marking.exact), m.teacher ? pct(m.teacher.exact) : '—'],
      ['Large errors', pct(mark.summary.marking.largeErrorRate), ''],
      ['Signed bias (+ = lenient)', f(mark.summary.marking.bias, 2), ''],
      ...(m.teacher?.alpha != null ? [['Krippendorff α (ordinal, all teachers)', '', f(m.teacher.alpha)]] : []),
    ]), '');
  }

  for (const r of m.runs) {
    const s = r.summary;
    out.push(`## ${r.mode} run ${r.runId}`, '');
    if (s.reading) out.push(`**Reading**: CER ${pct(s.reading.cerCp)} (graphemes ${pct(s.reading.cerG)}; line breaks as spaces ${pct(s.reading.cerFlat)}), WER ${pct(s.reading.wer)}, median item CER ${pct(s.reading.medianCerCp)}, [?] ${pct(s.reading.unclearRate)}, invented ${pct(s.reading.inventedRate)}, catastrophic ${pct(s.reading.catastrophicRate)}, n=${s.reading.n}${s.reading.insufficient ? ' — insufficient data' : ''}.`, '');
    if (s.readingEffect) out.push(`**Effect of reading errors** on MAE (AI transcript − truth transcript): ${ci(s.readingEffect)}.`, '');
    if (s.mutations) {
      out.push(`**Mutations**: detection ${pct(s.mutations.detection)}, false credit ${pct(s.mutations.falseCredit)}, invariance ${pct(s.mutations.invariance)}, injection resistance ${pct(s.mutations.injection)}.`, '');
      out.push(table(['Rule', 'Variants', 'Detection', 'Mean change vs original'],Object.entries(s.mutations.byType).sort().map(([k, v]) => [k, String(v.n), pct(v.detection), f(v.meanAbsDelta, 2)])), '');
    }
    if (s.repeatability) out.push(`**Repeatability** (${s.repeatability.items} items): all runs identical ${pct(s.repeatability.allIdentical)}, ICC(2,1) ${f(s.repeatability.icc)}, mean spread ${f(s.repeatability.meanSpread, 2)}.`, '');
    if (s.keys) out.push(`**Keys**: ${s.keys.grounded}/${s.keys.questions} grounded, ${s.keys.invalid} invalid, ${s.keys.partial} partly supported, marks add up for ${s.keys.marksSumOk}; no grounding: ${Object.entries(s.keys.noGrounding).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`, '');
    if (r.groups.length) out.push('**Groups**', '', table(['Group', 'Reading', 'Marking'], groupRows(r.groups)), '');
  }

  out.push('## Gates (recommendation only)', '');
  if (!m.gates.length) out.push('No marking run: gates not evaluated.', '');
  else {
    out.push(table(['Subject', 'Question type', 'Language', 'Verdict', 'Why'], m.gates.map((g) => [g.subject, g.questionType, g.language, `**${g.verdict}**`,
      g.checks.filter((c) => c.state === 'fail' || c.state === 'insufficient').map((c) => `${c.gate}: ${c.detail}`).join('; ') || 'all gates pass'])), '');
    out.push('<details><summary>Every check</summary>', '');
    for (const g of m.gates) out.push(`**${g.subject} · ${g.questionType} · ${g.language}**`, '', ...g.checks.map((c) => `- ${c.state === 'pass' ? '✓' : c.state === 'fail' ? '✗' : c.state === 'insufficient' ? '…' : '–'} ${c.gate}: ${c.detail}`), '');
    out.push('</details>', '');
  }
  return out.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Minimal Markdown → HTML for our own report (tables, headings, bold, code, quotes, lists). */
export function renderHtml(m: ReportModel): string {
  const md = renderMarkdown(m);
  const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/&lt;(\/?)(details|summary)&gt;/g, '<$1$2>');
  const lines = md.split('\n');
  const html: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('| ') && lines[i + 1]?.startsWith('| ---')) {
      const head = l.slice(2, -2).split(' | ');
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].startsWith('| ')) body.push(lines[i++].slice(2, -2).split(' | '));
      i--;
      html.push(`<div class="t"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (l.startsWith('# ')) html.push(`<h1>${inline(l.slice(2))}</h1>`);
    else if (l.startsWith('## ')) html.push(`<h2>${inline(l.slice(3))}</h2>`);
    else if (l.startsWith('> ')) html.push(`<blockquote>${inline(l.slice(2))}</blockquote>`);
    else if (l.startsWith('- ')) html.push(`<div class="li">${inline(l.slice(2))}</div>`);
    else if (l.trim()) html.push(l.startsWith('<') ? inline(l) : `<p>${inline(l)}</p>`);
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.title)}</title>
<style>
:root{--bg:#fff;--fg:#1a1a1a;--muted:#666;--line:#ddd;--head:#f4f4f4}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--muted:#aaa;--line:#333;--head:#1f1f1f}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,"Noto Sans","Noto Sans Devanagari",sans-serif;max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:1.6rem}h2{font-size:1.2rem;margin-top:2rem;border-bottom:1px solid var(--line)}
.t{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px;margin:.5rem 0}th,td{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}th{background:var(--head)}
code{font-size:12px}blockquote{color:var(--muted);border-left:3px solid var(--line);margin:0;padding-left:10px}.li{margin-left:1rem}
</style></head><body>${html.join('\n')}</body></html>`;
}

const csvCell = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;

/** One row per run × group, numbers only (empty when insufficient). */
export function renderCsv(m: ReportModel): string {
  const head = ['run', 'mode', 'dimension', 'value', 'read_n', 'cer_cp', 'cer_grapheme', 'wer', 'invented', 'catastrophic', 'mark_n', 'nmae', 'nmae_lower', 'nmae_upper', 'large_error_rate', 'bias', 'qwk_by_scale'];
  const rows = m.runs.flatMap((r) => r.groups.map((g) => {
    const rd = g.reading && !g.reading.insufficient ? g.reading : null;
    const mk = g.marking && !g.marking.insufficient ? g.marking : null;
    return [r.runId, r.mode, g.dimension, g.value, g.reading?.n ?? 0, rd?.cerCp, rd?.cerG, rd?.wer, rd?.inventedRate, rd?.catastrophicRate,
      g.marking?.n ?? 0, mk?.normalisedMae, mk?.normalisedMaeCi.lower, mk?.normalisedMaeCi.upper, mk?.largeErrorRate, mk?.bias,
      mk ? mk.byScale.map((s) => `M${s.maxMarks}:${f(s.qwk)}[${f(s.ci.lower)};${f(s.ci.upper)}]n${s.n}`).join(' ') : ''];
  }));
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** Aggregates only: no item ids, no pseudonyms, no group below the minimum size, no commits. */
export function renderPublicSummary(m: ReportModel): string {
  const out = [`# ${m.title}: summary`, '', `Evaluation of handwriting reading and AI-suggested marking. Generated ${m.generatedAt.slice(0, 10)}.`, ''];
  for (const r of m.runs) {
    const s = r.summary;
    if (s.reading && !s.reading.insufficient) out.push(`- Reading (${s.reading.n} answers): character error rate ${pct(s.reading.cerCp)}, invented text ${pct(s.reading.inventedRate)}.`);
    if (s.marking && !s.marking.insufficient) out.push(`- Marking (${s.marking.n} answers): normalised mean error ${f(s.marking.normalisedMae)}, large errors ${pct(s.marking.largeErrorRate)}.`);
    const variants = s.mutations ? Object.values(s.mutations.byType).reduce((a, v) => a + v.n, 0) : 0;
    if (s.mutations && variants >= DEFAULT_GATES.minAnswers) {
      const parts = [
        Number.isFinite(s.mutations.detection) ? `missing points detected ${pct(s.mutations.detection)}` : '',
        Number.isFinite(s.mutations.injection) ? `instruction-injection resisted ${pct(s.mutations.injection)}` : '',
      ].filter(Boolean);
      if (parts.length) out.push(`- Controlled answers (${variants}): ${parts.join(', ')}.`);
    }
  }
  if (m.teacher && m.teacher.n >= DEFAULT_GATES.minTeacherDoubleMarked) out.push(`- Teachers marking the same answers independently agreed exactly ${pct(m.teacher.exact)} of the time (${m.teacher.n} answers).`);
  const eligible = m.gates.filter((g) => g.verdict === 'Eligible').length;
  out.push('', `Of ${m.gates.length} subject × question type × language groups, ${eligible} meet every gate for showing AI-suggested marks; teachers review every mark either way.`);
  return out.join('\n') + '\n';
}
