-- 002_content_asset_kind_to_role.sql
--
-- Target database: `trio`. Superuser.
--
-- `content_item.kind` answers "what sort of thing is this?" (book, notes,
-- question bank). `content_asset` needs to answer a different question — "what
-- is this file FOR?" (source, cover, audio). Two different concepts sharing one
-- column name in adjacent tables is a collision that reads fine today and costs
-- an hour the first time someone joins the two.
--
-- Free to do now: nothing reads or writes content_asset yet. Not free later.
--
-- Deliberately a separate migration rather than an edit to 001, which has
-- already been applied — an applied migration is history, not a draft.

BEGIN;

ALTER TABLE content.content_asset RENAME COLUMN kind TO role;

COMMIT;
