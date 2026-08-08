-- 003_seed_class9_subjects.sql
--
-- Target database: `trio`. Superuser.
--
-- WHY
--
-- The school tree is board > medium > class > subject. Class nodes exist for all
-- 12 classes across 10 board/medium combinations (120 rows), but SUBJECT nodes
-- were only ever seeded under Class 10 and Class 12. Every Class 9 textbook —
-- Civics, Geography, Economics, Science, History, ICT, Health & PE, Beehive
-- English — therefore had nowhere to be tagged, so curriculum scoping could not
-- be exercised at all for the corpus actually on hand.
--
-- Seeds for the corpus we have, not for one test.
--
-- SCOPE
--
-- Only the three board/medium combinations that already carry subjects at
-- Class 10/12 (CBSE>English, CBSE>Hindi, ICSE>English). The other seven Class 9
-- nodes are left bare, exactly as their Class 10 counterparts are — this
-- migration fills a gap in the existing pattern rather than inventing a wider one.
--
-- INTEGRATED TEXTBOOKS
--
-- NCERT ships Social Science as four separate volumes (History, Geography,
-- Political Science, Economics) that are one subject on the timetable. A chapter
-- must be findable under its discipline AND under the umbrella, so the
-- disciplines are seeded as children of Social Science. An Economics chapter then
-- links primary → Economics, secondary → Social Science.
--
-- Idempotent: ON CONFLICT on the (parent_id, slug) unique constraint.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The five timetable subjects, mirroring Class 10
-- ─────────────────────────────────────────────────────────────────────────────
WITH target_classes AS (
  SELECT c.id AS class_id,
         c.domain,
         c.ancestor_ids || c.id AS class_path
  FROM taxonomy.taxonomy_nodes c
  JOIN taxonomy.taxonomy_nodes m ON m.id = c.parent_id
  JOIN taxonomy.taxonomy_nodes b ON b.id = m.parent_id
  WHERE c.node_type = 'class'
    AND c.name = 'Class 9'
    AND (b.name, m.name) IN (('CBSE', 'English'), ('CBSE', 'Hindi'), ('ICSE', 'English'))
),
subjects (name, slug) AS (
  VALUES ('English', 'english'),
         ('Hindi', 'hindi'),
         ('Mathematics', 'mathematics'),
         ('Science', 'science'),
         ('Social Science', 'social-science')
)
INSERT INTO taxonomy.taxonomy_nodes
  (id, domain, node_type, name, slug, parent_id, ancestor_ids, sort_order, is_active, updated_at)
SELECT gen_random_uuid(), tc.domain, 'subject', s.name, s.slug,
       tc.class_id, tc.class_path, 0, true, now()
FROM target_classes tc
CROSS JOIN subjects s
ON CONFLICT (parent_id, slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The four Social Science disciplines, as children of Social Science
-- ─────────────────────────────────────────────────────────────────────────────
WITH social_science AS (
  SELECT s.id,
         s.domain,
         s.ancestor_ids || s.id AS ss_path
  FROM taxonomy.taxonomy_nodes s
  JOIN taxonomy.taxonomy_nodes c ON c.id = s.parent_id
  WHERE s.node_type = 'subject'
    AND s.slug = 'social-science'
    AND c.node_type = 'class'
    AND c.name = 'Class 9'
),
disciplines (name, slug) AS (
  VALUES ('History', 'history'),
         ('Geography', 'geography'),
         ('Political Science', 'political-science'),
         ('Economics', 'economics')
)
INSERT INTO taxonomy.taxonomy_nodes
  (id, domain, node_type, name, slug, parent_id, ancestor_ids, sort_order, is_active, updated_at)
SELECT gen_random_uuid(), ss.domain, 'subject', d.name, d.slug,
       ss.id, ss.ss_path, 0, true, now()
FROM social_science ss
CROSS JOIN disciplines d
ON CONFLICT (parent_id, slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Enforce "exactly one primary tag per item" in the schema
-- ─────────────────────────────────────────────────────────────────────────────
-- content_taxonomy_link already permits many rows per item (unique on
-- (content_item_id, node_id)), which is what secondary tags need. But nothing
-- stopped an item having two primaries, or none — it was a convention held only
-- by the ingest code. Since the whole point of a primary tag is that there is
-- exactly one, the database should say so, the same way ingest_run_one_active
-- does for runs.
CREATE UNIQUE INDEX IF NOT EXISTS content_taxonomy_link_one_primary
  ON taxonomy.content_taxonomy_link (content_item_id)
  WHERE is_primary;

COMMIT;
