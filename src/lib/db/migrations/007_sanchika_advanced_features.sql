-- ============================================
-- Sanchika Advanced Features Migration
-- Created: 2025-11-20
-- Purpose: Add tables for smart detections, voice notes, PDF annotations, and drawings
-- ============================================

-- Drop existing tables if they exist (to avoid foreign key conflicts)
DROP TABLE IF EXISTS note_flashcards;
DROP TABLE IF EXISTS pdf_annotations;
DROP TABLE IF EXISTS note_pdf_attachments;
DROP TABLE IF EXISTS note_drawings;
DROP TABLE IF EXISTS note_voice_recordings;
DROP TABLE IF EXISTS note_smart_detections;

-- ============================================
-- 1. Smart Detections Table
-- ============================================
CREATE TABLE note_smart_detections (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  note_id VARCHAR(36) NOT NULL,
  detection_type ENUM('date', 'formula', 'chemical', 'definition', 'event') NOT NULL,
  detected_text VARCHAR(500) NOT NULL,
  parsed_data JSON,
  position INT NOT NULL,
  context_text VARCHAR(200),
  suggestions JSON,
  is_applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_note_detections (note_id),
  INDEX idx_detection_type (detection_type),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_smart_detections_note FOREIGN KEY (note_id) REFERENCES user_notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- 2. Voice Recordings Table
-- ============================================
CREATE TABLE note_voice_recordings (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  note_id VARCHAR(36) NOT NULL,
  audio_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  duration_seconds INT,
  file_size_bytes BIGINT,
  time_markers JSON COMMENT 'Array of {time: number, label: string, description: string}',
  transcript TEXT NULL COMMENT 'AI-generated transcript from Whisper API',
  transcript_language VARCHAR(10) DEFAULT 'en',
  is_transcribed BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_note_voice (note_id),
  INDEX idx_recorded_at (recorded_at),
  FULLTEXT INDEX idx_transcript (transcript),
  CONSTRAINT fk_voice_recordings_note FOREIGN KEY (note_id) REFERENCES user_notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- 3. PDF Attachments Table
-- ============================================
CREATE TABLE note_pdf_attachments (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  note_id VARCHAR(36) NOT NULL,
  pdf_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT,
  page_count INT,
  thumbnail_url VARCHAR(500),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_note_pdf (note_id),
  INDEX idx_uploaded_at (uploaded_at),
  CONSTRAINT fk_pdf_attachments_note FOREIGN KEY (note_id) REFERENCES user_notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- 4. PDF Annotations Table
-- ============================================
CREATE TABLE pdf_annotations (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  pdf_attachment_id VARCHAR(36) NOT NULL,
  page_number INT NOT NULL,
  annotation_type ENUM('highlight', 'underline', 'text', 'drawing', 'strikethrough', 'note') NOT NULL,
  annotation_data JSON NOT NULL COMMENT 'Stores coordinates, text, color, etc.',
  color VARCHAR(20) DEFAULT '#FFFF00',
  text_content TEXT NULL COMMENT 'For text annotations',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_pdf_annotations (pdf_attachment_id),
  INDEX idx_page_number (page_number),
  INDEX idx_annotation_type (annotation_type),
  CONSTRAINT fk_pdf_annotations_attachment FOREIGN KEY (pdf_attachment_id) REFERENCES note_pdf_attachments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- 5. Drawings Table
-- ============================================
CREATE TABLE note_drawings (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  note_id VARCHAR(36) NOT NULL,
  drawing_data LONGTEXT NOT NULL COMMENT 'JSON or SVG data for the drawing',
  drawing_format ENUM('json', 'svg', 'canvas') DEFAULT 'json',
  thumbnail_url VARCHAR(500),
  ocr_text TEXT NULL COMMENT 'Extracted text from handwriting OCR',
  is_ocr_processed BOOLEAN DEFAULT FALSE,
  width INT,
  height INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_note_drawings (note_id),
  INDEX idx_created_at (created_at),
  FULLTEXT INDEX idx_ocr_text (ocr_text),
  CONSTRAINT fk_drawings_note FOREIGN KEY (note_id) REFERENCES user_notes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- 6. Note Flashcards Table (for auto-generation)
-- ============================================
CREATE TABLE note_flashcards (
  id VARCHAR(36) NOT NULL DEFAULT (UUID()),
  note_id VARCHAR(36) NOT NULL,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  tags JSON,
  source_detection_id VARCHAR(36) NULL COMMENT 'Link to smart detection if auto-generated',
  is_auto_generated BOOLEAN DEFAULT FALSE,
  review_count INT DEFAULT 0,
  last_reviewed_at TIMESTAMP NULL,
  next_review_at TIMESTAMP NULL,
  ease_factor DECIMAL(3,2) DEFAULT 2.50 COMMENT 'SM-2 algorithm ease factor',
  interval_days INT DEFAULT 1 COMMENT 'SM-2 algorithm interval',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_note_flashcards (note_id),
  INDEX idx_next_review (next_review_at),
  INDEX idx_difficulty (difficulty),
  CONSTRAINT fk_flashcards_note FOREIGN KEY (note_id) REFERENCES user_notes(id) ON DELETE CASCADE,
  CONSTRAINT fk_flashcards_detection FOREIGN KEY (source_detection_id) REFERENCES note_smart_detections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- 7. Add columns to user_notes for new features (if not exists)
-- ============================================

-- Check and add has_smart_detections column
SET @dbname = DATABASE();
SET @tablename = 'user_notes';
SET @columnname = 'has_smart_detections';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' BOOLEAN DEFAULT FALSE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add ai_processed_at column
SET @columnname = 'ai_processed_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TIMESTAMP NULL COMMENT \'Last time AI features were run on this note\'')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 8. Create indexes for performance (if not exists)
-- ============================================

-- Index for ai_processed_at
SET @indexname = 'idx_user_notes_ai_processed';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, '(ai_processed_at)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Index for has_features
SET @indexname = 'idx_user_notes_has_features';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON ', @tablename, '(has_voice_notes, has_pdf_attachments, has_drawings)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- ============================================
-- Migration Complete
-- ============================================

