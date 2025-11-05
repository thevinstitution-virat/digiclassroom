-- Migration: Create pre_generated_answers table
-- Purpose: Cache frequently asked questions and their answers
-- Safe: This is an additive migration - no changes to existing tables
-- Rollback: DROP TABLE IF EXISTS pre_generated_answers;

-- Create table if it doesn't exist (safe for re-running)
CREATE TABLE IF NOT EXISTS pre_generated_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Question identification
  question_hash VARCHAR(64) NOT NULL UNIQUE COMMENT 'SHA-256 hash of normalized question',
  question_text TEXT NOT NULL COMMENT 'Original question text',
  answer_text LONGTEXT NOT NULL COMMENT 'Cached answer',
  
  -- Metadata for filtering and analytics
  subject VARCHAR(100) COMMENT 'Subject (e.g., Mathematics, Science)',
  class_level VARCHAR(50) COMMENT 'Class level (e.g., Class 9, Class 10)',
  board VARCHAR(50) COMMENT 'Education board (e.g., cbse, icse)',
  content_type VARCHAR(50) COMMENT 'Type of content (e.g., homework_help, explanation)',
  
  -- Usage tracking
  hit_count INT DEFAULT 0 COMMENT 'Number of times this answer was served',
  last_accessed_at TIMESTAMP NULL COMMENT 'Last time this answer was accessed',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When this answer was first cached',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update time',
  
  -- Indexes for performance
  INDEX idx_hash (question_hash) COMMENT 'Fast lookup by question hash',
  INDEX idx_metadata (subject, class_level, board) COMMENT 'Filter by metadata',
  INDEX idx_hit_count (hit_count DESC) COMMENT 'Find most popular answers',
  INDEX idx_last_accessed (last_accessed_at DESC) COMMENT 'Find recently used answers',
  INDEX idx_created_at (created_at DESC) COMMENT 'Find newest answers'
  
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Cached pre-generated answers for frequently asked questions';

-- Verify table was created
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  CREATE_TIME,
  TABLE_COMMENT
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'pre_generated_answers';

-- Show table structure
DESCRIBE pre_generated_answers;

