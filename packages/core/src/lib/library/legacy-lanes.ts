/**
 * The old ingestion lanes (markdown, PDF upload, PDLMS's trio-ingest push) write to `trio.content.*` and the old
 * collection. Once the library hub is the only writer (Phase 8 wipes the old data), they answer 410 instead. Off by
 * default: LEGACY_INGESTION_DISABLED=true switches them off, per deploy, so the flag can be turned back if needed.
 */
export const LEGACY_INGESTION_GONE = {
  success: false,
  error: 'Book ingestion moved to the PDLMS library hub. Upload and approve books there; DigiClassroom reads the result.',
  code: 'LEGACY_INGESTION_DISABLED',
} as const;
