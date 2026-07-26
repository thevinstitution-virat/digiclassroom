-- Core Classroom Features Database Schema
-- Adds Multi-Tenancy feature flags, Homework, Notices, and Attendance tables.

-- Enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

USE virat_gyankosh;

-- Tenant Features Table (Scaffolding for toggles)
CREATE TABLE IF NOT EXISTS tenant_features (
    tenant_id VARCHAR(36) PRIMARY KEY,
    enable_live_classes BOOLEAN DEFAULT FALSE,
    enable_video_library BOOLEAN DEFAULT FALSE,
    enable_homework BOOLEAN DEFAULT FALSE,
    enable_notices BOOLEAN DEFAULT FALSE,
    enable_doubts BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Notices Table
CREATE TABLE IF NOT EXISTS notices (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    target_audience ENUM('all', 'students', 'teachers') NOT NULL DEFAULT 'all',
    title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_audience (tenant_id, target_audience),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Homeworks Table
CREATE TABLE IF NOT EXISTS homeworks (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description LONGTEXT,
    due_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_class (tenant_id, class_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Homework Submissions Table (Sparse Model)
-- A row here means the student has "marked as done"
CREATE TABLE IF NOT EXISTS homework_submissions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    homework_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    status ENUM('completed') NOT NULL DEFAULT 'completed',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_student_homework (student_id, homework_id),
    INDEX idx_tenant_homework (tenant_id, homework_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (homework_id) REFERENCES homeworks(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(36) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'late') NOT NULL,
    type ENUM('regular', 'live') NOT NULL DEFAULT 'regular',
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_date_type (user_id, date, type),
    INDEX idx_tenant_class_date (tenant_id, class_id, date),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
