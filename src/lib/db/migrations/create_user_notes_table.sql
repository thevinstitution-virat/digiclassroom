-- ============================================================================
-- SANCHIKA (संचिका) NOTES SYSTEM - DATABASE MIGRATION
-- ============================================================================
-- Purpose: Create the user_notes table for storing student notes
-- Database: virat_gyankosh
-- Created: 2025-11-19
-- Related API: /api/notes (src/app/api/notes/route.ts)
-- 
-- DESCRIPTION:
-- This migration creates the primary storage table for the Sanchika notes
-- system in DigiClassroom Pro. Notes can be created from AI Tutor answers
-- or manually by users. The table supports:
--   - Rich text content with markdown
--   - Flexible tagging system (JSON array)
--   - Pin/Favorite/Archive functionality
--   - Source tracking (AI Tutor queries and answers)
--   - Folder organization
--   - Full audit trail with timestamps
--
-- HOW TO RUN THIS MIGRATION:
-- 
-- Option 1: Using Docker exec (Recommended)
-- -----------------------------------------
-- docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_user_notes_table.sql
-- (Replace 'mysql_container' with your actual container name)
--
-- Option 2: Using MySQL CLI
-- -------------------------
-- mysql -h localhost -P 3306 -u root -p virat_gyankosh < src/lib/db/migrations/create_user_notes_table.sql
--
-- Option 3: Copy-paste into MySQL Workbench/phpMyAdmin
-- -----------------------------------------------------
-- Copy the entire contents of this file and execute in your MySQL client
--
-- ============================================================================

-- Set character set for this session
SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;

-- Use the correct database
USE virat_gyankosh;

-- ============================================================================
-- DROP EXISTING TABLE (Idempotent - Safe to Re-run)
-- ============================================================================
DROP TABLE IF EXISTS user_notes;

-- ============================================================================
-- CREATE user_notes TABLE
-- ============================================================================
CREATE TABLE user_notes (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY & USER IDENTIFICATION
  -- -------------------------------------------------------------------------
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for the note',
  clerk_id VARCHAR(255) NOT NULL COMMENT 'Clerk user ID (owner of the note)',
  
  -- -------------------------------------------------------------------------
  -- NOTE CONTENT
  -- -------------------------------------------------------------------------
  title VARCHAR(500) NOT NULL COMMENT 'Note title/heading',
  content TEXT COMMENT 'Note content (supports markdown)',
  
  -- -------------------------------------------------------------------------
  -- EDUCATIONAL METADATA
  -- -------------------------------------------------------------------------
  subject VARCHAR(100) COMMENT 'Subject name (e.g., Mathematics, Physics)',
  chapter VARCHAR(200) COMMENT 'Chapter or topic name',
  board VARCHAR(50) COMMENT 'Education board (e.g., CBSE, ICSE, State Board)',
  class_level VARCHAR(20) COMMENT 'Class/Grade level (e.g., 10, 12)',
  
  -- -------------------------------------------------------------------------
  -- DISPLAY & ORGANIZATION
  -- -------------------------------------------------------------------------
  orientation ENUM('portrait', 'landscape') DEFAULT 'portrait' COMMENT 'Page orientation for display/print',
  tags JSON COMMENT 'Array of tags for categorization (e.g., ["important", "exam", "revision"])',
  folder_id VARCHAR(36) COMMENT 'Reference to note_folders table (optional)',
  
  -- -------------------------------------------------------------------------
  -- SOURCE TRACKING (AI Tutor Integration)
  -- -------------------------------------------------------------------------
  source_type ENUM('ai_tutor', 'manual', 'imported') DEFAULT 'manual' COMMENT 'How the note was created',
  source_query TEXT COMMENT 'Original question asked to AI Tutor (if source_type = ai_tutor)',
  source_answer TEXT COMMENT 'Original AI Tutor answer (if source_type = ai_tutor)',
  source_visualizations JSON COMMENT 'Array of visualization objects from AI Tutor (diagrams, charts, etc.)',
  
  -- -------------------------------------------------------------------------
  -- USER ACTIONS & FLAGS
  -- -------------------------------------------------------------------------
  is_favorite BOOLEAN DEFAULT FALSE COMMENT 'User marked as favorite (star)',
  is_archived BOOLEAN DEFAULT FALSE COMMENT 'User archived this note',
  is_pinned BOOLEAN DEFAULT FALSE COMMENT 'User pinned to top of list',
  
  -- -------------------------------------------------------------------------
  -- TIMESTAMPS (Audit Trail)
  -- -------------------------------------------------------------------------
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the note was created',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification time',
  last_accessed_at TIMESTAMP NULL COMMENT 'Last time the note was viewed',
  
  -- -------------------------------------------------------------------------
  -- INDEXES FOR PERFORMANCE
  -- -------------------------------------------------------------------------
  INDEX idx_clerk_id (clerk_id) COMMENT 'Fast lookup by user',
  INDEX idx_subject (subject) COMMENT 'Filter by subject',
  INDEX idx_created_at (created_at) COMMENT 'Sort by creation date',
  INDEX idx_updated_at (updated_at) COMMENT 'Sort by update date',
  INDEX idx_is_favorite (is_favorite) COMMENT 'Filter favorites',
  INDEX idx_is_archived (is_archived) COMMENT 'Filter archived notes',
  INDEX idx_is_pinned (is_pinned) COMMENT 'Filter pinned notes',
  INDEX idx_source_type (source_type) COMMENT 'Filter by source type',
  INDEX idx_composite_user_archived (clerk_id, is_archived) COMMENT 'Composite index for common query pattern'
  
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci 
  COMMENT='Stores user notes from AI Tutor and manual creation';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Check if table was created successfully
SELECT 
  TABLE_NAME,
  ENGINE,
  TABLE_ROWS,
  CREATE_TIME,
  TABLE_COLLATION,
  TABLE_COMMENT
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'virat_gyankosh' 
  AND TABLE_NAME = 'user_notes';

-- Show table structure
DESCRIBE user_notes;

-- Show indexes
SHOW INDEX FROM user_notes;

-- ============================================================================
-- SAMPLE DATA (COMMENTED OUT - Uncomment to insert test data)
-- ============================================================================
/*
-- Sample note created from AI Tutor
INSERT INTO user_notes (
  id,
  clerk_id,
  title,
  content,
  subject,
  chapter,
  board,
  class_level,
  orientation,
  tags,
  source_type,
  source_query,
  source_answer,
  is_favorite,
  is_archived,
  is_pinned
) VALUES (
  UUID(),
  'user_2example123456789',
  'Photosynthesis Process',
  '# Photosynthesis\n\nPhotosynthesis is the process by which plants convert light energy into chemical energy.\n\n## Key Points:\n- Occurs in chloroplasts\n- Requires sunlight, water, and CO2\n- Produces glucose and oxygen\n\n**Equation:** 6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂',
  'Biology',
  'Life Processes',
  'CBSE',
  '10',
  'portrait',
  JSON_ARRAY('photosynthesis', 'biology', 'class-10', 'important'),
  'ai_tutor',
  'Explain the process of photosynthesis in detail',
  'Photosynthesis is the process by which plants convert light energy into chemical energy...',
  TRUE,
  FALSE,
  TRUE
);

-- Sample manually created note
INSERT INTO user_notes (
  id,
  clerk_id,
  title,
  content,
  subject,
  tags,
  source_type,
  is_favorite
) VALUES (
  UUID(),
  'user_2example123456789',
  'Important Formulas - Quadratic Equations',
  '# Quadratic Equation Formulas\n\n1. Standard Form: ax² + bx + c = 0\n2. Quadratic Formula: x = (-b ± √(b²-4ac)) / 2a\n3. Discriminant: D = b² - 4ac',
  'Mathematics',
  JSON_ARRAY('formulas', 'algebra', 'quadratic', 'revision'),
  'manual',
  TRUE
);
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
SELECT '✅ Migration completed successfully! user_notes table created.' AS status;

