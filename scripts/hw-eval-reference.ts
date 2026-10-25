// Virat Evaluator — make a new dataset version from human work or pad copies.
//
//   apply   reference export (from the evaluation page) -> new version
//     npm run hw:eval:reference -w apps/api -- apply --dataset demo@v1 --reference export.json --out demo@v2 [--datasets-root hw-evals/datasets]
//   copies  writing-pad copies -> new version with ink items beside the typed originals
//     … copies --dataset demo@v1 --out demo@v2 [--copies-root hw-evals/copies | --from-r2]
//
// The old version is never touched; its media folder is copied into the new one first, and
// the manifest is written last.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
function need(name: string): string {
  const v = arg(name);
  if (!v) { console.error(`--${name} is required`); process.exit(2); }
  return v;
}

async function main() {
  const cmd = process.argv[2];
  const { loadDataset, parseDatasetRef, writeDatasetVersion } = await import('@/lib/hw/eval/dataset');
  const root = arg('datasets-root', 'hw-evals/datasets')!;
  const ds = loadDataset(root, need('dataset'));
  const out = parseDatasetRef(need('out'));
  const outDir = join(root, out.name, out.version);
  if (existsSync(join(outDir, 'manifest.jsonl'))) throw new Error(`${out.name}@${out.version} already exists`);
  if (existsSync(join(ds.dir, 'media'))) cpSync(join(ds.dir, 'media'), join(outDir, 'media'), { recursive: true });

  if (cmd === 'apply') {
    const { applyReference } = await import('@/lib/hw/eval/reference');
    const exp = JSON.parse(readFileSync(need('reference'), 'utf8'));
    if (exp.datasetRef !== `${ds.name}@${ds.version}`) throw new Error(`the export is for ${exp.datasetRef}, not ${ds.name}@${ds.version}`);
    const r = applyReference(ds.items, exp);
    mkdirSync(join(outDir, 'reference'), { recursive: true });
    writeFileSync(join(outDir, 'reference', 'raters.json'), JSON.stringify(r.raters, null, 2));
    writeFileSync(join(outDir, 'reference', 'report.json'), JSON.stringify({ from: `${ds.name}@${ds.version}`, exportedAt: exp.exportedAt, ...r.report }, null, 2));
    writeDatasetVersion(root, `${out.name}@${out.version}`, r.items);
    console.log(`${out.name}@${out.version}: ${r.items.length} items; ${r.report.transcripts} transcripts and ${r.report.marks} marks from people`);
    for (const [k, v] of Object.entries(r.report)) if (Array.isArray(v) && v.length) console.log(`  ${k}: ${v.length}`);
    return;
  }

  if (cmd === 'copies') {
    const { applyCopies } = await import('@/lib/hw/eval/reference');
    type Copy = import('@/lib/hw/eval/reference').CopyRecord;
    const copies: Copy[] = [];
    const place = (itemId: string, raterId: string, ink: Uint8Array, png: Uint8Array, meta: { device?: string }) => {
      const rel = `media/copies/${itemId}/${raterId}`;
      mkdirSync(join(outDir, rel), { recursive: true });
      writeFileSync(join(outDir, rel, 'ink.v1.json.gz'), ink);
      writeFileSync(join(outDir, rel, 'render.v1.png'), png);
      copies.push({ itemId, raterId, device: meta.device ?? 'unknown', inkPath: `${rel}/ink.v1.json.gz`, renderPath: `${rel}/render.v1.png` });
    };
    if (process.argv.includes('--from-r2')) {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const { r2Client } = await import('@/lib/services/r2');
      const { getHwObject } = await import('@/lib/hw/storage/r2');
      const { copyPrefix } = await import('@/lib/hw/eval-tools/copies');
      const prefix = copyPrefix(`${ds.name}@${ds.version}`);
      let token: string | undefined;
      const metas: string[] = [];
      do {
        const r = await r2Client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: prefix, ContinuationToken: token }));
        metas.push(...(r.Contents ?? []).map((o) => o.Key!).filter((k) => k.endsWith('/meta.json')));
        token = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (token);
      for (const m of metas) {
        const [itemId, raterId] = m.slice(prefix.length).split('/');
        const base = m.slice(0, -'meta.json'.length);
        place(itemId, raterId, await getHwObject(`${base}ink.v1.json.gz`), await getHwObject(`${base}render.v1.png`), JSON.parse(new TextDecoder().decode(await getHwObject(m))));
      }
    } else {
      const dir = join(arg('copies-root', 'hw-evals/copies')!, ds.name, ds.version);
      if (!existsSync(dir)) throw new Error(`no copies at ${dir}`);
      for (const itemId of readdirSync(dir)) for (const raterId of readdirSync(join(dir, itemId))) {
        const base = join(dir, itemId, raterId);
        if (!existsSync(join(base, 'meta.json'))) continue; // incomplete copy
        place(itemId, raterId, readFileSync(join(base, 'ink.v1.json.gz')), readFileSync(join(base, 'render.v1.png')), JSON.parse(readFileSync(join(base, 'meta.json'), 'utf8')));
      }
    }
    const r = applyCopies(ds.items, copies);
    writeDatasetVersion(root, `${out.name}@${out.version}`, r.items);
    console.log(`${out.name}@${out.version}: ${r.items.length} items (${copies.length - r.skipped.length} pad copies added)`);
    for (const s of r.skipped) console.log(`  skipped ${s}`);
    return;
  }
  console.error('usage: hw-eval-reference.ts apply|copies …');
  process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
