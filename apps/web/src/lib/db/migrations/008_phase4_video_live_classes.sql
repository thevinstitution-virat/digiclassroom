-- Phase 4 Migration: Video Streaming & Live Classes
-- Adds Zoom Credentials, Video Assets, and Live Classes tables.

SET FOREIGN_KEY_CHECKS = 1;
USE virat_gyankosh;

-- 1. Zoom Credentials Table
CREATE TABLE IF NOT EXISTS zoom_credentials (
    tenant_id VARCHAR(255) PRIMARY KEY,
    account_id VARCHAR(512) NOT NULL,
    client_id VARCHAR(512) NOT NULL,
    client_secret VARCHAR(512) NOT NULL,
    status ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES organization(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Video Assets Table
CREATE TABLE IF NOT EXISTS video_assets (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(255) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description LONGTEXT,
    provider VARCHAR(50) NOT NULL DEFAULT 'bunny',
    provider_video_id VARCHAR(255) NOT NULL,
    duration_seconds INT NULL,
    thumbnail_url VARCHAR(512) NULL,
    status ENUM('uploading', 'processing', 'ready', 'failed') NOT NULL DEFAULT 'uploading',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tenant_provider_video (tenant_id, provider_video_id),
    INDEX idx_tenant_class (tenant_id, class_id),
    FOREIGN KEY (tenant_id) REFERENCES organization(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Live Classes Table
CREATE TABLE IF NOT EXISTS live_classes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id VARCHAR(255) NOT NULL,
    class_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    scheduled_start_time TIMESTAMP NOT NULL,
    duration_minutes INT NOT NULL,
    zoom_meeting_id VARCHAR(255) NOT NULL,
    zoom_join_url VARCHAR(512) NOT NULL,
    zoom_start_url VARCHAR(512) NOT NULL,
    host_id VARCHAR(255) NOT NULL,
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tenant_zoom_meeting (tenant_id, zoom_meeting_id),
    INDEX idx_tenant_class_status (tenant_id, class_id, status),
    FOREIGN KEY (tenant_id) REFERENCES organization(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (host_id) REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
