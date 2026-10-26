/**
 * Chapter-by-chapter upload of enriched Markdown into a chosen book: the rules, with no I/O.
 *
 * The upload page runs these in the browser BEFORE anything is sent, and the ingest route runs the same identity check
 * on the server, so the two cannot disagree about what "this chapter belongs to this book" means.
 *
 * Why this exists. A book is many chapter files. The console used to take one file and read the book's identity from
 * its frontmatter, with nothing to say which book the person meant. That is how a chapter ends up attached to the wrong
 * book: the text is right, the citations are right, and it answers as a different book. Nothing downstream can see it.
 * Now the person chooses the book, and every file is checked against it before a byte is uploaded.
 *
 * Nothing in here touches the network, the database or Node-only APIs, so it is safe to bundle into the browser.
 */
import { parseEnrichedMarkdown } from './markdown-ingest-parser';

/** The size the ingest lane accepts for one chapter. */
export const MAX_CHAPTER_BYTES = 5 * 1024 * 1024;

// ── Identity ─────────────────────────────────────────────────────────────────

/** An ISBN without hyphens or spaces, a trailing x upper-cased. "81-7450-518-0" -> "8174505180". */
export function normaliseIsbn(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[\s-]/g, '').toUpperCase();
}

/**
 * The ISBN-13 form, so a book printed with an ISBN-10 ("81-7450-518-0") and the same book listed with its ISBN-13
 * ("978-81-7450-518-7") are recognised as one book. Returns '' when the value is not a usable ISBN.
 */
export function toIsbn13(raw: string | null | undefined): string {
  const c = normaliseIsbn(raw);
  let twelve: string;
  if (/^\d{13}$/.test(c)) twelve = c.slice(0, 12);
  else if (/^\d{9}[\dX]$/.test(c)) twelve = `978${c.slice(0, 9)}`;
  else return '';
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  return `${twelve}${(10 - (sum % 10)) % 10}`;
}

/** An edition string compared the way a person reads it: case and spacing do not make a different edition. */
export function normaliseEdition(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface BookKey {
  isbn: string | null;
  edition: string | null;
}

/**
 * Why a chapter's frontmatter does NOT belong to this book, or null when it does (or when the only differences are
 * ones a person should know about but that do not make it a different book: see `identityNotes`).
 *
 * - No ISBN in the file: refused, because without it nothing can be checked.
 * - A different ISBN (ISBN-10 and ISBN-13 forms of one number count as the same): refused.
 * - Both editions written and they differ: refused. One side blank is not a mismatch; see identityNotes.
 */
export function identityMismatch(file: BookKey, book: BookKey, bookLabel = 'the selected book'): string | null {
  if (!normaliseIsbn(file.isbn)) {
    return `The file has no isbn in its frontmatter, so it cannot be checked against ${bookLabel}.`;
  }
  const fileIsbn = toIsbn13(file.isbn) || normaliseIsbn(file.isbn);
  const bookIsbn = toIsbn13(book.isbn) || normaliseIsbn(book.isbn);
  if (!bookIsbn) return null; // a book with no ISBN on record cannot disagree; the upload will record this one
  if (fileIsbn !== bookIsbn) {
    return `The file's ISBN is ${file.isbn} but ${bookLabel} is ${book.isbn}. It belongs to a different book.`;
  }
  const fe = normaliseEdition(file.edition);
  const be = normaliseEdition(book.edition);
  if (fe && be && fe !== be) {
    return `The file's edition is "${file.edition}" but ${bookLabel} is "${book.edition}". Different editions are different books.`;
  }
  return null;
}

/** Differences that do not block but that a person should see. */
export function identityNotes(file: BookKey & { title?: string }, book: BookKey & { title?: string }): string[] {
  const notes: string[] = [];
  const fe = normaliseEdition(file.edition);
  const be = normaliseEdition(book.edition);
  if (fe && !be) notes.push(`The book has no edition on record; this file says "${file.edition}", which will be recorded.`);
  if (!fe && be) notes.push(`The file has no edition; the book's is "${book.edition}".`);
  if (file.title && book.title && file.title.trim().toLowerCase() !== book.title.trim().toLowerCase()) {
    notes.push(`The file calls the book "${file.title}"; it is listed as "${book.title}". Titles may differ; the ISBN is what decides.`);
  }
  return notes;
}

// ── One file ─────────────────────────────────────────────────────────────────

export interface ChapterFileAnalysis {
  name: string;
  bytes: number;
  /** SHA-256 of the file's bytes (hex). Optional here; the caller computes it where it has the bytes. */
  sha256?: string;
  chapter: number | null;
  chapterTitle: string;
  bookTitle: string;
  isbn: string | null;
  edition: string | null;
  subject: string;
  status: string;
  declaredPages: string | null;
  /** First and last printed page that any chunk is cited on. */
  pages: { first: number; last: number } | null;
  chunks: { total: number; reference: number; practice: number };
  /** Anything the parser (or the size/extension check) refuses. A file with errors cannot be uploaded. */
  errors: string[];
  warnings: string[];
  skipped: string[];
}

/** Reads one chapter file with the same parser the server uses, and reports what it found. Never throws. */
export function analyseChapterFile(name: string, text: string, bytes: number = text.length): ChapterFileAnalysis {
  const blank: ChapterFileAnalysis = {
    name,
    bytes,
    chapter: null,
    chapterTitle: '',
    bookTitle: '',
    isbn: null,
    edition: null,
    subject: '',
    status: '',
    declaredPages: null,
    pages: null,
    chunks: { total: 0, reference: 0, practice: 0 },
    errors: [],
    warnings: [],
    skipped: [],
  };

  if (!/\.md$/i.test(name)) {
    return { ...blank, errors: [`"${name}" is not a .md file. This lane takes enriched Markdown; PDFs are added to the book separately.`] };
  }
  if (bytes > MAX_CHAPTER_BYTES) {
    return {
      ...blank,
      errors: [`"${name}" is ${(bytes / 1048576).toFixed(1)} MB; the limit is 5 MB per chapter. Split the book by chapter rather than sending it whole.`],
    };
  }

  let parsed: ReturnType<typeof parseEnrichedMarkdown>;
  try {
    parsed = parseEnrichedMarkdown(text);
  } catch (err) {
    return { ...blank, errors: [`"${name}" could not be read: ${err instanceof Error ? err.message : String(err)}`] };
  }

  const m = parsed.meta;
  const chapter = parseInt(String(m.chapter_number ?? ''), 10);
  const pageNumbers = parsed.chunks.map((c: any) => Number(c.metadata?.page)).filter((n: number) => Number.isFinite(n));
  return {
    ...blank,
    chapter: Number.isFinite(chapter) && chapter >= 1 ? chapter : null,
    chapterTitle: m.chapter_title ?? '',
    bookTitle: m.book_title ?? '',
    isbn: m.isbn ? String(m.isbn) : null,
    edition: m.edition ? String(m.edition) : null,
    subject: m.subject ?? '',
    status: (m.validation_status ?? '').toUpperCase(),
    declaredPages: m.chapter_pages ?? null,
    pages: pageNumbers.length ? { first: Math.min(...pageNumbers), last: Math.max(...pageNumbers) } : null,
    chunks: {
      total: parsed.chunks.length,
      reference: parsed.chunks.filter((c: any) => c.retrieval_class !== 'practice').length,
      practice: parsed.chunks.filter((c: any) => c.retrieval_class === 'practice').length,
    },
    errors: [...parsed.errors],
    warnings: [...parsed.warnings],
    skipped: [...parsed.skipped],
  };
}

/** SHA-256 of some bytes, hex. Works in the browser and in Node 19 or later. */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── A set of files against a book ─────────────────────────────────────────────

export interface KnownBook extends BookKey {
  id: string;
  title: string;
  /** Chapters already indexed for this book. */
  chapters: Array<{ partIndex: number; sha256: string | null }>;
}

export type BatchTarget = { mode: 'existing'; book: KnownBook } | { mode: 'new'; knownBooks?: KnownBook[] };

export interface PlannedChapter {
  name: string;
  chapter: number | null;
  /** What uploading it would do to the book. Null when it is blocked. */
  action: 'add' | 'replace' | 'unchanged' | null;
  blocked: boolean;
  /** Why it is blocked. Empty when it is not. */
  reasons: string[];
  /** Things to look at that do not block: parser warnings, a replaced chapter, an edition being recorded. */
  notes: string[];
}

export interface BatchPlan {
  items: PlannedChapter[];
  /** For a new book: the identity every file agrees on (from the first usable file). Null when none does. */
  identity: { isbn: string; edition: string | null; title: string } | null;
  /** Chapter numbers missing between 1 and the highest chapter the book would then have. */
  missingChapters: number[];
  summary: { add: number; replace: number; unchanged: number; blocked: number };
  /** True only when every file is fine and at least one would change the book. Nothing is sent otherwise. */
  canUpload: boolean;
  /** Problems with the set as a whole rather than one file. */
  problems: string[];
}

/**
 * Checks a set of chapter files against the book they are meant for, and says what uploading would do.
 *
 * Every check happens here, before anything is uploaded: a missing chapter number discovered after the bytes are
 * stored reads as an indexing bug, and a half-uploaded set is worse than none. Files are not skipped silently:
 * one blocked file blocks the whole upload until it is removed or fixed, so the set that is sent is the set that was
 * reviewed.
 */
export function planChapterBatch(files: ChapterFileAnalysis[], target: BatchTarget): BatchPlan {
  const problems: string[] = [];
  const items: PlannedChapter[] = files.map((f) => ({
    name: f.name,
    chapter: f.chapter,
    action: null,
    blocked: false,
    reasons: [],
    notes: [],
  }));
  const block = (i: number, why: string) => {
    items[i].blocked = true;
    items[i].reasons.push(why);
  };

  // 1. What the file says about itself.
  files.forEach((f, i) => {
    for (const e of f.errors) block(i, e);
    if (f.errors.length === 0) {
      if (f.chapter === null) {
        block(
          i,
          'No chapter_number in the frontmatter. It decides which chapter slot the file occupies; without it another upload could overwrite this one.',
        );
      }
      if (f.status !== 'APPROVED') {
        block(
          i,
          `validation_status is "${f.status || '(missing)'}", not APPROVED. A person has to check the transcription against the printed pages and set it to APPROVED before it becomes citable.`,
        );
      }
    }
    for (const w of f.warnings) items[i].notes.push(w);
  });

  // 2. Two files for one chapter would silently overwrite each other.
  const firstFor = new Map<number, number>();
  files.forEach((f, i) => {
    if (f.chapter === null) return;
    const seen = firstFor.get(f.chapter);
    if (seen === undefined) {
      firstFor.set(f.chapter, i);
    } else {
      block(i, `"${files[seen].name}" is also chapter ${f.chapter}. One would overwrite the other.`);
    }
  });

  // 3. Whose chapters are they?
  let identity: BatchPlan['identity'] = null;
  if (target.mode === 'existing') {
    const label = `"${target.book.title}"`;
    files.forEach((f, i) => {
      if (f.errors.length > 0) return;
      const mismatch = identityMismatch(f, target.book, label);
      if (mismatch) block(i, mismatch);
      else for (const n of identityNotes({ ...f, title: f.bookTitle }, target.book)) items[i].notes.push(n);
    });
  } else {
    const usable = files.findIndex((f) => f.errors.length === 0 && normaliseIsbn(f.isbn) !== '');
    files.forEach((f, i) => {
      if (f.errors.length === 0 && normaliseIsbn(f.isbn) === '') {
        block(i, 'No isbn in the frontmatter. A new book is identified by its ISBN and edition, so one is required.');
      }
    });
    if (usable >= 0) {
      const first = files[usable];
      identity = { isbn: first.isbn as string, edition: first.edition, title: first.bookTitle };
      files.forEach((f, i) => {
        if (i === usable || f.errors.length > 0 || normaliseIsbn(f.isbn) === '') return;
        const mismatch = identityMismatch(f, first, `the first file ("${first.name}")`);
        if (mismatch) block(i, `The files are not all from one book. ${mismatch}`);
      });
      for (const known of target.knownBooks ?? []) {
        if (identityMismatch(first, known) === null && normaliseEdition(first.edition) === normaliseEdition(known.edition)) {
          problems.push(
            `A book with this ISBN and edition already exists: "${known.title}". Select it from the list instead of creating a new one.`,
          );
          break;
        }
      }
    }
  }

  // 4. What each one would do to the book.
  const have = new Map<number, string | null>();
  if (target.mode === 'existing') for (const c of target.book.chapters) have.set(c.partIndex, c.sha256);
  files.forEach((f, i) => {
    if (items[i].blocked || f.chapter === null) return;
    if (!have.has(f.chapter)) {
      items[i].action = 'add';
    } else if (f.sha256 && have.get(f.chapter) === f.sha256) {
      items[i].action = 'unchanged';
      items[i].notes.push(`Chapter ${f.chapter} is already indexed with identical content; it will be skipped.`);
    } else {
      items[i].action = 'replace';
      items[i].notes.push(`Replaces the chapter ${f.chapter} that is already indexed.`);
    }
  });

  // 5. Gaps: chapters the book would still be missing after this upload.
  const present = new Set<number>(have.keys());
  items.forEach((it) => {
    if (!it.blocked && it.chapter !== null) present.add(it.chapter);
  });
  const highest = present.size ? Math.max(...present) : 0;
  const missingChapters: number[] = [];
  for (let n = 1; n < highest; n++) if (!present.has(n)) missingChapters.push(n);

  const summary = {
    add: items.filter((i) => i.action === 'add').length,
    replace: items.filter((i) => i.action === 'replace').length,
    unchanged: items.filter((i) => i.action === 'unchanged').length,
    blocked: items.filter((i) => i.blocked).length,
  };
  return {
    items,
    identity,
    missingChapters,
    summary,
    canUpload: files.length > 0 && summary.blocked === 0 && problems.length === 0 && summary.add + summary.replace > 0,
    problems,
  };
}
