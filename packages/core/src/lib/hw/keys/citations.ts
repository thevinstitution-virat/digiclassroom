// Citations for textbook keys, in the tutor's NCERTCitation shape plus book identity
// (stage1-design.md §2.5). Pure.

import type { ChunkRow } from './trio';
import type { HwKeyCitation, KeyPassage, Medium } from './types';

/** "Chapter 3: Poverty as a Challenge" -> "3"; anything else is kept as it is. */
function chapterLabel(chapter: string | null): string {
  if (!chapter) return '';
  const m = /^chapter\s+(\d+)/i.exec(chapter.trim());
  return m ? m[1] : chapter.trim();
}

function pages(start: number, end: number): string {
  if (!start) return 'page not recorded';
  return end && end !== start ? `pp. ${start}–${end}` : `p. ${start}`;
}

export function buildCitation(
  row: ChunkRow,
  passage: KeyPassage,
  ctx: { classLevel: string; subject: string; medium: Medium; pagesVerified: ReadonlySet<string> },
  index: number,
): HwKeyCitation {
  const pageStart = row.pageStart ?? 0;
  const pageEnd = row.pageEnd ?? pageStart;
  const ch = chapterLabel(row.chapter);
  return {
    id: `cite_${index + 1}`,
    textbookTitle: row.title,
    chapter: row.chapter ?? '',
    pageNumber: pageStart,
    classLevel: ctx.classLevel,
    subject: ctx.subject,
    contentExcerpt: row.text.slice(0, 100),
    citationFormat: `${row.title} (${ctx.classLevel}, ${ctx.medium})${ch ? `, Ch. ${ch}` : ''}, ${pages(pageStart, pageEnd)}`,
    confidence: passage.score,
    isValid: ctx.pagesVerified.has(row.contentItemId),
    extractionMethod: 'gyankosh',
    chunkId: row.id,
    contentItemId: row.contentItemId,
    isbn: row.isbn,
    edition: row.edition,
    medium: ctx.medium,
    pageStart,
    pageEnd,
    pagesVerified: ctx.pagesVerified.has(row.contentItemId),
  };
}
