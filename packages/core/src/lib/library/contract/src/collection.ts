/**
 * The shape of the library v2 Qdrant collection. PDLMS creates it and is its only writer; every
 * other app reads it with a read-only key and checks it against these values.
 */
export const LIBRARY_V2_COLLECTION = 'library_v2_te3l_3072';

export const EMBED_MODEL = 'text-embedding-3-large';
export const DENSE_VECTOR = 'dense';
export const DENSE_DIMENSIONS = 3072;
export const DENSE_DISTANCE = 'Cosine' as const;
export const SPARSE_VECTOR = 'bm25';
export const SPARSE_MODIFIER = 'idf' as const;

/** Payload fields searches filter on, indexed as keywords when the collection is created. */
export const KEYWORD_INDEX_FIELDS = [
  'work_id',
  'passage_id',
  'revision_id',
  'kind',
  'block_type',
  'section_no',
  'retrieval_class',
  'medium',
  'canonical_subject',
  'status',
  'visibility',
  'grant_org_ids',
] as const;

/** Payload fields indexed as integers (chapter scope from placements, page ranges). */
export const INTEGER_INDEX_FIELDS = ['chapter_no', 'page_start', 'page_end', 'payload_version'] as const;
