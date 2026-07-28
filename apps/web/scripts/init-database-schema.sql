-- DigiClassroom Pro Database Schema
-- Creates enhanced_user_profiles table with all required columns

CREATE DATABASE IF NOT EXISTS virat_gyankosh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE virat_gyankosh;

-- Enhanced User Profiles Table
CREATE TABLE IF NOT EXISTS enhanced_user_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  role ENUM('student', 'teacher', 'parent', 'admin') DEFAULT 'student',
  
  -- Educational Context
  board_type ENUM('CBSE', 'ICSE', 'STATE_BOARD') DEFAULT 'CBSE',
  medium ENUM('ENGLISH', 'HINDI') DEFAULT 'ENGLISH',
  grade_level INT,
  stream ENUM('MATHEMATICS', 'BIOLOGY', 'COMMERCE', 'HUMANITIES'),
  subjects JSON,
  
  -- User Preferences
  preferences JSON,
  learning_style ENUM('visual', 'auditory', 'kinesthetic', 'mixed') DEFAULT 'mixed',
  learning_pace ENUM('slow', 'average', 'fast') DEFAULT 'average',
  preferred_explanation_complexity ENUM('basic', 'intermediate', 'advanced') DEFAULT 'intermediate',
  
  -- Onboarding
  is_onboarding_complete BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_role (role),
  INDEX idx_board_grade (board_type, grade_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table creation
SELECT 'enhanced_user_profiles table created successfully' AS status;
DESCRIBE enhanced_user_profiles;
