-- ============================================================================
-- SANCHIKA (संचिका) NOTES SYSTEM - SHARING MIGRATION (OPTIONAL)
-- ============================================================================
-- Purpose: Create the note_shares table for sharing notes with others
-- Database: virat_gyankosh
-- Created: 2025-11-19
-- Status: OPTIONAL - Future Enhancement
-- Dependencies: Requires user_notes table to exist
-- 
-- DESCRIPTION:
-- This migration creates the note_shares table to enable note sharing
-- functionality. Features include:
--   - Share notes with specific users (by Clerk ID)
--   - Generate public share links
--   - Set view/edit permissions
--   - Expiring share links
--   - Track who shared what with whom
--
-- USE CASES:
--   - Student shares notes with classmates
--   - Teacher shares study materials with students
--   - Collaborative note-taking
--   - Public knowledge sharing
--
-- NOTE: This table is OPTIONAL. Implement when sharing features are needed.
--
-- HOW TO RUN THIS MIGRATION:
-- docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/create_note_shares_table.sql
--
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;
USE virat_gyankosh;

-- ============================================================================
-- DROP EXISTING TABLE (Idempotent)
-- ============================================================================
DROP TABLE IF EXISTS note_shares;

-- ============================================================================
-- CREATE note_shares TABLE
-- ============================================================================
CREATE TABLE note_shares (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY
  -- -------------------------------------------------------------------------
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for the share record',
  
  -- -------------------------------------------------------------------------
  -- REFERENCES
  -- -------------------------------------------------------------------------
  note_id VARCHAR(36) NOT NULL COMMENT 'Reference to user_notes.id (the note being shared)',
  shared_by_clerk_id VARCHAR(255) NOT NULL COMMENT 'User who shared the note (owner)',
  shared_with_clerk_id VARCHAR(255) COMMENT 'Specific user to share with (NULL for public links)',
  
  -- -------------------------------------------------------------------------
  -- SHARE LINK
  -- -------------------------------------------------------------------------
  share_link VARCHAR(500) UNIQUE COMMENT 'Unique shareable URL (e.g., /shared/abc123xyz)',
  share_token VARCHAR(100) UNIQUE COMMENT 'Unique token for accessing the shared note',
  
  -- -------------------------------------------------------------------------
  -- PERMISSIONS
  -- -------------------------------------------------------------------------
  permission ENUM('view', 'edit', 'comment') DEFAULT 'view' COMMENT 'Access level granted',
  
  -- -------------------------------------------------------------------------
  -- EXPIRATION
  -- -------------------------------------------------------------------------
  expires_at TIMESTAMP NULL COMMENT 'When the share link expires (NULL = never expires)',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether the share is currently active',
  
  -- -------------------------------------------------------------------------
  -- USAGE TRACKING
  -- -------------------------------------------------------------------------
  access_count INT DEFAULT 0 COMMENT 'Number of times the shared note was accessed',
  last_accessed_at TIMESTAMP NULL COMMENT 'Last time someone accessed the shared note',
  
  -- -------------------------------------------------------------------------
  -- METADATA
  -- -------------------------------------------------------------------------
  share_message TEXT COMMENT 'Optional message from the sharer',
  
  -- -------------------------------------------------------------------------
  -- TIMESTAMPS
  -- -------------------------------------------------------------------------
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the share was created',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification time',
  
  -- -------------------------------------------------------------------------
  -- INDEXES FOR PERFORMANCE
  -- -------------------------------------------------------------------------
  INDEX idx_note_id (note_id) COMMENT 'Find all shares for a note',
  INDEX idx_shared_by (shared_by_clerk_id) COMMENT 'Find all shares by a user',
  INDEX idx_shared_with (shared_with_clerk_id) COMMENT 'Find all shares to a user',
  INDEX idx_share_token (share_token) COMMENT 'Fast lookup by share token',
  INDEX idx_expires_at (expires_at) COMMENT 'Find expiring shares',
  INDEX idx_is_active (is_active) COMMENT 'Filter active shares',
  INDEX idx_composite_note_active (note_id, is_active) COMMENT 'Common query pattern',
  
  -- -------------------------------------------------------------------------
  -- FOREIGN KEY CONSTRAINTS
  -- -------------------------------------------------------------------------
  FOREIGN KEY (note_id) 
    REFERENCES user_notes(id) 
    ON DELETE CASCADE 
    COMMENT 'Cascade delete: deleting a note deletes all its shares'
  
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci 
  COMMENT='Manages note sharing with users and public links';

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
  AND TABLE_NAME = 'note_shares';

DESCRIBE note_shares;
SHOW INDEX FROM note_shares;

-- ============================================================================
-- SAMPLE DATA (COMMENTED OUT)
-- ============================================================================
/*
-- Share note with specific user (view only)
INSERT INTO note_shares (
  id,
  note_id,
  shared_by_clerk_id,
  shared_with_clerk_id,
  permission,
  share_message
) VALUES (
  UUID(),
  'note-uuid-123',
  'user_2example123456789',
  'user_2friend987654321',
  'view',
  'Check out my notes on Photosynthesis! Hope this helps for the exam.'
);

-- Create public share link (expires in 7 days)
INSERT INTO note_shares (
  id,
  note_id,
  shared_by_clerk_id,
  share_link,
  share_token,
  permission,
  expires_at
) VALUES (
  UUID(),
  'note-uuid-456',
  'user_2example123456789',
  '/shared/abc123xyz',
  'abc123xyz',
  'view',
  DATE_ADD(NOW(), INTERVAL 7 DAY)
);

-- Share with edit permission (never expires)
INSERT INTO note_shares (
  id,
  note_id,
  shared_by_clerk_id,
  shared_with_clerk_id,
  permission
) VALUES (
  UUID(),
  'note-uuid-789',
  'user_2example123456789',
  'user_2collaborator111',
  'edit'
);
*/

-- ============================================================================
-- USEFUL QUERIES (COMMENTED OUT)
-- ============================================================================
/*
-- Find all active shares for a note
SELECT 
  s.*,
  n.title as note_title
FROM note_shares s
JOIN user_notes n ON s.note_id = n.id
WHERE s.note_id = 'note-uuid-123'
  AND s.is_active = TRUE
  AND (s.expires_at IS NULL OR s.expires_at > NOW());

-- Find all notes shared with a user
SELECT 
  n.id,
  n.title,
  n.subject,
  s.permission,
  s.shared_by_clerk_id,
  s.created_at as shared_at
FROM note_shares s
JOIN user_notes n ON s.note_id = n.id
WHERE s.shared_with_clerk_id = 'user_2example123456789'
  AND s.is_active = TRUE
  AND (s.expires_at IS NULL OR s.expires_at > NOW());

-- Find expired shares (for cleanup)
SELECT *
FROM note_shares
WHERE expires_at IS NOT NULL
  AND expires_at < NOW()
  AND is_active = TRUE;

-- Deactivate expired shares
UPDATE note_shares
SET is_active = FALSE
WHERE expires_at IS NOT NULL
  AND expires_at < NOW()
  AND is_active = TRUE;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
SELECT '✅ Migration completed successfully! note_shares table created.' AS status;

