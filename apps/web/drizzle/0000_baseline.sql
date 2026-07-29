-- Baseline: introspected from the live virat_gyankosh database.
-- The previous migration history was forked (7 files / 4 journal entries,
-- duplicate ordinals) and its config pointed at a schema path that no longer
-- existed, so the database itself was the only source of truth. Archived under
-- drizzle-legacy/ for reference.

CREATE TABLE `account` (
	`id` varchar(255) NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp,
	`refresh_token_expires_at` timestamp,
	`scope` text,
	`password` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_activity_log` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`admin_id` text,
	`action` text,
	`details` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_tutor_usage` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`date` timestamp DEFAULT (now()),
	`questions_asked` int DEFAULT 0,
	`total_tokens_used` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_tutor_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`batch_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`title` varchar(150) NOT NULL,
	`body` text,
	`is_pinned` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `answer_feedback` (
	`organization_id` varchar(255),
	`id` bigint unsigned NOT NULL AUTO_INCREMENT,
	`user_id` varchar(255),
	`question_text` text,
	`answer_text` text,
	`subject` varchar(100),
	`class_level` int,
	`board` varchar(50),
	`star_rating` int,
	`thumbs_rating` varchar(10),
	`feedback_text` text,
	`validation_status` varchar(20) DEFAULT 'pending',
	`validated_by` varchar(255),
	`validated_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `answer_feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_config` (
	`id` int NOT NULL DEFAULT 1,
	`maintenance_mode` tinyint(1) NOT NULL DEFAULT 0,
	`debug_mode` tinyint(1) NOT NULL DEFAULT 0,
	`session_timeout_minutes` int NOT NULL DEFAULT 60,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `batch_coupons` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`batch_id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`discount_type` enum('percentage','fixed') NOT NULL,
	`discount_value` decimal(10,2) NOT NULL,
	`usage_limit` int,
	`usage_count` int NOT NULL DEFAULT 0,
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batch_coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_batch_coupons_code` UNIQUE(`batch_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `batch_templates` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`level_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `batch_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `batch_templates_name_levelId_idx` UNIQUE(`name`,`level_id`)
);
--> statement-breakpoint
CREATE TABLE `batch_waitlist` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`batch_id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`org_id` varchar(255) NOT NULL,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	`notified_at` timestamp,
	CONSTRAINT `batch_waitlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_waitlist_batch_user` UNIQUE(`batch_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`name` varchar(255) NOT NULL,
	`description` text,
	`level_id` varchar(36) NOT NULL,
	`price` decimal(10,2) DEFAULT '0.00',
	`created_at` timestamp DEFAULT (now()),
	`org_id` varchar(255) NOT NULL,
	`start_date` date,
	`is_active` tinyint(1) DEFAULT 1,
	`template_id` varchar(36),
	`join_code` varchar(8),
	`max_students` int,
	CONSTRAINT `batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `batches_join_code_unique` UNIQUE(`join_code`)
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`certificate_number` varchar(50) NOT NULL,
	`issued_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_certificate_number_unique` UNIQUE(`certificate_number`),
	CONSTRAINT `uq_cert_user_batch` UNIQUE(`user_id`,`batch_id`)
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
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
CREATE TABLE `community_phrases` (
	`organization_id` varchar(255),
	`id` bigint unsigned NOT NULL AUTO_INCREMENT,
	`word_id` bigint unsigned NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255),
	`phrase` text NOT NULL,
	`context` text,
	`region` varchar(100),
	`language_variant` varchar(50),
	`is_approved` tinyint(1) DEFAULT 0,
	`approved_by` varchar(255),
	`approved_at` timestamp,
	`rejection_reason` text,
	`upvotes` int DEFAULT 0,
	`downvotes` int DEFAULT 0,
	`reports` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_phrases_id` PRIMARY KEY(`id`),
	CONSTRAINT `id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `dictionary_offline_sync` (
	`organization_id` varchar(255),
	`id` bigint unsigned NOT NULL AUTO_INCREMENT,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255),
	`sync_version` int DEFAULT 1,
	`last_full_sync` timestamp,
	`last_incremental_sync` timestamp,
	`words_synced` int DEFAULT 0,
	`audio_files_cached` int DEFAULT 0,
	`total_cache_size_mb` decimal(8,2) DEFAULT '0.00',
	`auto_sync_enabled` tinyint(1) DEFAULT 1,
	`wifi_only_sync` tinyint(1) DEFAULT 1,
	`max_cache_size_mb` int DEFAULT 100,
	`pending_progress_updates` json,
	`pending_phrase_submissions` json,
	`pending_search_history` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dictionary_offline_sync_id` PRIMARY KEY(`id`),
	CONSTRAINT `dictionary_offline_sync_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `dictionary_search_history` (
	`organization_id` varchar(255),
	`id` bigint unsigned NOT NULL AUTO_INCREMENT,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255),
	`search_query` varchar(255) NOT NULL,
	`search_type` enum('exact','fuzzy','phonetic','semantic') NOT NULL,
	`results_count` int DEFAULT 0,
	`selected_word_id` bigint unsigned,
	`search_context` enum('learning','quiz','browse','community') DEFAULT 'browse',
	`device_type` enum('mobile','tablet','desktop') DEFAULT 'desktop',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `dictionary_search_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `dictionary_user_stats` (
	`organization_id` varchar(255),
	`id` bigint unsigned NOT NULL AUTO_INCREMENT,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255),
	`total_words_learned` int DEFAULT 0,
	`words_mastered` int DEFAULT 0,
	`current_streak_days` int DEFAULT 0,
	`longest_streak_days` int DEFAULT 0,
	`last_activity_date` date,
	`total_quiz_attempts` int DEFAULT 0,
	`correct_quiz_answers` int DEFAULT 0,
	`average_accuracy` decimal(5,2) DEFAULT '0.00',
	`total_points` int DEFAULT 0,
	`level` int DEFAULT 1,
	`badges_earned` json,
	`achievements` json,
	`phrases_contributed` int DEFAULT 0,
	`phrases_approved` int DEFAULT 0,
	`community_reputation` int DEFAULT 0,
	`daily_goal_words` int DEFAULT 5,
	`preferred_difficulty` enum('beginner','intermediate','advanced','mixed') DEFAULT 'mixed',
	`notification_preferences` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dictionary_user_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `dictionary_user_stats_clerk_user_id_unique` UNIQUE(`clerk_user_id`),
	CONSTRAINT `dictionary_user_stats_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `dictionary_words` (
	`organization_id` varchar(255),
	`id` bigint unsigned NOT NULL AUTO_INCREMENT,
	`word` varchar(255) NOT NULL,
	`pronunciation` varchar(255),
	`part_of_speech` enum('noun','verb','adjective','adverb','pronoun','preposition','conjunction','interjection') NOT NULL,
	`english_definition` text NOT NULL,
	`english_synonyms` json,
	`english_antonyms` json,
	`hindi_translation` varchar(500) NOT NULL,
	`hindi_synonyms` json,
	`devanagari_script` varchar(500),
	`amarkosha_category` varchar(100),
	`semantic_cluster` varchar(100),
	`etymology` text,
	`examples` json,
	`cultural_context` text,
	`regional_usage` json,
	`audio_url` varchar(500),
	`audio_accent` enum('indian','british','american') DEFAULT 'indian',
	`difficulty_level` enum('beginner','intermediate','advanced') DEFAULT 'intermediate',
	`frequency_rank` int,
	`source` varchar(100) DEFAULT 'system',
	`is_active` tinyint(1) DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dictionary_words_id` PRIMARY KEY(`id`),
	CONSTRAINT `dictionary_words_word_unique` UNIQUE(`word`),
	CONSTRAINT `id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `enhanced_user_profiles` (
	`organization_id` varchar(255),
	`id` bigint unsigned NOT NULL AUTO_INCREMENT,
	`user_id` varchar(255),
	`role` enum('student','teacher','parent','admin','parent_guardian') DEFAULT 'student',
	`board_type` enum('CBSE','ICSE','STATE_BOARD','ALL','State') DEFAULT 'CBSE',
	`medium` enum('ENGLISH','HINDI') DEFAULT 'ENGLISH',
	`grade_level` int,
	`stream` enum('HUMANITIES','BIOLOGY','MATHEMATICS','COMMERCE'),
	`subjects` json,
	`preferences` json,
	`learning_style` varchar(50) DEFAULT 'mixed',
	`learning_pace` varchar(50) DEFAULT 'average',
	`preferred_explanation_complexity` varchar(50) DEFAULT 'intermediate',
	`language_preference` varchar(50) DEFAULT 'english',
	`teaching_experience_years` int,
	`specialization_subjects` json,
	`classroom_size_preference` int,
	`child_grade_levels` json,
	`involvement_level` varchar(50),
	`support_preferences` json,
	`interaction_history` json,
	`performance_metrics` json,
	`difficulty_preferences` json,
	`is_onboarding_complete` tinyint(1) DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enhanced_user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `enhanced_user_profiles_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`status` enum('pending_payment','active','suspended','completed','revoked') DEFAULT 'active',
	`org_id` varchar(255) NOT NULL,
	`enrolled_at` timestamp DEFAULT (now()),
	`email_opt_out` tinyint(1) NOT NULL DEFAULT 0,
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_enrollments_batch_user` UNIQUE(`batch_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `free_trials` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`trial_start` timestamp DEFAULT (now()),
	`trial_end` timestamp,
	`is_converted` tinyint(1) DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `free_trials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `google_drive_config` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`access_token` text,
	`refresh_token` text,
	`token_type` text,
	`scope` text,
	`expiry_date` timestamp,
	`configured_by` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_drive_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `google_drive_folders` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`folder_id` varchar(255) NOT NULL,
	`folder_name` varchar(255) NOT NULL,
	`parent_folder_id` varchar(255),
	`folder_path` text NOT NULL,
	`board` enum('CBSE','ICSE','STATE_BOARD','ALL','State'),
	`class` int,
	`subject` varchar(100),
	`material_type` enum('notes','summaries','mind_maps','quizzes','textbooks','reference'),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`status` enum('draft','published','archived') DEFAULT 'draft',
	CONSTRAINT `google_drive_folders_id` PRIMARY KEY(`id`),
	CONSTRAINT `google_drive_folders_folder_id_unique` UNIQUE(`folder_id`)
);
--> statement-breakpoint
CREATE TABLE `institution_join_requests` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
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
CREATE TABLE `institution_profiles` (
	`id` varchar(255) NOT NULL,
	`organization_id` varchar(255) NOT NULL,
	`type` enum('school','college','tuition_center') NOT NULL DEFAULT 'school',
	`address` text,
	`website` varchar(255),
	`contact_email` varchar(255),
	`contact_phone` varchar(50),
	`established_year` int,
	`primary_color` varchar(50),
	`logo_url` text,
	`banner_url` text,
	`onboarding_completed` tinyint(1) DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institution_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `institution_profiles_organization_id_unique` UNIQUE(`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` varchar(255) NOT NULL,
	`organization_id` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`role` varchar(255),
	`status` varchar(255) NOT NULL DEFAULT 'pending',
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`inviter_id` varchar(255) NOT NULL,
	CONSTRAINT `invitation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learning_events` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`batch_id` varchar(36),
	`org_id` varchar(36) NOT NULL,
	`event_type` enum('video_play','video_pause','video_seek','video_complete','video_speed_change','quiz_start','quiz_submit','session_start','session_end') NOT NULL,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learning_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_approval_log` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`material_id` varchar(36),
	`admin_id` text,
	`action` text,
	`comments` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `material_approval_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`title` varchar(255) NOT NULL,
	`description` text,
	`type` enum('notes','summaries','mind_maps','quizzes','textbooks','reference') NOT NULL,
	`board` enum('CBSE','ICSE','STATE_BOARD','ALL','State') NOT NULL,
	`medium` enum('ENGLISH','HINDI') NOT NULL,
	`class` int NOT NULL,
	`stream` enum('HUMANITIES','BIOLOGY','MATHEMATICS','COMMERCE'),
	`subject` varchar(100) NOT NULL,
	`sm_type` varchar(100) DEFAULT 'Chapter Notes',
	`google_drive_file_id` varchar(255) NOT NULL,
	`google_drive_folder_id` varchar(255),
	`file_name` varchar(255) NOT NULL,
	`file_size` int NOT NULL,
	`mime_type` varchar(100) DEFAULT 'application/pdf',
	`download_url` text,
	`view_url` text,
	`thumbnail_url` text,
	`download_count` int DEFAULT 0,
	`view_count` int DEFAULT 0,
	`tags` json,
	`difficulty` varchar(50) DEFAULT 'medium',
	`metadata` json,
	`status` enum('draft','pending_review','approved','rejected','archived') DEFAULT 'draft',
	`is_active` tinyint(1) DEFAULT 1,
	`created_by` varchar(255),
	`approved_by` varchar(255),
	`rejected_by` varchar(255),
	`approved_at` timestamp,
	`rejected_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `materials_id` PRIMARY KEY(`id`),
	CONSTRAINT `materials_google_drive_file_id_unique` UNIQUE(`google_drive_file_id`)
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` varchar(255) NOT NULL,
	`organization_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`role` varchar(255) NOT NULL DEFAULT 'member',
	`created_at` timestamp NOT NULL,
	CONSTRAINT `member_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_member_user_org` UNIQUE(`user_id`,`organization_id`)
);
--> statement-breakpoint
CREATE TABLE `note_activity_log` (
	`organization_id` varchar(255),
	`id` bigint unsigned NOT NULL AUTO_INCREMENT,
	`note_id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`activity_type` enum('created','updated','viewed','shared','exported','deleted') NOT NULL,
	`changes_summary` text,
	`ip_address` varchar(45),
	`user_agent` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `note_activity_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `note_folders` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`clerk_id` varchar(255),
	`name` varchar(255) NOT NULL,
	`description` text,
	`color` varchar(20) DEFAULT 'blue',
	`icon` varchar(50) DEFAULT 'folder',
	`parent_folder_id` varchar(36),
	`folder_path` text,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `note_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `note_links` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`source_note_id` varchar(36) NOT NULL,
	`target_note_id` varchar(36),
	`link_text` varchar(500) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `note_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `note_shares` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`note_id` varchar(36) NOT NULL,
	`shared_by_user_id` varchar(255) NOT NULL,
	`shared_with_user_id` varchar(255),
	`permission` enum('view','edit','comment') DEFAULT 'view',
	`is_public` tinyint(1) DEFAULT 0,
	`share_link` varchar(255),
	`expires_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`accessed_at` timestamp,
	CONSTRAINT `note_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `note_shares_share_link_unique` UNIQUE(`share_link`)
);
--> statement-breakpoint
CREATE TABLE `note_templates` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`name` varchar(255) NOT NULL,
	`description` text,
	`template_content` text NOT NULL,
	`category` enum('general','subject_notes','exam_prep','revision','summary') DEFAULT 'general',
	`subject` varchar(100),
	`class_level` varchar(20),
	`is_public` tinyint(1) DEFAULT 0,
	`created_by_user_id` varchar(255),
	`usage_count` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `note_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`type` varchar(50),
	`title` varchar(255),
	`message` text,
	`is_read` tinyint(1) DEFAULT 0,
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`student_id` varchar(255) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`org_id` varchar(255) NOT NULL,
	`amount_paise` int NOT NULL,
	`platform_fee_paise` int NOT NULL,
	`platform_fee_rate` decimal(5,4) NOT NULL,
	`institution_paise` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'INR',
	`status` enum('created','authorized','captured','failed','refunded') NOT NULL DEFAULT 'created',
	`razorpay_order_id` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_razorpay_order_id_unique` UNIQUE(`razorpay_order_id`)
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` varchar(255) NOT NULL,
	`name` text NOT NULL,
	`slug` varchar(255) NOT NULL,
	`logo` text,
	`created_at` timestamp NOT NULL,
	`metadata` text,
	`subscription_plan` enum('starter','pro','enterprise') DEFAULT 'starter',
	`subscription_status` enum('active','inactive','trial','pending','expired','cancelled') DEFAULT 'trial',
	`settings` json,
	`razorpay_linked_account_id` varchar(255),
	`platform_fee_rate` decimal(5,4) DEFAULT '0.0500',
	CONSTRAINT `organization_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`order_id` varchar(36) NOT NULL,
	`razorpay_payment_id` varchar(255) NOT NULL,
	`razorpay_transfer_id` varchar(255),
	`status` enum('captured','failed','refunded') NOT NULL,
	`captured_at` timestamp,
	`refund_id` varchar(255),
	`refunded_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_razorpay_payment_id_unique` UNIQUE(`razorpay_payment_id`)
);
--> statement-breakpoint
CREATE TABLE `practest_attempt_events` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(255),
	`session_id` varchar(36) NOT NULL,
	`question_id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`selected_answer` text,
	`is_correct` tinyint(1) NOT NULL DEFAULT 0,
	`marks_awarded` int NOT NULL DEFAULT 0,
	`time_spent_seconds` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `practest_attempt_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practest_question_bank` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`question_text` text,
	`question_type` text,
	`option_a` text,
	`option_b` text,
	`option_c` text,
	`option_d` text,
	`correct_option` text,
	`model_answer` text,
	`marking_rubric` json,
	`keywords` json,
	`explanation` text,
	`max_marks` int,
	`time_limit_seconds` int,
	`question_image_url` text,
	`option_images` json,
	`explanation_image_url` text,
	`has_math_content` tinyint(1) DEFAULT 0,
	`has_chemical_formulas` tinyint(1) DEFAULT 0,
	`has_diagrams` tinyint(1) DEFAULT 0,
	`board` text,
	`class_level` int,
	`subject` text,
	`chapter` text,
	`topic` text,
	`subtopic` text,
	`difficulty_level` text,
	`bloom_level` text,
	`usage_count` int,
	`total_attempts` int,
	`correct_attempts` int,
	`average_time_seconds` int,
	`validation_status` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`casa_book` varchar(255),
	`casa_edition` varchar(50),
	`casa_page` int,
	`casa_anchor` varchar(255),
	`casa_verified` tinyint(1) NOT NULL DEFAULT 0,
	CONSTRAINT `practest_question_bank_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practest_test_configurations` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`name` text,
	`description` text,
	`board` text,
	`class_level` int,
	`subject` text,
	`chapters` json,
	`topics` json,
	`total_questions` int,
	`duration_minutes` int,
	`max_marks` int,
	`negative_marking` int,
	`partial_marking` tinyint(1) DEFAULT 0,
	`difficulty_distribution` json,
	`question_type_distribution` json,
	`bloom_distribution` json,
	`randomize_questions` tinyint(1) DEFAULT 0,
	`randomize_options` tinyint(1) DEFAULT 0,
	`allow_review` tinyint(1) DEFAULT 0,
	`show_results_immediately` tinyint(1) DEFAULT 0,
	`instructions` text,
	`rules` json,
	`is_active` tinyint(1) DEFAULT 0,
	`is_public` tinyint(1) DEFAULT 0,
	`created_by` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `practest_test_configurations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practest_test_sessions` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255),
	`configuration_id` varchar(36),
	`custom_parameters` json,
	`selected_questions` json,
	`max_possible_score` int,
	`start_time` timestamp,
	`status` text,
	`current_question_index` int,
	`user_responses` json,
	`time_remaining_seconds` int,
	`total_score` int,
	`percentage` int,
	`end_time` timestamp,
	`duration_seconds` int,
	`question_wise_results` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `practest_test_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_answers` (
	`id` varchar(36) NOT NULL,
	`attempt_id` varchar(36) NOT NULL,
	`question_id` varchar(36) NOT NULL,
	`selected_option_id` varchar(36),
	`is_correct` tinyint(1) NOT NULL DEFAULT 0,
	CONSTRAINT `quiz_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` varchar(36) NOT NULL,
	`quiz_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`score` decimal(5,2),
	`total_questions` int NOT NULL,
	`correct_answers` int,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `quiz_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_options` (
	`id` varchar(36) NOT NULL,
	`question_id` varchar(36) NOT NULL,
	`option_text` varchar(500) NOT NULL,
	`is_correct` tinyint(1) NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `quiz_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` varchar(36) NOT NULL,
	`quiz_id` varchar(36) NOT NULL,
	`question_text` text NOT NULL,
	`explanation` text,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `quiz_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` varchar(36) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`time_limit_minutes` int,
	`passing_score` decimal(5,2),
	`shuffle_questions` tinyint(1) NOT NULL DEFAULT 0,
	`allow_multiple_attempts` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quota_alerts` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`alert_type` varchar(50),
	`message` text,
	`is_read` tinyint(1) DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `quota_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sarvagya_credit_transactions` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`amount` int NOT NULL,
	`type` varchar(50) NOT NULL,
	`reason` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `sarvagya_credit_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sarvagya_documents` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`space_id` varchar(36),
	`internal_doc_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` text,
	`file_type` varchar(50),
	`size` int,
	`status` varchar(50),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `sarvagya_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sarvagya_queries` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`space_id` varchar(36),
	`user_id` varchar(255) NOT NULL,
	`query` text NOT NULL,
	`response` text,
	`tokens_used` int DEFAULT 0,
	`credits_deducted` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `sarvagya_queries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sarvagya_spaces` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`internal_space_id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sarvagya_spaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(255) NOT NULL,
	`active_organization_id` varchar(255),
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `student_engagement_snapshots` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`week_of` date NOT NULL,
	`engagement_score` decimal(5,2) DEFAULT '0.00',
	`risk_score` decimal(5,2) DEFAULT '0.00',
	`videos_watched` int DEFAULT 0,
	`quizzes_taken` int DEFAULT 0,
	`avg_quiz_score` decimal(5,2),
	`minutes_active` int DEFAULT 0,
	`streak_days` int DEFAULT 0,
	CONSTRAINT `student_engagement_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_snapshot_user_batch_week` UNIQUE(`user_id`,`batch_id`,`week_of`)
);
--> statement-breakpoint
CREATE TABLE `student_video_progress` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`tenant_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`video_id` varchar(36) NOT NULL,
	`max_watched_seconds` int DEFAULT 0,
	`completion_percentage` decimal(5,2) DEFAULT '0.00',
	`last_watched_at` timestamp DEFAULT (now()),
	CONSTRAINT `student_video_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_svp_user_video` UNIQUE(`user_id`,`video_id`)
);
--> statement-breakpoint
CREATE TABLE `student_yearly_growth` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`year` int NOT NULL,
	`total_minutes` int DEFAULT 0,
	`courses_enrolled` int DEFAULT 0,
	`courses_completed` int DEFAULT 0,
	`avg_quiz_score` decimal(5,2),
	`certificates_earned` int DEFAULT 0,
	`computed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `student_yearly_growth_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_growth_user_year` UNIQUE(`user_id`,`year`)
);
--> statement-breakpoint
CREATE TABLE `subscription_history` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`subscription_id` varchar(36),
	`action` varchar(50),
	`previous_status` varchar(50),
	`new_status` varchar(50),
	`reason` text,
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `subscription_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`plan_name` varchar(100) NOT NULL,
	`plan_code` varchar(50) NOT NULL,
	`plan_type` enum('free_trial','board_access','class_access','subject_bundle','full_access') NOT NULL,
	`board` enum('CBSE','ICSE','STATE_BOARD','ALL','State') NOT NULL,
	`class_level` int,
	`class_access_type` enum('single','all') DEFAULT 'single',
	`included_subjects` json,
	`monthly_price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`quarterly_price` decimal(10,2),
	`yearly_price` decimal(10,2),
	`daily_question_limit` int DEFAULT 30,
	`features` json,
	`display_name` varchar(150) NOT NULL,
	`description` text,
	`highlight_text` varchar(255),
	`display_order` int DEFAULT 0,
	`is_active` tinyint(1) DEFAULT 1,
	`is_featured` tinyint(1) DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plans_plan_code_unique` UNIQUE(`plan_code`),
	CONSTRAINT `subscription_plans_plan_name_unique` UNIQUE(`plan_name`)
);
--> statement-breakpoint
CREATE TABLE `taxonomy_courses` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`domain_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `taxonomy_courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taxonomy_domains` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`name` varchar(255) NOT NULL,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `taxonomy_domains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taxonomy_levels` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`course_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `taxonomy_levels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taxonomy_subjects` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`level_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `taxonomy_subjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_activity_logs` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
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
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`teacher_id` varchar(255) NOT NULL,
	`class_id` varchar(36) NOT NULL,
	`assigned_by` varchar(255),
	`is_active` tinyint(1) DEFAULT 1,
	`assigned_at` timestamp DEFAULT (now()),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacher_class_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_verification_documents` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
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
CREATE TABLE `user` (
	`id` varchar(255) NOT NULL,
	`name` text NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` tinyint(1) NOT NULL DEFAULT 0,
	`image` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`role` varchar(255) DEFAULT 'student',
	`class_id` varchar(255),
	`first_name` varchar(100),
	`last_name` varchar(100),
	`approval_status` enum('approved','pending','rejected'),
	`verification_status` enum('verified_email','unverified','manual'),
	`verification_method` varchar(255),
	`email_domain` varchar(255),
	`is_educational_domain` tinyint(1) DEFAULT 0,
	`verified_at` timestamp,
	`preferences` json,
	`last_login` timestamp,
	`approved_by` varchar(255),
	`approved_at` timestamp,
	`rejection_reason` text,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `user_material_access` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255),
	`access_type` text,
	`filter_data` json,
	`ip_address` text,
	`user_agent` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`material_id` varchar(36),
	`access_count` int NOT NULL DEFAULT 1,
	CONSTRAINT `user_material_access_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_uma_user_material` UNIQUE(`user_id`,`material_id`)
);
--> statement-breakpoint
CREATE TABLE `user_notes` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`clerk_id` varchar(255),
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`content_format` enum('plain','markdown','html') DEFAULT 'markdown',
	`subject` varchar(100),
	`chapter` varchar(255),
	`board` enum('CBSE','ICSE','STATE_BOARD'),
	`class_level` varchar(20),
	`orientation` enum('portrait','landscape') DEFAULT 'portrait',
	`tags` json,
	`source_type` enum('ai_tutor','manual','imported') DEFAULT 'manual',
	`source_query` text,
	`source_answer` text,
	`source_visualizations` json,
	`folder_id` varchar(36),
	`is_favorite` tinyint(1) DEFAULT 0,
	`is_archived` tinyint(1) DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`last_accessed_at` timestamp DEFAULT (now()),
	`cover_design` varchar(50) DEFAULT 'solid-blue',
	`spine_color` varchar(20) DEFAULT '#3B82F6',
	`is_pinned` tinyint(1) DEFAULT 0,
	`page_size` varchar(16) DEFAULT 'A4',
	`page_margins` varchar(16) DEFAULT 'normal',
	CONSTRAINT `user_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(255) NOT NULL,
	`clerk_id` varchar(255),
	`subscription_plan_id` varchar(36),
	`subscription_type` enum('free_trial','board_access','class_access','subject_bundle','full_access') NOT NULL,
	`subscription_status` enum('active','inactive','trial','pending','expired','cancelled') NOT NULL DEFAULT 'trial',
	`purchased_board` enum('CBSE','ICSE','STATE_BOARD','ALL','State'),
	`purchased_class` int,
	`class_access_type` enum('single','all') DEFAULT 'single',
	`purchased_subjects` json,
	`plan_name` varchar(100) NOT NULL,
	`plan_code` varchar(50) NOT NULL,
	`monthly_price` decimal(10,2) NOT NULL,
	`billing_cycle` enum('monthly','quarterly','yearly') DEFAULT 'monthly',
	`daily_question_limit` int DEFAULT 30,
	`start_date` timestamp NOT NULL DEFAULT (now()),
	`expiry_date` timestamp NOT NULL,
	`last_payment_date` timestamp,
	`next_billing_date` timestamp,
	`cancelled_at` timestamp,
	`payment_status` enum('paid','pending','failed','refunded') DEFAULT 'pending',
	`payment_gateway` varchar(50),
	`transaction_id` varchar(255),
	`payment_metadata` json,
	`auto_renew` tinyint(1) DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`sarvagya_credits` int DEFAULT 0,
	`sarvagya_monthly_quota` int DEFAULT 100,
	`sarvagya_daily_limit` int DEFAULT 10,
	`last_credits_reset` timestamp DEFAULT (now()),
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_vocab_progress` (
	`organization_id` varchar(255),
	`id` bigint unsigned NOT NULL AUTO_INCREMENT,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255),
	`word_id` bigint unsigned NOT NULL,
	`efactor` decimal(3,2) DEFAULT '2.50',
	`interval_days` int DEFAULT 1,
	`repetitions` int DEFAULT 0,
	`next_due_date` date NOT NULL,
	`last_reviewed` timestamp,
	`correct_attempts` int DEFAULT 0,
	`total_attempts` int DEFAULT 0,
	`accuracy_percentage` decimal(5,2) DEFAULT '0.00',
	`status` enum('new','learning','review','mastered') DEFAULT 'new',
	`first_learned_at` timestamp,
	`mastered_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_vocab_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `id` UNIQUE(`id`),
	CONSTRAINT `unique_user_word` UNIQUE(`user_id`,`word_id`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(255) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_assets` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`tenant_id` varchar(255),
	`domain` varchar(100) NOT NULL,
	`course` varchar(100) NOT NULL,
	`level` varchar(100) NOT NULL,
	`subject` varchar(100) NOT NULL,
	`book` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`provider` varchar(50) NOT NULL DEFAULT 'bunny',
	`provider_video_id` varchar(255) NOT NULL,
	`duration_seconds` int,
	`thumbnail_url` varchar(512),
	`status` enum('uploading','processing','ready','failed') DEFAULT 'uploading',
	`sort_order` int DEFAULT 0,
	`is_free_preview` tinyint(1) DEFAULT 0,
	`created_by` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`subject_id` varchar(36),
	`book_tag` text,
	`level_id` varchar(36),
	CONSTRAINT `video_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_provider_idx` UNIQUE(`tenant_id`,`provider_video_id`)
);
--> statement-breakpoint
CREATE TABLE `video_chapters` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`video_asset_id` varchar(36) NOT NULL,
	`tenant_id` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`start_seconds` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_chapters_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_chapter_video_start` UNIQUE(`video_asset_id`,`start_seconds`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD CONSTRAINT `admin_activity_log_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_tutor_usage` ADD CONSTRAINT `ai_tutor_usage_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `answer_feedback` ADD CONSTRAINT `answer_feedback_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_coupons` ADD CONSTRAINT `batch_coupons_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_templates` ADD CONSTRAINT `batch_templates_level_id_taxonomy_levels_id_fk` FOREIGN KEY (`level_id`) REFERENCES `taxonomy_levels`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_waitlist` ADD CONSTRAINT `batch_waitlist_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_waitlist` ADD CONSTRAINT `batch_waitlist_org_id_organization_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_waitlist` ADD CONSTRAINT `batch_waitlist_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batches` ADD CONSTRAINT `batches_level_id_taxonomy_levels_id_fk` FOREIGN KEY (`level_id`) REFERENCES `taxonomy_levels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batches` ADD CONSTRAINT `batches_org_id_organization_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batches` ADD CONSTRAINT `batches_template_id_batch_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `batch_templates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classes` ADD CONSTRAINT `classes_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_phrases` ADD CONSTRAINT `community_phrases_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_phrases` ADD CONSTRAINT `community_phrases_word_id_dictionary_words_id_fk` FOREIGN KEY (`word_id`) REFERENCES `dictionary_words`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_offline_sync` ADD CONSTRAINT `dictionary_offline_sync_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_search_history` ADD CONSTRAINT `dictionary_search_history_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_search_history` ADD CONSTRAINT `dict_search_word_fk` FOREIGN KEY (`selected_word_id`) REFERENCES `dictionary_words`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_user_stats` ADD CONSTRAINT `dictionary_user_stats_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_words` ADD CONSTRAINT `dictionary_words_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enhanced_user_profiles` ADD CONSTRAINT `enhanced_user_profiles_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_org_id_organization_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `free_trials` ADD CONSTRAINT `free_trials_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `google_drive_config` ADD CONSTRAINT `google_drive_config_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `google_drive_folders` ADD CONSTRAINT `google_drive_folders_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_join_requests` ADD CONSTRAINT `institution_join_requests_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_join_requests` ADD CONSTRAINT `institution_join_requests_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_profiles` ADD CONSTRAINT `institution_profiles_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_inviter_id_user_id_fk` FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_approval_log` ADD CONSTRAINT `material_approval_log_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_approval_log` ADD CONSTRAINT `material_approval_log_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member` ADD CONSTRAINT `member_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member` ADD CONSTRAINT `member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_activity_log` ADD CONSTRAINT `note_activity_log_note_id_user_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `user_notes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_activity_log` ADD CONSTRAINT `note_activity_log_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_folders` ADD CONSTRAINT `note_folders_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_links` ADD CONSTRAINT `note_links_source_note_id_user_notes_id_fk` FOREIGN KEY (`source_note_id`) REFERENCES `user_notes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_shares` ADD CONSTRAINT `note_shares_note_id_user_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `user_notes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_shares` ADD CONSTRAINT `note_shares_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_templates` ADD CONSTRAINT `note_templates_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_org_id_organization_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_student_id_user_id_fk` FOREIGN KEY (`student_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD CONSTRAINT `practest_question_bank_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` ADD CONSTRAINT `practest_test_configurations_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practest_test_sessions` ADD CONSTRAINT `practest_test_sessions_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quiz_answers` ADD CONSTRAINT `quiz_answers_attempt_id_quiz_attempts_id_fk` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD CONSTRAINT `quiz_attempts_quiz_id_quizzes_id_fk` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quiz_options` ADD CONSTRAINT `quiz_options_question_id_quiz_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quiz_questions` ADD CONSTRAINT `quiz_questions_quiz_id_quizzes_id_fk` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quota_alerts` ADD CONSTRAINT `quota_alerts_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_credit_transactions` ADD CONSTRAINT `sarvagya_credit_transactions_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_documents` ADD CONSTRAINT `sarvagya_documents_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_documents` ADD CONSTRAINT `sarvagya_documents_space_id_sarvagya_spaces_id_fk` FOREIGN KEY (`space_id`) REFERENCES `sarvagya_spaces`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_queries` ADD CONSTRAINT `sarvagya_queries_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_queries` ADD CONSTRAINT `sarvagya_queries_space_id_sarvagya_spaces_id_fk` FOREIGN KEY (`space_id`) REFERENCES `sarvagya_spaces`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_spaces` ADD CONSTRAINT `sarvagya_spaces_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_video_progress` ADD CONSTRAINT `student_video_progress_tenant_id_organization_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_video_progress` ADD CONSTRAINT `student_video_progress_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_video_progress` ADD CONSTRAINT `student_video_progress_video_id_video_assets_id_fk` FOREIGN KEY (`video_id`) REFERENCES `video_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_history` ADD CONSTRAINT `subscription_history_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_history` ADD CONSTRAINT `subscription_history_subscription_id_user_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `user_subscriptions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD CONSTRAINT `subscription_plans_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxonomy_courses` ADD CONSTRAINT `taxonomy_courses_domain_id_taxonomy_domains_id_fk` FOREIGN KEY (`domain_id`) REFERENCES `taxonomy_domains`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxonomy_levels` ADD CONSTRAINT `taxonomy_levels_course_id_taxonomy_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `taxonomy_courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taxonomy_subjects` ADD CONSTRAINT `taxonomy_subjects_level_id_taxonomy_levels_id_fk` FOREIGN KEY (`level_id`) REFERENCES `taxonomy_levels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_activity_logs` ADD CONSTRAINT `teacher_activity_logs_teacher_id_user_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_class_assignments` ADD CONSTRAINT `teacher_class_assignments_class_id_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_class_assignments` ADD CONSTRAINT `teacher_class_assignments_teacher_id_user_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teacher_verification_documents` ADD CONSTRAINT `teacher_verification_documents_teacher_id_user_id_fk` FOREIGN KEY (`teacher_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_material_access` ADD CONSTRAINT `user_material_access_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_material_access` ADD CONSTRAINT `user_material_access_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_notes` ADD CONSTRAINT `user_notes_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_subscription_plan_id_subscription_plans_id_fk` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_vocab_progress` ADD CONSTRAINT `user_vocab_progress_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_vocab_progress` ADD CONSTRAINT `user_vocab_progress_word_id_dictionary_words_id_fk` FOREIGN KEY (`word_id`) REFERENCES `dictionary_words`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_assets` ADD CONSTRAINT `video_assets_level_id_taxonomy_levels_id_fk` FOREIGN KEY (`level_id`) REFERENCES `taxonomy_levels`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_assets` ADD CONSTRAINT `video_assets_subject_id_taxonomy_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `taxonomy_subjects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_assets` ADD CONSTRAINT `video_assets_tenant_id_organization_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_chapters` ADD CONSTRAINT `video_chapters_video_asset_id_video_assets_id_fk` FOREIGN KEY (`video_asset_id`) REFERENCES `video_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_announcements_batch` ON `announcements` (`batch_id`);--> statement-breakpoint
CREATE INDEX `idx_announcements_org` ON `announcements` (`org_id`);--> statement-breakpoint
CREATE INDEX `ijr_org_idx` ON `institution_join_requests` (`organization_id`);--> statement-breakpoint
CREATE INDEX `ijr_status_idx` ON `institution_join_requests` (`status`);--> statement-breakpoint
CREATE INDEX `ijr_user_idx` ON `institution_join_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_le_batch_time` ON `learning_events` (`batch_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_le_user_time` ON `learning_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE INDEX `pae_question_idx` ON `practest_attempt_events` (`question_id`);--> statement-breakpoint
CREATE INDEX `pae_session_idx` ON `practest_attempt_events` (`session_id`);--> statement-breakpoint
CREATE INDEX `pae_user_idx` ON `practest_attempt_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_quiz_attempts_user` ON `quiz_attempts` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_svp_tenant_user` ON `student_video_progress` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_uma_material` ON `user_material_access` (`material_id`);--> statement-breakpoint
CREATE INDEX `idx_uma_org_user` ON `user_material_access` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `idx_video_chapters_asset` ON `video_chapters` (`video_asset_id`);--> statement-breakpoint
CREATE INDEX `idx_video_chapters_tenant` ON `video_chapters` (`tenant_id`);
