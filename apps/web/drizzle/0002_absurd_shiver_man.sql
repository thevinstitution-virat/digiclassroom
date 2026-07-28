CREATE TABLE `batches` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`organization_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`domain_id` varchar(100),
	`course_id` varchar(100),
	`level_id` varchar(100),
	`price` decimal(10,2) DEFAULT '0.00',
	`access_type` enum('free','paid') DEFAULT 'paid',
	`status` enum('draft','published') DEFAULT 'draft',
	`starts_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`organization_id` varchar(255),
	`name` varchar(255) NOT NULL,
	`description` text,
	`grade_level` int NOT NULL,
	`qdrant_namespace` varchar(255),
	`subjects` json,
	`teacher_ids` json,
	`student_count` int DEFAULT 0,
	`settings` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`status` enum('active','expired','revoked') DEFAULT 'active',
	`expires_at` timestamp,
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `institution_join_requests` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`organization_id` varchar(255) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`message` text,
	`requested_class` int,
	`requested_board` varchar(50),
	`reviewed_by` varchar(255),
	`reviewed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institution_join_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `note_links` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`source_note_id` varchar(36) NOT NULL,
	`target_note_id` varchar(36),
	`link_text` varchar(500) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `note_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practest_attempt_events` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(255),
	`session_id` varchar(36) NOT NULL,
	`question_id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`selected_answer` text,
	`is_correct` boolean NOT NULL DEFAULT false,
	`marks_awarded` int NOT NULL DEFAULT 0,
	`time_spent_seconds` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `practest_attempt_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_video_progress` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`video_id` varchar(36) NOT NULL,
	`max_watched_seconds` int DEFAULT 0,
	`completion_percentage` decimal(5,2) DEFAULT '0.00',
	`last_watched_at` timestamp DEFAULT (now()),
	CONSTRAINT `student_video_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_activity_logs` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`teacher_id` varchar(255) NOT NULL,
	`activity_type` varchar(100) NOT NULL,
	`activity_description` text,
	`metadata` json,
	`ip_address` varchar(45),
	`user_agent` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `teacher_activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_class_assignments` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`teacher_id` varchar(255) NOT NULL,
	`class_id` varchar(36) NOT NULL,
	`assigned_by` varchar(255),
	`is_active` boolean DEFAULT true,
	`assigned_at` timestamp DEFAULT (now()),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_class_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_verification_documents` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`teacher_id` varchar(255) NOT NULL,
	`document_type` varchar(100) NOT NULL,
	`file_path` text NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_size` int,
	`mime_type` varchar(100),
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`notes` text,
	`reviewed_by` varchar(255),
	`reviewed_at` timestamp,
	`rejection_reason` text,
	`uploaded_at` timestamp DEFAULT (now()),
	CONSTRAINT `teacher_verification_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_assets` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(255) NOT NULL,
	`domain` varchar(100) NOT NULL,
	`course` varchar(100) NOT NULL,
	`level` varchar(100) NOT NULL,
	`subject` varchar(100) NOT NULL,
	`book` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`provider` varchar(50) DEFAULT 'bunny',
	`provider_video_id` varchar(255) NOT NULL,
	`duration_seconds` int,
	`thumbnail_url` varchar(512),
	`status` enum('uploading','processing','ready','failed') DEFAULT 'uploading',
	`sort_order` int DEFAULT 0,
	`is_free_preview` boolean DEFAULT false,
	`created_by` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_provider_idx` UNIQUE(`tenant_id`,`provider_video_id`)
);
--> statement-breakpoint
DROP TABLE `institution_classes`;--> statement-breakpoint
DROP TABLE `institution_sections`;--> statement-breakpoint
DROP TABLE `student_enrollments`;--> statement-breakpoint
DROP TABLE `tenants`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `admin_activity_log` DROP FOREIGN KEY `admin_activity_log_tenant_id_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `google_drive_config` DROP FOREIGN KEY `google_drive_config_tenant_id_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `material_approval_log` DROP FOREIGN KEY `material_approval_log_tenant_id_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `practest_question_bank` DROP FOREIGN KEY `practest_question_bank_tenant_id_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `practest_test_configurations` DROP FOREIGN KEY `practest_test_configurations_tenant_id_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `practest_test_sessions` DROP FOREIGN KEY `practest_test_sessions_tenant_id_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `user_material_access` DROP FOREIGN KEY `user_material_access_tenant_id_tenants_id_fk`;
--> statement-breakpoint
ALTER TABLE `community_phrases` MODIFY COLUMN `clerk_user_id` varchar(255);--> statement-breakpoint
ALTER TABLE `dictionary_offline_sync` MODIFY COLUMN `clerk_user_id` varchar(255);--> statement-breakpoint
ALTER TABLE `dictionary_search_history` MODIFY COLUMN `clerk_user_id` varchar(255);--> statement-breakpoint
ALTER TABLE `dictionary_user_stats` MODIFY COLUMN `clerk_user_id` varchar(255);--> statement-breakpoint
ALTER TABLE `note_folders` MODIFY COLUMN `clerk_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user_material_access` MODIFY COLUMN `user_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user_notes` MODIFY COLUMN `clerk_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user_vocab_progress` MODIFY COLUMN `clerk_user_id` varchar(255);--> statement-breakpoint
ALTER TABLE `organization` ADD `subscription_plan` enum('starter','pro','enterprise') DEFAULT 'starter';--> statement-breakpoint
ALTER TABLE `organization` ADD `subscription_status` enum('active','inactive','trial','pending','expired','cancelled') DEFAULT 'trial';--> statement-breakpoint
ALTER TABLE `organization` ADD `settings` json;--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD `difficulty_level` text;--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD `bloom_level` text;--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD `casa_book` varchar(255);--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD `casa_edition` varchar(50);--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD `casa_page` int;--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD `casa_anchor` varchar(255);--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD `casa_verified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `first_name` varchar(100);--> statement-breakpoint
ALTER TABLE `user` ADD `last_name` varchar(100);--> statement-breakpoint
ALTER TABLE `user` ADD `approval_status` enum('approved','pending','rejected');--> statement-breakpoint
ALTER TABLE `user` ADD `verification_status` enum('verified_email','unverified','manual');--> statement-breakpoint
ALTER TABLE `user` ADD `verification_method` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `email_domain` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `is_educational_domain` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `verified_at` timestamp;--> statement-breakpoint
ALTER TABLE `user` ADD `preferences` json;--> statement-breakpoint
ALTER TABLE `user` ADD `last_login` timestamp;--> statement-breakpoint
ALTER TABLE `user` ADD `approved_by` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `approved_at` timestamp;--> statement-breakpoint
ALTER TABLE `user` ADD `rejection_reason` text;--> statement-breakpoint
ALTER TABLE `user_material_access` ADD `material_id` varchar(36);--> statement-breakpoint
ALTER TABLE `user_material_access` ADD `access_count` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_notes` ADD `content_format` enum('plain','markdown','html') DEFAULT 'markdown';--> statement-breakpoint
ALTER TABLE `user_notes` ADD `is_pinned` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_notes` ADD `cover_design` varchar(50) DEFAULT 'solid-blue';--> statement-breakpoint
ALTER TABLE `user_notes` ADD `spine_color` varchar(20) DEFAULT '#3B82F6';--> statement-breakpoint
ALTER TABLE `user_notes` ADD `page_size` varchar(16) DEFAULT 'A4';--> statement-breakpoint
ALTER TABLE `user_notes` ADD `page_margins` varchar(16) DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE `user_material_access` ADD CONSTRAINT `uq_uma_user_material` UNIQUE(`user_id`,`material_id`);--> statement-breakpoint
ALTER TABLE `batches` ADD CONSTRAINT `batches_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classes` ADD CONSTRAINT `classes_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_tenant_id_organization_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_join_requests` ADD CONSTRAINT `institution_join_requests_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_join_requests` ADD CONSTRAINT `institution_join_requests_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_links` ADD CONSTRAINT `note_links_source_note_id_user_notes_id_fk` FOREIGN KEY (`source_note_id`) REFERENCES `user_notes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_video_progress` ADD CONSTRAINT `student_video_progress_tenant_id_organization_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_video_progress` ADD CONSTRAINT `student_video_progress_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_video_progress` ADD CONSTRAINT `student_video_progress_video_id_video_assets_id_fk` FOREIGN KEY (`video_id`) REFERENCES `video_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_activity_logs` ADD CONSTRAINT `teacher_activity_logs_teacher_id_user_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_class_assignments` ADD CONSTRAINT `teacher_class_assignments_teacher_id_user_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_class_assignments` ADD CONSTRAINT `teacher_class_assignments_class_id_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_verification_documents` ADD CONSTRAINT `teacher_verification_documents_teacher_id_user_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_assets` ADD CONSTRAINT `video_assets_tenant_id_organization_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ijr_org_idx` ON `institution_join_requests` (`organization_id`);--> statement-breakpoint
CREATE INDEX `ijr_user_idx` ON `institution_join_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `ijr_status_idx` ON `institution_join_requests` (`status`);--> statement-breakpoint
CREATE INDEX `pae_question_idx` ON `practest_attempt_events` (`question_id`);--> statement-breakpoint
CREATE INDEX `pae_session_idx` ON `practest_attempt_events` (`session_id`);--> statement-breakpoint
CREATE INDEX `pae_user_idx` ON `practest_attempt_events` (`user_id`);--> statement-breakpoint
ALTER TABLE `user_material_access` ADD CONSTRAINT `user_material_access_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_uma_org_user` ON `user_material_access` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_uma_material` ON `user_material_access` (`material_id`);--> statement-breakpoint
ALTER TABLE `admin_activity_log` DROP COLUMN `tenant_id`;--> statement-breakpoint
ALTER TABLE `google_drive_config` DROP COLUMN `tenant_id`;--> statement-breakpoint
ALTER TABLE `material_approval_log` DROP COLUMN `tenant_id`;--> statement-breakpoint
ALTER TABLE `practest_question_bank` DROP COLUMN `tenant_id`;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` DROP COLUMN `tenant_id`;--> statement-breakpoint
ALTER TABLE `practest_test_sessions` DROP COLUMN `tenant_id`;--> statement-breakpoint
ALTER TABLE `user_material_access` DROP COLUMN `tenant_id`;