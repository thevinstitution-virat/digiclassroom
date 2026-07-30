CREATE TABLE `institution_classes` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`organization_id` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`level` int,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institution_classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `institution_sections` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`organization_id` varchar(255) NOT NULL,
	`class_id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institution_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_enrollments` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`organization_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`class_id` varchar(36) NOT NULL,
	`section_id` varchar(36),
	`roll_number` varchar(50),
	`academic_year` varchar(50),
	`status` varchar(20) DEFAULT 'active',
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tutor_topic_events` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`subject` varchar(100),
	`chapter` varchar(255),
	`topic` varchar(255),
	`board` enum('CBSE','ICSE','STATE_BOARD'),
	`class_level` varchar(20),
	`event_type` enum('doubt_asked') NOT NULL DEFAULT 'doubt_asked',
	`agent_id` varchar(64),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `tutor_topic_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `answer_feedback` DROP INDEX `id`;--> statement-breakpoint
ALTER TABLE `community_phrases` DROP INDEX `id`;--> statement-breakpoint
ALTER TABLE `dictionary_offline_sync` DROP INDEX `id`;--> statement-breakpoint
ALTER TABLE `dictionary_search_history` DROP INDEX `id`;--> statement-breakpoint
ALTER TABLE `dictionary_user_stats` DROP INDEX `id`;--> statement-breakpoint
ALTER TABLE `dictionary_words` DROP INDEX `id`;--> statement-breakpoint
ALTER TABLE `enhanced_user_profiles` DROP INDEX `id`;--> statement-breakpoint
ALTER TABLE `note_activity_log` DROP INDEX `id`;--> statement-breakpoint
ALTER TABLE `user_vocab_progress` DROP INDEX `id`;--> statement-breakpoint
ALTER TABLE `admin_activity_log` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `ai_tutor_usage` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `announcements` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `announcements` MODIFY COLUMN `is_pinned` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `announcements` MODIFY COLUMN `is_pinned` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `app_config` MODIFY COLUMN `maintenance_mode` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `app_config` MODIFY COLUMN `maintenance_mode` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `app_config` MODIFY COLUMN `debug_mode` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `app_config` MODIFY COLUMN `debug_mode` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `batch_coupons` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `batch_templates` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `batch_waitlist` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `batches` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `batches` MODIFY COLUMN `is_active` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `classes` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `community_phrases` MODIFY COLUMN `is_approved` boolean;--> statement-breakpoint
ALTER TABLE `community_phrases` MODIFY COLUMN `is_approved` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `dictionary_offline_sync` MODIFY COLUMN `auto_sync_enabled` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `dictionary_offline_sync` MODIFY COLUMN `wifi_only_sync` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `dictionary_words` MODIFY COLUMN `is_active` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `enhanced_user_profiles` MODIFY COLUMN `is_onboarding_complete` boolean;--> statement-breakpoint
ALTER TABLE `enhanced_user_profiles` MODIFY COLUMN `is_onboarding_complete` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `enrollments` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `enrollments` MODIFY COLUMN `email_opt_out` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `enrollments` MODIFY COLUMN `email_opt_out` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `free_trials` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `free_trials` MODIFY COLUMN `is_converted` boolean;--> statement-breakpoint
ALTER TABLE `free_trials` MODIFY COLUMN `is_converted` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `google_drive_config` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `google_drive_folders` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `institution_join_requests` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `institution_profiles` MODIFY COLUMN `onboarding_completed` boolean;--> statement-breakpoint
ALTER TABLE `institution_profiles` MODIFY COLUMN `onboarding_completed` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `material_approval_log` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `is_active` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `note_folders` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `note_links` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `note_shares` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `note_shares` MODIFY COLUMN `is_public` boolean;--> statement-breakpoint
ALTER TABLE `note_shares` MODIFY COLUMN `is_public` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `note_templates` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `note_templates` MODIFY COLUMN `is_public` boolean;--> statement-breakpoint
ALTER TABLE `note_templates` MODIFY COLUMN `is_public` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `is_read` boolean;--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `is_read` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `practest_attempt_events` MODIFY COLUMN `is_correct` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `practest_attempt_events` MODIFY COLUMN `is_correct` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_question_bank` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `practest_question_bank` MODIFY COLUMN `has_math_content` boolean;--> statement-breakpoint
ALTER TABLE `practest_question_bank` MODIFY COLUMN `has_math_content` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_question_bank` MODIFY COLUMN `has_chemical_formulas` boolean;--> statement-breakpoint
ALTER TABLE `practest_question_bank` MODIFY COLUMN `has_chemical_formulas` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_question_bank` MODIFY COLUMN `has_diagrams` boolean;--> statement-breakpoint
ALTER TABLE `practest_question_bank` MODIFY COLUMN `has_diagrams` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_question_bank` MODIFY COLUMN `casa_verified` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `practest_question_bank` MODIFY COLUMN `casa_verified` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `partial_marking` boolean;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `partial_marking` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `randomize_questions` boolean;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `randomize_questions` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `randomize_options` boolean;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `randomize_options` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `allow_review` boolean;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `allow_review` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `show_results_immediately` boolean;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `show_results_immediately` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `is_active` boolean;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `is_active` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `is_public` boolean;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` MODIFY COLUMN `is_public` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `practest_test_sessions` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `quiz_answers` MODIFY COLUMN `is_correct` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_answers` MODIFY COLUMN `is_correct` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `quiz_options` MODIFY COLUMN `is_correct` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_options` MODIFY COLUMN `is_correct` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `quizzes` MODIFY COLUMN `shuffle_questions` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` MODIFY COLUMN `shuffle_questions` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `quizzes` MODIFY COLUMN `allow_multiple_attempts` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `quota_alerts` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `quota_alerts` MODIFY COLUMN `is_read` boolean;--> statement-breakpoint
ALTER TABLE `quota_alerts` MODIFY COLUMN `is_read` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `sarvagya_credit_transactions` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `sarvagya_documents` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `sarvagya_queries` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `sarvagya_spaces` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `student_engagement_snapshots` MODIFY COLUMN `engagement_score` decimal(5,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `student_engagement_snapshots` MODIFY COLUMN `risk_score` decimal(5,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `student_video_progress` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `subscription_history` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `subscription_plans` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `subscription_plans` MODIFY COLUMN `is_active` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `subscription_plans` MODIFY COLUMN `is_featured` boolean;--> statement-breakpoint
ALTER TABLE `subscription_plans` MODIFY COLUMN `is_featured` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `taxonomy_courses` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `taxonomy_domains` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `taxonomy_levels` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `taxonomy_subjects` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `teacher_activity_logs` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `teacher_class_assignments` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `teacher_class_assignments` MODIFY COLUMN `is_active` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `teacher_verification_documents` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `email_verified` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `email_verified` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `is_educational_domain` boolean;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `is_educational_domain` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_material_access` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `user_notes` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `user_notes` MODIFY COLUMN `is_favorite` boolean;--> statement-breakpoint
ALTER TABLE `user_notes` MODIFY COLUMN `is_favorite` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_notes` MODIFY COLUMN `is_archived` boolean;--> statement-breakpoint
ALTER TABLE `user_notes` MODIFY COLUMN `is_archived` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_notes` MODIFY COLUMN `is_pinned` boolean;--> statement-breakpoint
ALTER TABLE `user_notes` MODIFY COLUMN `is_pinned` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_subscriptions` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `user_subscriptions` MODIFY COLUMN `auto_renew` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `video_assets` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `video_assets` MODIFY COLUMN `is_free_preview` boolean;--> statement-breakpoint
ALTER TABLE `video_assets` MODIFY COLUMN `is_free_preview` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `video_chapters` MODIFY COLUMN `id` varchar(36) NOT NULL DEFAULT (UUID());--> statement-breakpoint
ALTER TABLE `institution_classes` ADD CONSTRAINT `institution_classes_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_sections` ADD CONSTRAINT `institution_sections_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_sections` ADD CONSTRAINT `institution_sections_class_id_institution_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `institution_classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_class_id_institution_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `institution_classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_section_id_institution_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `institution_sections`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tutor_topic_events` ADD CONSTRAINT `tutor_topic_events_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ic_org_idx` ON `institution_classes` (`organization_id`);--> statement-breakpoint
CREATE INDEX `is_org_idx` ON `institution_sections` (`organization_id`);--> statement-breakpoint
CREATE INDEX `is_class_idx` ON `institution_sections` (`class_id`);--> statement-breakpoint
CREATE INDEX `se_org_idx` ON `student_enrollments` (`organization_id`);--> statement-breakpoint
CREATE INDEX `se_user_idx` ON `student_enrollments` (`user_id`);--> statement-breakpoint
CREATE INDEX `se_class_idx` ON `student_enrollments` (`class_id`);--> statement-breakpoint
CREATE INDEX `idx_tte_user_time` ON `tutor_topic_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tte_user_subject_topic` ON `tutor_topic_events` (`user_id`,`subject`,`topic`);