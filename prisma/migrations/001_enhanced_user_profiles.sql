-- Enhanced User Profile Management System
-- Migration: 001_enhanced_user_profiles
-- Description: Add role-based user profiles and educational context

-- Enhanced User Profile Table
CREATE TABLE IF NOT EXISTS enhanced_user_profiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(255) NOT NULL,
  role ENUM('student', 'teacher', 'parent_guardian') NOT NULL DEFAULT 'student',
  
  -- Educational Context
  board_type ENUM('CBSE', 'ICSE', 'State') DEFAULT 'CBSE',
  grade_level INT DEFAULT NULL,
  subjects JSON DEFAULT NULL, -- Array of selected subjects
  learning_style ENUM('visual', 'auditory', 'kinesthetic', 'mixed') DEFAULT 'mixed',
  
  -- Student-specific fields
  performance_metrics JSON DEFAULT NULL,
  learning_pace ENUM('slow', 'average', 'fast') DEFAULT 'average',
  difficulty_preferences JSON DEFAULT NULL,
  
  -- Teacher-specific fields
  teaching_experience_years INT DEFAULT NULL,
  specialization_subjects JSON DEFAULT NULL,
  classroom_size_preference INT DEFAULT NULL,
  
  -- Parent-specific fields
  child_grade_levels JSON DEFAULT NULL,
  involvement_level ENUM('high', 'moderate', 'minimal') DEFAULT 'moderate',
  support_preferences JSON DEFAULT NULL,
  
  -- Behavioral Patterns
  interaction_history JSON DEFAULT NULL,
  preferred_explanation_complexity ENUM('basic', 'intermediate', 'advanced') DEFAULT 'intermediate',
  language_preference ENUM('english', 'hindi', 'mixed') DEFAULT 'english',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_role (role),
  INDEX idx_board_grade (board_type, grade_level),
  
  -- Constraints
  UNIQUE KEY unique_user_profile (user_id)
);

-- Role-Based Menu Configuration Table
CREATE TABLE IF NOT EXISTS role_menu_configurations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role ENUM('student', 'teacher', 'parent_guardian') NOT NULL,
  menu_structure JSON NOT NULL,
  interaction_flows JSON DEFAULT NULL,
  default_prompts JSON DEFAULT NULL,
  priority_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_role_active (role, is_active),
  INDEX idx_priority (priority_order)
);

-- Learning Analytics Table
CREATE TABLE IF NOT EXISTS learning_analytics (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) DEFAULT NULL,
  
  -- Interaction Data
  query_text TEXT DEFAULT NULL,
  response_quality_score DECIMAL(3,2) DEFAULT NULL,
  interaction_duration_seconds INT DEFAULT NULL,
  difficulty_level ENUM('basic', 'intermediate', 'advanced') DEFAULT NULL,
  
  -- Learning Metrics
  concept_mastery_score DECIMAL(3,2) DEFAULT NULL,
  engagement_score DECIMAL(3,2) DEFAULT NULL,
  learning_velocity DECIMAL(5,2) DEFAULT NULL,
  
  -- Context
  subject VARCHAR(100) DEFAULT NULL,
  grade_level INT DEFAULT NULL,
  menu_action VARCHAR(100) DEFAULT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_user_session (user_id, session_id),
  INDEX idx_subject_grade (subject, grade_level),
  INDEX idx_created_at (created_at)
);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(255) NOT NULL,
  
  -- UI Preferences
  theme ENUM('light', 'dark', 'auto') DEFAULT 'light',
  font_size ENUM('small', 'medium', 'large') DEFAULT 'medium',
  animation_enabled BOOLEAN DEFAULT TRUE,
  
  -- Educational Preferences
  explanation_style ENUM('detailed', 'concise', 'step_by_step') DEFAULT 'step_by_step',
  example_preference ENUM('many', 'few', 'contextual') DEFAULT 'contextual',
  feedback_frequency ENUM('high', 'moderate', 'low') DEFAULT 'moderate',
  
  -- Notification Preferences
  study_reminders BOOLEAN DEFAULT FALSE,
  progress_updates BOOLEAN DEFAULT TRUE,
  achievement_notifications BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE KEY unique_user_preferences (user_id),
  INDEX idx_user_id (user_id)
);

-- Insert default role menu configurations
INSERT INTO role_menu_configurations (role, menu_structure, interaction_flows, default_prompts, priority_order) VALUES
('student', 
 JSON_OBJECT(
   'primary_actions', JSON_ARRAY(
     JSON_OBJECT('id', 'homework_help', 'label', 'Get Homework Help', 'icon', '📚', 'priority', 1),
     JSON_OBJECT('id', 'explain_topic', 'label', 'Explain a Topic', 'icon', '💡', 'priority', 2),
     JSON_OBJECT('id', 'practice_questions', 'label', 'Practice Questions', 'icon', '✍️', 'priority', 3),
     JSON_OBJECT('id', 'clear_doubts', 'label', 'Clear Doubts', 'icon', '❓', 'priority', 4),
     JSON_OBJECT('id', 'exam_prep', 'label', 'Exam Preparation', 'icon', '🎯', 'priority', 5),
     JSON_OBJECT('id', 'study_tips', 'label', 'Study Tips', 'icon', '📖', 'priority', 6)
   )
 ),
 JSON_OBJECT(
   'homework_help', JSON_OBJECT('approach', 'guided_discovery', 'scaffolding', 'high'),
   'explain_topic', JSON_OBJECT('approach', 'conceptual_building', 'examples', 'many'),
   'practice_questions', JSON_OBJECT('approach', 'adaptive_difficulty', 'feedback', 'immediate')
 ),
 JSON_OBJECT(
   'greeting', 'Hi! I\'m here to help you learn. What would you like to explore today?',
   'encouragement', 'Great question! Let\'s work through this together.',
   'error_handling', 'That\'s okay! Making mistakes is part of learning. Let\'s try a different approach.'
 ),
 1),

('teacher',
 JSON_OBJECT(
   'primary_actions', JSON_ARRAY(
     JSON_OBJECT('id', 'lesson_planning', 'label', 'Lesson Planning', 'icon', '📋', 'priority', 1),
     JSON_OBJECT('id', 'teaching_resources', 'label', 'Teaching Resources', 'icon', '📁', 'priority', 2),
     JSON_OBJECT('id', 'assessment_help', 'label', 'Assessment Design', 'icon', '📊', 'priority', 3),
     JSON_OBJECT('id', 'curriculum_guidance', 'label', 'Curriculum Support', 'icon', '🎓', 'priority', 4)
   )
 ),
 JSON_OBJECT(
   'lesson_planning', JSON_OBJECT('approach', 'standards_aligned', 'differentiation', 'included'),
   'assessment_help', JSON_OBJECT('approach', 'rubric_based', 'formative_focus', 'true')
 ),
 JSON_OBJECT(
   'greeting', 'Welcome! I\'m here to support your teaching practice. How can I assist you today?',
   'professional_tone', 'Let\'s explore evidence-based strategies for this challenge.',
   'resource_focus', 'Here are curriculum-aligned resources and implementation strategies.'
 ),
 1),

('parent_guardian',
 JSON_OBJECT(
   'primary_actions', JSON_ARRAY(
     JSON_OBJECT('id', 'progress_interpretation', 'label', 'Understand Progress', 'icon', '📈', 'priority', 1),
     JSON_OBJECT('id', 'home_support', 'label', 'Home Support Tips', 'icon', '🏠', 'priority', 2),
     JSON_OBJECT('id', 'curriculum_explanation', 'label', 'Understand Curriculum', 'icon', '📚', 'priority', 3),
     JSON_OBJECT('id', 'parenting_guidance', 'label', 'Educational Parenting', 'icon', '👨‍👩‍👧‍👦', 'priority', 4),
     JSON_OBJECT('id', 'homework_assistance', 'label', 'Help with Homework', 'icon', '✏️', 'priority', 5)
   )
 ),
 JSON_OBJECT(
   'home_support', JSON_OBJECT('approach', 'practical_strategies', 'age_appropriate', 'true'),
   'curriculum_explanation', JSON_OBJECT('approach', 'parent_friendly', 'context_rich', 'true')
 ),
 JSON_OBJECT(
   'greeting', 'Hello! I\'m here to help you support your child\'s learning journey. What can I help you with?',
   'supportive_tone', 'Every child learns differently, and you\'re doing great by seeking support.',
   'practical_focus', 'Here are some practical ways you can support your child at home.'
 ),
 1);

-- Create indexes for better performance (MySQL compatible syntax)
CREATE INDEX idx_enhanced_profiles_role_grade ON enhanced_user_profiles(role, grade_level);
CREATE INDEX idx_learning_analytics_user_date ON learning_analytics(user_id, created_at);
CREATE INDEX idx_menu_configs_role_priority ON role_menu_configurations(role, priority_order);
