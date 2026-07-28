-- VG Kosh Practest Engine Database Schema
-- Comprehensive question bank and test management system

-- Question Bank Table - Core storage for all questions
CREATE TABLE practest_question_bank (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  
  -- Question content
  question_text TEXT NOT NULL,
  question_type ENUM('MCQ', 'SUBJECTIVE', 'FILL_BLANK', 'TRUE_FALSE') NOT NULL DEFAULT 'MCQ',
  
  -- MCQ specific fields (standardized 4-option format)
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_option ENUM('A', 'B', 'C', 'D'),
  
  -- Subjective specific fields
  model_answer TEXT,
  marking_rubric JSON,
  keywords JSON, -- Key terms for automated evaluation
  
  -- Common fields
  explanation TEXT NOT NULL,
  max_marks DECIMAL(4,2) DEFAULT 1.00,
  time_limit_seconds INT DEFAULT 120, -- Recommended time per question
  
  -- Multimedia support
  question_image_url VARCHAR(500),
  option_images JSON, -- URLs for option images
  explanation_image_url VARCHAR(500),
  
  -- Mathematical/Scientific content flags
  has_math_content BOOLEAN DEFAULT FALSE,
  has_chemical_formulas BOOLEAN DEFAULT FALSE,
  has_diagrams BOOLEAN DEFAULT FALSE,
  
  -- Curriculum metadata (hierarchical structure)
  board ENUM('CBSE', 'ICSE', 'STATE_UP', 'STATE_MH', 'STATE_TN') NOT NULL,
  class_level INT NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  subject VARCHAR(100) NOT NULL,
  chapter VARCHAR(200) NOT NULL,
  topic VARCHAR(200) NOT NULL,
  subtopic VARCHAR(200),
  
  -- Learning taxonomy
  difficulty_level ENUM('EASY', 'MEDIUM', 'HARD') NOT NULL,
  bloom_level ENUM('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE') NOT NULL,
  cognitive_load ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'MEDIUM',
  
  -- Quality metrics and analytics
  usage_count INT DEFAULT 0,
  correct_attempts INT DEFAULT 0,
  total_attempts INT DEFAULT 0,
  average_time_seconds DECIMAL(6,2) DEFAULT 0,
  discrimination_index DECIMAL(4,3) DEFAULT 0, -- Item discrimination
  difficulty_index DECIMAL(4,3) DEFAULT 0, -- Actual difficulty
  
  -- Content hash for duplicate detection
  content_hash VARCHAR(64) UNIQUE,
  
  -- Quality assurance workflow
  validation_status ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'RETIRED') DEFAULT 'DRAFT',
  rejection_reason TEXT,
  
  -- Authorship and review
  created_by VARCHAR(36) NOT NULL,
  reviewed_by VARCHAR(36),
  approved_by VARCHAR(36),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL,
  
  -- Performance indexes
  INDEX idx_curriculum (board, class_level, subject, chapter, topic),
  INDEX idx_difficulty (difficulty_level, bloom_level),
  INDEX idx_validation (validation_status, created_at),
  INDEX idx_performance (usage_count, correct_attempts, total_attempts),
  INDEX idx_content_type (question_type, has_math_content, has_chemical_formulas),
  
  -- Foreign key constraints
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Test Configuration Templates
CREATE TABLE practest_test_configurations (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Curriculum scope
  board ENUM('CBSE', 'ICSE', 'STATE_UP', 'STATE_MH', 'STATE_TN') NOT NULL,
  class_level INT NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  subject VARCHAR(100) NOT NULL,
  chapters JSON NOT NULL, -- Array of chapter names
  topics JSON, -- Array of specific topics (optional)
  
  -- Test parameters
  total_questions INT NOT NULL CHECK (total_questions IN (10, 20, 30, 50)),
  duration_minutes INT NOT NULL,
  max_marks DECIMAL(6,2) NOT NULL,
  
  -- Scoring rules
  negative_marking DECIMAL(3,2) DEFAULT 0.00,
  partial_marking BOOLEAN DEFAULT FALSE,
  
  -- Question distribution strategy
  difficulty_distribution JSON NOT NULL, -- {"EASY": 30, "MEDIUM": 50, "HARD": 20}
  question_type_distribution JSON, -- {"MCQ": 80, "SUBJECTIVE": 20}
  bloom_distribution JSON, -- Cognitive level distribution
  
  -- Test behavior
  randomize_questions BOOLEAN DEFAULT TRUE,
  randomize_options BOOLEAN DEFAULT TRUE,
  allow_review BOOLEAN DEFAULT TRUE,
  show_results_immediately BOOLEAN DEFAULT TRUE,
  
  -- Instructions and rules
  instructions TEXT,
  rules JSON,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE, -- Public templates vs private
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_curriculum_config (board, class_level, subject),
  INDEX idx_active (is_active, is_public),
  
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Test Sessions - Individual test attempts
CREATE TABLE practest_test_sessions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  configuration_id VARCHAR(36),

  -- Custom test parameters (if not using configuration)
  custom_parameters JSON,

  -- Session data
  selected_questions JSON NOT NULL, -- Array of question IDs with sequence
  user_responses JSON, -- User answers with timestamps

  -- Timing information
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_seconds INT,
  time_remaining_seconds INT,

  -- Session state
  current_question_index INT DEFAULT 0,
  status ENUM('ACTIVE', 'COMPLETED', 'ABANDONED', 'EXPIRED', 'PAUSED') DEFAULT 'ACTIVE',

  -- Results and scoring
  total_score DECIMAL(6,2) DEFAULT 0,
  max_possible_score DECIMAL(6,2) NOT NULL,
  percentage DECIMAL(5,2) DEFAULT 0,

  -- Detailed analytics
  question_wise_results JSON, -- Individual question performance
  topic_wise_performance JSON, -- Performance by topic
  difficulty_wise_performance JSON, -- Performance by difficulty
  time_analytics JSON, -- Time spent per question/topic

  -- Review and feedback
  review_completed BOOLEAN DEFAULT FALSE,
  feedback_submitted BOOLEAN DEFAULT FALSE,
  session_feedback TEXT,

  -- Metadata
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_info JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_user_sessions (user_id, created_at),
  INDEX idx_status (status, start_time),
  INDEX idx_configuration (configuration_id, created_at),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (configuration_id) REFERENCES practest_test_configurations(id) ON DELETE SET NULL
);

-- Question Performance Analytics
CREATE TABLE practest_question_analytics (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  question_id VARCHAR(36) NOT NULL,

  -- Time-based metrics
  date_recorded DATE NOT NULL,

  -- Usage statistics
  times_presented INT DEFAULT 0,
  times_attempted INT DEFAULT 0,
  times_correct INT DEFAULT 0,
  times_skipped INT DEFAULT 0,

  -- Performance metrics
  average_time_seconds DECIMAL(6,2) DEFAULT 0,
  difficulty_index DECIMAL(4,3) DEFAULT 0, -- P-value (proportion correct)
  discrimination_index DECIMAL(4,3) DEFAULT 0, -- Point-biserial correlation

  -- Response pattern analysis
  option_selection_frequency JSON, -- How often each option was selected
  common_wrong_answers JSON, -- Most frequent incorrect responses

  -- User segment analysis
  performance_by_class JSON, -- Performance breakdown by class level
  performance_by_board JSON, -- Performance breakdown by board

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_question_date (question_id, date_recorded),
  INDEX idx_question_performance (question_id, date_recorded),

  FOREIGN KEY (question_id) REFERENCES practest_question_bank(id) ON DELETE CASCADE
);

-- Curriculum Structure - Hierarchical topic organization
CREATE TABLE practest_curriculum_structure (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),

  -- Hierarchy levels
  board ENUM('CBSE', 'ICSE', 'STATE_UP', 'STATE_MH', 'STATE_TN') NOT NULL,
  class_level INT NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  subject VARCHAR(100) NOT NULL,
  chapter VARCHAR(200) NOT NULL,
  chapter_order INT NOT NULL,
  topic VARCHAR(200) NOT NULL,
  topic_order INT NOT NULL,
  subtopic VARCHAR(200),
  subtopic_order INT,

  -- Content metadata
  description TEXT,
  learning_objectives JSON, -- Array of learning objectives
  prerequisites JSON, -- Array of prerequisite topics
  estimated_duration_hours DECIMAL(4,2),

  -- NCERT alignment
  ncert_chapter_reference VARCHAR(100),
  ncert_page_numbers VARCHAR(50),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY unique_curriculum_path (board, class_level, subject, chapter, topic, subtopic),
  INDEX idx_curriculum_hierarchy (board, class_level, subject, chapter_order, topic_order),
  INDEX idx_active_curriculum (is_active, board, class_level, subject)
);
