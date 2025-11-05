-- Mitram Psychological & Aptitude Assessment Schema
-- Comprehensive assessment system for Indian students

-- Assessment Results Table
CREATE TABLE IF NOT EXISTS mitram_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    module VARCHAR(50) NOT NULL, -- 'attention', 'grit', 'decision', 'habit', 'aptitude'
    score FLOAT NOT NULL,
    sub_scores JSON NOT NULL,
    recommendations TEXT,
    percentile FLOAT NULL,
    grade_level INT NOT NULL,
    board VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_module (user_id, module),
    INDEX idx_module_grade (module, grade_level),
    INDEX idx_created_date (created_at)
);

-- Assessment Sessions Table
CREATE TABLE IF NOT EXISTS mitram_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    module VARCHAR(50) NOT NULL,
    status ENUM('started', 'in_progress', 'completed', 'abandoned') DEFAULT 'started',
    responses JSON NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    duration_seconds INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    INDEX idx_user_sessions (user_id, start_time),
    INDEX idx_module_status (module, status)
);

-- Attention Assessment (TEA-Ch²) Results
CREATE TABLE IF NOT EXISTS mitram_attention_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    result_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    selectivity_score FLOAT NOT NULL,
    sustained_score FLOAT NOT NULL,
    switching_score FLOAT NOT NULL,
    everyday_attention_score FLOAT NOT NULL,
    focus_duration_minutes INT NOT NULL,
    errors_count INT DEFAULT 0,
    reaction_time_avg FLOAT NULL,
    grade_percentile FLOAT NULL,
    recommendations JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (result_id) REFERENCES mitram_results(id) ON DELETE CASCADE,
    INDEX idx_user_attention (user_id, created_at)
);

-- Grit Assessment Results
CREATE TABLE IF NOT EXISTS mitram_grit_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    result_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    consistency_score FLOAT NOT NULL,
    perseverance_score FLOAT NOT NULL,
    overall_grit_score FLOAT NOT NULL,
    item_responses JSON NOT NULL,
    grade_comparison FLOAT NULL,
    intervention_needed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (result_id) REFERENCES mitram_results(id) ON DELETE CASCADE,
    INDEX idx_user_grit (user_id, created_at)
);

-- Decision Making Assessment (ADMQ) Results
CREATE TABLE IF NOT EXISTS mitram_decision_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    result_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    vigilance_score FLOAT NOT NULL,
    panic_score FLOAT NOT NULL,
    complacency_score FLOAT NOT NULL,
    evasiveness_score FLOAT NOT NULL,
    dominant_style VARCHAR(20) NOT NULL,
    style_profile JSON NOT NULL,
    recommendations JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (result_id) REFERENCES mitram_results(id) ON DELETE CASCADE,
    INDEX idx_user_decision (user_id, created_at)
);

-- Habit Assessment Results
CREATE TABLE IF NOT EXISTS mitram_habit_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    result_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    target_habit VARCHAR(100) NOT NULL,
    cue_identification_score FLOAT NOT NULL,
    routine_awareness_score FLOAT NOT NULL,
    reward_understanding_score FLOAT NOT NULL,
    change_readiness_score FLOAT NOT NULL,
    habit_strength ENUM('weak', 'moderate', 'strong') NOT NULL,
    intervention_strategies JSON NULL,
    tracking_frequency ENUM('daily', 'weekly', 'monthly') DEFAULT 'daily',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (result_id) REFERENCES mitram_results(id) ON DELETE CASCADE,
    INDEX idx_user_habit (user_id, created_at)
);

-- Aptitude Assessment (CogAT Mini) Results
CREATE TABLE IF NOT EXISTS mitram_aptitude_results (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    result_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    verbal_score FLOAT NOT NULL,
    quantitative_score FLOAT NOT NULL,
    nonverbal_score FLOAT NOT NULL,
    composite_score FLOAT NOT NULL,
    verbal_percentile FLOAT NULL,
    quantitative_percentile FLOAT NULL,
    nonverbal_percentile FLOAT NULL,
    composite_percentile FLOAT NULL,
    strengths JSON NULL,
    weaknesses JSON NULL,
    learning_recommendations JSON NULL,
    difficulty_level ENUM('below_grade', 'at_grade', 'above_grade') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (result_id) REFERENCES mitram_results(id) ON DELETE CASCADE,
    INDEX idx_user_aptitude (user_id, created_at)
);

-- Notifications & Alerts
CREATE TABLE IF NOT EXISTS mitram_notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    parent_id VARCHAR(36) NULL,
    teacher_id VARCHAR(36) NULL,
    module VARCHAR(50) NOT NULL,
    alert_type ENUM('low_score', 'improvement', 'intervention_needed', 'milestone') NOT NULL,
    message TEXT NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    sent_via JSON NULL, -- WhatsApp, SMS, Email
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_notifications (user_id, created_at),
    INDEX idx_alert_type (alert_type, severity)
);

-- Assessment Progress Tracking
CREATE TABLE IF NOT EXISTS mitram_progress (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    module VARCHAR(50) NOT NULL,
    baseline_score FLOAT NULL,
    current_score FLOAT NULL,
    improvement_percentage FLOAT NULL,
    assessments_completed INT DEFAULT 0,
    last_assessment_date TIMESTAMP NULL,
    next_recommended_date TIMESTAMP NULL,
    trend ENUM('improving', 'stable', 'declining', 'insufficient_data') DEFAULT 'insufficient_data',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_module (user_id, module),
    INDEX idx_user_progress (user_id, updated_at)
);

-- Parent-Student Communication Log
CREATE TABLE IF NOT EXISTS mitram_communications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    parent_id VARCHAR(36) NULL,
    module VARCHAR(50) NOT NULL,
    communication_type ENUM('discussion_prompt', 'shared_result', 'intervention_plan', 'progress_update') NOT NULL,
    content TEXT NOT NULL,
    parent_response TEXT NULL,
    status ENUM('sent', 'viewed', 'responded', 'archived') DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_communications (user_id, created_at),
    INDEX idx_parent_communications (parent_id, status)
);

-- Assessment Question Bank
CREATE TABLE IF NOT EXISTS mitram_questions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    module VARCHAR(50) NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    grade_level INT NOT NULL,
    question_text TEXT NOT NULL,
    options JSON NULL,
    correct_answer VARCHAR(255) NULL,
    scoring_weight FLOAT DEFAULT 1.0,
    difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    cultural_context ENUM('indian', 'universal') DEFAULT 'indian',
    language ENUM('english', 'hindi', 'bilingual') DEFAULT 'english',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_module_grade (module, grade_level),
    INDEX idx_difficulty (difficulty_level, active)
);

-- Insert sample questions for each module
INSERT INTO mitram_questions (module, question_type, grade_level, question_text, options, scoring_weight, difficulty_level, cultural_context) VALUES

-- Attention Assessment Questions
('attention', 'selective_attention', 9, 'In a busy Indian marketplace, focus only on the fruit vendors. How many apple sellers do you see?', 
 JSON_OBJECT('type', 'visual_task', 'stimuli', 'marketplace_scene', 'target', 'apple_vendors'), 1.0, 'medium', 'indian'),

('attention', 'sustained_attention', 10, 'Watch this cricket match highlight for 5 minutes. Press space every time you see a boundary (4 or 6).', 
 JSON_OBJECT('type', 'vigilance_task', 'duration', 300, 'target_frequency', 'variable'), 1.0, 'medium', 'indian'),

-- Grit Assessment Questions (8-item Grit-S adapted for Indian students)
('grit', 'consistency', 9, 'मैं अक्सर कोई नया लक्ष्य निर्धारित करता हूँ लेकिन बाद में उस पर काम करना बंद कर देता हूँ। (I often set a goal but later choose to pursue a different one)', 
 JSON_ARRAY('बिल्कुल मेरे जैसा नहीं', 'मेरे जैसा नहीं', 'कुछ हद तक मेरे जैसा', 'ज्यादातर मेरे जैसा', 'बिल्कुल मेरे जैसा'), 1.0, 'medium', 'indian'),

('grit', 'perseverance', 10, 'कठिनाइयों का सामना करने पर मैं हार नहीं मानता। (Setbacks don\'t discourage me)', 
 JSON_ARRAY('बिल्कुल मेरे जैसा नहीं', 'मेरे जैसा नहीं', 'कुछ हद तक मेरे जैसा', 'ज्यादातर मेरे जैसा', 'बिल्कुल मेरे जैसा'), 1.0, 'medium', 'indian'),

-- Decision Making Questions (ADMQ adapted)
('decision', 'vigilance', 11, 'When choosing between IIT-JEE and NEET preparation, I carefully research all aspects before deciding.', 
 JSON_ARRAY('Never true', 'Rarely true', 'Sometimes true', 'Often true', 'Always true'), 1.0, 'medium', 'indian'),

('decision', 'panic', 12, 'When exam results are delayed, I immediately start worrying about the worst possible outcomes.', 
 JSON_ARRAY('Never true', 'Rarely true', 'Sometimes true', 'Often true', 'Always true'), 1.0, 'medium', 'indian'),

-- Habit Assessment Questions
('habit', 'cue_identification', 9, 'What usually triggers your mobile phone usage during study time?', 
 JSON_ARRAY('Notifications', 'Boredom', 'Difficult topics', 'Friend messages', 'Other'), 1.0, 'easy', 'indian'),

('habit', 'routine_awareness', 10, 'Describe your typical response when you feel like checking social media while studying.', 
 JSON_OBJECT('type', 'open_text', 'max_length', 200), 1.0, 'medium', 'indian'),

-- Aptitude Assessment Questions (CogAT Mini adapted)
('aptitude', 'verbal', 9, 'विद्या : ज्ञान :: धन : ?', 
 JSON_ARRAY('पैसा', 'संपत्ति', 'सुख', 'शक्ति'), 1.0, 'medium', 'indian'),

('aptitude', 'quantitative', 10, 'If a train travels 60 km in 45 minutes, how far will it travel in 2 hours?', 
 JSON_ARRAY('120 km', '160 km', '180 km', '200 km'), 1.0, 'medium', 'universal'),

('aptitude', 'nonverbal', 11, 'Complete the pattern: ○△□ ○△□ ○△?', 
 JSON_ARRAY('○', '△', '□', '◇'), 1.0, 'medium', 'universal');

-- Create views for analytics
CREATE VIEW mitram_user_overview AS
SELECT 
    mr.user_id,
    mr.grade_level,
    mr.board,
    COUNT(DISTINCT mr.module) as modules_completed,
    AVG(mr.score) as average_score,
    MAX(mr.created_at) as last_assessment,
    mp.trend as overall_trend
FROM mitram_results mr
LEFT JOIN mitram_progress mp ON mr.user_id = mp.user_id
GROUP BY mr.user_id, mr.grade_level, mr.board, mp.trend;

CREATE VIEW mitram_module_analytics AS
SELECT 
    module,
    grade_level,
    board,
    COUNT(*) as total_assessments,
    AVG(score) as average_score,
    STDDEV(score) as score_deviation,
    MIN(score) as min_score,
    MAX(score) as max_score
FROM mitram_results
GROUP BY module, grade_level, board;
