-- MySQL Initialization Script for DigiClassroom
-- Fixes database connection and permission issues

USE virat_gyankosh;

-- Create enhanced user profiles table with proper indexes
CREATE TABLE IF NOT EXISTS enhanced_user_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    role ENUM('student', 'teacher', 'parent_guardian') NOT NULL DEFAULT 'student',
    
    -- Educational Context
    board_type ENUM('CBSE', 'ICSE', 'State') DEFAULT 'CBSE',
    grade_level INT DEFAULT 9,
    subjects JSON,
    learning_style ENUM('visual', 'auditory', 'kinesthetic', 'mixed') DEFAULT 'mixed',
    
    -- Performance tracking
    interaction_count INT DEFAULT 0,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_role (user_id, role),
    INDEX idx_board_grade (board_type, grade_level)
);

-- Create role menu configurations table
CREATE TABLE IF NOT EXISTS role_menu_configurations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    role ENUM('student', 'teacher', 'parent_guardian') NOT NULL,
    menu_action VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_role_action (role, menu_action),
    INDEX idx_role_active (role, is_active)
);

-- Create learning analytics table
CREATE TABLE IF NOT EXISTS learning_analytics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    interaction_type VARCHAR(100),
    subject VARCHAR(100),
    topic VARCHAR(200),
    difficulty_level ENUM('basic', 'intermediate', 'advanced') DEFAULT 'intermediate',
    response_time_ms INT,
    satisfaction_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_subject (user_id, subject),
    INDEX idx_session (session_id),
    INDEX idx_created_at (created_at)
);

-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    preference_key VARCHAR(100) NOT NULL,
    preference_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_preference (user_id, preference_key),
    INDEX idx_user_id (user_id)
);

-- Insert default role menu configurations
INSERT IGNORE INTO role_menu_configurations (role, menu_action, display_name, description, icon, sort_order) VALUES
-- Student menu items
('student', 'explain_topic', 'Get Topic Explanation', 'Get detailed explanations of topics with examples', 'book-open', 1),
('student', 'solve_problem', 'Solve Problems', 'Get step-by-step solutions to problems', 'calculator', 2),
('student', 'practice_questions', 'Practice Questions', 'Get practice questions with solutions', 'edit', 3),
('student', 'exam_preparation', 'Exam Preparation', 'Get exam tips and preparation strategies', 'graduation-cap', 4),
('student', 'homework_help', 'Homework Help', 'Get help with homework assignments', 'clipboard-list', 5),
('student', 'concept_clarification', 'Clarify Concepts', 'Clear doubts and understand concepts better', 'lightbulb', 6),

-- Teacher menu items
('teacher', 'lesson_planning', 'Lesson Planning', 'Create comprehensive lesson plans', 'calendar', 1),
('teacher', 'assessment_creation', 'Create Assessments', 'Design tests and assignments', 'file-text', 2),
('teacher', 'curriculum_guidance', 'Curriculum Guidance', 'Get curriculum-aligned teaching strategies', 'map', 3),
('teacher', 'student_progress', 'Track Student Progress', 'Monitor and analyze student performance', 'trending-up', 4),

-- Parent/Guardian menu items
('parent_guardian', 'understand_progress', 'Understand Child Progress', 'Get insights into your child learning', 'user-check', 1),
('parent_guardian', 'home_support', 'Home Support Tips', 'Learn how to support learning at home', 'home', 2),
('parent_guardian', 'curriculum_overview', 'Curriculum Overview', 'Understand what your child is learning', 'book', 3),
('parent_guardian', 'communication_school', 'School Communication', 'Tips for effective parent-teacher communication', 'message-circle', 4),
('parent_guardian', 'learning_resources', 'Learning Resources', 'Find additional learning materials', 'folder', 5);

-- Grant proper permissions to root user from any host
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'root'@'172.18.0.1' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON virat_gyankosh.* TO 'digiclassroom_user'@'%';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_enhanced_profiles_role ON enhanced_user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_enhanced_profiles_board ON enhanced_user_profiles(board_type);
CREATE INDEX IF NOT EXISTS idx_enhanced_profiles_grade ON enhanced_user_profiles(grade_level);

-- Show tables to verify creation
SELECT 'Database setup completed successfully' as status;
SHOW TABLES;
