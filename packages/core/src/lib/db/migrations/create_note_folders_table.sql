-- ============================================================================
-- SANCHIKA (संचिका) NOTES SYSTEM - FOLDERS MIGRATION (OPTIONAL)
-- ============================================================================
-- Purpose: Create the note_folders table for organizing notes into folders
-- Database: virat_gyankosh
-- Created: 2025-11-19
-- Status: OPTIONAL - Future Enhancement
-- Dependencies: None (can be created independently)
-- 
-- DESCRIPTION:
-- This migration creates the note_folders table to enable hierarchical
-- organization of notes. Features include:
--   - Nested folder structure (folders within folders)
--   - Custom colors and icons for visual organization
--   - Per-user folder ownership
--   - Cascade delete (deleting a folder deletes subfolders)
--
-- NOTE: This table is OPTIONAL. The user_notes table works without it.
-- The folder_id field in user_notes will be NULL until folders are created.
--
-- HOW TO RUN THIS MIGRATION:
-- docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_note_folders_table.sql
--
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;
USE virat_gyankosh;

-- ============================================================================
-- DROP EXISTING TABLE (Idempotent)
-- ============================================================================
DROP TABLE IF EXISTS note_folders;

-- ============================================================================
-- CREATE note_folders TABLE
-- ============================================================================
CREATE TABLE note_folders (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY & USER IDENTIFICATION
  -- -------------------------------------------------------------------------
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for the folder',
  clerk_id VARCHAR(255) NOT NULL COMMENT 'Clerk user ID (owner of the folder)',
  
  -- -------------------------------------------------------------------------
  -- FOLDER PROPERTIES
  -- -------------------------------------------------------------------------
  name VARCHAR(200) NOT NULL COMMENT 'Folder name',
  description TEXT COMMENT 'Optional folder description',
  parent_folder_id VARCHAR(36) COMMENT 'Parent folder ID for nested folders (NULL = root folder)',
  
  -- -------------------------------------------------------------------------
  -- VISUAL CUSTOMIZATION
  -- -------------------------------------------------------------------------
  color VARCHAR(20) COMMENT 'Folder color (hex code or color name, e.g., #FF5733, blue)',
  icon VARCHAR(50) COMMENT 'Icon name from lucide-react (e.g., Folder, BookOpen, Star)',
  
  -- -------------------------------------------------------------------------
  -- METADATA
  -- -------------------------------------------------------------------------
  sort_order INT DEFAULT 0 COMMENT 'Custom sort order for displaying folders',
  
  -- -------------------------------------------------------------------------
  -- TIMESTAMPS
  -- -------------------------------------------------------------------------
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the folder was created',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification time',
  
  -- -------------------------------------------------------------------------
  -- INDEXES
  -- -------------------------------------------------------------------------
  INDEX idx_clerk_id (clerk_id) COMMENT 'Fast lookup by user',
  INDEX idx_parent_folder (parent_folder_id) COMMENT 'Find subfolders',
  INDEX idx_composite_user_parent (clerk_id, parent_folder_id) COMMENT 'Common query pattern',
  
  -- -------------------------------------------------------------------------
  -- FOREIGN KEY CONSTRAINTS
  -- -------------------------------------------------------------------------
  FOREIGN KEY (parent_folder_id) 
    REFERENCES note_folders(id) 
    ON DELETE CASCADE 
    COMMENT 'Cascade delete: deleting a folder deletes all subfolders'
  
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci 
  COMMENT='Hierarchical folder structure for organizing notes';

-- ============================================================================
-- ADD FOREIGN KEY TO user_notes (if not already added)
-- ============================================================================
-- This adds the foreign key constraint from user_notes.folder_id to note_folders.id
-- Note: This will fail if user_notes doesn't exist yet. Run create_user_notes_table.sql first.

ALTER TABLE user_notes 
  ADD CONSTRAINT fk_user_notes_folder 
  FOREIGN KEY (folder_id) 
  REFERENCES note_folders(id) 
  ON DELETE SET NULL
  COMMENT 'Link notes to folders (NULL if folder is deleted)';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
SELECT 
  TABLE_NAME,
  ENGINE,
  TABLE_ROWS,
  CREATE_TIME,
  TABLE_COLLATION,
  TABLE_COMMENT
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'virat_gyankosh' 
  AND TABLE_NAME = 'note_folders';

DESCRIBE note_folders;
SHOW INDEX FROM note_folders;

-- ============================================================================
-- SAMPLE DATA (COMMENTED OUT)
-- ============================================================================
/*
-- Create sample folder structure
INSERT INTO note_folders (id, clerk_id, name, description, color, icon, sort_order) VALUES
  (UUID(), 'user_2example123456789', 'Mathematics', 'All math notes and formulas', '#3B82F6', 'Calculator', 1),
  (UUID(), 'user_2example123456789', 'Science', 'Physics, Chemistry, Biology notes', '#10B981', 'Microscope', 2),
  (UUID(), 'user_2example123456789', 'Important', 'High priority notes for exam prep', '#EF4444', 'Star', 3);

-- Create nested folder (subfolder)
SET @parent_id = (SELECT id FROM note_folders WHERE name = 'Science' LIMIT 1);
INSERT INTO note_folders (id, clerk_id, name, parent_folder_id, color, icon) VALUES
  (UUID(), 'user_2example123456789', 'Physics', @parent_id, '#8B5CF6', 'Atom'),
  (UUID(), 'user_2example123456789', 'Chemistry', @parent_id, '#F59E0B', 'FlaskConical'),
  (UUID(), 'user_2example123456789', 'Biology', @parent_id, '#22C55E', 'Leaf');
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
SELECT '✅ Migration completed successfully! note_folders table created.' AS status;

