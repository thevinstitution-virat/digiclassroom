-- Pre-Generated Answers Table
-- Stores pre-computed answers for frequently asked questions
-- Enables instant responses and reduces API costs

CREATE TABLE IF NOT EXISTS pre_generated_answers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Question identification
    question_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA256 hash of normalized question + grade + subject + board
    question_text TEXT NOT NULL,
    
    -- Answer content
    answer TEXT NOT NULL, -- Markdown formatted answer
    key_terms JSON NULL, -- Array of key terms extracted from answer
    
    -- Classification
    subject VARCHAR(100) NOT NULL,
    class_level VARCHAR(20) NOT NULL,
    board VARCHAR(20) NOT NULL DEFAULT 'CBSE',
    difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    
    -- Sources and metadata
    sources JSON NULL, -- Array of source citations (if applicable)
    metadata JSON NULL, -- Additional metadata (tokens_used, generation_method, etc.)
    
    -- Usage tracking
    hit_count INT DEFAULT 0, -- Number of times this answer was served
    last_served_at TIMESTAMP NULL, -- Last time this answer was used
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for fast lookups
    INDEX idx_question_hash (question_hash),
    INDEX idx_subject_class (subject, class_level),
    INDEX idx_board (board),
    INDEX idx_hit_count (hit_count DESC),
    INDEX idx_last_served (last_served_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to table
ALTER TABLE pre_generated_answers COMMENT = 'Pre-generated answers for frequently asked questions to reduce API costs and improve response times';

