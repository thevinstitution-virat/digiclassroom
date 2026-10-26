import { createHash } from 'crypto';

/** The fields of a passage whose change means it must be re-embedded or its payload rewritten. */
export interface PassageContent {
  kind: 'prose' | 'block' | 'summary';
  block_type: string | null;
  label: string | null;
  section_no: string | null;
  section_title: string | null;
  page_start: number;
  page_end: number;
  retrieval_class: 'reference' | 'practice';
  parent_id: string | null;
  chunk_order: number;
  /** The book's words, the only quotable text. */
  text: string;
  /** `[provenance: authored]` lines, embedded but never quoted. */
  authored_text: string | null;
}

const FIELDS: (keyof PassageContent)[] = [
  'kind', 'block_type', 'label', 'section_no', 'section_title', 'page_start', 'page_end',
  'retrieval_class', 'parent_id', 'chunk_order', 'text', 'authored_text',
];

const nfc = (v: unknown) => (typeof v === 'string' ? v.normalize('NFC') : v);

/**
 * sha256 (hex) of a passage's content, as a JSON array in a fixed field order with strings NFC
 * normalised. Equal content gives an equal hash in every repo, so "unchanged" means the same thing
 * to the indexer, the review diff and any app that caches passages.
 */
export function passageContentSha(p: PassageContent): string {
  const values = FIELDS.map((f) => {
    const v = p[f];
    if (v === undefined) throw new Error(`passageContentSha: missing field ${f}`);
    return nfc(v);
  });
  return createHash('sha256').update(JSON.stringify(values), 'utf8').digest('hex');
}
