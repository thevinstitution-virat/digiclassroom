-- ============================================================================
-- Phase 4.1a — Drop legacy `users` and `tenants` tables.
--
-- All columns previously on `users` are now on Better Auth `user`. All columns
-- previously on `tenants` are now on Better Auth `organization`. The 7
-- dependent tables (material_approval_log, google_drive_config, admin_activity_log,
-- user_material_access, practest_question_bank, practest_test_configurations,
-- practest_test_sessions) keep their `organization_id` FK; the now-orphan
-- `tenant_id` column is dropped.
--
-- Run before this migration: `users` table data is forfeit (apps not launched).
--
-- Run order (per-section is idempotent on retry):
--   1. Add new columns to `user` and `organization`
--   2. Drop `tenant_id` columns from 7 dependent tables
--   3. Drop `users` and `tenants` tables
--
-- See Vidyaverse Pro/docs/identity-federation-design.md §8.3.
-- ============================================================================

-- ---- Idempotency helper: ADD COLUMN only when missing. ----
-- ADD COLUMN is not natively idempotent in MySQL; we wrap each in an
-- information_schema check so re-running this migration (or recovering from a
-- partial apply) is safe. Same pattern is used for DROP COLUMN / DROP FK below.
DELIMITER //
DROP PROCEDURE IF EXISTS _add_col_if_missing//
CREATE PROCEDURE _add_col_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN spec TEXT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
        SET @sql := CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', spec);
        PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//
DROP PROCEDURE IF EXISTS _drop_col_if_present//
CREATE PROCEDURE _drop_col_if_present(IN tbl VARCHAR(64), IN col VARCHAR(64))
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
        SET @sql := CONCAT('ALTER TABLE `', tbl, '` DROP COLUMN `', col, '`');
        PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//
DROP PROCEDURE IF EXISTS _drop_fk_if_present//
CREATE PROCEDURE _drop_fk_if_present(IN tbl VARCHAR(64), IN fk VARCHAR(128))
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl
                 AND CONSTRAINT_NAME = fk AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
        SET @sql := CONCAT('ALTER TABLE `', tbl, '` DROP FOREIGN KEY `', fk, '`');
        PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//
DELIMITER ;

-- ---- 1. Extend `user` with columns inherited from legacy `users`. ----
CALL _add_col_if_missing('user', 'first_name',            'VARCHAR(100) NULL');
CALL _add_col_if_missing('user', 'last_name',             'VARCHAR(100) NULL');
CALL _add_col_if_missing('user', 'approval_status',       'ENUM("approved","pending","rejected") NULL');
CALL _add_col_if_missing('user', 'verification_status',   'ENUM("verified_email","unverified","manual") NULL');
CALL _add_col_if_missing('user', 'verification_method',   'VARCHAR(255) NULL');
CALL _add_col_if_missing('user', 'email_domain',          'VARCHAR(255) NULL');
CALL _add_col_if_missing('user', 'is_educational_domain', 'BOOLEAN NOT NULL DEFAULT FALSE');
CALL _add_col_if_missing('user', 'verified_at',           'TIMESTAMP NULL');
CALL _add_col_if_missing('user', 'preferences',           'JSON NULL');
CALL _add_col_if_missing('user', 'last_login',            'TIMESTAMP NULL');
CALL _add_col_if_missing('user', 'approved_by',           'VARCHAR(255) NULL');
CALL _add_col_if_missing('user', 'approved_at',           'TIMESTAMP NULL');
CALL _add_col_if_missing('user', 'rejection_reason',      'TEXT NULL');

-- ---- 2. Extend `organization` with columns inherited from legacy `tenants`. ----
CALL _add_col_if_missing('organization', 'subscription_plan',   'ENUM("starter","pro","enterprise") NULL DEFAULT "starter"');
CALL _add_col_if_missing('organization', 'subscription_status', 'ENUM("active","inactive","trial","pending","expired","cancelled") NULL DEFAULT "trial"');
CALL _add_col_if_missing('organization', 'settings',            'JSON NULL');

-- ---- 3 & 4. Drop FK constraints, then orphan `tenant_id` columns and the legacy tables. ----
-- A DROP COLUMN that participates in a FOREIGN KEY is blocked even with
-- FOREIGN_KEY_CHECKS=0 (that flag only suppresses *referential checks*, not
-- DDL on a column that owns a constraint). So each FK is named-and-dropped
-- first. The constraint names follow Drizzle's default convention
-- `<table>_<column>_<reftable>_<refcolumn>_fk`.
CALL _drop_fk_if_present('material_approval_log',        'material_approval_log_tenant_id_tenants_id_fk');
CALL _drop_fk_if_present('google_drive_config',          'google_drive_config_tenant_id_tenants_id_fk');
CALL _drop_fk_if_present('admin_activity_log',           'admin_activity_log_tenant_id_tenants_id_fk');
CALL _drop_fk_if_present('user_material_access',         'user_material_access_tenant_id_tenants_id_fk');
CALL _drop_fk_if_present('practest_question_bank',       'practest_question_bank_tenant_id_tenants_id_fk');
CALL _drop_fk_if_present('practest_test_configurations', 'practest_test_configurations_tenant_id_tenants_id_fk');
CALL _drop_fk_if_present('practest_test_sessions',       'practest_test_sessions_tenant_id_tenants_id_fk');

-- FK checks suppressed for the DROP TABLE block: legacy raw-SQL-only tables
-- (content, vector_embeddings, etc. — defined only in src/lib/db/schema.sql,
-- not in Drizzle) still carry tenant_id FKs to `tenants`. Safe pre-launch.
SET FOREIGN_KEY_CHECKS = 0;

CALL _drop_col_if_present('material_approval_log',        'tenant_id');
CALL _drop_col_if_present('google_drive_config',          'tenant_id');
CALL _drop_col_if_present('admin_activity_log',           'tenant_id');
CALL _drop_col_if_present('user_material_access',         'tenant_id');
CALL _drop_col_if_present('practest_question_bank',       'tenant_id');
CALL _drop_col_if_present('practest_test_configurations', 'tenant_id');
CALL _drop_col_if_present('practest_test_sessions',       'tenant_id');

DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `tenants`;

SET FOREIGN_KEY_CHECKS = 1;

DROP PROCEDURE IF EXISTS _add_col_if_missing;
DROP PROCEDURE IF EXISTS _drop_col_if_present;
DROP PROCEDURE IF EXISTS _drop_fk_if_present;

-- ---- 5. Phase 4.2 — ensure the domain tables referenced by legacy endpoints exist.
-- These were previously created only via src/lib/db/schema.sql with tenant_id
-- FKs. Now mirrored in Drizzle schema with organization_id FKs.

CREATE TABLE IF NOT EXISTS `classes` (
    `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    `organization_id` VARCHAR(255),
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `grade_level` INT NOT NULL,
    `qdrant_namespace` VARCHAR(255),
    `subjects` JSON,
    `teacher_ids` JSON,
    `student_count` INT DEFAULT 0,
    `settings` JSON,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `classes_organization_id_idx` (`organization_id`),
    INDEX `classes_grade_level_idx` (`grade_level`),
    INDEX `classes_qdrant_namespace_idx` (`qdrant_namespace`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- If the legacy `classes` table existed with a `tenant_id` column, drop that
-- column (organization_id replaces it). Wrapped in IGNORE so a fresh install
-- where the column never existed doesn't fail.
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND COLUMN_NAME = 'tenant_id');
SET @sql := IF(@col_exists > 0, 'ALTER TABLE `classes` DROP COLUMN `tenant_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `teacher_class_assignments` (
    `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    `teacher_id` VARCHAR(255) NOT NULL,
    `class_id` VARCHAR(36) NOT NULL,
    `assigned_by` VARCHAR(255),
    `is_active` BOOLEAN DEFAULT TRUE,
    `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `tca_teacher_id_idx` (`teacher_id`),
    INDEX `tca_class_id_idx` (`class_id`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `teacher_activity_logs` (
    `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    `teacher_id` VARCHAR(255) NOT NULL,
    `activity_type` VARCHAR(100) NOT NULL,
    `activity_description` TEXT,
    `metadata` JSON,
    `ip_address` VARCHAR(45),
    `user_agent` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `tal_teacher_id_idx` (`teacher_id`),
    INDEX `tal_activity_type_idx` (`activity_type`),
    INDEX `tal_created_at_idx` (`created_at`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `teacher_verification_documents` (
    `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    `teacher_id` VARCHAR(255) NOT NULL,
    `document_type` VARCHAR(100) NOT NULL,
    `file_path` TEXT NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size` INT,
    `mime_type` VARCHAR(100),
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `notes` TEXT,
    `reviewed_by` VARCHAR(255),
    `reviewed_at` TIMESTAMP NULL,
    `rejection_reason` TEXT,
    `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `tvd_teacher_id_idx` (`teacher_id`),
    INDEX `tvd_status_idx` (`status`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
