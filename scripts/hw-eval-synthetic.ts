// Virat Evaluator — SYNTHETIC test images, for checking the pipeline end to end before people
// have written anything. Text is drawn in handwriting-style system fonts with jitter; Windows
// has no Devanagari handwriting font, so Hindi uses Nirmala UI (print), which is easier to read
// than real handwriting. Results on these images say nothing about real student writing:
// every item is marked device "synthetic-font" so reports can keep them apart.
//
//   known-text  texts.json -> a source-A dataset version (typed; truth = the text)
//     npx tsx --tsconfig apps/api/tsconfig.json scripts/hw-eval-synthetic.ts known-text --texts t.json --dataset smallrun-a@v1
//   render      a dataset version with known texts -> a new version where each item is a photo
//     npx tsx --tsconfig apps/api/tsconfig.json scripts/hw-eval-synthetic.ts render --dataset smallrun-a@v1 --out smallrun-a@v2
//
// [--datasets-root hw-evals/datasets] [--fonts C:/Windows/Fonts] [--seed 1]
// Uses @napi-rs/canvas (Skia + HarfBuzz), which shapes Devanagari correctly.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  const { newItemId, loadDataset, parseDatasetRef, writeDatasetVersion } = await import('../packages/core/src/lib/hw/eval/dataset');
  type EvalItem = import('../packages/core/src/lib/hw/eval/dataset').EvalItem;
  const root = arg('datasets-root', 'hw-evals/datasets')!;
  const cmd = process.argv[2];

  if (cmd === 'known-text') {
    const texts = JSON.parse(readFileSync(need('texts'), 'utf8')) as { language: 'en' | 'hi' | 'mixed'; subject: string; text: string }[];
    const items: EvalItem[] = texts.map((t, i) => ({
      id: newItemId(), source: 'A', subject: t.subject, class: 'Class 9', board: 'CBSE', medium: t.language === 'en' ? 'English' : 'Hindi',
      language: t.language, questionType: 'short', mode: 'typed',
      question: { id: `copy_${i + 1}`, text: 'Copy the given text.', marks: 1 },
      media: {}, truthTranscript: { text: t.text, how: 'known_text' }, key: null, referenceMarks: null, mutation: null,
      handwritingBand: 'unknown', device: 'unknown', consent: { ref: null, deidentified: true },
    }));
    console.log(`${need('dataset')}: ${items.length} known-text items in ${writeDatasetVersion(root, need('dataset'), items)}`);
    return;
  }

  if (cmd === 'render') {
    const { createCanvas, GlobalFonts } = await import('@napi-rs/canvas');
    const fonts = arg('fonts', 'C:/Windows/Fonts')!;
    const latin = [['Inkfree.ttf', 'Ink Free'], ['segoepr.ttf', 'Segoe Print']].filter(([f]) => existsSync(join(fonts, f)));
    if (!latin.length || !existsSync(join(fonts, 'Nirmala.ttc'))) throw new Error(`fonts not found in ${fonts}`);
    for (const [f, name] of latin) GlobalFonts.registerFromPath(join(fonts, f), name);
    GlobalFonts.registerFromPath(join(fonts, 'Nirmala.ttc'), 'Nirmala UI');

    let seed = Number(arg('seed', '1')) >>> 0;
    const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    const ds = loadDataset(root, need('dataset'));
    const out = parseDatasetRef(need('out'));
    const outDir = join(root, out.name, out.version);
    if (existsSync(join(outDir, 'manifest.jsonl'))) throw new Error(`${need('out')} already exists`);
    mkdirSync(join(outDir, 'media', 'synthetic'), { recursive: true });

    const items: EvalItem[] = ds.items.map((it) => {
      if (it.truthTranscript?.how !== 'known_text') throw new Error(`${it.id} has no known text`);
      const text = it.truthTranscript.text;
      const devanagari = /[\u0900-\u097F]/.test(text);
      // Latin words in a handwriting face; any line with Devanagari falls back to Nirmala UI for those glyphs.
      const face = latin[Math.floor(rnd() * latin.length)][1];
      const font = `40px "${face}", "Nirmala UI"`;
      const width = 1000;
      const lineH = devanagari ? 78 : 66;
      // Wrap to the page: a line that runs past the edge would be cut off, and the reader would be
      // scored against words that are not in the image.
      const measure = createCanvas(10, 10).getContext('2d');
      measure.font = font;
      const lines: string[] = [];
      for (const para of text.split('\n')) {
        let line = '';
        for (const word of para.split(' ')) {
          const next = line ? `${line} ${word}` : word;
          if (line && measure.measureText(next).width > width - 90) { lines.push(line); line = word; } else line = next;
        }
        lines.push(line);
      }
      const canvas = createCanvas(width, lines.length * lineH + 50);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = font;
      ctx.textBaseline = 'alphabetic';
      lines.forEach((line, li) => {
        let x = 28 + rnd() * 10;
        const y = 50 + li * lineH;
        for (const word of line.split(' ')) {
          const shade = Math.floor(rnd() * 50);
          ctx.fillStyle = `rgb(${shade},${shade},${shade + 20})`;
          ctx.save();
          ctx.translate(x, y + (rnd() - 0.5) * 6);
          ctx.rotate((rnd() - 0.5) * 0.04);
          ctx.fillText(word, 0, 0);
          ctx.restore();
          x += ctx.measureText(`${word} `).width + (rnd() - 0.3) * 6;
        }
      });
      const rel = `media/synthetic/${it.id}.png`;
      writeFileSync(join(outDir, rel), canvas.toBuffer('image/png'));
      // The truth is the text as drawn, line breaks included: the reader is asked to keep them.
      return { ...it, mode: 'photo', media: { photo: rel }, device: 'synthetic-font', truthTranscript: { text: lines.join('\n'), how: 'known_text' } };
    });
    // Variants keep pointing at their parents: ids are unchanged, only the medium is new.
    console.log(`${need('out')}: ${items.length} synthetic photo items in ${writeDatasetVersion(root, need('out'), items)}`);
    return;
  }
  console.error('usage: hw-eval-synthetic.ts known-text|render …');
  process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
