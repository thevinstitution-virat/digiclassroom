-- Migration: Add pipeline_metrics table
-- Date: 2025-11-03
-- Description: Creates pipeline_metrics table for tracking PDF processing metrics

USE virat_gyankosh;

-- Create pipeline_metrics table
CREATE TABLE IF NOT EXISTS pipeline_metrics (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    pdf_id VARCHAR(255) NOT NULL,
    strategy ENUM('auto', 'text_only', 'ocr_only', 'hybrid') NOT NULL,
    
    -- Extraction metrics
    pages_processed INT NOT NULL,
    extraction_time_ms INT NOT NULL,
    text_quality_score DECIMAL(3,2),
    fallback_triggered BOOLEAN DEFAULT FALSE,
    
    -- Chunking metrics
    chunks_created INT NOT NULL,
    chunks_validated INT NOT NULL,
    chunks_failed INT NOT NULL,
    validation_rate DECIMAL(5,4),
    
    -- Performance metrics
    total_time_ms INT NOT NULL,
    embedding_time_ms INT,
    indexing_time_ms INT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tenant_pdf (tenant_id, pdf_id),
    INDEX idx_strategy (strategy),
    INDEX idx_created_at (created_at),
    INDEX idx_validation_rate (validation_rate),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Verify table was created
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'virat_gyankosh'
AND TABLE_NAME = 'pipeline_metrics';

-- Show table structure
DESCRIBE pipeline_metrics;

-- Success message
SELECT 'Pipeline metrics table created successfully!' AS status;

