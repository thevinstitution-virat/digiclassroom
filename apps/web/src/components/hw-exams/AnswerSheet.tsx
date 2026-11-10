// The printable answer sheet (sheet.ts lays it out): A4 pages, unruled, every question's number pre-printed in the left margin with space
// sized to its marks, the sheet code and page number large on every page, and a dark square in each corner so a photograph can be squared up.
// Labels are printed in English and Hindi together, since a printed page cannot switch language.

import type { SheetBlock, SheetLayout } from '@/lib/hw/exams/sheet'
import { A4, SHEET } from '@/lib/hw/exams/sheet'

export interface SheetData {
  set: { title: string; subject: string; subjectCode: string; maxMarks: number; durationMinutes: number }
  packageTitle: string
  layout: SheetLayout
}

const mm = (n: number) => `${n}mm`
const LETTERS = ['A', 'B', 'C', 'D']

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s: React.CSSProperties = { position: 'absolute', width: mm(6), height: mm(6), background: '#000' }
  if (pos[0] === 't') s.top = mm(4); else s.bottom = mm(4)
  if (pos[1] === 'l') s.left = mm(4); else s.right = mm(4)
  return <div style={s} aria-hidden />
}

function Block({ b }: { b: SheetBlock }) {
  if (b.kind === 'grid') {
    return (
      <div style={{ height: mm(b.heightMm), border: '0.3mm solid #555', borderRadius: mm(1.5), padding: `${mm(2)} ${mm(3)}`, boxSizing: 'border-box' }}>
        <div style={{ fontSize: '3mm', fontWeight: 600, marginBottom: mm(1.5) }}>Multiple choice — circle one letter / बहुविकल्पी — एक अक्षर पर गोला लगाएँ</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SHEET.gridPerRow}, 1fr)`, rowGap: 0 }}>
          {b.entries.map((e) => (
            <div key={e.label} style={{ height: mm(SHEET.gridRowMm), display: 'flex', alignItems: 'center', gap: mm(1.6), fontSize: '3.4mm' }}>
              <span style={{ width: mm(14), fontWeight: 700 }}>{e.label}</span>
              {LETTERS.map((l) => (
                <span key={l} style={{ width: mm(5.5), height: mm(5.5), borderRadius: '50%', border: '0.3mm solid #333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8mm' }}>{l}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }
  const extra = b.kind === 'extra'
  return (
    <div style={{ height: mm(b.heightMm), display: 'flex' }}>
      <div style={{ width: mm(SHEET.gutterMm), flex: 'none', paddingRight: mm(2), boxSizing: 'border-box' }}>
        {extra ? (
          <div style={{ fontSize: '2.6mm', lineHeight: 1.3, color: '#333' }}>Write the question number here before each answer.<br />हर उत्तर से पहले यहाँ प्रश्न संख्या लिखें।</div>
        ) : (
          <>
            <div style={{ fontSize: '6mm', fontWeight: 800, lineHeight: 1 }}>{b.label}</div>
            <div style={{ fontSize: '2.8mm', marginTop: mm(1) }}>{b.marks} {b.marks === 1 ? 'mark' : 'marks'} / अंक</div>
            {b.alternatives.length > 1 && (
              <div style={{ fontSize: '2.6mm', marginTop: mm(2), lineHeight: 1.5 }}>
                Answering / उत्तर:<br />
                {b.alternatives.map((a) => <span key={a} style={{ marginRight: mm(2), whiteSpace: 'nowrap' }}>☐ {a}</span>)}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ flex: 1, border: '0.3mm solid #777', borderRadius: mm(1.5) }} />
    </div>
  )
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
          <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: mm(SHEET.gapMm) }}>
            {p.blocks.map((b, i) => <Block key={i} b={b} />)}
          </div>
          <footer style={{ position: 'absolute', left: mm(SHEET.marginMm + 8), right: mm(SHEET.marginMm + 8), bottom: mm(5), height: mm(SHEET.footerMm - 4), display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '2.6mm', color: '#333' }}>
            <span>Write only inside the boxes; not in the left margin. / केवल खानों के अंदर लिखें, बाईं ओर के हाशिये में नहीं।</span>
            <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontWeight: 700, fontSize: '3.4mm' }}>{p.label}</span>
          </footer>
        </section>
      ))}
    </div>
  )
}
