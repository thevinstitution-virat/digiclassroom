// Consent and dataset versions (roadmap task 3.1). Two commands:
//
//   withdrawn: write the list of consent refs that no longer cover anything (withdrawn records, and students whose parent's record is
//              withdrawn). Reads the database (DATABASE_URL), changes nothing. The runner takes the file with --withdrawn.
//     npm run hw:eval:consent -- withdrawn --out hw-evals/withdrawn-consent.json
//
//   exclude:   write the NEXT version of a dataset without the items that belong to those refs. Datasets are immutable, so the old
//              version stays as it is; the runner refuses to run it once any of its people has withdrawn, and points here.
//     npm run hw:eval:consent -- exclude --dataset pilot-reading@v1 --withdrawn hw-evals/withdrawn-consent.json [--to pilot-reading@v2] [--datasets-root hw-evals/datasets]

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 1 ? process.argv[i + 1] : fallback;
}

async function withdrawn() {
  const out = arg('out', 'hw-evals/withdrawn-consent.json')!;
  const { db } = await import('@/db');
  const { hwEvalConsent } = await import('@/db/hw-eval-schema');
  const { withdrawnRefs } = await import('@/lib/hw/eval/consent-rules');
  const rows = await db.select().from(hwEvalConsent);
  const refs = withdrawnRefs(rows.map((r) => ({ id: r.id, subjectKind: r.subjectKind, scope: r.scope, withdrawnAt: r.withdrawnAt, guardianConsentId: r.guardianConsentId })));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), records: rows.length, refs }, null, 2));
  console.log(`${refs.length} of ${rows.length} consent records no longer cover anything; wrote ${out}`);
  process.exit(0);
}

async function exclude() {
  const root = arg('datasets-root', 'hw-evals/datasets')!;
  const ref = arg('dataset');
  const file = arg('withdrawn');
  if (!ref || !file) throw new Error('--dataset <name@vN> and --withdrawn <file> are required');
  const { loadDataset, parseDatasetRef, writeDatasetVersion } = await import('@/lib/hw/eval/dataset');
  const { excludeWithdrawn } = await import('@/lib/hw/eval/consent-rules');
  const ds = loadDataset(root, ref);
  const { name, version } = parseDatasetRef(ref);
  const to = arg('to') ?? `${name}@v${Number(version.replace(/^v/, '')) + 1}`;
  const refs = new Set<string>((JSON.parse(readFileSync(file, 'utf8')) as { refs: string[] }).refs);
  const { kept, removed } = excludeWithdrawn(ds.items, refs);
  if (!removed) { console.log(`${ref}: nobody in it has withdrawn; no new version needed.`); return; }
  if (!kept.length) throw new Error(`${ref}: every item belongs to a withdrawn consent; nothing left for a new version.`);
  const dir = writeDatasetVersion(root, to, kept);
  // The media of the kept items come with them; the withdrawn people's media is not copied.
  let files = 0;
  for (const it of kept) {
    for (const rel of Object.values(it.media ?? {}) as (string | null | undefined)[]) {
      if (!rel) continue;
      const from = join(ds.dir, rel);
      if (!existsSync(from)) continue;
      const toFile = join(dir, rel);
      mkdirSync(dirname(toFile), { recursive: true });
      copyFileSync(from, toFile);
      files++;
    }
  }
  console.log(`${to}: ${kept.length} items kept, ${removed} removed (withdrawn consent), ${files} media files copied. ${ref} is unchanged.`);
}

const cmd = process.argv[2];
(cmd === 'withdrawn' ? withdrawn() : cmd === 'exclude' ? exclude() : Promise.reject(new Error('usage: hw-eval-consent.ts withdrawn|exclude ...')))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
