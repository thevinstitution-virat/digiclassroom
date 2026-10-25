// Printable copy sheets for volunteers (sources A and B): an instruction sheet with the text
// to copy, and answer sheets with one box per item and a QR code carrying the item id (an
// opaque token, never personal data). HTML, printed to PDF from a browser, because the
// browser shapes Devanagari correctly and PDF libraries without a shaping engine do not.

import type { EvalItem } from './dataset';
import { qrSvg } from './qr';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Short code printed beside the QR and on the instruction sheet, so a person can match them. */
export const shortCode = (id: string) => id.slice(-6).toUpperCase();

export function copySheetsHtml(items: readonly EvalItem[], opts: { title: string; perPage?: number }): string {
  const copyable = items.filter((x) => x.truthTranscript?.how === 'known_text');
  if (copyable.length !== items.length) throw new Error('copy sheets need known-text items only (sources A and B)');
  const perPage = opts.perPage ?? 2;
  const pages: string[] = [];
  for (let i = 0; i < copyable.length; i += perPage) {
    const boxes = copyable.slice(i, i + perPage).map((it) => `
      <section class="box">
        <header>
          <div class="qr">${qrSvg(it.id, 3)}</div>
          <div class="code">${shortCode(it.id)}<small>${esc(it.class)} · ${esc(it.subject)} · ${it.question.marks} marks</small></div>
        </header>
        <p class="q">${esc(it.question.text)}</p>
        <div class="write" lang="${it.language === 'en' ? 'en' : 'hi'}"></div>
      </section>`).join('');
    pages.push(`<div class="page">${boxes}</div>`);
  }
  const instructions = copyable.map((it) => `
      <li><b>${shortCode(it.id)}</b> <span class="meta">${esc(it.question.text)}</span>
        <p lang="${it.language === 'en' ? 'en' : 'hi'}">${esc(it.truthTranscript!.text).replace(/\n/g, '<br>')}</p></li>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: "Noto Sans", "Noto Sans Devanagari", "Nirmala UI", Arial, sans-serif; color: #000; background: #fff; margin: 0; }
  .page { page-break-after: always; display: flex; flex-direction: column; gap: 6mm; height: 270mm; }
  .box { border: 1.5px solid #000; flex: 1; display: flex; flex-direction: column; padding: 4mm; }
  header { display: flex; gap: 4mm; align-items: center; }
  .code { font: 700 20px/1.2 monospace; letter-spacing: 2px; display: flex; flex-direction: column; }
  .code small { font: 12px Arial, sans-serif; letter-spacing: 0; }
  .q { font-size: 13px; margin: 2mm 0; }
  .write { flex: 1; border-top: 1px dashed #888; background: repeating-linear-gradient(#fff 0 9mm, #ccc 9mm calc(9mm + 1px)); }
  .instructions { page-break-before: always; font-size: 14px; }
  .instructions li { margin-bottom: 5mm; break-inside: avoid; }
  .instructions p { font-size: 16px; line-height: 1.6; margin: 1mm 0 0; }
  .meta { color: #444; }
</style></head><body>
${pages.join('\n')}
<div class="instructions">
  <h2>${esc(opts.title)}: text to copy</h2>
  <p>Copy each text by hand into the box with the same code, exactly as written: same words, same spelling, same order. Do not write your name, roll number or anything else on the sheets.</p>
  <ol>${instructions}</ol>
</div>
</body></html>`;
}
