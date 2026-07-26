-- ============================================================================
-- FIX: note_activity_log ID Column Type Mismatch
-- ============================================================================
-- Purpose: Fix the id column in note_activity_log to support UUID values
-- Issue: The table was created with BIGINT AUTO_INCREMENT but code uses UUID
-- Solution: Alter the column to VARCHAR(36) to store UUID strings
-- Created: 2025-11-21
-- ============================================================================

-- Step 1: Check if table exists and current schema
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  COLUMN_TYPE, 
  COLUMN_KEY, 
  EXTRA
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'virat_gyankosh' 
  AND TABLE_NAME = 'note_activity_log'
  AND COLUMN_NAME = 'id';

-- Step 2: Drop the table if it exists (safe because it's optional/audit table)
-- WARNING: This will delete all activity log data!
-- If you need to preserve data, export it first
DROP TABLE IF EXISTS note_activity_log;

-- Step 3: Recreate table with correct schema
CREATE TABLE note_activity_log (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY (UUID format)
  -- -------------------------------------------------------------------------
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for activity log entry',
  
  -- -------------------------------------------------------------------------
  -- REFERENCES
  -- -------------------------------------------------------------------------
  note_id VARCHAR(36) NOT NULL COMMENT 'Reference to user_notes.id',
  user_id VARCHAR(255) NOT NULL COMMENT 'User who performed the action (clerk_id)',
  
  -- -------------------------------------------------------------------------
  -- ACTION DETAILS
  -- -------------------------------------------------------------------------
  activity_type ENUM(
    'created',
    'updated',
    'deleted',
    'viewed',
    'shared',
    'favorited',
    'unfavorited',
    'archived',
    'unarchived',
    'pinned',
    'unpinned',
    'tag_added',
    'tag_removed',
    'moved_to_folder'
  ) NOT NULL COMMENT 'Type of action performed',
  
  changes_summary TEXT COMMENT 'Brief description of changes',
  details JSON COMMENT 'Additional details about the action (e.g., what fields changed)',
  
  -- -------------------------------------------------------------------------
  -- METADATA
  -- -------------------------------------------------------------------------
  ip_address VARCHAR(45) COMMENT 'IP address of the user (IPv4 or IPv6)',
  user_agent TEXT COMMENT 'Browser/device user agent string',
  
  -- -------------------------------------------------------------------------
  -- TIMESTAMP
  -- -------------------------------------------------------------------------
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the action occurred',
  
  -- -------------------------------------------------------------------------
  -- INDEXES
  -- -------------------------------------------------------------------------
  INDEX idx_note_activity (note_id, created_at DESC),
  INDEX idx_user_activity (user_id, created_at DESC),
  INDEX idx_activity_type (activity_type),
  
  -- -------------------------------------------------------------------------
  -- FOREIGN KEY CONSTRAINTS
  -- -------------------------------------------------------------------------
  FOREIGN KEY (note_id) 
    REFERENCES user_notes(id) 
    ON DELETE CASCADE 
    COMMENT 'Cascade delete: deleting a note deletes its activity log'
  
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci 
  COMMENT='Audit trail for all note-related actions (UUID-based)';

-- Step 4: Verify the fix
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  COLUMN_TYPE, 
  COLUMN_KEY, 
  EXTRA
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'virat_gyankosh' 
  AND TABLE_NAME = 'note_activity_log'
ORDER BY ORDINAL_POSITION;

-- ============================================================================
-- HOW TO RUN THIS MIGRATION
-- ============================================================================
-- Option 1: Using MySQL command line
-- mysql -u root -p virat_gyankosh < src/lib/db/migrations/fix_note_activity_log_id_column.sql
--
-- Option 2: Using Docker (if database is in container)
-- docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/fix_note_activity_log_id_column.sql
--
-- Option 3: Copy and paste into MySQL Workbench or phpMyAdmin
-- ============================================================================

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check table structure
DESCRIBE note_activity_log;

-- Check indexes
SHOW INDEX FROM note_activity_log;

-- Test insert with UUID
-- INSERT INTO note_activity_log (id, note_id, user_id, activity_type) 
-- VALUES ('550e8400-e29b-41d4-a716-446655440000', 'test-note-id', 'test-user', 'created');
-- ============================================================================

