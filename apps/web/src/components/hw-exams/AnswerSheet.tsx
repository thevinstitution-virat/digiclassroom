// The printable answer sheet (sheet.ts lays it out): A4 pages, unruled, every question's number pre-printed in the left margin with space
// sized to its marks, the sheet code and page number large on every page, and a dark square in each corner so a photograph can be squared up.
// Every block is drawn at the position sheet-geometry.ts gives, the same positions the photo reader uses (sheet-vision.ts), and a strip of small
// squares between the top corners spells the sheet code and page for code to read. Labels are printed in English and Hindi together.

import type { SheetLayout } from '@/lib/hw/exams/sheet'
import { A4, SHEET } from '@/lib/hw/exams/sheet'
import { cornerRects, encodeStrip, pageGeometry, stripCells, type BlockGeometry, type MmRect } from '@/lib/hw/exams/sheet-geometry'

export interface SheetData {
  set: { title: string; subject: string; subjectCode: string; maxMarks: number; durationMinutes: number }
  packageTitle: string
  layout: SheetLayout
}

const mm = (n: number) => `${n}mm`
const at = (r: MmRect): React.CSSProperties => ({ position: 'absolute', left: mm(r.x), top: mm(r.y), width: mm(r.w), height: mm(r.h), boxSizing: 'border-box' })

function Block({ g, b }: { g: BlockGeometry; b: SheetLayout['pages'][number]['blocks'][number] }) {
  if (g.kind === 'grid') {
    return (
      <>
        <div style={{ ...at(g.rect), border: '0.3mm solid #555', borderRadius: mm(1.5) }} />
        <div style={{ ...at(g.title), fontSize: '3mm', fontWeight: 600, lineHeight: mm(4), whiteSpace: 'nowrap', overflow: 'hidden' }}>Multiple choice — circle one letter / बहुविकल्पी — एक अक्षर पर गोला लगाएँ</div>
        {g.entries.map((e) => (
          <div key={e.label}>
            <span style={{ ...at(e.labelRect), fontWeight: 700, fontSize: '3.4mm', display: 'flex', alignItems: 'center' }}>{e.label}</span>
            {e.bubbles.map((bb) => (
              <span key={bb.letter} style={{ ...at(bb.rect), borderRadius: '50%', border: '0.3mm solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8mm' }}>{bb.letter}</span>
            ))}
          </div>
        ))}
      </>
    )
  }
  const extra = g.kind === 'extra'
  const ans = b.kind === 'answer' ? b : null
  return (
    <>
      <div style={{ ...at(g.gutter), paddingRight: mm(2) }}>
        {extra || !ans ? (
          <div style={{ fontSize: '2.6mm', lineHeight: 1.3, color: '#333' }}>Write the question number here before each answer.<br />हर उत्तर से पहले यहाँ प्रश्न संख्या लिखें।</div>
        ) : (
          <>
            <div style={{ fontSize: '6mm', fontWeight: 800, lineHeight: 1 }}>{ans.label}</div>
            <div style={{ fontSize: '2.8mm', marginTop: mm(1) }}>{ans.marks} {ans.marks === 1 ? 'mark' : 'marks'} / अंक</div>
            {ans.alternatives.length > 1 && (
              <div style={{ fontSize: '2.6mm', marginTop: mm(2), lineHeight: 1.5 }}>
                Answering / उत्तर:<br />
                {ans.alternatives.map((a) => <span key={a} style={{ marginRight: mm(2), whiteSpace: 'nowrap' }}>☐ {a}</span>)}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ ...at(g.box), border: '0.3mm solid #777', borderRadius: mm(1.5) }} />
    </>
  )
}

/** The page's identity in squares (sheet-geometry.ts): filled = 1; the first and last are always filled. */
function Strip({ code, page }: { code: string; page: number }) {
  const bits = encodeStrip(code, page)
  if (!bits) return null
  const on = [true, ...bits, true]
  return <>{stripCells().map((c, i) => <div key={i} aria-hidden style={{ ...at(c), background: on[i] ? '#000' : 'transparent' }} />)}</>
}

export function AnswerSheet({ data, candidate = true }: { data: SheetData; candidate?: boolean }) {
  const { layout, set } = data
  return (
    <div className="answer-sheet">
      <style>{`
        @page { size: A4; margin: 0; }
        .answer-sheet { color: #000; font-family: system-ui, 'Segoe UI', 'Noto Sans Devanagari', sans-serif; }
        .answer-sheet .sheet-page { width: ${A4.widthMm}mm; height: ${A4.heightMm}mm; position: relative; box-sizing: border-box; background: #fff;
          padding: ${SHEET.marginMm}mm; margin: 0 auto 8mm; box-shadow: 0 1px 6px rgba(0,0,0,.25); overflow: hidden; break-after: page; page-break-after: always; }
        @media print {
          body * { visibility: hidden !important; }
          .answer-sheet, .answer-sheet * { visibility: visible !important; }
          .answer-sheet { position: absolute; left: 0; top: 0; }
          .answer-sheet .sheet-page { margin: 0; box-shadow: none; }
          .no-print { display: none !important; }
        }
      `}</style>
      {layout.pages.map((p) => (
        <section key={p.page} className="sheet-page" aria-label={`Page ${p.page} of ${layout.totalPages}`}>
          {cornerRects().map((r, i) => <div key={i} aria-hidden style={{ ...at(r), background: '#000' }} />)}
          <Strip code={layout.code} page={p.page} />
          <header style={{ height: mm(SHEET.headerMm), display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: mm(4), paddingRight: mm(4) }}>
            <div style={{ fontSize: '3mm', lineHeight: 1.35, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '3.6mm' }}>{set.title}</div>
              <div>{set.subject} ({set.subjectCode}) · {set.maxMarks} marks / अंक · {set.durationMinutes} min</div>
              <div style={{ color: '#444' }}>{data.packageTitle}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 800, fontSize: '7mm', letterSpacing: '0.4mm', lineHeight: 1 }}>{p.label}</div>
              <div style={{ fontSize: '3mm', marginTop: mm(1) }}>Page {p.page} of {layout.totalPages} / पृष्ठ {p.page}/{layout.totalPages}</div>
            </div>
          </header>
          {p.page === 1 && candidate && (
            <div style={{ height: mm(SHEET.firstPageExtraMm), display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: mm(3), fontSize: '3mm' }}>
              {['Name / नाम', 'Attempt / प्रयास', 'Date / दिनांक'].map((l) => (
                <div key={l} style={{ borderBottom: '0.3mm solid #000', paddingTop: mm(6) }}>{l}</div>
              ))}
            </div>
          )}
          {pageGeometry(p, candidate).map((g, i) => <Block key={i} g={g} b={p.blocks[i]!} />)}
          <footer style={{ position: 'absolute', left: mm(SHEET.marginMm + 8), right: mm(SHEET.marginMm + 8), bottom: mm(5), height: mm(SHEET.footerMm - 4), display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '2.6mm', color: '#333' }}>
            <span>Write only inside the boxes; not in the left margin. / केवल खानों के अंदर लिखें, बाईं ओर के हाशिये में नहीं।</span>
            <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 700, fontSize: '3.4mm' }}>{p.label}</span>
          </footer>
        </section>
      ))}
    </div>
  )
}
