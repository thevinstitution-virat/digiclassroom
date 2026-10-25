// Eval datasets (docs/hw-eval/stage1-design.md §3): versioned, immutable, one JSON line per
// item. Local layout mirrors R2:
//   <root>/<name>/<version>/manifest.jsonl  (+ media/…)
//   R2: hw-assignments/evals/datasets/<name>/<version>/…
//
// Loading validates every line and refuses the whole dataset on any problem: a bad line is
// never skipped, because a silently shorter dataset changes every metric.

import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

export const EVAL_PREFIX = 'hw-assignments/evals/';

const halfGrid = z.number().nonnegative().refine((x) => Math.abs(x * 2 - Math.round(x * 2)) < 1e-9, 'not in 0.5 steps');
const positiveHalf = halfGrid.refine((x) => x > 0, 'must be more than 0');

export const MUTATION_TYPES = [
  'original', 'remove_point', 'wrong_fact', 'numeric_arithmetic', 'numeric_unit', 'numeric_formula',
  'padding', 'over_word_limit', 'paraphrase', 'spelling', 'reorder', 'hindi_version', 'mixed_version',
  'hindi_spelling_variant', 'injection', 'wrong_section', 'extra_question',
] as const;
export type MutationType = (typeof MUTATION_TYPES)[number];

/** Mutations whose expected marks equal the original's: invariance (and injection) checks. */
export const HARMLESS: ReadonlySet<MutationType> = new Set([
  'padding', 'over_word_limit', 'paraphrase', 'spelling', 'reorder', 'hindi_version', 'mixed_version', 'hindi_spelling_variant',
]);

const KeyPoint = z.object({
  id: z.string().min(1),
  marks: positiveHalf,
  cites: z.array(z.string()),
  text: z.string().optional(),
  kind: z.enum(['key_point', 'step', 'unit', 'format', 'competency']).optional(),
  acceptedAlternatives: z.array(z.string()).optional(),
});

export const EvalItemSchema = z.object({
  id: z.string().regex(/^evitem_[a-z2-7]{16,}$/, 'id must be evitem_ + an opaque base32 token'),
  source: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
  subject: z.string().min(1),
  class: z.string().min(1),
  board: z.string().min(1),
  medium: z.enum(['English', 'Hindi']),
  language: z.enum(['en', 'hi', 'mixed']),
  questionType: z.string().min(1),
  mode: z.enum(['ink', 'photo', 'typed']),
  question: z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    marks: positiveHalf,
    ref: z.record(z.unknown()).optional(),
    passageText: z.string().optional(),
  }),
  media: z.object({ ink: z.string().nullable().optional(), render: z.string().nullable().optional(), photo: z.string().nullable().optional() }).default({}),
  truthTranscript: z.object({ text: z.string(), how: z.enum(['known_text', 'double_typed_adjudicated']) }).nullable().optional(),
  key: z.object({
    source: z.enum(['official', 'passage', 'textbook']),
    keyId: z.string().min(1),
    referenceAnswer: z.string().optional(),
    points: z.array(KeyPoint).min(1),
  }).nullable().optional(),
  referenceMarks: z.object({
    byPoint: z.record(halfGrid),
    total: halfGrid,
    how: z.enum(['by_construction', 'single_teacher', 'double_marked', 'adjudicated']),
  }).nullable().optional(),
  mutation: z.object({
    type: z.enum(MUTATION_TYPES),
    target: z.string().nullable().optional(),
    rule: z.string().min(1),
    parentItem: z.string().nullable().optional(),
  }).nullable().optional(),
  handwritingBand: z.enum(['neat', 'average', 'messy', 'unknown']).default('unknown'),
  device: z.string().default('unknown'),
  consent: z.object({ ref: z.string().nullable(), deidentified: z.boolean() }),
}).strict();

export type EvalItem = z.infer<typeof EvalItemSchema>;

/** Field names that would carry a person's identity. Refused anywhere in an item. */
const PERSONAL = /^(name|student_?name|full_?name|roll(_?no|_?number)?|admission(_?no)?|email|phone|mobile|dob|date_?of_?birth|address|father|mother|guardian|school_?name)$/i;

function personalKeys(v: unknown, path = ''): string[] {
  if (!v || typeof v !== 'object') return [];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => [
    ...(PERSONAL.test(k) ? [`${path}${k}`] : []),
    ...personalKeys(x, `${path}${k}.`),
  ]);
}

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

/** Rules across fields that the schema cannot express. Empty = consistent. */
export function itemProblems(it: EvalItem): string[] {
  const p: string[] = [];
  // Real students' work (C, D, E) only with consent and de-identified.
  if (['C', 'D', 'E'].includes(it.source) && (!it.consent.ref || !it.consent.deidentified)) p.push('real student work needs a consent ref and deidentified=true');
  if (it.mode !== 'typed' && !it.media.render && !it.media.photo) p.push(`mode ${it.mode} needs a render or photo`);
  if (it.key) {
    const total = sum(it.key.points.map((x) => x.marks));
    if (Math.abs(total - it.question.marks) > 1e-9) p.push(`key points add up to ${total}, question is worth ${it.question.marks}`);
    if (new Set(it.key.points.map((x) => x.id)).size !== it.key.points.length) p.push('duplicate key point ids');
  }
  if (it.referenceMarks) {
    const r = it.referenceMarks;
    if (Math.abs(sum(Object.values(r.byPoint)) - r.total) > 1e-9) p.push('referenceMarks.total is not the sum of byPoint');
    if (r.total > it.question.marks + 1e-9) p.push('referenceMarks.total exceeds the question marks');
    if (!it.key) p.push('referenceMarks without a key');
    else {
      const ids = new Map(it.key.points.map((x) => [x.id, x.marks]));
      for (const [id, m] of Object.entries(r.byPoint)) {
        if (!ids.has(id)) p.push(`referenceMarks for unknown point ${id}`);
        else if (m > ids.get(id)! + 1e-9) p.push(`referenceMarks for ${id} exceed its marks`);
      }
    }
  }
  if (it.source === 'B') {
    if (!it.mutation) p.push('source B needs a mutation');
    if (it.referenceMarks?.how !== 'by_construction') p.push('source B reference marks must be by_construction');
    if (!it.truthTranscript || it.truthTranscript.how !== 'known_text') p.push('source B needs the known text as truth');
  }
  if (it.mutation && it.mutation.type !== 'original' && !it.mutation.parentItem) p.push('a variant needs its parentItem');
  if (it.source === 'A' && it.truthTranscript?.how !== 'known_text') p.push('source A needs the known text as truth');
  return p;
}

export interface Dataset {
  name: string;
  version: string;
  dir: string;
  items: EvalItem[];
  /** sha256 of manifest.jsonl, recorded in every run. */
  manifestSha256: string;
}

export function parseDatasetRef(ref: string): { name: string; version: string } {
  const m = /^([a-z0-9][a-z0-9_-]*)@(v\d+)$/.exec(ref);
  if (!m) throw new Error(`dataset must be <name>@v<N>, got "${ref}"`);
  return { name: m[1], version: m[2] };
}

export function parseManifest(text: string): { items: EvalItem[] } | { problems: string[] } {
  const problems: string[] = [];
  const items: EvalItem[] = [];
  const ids = new Set<string>();
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const where = `line ${i + 1}`;
    let raw: unknown;
    try { raw = JSON.parse(line); } catch { problems.push(`${where}: not JSON`); return; }
    const personal = personalKeys(raw);
    if (personal.length) problems.push(`${where}: personal fields not allowed (${personal.join(', ')})`);
    const parsed = EvalItemSchema.safeParse(raw);
    if (!parsed.success) {
      problems.push(...parsed.error.issues.map((x) => `${where}: ${x.path.join('.')} ${x.message}`));
      return;
    }
    if (ids.has(parsed.data.id)) problems.push(`${where}: duplicate id ${parsed.data.id}`);
    ids.add(parsed.data.id);
    problems.push(...itemProblems(parsed.data).map((x) => `${where} (${parsed.data.id}): ${x}`));
    items.push(parsed.data);
  });
  for (const it of items) {
    if (it.mutation?.parentItem && !ids.has(it.mutation.parentItem)) problems.push(`${it.id}: parentItem ${it.mutation.parentItem} is not in the dataset`);
  }
  if (!items.length && !problems.length) problems.push('manifest is empty');
  return problems.length ? { problems } : { items };
}

export function loadDataset(root: string, ref: string): Dataset {
  const { name, version } = parseDatasetRef(ref);
  const dir = join(root, name, version);
  const file = join(dir, 'manifest.jsonl');
  if (!existsSync(file)) throw new Error(`dataset ${ref} not found at ${file}`);
  const text = readFileSync(file, 'utf8');
  const r = parseManifest(text);
  if ('problems' in r) throw new Error(`dataset ${ref} is invalid:\n  ${r.problems.slice(0, 50).join('\n  ')}`);
  return { name, version, dir, items: r.items, manifestSha256: createHash('sha256').update(text).digest('hex') };
}

/** Writes a new version. Refuses one that exists: a change is a new version. */
export function writeDatasetVersion(root: string, ref: string, items: readonly EvalItem[]): string {
  const { name, version } = parseDatasetRef(ref);
  const dir = join(root, name, version);
  if (existsSync(join(dir, 'manifest.jsonl'))) throw new Error(`dataset ${ref} already exists; datasets are immutable, write a new version`);
  const text = items.map((x) => JSON.stringify(x)).join('\n') + '\n';
  const r = parseManifest(text);
  if ('problems' in r) throw new Error(`refusing to write an invalid dataset:\n  ${r.problems.slice(0, 50).join('\n  ')}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.jsonl'), text, { flag: 'wx' });
  return dir;
}

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';

/** Opaque, unguessable item id (100 bits). Carries nothing about the person or the question. */
export function newItemId(): string {
  const b = randomBytes(13);
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const byte of b) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return `evitem_${out.slice(0, 20)}`;
}

/** R2 key for a dataset file; everything stays under hw-assignments/evals/. */
export function datasetObjectKey(ref: string, relPath: string): string {
  const { name, version } = parseDatasetRef(ref);
  if (relPath.includes('..') || relPath.startsWith('/')) throw new Error(`bad dataset path ${relPath}`);
  return `${EVAL_PREFIX}datasets/${name}/${version}/${relPath}`;
}
