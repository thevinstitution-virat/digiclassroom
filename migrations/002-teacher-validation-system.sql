-- Migration: Teacher Validation System
-- Phase 2: Add teacher approval workflow and related tables

-- ============================================================================
-- 1. ALTER USERS TABLE - Add Teacher Approval Fields
-- ============================================================================

ALTER TABLE users 
ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' AFTER role,
ADD COLUMN approved_by VARCHAR(36) NULL AFTER approval_status,
ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by,
ADD COLUMN rejection_reason TEXT NULL AFTER approved_at,
ADD INDEX idx_approval_status (approval_status),
ADD INDEX idx_role_approval (role, approval_status);

-- ============================================================================
-- 2. TEACHER CLASS ASSIGNMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_class_assignments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    teacher_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    assigned_by VARCHAR(36) NOT NULL, -- Admin who made the assignment
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    removed_at TIMESTAMP NULL,
    removed_by VARCHAR(36) NULL,
    
    INDEX idx_teacher_id (teacher_id),
    INDEX idx_class_id (class_id),
    INDEX idx_active (is_active),
    UNIQUE KEY unique_teacher_class (teacher_id, class_id),
    
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (removed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. TEACHER ACTIVITY LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_activity_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    teacher_id VARCHAR(36) NOT NULL,
    activity_type ENUM(
        'class_created',
        'class_updated',
        'class_deleted',
        'student_assigned',
        'student_removed',
        'content_validated',
        'content_approved',
        'content_rejected',
        'login',
        'profile_updated'
    ) NOT NULL,
    activity_description TEXT,
    metadata JSON, -- Additional context (class_id, student_id, content_id, etc.)
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_teacher_id (teacher_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_created_at (created_at),
    INDEX idx_teacher_activity (teacher_id, activity_type, created_at),
    
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. CONTENT VALIDATION QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_validation_queue (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    content_id VARCHAR(36) NOT NULL,
    content_type ENUM('ai_answer', 'quiz_question', 'explanation', 'summary') NOT NULL,
    content_text TEXT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    grade_level INT NOT NULL,
    board VARCHAR(50) DEFAULT 'CBSE',
    
    -- Validation status
    validation_status ENUM('pending', 'approved', 'rejected', 'needs_improvement') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    
    -- Assignment
    assigned_to VARCHAR(36) NULL, -- Teacher ID
    assigned_at TIMESTAMP NULL,
    
    -- Validation details
    validated_by VARCHAR(36) NULL, -- Teacher ID who validated
    validated_at TIMESTAMP NULL,
    validation_score INT NULL CHECK (validation_score BETWEEN 0 AND 100),
    feedback TEXT NULL,
    improvement_notes TEXT NULL,
    
    -- Metadata
    source_metadata JSON, -- Original question, context, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_validation_status (validation_status),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_validated_by (validated_by),
    INDEX idx_priority (priority),
    INDEX idx_subject_grade (subject, grade_level),
    INDEX idx_queue_status (validation_status, priority, created_at),
    
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. TEACHER STATISTICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW teacher_statistics AS
SELECT 
    u.id AS teacher_id,
    u.clerk_id,
    u.email,
    CONCAT(u.first_name, ' ', u.last_name) AS teacher_name,
    u.approval_status,
    u.approved_at,
    
    -- Class statistics
    COUNT(DISTINCT tca.class_id) AS total_classes,
    
    -- Student statistics
    (SELECT COUNT(DISTINCT us.id) 
     FROM users us 
     JOIN classes c ON us.class_id = c.id 
     JOIN teacher_class_assignments tca2 ON c.id = tca2.class_id 
     WHERE tca2.teacher_id = u.id AND tca2.is_active = TRUE
    ) AS total_students,
    
    -- Activity statistics
    (SELECT COUNT(*) 
     FROM teacher_activity_logs tal 
     WHERE tal.teacher_id = u.id
    ) AS total_activities,
    
    -- Validation statistics
    (SELECT COUNT(*) 
     FROM content_validation_queue cvq 
     WHERE cvq.validated_by = u.id
    ) AS total_validations,
    
    (SELECT COUNT(*) 
     FROM content_validation_queue cvq 
     WHERE cvq.validated_by = u.id AND cvq.validation_status = 'approved'
    ) AS approved_validations,
    
    -- Last activity
    (SELECT MAX(created_at) 
     FROM teacher_activity_logs tal 
     WHERE tal.teacher_id = u.id
    ) AS last_activity_at
    
FROM users u
LEFT JOIN teacher_class_assignments tca ON u.id = tca.teacher_id AND tca.is_active = TRUE
WHERE u.role = 'teacher'
GROUP BY u.id, u.clerk_id, u.email, u.first_name, u.last_name, u.approval_status, u.approved_at;

-- ============================================================================
-- 6. INSERT SAMPLE DATA (for testing)
-- ============================================================================

-- Note: Sample data will be added via API endpoints in production
-- This is just for development/testing purposes

-- ============================================================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_users_role_status_created ON users(role, approval_status, created_at);
CREATE INDEX idx_validation_queue_teacher_status ON content_validation_queue(assigned_to, validation_status);
CREATE INDEX idx_activity_logs_teacher_date ON teacher_activity_logs(teacher_id, created_at DESC);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

