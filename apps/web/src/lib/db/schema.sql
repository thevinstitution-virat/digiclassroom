-- Virat Gyankosh Database Schema
-- Multi-tenant educational platform with enhanced architecture

-- Enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS virat_gyankosh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE virat_gyankosh;

-- Tenants table for multi-tenancy
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    subscription_plan ENUM('starter', 'pro', 'enterprise') NOT NULL DEFAULT 'starter',
    subscription_status ENUM('active', 'inactive', 'trial') NOT NULL DEFAULT 'trial',
    settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_domain (domain),
    INDEX idx_subscription (subscription_plan, subscription_status)
);

-- Users table with role-based access control
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    clerk_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    role ENUM('admin', 'teacher', 'student', 'parent') NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    class_id VARCHAR(36),
    profile_image_url TEXT,
    preferences JSON,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tenant_email (tenant_id, email),
    INDEX idx_tenant_role (tenant_id, role),
    INDEX idx_clerk_id (clerk_id),
    INDEX idx_class_id (class_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Classes table for content organization
CREATE TABLE IF NOT EXISTS classes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    grade_level INT NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
    qdrant_namespace VARCHAR(255) NOT NULL,
    subjects JSON, -- Array of subjects
    teacher_ids JSON, -- Array of teacher IDs
    student_count INT DEFAULT 0,
    settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_grade (tenant_id, grade_level),
    INDEX idx_qdrant_namespace (qdrant_namespace),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Content table for educational materials
CREATE TABLE IF NOT EXISTS content (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    title VARCHAR(500) NOT NULL,
    content LONGTEXT NOT NULL,
    content_type ENUM('lesson', 'exercise', 'assessment', 'resource') NOT NULL,
    subject VARCHAR(100) NOT NULL,
    difficulty ENUM('beginner', 'intermediate', 'advanced'),
    tags JSON, -- Array of tags
    metadata JSON,
    vector_id VARCHAR(255), -- Qdrant vector ID
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_class (tenant_id, class_id),
    INDEX idx_subject (subject),
    INDEX idx_content_type (content_type),
    INDEX idx_vector_id (vector_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Pipeline metrics table for PDF processing monitoring
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

-- Vector embeddings mapping for Qdrant integration
CREATE TABLE IF NOT EXISTS vector_embeddings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    content_id VARCHAR(36) NOT NULL,
    qdrant_id VARCHAR(255) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    subject VARCHAR(100),
    chunk_index INT DEFAULT 0,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_class (tenant_id, class_id),
    INDEX idx_qdrant_id (qdrant_id),
    INDEX idx_namespace (namespace),
    INDEX idx_content_id (content_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Chat sessions for conversation history
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    title VARCHAR(255),
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_tenant (user_id, tenant_id),
    INDEX idx_class_id (class_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Chat messages for conversation storage
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id VARCHAR(36) NOT NULL,
    role ENUM('user', 'assistant', 'system') NOT NULL,
    content LONGTEXT NOT NULL,
    metadata JSON,
    agent_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Learning progress tracking
CREATE TABLE IF NOT EXISTS learning_progress (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    content_id VARCHAR(36) NOT NULL,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (progress_percentage BETWEEN 0 AND 100),
    time_spent_minutes INT DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed BOOLEAN DEFAULT FALSE,
    completion_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_content (user_id, content_id),
    INDEX idx_user_class (user_id, class_id),
    INDEX idx_tenant_class (tenant_id, class_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Assessments table
CREATE TABLE IF NOT EXISTS assessments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    questions JSON NOT NULL, -- Array of question objects
    total_points INT DEFAULT 0,
    time_limit_minutes INT,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_class (tenant_id, class_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Assessment submissions
CREATE TABLE IF NOT EXISTS assessment_submissions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    assessment_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    answers JSON NOT NULL, -- Array of answer objects
    score DECIMAL(5,2),
    max_score DECIMAL(5,2),
    time_taken_minutes INT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    graded_at TIMESTAMP NULL,
    graded_by VARCHAR(36),
    feedback TEXT,
    INDEX idx_assessment_user (assessment_id, user_id),
    INDEX idx_user_tenant (user_id, tenant_id),
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Analytics events for tracking user interactions
CREATE TABLE IF NOT EXISTS analytics_events (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36),
    tenant_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSON,
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_tenant (user_id, tenant_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Add foreign key constraint for users.class_id after classes table is created
ALTER TABLE users ADD CONSTRAINT fk_users_class_id_dcp FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
