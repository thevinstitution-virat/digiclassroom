-- TEA-Ch² Focus Check Database Schema
-- Comprehensive attention assessment system for VG Kosh Mitram

-- Main Attention Assessment Results Table
CREATE TABLE IF NOT EXISTS attention_assessments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    test_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    age_group ENUM('5-7', '8-15') NOT NULL,
    grade INT NOT NULL,
    board VARCHAR(20) NOT NULL DEFAULT 'CBSE',
    
    -- Raw Scores (0-100 scale)
    selective_score FLOAT NULL,
    sustained_score FLOAT NULL,
    switching_score FLOAT NULL, -- Only for 8-15 age group
    reaction_time FLOAT NULL, -- Average in milliseconds
    
    -- Index Scores (scaled 0-100)
    selective_index FLOAT NULL,
    sustained_index FLOAT NULL,
    everyday_index FLOAT NULL, -- Overall composite score
    
    -- Performance Metrics
    completion_time INT NOT NULL, -- Total time in seconds
    accuracy FLOAT NOT NULL, -- Overall accuracy percentage
    engagement_score FLOAT NOT NULL DEFAULT 0, -- 0-100 based on behavior
    
    -- Behavioral Data
    distraction_events INT DEFAULT 0,
    idle_time INT DEFAULT 0, -- Time inactive in seconds
    click_accuracy FLOAT NULL, -- Precision of clicks/taps
    average_latency FLOAT NULL, -- Average response time in ms
    response_variability FLOAT NULL, -- Consistency measure
    
    -- Grade Norm Comparisons
    selective_percentile FLOAT NULL,
    sustained_percentile FLOAT NULL,
    switching_percentile FLOAT NULL,
    overall_percentile FLOAT NULL,
    
    -- Alert Flags
    below_threshold BOOLEAN DEFAULT FALSE, -- Below 10th percentile
    parent_notified BOOLEAN DEFAULT FALSE,
    teacher_notified BOOLEAN DEFAULT FALSE,
    intervention_recommended BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    test_version VARCHAR(10) DEFAULT '1.0',
    device_type ENUM('desktop', 'tablet', 'mobile') DEFAULT 'desktop',
    browser_info TEXT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_assessments (user_id, test_date),
    INDEX idx_grade_performance (grade, overall_percentile),
    INDEX idx_alert_flags (below_threshold, intervention_recommended)
);

-- Grade-Based Normative Data
CREATE TABLE IF NOT EXISTS attention_grade_norms (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    grade INT NOT NULL,
    age_min INT NOT NULL,
    age_max INT NOT NULL,
    board VARCHAR(20) DEFAULT 'CBSE',
    
    -- Selective Attention Percentile Thresholds
    selective_p10 FLOAT NOT NULL, -- 10th percentile (concern threshold)
    selective_p25 FLOAT NOT NULL,
    selective_p50 FLOAT NOT NULL, -- Median
    selective_p75 FLOAT NOT NULL,
    selective_p90 FLOAT NOT NULL,
    
    -- Sustained Attention Percentile Thresholds
    sustained_p10 FLOAT NOT NULL,
    sustained_p25 FLOAT NOT NULL,
    sustained_p50 FLOAT NOT NULL,
    sustained_p75 FLOAT NOT NULL,
    sustained_p90 FLOAT NOT NULL,
    
    -- Switching Attention Percentile Thresholds (8-15 only)
    switching_p10 FLOAT NULL,
    switching_p25 FLOAT NULL,
    switching_p50 FLOAT NULL,
    switching_p75 FLOAT NULL,
    switching_p90 FLOAT NULL,
    
    -- Overall Composite Thresholds
    overall_p10 FLOAT NOT NULL,
    overall_p25 FLOAT NOT NULL,
    overall_p50 FLOAT NOT NULL,
    overall_p75 FLOAT NOT NULL,
    overall_p90 FLOAT NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_grade_age (grade, age_min, age_max, board),
    INDEX idx_grade_lookup (grade, board)
);

-- Individual Subtest Results
CREATE TABLE IF NOT EXISTS attention_subtest_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    assessment_id VARCHAR(36) NOT NULL,
    subtest_name VARCHAR(50) NOT NULL,
    subtest_type ENUM('selective', 'sustained', 'switching', 'reaction') NOT NULL,
    
    -- Performance Data
    raw_score FLOAT NOT NULL,
    scaled_score FLOAT NOT NULL,
    percentile FLOAT NULL,
    accuracy FLOAT NOT NULL,
    average_reaction_time FLOAT NOT NULL,
    completion_time INT NOT NULL,
    
    -- Detailed Metrics
    correct_responses INT NOT NULL,
    total_responses INT NOT NULL,
    false_positives INT DEFAULT 0,
    missed_targets INT DEFAULT 0,
    
    -- Behavioral Indicators
    engagement_score FLOAT NOT NULL,
    consistency_score FLOAT NOT NULL,
    fatigue_indicator FLOAT DEFAULT 0,
    
    -- Game-Specific Data (JSON)
    game_data JSON NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assessment_id) REFERENCES attention_assessments(id) ON DELETE CASCADE,
    INDEX idx_assessment_subtests (assessment_id),
    INDEX idx_subtest_performance (subtest_type, percentile)
);

-- Response-Level Data for Detailed Analysis
CREATE TABLE IF NOT EXISTS attention_responses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    subtest_result_id VARCHAR(36) NOT NULL,
    
    -- Stimulus Information
    stimulus_id VARCHAR(50) NOT NULL,
    stimulus_type ENUM('target', 'distractor', 'neutral') NOT NULL,
    stimulus_position_x FLOAT NULL,
    stimulus_position_y FLOAT NULL,
    
    -- Response Information
    response_time FLOAT NOT NULL, -- Milliseconds from stimulus onset
    response_correct BOOLEAN NOT NULL,
    response_position_x FLOAT NULL,
    response_position_y FLOAT NULL,
    
    -- Timing Data
    stimulus_onset BIGINT NOT NULL, -- Unix timestamp in ms
    response_timestamp BIGINT NOT NULL,
    
    -- Context Data
    trial_number INT NOT NULL,
    session_time FLOAT NOT NULL, -- Time since test start
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (subtest_result_id) REFERENCES attention_subtest_results(id) ON DELETE CASCADE,
    INDEX idx_subtest_responses (subtest_result_id),
    INDEX idx_response_analysis (stimulus_type, response_correct)
);

-- Attention Training Recommendations
CREATE TABLE IF NOT EXISTS attention_recommendations (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    assessment_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    
    -- Recommendation Type
    category ENUM('study_optimization', 'intervention', 'training', 'monitoring') NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL,
    
    -- Specific Recommendations
    pomodoro_duration INT NULL, -- Recommended study session length
    break_frequency INT NULL, -- Minutes between breaks
    attention_exercises JSON NULL, -- Specific training activities
    environmental_modifications TEXT NULL,
    
    -- Implementation Status
    status ENUM('pending', 'active', 'completed', 'dismissed') DEFAULT 'pending',
    implemented_date TIMESTAMP NULL,
    effectiveness_rating FLOAT NULL, -- 1-5 scale
    
    -- Metadata
    generated_by ENUM('algorithm', 'clinician', 'teacher') DEFAULT 'algorithm',
    expires_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assessment_id) REFERENCES attention_assessments(id) ON DELETE CASCADE,
    INDEX idx_user_recommendations (user_id, status),
    INDEX idx_priority_recommendations (priority, status)
);

-- Insert Sample Grade Norms (CBSE Standards)
INSERT INTO attention_grade_norms (grade, age_min, age_max, board, 
    selective_p10, selective_p25, selective_p50, selective_p75, selective_p90,
    sustained_p10, sustained_p25, sustained_p50, sustained_p75, sustained_p90,
    switching_p10, switching_p25, switching_p50, switching_p75, switching_p90,
    overall_p10, overall_p25, overall_p50, overall_p75, overall_p90) VALUES
(1, 5, 6, 'CBSE', 45, 55, 70, 80, 90, 40, 50, 65, 75, 85, NULL, NULL, NULL, NULL, NULL, 42, 52, 67, 77, 87),
(2, 6, 7, 'CBSE', 48, 58, 72, 82, 92, 43, 53, 68, 78, 88, NULL, NULL, NULL, NULL, NULL, 45, 55, 70, 80, 90),
(3, 7, 8, 'CBSE', 50, 60, 75, 85, 95, 45, 55, 70, 80, 90, 40, 50, 65, 75, 85, 47, 57, 72, 82, 92),
(4, 8, 9, 'CBSE', 52, 62, 77, 87, 97, 47, 57, 72, 82, 92, 42, 52, 67, 77, 87, 49, 59, 74, 84, 94),
(5, 9, 10, 'CBSE', 55, 65, 80, 90, 98, 50, 60, 75, 85, 95, 45, 55, 70, 80, 90, 52, 62, 77, 87, 97);
