-- User Feedback & Quality Validation Schema
-- Tracks user satisfaction, answer quality, and system performance

-- Answer Feedback Table (User ratings on generated answers)
CREATE TABLE IF NOT EXISTS answer_feedback (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- User & Context
    user_id VARCHAR(255) NOT NULL,
    clerk_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NULL,
    
    -- Question & Answer
    question_text TEXT NOT NULL,
    question_hash VARCHAR(64) NOT NULL, -- SHA256 hash for deduplication
    answer_text TEXT NOT NULL,
    answer_id VARCHAR(36) NULL, -- Reference to cached/pre-generated answer if applicable
    
    -- Educational Context
    board VARCHAR(20) NOT NULL, -- CBSE, ICSE, etc.
    class_level TINYINT NOT NULL CHECK (class_level >= 1 AND class_level <= 12),
    subject VARCHAR(100) NOT NULL,
    command_word VARCHAR(50) NULL, -- DEFINE, EXPLAIN, COMPARE, etc.
    marks_allocated TINYINT NULL,
    
    -- User Feedback
    rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5 stars
    thumbs_up BOOLEAN NULL, -- Quick thumbs up/down (optional)
    feedback_text TEXT NULL, -- Optional detailed feedback
    feedback_category ENUM('accuracy', 'completeness', 'clarity', 'formatting', 'citations', 'other') NULL,
    
    -- Quality Metrics (Auto-calculated)
    answer_length INT NULL, -- Character count
    source_count INT NULL, -- Number of sources cited
    confidence_score DECIMAL(5,4) NULL, -- 0.0000-1.0000
    faithfulness_score DECIMAL(5,4) NULL, -- RAGAS faithfulness (0-1)
    relevance_score DECIMAL(5,4) NULL, -- RAGAS answer relevance (0-1)
    
    -- Performance Metrics
    response_time_ms INT NULL, -- Total response time
    cache_hit BOOLEAN DEFAULT FALSE,
    cache_type ENUM('semantic', 'openai', 'pre-generated', 'none') DEFAULT 'none',
    
    -- Routing & Processing
    route_type VARCHAR(50) NULL, -- 'rag', 'simple', 'complex', etc.
    complexity VARCHAR(20) NULL, -- 'simple', 'moderate', 'complex'
    intent_type VARCHAR(50) NULL, -- 'factual', 'conceptual', 'procedural', etc.
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for analytics
    INDEX idx_user_feedback (user_id, created_at),
    INDEX idx_rating_analysis (rating, board, class_level, subject),
    INDEX idx_quality_metrics (faithfulness_score, relevance_score),
    INDEX idx_performance (response_time_ms, cache_hit),
    INDEX idx_question_hash (question_hash),
    INDEX idx_created_at (created_at)
);

-- Teacher Validation Table (Expert validation of answers)
CREATE TABLE IF NOT EXISTS teacher_validation (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Validator Info
    teacher_id VARCHAR(255) NOT NULL,
    teacher_clerk_id VARCHAR(255) NOT NULL,
    teacher_name VARCHAR(255) NULL,
    teacher_specialization VARCHAR(100) NULL, -- Subject expertise
    
    -- Answer Reference
    answer_feedback_id VARCHAR(36) NULL, -- Link to answer_feedback if exists
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    
    -- Educational Context
    board VARCHAR(20) NOT NULL,
    class_level TINYINT NOT NULL CHECK (class_level >= 1 AND class_level <= 12),
    subject VARCHAR(100) NOT NULL,
    command_word VARCHAR(50) NULL,
    marks_allocated TINYINT NULL,
    
    -- Validation Scores (0-100 scale)
    accuracy_score TINYINT CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
    completeness_score TINYINT CHECK (completeness_score >= 0 AND completeness_score <= 100),
    cbse_alignment_score TINYINT CHECK (cbse_alignment_score >= 0 AND cbse_alignment_score <= 100),
    clarity_score TINYINT CHECK (clarity_score >= 0 AND clarity_score <= 100),
    citation_quality_score TINYINT CHECK (citation_quality_score >= 0 AND citation_quality_score <= 100),
    overall_score TINYINT CHECK (overall_score >= 0 AND overall_score <= 100),
    
    -- Detailed Feedback
    strengths TEXT NULL,
    weaknesses TEXT NULL,
    suggestions TEXT NULL,
    missing_points TEXT NULL,
    incorrect_information TEXT NULL,
    
    -- Validation Status
    validation_status ENUM('approved', 'needs_improvement', 'rejected') NOT NULL,
    approved_for_pre_generation BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    validation_time_minutes INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_teacher_validations (teacher_id, created_at),
    INDEX idx_validation_status (validation_status, overall_score),
    INDEX idx_subject_validation (subject, class_level, validation_status),
    INDEX idx_answer_reference (answer_feedback_id),
    FOREIGN KEY (answer_feedback_id) REFERENCES answer_feedback(id) ON DELETE SET NULL
);

-- Ground Truth Dataset (Validated Q&A pairs for evaluation)
CREATE TABLE IF NOT EXISTS ground_truth_dataset (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Question
    question_text TEXT NOT NULL,
    question_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA256 for deduplication
    
    -- Educational Context
    board VARCHAR(20) NOT NULL,
    class_level TINYINT NOT NULL CHECK (class_level >= 1 AND class_level <= 12),
    subject VARCHAR(100) NOT NULL,
    chapter VARCHAR(255) NULL,
    topic VARCHAR(255) NULL,
    command_word VARCHAR(50) NULL,
    marks_allocated TINYINT NULL,
    difficulty_level ENUM('easy', 'medium', 'hard') NOT NULL,
    
    -- Validated Answer
    reference_answer TEXT NOT NULL,
    key_points JSON NOT NULL, -- Array of essential points that must be covered
    acceptable_variations JSON NULL, -- Alternative phrasings/approaches
    
    -- Source Information
    source_textbook VARCHAR(255) NULL,
    source_chapter VARCHAR(255) NULL,
    source_page_numbers VARCHAR(100) NULL,
    
    -- Validation Info
    validated_by VARCHAR(255) NOT NULL, -- Teacher clerk_id
    validator_name VARCHAR(255) NULL,
    validation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validation_notes TEXT NULL,
    
    -- Quality Metrics
    answer_quality_score TINYINT CHECK (answer_quality_score >= 0 AND answer_quality_score <= 100),
    cbse_alignment_score TINYINT CHECK (cbse_alignment_score >= 0 AND cbse_alignment_score <= 100),
    
    -- Usage Tracking
    times_used_for_evaluation INT DEFAULT 0,
    last_used_at TIMESTAMP NULL,
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_subject_difficulty (subject, class_level, difficulty_level),
    INDEX idx_validation (validated_by, validation_date),
    INDEX idx_usage (times_used_for_evaluation, last_used_at),
    INDEX idx_active (is_active, board, class_level)
);

-- Performance Profiling Table (Detailed timing breakdown)
CREATE TABLE IF NOT EXISTS performance_profiling (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Request Info
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NULL,
    question_text TEXT NOT NULL,
    
    -- Educational Context
    board VARCHAR(20) NOT NULL,
    class_level TINYINT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    
    -- Timing Breakdown (all in milliseconds)
    total_time_ms INT NOT NULL,
    routing_time_ms INT NULL,
    cache_lookup_time_ms INT NULL,
    query_embedding_time_ms INT NULL,
    vector_search_time_ms INT NULL,
    context_retrieval_time_ms INT NULL,
    llm_generation_time_ms INT NULL,
    citation_generation_time_ms INT NULL,
    formatting_time_ms INT NULL,
    verification_time_ms INT NULL,
    
    -- Resource Usage
    prompt_tokens INT NULL,
    completion_tokens INT NULL,
    cached_tokens INT NULL,
    total_tokens INT NULL,
    
    -- Cache Performance
    cache_hit BOOLEAN DEFAULT FALSE,
    cache_type ENUM('semantic', 'openai', 'pre-generated', 'none') DEFAULT 'none',
    semantic_cache_similarity DECIMAL(5,4) NULL,
    
    -- Context Quality
    chunks_retrieved INT NULL,
    chunks_used INT NULL,
    avg_chunk_relevance DECIMAL(5,4) NULL,
    
    -- Performance Flags
    slow_query BOOLEAN DEFAULT FALSE, -- >5 seconds
    very_slow_query BOOLEAN DEFAULT FALSE, -- >10 seconds
    bottleneck_stage VARCHAR(50) NULL, -- Which stage took longest
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_performance_analysis (total_time_ms, slow_query),
    INDEX idx_bottleneck (bottleneck_stage, total_time_ms),
    INDEX idx_cache_performance (cache_hit, cache_type),
    INDEX idx_created_at (created_at)
);

-- Quality Alerts Table (Automated quality monitoring)
CREATE TABLE IF NOT EXISTS quality_alerts (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Alert Info
    alert_type ENUM('low_rating', 'low_faithfulness', 'slow_response', 'high_error_rate', 'cache_miss_spike', 'cost_spike') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    
    -- Alert Details
    alert_message TEXT NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    
    -- Context
    board VARCHAR(20) NULL,
    class_level TINYINT NULL,
    subject VARCHAR(100) NULL,
    time_window VARCHAR(50) NULL, -- e.g., 'last_hour', 'last_24h'
    
    -- Resolution
    status ENUM('open', 'investigating', 'resolved', 'false_positive') DEFAULT 'open',
    assigned_to VARCHAR(255) NULL,
    resolution_notes TEXT NULL,
    resolved_at TIMESTAMP NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_alert_status (status, severity, created_at),
    INDEX idx_alert_type (alert_type, created_at),
    INDEX idx_subject_alerts (subject, class_level, created_at)
);

