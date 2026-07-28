// VG Kosh Practest Engine - TypeScript Type Definitions

export type Board = 'CBSE' | 'ICSE' | 'STATE_UP' | 'STATE_MH' | 'STATE_TN'
export type QuestionType = 'MCQ' | 'SUBJECTIVE' | 'FILL_BLANK' | 'TRUE_FALSE'
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD'
export type BloomLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE'
export type CognitiveLoad = 'LOW' | 'MEDIUM' | 'HIGH'
export type ValidationStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETIRED'
export type TestSessionStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED' | 'PAUSED'
export type CorrectOption = 'A' | 'B' | 'C' | 'D'

// Core Question Interface
export interface PractestQuestion {
  id: string
  question_text: string
  question_type: QuestionType
  
  // MCQ specific fields
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  correct_option?: CorrectOption
  
  // Subjective specific fields
  model_answer?: string
  marking_rubric?: MarkingRubric
  keywords?: string[]
  
  // Common fields
  explanation: string
  max_marks: number
  time_limit_seconds: number
  
  // Multimedia support
  question_image_url?: string
  option_images?: OptionImages
  explanation_image_url?: string
  
  // Content flags
  has_math_content: boolean
  has_chemical_formulas: boolean
  has_diagrams: boolean
  
  // Curriculum metadata
  board: Board
  class_level: number
  subject: string
  chapter: string
  topic: string
  subtopic?: string
  
  // Learning taxonomy
  difficulty_level: DifficultyLevel
  bloom_level: BloomLevel
  cognitive_load: CognitiveLoad
  
  // Analytics
  usage_count: number
  correct_attempts: number
  total_attempts: number
  average_time_seconds: number
  discrimination_index: number
  difficulty_index: number
  
  // Quality assurance
  content_hash: string
  validation_status: ValidationStatus
  rejection_reason?: string

  // CASA — page-level citation (edition-pinned, anchor-resolved against the NCERT corpus)
  casa_book?: string
  casa_edition?: string
  casa_page?: number | null
  casa_anchor?: string
  casa_verified?: boolean
  
  // Authorship
  created_by: string
  reviewed_by?: string
  approved_by?: string
  
  // Timestamps
  created_at: Date
  updated_at: Date
  approved_at?: Date
}

// Supporting interfaces
export interface MarkingRubric {
  total_marks: number
  criteria: RubricCriterion[]
  partial_credit_rules: PartialCreditRule[]
}

export interface RubricCriterion {
  criterion: string
  marks: number
  description: string
}

export interface PartialCreditRule {
  condition: string
  marks_awarded: number
  description: string
}

export interface OptionImages {
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
}

// Test Configuration Interface
export interface TestConfiguration {
  id: string
  name: string
  description?: string
  
  // Curriculum scope
  board: Board
  class_level: number
  subject: string
  chapters: string[]
  topics?: string[]
  
  // Test parameters
  total_questions: 10 | 20 | 30 | 50
  duration_minutes: number
  max_marks: number
  
  // Scoring rules
  negative_marking: number
  partial_marking: boolean
  
  // Distribution strategies
  difficulty_distribution: DifficultyDistribution
  question_type_distribution?: QuestionTypeDistribution
  bloom_distribution?: BloomDistribution
  
  // Test behavior
  randomize_questions: boolean
  randomize_options: boolean
  allow_review: boolean
  show_results_immediately: boolean
  
  // Instructions
  instructions?: string
  rules?: TestRule[]
  
  // Metadata
  is_active: boolean
  is_public: boolean
  created_by: string
  created_at: Date
  updated_at: Date
}

export interface DifficultyDistribution {
  EASY: number
  MEDIUM: number
  HARD: number
}

export interface QuestionTypeDistribution {
  MCQ: number
  SUBJECTIVE?: number
  FILL_BLANK?: number
  TRUE_FALSE?: number
}

export interface BloomDistribution {
  REMEMBER: number
  UNDERSTAND: number
  APPLY: number
  ANALYZE: number
  EVALUATE: number
  CREATE: number
}

export interface TestRule {
  rule: string
  description: string
  penalty?: number
}

// Test Session Interface
export interface TestSession {
  id: string
  user_id: string
  configuration_id?: string
  custom_parameters?: CustomTestParameters
  
  // Session data
  selected_questions: string[] // Question IDs in sequence
  user_responses: UserResponse[]
  
  // Timing
  start_time: Date
  end_time?: Date
  duration_seconds?: number
  time_remaining_seconds?: number
  
  // State
  current_question_index: number
  status: TestSessionStatus
  
  // Results
  total_score: number
  max_possible_score: number
  percentage: number
  
  // Analytics
  question_wise_results: QuestionResult[]
  topic_wise_performance: TopicPerformance[]
  difficulty_wise_performance: DifficultyPerformance[]
  time_analytics: TimeAnalytics
  
  // Review
  review_completed: boolean
  feedback_submitted: boolean
  session_feedback?: string
  
  // Metadata
  ip_address?: string
  user_agent?: string
  device_info?: DeviceInfo
  
  created_at: Date
  updated_at: Date
}

export interface CustomTestParameters {
  board: Board
  class_level: number
  subject: string
  chapters: string[]
  topics?: string[]
  total_questions: number
  duration_minutes: number
  difficulty_distribution: DifficultyDistribution
}

export interface UserResponse {
  question_id: string
  selected_option?: CorrectOption
  text_answer?: string
  is_correct: boolean
  marks_awarded: number
  time_spent_seconds: number
  timestamp: Date
  is_skipped: boolean
  confidence_level?: number // 1-5 scale
}

export interface QuestionResult {
  question_id: string
  question_text: string
  user_answer: string
  correct_answer: string
  is_correct: boolean
  marks_awarded: number
  max_marks: number
  time_spent_seconds: number
  difficulty_level: DifficultyLevel
  topic: string
  explanation: string
}

export interface TopicPerformance {
  topic: string
  questions_attempted: number
  questions_correct: number
  total_marks: number
  marks_scored: number
  accuracy_percentage: number
  average_time_seconds: number
}

export interface DifficultyPerformance {
  difficulty: DifficultyLevel
  questions_attempted: number
  questions_correct: number
  accuracy_percentage: number
  average_time_seconds: number
}

export interface TimeAnalytics {
  total_time_seconds: number
  average_time_per_question: number
  fastest_question_time: number
  slowest_question_time: number
  time_distribution_by_difficulty: Record<DifficultyLevel, number>
  time_distribution_by_topic: Record<string, number>
}

export interface DeviceInfo {
  platform: string
  browser: string
  screen_resolution: string
  is_mobile: boolean
}

// Curriculum Structure Interface
export interface CurriculumStructure {
  id: string
  board: Board
  class_level: number
  subject: string
  chapter: string
  chapter_order: number
  topic: string
  topic_order: number
  subtopic?: string
  subtopic_order?: number
  
  description?: string
  learning_objectives: string[]
  prerequisites: string[]
  estimated_duration_hours: number
  
  ncert_chapter_reference?: string
  ncert_page_numbers?: string
  
  is_active: boolean
  created_at: Date
  updated_at: Date
}

// API Request/Response Types
export interface GenerateTestRequest {
  board: Board
  class_level: number
  subject: string
  chapters: string[]
  topics?: string[]
  total_questions: 10 | 20 | 30 | 50
  difficulty_distribution?: DifficultyDistribution
  use_configuration_id?: string
}

export interface GenerateTestResponse {
  success: boolean
  session_id: string
  questions: PractestQuestion[]
  test_metadata: TestMetadata
  error?: string
}

export interface TestMetadata {
  total_questions: number
  duration_minutes: number
  max_marks: number
  difficulty_distribution: DifficultyDistribution
  topic_distribution: Record<string, number>
  instructions: string[]
}

export interface SubmitAnswerRequest {
  session_id: string
  question_id: string
  answer: string | CorrectOption
  time_spent_seconds: number
  confidence_level?: number
}

export interface SubmitAnswerResponse {
  success: boolean
  is_correct?: boolean
  marks_awarded?: number
  next_question_id?: string
  test_completed?: boolean
  error?: string
}

export interface TestResultsResponse {
  success: boolean
  session_id: string
  total_score: number
  percentage: number
  question_results: QuestionResult[]
  topic_performance: TopicPerformance[]
  difficulty_performance: DifficultyPerformance[]
  time_analytics: TimeAnalytics
  recommendations: string[]
  error?: string
}
