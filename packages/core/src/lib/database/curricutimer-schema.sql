-- CurricuTimer Database Schema
-- Study sessions, syllabus data, and engagement metrics

-- Study Sessions Table
CREATE TABLE IF NOT EXISTS study_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    grade INT NOT NULL,
    board VARCHAR(50) NOT NULL,
    duration INT NOT NULL, -- in minutes
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NULL,
    completed BOOLEAN DEFAULT FALSE,
    engagement_score FLOAT NULL,
    active_time INT DEFAULT 0, -- in seconds
    idle_time INT DEFAULT 0, -- in seconds
    interactions INT DEFAULT 0,
    focus_events INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_sessions (user_id, created_at),
    INDEX idx_topic_sessions (topic, subject, grade)
);

-- Syllabus Data Table
CREATE TABLE IF NOT EXISTS syllabus_data (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    board VARCHAR(50) NOT NULL,
    grade INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    chapter_id VARCHAR(50) NOT NULL,
    chapter_title VARCHAR(255) NOT NULL,
    topics JSON NOT NULL,
    priority ENUM('high', 'medium', 'low') DEFAULT 'medium',
    estimated_hours INT DEFAULT 0,
    exam_dates JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_syllabus (board, grade, subject, chapter_id),
    INDEX idx_board_grade_subject (board, grade, subject)
);

-- User Learning Preferences
CREATE TABLE IF NOT EXISTS user_learning_preferences (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL UNIQUE,
    preferred_session_duration INT DEFAULT 25, -- in minutes
    break_duration INT DEFAULT 5, -- in minutes
    daily_study_goal INT DEFAULT 120, -- in minutes
    notification_preferences JSON NULL,
    adaptive_timing BOOLEAN DEFAULT TRUE,
    focus_threshold FLOAT DEFAULT 0.7, -- engagement threshold
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_preferences (user_id)
);

-- Engagement Metrics Table
CREATE TABLE IF NOT EXISTS engagement_metrics (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    active_time INT NOT NULL, -- in seconds
    idle_time INT NOT NULL, -- in seconds
    interactions INT NOT NULL,
    focus_events INT NOT NULL,
    engagement_score FLOAT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_metrics (session_id),
    INDEX idx_user_engagement (user_id, recorded_at)
);

-- Upcoming Exams Table
CREATE TABLE IF NOT EXISTS upcoming_exams (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    exam_date DATE NOT NULL,
    exam_type ENUM('unit_test', 'mid_term', 'final', 'board_exam', 'competitive') NOT NULL,
    priority ENUM('high', 'medium', 'low') DEFAULT 'medium',
    preparation_status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_exams (user_id, exam_date),
    INDEX idx_upcoming_exams (exam_date, priority)
);

-- Session Analytics View
CREATE VIEW session_analytics AS
SELECT 
    s.user_id,
    s.subject,
    s.grade,
    s.board,
    COUNT(*) as total_sessions,
    SUM(s.duration) as total_study_time,
    AVG(s.engagement_score) as avg_engagement,
    SUM(CASE WHEN s.completed = TRUE THEN 1 ELSE 0 END) as completed_sessions,
    MAX(s.created_at) as last_session_date
FROM study_sessions s
GROUP BY s.user_id, s.subject, s.grade, s.board;

-- Insert sample CBSE syllabus data
INSERT INTO syllabus_data (board, grade, subject, chapter_id, chapter_title, topics, priority, estimated_hours, exam_dates) VALUES
('CBSE', 9, 'Mathematics', 'ch1', 'Number Systems', 
 JSON_ARRAY('Real Numbers', 'Irrational Numbers', 'Rationalization', 'Laws of Exponents'), 
 'high', 12, JSON_ARRAY('2024-03-15', '2024-04-20')),
 
('CBSE', 9, 'Mathematics', 'ch2', 'Polynomials', 
 JSON_ARRAY('Polynomial Definition', 'Degree of Polynomial', 'Zeros of Polynomial', 'Remainder Theorem'), 
 'high', 10, JSON_ARRAY('2024-03-15', '2024-04-20')),
 
('CBSE', 9, 'Science', 'ch1', 'Matter in Our Surroundings', 
 JSON_ARRAY('States of Matter', 'Evaporation', 'Temperature and Heat', 'Kinetic Theory'), 
 'medium', 8, JSON_ARRAY('2024-03-18', '2024-04-22')),
 
('CBSE', 10, 'Mathematics', 'ch1', 'Real Numbers', 
 JSON_ARRAY('Euclid Division Algorithm', 'HCF and LCM', 'Irrational Numbers', 'Decimal Expansion'), 
 'high', 14, JSON_ARRAY('2024-03-20', '2024-04-25')),
 
('CBSE', 10, 'Mathematics', 'ch2', 'Quadratic Equations', 
 JSON_ARRAY('Standard Form', 'Factorization Method', 'Quadratic Formula', 'Nature of Roots'), 
 'high', 12, JSON_ARRAY('2024-03-20', '2024-04-25')),
 
('CBSE', 11, 'Mathematics', 'ch1', 'Sets and Functions', 
 JSON_ARRAY('Set Theory', 'Types of Sets', 'Functions', 'Domain and Range'), 
 'high', 16, JSON_ARRAY('2024-04-10', '2024-05-15')),
 
('CBSE', 12, 'Mathematics', 'ch1', 'Relations and Functions', 
 JSON_ARRAY('Types of Relations', 'Equivalence Relations', 'Functions', 'Inverse Functions'), 
 'high', 18, JSON_ARRAY('2024-04-25', '2024-05-30'));

-- Insert sample ICSE syllabus data
INSERT INTO syllabus_data (board, grade, subject, chapter_id, chapter_title, topics, priority, estimated_hours) VALUES
('ICSE', 9, 'Mathematics', 'ch1', 'Rational and Irrational Numbers', 
 JSON_ARRAY('Properties of Rational Numbers', 'Irrational Numbers', 'Real Numbers', 'Surds'), 
 'high', 10),
 
('ICSE', 10, 'Mathematics', 'ch1', 'Commercial Mathematics', 
 JSON_ARRAY('Compound Interest', 'Installment Buying', 'Income Tax', 'Banking'), 
 'medium', 12);

-- Create indexes for performance
CREATE INDEX idx_syllabus_lookup ON syllabus_data (board, grade, subject, priority);
CREATE INDEX idx_session_completion ON study_sessions (user_id, completed, created_at);
CREATE INDEX idx_engagement_trends ON engagement_metrics (user_id, recorded_at, engagement_score);
