/**
 * The passage-id grammar of library contract v2.
 *
 * Every id is derived only from what the book prints (numbers, labels, page numbers, footnote marks)
 * and from the SECTION markers, never from position in the file, so fixing a typo on page 74 changes
 * no id anywhere else. The full grammar, with examples, is in ../README.md.
 *
 *   block    <book>:<ch>:<kind>:<number>[#<part>]                  sci9-en:07:example:7.2, sci9-en:07:exercise:A2
 *   paged    <book>:<ch>:<qbox|box|prompt>:p<page>[-<b>]:<n>[#<part>] sci9-en:07:qbox:p74:2, sci9-en:07:qbox:p74-2:1
 *   footnote <book>:<ch>:footnote:p<page>:<mark>[+<mark>][#<part>]  sci9-en:01:footnote:p1:*+**
 *   prose    <book>:<ch>:sec:<section number|slug>:<k>             sci9-en:07:sec:7.2:3, sci9-en:01:sec:chapter-opening:1
 *   summary  <book>:<ch>:summary:<n>                               sci9-en:07:summary:4
 *
 * Related ids that are not passages: section (a prose passage's parent) <book>:<ch>:sec:<section number|slug>,
 * golden <book>:<ch>:golden:<n>, answer <block id>:answer[:<part>].
 *
 * The grammar is the textbook-prep skill's (scripts/contract.py there: KINDS, KEY_RE, prose_ids), which
 * writes the block ids into the chapter file and the prose ids into ch<nn>_index.json. This contract
 * accepts every id the skill produces; it is a little wider in places (any printed footnote mark, a
 * sub-letter on any numbered kind), never narrower.
 *
 * The regexes use only syntax that ECMAScript, JSON Schema and PostgreSQL's ARE all read the same
 * way, so the same source strings back the zod schema, the JSON Schema and the SQL CHECK constraints.
 */

/** `sci9-en`: book + class + medium, from the book pack. */
export const BOOK_CODE_SRC = '[a-z0-9]+(?:-[a-z0-9]+)*';
/** Two digits as the skill writes it (`07`); three allowed for long books. */
export const CHAPTER_SRC = '[0-9]{2,3}';
/** A printed number: `7.2`, `10`, `7.2a`, or `A2` (an Additional Exercises question). */
export const PRINTED_NUMBER_SRC = 'A?[0-9]+(?:\\.[0-9]+)*[a-z]?';
/** A numbered section as stored in `section_no` (`7.2`, `7.2.1`). */
export const SECTION_NO_SRC = '[0-9]+(?:\\.[0-9]+)*';
/** A slug of an unnumbered section's title (`chapter-opening`, `what-you-have-learnt`). */
export const SECTION_SLUG_SRC = '[a-z0-9]+(?:-[a-z0-9]+)*';
/**
 * The section key of a prose id: the governing SECTION marker's number, or a slug of its title when it
 * has none (the skill's `prose_ids`). Unnumbered sections have `section_no` null.
 */
export const SECTION_SRC = `(?:${SECTION_NO_SRC}|${SECTION_SLUG_SRC})`;
const ORDINAL_SRC = '[1-9][0-9]*';
const PAGE_SRC = 'p[0-9]+';
/** A paged block's page, with `-<b>` for the b-th Questions box on that page (from 2). */
const PAGED_PAGE_SRC = `${PAGE_SRC}(?:-${ORDINAL_SRC})?`;
/** One printed footnote mark. */
const MARK_SRC = '(?:[*]{1,4}|[0-9]{1,2}|[a-z]|†|‡|§)';
/** The marks of one footnote block, joined with `+` when two footnotes are printed stacked (`*+**`). */
const MARKS_SRC = `${MARK_SRC}(?:\\+${MARK_SRC})*`;
const PART_SRC = `(?:#${ORDINAL_SRC})?`;

/**
 * Block kinds with a printed number. A new kind is a contract release (minor version), so an
 * unknown kind in a chapter file is refused at upload instead of guessed at.
 */
export const NUMBERED_BLOCK_KINDS = ['example', 'activity', 'figure', 'table', 'exercise', 'group-activity'] as const;
/**
 * Block kinds keyed by printed page. `qbox` is an in-text Questions box (`p<page>[-<b>]:<printed question
 * number>`); `box` and `prompt` are unnumbered reference and practice blocks, the n-th on that page in
 * reading order.
 */
export const PAGED_BLOCK_KINDS = ['qbox', 'box', 'prompt'] as const;

export type NumberedBlockKind = (typeof NUMBERED_BLOCK_KINDS)[number];
export type PagedBlockKind = (typeof PAGED_BLOCK_KINDS)[number];
export type BlockKind = NumberedBlockKind | PagedBlockKind | 'footnote';

const PREFIX = `(${BOOK_CODE_SRC}):(${CHAPTER_SRC})`;

export const BLOCK_ID_SRC =
  `${BOOK_CODE_SRC}:${CHAPTER_SRC}:(?:` +
  `(?:${NUMBERED_BLOCK_KINDS.join('|')}):${PRINTED_NUMBER_SRC}` +
  `|(?:${PAGED_BLOCK_KINDS.join('|')}):${PAGED_PAGE_SRC}:${ORDINAL_SRC}` +
  `|footnote:${PAGE_SRC}:${MARKS_SRC}` +
  `)${PART_SRC}`;
export const PROSE_ID_SRC = `${BOOK_CODE_SRC}:${CHAPTER_SRC}:sec:${SECTION_SRC}:${ORDINAL_SRC}`;
export const SUMMARY_ID_SRC = `${BOOK_CODE_SRC}:${CHAPTER_SRC}:summary:${ORDINAL_SRC}`;
export const PASSAGE_ID_SRC = `(?:${BLOCK_ID_SRC}|${PROSE_ID_SRC}|${SUMMARY_ID_SRC})`;
export const SECTION_ID_SRC = `${BOOK_CODE_SRC}:${CHAPTER_SRC}:sec:${SECTION_SRC}`;
export const GOLDEN_ID_SRC = `${BOOK_CODE_SRC}:${CHAPTER_SRC}:golden:${ORDINAL_SRC}`;
/** An answer belongs to a whole block (no `#part`); `part` is a printed sub-part letter or numeral. */
export const ANSWER_ID_SRC =
  `${BOOK_CODE_SRC}:${CHAPTER_SRC}:(?:` +
  `(?:${NUMBERED_BLOCK_KINDS.join('|')}):${PRINTED_NUMBER_SRC}` +
  `|(?:${PAGED_BLOCK_KINDS.join('|')}):${PAGED_PAGE_SRC}:${ORDINAL_SRC}` +
  `):answer(?::(?:[a-z]|[ivx]+))?`;

const anchored = (src: string) => new RegExp(`^${src}$`);

export const BOOK_CODE_RE = anchored(BOOK_CODE_SRC);
export const SECTION_NO_RE = anchored(SECTION_NO_SRC);
export const BLOCK_ID_RE = anchored(BLOCK_ID_SRC);
export const PROSE_ID_RE = anchored(PROSE_ID_SRC);
export const SUMMARY_ID_RE = anchored(SUMMARY_ID_SRC);
export const PASSAGE_ID_RE = anchored(PASSAGE_ID_SRC);
export const SECTION_ID_RE = anchored(SECTION_ID_SRC);
export const GOLDEN_ID_RE = anchored(GOLDEN_ID_SRC);
export const ANSWER_ID_RE = anchored(ANSWER_ID_SRC);

export type ParsedPassageId =
  | {
      kind: 'block';
      bookCode: string;
      chapter: number;
      blockKind: BlockKind;
      /** The id without its `#part` suffix: what quiz items, answer keys and answers point at. */
      blockId: string;
      /** Printed number (`7.2`) for numbered kinds. */
      number: string | null;
      /** Printed page for qbox, box, prompt and footnote ids. */
      page: number | null;
      /** For a qbox, the b-th Questions box on its page when it is not the first (`p74-2`); else null. */
      box: number | null;
      /** qbox: the printed question number; box and prompt: n-th of that kind on the page. */
      ordinal: number | null;
      /** Printed footnote mark(s), `*` or `*+**`. */
      mark: string | null;
      /** 1-based part of a split block, null when the block is whole. */
      part: number | null;
    }
  | {
      kind: 'prose';
      bookCode: string;
      chapter: number;
      /** The numbered section (`7.2`), or null for an unnumbered one (then `section_no` is null). */
      section: string | null;
      /** As written in the id: the section number or the slug of an unnumbered section's title. */
      sectionKey: string;
      k: number;
    }
  | { kind: 'summary'; bookCode: string; chapter: number; n: number };

const PROSE_PARTS = new RegExp(`^${PREFIX}:sec:(${SECTION_SRC}):(${ORDINAL_SRC})$`);
const SUMMARY_PARTS = new RegExp(`^${PREFIX}:summary:(${ORDINAL_SRC})$`);
const NUMBERED_PARTS = new RegExp(
  `^${PREFIX}:(${NUMBERED_BLOCK_KINDS.join('|')}):(${PRINTED_NUMBER_SRC})(?:#(${ORDINAL_SRC}))?$`,
);
const PAGED_PARTS = new RegExp(
  `^${PREFIX}:(${PAGED_BLOCK_KINDS.join('|')}):p([0-9]+)(?:-(${ORDINAL_SRC}))?:(${ORDINAL_SRC})(?:#(${ORDINAL_SRC}))?$`,
);
const FOOTNOTE_PARTS = new RegExp(`^${PREFIX}:footnote:p([0-9]+):(${MARKS_SRC})(?:#(${ORDINAL_SRC}))?$`);
const SECTION_NO_ONLY = new RegExp(`^${SECTION_NO_SRC}$`);

const stripPart = (id: string) => id.replace(/#[0-9]+$/, '');
const partOf = (raw: string | undefined) => (raw === undefined ? null : Number(raw));

/** Parses a passage id, or returns null when it is not one. */
export function parsePassageId(id: string): ParsedPassageId | null {
  let m = PROSE_PARTS.exec(id);
  if (m)
    return {
      kind: 'prose', bookCode: m[1], chapter: Number(m[2]), section: SECTION_NO_ONLY.test(m[3]) ? m[3] : null,
      sectionKey: m[3], k: Number(m[4]),
    };
  m = SUMMARY_PARTS.exec(id);
  if (m) return { kind: 'summary', bookCode: m[1], chapter: Number(m[2]), n: Number(m[3]) };
  m = NUMBERED_PARTS.exec(id);
  if (m)
    return {
      kind: 'block', bookCode: m[1], chapter: Number(m[2]), blockKind: m[3] as NumberedBlockKind, blockId: stripPart(id),
      number: m[4], page: null, box: null, ordinal: null, mark: null, part: partOf(m[5]),
    };
  m = PAGED_PARTS.exec(id);
  if (m)
    return {
      kind: 'block', bookCode: m[1], chapter: Number(m[2]), blockKind: m[3] as PagedBlockKind, blockId: stripPart(id),
      number: null, page: Number(m[4]), box: partOf(m[5]), ordinal: Number(m[6]), mark: null, part: partOf(m[7]),
    };
  m = FOOTNOTE_PARTS.exec(id);
  if (m)
    return {
      kind: 'block', bookCode: m[1], chapter: Number(m[2]), blockKind: 'footnote', blockId: stripPart(id),
      number: null, page: Number(m[3]), box: null, ordinal: null, mark: m[4], part: partOf(m[5]),
    };
  return null;
}

export const isPassageId = (id: string): boolean => PASSAGE_ID_RE.test(id);

const chapterCode = (chapter: number) => String(chapter).padStart(2, '0');

function assertBookCode(bookCode: string) {
  if (!BOOK_CODE_RE.test(bookCode)) throw new Error(`Not a book code: ${JSON.stringify(bookCode)}`);
}

const SECTION_KEY_RE = anchored(SECTION_SRC);

/**
 * The key of a section in prose and section ids: its number, or for an unnumbered section the slug of
 * its title (the skill's `slug`: lowercase, every run of other characters becomes one hyphen), or
 * `untitled` for prose before any SECTION marker.
 */
export function sectionKeyFor(sectionNo: string | null, sectionTitle: string | null): string {
  if (sectionNo !== null) {
    if (!SECTION_NO_RE.test(sectionNo)) throw new Error(`Not a section number: ${JSON.stringify(sectionNo)}`);
    return sectionNo;
  }
  const slug = (sectionTitle ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'untitled';
}

function assertSectionKey(section: string) {
  if (!SECTION_KEY_RE.test(section)) throw new Error(`Not a section number or slug: ${JSON.stringify(section)}`);
}

/**
 * The id of the k-th prose passage of a section (k from 1, in file order). `section` is the section's
 * key: its number, or the slug of an unnumbered section's title (see sectionKeyFor).
 */
export function proseIdFor(bookCode: string, chapter: number, section: string, k: number): string {
  assertBookCode(bookCode);
  assertSectionKey(section);
  if (!Number.isInteger(k) || k < 1) throw new Error(`Prose ordinal must be an integer from 1, got ${k}`);
  return `${bookCode}:${chapterCode(chapter)}:sec:${section}:${k}`;
}

/** The parent id of a section's prose passages. */
export function sectionIdFor(bookCode: string, chapter: number, section: string): string {
  assertBookCode(bookCode);
  assertSectionKey(section);
  return `${bookCode}:${chapterCode(chapter)}:sec:${section}`;
}

/** The id of the n-th "What you have learnt" bullet, in printed order from 1. */
export function summaryIdFor(bookCode: string, chapter: number, n: number): string {
  assertBookCode(bookCode);
  if (!Number.isInteger(n) || n < 1) throw new Error(`Summary ordinal must be an integer from 1, got ${n}`);
  return `${bookCode}:${chapterCode(chapter)}:summary:${n}`;
}

/** Part `part` (from 1) of a block too large to embed whole. */
export function splitPartId(blockId: string, part: number): string {
  const parsed = parsePassageId(blockId);
  if (!parsed || parsed.kind !== 'block' || parsed.part !== null) throw new Error(`Not a whole block id: ${blockId}`);
  if (!Number.isInteger(part) || part < 1) throw new Error(`Part must be an integer from 1, got ${part}`);
  return `${blockId}#${part}`;
}
