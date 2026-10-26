import { z } from 'zod';
import { PASSAGE_ID_RE, SECTION_NO_RE, parsePassageId } from './passage-id';
import { UUID_RE } from './point-id';

/**
 * The Qdrant payload of one passage in a library v2 collection. ../schema/payload.schema.json is the
 * same contract as JSON Schema; the contract test keeps the two in step.
 *
 * There is no board, class or domain here on purpose: where a book is used is a placement
 * (`library.placement`), resolved to work ids and chapters before a search, never a payload field.
 */
export interface LibraryPayloadV2 {
  payload_version: 2;
  work_id: string;
  passage_id: string;
  chapter_no: number;
  /** Numbered section the passage belongs to; null for prose of an unnumbered section, exercises and the summary. */
  section_no: string | null;
  kind: PassageKind;
  /** Block header type as printed, upper snake case (`EXAMPLE`, `FEATURE_BOX`); null unless kind is block. */
  block_type: string | null;
  /** Printed label (`Example 7.2`, `Question 2`), when the block has one. */
  label: string | null;
  /** Printed pages. */
  page_start: number;
  page_end: number;
  /** PDF page of page_start, from the book manifest's page map. */
  pdf_page: number | null;
  retrieval_class: RetrievalClass;
  /** ISO 639 code of the book's language (`en`, `hi`). */
  medium: string;
  canonical_subject: string | null;
  status: PassageStatus;
  visibility: Visibility;
  grant_org_ids: string[];
  /** The chapter revision the passage's current content comes from. */
  revision_id: string;
  /** Order within the chapter, for window expansion by readers that bypass hub search. */
  chunk_order: number;
  /** The book's words only. Authored descriptions are embedded but never stored here. */
  text: string;
}

export const PASSAGE_KINDS = ['prose', 'block', 'summary'] as const;
export const RETRIEVAL_CLASSES = ['reference', 'practice'] as const;
/** `preview` points belong to a revision under review and must be filtered out by every app. */
export const PASSAGE_STATUSES = ['preview', 'live'] as const;
export const VISIBILITIES = ['public', 'org', 'private'] as const;

export type PassageKind = (typeof PASSAGE_KINDS)[number];
export type RetrievalClass = (typeof RETRIEVAL_CLASSES)[number];
export type PassageStatus = (typeof PASSAGE_STATUSES)[number];
export type Visibility = (typeof VISIBILITIES)[number];

export const BLOCK_TYPE_RE = /^[A-Z][A-Z0-9_]*$/;
export const MEDIUM_RE = /^[a-z]{2,3}$/;
export const SUBJECT_RE = /^[a-z][a-z0-9-]*$/;

const page = z.number().int().min(0);

/** The field shapes alone; `libraryPayloadV2Schema` adds the cross-field rules. */
export const libraryPayloadV2Fields = z
  .object({
    payload_version: z.literal(2),
    work_id: z.string().regex(UUID_RE),
    passage_id: z.string().regex(PASSAGE_ID_RE),
    chapter_no: z.number().int().min(0),
    section_no: z.string().regex(SECTION_NO_RE).nullable(),
    kind: z.enum(PASSAGE_KINDS),
    block_type: z.string().regex(BLOCK_TYPE_RE).nullable(),
    label: z.string().min(1).nullable(),
    page_start: page,
    page_end: page,
    pdf_page: z.number().int().min(1).nullable(),
    retrieval_class: z.enum(RETRIEVAL_CLASSES),
    medium: z.string().regex(MEDIUM_RE),
    canonical_subject: z.string().regex(SUBJECT_RE).nullable(),
    status: z.enum(PASSAGE_STATUSES),
    visibility: z.enum(VISIBILITIES),
    grant_org_ids: z.array(z.string().min(1)),
    revision_id: z.string().regex(UUID_RE),
    chunk_order: z.number().int().min(0),
    text: z.string().min(1),
  })
  .strict();

export const libraryPayloadV2Schema = libraryPayloadV2Fields.superRefine((p, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (p.page_end < p.page_start) issue('page_end', 'page_end is before page_start');
  const id = parsePassageId(p.passage_id);
  if (!id) return;
  if (id.kind !== p.kind) issue('kind', `passage_id is a ${id.kind} id but kind is ${p.kind}`);
  if (id.chapter !== p.chapter_no) issue('chapter_no', `passage_id is in chapter ${id.chapter}, not ${p.chapter_no}`);
  if (id.kind === 'prose' && id.section !== p.section_no)
    issue('section_no', `passage_id is in section ${id.sectionKey}, but section_no is ${p.section_no ?? 'null'}`);
  if ((p.kind === 'block') !== (p.block_type !== null)) issue('block_type', 'block_type is set exactly when kind is block');
  if (p.visibility === 'org' && p.grant_org_ids.length === 0) issue('grant_org_ids', 'an org passage needs at least one org');
  if (p.visibility !== 'org' && p.grant_org_ids.length > 0) issue('grant_org_ids', 'grant_org_ids is only for org passages');
});

/** Parses a payload, throwing with every problem listed. */
export function parseLibraryPayloadV2(value: unknown): LibraryPayloadV2 {
  const result = libraryPayloadV2Schema.safeParse(value);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid library v2 payload: ${problems.join('; ')}`);
  }
  return result.data as LibraryPayloadV2;
}
