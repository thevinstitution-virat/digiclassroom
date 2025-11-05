-- Materials Dashboard Database Schema
-- Enhanced user profiles and materials management for VG Kosh

-- Enhanced User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    clerk_id VARCHAR(255) NOT NULL UNIQUE,
    role ENUM('admin', 'teacher', 'student', 'parent', 'guardian') NOT NULL,
    board ENUM('CBSE', 'ICSE', 'STATE_BOARD') NOT NULL,
    medium ENUM('ENGLISH', 'HINDI') NOT NULL,
    class TINYINT NOT NULL CHECK (class >= 1 AND class <= 12),
    stream ENUM('HUMANITIES', 'BIOLOGY', 'MATHEMATICS', 'COMMERCE') NULL,
    subjects JSON NULL,
    is_onboarding_complete BOOLEAN DEFAULT FALSE,
    preferences JSON DEFAULT '{}',
    subscription_plan ENUM('starter', 'pro', 'enterprise') DEFAULT 'starter',
    subscription_features JSON DEFAULT '[]',
    subscription_expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_clerk_id (clerk_id),
    INDEX idx_board_class (board, class),
    INDEX idx_onboarding (is_onboarding_complete),
    
    -- Constraint: stream is required for classes 11-12
    CONSTRAINT chk_stream_for_senior_classes 
        CHECK ((class < 11) OR (class >= 11 AND stream IS NOT NULL))
);

-- Materials Table (Enhanced for Google Drive Integration)
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
    tags JSON DEFAULT '[]',
    difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',

    -- Enhanced Metadata
    metadata JSON DEFAULT '{}', -- Contains: pageCount, language, author, publisher, etc.

    -- Status and Workflow
    status ENUM('draft', 'pending_review', 'approved', 'rejected', 'archived') DEFAULT 'draft',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_board_class_subject (board, class, subject),
    INDEX idx_type (type),
    INDEX idx_active (is_active),
    INDEX idx_status (status),
    INDEX idx_stream (stream),
    INDEX idx_google_drive_file_id (google_drive_file_id),
    INDEX idx_google_drive_folder_id (google_drive_folder_id),
    FULLTEXT INDEX idx_search (title, description, subject)
);

-- User Material Access Log
CREATE TABLE IF NOT EXISTS user_material_access (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL,
    material_id VARCHAR(36) NOT NULL,
    access_type ENUM('view', 'download', 'share') NOT NULL,
    access_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    INDEX idx_user_material (user_id, material_id),
    INDEX idx_access_timestamp (access_timestamp),
    INDEX idx_access_type (access_type),
    
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- Material Categories (for better organization)
CREATE TABLE IF NOT EXISTS material_categories (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id VARCHAR(36) NULL,
    board ENUM('CBSE', 'ICSE', 'STATE_BOARD') NOT NULL,
    class TINYINT NOT NULL CHECK (class >= 1 AND class <= 12),
    subject VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_board_class_subject (board, class, subject),
    INDEX idx_parent (parent_id),
    INDEX idx_active (is_active),
    
    FOREIGN KEY (parent_id) REFERENCES material_categories(id) ON DELETE SET NULL
);

-- Material Category Mapping
CREATE TABLE IF NOT EXISTS material_category_mapping (
    material_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    
    PRIMARY KEY (material_id, category_id),
    
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES material_categories(id) ON DELETE CASCADE
);

-- User Favorites
CREATE TABLE IF NOT EXISTS user_favorites (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL,
    material_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_material (user_id, material_id),
    INDEX idx_user_id (user_id),
    
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- User Reading Progress
CREATE TABLE IF NOT EXISTS user_reading_progress (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL,
    material_id VARCHAR(36) NOT NULL,
    current_page INT DEFAULT 1,
    total_pages INT,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reading_time_minutes INT DEFAULT 0,
    
    UNIQUE KEY unique_user_material_progress (user_id, material_id),
    INDEX idx_user_id (user_id),
    INDEX idx_last_read (last_read_at),
    
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

-- Google Drive Integration Settings
CREATE TABLE IF NOT EXISTS google_drive_settings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    folder_id VARCHAR(255) NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    board ENUM('CBSE', 'ICSE', 'STATE_BOARD') NOT NULL,
    class TINYINT NOT NULL CHECK (class >= 1 AND class <= 12),
    subject VARCHAR(100) NOT NULL,
    stream ENUM('HUMANITIES', 'BIOLOGY', 'MATHEMATICS', 'COMMERCE') NULL,
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_folder_mapping (board, class, subject, stream),
    INDEX idx_folder_id (folder_id),
    INDEX idx_sync_enabled (sync_enabled)
);

-- Insert default categories for CBSE
INSERT IGNORE INTO material_categories (id, name, description, board, class, subject, sort_order) VALUES
-- Class 10 CBSE
(UUID(), 'Chapter Notes', 'Detailed chapter-wise notes', 'CBSE', 10, 'Mathematics', 1),
(UUID(), 'Practice Papers', 'Sample and practice question papers', 'CBSE', 10, 'Mathematics', 2),
(UUID(), 'Mind Maps', 'Visual concept maps', 'CBSE', 10, 'Mathematics', 3),
(UUID(), 'Chapter Notes', 'Detailed chapter-wise notes', 'CBSE', 10, 'Science', 1),
(UUID(), 'Lab Manual', 'Practical experiments and procedures', 'CBSE', 10, 'Science', 2),
(UUID(), 'Chapter Notes', 'Detailed chapter-wise notes', 'CBSE', 10, 'English', 1),
(UUID(), 'Literature Guide', 'Analysis of poems and prose', 'CBSE', 10, 'English', 2),
(UUID(), 'Chapter Notes', 'Detailed chapter-wise notes', 'CBSE', 10, 'Social Science', 1),
(UUID(), 'Map Work', 'Geography maps and exercises', 'CBSE', 10, 'Social Science', 2),

-- Class 11 CBSE
(UUID(), 'Chapter Notes', 'Detailed chapter-wise notes', 'CBSE', 11, 'Physics', 1),
(UUID(), 'Numerical Problems', 'Physics problem solving', 'CBSE', 11, 'Physics', 2),
(UUID(), 'Chapter Notes', 'Detailed chapter-wise notes', 'CBSE', 11, 'Chemistry', 1),
(UUID(), 'Organic Chemistry', 'Specialized organic chemistry notes', 'CBSE', 11, 'Chemistry', 2),
(UUID(), 'Chapter Notes', 'Detailed chapter-wise notes', 'CBSE', 11, 'Mathematics', 1),
(UUID(), 'Calculus', 'Differential and integral calculus', 'CBSE', 11, 'Mathematics', 2),
(UUID(), 'Chapter Notes', 'Detailed chapter-wise notes', 'CBSE', 11, 'Biology', 1),
(UUID(), 'Diagrams', 'Biological diagrams and illustrations', 'CBSE', 11, 'Biology', 2);

-- Google Drive Folders Management Table
CREATE TABLE IF NOT EXISTS google_drive_folders (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    folder_id VARCHAR(255) NOT NULL UNIQUE,
    folder_name VARCHAR(255) NOT NULL,
    parent_folder_id VARCHAR(255),
    folder_path TEXT NOT NULL, -- Full path like "CBSE/Class_10/Mathematics/notes"

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
    uploaded_by VARCHAR(36) NOT NULL, -- Clerk user ID

    -- Upload Statistics
    total_files INT DEFAULT 0,
    processed_files INT DEFAULT 0,
    successful_uploads INT DEFAULT 0,
    failed_uploads INT DEFAULT 0,

    -- Status
    status ENUM('in_progress', 'completed', 'failed', 'cancelled') DEFAULT 'in_progress',

    -- Metadata
    upload_metadata JSON DEFAULT '{}',
    error_log JSON DEFAULT '[]',

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
    material_id VARCHAR(36), -- Links to materials table after successful upload

    -- File Information
    original_filename VARCHAR(255) NOT NULL,
    google_drive_file_id VARCHAR(255),
    file_size BIGINT,

    -- Processing Status
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,

    -- Metadata
    processing_metadata JSON DEFAULT '{}',

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
    filter_data JSON DEFAULT '{}',
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
    data JSON DEFAULT '{}',
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
    details JSON DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_admin_id (admin_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);
