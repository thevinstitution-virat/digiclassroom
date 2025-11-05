-- =====================================================
-- A/B Testing Infrastructure Schema
-- DigiClassroom Pro Validation System
-- =====================================================
-- Purpose: Track experiments, user assignments, and results
-- Created: 2025-10-31
-- =====================================================

-- =====================================================
-- Table 1: experiments
-- Stores experiment configurations and metadata
-- =====================================================

CREATE TABLE IF NOT EXISTS experiments (
  -- Primary Key
  experiment_id VARCHAR(36) PRIMARY KEY,
  
  -- Experiment Details
  experiment_name VARCHAR(255) NOT NULL,
  experiment_type ENUM(
    'embedding_model',
    'chunk_count',
    'retrieval_strategy',
    'prompt_variation',
    'custom'
  ) NOT NULL,
  description TEXT,
  hypothesis TEXT,
  
  -- Variant Configuration
  variant_a_config JSON NOT NULL COMMENT 'Control variant configuration',
  variant_b_config JSON NOT NULL COMMENT 'Treatment variant configuration',
  
  -- Traffic Split
  traffic_split_percentage INT DEFAULT 50 COMMENT 'Percentage of traffic to variant B (0-100)',
  
  -- Status
  status ENUM('draft', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
  
  -- Success Criteria
  primary_metric VARCHAR(100) NOT NULL COMMENT 'e.g., rating, faithfulness_score, cost_per_query',
  secondary_metrics JSON COMMENT 'Array of secondary metrics to track',
  success_threshold DECIMAL(5, 3) COMMENT 'Minimum improvement to consider success',
  min_sample_size INT DEFAULT 100 COMMENT 'Minimum samples per variant',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  
  -- Metadata
  created_by VARCHAR(36) COMMENT 'User ID who created the experiment',
  notes TEXT,
  
  -- Indexes
  INDEX idx_status (status),
  INDEX idx_type (experiment_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='A/B testing experiments configuration';

-- =====================================================
-- Table 2: experiment_assignments
-- Tracks which users are assigned to which variant
-- =====================================================

CREATE TABLE IF NOT EXISTS experiment_assignments (
  -- Primary Key
  assignment_id VARCHAR(36) PRIMARY KEY,
  
  -- Foreign Keys
  experiment_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  
  -- Assignment Details
  variant ENUM('A', 'B') NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Assignment Method
  assignment_method ENUM('hash', 'random', 'manual') DEFAULT 'hash',
  hash_value INT COMMENT 'Hash value used for assignment',
  
  -- Indexes
  INDEX idx_experiment_user (experiment_id, user_id),
  INDEX idx_user (user_id),
  INDEX idx_variant (variant),
  
  -- Foreign Key Constraints
  FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id) ON DELETE CASCADE,
  
  -- Unique constraint: one assignment per user per experiment
  UNIQUE KEY unique_user_experiment (experiment_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User assignments to experiment variants';

-- =====================================================
-- Table 3: experiment_results
-- Aggregated results for each experiment variant
-- =====================================================

CREATE TABLE IF NOT EXISTS experiment_results (
  -- Primary Key
  result_id VARCHAR(36) PRIMARY KEY,
  
  -- Foreign Keys
  experiment_id VARCHAR(36) NOT NULL,
  
  -- Variant
  variant ENUM('A', 'B') NOT NULL,
  
  -- Sample Size
  sample_size INT DEFAULT 0,
  
  -- Primary Metric Statistics
  metric_name VARCHAR(100) NOT NULL,
  metric_mean DECIMAL(10, 4),
  metric_std DECIMAL(10, 4),
  metric_min DECIMAL(10, 4),
  metric_max DECIMAL(10, 4),
  
  -- Statistical Test Results
  t_statistic DECIMAL(10, 4),
  p_value DECIMAL(10, 6),
  is_significant BOOLEAN DEFAULT FALSE,
  confidence_interval_lower DECIMAL(10, 4),
  confidence_interval_upper DECIMAL(10, 4),
  
  -- Secondary Metrics (JSON)
  secondary_metrics_stats JSON COMMENT 'Statistics for secondary metrics',
  
  -- Timestamps
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_experiment (experiment_id),
  INDEX idx_variant (variant),
  
  -- Foreign Key Constraints
  FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id) ON DELETE CASCADE,
  
  -- Unique constraint: one result per experiment per variant per metric
  UNIQUE KEY unique_experiment_variant_metric (experiment_id, variant, metric_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Aggregated experiment results and statistical analysis';

-- =====================================================
-- Update answer_feedback table to track experiments
-- =====================================================

-- Add experiment_id column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'answer_feedback';
SET @columnname = 'experiment_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(36) NULL COMMENT ''A/B test experiment ID''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add experiment_variant column if it doesn't exist
SET @columnname = 'experiment_variant';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' ENUM(''A'', ''B'') NULL COMMENT ''Which variant was used''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add index if it doesn't exist
SET @indexname = 'idx_experiment';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX ', @indexname, ' (experiment_id, experiment_variant)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- =====================================================
-- Sample Data: Example Experiment
-- =====================================================

INSERT IGNORE INTO experiments (
  experiment_id,
  experiment_name,
  experiment_type,
  description,
  hypothesis,
  variant_a_config,
  variant_b_config,
  traffic_split_percentage,
  status,
  primary_metric,
  secondary_metrics,
  success_threshold,
  min_sample_size,
  created_by,
  notes
) VALUES (
  'exp-001-embedding-model',
  'Embedding Model Comparison: 3-large vs 3-small',
  'embedding_model',
  'Test if text-embedding-3-small can replace text-embedding-3-large with acceptable quality',
  'H0: text-embedding-3-small performs the same as text-embedding-3-large. H1: text-embedding-3-small has lower quality but acceptable performance.',
  JSON_OBJECT(
    'model', 'text-embedding-3-large',
    'dimensions', 3072,
    'cost_per_1k_tokens', 0.00013
  ),
  JSON_OBJECT(
    'model', 'text-embedding-3-small',
    'dimensions', 1536,
    'cost_per_1k_tokens', 0.00002
  ),
  50,
  'draft',
  'faithfulness_score',
  JSON_ARRAY('rating', 'relevance_score', 'response_time_ms', 'cost_per_query'),
  0.05,
  393,
  'system',
  'Expected 85% cost reduction. Acceptable if faithfulness drop is < 0.05'
);

-- =====================================================
-- Views for Easy Querying
-- =====================================================

-- View: Active experiments with sample sizes
CREATE OR REPLACE VIEW v_active_experiments AS
SELECT 
  e.experiment_id,
  e.experiment_name,
  e.experiment_type,
  e.status,
  e.primary_metric,
  e.min_sample_size,
  COUNT(DISTINCT CASE WHEN ea.variant = 'A' THEN ea.user_id END) as variant_a_users,
  COUNT(DISTINCT CASE WHEN ea.variant = 'B' THEN ea.user_id END) as variant_b_users,
  COUNT(DISTINCT CASE WHEN af.experiment_variant = 'A' THEN af.id END) as variant_a_samples,
  COUNT(DISTINCT CASE WHEN af.experiment_variant = 'B' THEN af.id END) as variant_b_samples,
  e.started_at,
  DATEDIFF(NOW(), e.started_at) as days_running
FROM experiments e
LEFT JOIN experiment_assignments ea ON e.experiment_id = ea.experiment_id
LEFT JOIN answer_feedback af ON e.experiment_id = af.experiment_id
WHERE e.status = 'active'
GROUP BY e.experiment_id;

-- View: Experiment performance comparison
CREATE OR REPLACE VIEW v_experiment_comparison AS
SELECT 
  e.experiment_id,
  e.experiment_name,
  e.primary_metric,
  ra.metric_mean as variant_a_mean,
  rb.metric_mean as variant_b_mean,
  (rb.metric_mean - ra.metric_mean) as absolute_difference,
  ((rb.metric_mean - ra.metric_mean) / ra.metric_mean * 100) as percent_change,
  ra.p_value,
  ra.is_significant,
  ra.sample_size as variant_a_samples,
  rb.sample_size as variant_b_samples
FROM experiments e
LEFT JOIN experiment_results ra ON e.experiment_id = ra.experiment_id AND ra.variant = 'A'
LEFT JOIN experiment_results rb ON e.experiment_id = rb.experiment_id AND rb.variant = 'B'
WHERE e.status IN ('active', 'completed');

-- =====================================================
-- Success Message
-- =====================================================

SELECT 'A/B Testing Schema Created Successfully!' as message,
       '3 tables created: experiments, experiment_assignments, experiment_results' as details,
       '2 views created: v_active_experiments, v_experiment_comparison' as views,
       'answer_feedback table updated with experiment tracking columns' as updates;

