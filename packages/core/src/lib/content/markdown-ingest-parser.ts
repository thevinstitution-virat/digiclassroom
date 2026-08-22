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
 * Typed blocks kept ATOMIC (never split), better retrieval + citation — every
 * type in the prep skill's block-types spec, each closed by its own [/TAG]:
 *   [FIGURE] [TABLE] [GRAPH] [CASE STUDY] [DIALOGUE] [GLOSSARY TERM]
 *   [FEATURE BOX] [QR CODE] [DISCUSSION_PROMPT] [ACTIVITY]
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
  /** Parsed from chapter_pages when it is a range. */
  chapter_page_start?: number;
  chapter_page_end?: number;
  isbn?: string;
  edition?: string;
  publisher?: string;
  validation_status: string;
  validated_by?: string;
  processed_by?: string;
}

export interface ParsedMarkdown {
  meta: EnrichedBookMeta;
  chunks: any[];        // shape consumed by EnhancedRAGPipeline.indexChunksInQdrant
  skipped: string[];    // audit trail: SKIP regions + UNCLEAR flags
  warnings: string[];
  /** Non-empty means REFUSE. A warning lets a bad file through; this must not. */
  errors: string[];
}

/**
 * Which block types are practice rather than reference.
 *
 * A prompt, an activity and an exercise question are things a student is meant
 * to answer. Retrieval must be able to exclude them, or the tutor answers a
 * student's question by quoting the textbook's question back at them and cites
 * it confidently.
 */
const PRACTICE_BLOCK_TYPES = new Set(['discussion_prompt', 'suggested_activity']);

/**
 * Section titles whose PROSE is practice too. Typed blocks are not the only
 * carrier — a chapter's exercises are usually a numbered list under a heading.
 */
const PRACTICE_SECTION_RE =
  /\b(exercise|questions?|let'?s\s+(discuss|explore|reflect)|activit(y|ies)|think\s+about\s+it|assessment)\b/i;

/**
 * Publisher wording that means "exercises" without using any of the words
 * above. NCERT's current science series heads its exercise set **"Let us
 * enhance our learning"**, which matched nothing — so a whole chapter's
 * questions were classified `reference`, became answerable source text, and
 * the retrieval-side `must_not practice` filter had nothing to exclude.
 *
 * Listed explicitly rather than by loosening the alternative above to a bare
 * /let\s+us/, which would also swallow ordinary prose ("let us now consider").
 *
 * Deliberately EXCLUDES "Learning further" and similar extension headings.
 * Marking a section practice removes it from answers entirely, so an ambiguous
 * heading — one that may carry real extension content rather than questions —
 * is left as reference. Over-matching here loses book content silently, which
 * is the worse failure of the two.
 */
const PRACTICE_SECTION_EXTRA_RE =
  /\b(enhance\s+our\s+learning|let\s+us\s+(enhance|practise|practice|assess|test)|check\s+your\s+(understanding|progress)|self[-\s]assessment|review\s+questions?|test\s+yourself)\b/i;

const isPracticeSection = (title: string): boolean =>
  PRACTICE_SECTION_RE.test(title) || PRACTICE_SECTION_EXTRA_RE.test(title);

const CONTENT_SOURCE = 'curated_markdown';

/**
 * Every atomic block TAG the parser understands, mapped to its chunk
 * `content_type`.
 *
 * Keyed by tag text rather than by a per-type regex, because the closing tag is
 * derived from the tag the opener actually used — `[GLOSSARY TERM …]` closes
 * with `[/GLOSSARY TERM]`, `[ACTIVITY …]` with `[/ACTIVITY]`. A table keeps the
 * two spellings of the practice-activity block (`ACTIVITY` per the block-types
 * spec, `SUGGESTED_ACTIVITY` per older files) pointing at one type without
 * needing two closing conventions hard-coded.
 *
 * GLOSSARY TERM and QR CODE were absent here while being present in the skill's
 * spec and in the linter's own list. The cost was not cosmetic: a correctly
 * authored, correctly closed glossary block was merged into the surrounding
 * prose chunk AND dragged the following paragraph in with it, so a definition
 * a student asks for retrieved as the middle of an unrelated paragraph.
 */
const BLOCK_TAG_TYPES: Record<string, string> = {
  FIGURE: 'figure',
  TABLE: 'table',
  GRAPH: 'graph',
  'CASE STUDY': 'case_study',
  'GLOSSARY TERM': 'glossary_term',
  'FEATURE BOX': 'feature',
  FEATURE: 'feature',
  BOX: 'box',
  'QR CODE': 'qr_code',
  DIALOGUE: 'dialogue',
  DISCUSSION_PROMPT: 'discussion_prompt',
  SUGGESTED_ACTIVITY: 'suggested_activity',
  ACTIVITY: 'suggested_activity',
  EXAMPLE: 'example',
};

/**
 * An opening tag: `[TAG]`, `[TAG 8.2 | …]`, `[TAG | …]`.
 *
 * The tag capture is lazy so a two-word tag resolves to the longest form that
 * actually reaches a `|` or `]` — `[FEATURE BOX | …]` yields `FEATURE BOX`, not
 * `FEATURE`. Same shape the linter uses, deliberately: two regexes that are
 * supposed to recognise the same thing must not be written differently.
 */
const OPEN_TAG_RE = /^\[([A-Z][A-Z_ ]*?)(?:\s+[\d.]+)?\s*(?:\||\])/;
const CLOSE_TAG_RE = /^\[\/([A-Z][A-Z_ ]*)\]\s*$/;

const openTagOf = (line: string): string | null => {
  const m = line.match(OPEN_TAG_RE);
  return m ? m[1].trim() : null;
};
const closeTagOf = (line: string): string | null => {
  const m = line.match(CLOSE_TAG_RE);
  return m ? m[1].trim() : null;
};

const MARKER_RE = /^<!--\s*(.*?)\s*-->$/;
const PAGE_RE = /^PAGE\s+(\d+)/i;
const SECTION_RE = /^SECTION:\s*(.+)$/i;
const SUBSECTION_RE = /^SUBSECTION:\s*(.+)$/i;
/**
 * An ATX heading, `##` or `###` (or deeper — `####` is treated as a subsection
 * too, since publishers nest inconsistently and a deeper heading is still a
 * topic shift). `#` is excluded: see the dispatch site.
 */
const HEADING_RE = /^(#{2,6})\s+(.+?)\s*#*$/;
const SKIP_RE = /\bSKIP\b/i;
const END_SKIP_RE = /^\s*(\/\s*SKIP|END\s+SKIP|SKIP\s+END)\b/i;
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

/**
 * Undo markdown escaping.
 *
 * The skill's output reaches this parser having been through a markdown-escaping
 * step somewhere in transport: the opening delimiter arrives as `\---`, and keys
 * as `book\_title:`. Both are lossless to reverse and neither is ambiguous —
 * a backslash before ASCII punctuation is never meaningful inside a frontmatter
 * key or a `---` fence.
 */
function unescapeMd(s: string): string {
  return s.replace(/\\([-_*[\]()#+.!>`~|])/g, '$1');
}

/** Characters a markdown escaper adds a backslash in front of. */
const MD_ESCAPED_RE = /\\([-_*[\]()#+.!>`~|{}])/g;

export interface EscapeNormalization {
  text: string;
  /** How many escapes were removed. Non-zero means the file arrived escaped. */
  removed: number;
}

/**
 * Strip markdown-escape artefacts from a whole document.
 *
 * This lives in the parser permanently and unconditionally, whatever the prep
 * side does, because the bytes that arrive are the bytes that get indexed. The
 * one real chapter on hand arrives with `\---`, `book\_title:` and `\[FIGURE`,
 * and where the escaping is introduced — the author, the tool, or transport —
 * does not change what has to be parsed.
 *
 * Frontmatter unescaping alone was not enough. It made the metadata parse, which
 * made the file look healthy, while every escaped `\[FIGURE` in the body stayed
 * unrecognised and every typed block was silently indexed as loose prose.
 *
 * Only a backslash immediately before markdown punctuation is removed; every
 * other byte passes through, so the transformation is provably nothing but
 * escape removal. Fenced code blocks are left alone — a backslash there is
 * content, not syntax.
 */
export function normalizeEscapes(md: string): EscapeNormalization {
  // Split on fences; even-indexed segments are outside code, odd are inside.
  const segments = md.split(/(```)/);
  let inCode = false;
  let removed = 0;
  const out = segments.map((seg) => {
    if (seg === '```') { inCode = !inCode; return seg; }
    if (inCode) return seg;
    return seg.replace(MD_ESCAPED_RE, (_m, ch) => { removed += 1; return ch; });
  });
  return { text: out.join(''), removed };
}

const FENCE_RE = /^\\?-{3}\s*$/;

/**
 * Parse the leading `--- BOOK_METADATA … ---` frontmatter block.
 *
 * Returns an EXACT byte offset for the body. The previous implementation
 * rebuilt the offset by re-joining split lines with '\n' after splitting on
 * /\r?\n/, so on a CRLF file it was short by one byte per frontmatter line and
 * the tail of the frontmatter leaked into the first prose chunk. Offsets are
 * now accumulated from the original separators as they are found.
 *
 * `errors` is the load-bearing part. Failing to find frontmatter used to be a
 * warning that produced empty metadata and a body consisting of the whole file,
 * frontmatter included — so a malformed file indexed its own YAML as textbook
 * prose and reported success. That must be a refusal, not a warning.
 */
function parseFrontmatter(md: string): {
  meta: EnrichedBookMeta;
  bodyStart: number;
  /** 1-based FILE line number of the body's first line, so every warning the
   *  parser emits points at a line a human can open in the source file rather
   *  than at a body-relative offset nothing else uses. */
  bodyStartLine: number;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Walk the original string so every offset is real, CRLF or LF.
  const lineStarts: number[] = [];
  const lineTexts: string[] = [];
  const lineEnds: number[] = []; // offset just past this line's terminator
  {
    let pos = 0;
    while (pos <= md.length) {
      const nl = md.indexOf('\n', pos);
      if (nl === -1) {
        lineStarts.push(pos);
        lineTexts.push(md.slice(pos));
        lineEnds.push(md.length);
        break;
      }
      lineStarts.push(pos);
      lineTexts.push(md.slice(pos, nl).replace(/\r$/, ''));
      lineEnds.push(nl + 1);
      pos = nl + 1;
    }
  }

  let start = -1;
  for (let i = 0; i < lineTexts.length; i++) {
    const t = lineTexts[i].trim();
    if (FENCE_RE.test(t)) { start = i; break; }
    if (t !== '') break; // frontmatter must be at the top
  }

  const kv: Record<string, string> = {};
  let end = -1;
  if (start !== -1) {
    for (let i = start + 1; i < lineTexts.length; i++) {
      const t = lineTexts[i].trim();
      if (FENCE_RE.test(t)) { end = i; break; }
      const m = unescapeMd(t).match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (m) kv[m[1].toLowerCase()] = unescapeMd(stripQuotes(m[2]));
    }
  }

  if (start === -1 || end === -1) {
    errors.push(
      'No BOOK_METADATA frontmatter block found (expected a `---` fence at the top of the file, ' +
        'a closing `---`, and `key: value` lines between them). Refusing rather than indexing ' +
        'the file as untitled body text.',
    );
  }

  const meta: EnrichedBookMeta = {
    book_title: kv['book_title'] || kv['booktitle'] || kv['book'] || kv['title'] || '',
    subject: canonicalSubject(kv['subject'] || ''),
    class_level: kv['class_level'] || kv['classlevel'] || kv['class'] || kv['grade'] || '',
    board: kv['board'] || kv['curriculum'] || 'CBSE',
    medium: kv['medium'] || kv['language'] || 'English',
    chapter_number: kv['chapter_number'] || kv['chapternumber'] || kv['chapter'] || '',
    chapter_title: kv['chapter_title'] || kv['chaptertitle'] || '',
    chapter_pages: kv['chapter_pages'],
    isbn: kv['isbn'],
    edition: kv['edition'],
    publisher: kv['publisher'],
    validation_status: (kv['validation_status'] || kv['status'] || 'PENDING').toUpperCase(),
    validated_by: kv['validated_by'],
    processed_by: kv['processed_by'],
  };

  // Printed page range this chapter occupies, e.g. "183–194" (en dash or hyphen).
  // Used to check that every chunk's page really falls inside the chapter, which
  // is what catches a chapter-extracted PDF whose file page 1 is book page 183.
  if (meta.chapter_pages) {
    const m = meta.chapter_pages.match(/(\d+)\s*[-–—]\s*(\d+)/);
    if (m) {
      meta.chapter_page_start = parseInt(m[1], 10);
      meta.chapter_page_end = parseInt(m[2], 10);
    } else {
      warnings.push(`chapter_pages "${meta.chapter_pages}" is not a page range — page bounds not checked.`);
    }
  }

  if (!meta.isbn) {
    warnings.push('No isbn in frontmatter — this chapter cannot be tied to a work key by ISBN.');
  }

  // Exact offset past the closing fence's own terminator. No re-joining.
  const bodyStart = end === -1 ? 0 : lineEnds[end];
  const bodyStartLine = end === -1 ? 1 : end + 2;
  return { meta, bodyStart, bodyStartLine, warnings, errors };
}

export function parseEnrichedMarkdown(input: string): ParsedMarkdown {
  // Unconditional, whole-document, before anything else looks at the bytes.
  const normalized = normalizeEscapes(input);
  const md = normalized.text;

  const { meta, bodyStart, bodyStartLine, warnings, errors } = parseFrontmatter(md);
  const body = md.slice(bodyStart);
  const lines = body.split(/\r?\n/);

  if (normalized.removed > 0) {
    warnings.push(
      `${normalized.removed} markdown escape(s) removed before parsing — this file arrived escaped. ` +
        `Parsed correctly, but the prep side is emitting escaped output (E12).`,
    );
  }

  /** Body index → 1-based line number in the original file. */
  const fileLine = (bodyIdx: number) => bodyIdx + bodyStartLine;

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
    // Practice by block type, or by the section it sits under. Both, because a
    // typed [DISCUSSION_PROMPT] and a bare numbered list under "Exercises" are
    // the same thing to a student and neither should answer a question.
    const isPractice =
      PRACTICE_BLOCK_TYPES.has(contentType) || isPracticeSection(sectionTitle());
    chunks.push({
      id: `${bookSlug}_ch${meta.chapter_number || 'x'}_p${page}_${seq}`,
      text: clean,
      retrieval_class: isPractice ? 'practice' : 'reference',
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
        // ENFORCED, not merely noted.
        //
        // This used to consume the marker and its trailing comment lines, record
        // a string, and continue — so the content the marker was pointing at fell
        // straight into prose accumulation on the next line and was embedded
        // anyway. The audit trail said SKIPPED and the vector store disagreed.
        //
        // A SKIP marker opens a REGION. It closes at an explicit end marker, or
        // at the next structural boundary (PAGE / SECTION / SUBSECTION), since
        // those are the only markers that redefine where we are in the book. The
        // number of body lines actually dropped is reported, so over-skipping is
        // visible in the audit trail instead of being inferred from a gap.
        const note: string[] = [inner];
        let dropped = 0;
        let j = i + 1;
        for (; j < lines.length; j++) {
          const t = lines[j].trim();
          const mk = t.match(MARKER_RE);
          if (mk) {
            const innerNext = mk[1];
            if (END_SKIP_RE.test(innerNext)) { break; }
            if (PAGE_RE.test(innerNext) || SECTION_RE.test(innerNext) || SUBSECTION_RE.test(innerNext)) {
              j -= 1; // hand the boundary marker back to the main loop
              break;
            }
            note.push(innerNext); // an explanatory comment inside the region
            continue;
          }
          if (t !== '') dropped += 1;
        }
        i = j;
        skipped.push(
          `SKIPPED (${dropped} body line${dropped === 1 ? '' : 's'} excluded): ${note.join(' | ')}`,
        );
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

    // ---- Markdown ATX headings as structure ----
    //
    // `## 7.1 Hot or Cold?` means exactly what `<!-- SECTION: 7.1 Hot or Cold? -->`
    // means. Only the comment form was recognised, so every skill-authored file
    // that used plain headings had NO section boundaries at all: prose flushed
    // only at PAGE markers, and the chapter chunked at exactly one chunk per
    // printed page.
    //
    // Measured on production — same parser, same collection: files authored with
    // markers averaged 560 chars per chunk and carried real section titles; files
    // authored with headings averaged 2,832 chars (max 4,588) and carried the
    // literal string 'General Section' on every chunk. At that size one sentence
    // is ~3% of its chunk's embedding, so a fact plainly printed in the book
    // retrieves as "not found".
    //
    // Three things recover together, because all three keyed off the section
    // title: chunk granularity, `section_title`, and practice classification — a
    // chapter's exercises are detected partly BY their heading, so with none the
    // exercises were indexed as answerable reference content and the retrieval
    // side's `must_not practice` filter had nothing to match.
    //
    // `#` is deliberately NOT a boundary: it is the chapter title, appears once
    // at the top, and would only open a stray empty section.
    const headingM = line.match(HEADING_RE);
    if (headingM) {
      const title = headingM[2].trim();
      if (title) {
        flushProse();
        if (headingM[1].length === 2) {
          currentSection = title;
          currentSubsection = '';
        } else {
          currentSubsection = title;
        }
      }
      // The heading text stays in the body: it is printed on the page, it is the
      // best one-line summary of the chunk it opens, and dropping it would lose
      // a real line of the book.
      prose.push(raw);
      continue;
    }

    // ---- Typed atomic blocks ----
    const openTag = openTagOf(line);
    const openType = openTag ? BLOCK_TAG_TYPES[openTag] : undefined;
    if (openTag && openType) {
      flushProse();
      const i0 = i; // the opening line, captured before `i` walks forward
      const buf: string[] = [raw];

      // Look ahead for this block's OWN closing tag. Honoured for every type,
      // not just the two that used to declare one — an unhonoured `[/FIGURE]`
      // is not inert, it leaves the block running and the next paragraph gets
      // absorbed into the figure's chunk.
      //
      // The search is bounded: blocks do not nest, so the next opening tag ends
      // it, and a foreign closing tag means the file's structure is already
      // broken. Without those bounds, one unclosed [GLOSSARY TERM] would run to
      // whatever the last closed glossary block in the file happened to be and
      // swallow the chapter.
      let closeAt = -1;
      let abort = '';
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        const ct = closeTagOf(t);
        if (ct) {
          if (ct === openTag) { closeAt = j; break; }
          abort = `a foreign [/${ct}] at line ${fileLine(j)}`;
          break;
        }
        const ot = openTagOf(t);
        if (ot && BLOCK_TAG_TYPES[ot]) { abort = `the next block [${ot}] opening at line ${fileLine(j)}`; break; }
      }

      if (closeAt !== -1) {
        for (let j = i + 1; j <= closeAt; j++) buf.push(lines[j]);
        i = closeAt;
      } else {
        // Implicit fallback: run until the next structural boundary (a marker /
        // another block / a foreign closer / a standalone bold heading), or a
        // second blank line, or EOF.
        //
        // It stays, because refusing an unclosed block would refuse the only
        // real chapter on hand. But it is never SILENT: a guessed boundary moves
        // a chunk boundary, and therefore moves a citation, and the guess is
        // invisible in the output it produces.
        let blanks = 0;
        let reason = 'end of file';
        let j = i + 1;
        while (j < lines.length) {
          const t = lines[j].trim();
          let boundary = '';
          if (MARKER_RE.test(t)) boundary = 'a structural marker';
          else if (closeTagOf(t)) boundary = `a foreign [/${closeTagOf(t)}]`;
          else { const ot = openTagOf(t); if (ot && BLOCK_TAG_TYPES[ot]) boundary = `the next block [${ot}]`; }
          if (!boundary && /^\*\*[^*]+\*\*$/.test(t)) boundary = 'a standalone bold heading';
          if (boundary && buf.length > 1) { reason = boundary; break; }
          if (t === '') { blanks += 1; if (blanks >= 2) { reason = 'a blank-line gap'; break; } } else { blanks = 0; }
          buf.push(lines[j]);
          j += 1;
        }
        i = j - 1;
        warnings.push(
          `[${openTag}] opened at line ${fileLine(i0)} has no [/${openTag}] — boundary GUESSED at line ` +
            `${fileLine(j - 1)} (stopped at ${reason}${abort ? `; closer search stopped at ${abort}` : ''}). ` +
            `The chunk boundary, and therefore every citation this block produces, rests on that guess.`,
        );
      }
      // A typed block usually declares its own printed page in the header,
      // e.g. "[TABLE 1.1 | Page 3 | Type: Data Table]" or "[FEATURE BOX 1.1 | Page 192-193]" — use it for the citation.
      const headerPage = buf[0].match(/\bPage\s+(\d+)(?:\s*[-–—]\s*(\d+))?/i);
      const pageStart = headerPage ? parseInt(headerPage[1], 10) : undefined;
      const pageEnd = headerPage?.[2] ? parseInt(headerPage[2], 10) : pageStart;
      pushChunk(buf.join('\n').trim(), openType, pageStart, pageEnd);
      continue;
    }

    // ---- A closing tag that reached here closes nothing ----
    //
    // Dropped, not accumulated. Reaching this point means the block-handling
    // branch above never consumed it, so there is no open block it belongs to.
    // Left in the prose buffer it became embedded text: a chunk whose body
    // contains a bare `[/FIGURE]` between two paragraphs, which the tutor then
    // quotes back at a student as though it were printed on the page.
    const strayClose = closeTagOf(line);
    if (strayClose) {
      warnings.push(
        `[/${strayClose}] at line ${fileLine(i)} closes nothing — dropped rather than indexed as prose. ` +
          `Either its opening tag is missing or an earlier block already ended.`,
      );
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

  // Every chunk's printed page must fall inside the chapter's declared range.
  // A chapter-extracted PDF whose file page 1 is the book's page 183 produces
  // chunks citing pages 1..12 — plausible-looking, silently wrong, and only
  // detectable against the range the frontmatter already states.
  if (meta.chapter_page_start && meta.chapter_page_end) {
    const outside = chunks.filter(
      (c) => c.metadata.page < meta.chapter_page_start! || c.metadata.page > meta.chapter_page_end!,
    );
    if (outside.length > 0) {
      const sample = outside.slice(0, 5).map((c) => c.metadata.page).join(', ');
      errors.push(
        `${outside.length} of ${chunks.length} chunk(s) cite a page outside the declared ` +
          `chapter_pages range ${meta.chapter_page_start}-${meta.chapter_page_end} (e.g. ${sample}). ` +
          `Either the PAGE markers are wrong or this file's pages are file-relative, not printed. ` +
          `Refusing: every citation this chapter produces would point at the wrong page.`,
      );
    }
  }

  return { meta, chunks, skipped, warnings, errors };
}
