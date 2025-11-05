-- ============================================================================
-- Migration 004: B2C Teacher Verification System
-- ============================================================================
-- Purpose: Transform from B2B multi-tenant approval model to B2C self-service
--          verification model with progressive trust levels
-- 
-- Changes:
-- 1. Add teacher verification columns to users table
-- 2. Create teacher_verification_documents table
-- 3. Create class_join_codes table
-- 4. Create student_invitations table
-- 5. Create class_enrollments table (many-to-many)
-- 6. Create teacher_resource_usage table (B2C version)
-- 7. Migrate existing data
-- ============================================================================

USE virat_gyankosh;

-- ============================================================================
-- STEP 1: Add Verification Columns to Users Table (SKIP - Already exists)
-- ============================================================================

-- Columns already added in previous migration attempt:
-- - verification_status
-- - verification_method
-- - verified_at
-- - email_domain
-- - is_educational_domain

-- Indexes will be added manually if needed (skipping to avoid errors)

-- ============================================================================
-- STEP 2: Create Teacher Verification Documents Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_verification_documents (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    teacher_id VARCHAR(36) NOT NULL,
    clerk_id VARCHAR(255) NOT NULL,
    
    -- Document details
    document_type ENUM('school_id', 'employment_letter', 'teaching_license', 'other') NOT NULL,
    document_url VARCHAR(500) NOT NULL COMMENT 'S3/Cloud Storage URL',
    document_filename VARCHAR(255) NOT NULL,
    document_size_bytes INT NULL,
    document_mime_type VARCHAR(100) NULL,
    
    -- Verification status
    verification_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    verified_by VARCHAR(36) NULL COMMENT 'Admin user ID who verified',
    verified_at TIMESTAMP NULL,
    rejection_reason TEXT NULL,
    
    -- School information (extracted or manually entered)
    school_name VARCHAR(255) NULL,
    school_address TEXT NULL,
    school_city VARCHAR(100) NULL,
    school_state VARCHAR(100) NULL,
    school_website VARCHAR(255) NULL,
    
    -- Metadata
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_teacher (teacher_id),
    INDEX idx_clerk (clerk_id),
    INDEX idx_status (verification_status),
    INDEX idx_verified_by (verified_by),
    
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Stores teacher verification documents for document-based verification';

-- ============================================================================
-- STEP 3: Create Class Join Codes Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_join_codes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    class_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    
    -- Join code (6-8 character alphanumeric)
    join_code VARCHAR(10) NOT NULL UNIQUE COMMENT 'e.g., MATH9A, SCI10B',
    
    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    max_uses INT NULL COMMENT 'NULL = unlimited uses',
    expires_at TIMESTAMP NULL COMMENT 'NULL = never expires',
    
    -- Usage tracking
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMP NULL,
    last_used_by VARCHAR(36) NULL COMMENT 'Student user ID',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_class (class_id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_join_code (join_code),
    INDEX idx_active (is_active, expires_at),
    
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (last_used_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Join codes for self-service student enrollment (primary B2C enrollment method)';

-- ============================================================================
-- STEP 4: Create Student Invitations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_invitations (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    class_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    
    -- Invitation details
    student_email VARCHAR(255) NOT NULL,
    invitation_token VARCHAR(64) NOT NULL UNIQUE COMMENT 'Secure random token for magic link',
    
    -- Status
    status ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled') DEFAULT 'pending',
    
    -- Dates
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL COMMENT '7 days from sent',
    accepted_at TIMESTAMP NULL,
    declined_at TIMESTAMP NULL,
    
    -- Student info (filled after acceptance)
    student_id VARCHAR(36) NULL,
    
    -- Metadata
    invitation_message TEXT NULL COMMENT 'Optional personal message from teacher',
    reminder_sent_at TIMESTAMP NULL COMMENT 'When reminder email was sent',
    
    INDEX idx_class (class_id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_email_status (student_email, status),
    INDEX idx_token (invitation_token),
    INDEX idx_expires (expires_at, status),
    INDEX idx_student (student_id),
    
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Email invitations for student enrollment (Basic+ tiers only)';

-- ============================================================================
-- STEP 5: Create Class Enrollments Table (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_enrollments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    class_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL COMMENT 'Teacher who enrolled the student',
    
    -- Enrollment method
    enrollment_method ENUM('join_code', 'email_invitation', 'manual_add', 'bulk_import') NOT NULL,
    enrollment_source VARCHAR(255) NULL COMMENT 'Join code or invitation ID',
    
    -- Verification & Activity
    verification_status ENUM('unverified', 'email_verified', 'active_user') DEFAULT 'unverified',
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP NULL,
    questions_asked INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Fraud detection
    enrollment_ip VARCHAR(45) NULL COMMENT 'IP address at enrollment',
    enrollment_device_id VARCHAR(255) NULL COMMENT 'Device fingerprint',
    is_flagged_suspicious BOOLEAN DEFAULT FALSE,
    flag_reason TEXT NULL,
    flagged_at TIMESTAMP NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_class_student (class_id, student_id),
    INDEX idx_class (class_id),
    INDEX idx_student (student_id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_active (is_active, last_activity_at),
    INDEX idx_verification (verification_status),
    INDEX idx_flagged (is_flagged_suspicious),
    INDEX idx_enrollment_method (enrollment_method),
    
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Many-to-many student-class enrollments with activity tracking and fraud prevention';

-- ============================================================================
-- STEP 6: Create Teacher Resource Usage Table (B2C Version)
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_resource_usage (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    teacher_id VARCHAR(36) NOT NULL UNIQUE,
    clerk_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Current Usage
    active_classes INT DEFAULT 0 COMMENT 'Number of active classes',
    active_students INT DEFAULT 0 COMMENT 'Students with activity in last 60 days',
    total_students INT DEFAULT 0 COMMENT 'All enrolled students',
    inactive_students INT DEFAULT 0 COMMENT 'Students with 0 activity in 60+ days',
    
    -- Limits (from subscription)
    class_limit INT DEFAULT 3,
    student_limit INT DEFAULT 50,
    
    -- Enrollment rate limiting
    enrollments_today INT DEFAULT 0,
    enrollments_this_week INT DEFAULT 0,
    enrollments_this_month INT DEFAULT 0,
    last_enrollment_reset DATE DEFAULT (CURRENT_DATE),
    
    -- Fraud flags
    is_flagged_suspicious BOOLEAN DEFAULT FALSE,
    flag_reason TEXT NULL,
    flagged_at TIMESTAMP NULL,
    flagged_by VARCHAR(36) NULL COMMENT 'Admin user ID',
    
    -- Metadata
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_clerk (clerk_id),
    INDEX idx_flagged (is_flagged_suspicious),
    INDEX idx_limits (class_limit, student_limit),
    
    FOREIGN KEY (flagged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Tracks teacher resource usage and limits for B2C subscription enforcement';

-- ============================================================================
-- STEP 7: Data Migration - Auto-Approve Pending Teachers
-- ============================================================================

-- Auto-approve all pending teachers and set verification status
UPDATE users 
SET 
    approval_status = 'approved',
    verification_status = 'unverified',
    verification_method = 'self_declaration',
    updated_at = NOW()
WHERE role = 'teacher' AND approval_status = 'pending';

-- Mark existing approved teachers as manually verified (grandfathered)
UPDATE users 
SET 
    verification_status = 'verified_manual',
    verification_method = 'manual_review',
    verified_at = NOW()
WHERE role = 'teacher' AND approval_status = 'approved';

-- Extract email domains for all users
UPDATE users 
SET 
    email_domain = SUBSTRING_INDEX(email, '@', -1),
    updated_at = NOW()
WHERE email_domain IS NULL AND email IS NOT NULL;

-- Auto-detect educational domains
UPDATE users 
SET 
    is_educational_domain = TRUE,
    updated_at = NOW()
WHERE email_domain LIKE '%.edu' 
   OR email_domain LIKE '%.edu.%'
   OR email_domain LIKE '%.ac.%'
   OR email_domain LIKE '%.school%'
   OR email_domain LIKE '%.university%';

-- Auto-upgrade teachers with educational emails to verified_email status
UPDATE users 
SET 
    verification_status = 'verified_email',
    verification_method = 'email_domain',
    verified_at = NOW()
WHERE role = 'teacher' 
  AND is_educational_domain = TRUE 
  AND verification_status = 'unverified';

-- ============================================================================
-- STEP 8: Migrate Existing Class Enrollments
-- ============================================================================

-- Migrate students with class_id to class_enrollments table
INSERT INTO class_enrollments (
    id, class_id, student_id, teacher_id, enrollment_method,
    enrollment_source, verification_status, enrolled_at, is_active
)
SELECT
    UUID(),
    u.class_id,
    u.id,
    COALESCE(
        (SELECT teacher_id FROM teacher_class_assignments
         WHERE class_id COLLATE utf8mb4_0900_ai_ci = u.class_id AND is_active = TRUE LIMIT 1),
        (SELECT id FROM users WHERE role = 'teacher' LIMIT 1)
    ),
    'manual_add',
    'migrated_from_class_id',
    'active_user',
    u.created_at,
    TRUE
FROM users u
WHERE u.role = 'student'
  AND u.class_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM class_enrollments ce
      WHERE ce.student_id = u.id AND ce.class_id = u.class_id
  );

-- ============================================================================
-- STEP 9: Initialize Teacher Resource Usage
-- ============================================================================

-- Create resource usage records for all existing teachers
INSERT INTO teacher_resource_usage (
    id, teacher_id, clerk_id, active_classes, total_students,
    class_limit, student_limit
)
SELECT
    UUID(),
    u.id,
    u.clerk_id,
    COALESCE((SELECT COUNT(DISTINCT tca.class_id)
              FROM teacher_class_assignments tca
              WHERE tca.teacher_id COLLATE utf8mb4_0900_ai_ci = u.id AND tca.is_active = TRUE), 0),
    COALESCE((SELECT COUNT(*)
              FROM class_enrollments ce
              WHERE ce.teacher_id = u.id), 0),
    3,  -- Default free tier limit
    50  -- Default free tier limit
FROM users u
WHERE u.role = 'teacher'
  AND NOT EXISTS (
      SELECT 1 FROM teacher_resource_usage tru WHERE tru.teacher_id = u.id
  );

-- ============================================================================
-- Migration Complete
-- ============================================================================

SELECT '✅ Migration 004 completed successfully!' AS status;
SELECT CONCAT('Teachers migrated: ', COUNT(*)) AS teacher_count 
FROM users WHERE role = 'teacher';
SELECT CONCAT('Enrollments migrated: ', COUNT(*)) AS enrollment_count 
FROM class_enrollments;

