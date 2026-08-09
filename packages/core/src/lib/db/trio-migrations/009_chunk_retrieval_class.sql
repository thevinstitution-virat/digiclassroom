-- 009_chunk_retrieval_class.sql
--
-- Target database: `trio`. Superuser.
--
-- MIGRATE step (additive). Deployed code does not write this column yet; the
-- code that does ships immediately after, and NULL means "not classified",
-- which is the honest state for everything ingested before now.
--
-- WHY
--
-- A chapter is not homogeneous. NCERT chapters interleave explanatory prose
-- with "Let's Discuss" prompts, suggested activities and exercise questions.
-- Retrieval treats them identically today, so a student asking "why did the
-- Constituent Assembly choose universal adult franchise?" can be answered with
-- the textbook's own question back at them, cited confidently. The class rides
-- on the CHUNK, not on the file, precisely because one chapter file contains
-- both.
--
-- The column lives in Postgres, not only in the Qdrant payload, for the same
-- reason chunk text does: the payload is derived. A model swap is meant to be a
-- replay of content.content_chunk, and anything that exists only in the payload
-- is silently lost the moment that replay happens.
--
-- 'skip' is deliberately NOT a storable value. A skipped block is not content
-- with a property; it is content that was never ingested. Callers pass 'skip'
-- to have a chunk dropped before embedding, and a dropped chunk has no row.

BEGIN;

ALTER TABLE content.content_chunk
  ADD COLUMN IF NOT EXISTS retrieval_class text;

ALTER TABLE content.content_chunk
  DROP CONSTRAINT IF EXISTS content_chunk_retrieval_class_check;

ALTER TABLE content.content_chunk
  ADD CONSTRAINT content_chunk_retrieval_class_check
    CHECK (retrieval_class IS NULL OR retrieval_class IN ('reference', 'practice'));

COMMIT;
