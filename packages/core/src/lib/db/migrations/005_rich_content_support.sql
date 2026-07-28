-- ============================================================================
-- Migration 005: Rich Content Support
-- ============================================================================
-- Purpose: Add support for rich text editing with markdown/HTML content
-- Created: 2025-01-19
-- Phase: Sanchika Enhancement - Week 1-2

-- ============================================================================
-- STEP 1: ADD CONTENT FORMAT COLUMN
-- ============================================================================

-- Add content_format column to track the format of note content
ALTER TABLE user_notes 
ADD COLUMN content_format ENUM('plain', 'markdown', 'html') DEFAULT 'markdown' 
AFTER content;

-- Add index for better query performance
CREATE INDEX idx_content_format ON user_notes(content_format);

-- ============================================================================
-- STEP 2: ADD RICH CONTENT FLAGS
-- ============================================================================

-- Add flags to quickly identify notes with rich content
ALTER TABLE user_notes
ADD COLUMN has_drawings BOOLEAN DEFAULT FALSE AFTER content_format,
ADD COLUMN has_voice_notes BOOLEAN DEFAULT FALSE AFTER has_drawings,
ADD COLUMN has_pdf_attachments BOOLEAN DEFAULT FALSE AFTER has_voice_notes;

-- Add indexes for filtering
CREATE INDEX idx_has_drawings ON user_notes(has_drawings);
CREATE INDEX idx_has_voice_notes ON user_notes(has_voice_notes);
CREATE INDEX idx_has_pdf_attachments ON user_notes(has_pdf_attachments);

-- ============================================================================
-- STEP 3: UPDATE EXISTING NOTES
-- ============================================================================

-- Set existing notes to 'plain' format (backward compatibility)
UPDATE user_notes 
SET content_format = 'plain' 
WHERE content_format IS NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT '✅ Migration 005: Rich content support columns added successfully' AS status;

-- Show updated schema
SELECT 
  COLUMN_NAME,
  COLUMN_TYPE,
  COLUMN_DEFAULT,
  IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'virat_gyankosh'
  AND TABLE_NAME = 'user_notes'
  AND COLUMN_NAME IN ('content_format', 'has_drawings', 'has_voice_notes', 'has_pdf_attachments')
ORDER BY ORDINAL_POSITION;

