-- 005_multi_format_asset_model.sql
--
-- Target database: `trio`. Superuser.
--
-- A work is not one file. A Class 9 Civics book is a source PDF, fifteen
-- enriched-markdown chapters, two narrations of each chapter (male and female),
-- a timing map per narration, a cover and a thumbnail. This migration lets
-- content_asset describe that, so a reader or player selects a file by what it
-- IS rather than by extension or row order.
--
-- Applied while content.* is still empty.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Per-file hash, named apart from the work-level hash
-- ─────────────────────────────────────────────────────────────────────────────
-- content_item.canonical_sha256 identifies the WORK and comes only from the
-- role='source' PDF. content_asset.asset_sha256 identifies THIS FILE. Two names
-- because they answer different questions and will disagree constantly: editing
-- chapter 7's markdown changes that asset's hash and must NOT change the work's
-- identity or create a second content_item.
--
-- 004 called this column `sha256`, which read as "the hash" and invited exactly
-- that confusion.
ALTER TABLE content.content_asset RENAME COLUMN sha256 TO asset_sha256;

-- ─────────────────────────────────────────────────────────────────────────────
-- Parts and variants
-- ─────────────────────────────────────────────────────────────────────────────
-- part_index orders chapters within a work; part_label carries the human name
-- ("Chapter 3: Electoral Politics") so a UI need not re-derive it.
ALTER TABLE content.content_asset ADD COLUMN IF NOT EXISTS part_index integer;
ALTER TABLE content.content_asset ADD COLUMN IF NOT EXISTS part_label text;

-- variant distinguishes files that are the same rendition of the same part.
-- Audiobooks here are recorded twice, male and female. Without this they are two
-- rows identical in (role, part_index) differing only by hash, so a player picks
-- by row order — the same failure the rendition vocabulary exists to prevent.
--
-- It also makes audio_sync expressible: a timing map is generated from ONE
-- narration and is wrong against the other, so the sync asset carries the same
-- variant as the narration it aligns to.
ALTER TABLE content.content_asset ADD COLUMN IF NOT EXISTS variant text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rendition vocabulary gains enriched_md
-- ─────────────────────────────────────────────────────────────────────────────
-- The curated markdown is an asset in its own right, not a transient input: it
-- is what the chunks were built from, and re-ingesting a chapter means replacing
-- exactly that file.
ALTER TABLE content.content_asset DROP CONSTRAINT IF EXISTS content_asset_role_check;
ALTER TABLE content.content_asset
  ADD CONSTRAINT content_asset_role_check
  CHECK (role IN (
    'source',
    'enriched_md',
    'pdf_paginated',
    'epub',
    'audio',
    'audio_sync',
    'cover',
    'thumbnail'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity of a file within a work
-- ─────────────────────────────────────────────────────────────────────────────
-- Re-uploading a byte-identical chapter is a no-op: same slot, same hash,
-- conflict, nothing written and nothing re-embedded.
--
-- A CHANGED chapter has a different hash and so takes a new row in the same
-- slot. That is deliberate — the old row stays as the record of what was
-- previously published — but it means "the current chapter 3" is not "the only
-- chapter-3 row". It is the one whose ingest_run is active. See the note below.
CREATE UNIQUE INDEX IF NOT EXISTS content_asset_identity_uq
  ON content.content_asset (content_item_id, role, part_index, variant, asset_sha256)
  NULLS NOT DISTINCT;

COMMIT;
