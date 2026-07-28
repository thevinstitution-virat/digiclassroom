-- ============================================================================
-- SANCHIKA (संचिका) NOTES SYSTEM - ACTIVITY LOG MIGRATION (OPTIONAL)
-- ============================================================================
-- Purpose: Create the note_activity_log table for audit trail
-- Database: virat_gyankosh
-- Created: 2025-11-19
-- Status: OPTIONAL - Future Enhancement
-- Dependencies: Requires user_notes table to exist
-- 
-- DESCRIPTION:
-- This migration creates the note_activity_log table to track all actions
-- performed on notes. Features include:
--   - Complete audit trail of note actions
--   - Track who did what and when
--   - Store additional details in JSON format
--   - Support for analytics and user behavior insights
--
-- TRACKED ACTIONS:
--   - created: Note was created
--   - updated: Note content/metadata was modified
--   - deleted: Note was deleted
--   - viewed: Note was opened/viewed
--   - shared: Note was shared with others
--   - favorited: Note was marked as favorite
--   - archived: Note was archived
--   - pinned: Note was pinned to top
--
-- NOTE: This table is OPTIONAL. It's useful for:
--   - Analytics (most viewed notes, user engagement)
--   - Audit compliance (who changed what and when)
--   - Undo functionality (restore previous versions)
--
-- HOW TO RUN THIS MIGRATION:
-- docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_note_activity_log_table.sql
--
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;
USE virat_gyankosh;

-- ============================================================================
-- DROP EXISTING TABLE (Idempotent)
-- ============================================================================
DROP TABLE IF EXISTS note_activity_log;

-- ============================================================================
-- CREATE note_activity_log TABLE
-- ============================================================================
CREATE TABLE note_activity_log (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY
  -- -------------------------------------------------------------------------
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Auto-incrementing log entry ID',
  
  -- -------------------------------------------------------------------------
  -- REFERENCES
  -- -------------------------------------------------------------------------
  note_id VARCHAR(36) NOT NULL COMMENT 'Reference to user_notes.id',
  clerk_id VARCHAR(255) NOT NULL COMMENT 'User who performed the action',
  
  -- -------------------------------------------------------------------------
  -- ACTION DETAILS
  -- -------------------------------------------------------------------------
  action ENUM(
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
  
  details JSON COMMENT 'Additional details about the action (e.g., what fields changed, old/new values)',
  
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
  -- INDEXES FOR PERFORMANCE
  -- -------------------------------------------------------------------------
  INDEX idx_note_id (note_id) COMMENT 'Find all actions for a specific note',
  INDEX idx_clerk_id (clerk_id) COMMENT 'Find all actions by a specific user',
  INDEX idx_action (action) COMMENT 'Filter by action type',
  INDEX idx_created_at (created_at) COMMENT 'Sort by time',
  INDEX idx_composite_note_action (note_id, action) COMMENT 'Common query pattern',
  INDEX idx_composite_user_time (clerk_id, created_at) COMMENT 'User activity timeline',
  
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
  COMMENT='Audit trail for all note-related actions';

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
  AND TABLE_NAME = 'note_activity_log';

DESCRIBE note_activity_log;
SHOW INDEX FROM note_activity_log;

-- ============================================================================
-- SAMPLE DATA (COMMENTED OUT)
-- ============================================================================
/*
-- Sample activity log entries
INSERT INTO note_activity_log (note_id, clerk_id, action, details) VALUES
  (
    'note-uuid-123',
    'user_2example123456789',
    'created',
    JSON_OBJECT(
      'source_type', 'ai_tutor',
      'subject', 'Mathematics',
      'title', 'Quadratic Equations'
    )
  ),
  (
    'note-uuid-123',
    'user_2example123456789',
    'viewed',
    JSON_OBJECT('duration_seconds', 45)
  ),
  (
    'note-uuid-123',
    'user_2example123456789',
    'updated',
    JSON_OBJECT(
      'fields_changed', JSON_ARRAY('title', 'tags'),
      'old_title', 'Quadratic Equations',
      'new_title', 'Quadratic Equations - Complete Guide'
    )
  ),
  (
    'note-uuid-123',
    'user_2example123456789',
    'pinned',
    JSON_OBJECT('reason', 'exam_preparation')
  );
*/

-- ============================================================================
-- USEFUL ANALYTICS QUERIES (COMMENTED OUT)
-- ============================================================================
/*
-- Most viewed notes
SELECT 
  n.title,
  COUNT(*) as view_count
FROM note_activity_log l
JOIN user_notes n ON l.note_id = n.id
WHERE l.action = 'viewed'
  AND l.clerk_id = 'user_2example123456789'
GROUP BY n.id, n.title
ORDER BY view_count DESC
LIMIT 10;

-- User activity timeline
SELECT 
  DATE(created_at) as date,
  action,
  COUNT(*) as count
FROM note_activity_log
WHERE clerk_id = 'user_2example123456789'
GROUP BY DATE(created_at), action
ORDER BY date DESC;

-- Notes created per day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as notes_created
FROM note_activity_log
WHERE action = 'created'
  AND clerk_id = 'user_2example123456789'
GROUP BY DATE(created_at)
ORDER BY date DESC;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
SELECT '✅ Migration completed successfully! note_activity_log table created.' AS status;

