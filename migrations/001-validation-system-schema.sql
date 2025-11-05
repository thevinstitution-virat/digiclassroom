-- ============================================================================
-- DigiClassroom Pro - Validation & Quality Assurance System
-- Database Schema Migration
-- Version: 1.0
-- Created: 2025-10-31
-- ============================================================================

USE virat_gyankosh;

-- ============================================================================
-- Table 1: answer_feedback
-- Purpose: Collect user ratings and feedback on AI-generated answers
-- ============================================================================

CREATE TABLE IF NOT EXISTS answer_feedback (
    -- Primary Key
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Question & Answer Context
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    answer_id VARCHAR(255),
    
    -- Educational Context
    board VARCHAR(50) NOT NULL,
    class_level TINYINT NOT NULL CHECK (class_level >= 1 AND class_level <= 12),
    subject VARCHAR(100) NOT NULL,
    command_word VARCHAR(50),
    marks_allocated INT,
    
    -- User Feedback
    thumbs_rating ENUM('up', 'down'),
    star_rating TINYINT CHECK (star_rating >= 1 AND star_rating <= 5),
    feedback_category ENUM('accuracy', 'completeness', 'clarity', 'formatting', 'citations', 'other'),
    feedback_text TEXT,
    
    -- Quality Metrics (from RAGAS)
    faithfulness_score DECIMAL(3, 2) CHECK (faithfulness_score >= 0 AND faithfulness_score <= 1),
    relevance_score DECIMAL(3, 2) CHECK (relevance_score >= 0 AND relevance_score <= 1),
    context_precision_score DECIMAL(3, 2),
    context_recall_score DECIMAL(3, 2),
    
    -- Performance Metrics
    response_time_ms INT,
    cache_hit BOOLEAN DEFAULT FALSE,
    cache_type ENUM('semantic', 'openai', 'pre-generated', 'none') DEFAULT 'none',
    
    -- Routing Information
    route_type VARCHAR(50),
    complexity VARCHAR(50),
    intent_type VARCHAR(50),
    
    -- User Information
    session_id VARCHAR(255),
    user_id VARCHAR(255) NOT NULL,
    clerk_id VARCHAR(255) NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for Performance
    INDEX idx_board_class_subject (board, class_level, subject),
    INDEX idx_star_rating (star_rating),
    INDEX idx_faithfulness (faithfulness_score),
    INDEX idx_created_at (created_at),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 2: teacher_validation
-- Purpose: Expert validation of AI-generated answers by teachers
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_validation (
    -- Primary Key
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Link to Feedback
    feedback_id VARCHAR(36),
    
    -- Question & Answer
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    
    -- Educational Context
    board VARCHAR(50) NOT NULL,
    class_level TINYINT NOT NULL CHECK (class_level >= 1 AND class_level <= 12),
    subject VARCHAR(100) NOT NULL,
    
    -- Multi-Dimensional Scoring (0-100)
    accuracy_score TINYINT CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
    completeness_score TINYINT CHECK (completeness_score >= 0 AND completeness_score <= 100),
    cbse_alignment_score TINYINT CHECK (cbse_alignment_score >= 0 AND cbse_alignment_score <= 100),
    clarity_score TINYINT CHECK (clarity_score >= 0 AND clarity_score <= 100),
    citation_quality_score TINYINT CHECK (citation_quality_score >= 0 AND citation_quality_score <= 100),
    overall_score TINYINT CHECK (overall_score >= 0 AND overall_score <= 100),
    
    -- Detailed Feedback
    strengths TEXT,
    weaknesses TEXT,
    suggestions_for_improvement TEXT,
    missing_key_points TEXT,
    
    -- Validation Status
    validation_status ENUM('approved', 'needs_improvement', 'rejected') NOT NULL,
    approved_for_pre_generation BOOLEAN DEFAULT FALSE,
    
    -- Teacher Information
    teacher_id VARCHAR(255) NOT NULL,
    teacher_clerk_id VARCHAR(255) NOT NULL,
    teacher_name VARCHAR(255) NOT NULL,
    teacher_specialization VARCHAR(100),
    
    -- Validation Metadata
    validation_time_seconds INT,
    priority_score INT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (feedback_id) REFERENCES answer_feedback(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_validation_status (validation_status),
    INDEX idx_board_class_subject (board, class_level, subject),
    INDEX idx_teacher_id (teacher_id),
    INDEX idx_overall_score (overall_score),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 3: ground_truth_dataset
-- Purpose: Store validated Q&A pairs for benchmarking and pre-generation
-- ============================================================================

CREATE TABLE IF NOT EXISTS ground_truth_dataset (
    -- Primary Key
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Question
    question_text TEXT NOT NULL,
    question_hash VARCHAR(64) NOT NULL UNIQUE,
    
    -- Answer
    answer_text TEXT NOT NULL,
    key_points JSON,
    acceptable_variations JSON,
    
    -- Educational Context
    board VARCHAR(50) NOT NULL,
    class_level TINYINT NOT NULL CHECK (class_level >= 1 AND class_level <= 12),
    subject VARCHAR(100) NOT NULL,
    chapter VARCHAR(255),
    topic VARCHAR(255),
    command_word VARCHAR(50),
    marks_allocated INT,
    
    -- Source Information
    source_type ENUM('teacher_validation', 'manual_entry', 'expert_review') NOT NULL,
    source_validation_id VARCHAR(36),
    
    -- Validation Information
    validated_by VARCHAR(255) NOT NULL,
    validator_name VARCHAR(255) NOT NULL,
    validation_score TINYINT CHECK (validation_score >= 0 AND validation_score <= 100),
    
    -- Quality Metrics
    faithfulness_score DECIMAL(3, 2),
    relevance_score DECIMAL(3, 2),
    
    -- Usage Tracking
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMP NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (source_validation_id) REFERENCES teacher_validation(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_question_hash (question_hash),
    INDEX idx_board_class_subject (board, class_level, subject),
    INDEX idx_is_active (is_active),
    INDEX idx_usage_count (usage_count),
    FULLTEXT INDEX idx_question_search (question_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 4: performance_profiling
-- Purpose: Track detailed performance metrics for each query
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_profiling (
    -- Primary Key
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Link to Feedback
    feedback_id VARCHAR(36),
    
    -- Query Information
    question_text TEXT NOT NULL,
    session_id VARCHAR(255),
    user_id VARCHAR(255) NOT NULL,
    
    -- 10-Stage Timing Breakdown (milliseconds)
    routing_time_ms INT,
    cache_lookup_time_ms INT,
    query_embedding_time_ms INT,
    vector_search_time_ms INT,
    context_retrieval_time_ms INT,
    llm_generation_time_ms INT,
    ragas_verification_time_ms INT,
    citation_generation_time_ms INT,
    formatting_time_ms INT,
    response_streaming_time_ms INT,
    total_time_ms INT NOT NULL,
    
    -- Resource Usage
    input_tokens INT,
    output_tokens INT,
    cached_tokens INT,
    total_tokens INT,
    
    -- Cache Performance
    cache_hit BOOLEAN DEFAULT FALSE,
    cache_type ENUM('semantic', 'openai', 'pre-generated', 'none') DEFAULT 'none',
    
    -- Context Quality
    chunks_retrieved INT,
    avg_chunk_relevance DECIMAL(3, 2),
    
    -- Performance Flags
    slow_query BOOLEAN DEFAULT FALSE,
    bottleneck_stage VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (feedback_id) REFERENCES answer_feedback(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_total_time (total_time_ms),
    INDEX idx_slow_query (slow_query),
    INDEX idx_cache_type (cache_type),
    INDEX idx_created_at (created_at),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 5: quality_alerts
-- Purpose: Automated alerts for quality issues
-- ============================================================================

CREATE TABLE IF NOT EXISTS quality_alerts (
    -- Primary Key
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Alert Information
    alert_type ENUM(
        'low_rating',
        'low_faithfulness',
        'low_relevance',
        'slow_response',
        'high_cost',
        'cache_miss_spike',
        'validation_needed'
    ) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    message TEXT NOT NULL,
    
    -- Related Data
    feedback_id VARCHAR(36),
    question_text TEXT,
    
    -- Educational Context
    board VARCHAR(50),
    class_level TINYINT,
    subject VARCHAR(100),
    
    -- Metric Values
    metric_value DECIMAL(10, 2),
    threshold_value DECIMAL(10, 2),
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP NULL,
    resolution_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (feedback_id) REFERENCES answer_feedback(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_is_resolved (is_resolved),
    INDEX idx_created_at (created_at),
    INDEX idx_board_class_subject (board, class_level, subject)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Sample Data for Testing
-- ============================================================================

-- Insert sample feedback
INSERT INTO answer_feedback (
    question_text,
    answer_text,
    board,
    class_level,
    subject,
    star_rating,
    faithfulness_score,
    relevance_score,
    response_time_ms,
    cache_hit,
    user_id,
    clerk_id
) VALUES (
    'Explain the process of photosynthesis in plants.',
    'Photosynthesis is the process by which green plants convert light energy into chemical energy...',
    'CBSE',
    10,
    'Biology',
    5,
    0.92,
    0.88,
    4500,
    FALSE,
    'user_123',
    'clerk_abc123'
);

-- ============================================================================
-- End of Migration
-- ============================================================================

