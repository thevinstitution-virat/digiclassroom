-- User Notes (Sanchika) Database Schema
-- Migration: 002_user_notes_sanchika
-- Created: 2025-01-18
-- Purpose: Personal notes system for students to save AI Tutor answers

-- User Notes Table
CREATE TABLE IF NOT EXISTS user_notes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL,
    clerk_id VARCHAR(255) NOT NULL,
    
    -- Note Content
    title VARCHAR(500) NOT NULL,
    content LONGTEXT NOT NULL,
    
    -- Educational Context
    subject VARCHAR(100),
    chapter VARCHAR(255),
    board ENUM('CBSE', 'ICSE', 'STATE_BOARD'),
    class_level VARCHAR(20),
    
    -- Note Metadata
    orientation ENUM('portrait', 'landscape') DEFAULT 'portrait',
    tags JSON, -- Array of tags for organization

    -- Source Information (if created from AI Tutor)
    source_type ENUM('ai_tutor', 'manual', 'imported') DEFAULT 'manual',
    source_query TEXT, -- Original question asked to AI Tutor
    source_answer LONGTEXT, -- Original AI Tutor answer
    source_visualizations JSON, -- Visualizations from AI Tutor
    
    -- Organization
    folder_id VARCHAR(36), -- For future folder organization
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_user_notes (user_id, created_at DESC),
    INDEX idx_clerk_notes (clerk_id, created_at DESC),
    INDEX idx_subject_class (subject, class_level),
    INDEX idx_source_type (source_type),
    INDEX idx_favorite (is_favorite, user_id),
    INDEX idx_archived (is_archived, user_id),
    INDEX idx_folder (folder_id)
);

-- Note Folders Table (for future organization)
CREATE TABLE IF NOT EXISTS note_folders (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(255) NOT NULL,
    clerk_id VARCHAR(255) NOT NULL,
    
    -- Folder Details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT 'blue', -- For UI color coding
    icon VARCHAR(50) DEFAULT 'folder', -- Icon name
    
    -- Hierarchy
    parent_folder_id VARCHAR(36), -- For nested folders
    folder_path TEXT, -- Full path like "Mathematics/Algebra/Equations"
    
    -- Organization
    sort_order INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_user_folders (user_id, sort_order),
    INDEX idx_parent_folder (parent_folder_id),
    
    -- Foreign Keys
    FOREIGN KEY (parent_folder_id) REFERENCES note_folders(id) ON DELETE CASCADE
);

-- Note Sharing Table (for future collaboration features)
CREATE TABLE IF NOT EXISTS note_shares (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    note_id VARCHAR(36) NOT NULL,
    shared_by_user_id VARCHAR(255) NOT NULL,
    shared_with_user_id VARCHAR(255), -- NULL for public shares
    
    -- Sharing Settings
    permission ENUM('view', 'edit', 'comment') DEFAULT 'view',
    is_public BOOLEAN DEFAULT FALSE,
    share_link VARCHAR(255) UNIQUE, -- Unique share link
    
    -- Expiration
    expires_at TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_note_shares (note_id),
    INDEX idx_shared_by (shared_by_user_id),
    INDEX idx_shared_with (shared_with_user_id),
    INDEX idx_share_link (share_link),
    
    -- Foreign Keys
    FOREIGN KEY (note_id) REFERENCES user_notes(id) ON DELETE CASCADE
);

-- Note Activity Log (for tracking edits and access)
CREATE TABLE IF NOT EXISTS note_activity_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    note_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    
    -- Activity Details
    activity_type ENUM('created', 'updated', 'viewed', 'shared', 'exported', 'deleted') NOT NULL,
    changes_summary TEXT, -- Brief description of changes
    
    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_note_activity (note_id, created_at DESC),
    INDEX idx_user_activity (user_id, created_at DESC),
    INDEX idx_activity_type (activity_type),
    
    -- Foreign Keys
    FOREIGN KEY (note_id) REFERENCES user_notes(id) ON DELETE CASCADE
);

-- Note Templates Table (for future template feature)
CREATE TABLE IF NOT EXISTS note_templates (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Template Details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_content LONGTEXT NOT NULL,
    
    -- Categorization
    category ENUM('general', 'subject_notes', 'exam_prep', 'revision', 'summary') DEFAULT 'general',
    subject VARCHAR(100),
    class_level VARCHAR(20),
    
    -- Visibility
    is_public BOOLEAN DEFAULT FALSE,
    created_by_user_id VARCHAR(255), -- NULL for system templates
    
    -- Usage Stats
    usage_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_category (category),
    INDEX idx_subject_class (subject, class_level),
    INDEX idx_public_templates (is_public, usage_count DESC),
    INDEX idx_created_by (created_by_user_id)
);

-- Add sample system templates
INSERT INTO note_templates (id, name, description, template_content, category, is_public) VALUES
(UUID(), 'Blank Note', 'Start with a blank canvas', '# New Note\n\n', 'general', TRUE),
(UUID(), 'Subject Notes', 'Template for subject-specific notes', '# [Subject Name] - [Topic]\n\n## Key Concepts\n\n## Important Points\n\n## Examples\n\n## Practice Questions\n\n', 'subject_notes', TRUE),
(UUID(), 'Exam Preparation', 'Template for exam revision notes', '# Exam Preparation - [Subject]\n\n## Topics to Cover\n\n## Important Formulas\n\n## Key Definitions\n\n## Previous Year Questions\n\n## Revision Checklist\n\n', 'exam_prep', TRUE),
(UUID(), 'Quick Summary', 'Template for quick topic summaries', '# Summary: [Topic Name]\n\n## Main Idea\n\n## Key Points\n- \n- \n- \n\n## Conclusion\n\n', 'summary', TRUE);

