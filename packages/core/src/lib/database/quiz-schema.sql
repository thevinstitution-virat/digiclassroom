-- VG Kosh Practice Quiz Database Schema
-- Complete production-ready schema for quiz system with spaced repetition

-- Quiz Categories
CREATE TABLE quiz_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  difficulty_level VARCHAR(20) DEFAULT 'medium',
  cultural_context BOOLEAN DEFAULT FALSE,
  subject_area VARCHAR(50),
  grade_levels JSON, -- Array of applicable grades [9,10,11,12]
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz Sessions
CREATE TABLE quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID REFERENCES quiz_categories(id),
  session_type VARCHAR(50) NOT NULL, -- 'practice', 'review', 'challenge', 'speed'
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER DEFAULT 0,
  incorrect_answers INTEGER DEFAULT 0,
  skipped_questions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,2) DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 0,
  difficulty_level VARCHAR(20) DEFAULT 'medium',
  cultural_context_score INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  is_completed BOOLEAN DEFAULT FALSE,
  session_data JSON, -- Store additional session metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz Questions
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID REFERENCES dictionary_words(id),
  category_id UUID REFERENCES quiz_categories(id),
  question_type VARCHAR(50) NOT NULL, -- 'mcq', 'fill_blank', 'synonym', 'antonym', 'cultural'
  question_text TEXT NOT NULL,
  options JSON NOT NULL, -- Array of options for MCQ
  correct_answer VARCHAR(500) NOT NULL,
  explanation TEXT,
  cultural_context TEXT,
  hindi_context TEXT,
  difficulty_level VARCHAR(20) DEFAULT 'medium',
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz Responses
CREATE TABLE quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES quiz_sessions(id),
  question_id UUID REFERENCES quiz_questions(id),
  user_id UUID NOT NULL,
  user_answer VARCHAR(500),
  is_correct BOOLEAN NOT NULL,
  response_time_seconds INTEGER,
  hint_used BOOLEAN DEFAULT FALSE,
  doubt_resolved BOOLEAN DEFAULT FALSE,
  confidence_level INTEGER, -- 1-5 scale
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spaced Repetition Cards
CREATE TABLE spaced_repetition_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  word_id UUID REFERENCES dictionary_words(id),
  interval_days INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  ease_factor DECIMAL(3,2) DEFAULT 2.5, -- SM-2 algorithm ease factor
  last_reviewed TIMESTAMP,
  next_review TIMESTAMP NOT NULL,
  mastery_level INTEGER DEFAULT 0, -- 0-100%
  difficulty_level VARCHAR(20) DEFAULT 'medium',
  total_reviews INTEGER DEFAULT 0,
  correct_reviews INTEGER DEFAULT 0,
  incorrect_reviews INTEGER DEFAULT 0,
  learning_stage VARCHAR(20) DEFAULT 'new', -- 'new', 'learning', 'practicing', 'mastering', 'mastered'
  cultural_context_mastery INTEGER DEFAULT 0, -- 0-100%
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_type VARCHAR(50) NOT NULL, -- 'milestone', 'performance', 'cultural', 'streak', 'social'
  achievement_code VARCHAR(100) NOT NULL, -- Unique identifier for achievement
  achievement_name VARCHAR(200) NOT NULL,
  achievement_description TEXT,
  badge_icon VARCHAR(100),
  badge_color VARCHAR(50),
  points_awarded INTEGER DEFAULT 0,
  cultural_context BOOLEAN DEFAULT FALSE,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_visible BOOLEAN DEFAULT TRUE
);

-- Quiz Leaderboards
CREATE TABLE quiz_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  leaderboard_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'class', 'school'
  category_id UUID REFERENCES quiz_categories(id),
  score INTEGER NOT NULL,
  rank_position INTEGER,
  total_participants INTEGER,
  accuracy_rate DECIMAL(5,2),
  cultural_bonus_points INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Quiz Preferences
CREATE TABLE user_quiz_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  preferred_categories JSON, -- Array of category IDs
  difficulty_preference VARCHAR(20) DEFAULT 'adaptive',
  cultural_context_enabled BOOLEAN DEFAULT TRUE,
  hindi_explanations_enabled BOOLEAN DEFAULT TRUE,
  daily_goal_questions INTEGER DEFAULT 20,
  reminder_enabled BOOLEAN DEFAULT TRUE,
  reminder_time TIME DEFAULT '18:00:00',
  spaced_repetition_enabled BOOLEAN DEFAULT TRUE,
  ai_tutor_integration BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quiz Analytics
CREATE TABLE quiz_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  questions_attempted INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  categories_practiced JSON, -- Array of category IDs
  new_words_learned INTEGER DEFAULT 0,
  words_reviewed INTEGER DEFAULT 0,
  words_mastered INTEGER DEFAULT 0,
  cultural_questions_correct INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  achievement_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

-- Indexes for performance optimization
CREATE INDEX idx_quiz_sessions_user_id ON quiz_sessions(user_id);
CREATE INDEX idx_quiz_sessions_completed ON quiz_sessions(is_completed, completed_at);
CREATE INDEX idx_quiz_responses_session_id ON quiz_responses(session_id);
CREATE INDEX idx_quiz_responses_user_id ON quiz_responses(user_id);
CREATE INDEX idx_spaced_repetition_user_id ON spaced_repetition_cards(user_id);
CREATE INDEX idx_spaced_repetition_next_review ON spaced_repetition_cards(next_review);
CREATE INDEX idx_spaced_repetition_learning_stage ON spaced_repetition_cards(learning_stage);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_quiz_leaderboards_user_id ON quiz_leaderboards(user_id);
CREATE INDEX idx_quiz_leaderboards_type_period ON quiz_leaderboards(leaderboard_type, period_start, period_end);
CREATE INDEX idx_quiz_analytics_user_date ON quiz_analytics(user_id, date);

-- Insert default quiz categories
INSERT INTO quiz_categories (name, description, icon, difficulty_level, cultural_context, subject_area, grade_levels) VALUES
('CBSE Class 9-10', 'Essential vocabulary for CBSE Class 9-10 students', '📚', 'medium', true, 'general', '[9,10]'),
('CBSE Class 11-12', 'Advanced vocabulary for CBSE Class 11-12 students', '🎓', 'hard', true, 'general', '[11,12]'),
('JEE/NEET Scientific Terms', 'Scientific vocabulary for competitive exams', '🔬', 'hard', false, 'science', '[11,12]'),
('English Literature', 'Literary terms and vocabulary', '📖', 'medium', true, 'literature', '[9,10,11,12]'),
('Indian Cultural Context', 'Words related to Indian culture, festivals, and traditions', '🇮🇳', 'medium', true, 'culture', '[9,10,11,12]'),
('Business & Economics', 'Commercial and economic vocabulary', '💼', 'hard', false, 'commerce', '[11,12]'),
('Daily Usage Words', 'Common English words used in daily life', '🗣️', 'easy', true, 'general', '[9,10,11,12]'),
('Historical Terms', 'Vocabulary related to Indian and world history', '🏛️', 'medium', true, 'history', '[9,10,11,12]'),
('Speed Challenge', 'Quick-fire vocabulary questions', '⚡', 'medium', false, 'general', '[9,10,11,12]'),
('Festival Special', 'Words related to Indian festivals and celebrations', '🎊', 'easy', true, 'culture', '[9,10,11,12]');
