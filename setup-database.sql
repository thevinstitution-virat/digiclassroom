-- VG Kosh Google Drive Integration Database Setup
-- Execute this script to create all required tables for the materials management system

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS virat_gyankosh;
USE virat_gyankosh;

-- Enhanced Materials Table with Google Drive Integration
CREATE TABLE IF NOT EXISTS materials (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('notes', 'summaries', 'mind_maps', 'quizzes', 'textbooks', 'reference') NOT NULL,
    board ENUM('CBSE', 'ICSE', 'STATE_BOARD') NOT NULL,
    medium ENUM('ENGLISH', 'HINDI') NOT NULL,
    class TINYINT NOT NULL CHECK (class >= 1 AND class <= 12),
    stream ENUM('HUMANITIES', 'BIOLOGY', 'MATHEMATICS', 'COMMERCE') NULL,
    subject VARCHAR(100) NOT NULL,
    sm_type ENUM('Chapter Notes', 'Important Terms & Formula Sheet', 'Exam Ready Material', 'PYQs (Previous Year Questions)', 'NCERT Insights') DEFAULT 'Chapter Notes',
    
    -- Google Drive Integration Fields
    google_drive_file_id VARCHAR(255) NOT NULL UNIQUE,
    google_drive_folder_id VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    
    -- URLs and Access
    download_url TEXT,
    view_url TEXT,
    thumbnail_url TEXT,
    
    -- Analytics and Metadata
    download_count INT DEFAULT 0,
    view_count INT DEFAULT 0,
    tags JSON,
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
    
    -- Enhanced Metadata
    metadata JSON,
    
    -- Status and Workflow
    status ENUM('draft', 'pending_review', 'approved', 'rejected', 'archived') DEFAULT 'draft',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit Fields
    created_by VARCHAR(36),
    approved_by VARCHAR(36),
    rejected_by VARCHAR(36),
    approved_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_board_class_subject (board, class, subject),
    INDEX idx_type (type),
    INDEX idx_active (is_active),
    INDEX idx_status (status),
    INDEX idx_stream (stream),
    INDEX idx_google_drive_file_id (google_drive_file_id),
    INDEX idx_google_drive_folder_id (google_drive_folder_id),
    FULLTEXT INDEX idx_search (title, description, subject)
);

-- Google Drive Folders Management Table
CREATE TABLE IF NOT EXISTS google_drive_folders (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    folder_id VARCHAR(255) NOT NULL UNIQUE,
    folder_name VARCHAR(255) NOT NULL,
    parent_folder_id VARCHAR(255),
    folder_path TEXT NOT NULL,
    
    -- Categorization
    board ENUM('CBSE', 'ICSE', 'STATE_BOARD'),
    class TINYINT CHECK (class >= 1 AND class <= 12),
    subject VARCHAR(100),
    material_type ENUM('notes', 'summaries', 'mind_maps', 'quizzes', 'textbooks', 'reference'),
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_folder_id (folder_id),
    INDEX idx_parent_folder_id (parent_folder_id),
    INDEX idx_folder_path (folder_path(255)),
    INDEX idx_board_class_subject_type (board, class, subject, material_type)
);

-- Material Upload Sessions (for batch processing)
CREATE TABLE IF NOT EXISTS material_upload_sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_name VARCHAR(255) NOT NULL,
    uploaded_by VARCHAR(36) NOT NULL,
    
    -- Upload Statistics
    total_files INT DEFAULT 0,
    processed_files INT DEFAULT 0,
    successful_uploads INT DEFAULT 0,
    failed_uploads INT DEFAULT 0,
    
    -- Status
    status ENUM('in_progress', 'completed', 'failed', 'cancelled') DEFAULT 'in_progress',
    
    -- Metadata
    upload_metadata JSON,
    error_log JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_uploaded_by (uploaded_by),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Material Upload Session Files (individual file tracking)
CREATE TABLE IF NOT EXISTS material_upload_session_files (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id VARCHAR(36) NOT NULL,
    material_id VARCHAR(36),
    
    -- File Information
    original_filename VARCHAR(255) NOT NULL,
    google_drive_file_id VARCHAR(255),
    file_size BIGINT,
    
    -- Processing Status
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    
    -- Metadata
    processing_metadata JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES material_upload_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL,
    
    INDEX idx_session_id (session_id),
    INDEX idx_material_id (material_id),
    INDEX idx_status (status),
    INDEX idx_google_drive_file_id (google_drive_file_id)
);

-- User Material Access Log (for analytics and tracking)
CREATE TABLE IF NOT EXISTS user_material_access (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    material_id VARCHAR(36),
    access_type ENUM('view', 'download', 'browse', 'upload') NOT NULL,
    filter_data JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_material_id (material_id),
    INDEX idx_access_type (access_type),
    INDEX idx_created_at (created_at)
);

-- Material Approval Log (for audit trail)
CREATE TABLE IF NOT EXISTS material_approval_log (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    material_id VARCHAR(36) NOT NULL,
    admin_id VARCHAR(36) NOT NULL,
    action ENUM('approve', 'reject') NOT NULL,
    comments TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_material_id (material_id),
    INDEX idx_admin_id (admin_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

-- Notifications Table (for user notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSON,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- Google Drive Configuration Table
CREATE TABLE IF NOT EXISTS google_drive_config (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'main',
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    scope TEXT,
    expiry_date TIMESTAMP NOT NULL,
    configured_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_configured_by (configured_by),
    INDEX idx_expiry_date (expiry_date)
);

-- Admin Activity Log Table
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    admin_id VARCHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_admin_id (admin_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

-- User Profiles Table (if not exists)
CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL UNIQUE,
    board ENUM('CBSE', 'ICSE', 'STATE_BOARD') NOT NULL,
    medium ENUM('ENGLISH', 'HINDI') NOT NULL,
    class TINYINT NOT NULL CHECK (class >= 1 AND class <= 12),
    stream ENUM('HUMANITIES', 'BIOLOGY', 'MATHEMATICS', 'COMMERCE') NULL,
    is_onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_board_class (board, class)
);

-- Insert sample data for testing
INSERT IGNORE INTO user_profiles (user_id, board, medium, class, stream, is_onboarding_complete) VALUES
('user_2yi9QK4dLkbW8dpwS3FlEFkUMD6', 'CBSE', 'ENGLISH', 10, NULL, TRUE);

SELECT 'Database setup completed successfully!' as status;
