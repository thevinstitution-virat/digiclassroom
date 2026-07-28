-- ============================================================================
-- SANCHIKA PERFORMANCE OPTIMIZATION & PHASE 1 ENHANCEMENTS
-- ============================================================================
-- Migration: 004_sanchika_performance_optimization
-- Created: 2025-11-19
-- Purpose: Add performance indexes and tables for Phase 1 features
-- Dependencies: Requires user_notes table to exist
--
-- WHAT THIS MIGRATION DOES:
-- 1. Adds critical performance indexes to user_notes
-- 2. Creates note_flashcards table for auto-generated flashcards
-- 3. Creates note_embeddings table for semantic search
-- 4. Creates study_sessions table for session tracking
-- 5. Creates note_insights table for AI-generated content
-- 6. Optimizes existing indexes for mobile and search performance
--
-- HOW TO RUN:
-- docker exec -i mysql_container mysql -uroot -p virat_gyankosh < src/lib/db/migrations/004_sanchika_performance_optimization.sql
-- ============================================================================

SET NAMES utf8mb4;
SET CHARACTER_SET_CLIENT = utf8mb4;
USE virat_gyankosh;

-- ============================================================================
-- STEP 1: ADD CRITICAL PERFORMANCE INDEXES TO user_notes (IF NOT EXISTS)
-- ============================================================================

-- Check and add indexes only if they don't exist
-- Full-text search index for content (enables fast text search)
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'user_notes'
               AND index_name = 'idx_content_fulltext');
SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE user_notes ADD FULLTEXT INDEX idx_content_fulltext (content, title)',
  'SELECT "Index idx_content_fulltext already exists" AS status');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Composite index for mobile queries
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'user_notes'
               AND index_name = 'idx_mobile_query');
SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE user_notes ADD INDEX idx_mobile_query (clerk_id, is_archived, created_at DESC)',
  'SELECT "Index idx_mobile_query already exists" AS status');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for subject-based filtering
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'user_notes'
               AND index_name = 'idx_subject_filter');
SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE user_notes ADD INDEX idx_subject_filter (clerk_id, subject, created_at DESC)',
  'SELECT "Index idx_subject_filter already exists" AS status');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Multi-valued index for tags
SET @exist := (SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = 'user_notes'
               AND index_name = 'idx_tags_multivalue');
SET @sqlstmt := IF(@exist = 0,
  'ALTER TABLE user_notes ADD INDEX idx_tags_multivalue ((CAST(tags AS CHAR(255) ARRAY)))',
  'SELECT "Index idx_tags_multivalue already exists" AS status');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✅ Step 1: Performance indexes verified/added to user_notes' AS status;

-- ============================================================================
-- STEP 2: CREATE note_flashcards TABLE
-- ============================================================================
-- Purpose: Store auto-generated flashcards from notes
-- Integration: Links to existing spaced_repetition_cards table

CREATE TABLE IF NOT EXISTS note_flashcards (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY
  -- -------------------------------------------------------------------------
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'Flashcard UUID',
  
  -- -------------------------------------------------------------------------
  -- REFERENCES
  -- -------------------------------------------------------------------------
  note_id VARCHAR(36) NOT NULL COMMENT 'Reference to user_notes.id',
  clerk_id VARCHAR(255) NOT NULL COMMENT 'Owner of the flashcard',
  
  -- -------------------------------------------------------------------------
  -- FLASHCARD CONTENT
  -- -------------------------------------------------------------------------
  question TEXT NOT NULL COMMENT 'Question/prompt on the front of card',
  answer TEXT NOT NULL COMMENT 'Answer/explanation on the back of card',
  
  -- -------------------------------------------------------------------------
  -- FLASHCARD METADATA
  -- -------------------------------------------------------------------------
  card_type ENUM('concept', 'definition', 'formula', 'example', 'mcq') NOT NULL DEFAULT 'concept'
    COMMENT 'Type of flashcard for better organization',
  difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium'
    COMMENT 'Estimated difficulty level',
  
  -- -------------------------------------------------------------------------
  -- SPACED REPETITION INTEGRATION
  -- -------------------------------------------------------------------------
  spaced_repetition_card_id VARCHAR(36) COMMENT 'Links to spaced_repetition_cards table',
  
  -- -------------------------------------------------------------------------
  -- AI GENERATION TRACKING
  -- -------------------------------------------------------------------------
  auto_generated BOOLEAN DEFAULT TRUE COMMENT 'TRUE if AI-generated, FALSE if manually created',
  generation_confidence DECIMAL(3,2) COMMENT 'AI confidence score (0.00-1.00)',
  
  -- -------------------------------------------------------------------------
  -- USER ACTIONS
  -- -------------------------------------------------------------------------
  is_active BOOLEAN DEFAULT TRUE COMMENT 'User can deactivate low-quality cards',
  user_rating TINYINT COMMENT 'User rating 1-5 stars (quality feedback)',
  
  -- -------------------------------------------------------------------------
  -- TIMESTAMPS
  -- -------------------------------------------------------------------------
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- -------------------------------------------------------------------------
  -- INDEXES
  -- -------------------------------------------------------------------------
  INDEX idx_note_flashcards (note_id, is_active) COMMENT 'Get all active flashcards for a note',
  INDEX idx_user_flashcards (clerk_id, created_at DESC) COMMENT 'User flashcard list',
  INDEX idx_sr_integration (spaced_repetition_card_id) COMMENT 'Link to SR system',
  INDEX idx_card_type (card_type, difficulty_level) COMMENT 'Filter by type and difficulty'

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Auto-generated and manual flashcards from notes';

SELECT '✅ Step 2: note_flashcards table created' AS status;

-- ============================================================================
-- STEP 3: CREATE study_sessions TABLE
-- ============================================================================
-- Purpose: Track study sessions for analytics and gamification

CREATE TABLE IF NOT EXISTS study_sessions (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY
  -- -------------------------------------------------------------------------
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'Session UUID',
  
  -- -------------------------------------------------------------------------
  -- USER REFERENCE
  -- -------------------------------------------------------------------------
  clerk_id VARCHAR(255) NOT NULL COMMENT 'User who created the session',
  
  -- -------------------------------------------------------------------------
  -- SESSION CONFIGURATION
  -- -------------------------------------------------------------------------
  session_type ENUM('review', 'exam_prep', 'quick_revision', 'flashcard_review', 'pomodoro') 
    NOT NULL DEFAULT 'review' COMMENT 'Type of study session',
  session_name VARCHAR(255) COMMENT 'Optional user-defined session name',
  
  -- -------------------------------------------------------------------------
  -- SESSION CONTENT
  -- -------------------------------------------------------------------------
  note_ids JSON NOT NULL COMMENT 'Array of note IDs included in session',
  flashcard_ids JSON COMMENT 'Array of flashcard IDs reviewed (if applicable)',
  
  -- -------------------------------------------------------------------------
  -- SESSION METRICS
  -- -------------------------------------------------------------------------
  planned_duration_minutes INT COMMENT 'Planned session duration',
  actual_duration_minutes INT COMMENT 'Actual time spent (calculated)',
  notes_reviewed INT DEFAULT 0 COMMENT 'Number of notes reviewed',
  flashcards_reviewed INT DEFAULT 0 COMMENT 'Number of flashcards reviewed',
  
  -- -------------------------------------------------------------------------
  -- PERFORMANCE TRACKING
  -- -------------------------------------------------------------------------
  performance_score DECIMAL(5,2) COMMENT 'Overall session performance (0-100)',
  correct_answers INT DEFAULT 0 COMMENT 'Correct flashcard answers',
  incorrect_answers INT DEFAULT 0 COMMENT 'Incorrect flashcard answers',
  
  -- -------------------------------------------------------------------------
  -- POMODORO TRACKING
  -- -------------------------------------------------------------------------
  pomodoro_cycles_completed INT DEFAULT 0 COMMENT 'Number of 25-min cycles completed',
  breaks_taken INT DEFAULT 0 COMMENT 'Number of breaks taken',
  
  -- -------------------------------------------------------------------------
  -- SESSION STATUS
  -- -------------------------------------------------------------------------
  status ENUM('in_progress', 'completed', 'abandoned') DEFAULT 'in_progress',
  
  -- -------------------------------------------------------------------------
  -- TIMESTAMPS
  -- -------------------------------------------------------------------------
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL COMMENT 'When session was completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- -------------------------------------------------------------------------
  -- INDEXES
  -- -------------------------------------------------------------------------
  INDEX idx_user_sessions (clerk_id, started_at DESC) COMMENT 'User session history',
  INDEX idx_session_status (status, started_at) COMMENT 'Filter by status',
  INDEX idx_session_type (session_type, clerk_id) COMMENT 'Filter by type'
  
) ENGINE=InnoDB 
  DEFAULT CHARSET=utf8mb4 
  COLLATE=utf8mb4_unicode_ci 
  COMMENT='Study session tracking for analytics and gamification';

SELECT '✅ Step 3: study_sessions table created' AS status;

-- ============================================================================
-- STEP 4: CREATE note_embeddings TABLE
-- ============================================================================
-- Purpose: Store embeddings for semantic search (synced with Qdrant)

CREATE TABLE IF NOT EXISTS note_embeddings (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY
  -- -------------------------------------------------------------------------
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'Embedding UUID',
  
  -- -------------------------------------------------------------------------
  -- REFERENCES
  -- -------------------------------------------------------------------------
  note_id VARCHAR(36) NOT NULL UNIQUE COMMENT 'Reference to user_notes.id (one embedding per note)',
  
  -- -------------------------------------------------------------------------
  -- EMBEDDING DATA
  -- -------------------------------------------------------------------------
  embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-large' 
    COMMENT 'OpenAI model used for embedding',
  embedding_dimensions INT NOT NULL DEFAULT 3072 
    COMMENT 'Vector dimensions (3072 for text-embedding-3-large)',
  
  -- Note: We don't store the actual vector here (too large for MySQL)
  -- Vectors are stored in Qdrant. This table tracks sync status.
  
  -- -------------------------------------------------------------------------
  -- QDRANT SYNC STATUS
  -- -------------------------------------------------------------------------
  qdrant_point_id VARCHAR(100) COMMENT 'Point ID in Qdrant collection',
  qdrant_collection VARCHAR(100) DEFAULT 'sanchika_notes' COMMENT 'Qdrant collection name',
  sync_status ENUM('pending', 'synced', 'failed', 'outdated') DEFAULT 'pending'
    COMMENT 'Sync status with Qdrant',
  
  -- -------------------------------------------------------------------------
  -- CONTENT HASH (for change detection)
  -- -------------------------------------------------------------------------
  content_hash VARCHAR(64) COMMENT 'SHA-256 hash of note content (detect changes)',
  
  -- -------------------------------------------------------------------------
  -- TIMESTAMPS
  -- -------------------------------------------------------------------------
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP NULL COMMENT 'Last successful sync to Qdrant',
  failed_at TIMESTAMP NULL COMMENT 'Last failed sync attempt',
  
  -- -------------------------------------------------------------------------
  -- INDEXES
  -- -------------------------------------------------------------------------
  INDEX idx_sync_status (sync_status, created_at) COMMENT 'Find pending/failed syncs',
  INDEX idx_qdrant_point (qdrant_point_id) COMMENT 'Lookup by Qdrant ID'

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Embedding metadata and Qdrant sync tracking';

SELECT '✅ Step 4: note_embeddings table created' AS status;

-- ============================================================================
-- STEP 5: CREATE note_insights TABLE
-- ============================================================================
-- Purpose: Cache AI-generated insights (summary, key points, etc.)

CREATE TABLE IF NOT EXISTS note_insights (
  -- -------------------------------------------------------------------------
  -- PRIMARY KEY
  -- -------------------------------------------------------------------------
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()) COMMENT 'Insight UUID',
  
  -- -------------------------------------------------------------------------
  -- REFERENCES
  -- -------------------------------------------------------------------------
  note_id VARCHAR(36) NOT NULL COMMENT 'Reference to user_notes.id',
  
  -- -------------------------------------------------------------------------
  -- INSIGHT TYPE & CONTENT
  -- -------------------------------------------------------------------------
  insight_type ENUM('summary', 'key_points', 'tags', 'flashcard_suggestions', 'related_topics', 'quiz_questions') 
    NOT NULL COMMENT 'Type of AI-generated insight',
  content TEXT NOT NULL COMMENT 'The actual insight content (JSON or plain text)',
  
  -- -------------------------------------------------------------------------
  -- AI METADATA
  -- -------------------------------------------------------------------------
  model_used VARCHAR(100) COMMENT 'AI model used (e.g., gpt-4o-mini)',
  confidence_score DECIMAL(3,2) COMMENT 'AI confidence (0.00-1.00)',
  tokens_used INT COMMENT 'Tokens consumed for generation',
  
  -- -------------------------------------------------------------------------
  -- CACHE MANAGEMENT
  -- -------------------------------------------------------------------------
  is_valid BOOLEAN DEFAULT TRUE COMMENT 'FALSE if note changed significantly',
  content_hash VARCHAR(64) COMMENT 'Hash of note content when insight was generated',
  
  -- -------------------------------------------------------------------------
  -- TIMESTAMPS
  -- -------------------------------------------------------------------------
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL COMMENT 'Optional expiration for cache invalidation',
  
  -- -------------------------------------------------------------------------
  -- INDEXES
  -- -------------------------------------------------------------------------
  INDEX idx_note_insights (note_id, insight_type, is_valid) COMMENT 'Get valid insights for a note',
  INDEX idx_insight_type (insight_type, generated_at DESC) COMMENT 'Filter by type',
  INDEX idx_cache_expiry (expires_at, is_valid) COMMENT 'Find expired insights'

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Cached AI-generated insights to reduce API costs';

SELECT '✅ Step 5: note_insights table created' AS status;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show all indexes on user_notes
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  COLUMN_NAME,
  INDEX_TYPE,
  INDEX_COMMENT
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'virat_gyankosh' 
  AND TABLE_NAME = 'user_notes'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Show new tables
SELECT 
  TABLE_NAME,
  ENGINE,
  TABLE_ROWS,
  TABLE_COMMENT
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'virat_gyankosh' 
  AND TABLE_NAME IN ('note_flashcards', 'study_sessions', 'note_embeddings', 'note_insights')
ORDER BY TABLE_NAME;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
SELECT '✅✅✅ Migration 004 completed successfully! All performance optimizations applied.' AS status;

