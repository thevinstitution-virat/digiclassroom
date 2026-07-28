-- ============================================================================
-- SANCHIKA (संचिका) NOTES SYSTEM - COVER DESIGN MIGRATION
-- ============================================================================
-- Purpose: Add cover design and spine color fields to user_notes table
-- Database: virat_gyankosh
-- Created: 2025-11-20
-- Related: Notebook cover design feature
-- 
-- DESCRIPTION:
-- This migration adds visual customization fields to notes:
--   - cover_design: Identifier for the cover pattern/design
--   - spine_color: Hex color code for the notebook spine
--
-- HOW TO RUN THIS MIGRATION:
-- docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/add_cover_design_to_notes.sql
--
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;
USE virat_gyankosh;

-- ============================================================================
-- ADD COVER DESIGN COLUMNS
-- ============================================================================

-- Check and add cover_design column (stores design identifier)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'virat_gyankosh'
  AND TABLE_NAME = 'user_notes'
  AND COLUMN_NAME = 'cover_design';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE user_notes ADD COLUMN cover_design VARCHAR(50) DEFAULT ''solid-blue'' COMMENT ''Cover design identifier (e.g., floral-pink, abstract-waves, solid-blue)''',
  'SELECT ''Column cover_design already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add spine_color column (stores hex color code)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'virat_gyankosh'
  AND TABLE_NAME = 'user_notes'
  AND COLUMN_NAME = 'spine_color';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE user_notes ADD COLUMN spine_color VARCHAR(20) DEFAULT ''#3B82F6'' COMMENT ''Spine color as hex code (e.g., #3B82F6, #EF4444)''',
  'SELECT ''Column spine_color already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- CREATE INDEX FOR COVER DESIGN QUERIES
-- ============================================================================

-- Check and create index for filtering/grouping by cover design
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'virat_gyankosh'
  AND TABLE_NAME = 'user_notes'
  AND INDEX_NAME = 'idx_cover_design';

SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_cover_design ON user_notes(cover_design)',
  'SELECT ''Index idx_cover_design already exists'' AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Check if columns were added successfully
SELECT 
  COLUMN_NAME,
  COLUMN_TYPE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'virat_gyankosh' 
  AND TABLE_NAME = 'user_notes'
  AND COLUMN_NAME IN ('cover_design', 'spine_color');

-- Show updated table structure
DESCRIBE user_notes;

-- ============================================================================
-- SAMPLE UPDATE (COMMENTED OUT)
-- ============================================================================
/*
-- Update existing notes with random cover designs
UPDATE user_notes 
SET 
  cover_design = CASE 
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 10) = 0 THEN 'floral-pink'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 10) = 1 THEN 'floral-lavender'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 10) = 2 THEN 'abstract-waves'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 10) = 3 THEN 'abstract-geometric'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 10) = 4 THEN 'math-symbols'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 10) = 5 THEN 'science-elements'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 10) = 6 THEN 'solid-blue'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 10) = 7 THEN 'solid-green'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 10) = 8 THEN 'solid-purple'
    ELSE 'solid-orange'
  END,
  spine_color = CASE 
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 6) = 0 THEN '#3B82F6'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 6) = 1 THEN '#EF4444'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 6) = 2 THEN '#10B981'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 6) = 3 THEN '#F59E0B'
    WHEN MOD(CAST(SUBSTRING(id, 1, 8) AS UNSIGNED), 6) = 4 THEN '#8B5CF6'
    ELSE '#EC4899'
  END
WHERE cover_design IS NULL OR cover_design = 'solid-blue';
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
SELECT '✅ Migration completed successfully! Cover design columns added to user_notes table.' AS status;

