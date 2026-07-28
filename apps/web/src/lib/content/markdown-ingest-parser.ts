/**
 * Enriched-Markdown Ingestion Parser
 * ------------------------------------------------------------------
 * Parses a human-validated, skill-produced NCERT chapter markdown file
 * (see the `ncert-*` Agent Skills) into embedding-ready chunks that match
 * the same schema the Qdrant indexer consumes for the PDF-Extract-Kit lane.
 *
 * Why this exists: the enriched markdown already carries clean text, the
 * PRINTED page numbers, chapter/section structure, and typed content blocks —
 * all human-validated. So this lane skips OCR / layout / GPT-4 entirely and
 * feeds the shared embed → Qdrant tail directly, yielding high-fidelity
 * vectors with exact page citations.
 *
 * Boundaries honoured:
 *   <!-- PAGE N -->            → sets the printed page number (for citations)
 *   <!-- SECTION: ... -->      → section title
 *   <!-- SUBSECTION: ... -->   → appended to section title
 *   <!-- ... SKIP ... -->      → excluded, recorded in `skipped`
 * Typed blocks kept ATOMIC (never split), better retrieval + citation:
 *   [FIGURE ...] [TABLE ...] [GRAPH ...] [CASE STUDY ...] [DIALOGUE ...]
 *   [DISCUSSION_PROMPT]…[/DISCUSSION_PROMPT]
 *   [SUGGESTED_ACTIVITY]…[/SUGGESTED_ACTIVITY]
 */

export interface EnrichedBookMeta {
  book_title: string;
  subject: string;
  class_level: string;
  board: string;
  medium: string;
  chapter_number: string;
  chapter_title: string;
  chapter_pages?: string;
  edition?: string;
  publisher?: string;
  validation_status: string;
  validated_by?: string;
  processed_by?: string;
}

export interface ParsedMarkdown {
  meta: EnrichedBookMeta;
  chunks: any[];        // shape consumed by EnhancedRAGPipeline.indexChunksInQdrant
  skipped: string[];    // audit trail: SKIP blocks + UNCLEAR flags
  warnings: string[];
}

const CONTENT_SOURCE = 'curated_markdown';

// Opening tokens for atomic typed blocks.
const BLOCK_OPENERS: Array<{ re: RegExp; type: string; close?: RegExp }> = [
  { re: /^\[FIGURE\b/i, type: 'figure' },
  { re: /^\[TABLE\b/i, type: 'table' },
  { re: /^\[GRAPH\b/i, type: 'graph' },
  { re: /^\[CASE STUDY\b/i, type: 'case_study' },
  { re: /^\[FEATURE BOX\b/i, type: 'feature' },
  { re: /^\[FEATURE\b/i, type: 'feature' },
  { re: /^\[BOX\b/i, type: 'box' },
  { re: /^\[DIALOGUE\b/i, type: 'dialogue' },
  { re: /^\[DISCUSSION_PROMPT\]/i, type: 'discussion_prompt', close: /^\[\/DISCUSSION_PROMPT\]/i },
  { re: /^\[SUGGESTED_ACTIVITY\]/i, type: 'suggested_activity', close: /^\[\/SUGGESTED_ACTIVITY\]/i },
  { re: /^\[ACTIVITY\b/i, type: 'suggested_activity' },
  { re: /^\[EXAMPLE\b/i, type: 'example' },
];

const MARKER_RE = /^<!--\s*(.*?)\s*-->$/;
const PAGE_RE = /^PAGE\s+(\d+)/i;
const SECTION_RE = /^SECTION:\s*(.+)$/i;
const SUBSECTION_RE = /^SUBSECTION:\s*(.+)$/i;
const SKIP_RE = /SKIP\b/i;
const UNCLEAR_RE = /\[UNCLEAR[^\]]*\]/i;

function stripQuotes(v: string): string {
  return v.trim().replace(/^["']|["']$/g, '').trim();
}

function slug(s: string): string {
  return (s || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

/**
 * Canonicalise a possibly-verbose subject to the bare filterable name.
 * Skill frontmatter often writes descriptive subjects like
 * "Economics (Chapter 8 of 9; … — Social Science textbook)" — but the RAG
 * search does an EXACT keyword match on `subject`, so anything past the core
 * name breaks retrieval. Keep only the leading canonical token.
 * e.g. "Economics (Social Science)" → "Economics"
 */
function canonicalSubject(s: string): string {
  if (!s) return s;
  const core = s.split(/[(—]|\s[-–]\s|[;,]/)[0].trim();
  return core || s.trim();
}

/** Parse the leading `--- BOOK_METADATA … ---` frontmatter block. */
function parseFrontmatter(md: string): { meta: EnrichedBookMeta; bodyStart: number; warnings: string[] } {
  const warnings: string[] = [];
  const lines = md.split(/\r?\n/);

  // Find first `---` … next `---`
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') { start = i; break; }
    if (lines[i].trim() !== '') break; // frontmatter must be at the top
  }
  const kv: Record<string, string> = {};
  let end = -1;
  if (start !== -1) {
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') { end = i; break; }
      const m = lines[i].match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (m) kv[m[1].toLowerCase()] = stripQuotes(m[2]);
    }
  }
  if (end === -1) warnings.push('No BOOK_METADATA frontmatter block found — falling back to empty metadata.');

  const meta: EnrichedBookMeta = {
    book_title: kv['book_title'] || kv['booktitle'] || kv['book'] || kv['title'] || '',
    subject: canonicalSubject(kv['subject'] || ''),
    class_level: kv['class_level'] || kv['classlevel'] || kv['class'] || kv['grade'] || '',
    board: kv['board'] || kv['curriculum'] || 'CBSE',
    medium: kv['medium'] || kv['language'] || 'English',
    chapter_number: kv['chapter_number'] || kv['chapternumber'] || kv['chapter'] || '',
    chapter_title: kv['chapter_title'] || kv['chaptertitle'] || '',
    chapter_pages: kv['chapter_pages'],
    edition: kv['edition'],
    publisher: kv['publisher'],
    validation_status: (kv['validation_status'] || kv['status'] || 'PENDING').toUpperCase(),
    validated_by: kv['validated_by'],
    processed_by: kv['processed_by'],
  };

  // Byte offset where the body begins (line after the closing ---)
  const bodyStart = end === -1 ? 0 : lines.slice(0, end + 1).join('\n').length + 1;
  return { meta, bodyStart, warnings };
}

export function parseEnrichedMarkdown(md: string): ParsedMarkdown {
  const { meta, bodyStart, warnings } = parseFrontmatter(md);
  const body = md.slice(bodyStart);
  const lines = body.split(/\r?\n/);

  const chunks: any[] = [];
  const skipped: string[] = [];

  let currentPage = 1;
  let currentSection = 'General Section';
  let currentSubsection = '';
  let seq = 0;

  const chapterLabel = meta.chapter_number
    ? `Chapter ${meta.chapter_number}${meta.chapter_title ? `: ${meta.chapter_title}` : ''}`
    : (meta.chapter_title || 'General Chapter');
  const bookSlug = slug(meta.book_title);

  const sectionTitle = () => currentSubsection ? `${currentSection} — ${currentSubsection}` : currentSection;

  const pushChunk = (
    text: string,
    contentType: string,
    pageOverride?: number,
    pageEndOverride?: number
  ) => {
    const clean = text.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!clean) return;
    // Prose must be substantial; typed blocks are always kept.
    if (contentType === 'text' && clean.length < 40) return;

    // Typed blocks state their own printed page in the header (`| Page N |` or `| Page N-M |`);
    // prefer it over the section marker for exact citations.
    const page = Math.max(1, pageOverride || currentPage);
    const pageEnd = Math.max(page, pageEndOverride || page);

    if (UNCLEAR_RE.test(clean)) {
      skipped.push(`UNCLEAR flag on page ${page} (${contentType}) — indexed but needs human review`);
    }

    seq += 1;
    chunks.push({
      id: `${bookSlug}_ch${meta.chapter_number || 'x'}_p${page}_${seq}`,
      text: clean,
      metadata: {
        // required
        class: meta.class_level || 'Unknown',
        classLevel: meta.class_level || 'Unknown',
        subject: meta.subject || 'Unknown',
        book_title: meta.book_title || 'Unknown',
        bookTitle: meta.book_title || 'Unknown',
        page,                                     // PRINTED page → exact citation
        pageNumber: page,
        pageEndNumber: pageEnd,                   // PRINTED end page for range blocks (Page N-M)
        // structure
        chapter: chapterLabel,
        section_title: sectionTitle(),
        section: sectionTitle(),
        section_level: currentSubsection ? 3 : 2,
        board: meta.board,
        curriculum: meta.board,
        medium: meta.medium,
        language: meta.medium,
        source: `${meta.book_title} Class ${meta.class_level}`,
        // provenance + quality (human-validated → clears the <70 quality filter)
        extraction_method: 'embedded_text',
        content_type: contentType,
        content_source: CONTENT_SOURCE,
        validation_status: meta.validation_status,
        chapter_number: meta.chapter_number,
        confidence: 1.0,
        quality_score: 100,
        quality_grade: 'A',
        // content-type flags
        contains_table: contentType === 'table',
        contains_figure: contentType === 'figure' || contentType === 'graph',
        contains_equation: false,
        hasTables: contentType === 'table',
        hasFormulas: false,
        chunkType: contentType,
      },
    });
  };

  let prose: string[] = [];
  const flushProse = () => {
    if (prose.length) {
      pushChunk(prose.join('\n').trim(), 'text');
      prose = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // ---- HTML comment markers ----
    const marker = line.match(MARKER_RE);
    if (marker) {
      const inner = marker[1];
      if (SKIP_RE.test(inner)) {
        flushProse();
        // Collect the SKIP note + any immediately-following comment lines.
        const note: string[] = [inner];
        while (i + 1 < lines.length && MARKER_RE.test(lines[i + 1].trim()) && !PAGE_RE.test(lines[i + 1].trim().replace(MARKER_RE, '$1'))) {
          i += 1;
          note.push(lines[i].trim().replace(MARKER_RE, '$1'));
        }
        skipped.push(`SKIPPED: ${note.join(' | ')}`);
        continue;
      }
      const pageM = inner.match(PAGE_RE);
      if (pageM) { flushProse(); currentPage = parseInt(pageM[1], 10) || currentPage; continue; }
      const secM = inner.match(SECTION_RE);
      if (secM) { flushProse(); currentSection = secM[1].trim(); currentSubsection = ''; continue; }
      const subM = inner.match(SUBSECTION_RE);
      if (subM) { flushProse(); currentSubsection = subM[1].trim(); continue; }
      // Other markers (DISCUSSION PROMPT | …) are decorative → drop.
      continue;
    }

    // ---- Typed atomic blocks ----
    const opener = BLOCK_OPENERS.find(b => b.re.test(line));
    if (opener) {
      flushProse();
      const buf: string[] = [raw];
      let j = i + 1;
      if (opener.close) {
        // Explicit close tag.
        while (j < lines.length && !opener.close.test(lines[j].trim())) { buf.push(lines[j]); j += 1; }
        if (j < lines.length) buf.push(lines[j]); // include the close tag line
        i = j;
      } else {
        // Implicit: run until the next structural boundary (blank line then a
        // marker / another block / a bold heading), or a second blank line, or EOF.
        let blanks = 0;
        while (j < lines.length) {
          const t = lines[j].trim();
          const isBoundary =
            MARKER_RE.test(t) ||
            BLOCK_OPENERS.some(b => b.re.test(t)) ||
            (/^\*\*[^*]+\*\*$/.test(t)); // a standalone bold heading starts new prose
          if (isBoundary && buf.length > 1) break;
          if (t === '') { blanks += 1; if (blanks >= 2) break; } else { blanks = 0; }
          buf.push(lines[j]);
          j += 1;
        }
        i = j - 1;
      }
      // A typed block usually declares its own printed page in the header,
      // e.g. "[TABLE 1.1 | Page 3 | Type: Data Table]" or "[FEATURE BOX 1.1 | Page 192-193]" — use it for the citation.
      const headerPage = buf[0].match(/\bPage\s+(\d+)(?:\s*[-–—]\s*(\d+))?/i);
      const pageStart = headerPage ? parseInt(headerPage[1], 10) : undefined;
      const pageEnd = headerPage?.[2] ? parseInt(headerPage[2], 10) : pageStart;
      pushChunk(buf.join('\n').trim(), opener.type, pageStart, pageEnd);
      continue;
    }

    // ---- Prose accumulation ----
    if (line === '') {
      // paragraph break: flush if the buffer already has a full paragraph
      if (prose.length && prose[prose.length - 1] !== '') prose.push('');
    } else {
      prose.push(raw);
    }
  }
  flushProse();

  return { meta, chunks, skipped, warnings };
}
