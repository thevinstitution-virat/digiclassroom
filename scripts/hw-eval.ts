// Handwritten Assignments — reader evaluation. Decides which models and settings we keep.
//
// Usage (from the repo root; reads keys and prices from apps/api/.env.local):
//   npx tsx --tsconfig apps/api/tsconfig.json --env-file=apps/api/.env.local \
//     scripts/hw-eval.ts <samples-dir> [--models gemini-3.5-flash-lite,gemini-3.6-flash] \
//     [--resolutions LOW,MEDIUM] [--concurrency 4] [--out hw-eval-report.json]
//
// Samples: either one folder per sample
//   <dir>/<name>/image.png|jpg|webp + truth.txt [+ meta.json {"language":"en|hi|mixed","kind":"ink|photo"}]
// or flat pairs <dir>/<name>.png + <dir>/<name>.txt. Without meta, language is guessed from the
// truth text (Devanagari -> hi, both scripts -> mixed) and kind defaults to ink for PNG, photo otherwise.
//
// Each sample is read on its own (one answer per request), with the production prompt,
// schema validation and settings. Reports CER after NFC, the [?] rate, catastrophic outputs,
// tokens and estimated cost per answer, overall and per language and kind.

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { _resetHwConfig, getHwConfig } from '@/lib/hw/config';
import { estimateCost, parsePriceTable } from '@/lib/hw/cost/pricing';
import { GeminiReader } from '@/lib/hw/reader/gemini-reader';
import { describeError } from '@/lib/hw/errors';
import { median, scoreSample } from '@/lib/hw/eval/metrics';

type Lang = 'en' | 'hi' | 'mixed';
type Kind = 'ink' | 'photo';
type Mime = 'image/png' | 'image/jpeg' | 'image/webp';

interface Sample { name: string; image: Uint8Array; mime: Mime; truth: string; language: Lang; kind: Kind }

const MIME: Record<string, Mime> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

function guessLanguage(text: string): Lang {
  const hi = /[ऀ-ॿ]/.test(text);
  const en = /[A-Za-z]/.test(text);
  return hi && en ? 'mixed' : hi ? 'hi' : 'en';
}

function loadSamples(dir: string): Sample[] {
  const out: Sample[] = [];
  const add = (name: string, imagePath: string, truthPath: string, metaPath?: string) => {
    const ext = extname(imagePath).toLowerCase();
    const truth = readFileSync(truthPath, 'utf8');
    const meta = metaPath && existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) as Partial<{ language: Lang; kind: Kind }> : {};
    out.push({
      name,
      image: new Uint8Array(readFileSync(imagePath)),
      mime: MIME[ext],
      truth,
      language: meta.language ?? guessLanguage(truth),
      kind: meta.kind ?? (ext === '.png' ? 'ink' : 'photo'),
    });
  };
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      const img = readdirSync(p).find((f) => /^image\.(png|jpe?g|webp)$/i.test(f));
      if (img && existsSync(join(p, 'truth.txt'))) add(entry, join(p, img), join(p, 'truth.txt'), join(p, 'meta.json'));
      else console.warn(`skipping ${entry}: needs image.(png|jpg|webp) and truth.txt`);
    } else if (MIME[extname(entry).toLowerCase()]) {
      const truth = join(dir, `${basename(entry, extname(entry))}.txt`);
      if (existsSync(truth)) add(basename(entry, extname(entry)), p, truth);
      else console.warn(`skipping ${entry}: no matching .txt`);
    }
  }
  return out;
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }));
  return results;
}

interface Row {
  sample: string; model: string; resolution: string; language: Lang; kind: Kind;
  cer: number | null; unclearRate: number | null; catastrophic: boolean; error: string | null;
  tokensIn: number; tokensCached: number; tokensOut: number; paise: number; ms: number; output: string;
}

const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');

function summarise(rows: Row[]) {
  const ok = rows.filter((r) => r.cer !== null);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  return {
    n: rows.length,
    errors: rows.length - ok.length,
    cerMean: mean(ok.map((r) => r.cer!)),
    cerMedian: median(ok.map((r) => r.cer!)),
    unclearRate: mean(ok.map((r) => r.unclearRate!)),
    catastrophic: rows.filter((r) => r.catastrophic).length,
    tokensInPerAnswer: mean(rows.map((r) => r.tokensIn)),
    tokensOutPerAnswer: mean(rows.map((r) => r.tokensOut)),
    rupeesPer1000Answers: mean(rows.map((r) => r.paise)) * 1000 / 100,
    msPerAnswer: mean(rows.map((r) => r.ms)),
  };
}

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir || dir.startsWith('--') || !existsSync(dir)) {
    console.error('usage: hw-eval.ts <samples-dir> [--models a,b] [--resolutions LOW,MEDIUM] [--concurrency 4] [--out file.json]');
    process.exit(2);
  }
  const models = (arg('models') ?? [getHwConfig().HW_READ_MODEL, getHwConfig().HW_ESCALATE_MODEL].filter(Boolean).join(',')).split(',').filter(Boolean);
  const resolutions = (arg('resolutions', 'LOW,MEDIUM') as string).split(',').map((s) => s.trim().toUpperCase());
  const concurrency = Number(arg('concurrency', '4'));
  const outFile = arg('out', 'hw-eval-report.json') as string;
  if (!models.length) throw new Error('no models: pass --models or set HW_READ_MODEL');

  const samples = loadSamples(dir);
  if (!samples.length) throw new Error(`no samples found in ${dir}`);
  console.log(`${samples.length} samples · models ${models.join(', ')} · resolutions ${resolutions.join(', ')}`);
  const prices = parsePriceTable(getHwConfig().HW_PRICE_TABLE_JSON);
  if ('problem' in prices) console.warn(`cost will be 0: ${prices.problem}`);

  const rows: Row[] = [];
  for (const resolution of resolutions) {
    process.env.HW_READ_MEDIA_RESOLUTION = resolution;
    _resetHwConfig();
    for (const model of models) {
      const reader = new GeminiReader(model, 1);
      const batch = await pool(samples, concurrency, async (s): Promise<Row> => {
        const t0 = Date.now();
        const base = { sample: s.name, model, resolution, language: s.language, kind: s.kind };
        try {
          const res = await reader.read({ answers: [{ answerId: 'a1', languageHint: s.language, png: s.image, mimeType: s.mime }] });
          const out = res.answers[0].text;
          const score = scoreSample(out, s.truth);
          const cost = estimateCost(prices, res.model, res.usage, { batch: false });
          return { ...base, cer: score.cer, unclearRate: score.unclearRate, catastrophic: score.catastrophic, error: null,
            tokensIn: res.usage.input, tokensCached: res.usage.cached, tokensOut: res.usage.output, paise: cost.paise, ms: Date.now() - t0, output: out };
        } catch (e) {
          return { ...base, cer: null, unclearRate: null, catastrophic: true, error: describeError(e),
            tokensIn: 0, tokensCached: 0, tokensOut: 0, paise: 0, ms: Date.now() - t0, output: '' };
        }
      });
      rows.push(...batch);
      const s = summarise(batch);
      console.log(`  ${model} @ ${resolution}: CER mean ${pct(s.cerMean)} · median ${pct(s.cerMedian)} · [?] ${pct(s.unclearRate)} of words · catastrophic ${s.catastrophic}/${s.n} · errors ${s.errors} · ₹${s.rupeesPer1000Answers.toFixed(2)} per 1000 answers (sync price)`);
      const firstError = batch.find((r) => r.error)?.error;
      if (firstError) console.log(`    first error: ${firstError}`);
    }
  }

  const groups: Record<string, ReturnType<typeof summarise>> = {};
  const keyOf = (r: Row, extra = '') => `${r.model} @ ${r.resolution}${extra}`;
  for (const r of rows) {
    for (const k of [keyOf(r), keyOf(r, ` · ${r.language}`), keyOf(r, ` · ${r.kind}`)]) groups[k] = groups[k] ?? (null as never);
  }
  for (const k of Object.keys(groups)) groups[k] = summarise(rows.filter((r) => [keyOf(r), keyOf(r, ` · ${r.language}`), keyOf(r, ` · ${r.kind}`)].includes(k)));

  console.log('\nBy group (CER mean / catastrophic / ₹ per 1000):');
  for (const [k, s] of Object.entries(groups)) {
    console.log(`  ${k.padEnd(48)} ${pct(s.cerMean).padStart(6)}  ${String(s.catastrophic).padStart(3)}/${s.n}  ₹${s.rupeesPer1000Answers.toFixed(2)}`);
  }
  writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), samples: samples.length, groups, rows }, null, 2));
  console.log(`\nFull results (every output, per sample) written to ${outFile}`);
}

main().catch((e) => {
  console.error(`hw-eval failed: ${describeError(e)}`);
  process.exit(1);
});
