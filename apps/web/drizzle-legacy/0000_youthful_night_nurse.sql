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
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(36),
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
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`date` timestamp DEFAULT (now()),
	`questions_asked` int DEFAULT 0,
	`total_tokens_used` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_tutor_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `answer_feedback` (
	`organization_id` varchar(255),
	`id` serial AUTO_INCREMENT NOT NULL,
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
	CONSTRAINT `answer_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_phrases` (
	`organization_id` varchar(255),
	`id` serial AUTO_INCREMENT NOT NULL,
	`word_id` bigint unsigned NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255) NOT NULL,
	`phrase` text NOT NULL,
	`context` text,
	`region` varchar(100),
	`language_variant` varchar(50),
	`is_approved` boolean DEFAULT false,
	`approved_by` varchar(255),
	`approved_at` timestamp,
	`rejection_reason` text,
	`upvotes` int DEFAULT 0,
	`downvotes` int DEFAULT 0,
	`reports` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_phrases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dictionary_offline_sync` (
	`organization_id` varchar(255),
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255) NOT NULL,
	`sync_version` int DEFAULT 1,
	`last_full_sync` timestamp,
	`last_incremental_sync` timestamp,
	`words_synced` int DEFAULT 0,
	`audio_files_cached` int DEFAULT 0,
	`total_cache_size_mb` decimal(8,2) DEFAULT '0.00',
	`auto_sync_enabled` boolean DEFAULT true,
	`wifi_only_sync` boolean DEFAULT true,
	`max_cache_size_mb` int DEFAULT 100,
	`pending_progress_updates` json,
	`pending_phrase_submissions` json,
	`pending_search_history` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dictionary_offline_sync_id` PRIMARY KEY(`id`),
	CONSTRAINT `dictionary_offline_sync_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `dictionary_search_history` (
	`organization_id` varchar(255),
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255) NOT NULL,
	`search_query` varchar(255) NOT NULL,
	`search_type` enum('exact','fuzzy','phonetic','semantic') NOT NULL,
	`results_count` int DEFAULT 0,
	`selected_word_id` bigint unsigned,
	`search_context` enum('learning','quiz','browse','community') DEFAULT 'browse',
	`device_type` enum('mobile','tablet','desktop') DEFAULT 'desktop',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `dictionary_search_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dictionary_user_stats` (
	`organization_id` varchar(255),
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255) NOT NULL,
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
	CONSTRAINT `dictionary_user_stats_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `dictionary_user_stats_clerk_user_id_unique` UNIQUE(`clerk_user_id`)
);
--> statement-breakpoint
CREATE TABLE `dictionary_words` (
	`organization_id` varchar(255),
	`id` serial AUTO_INCREMENT NOT NULL,
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
	`is_active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dictionary_words_id` PRIMARY KEY(`id`),
	CONSTRAINT `dictionary_words_word_unique` UNIQUE(`word`)
);
--> statement-breakpoint
CREATE TABLE `enhanced_user_profiles` (
	`organization_id` varchar(255),
	`id` serial AUTO_INCREMENT NOT NULL,
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
	`is_onboarding_complete` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enhanced_user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `enhanced_user_profiles_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `free_trials` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`trial_start` timestamp DEFAULT (now()),
	`trial_end` timestamp,
	`is_converted` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `free_trials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `google_drive_config` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(36),
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
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`folder_id` varchar(255) NOT NULL,
	`folder_name` varchar(255) NOT NULL,
	`parent_folder_id` varchar(255),
	`folder_path` text NOT NULL,
	`board` enum('CBSE','ICSE','STATE_BOARD','ALL','State'),
	`class` int,
	`subject` varchar(100),
	`material_type` enum('notes','summaries','mind_maps','quizzes','textbooks','reference'),
	`is_active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_drive_folders_id` PRIMARY KEY(`id`),
	CONSTRAINT `google_drive_folders_folder_id_unique` UNIQUE(`folder_id`)
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
CREATE TABLE `material_approval_log` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(36),
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
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
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
	`is_active` boolean DEFAULT true,
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
	CONSTRAINT `member_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `note_activity_log` (
	`organization_id` varchar(255),
	`id` serial AUTO_INCREMENT NOT NULL,
	`note_id` varchar(36) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`activity_type` enum('created','updated','viewed','shared','exported','deleted') NOT NULL,
	`changes_summary` text,
	`ip_address` varchar(45),
	`user_agent` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `note_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `note_folders` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`clerk_id` varchar(255) NOT NULL,
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
CREATE TABLE `note_shares` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`note_id` varchar(36) NOT NULL,
	`shared_by_user_id` varchar(255) NOT NULL,
	`shared_with_user_id` varchar(255),
	`permission` enum('view','edit','comment') DEFAULT 'view',
	`is_public` boolean DEFAULT false,
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
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`description` text,
	`template_content` text NOT NULL,
	`category` enum('general','subject_notes','exam_prep','revision','summary') DEFAULT 'general',
	`subject` varchar(100),
	`class_level` varchar(20),
	`is_public` boolean DEFAULT false,
	`created_by_user_id` varchar(255),
	`usage_count` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `note_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`type` varchar(50),
	`title` varchar(255),
	`message` text,
	`is_read` boolean DEFAULT false,
	`metadata` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` varchar(255) NOT NULL,
	`name` text NOT NULL,
	`slug` varchar(255) NOT NULL,
	`logo` text,
	`created_at` timestamp NOT NULL,
	`metadata` text,
	CONSTRAINT `organization_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `practest_question_bank` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(36),
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
	`has_math_content` boolean DEFAULT false,
	`has_chemical_formulas` boolean DEFAULT false,
	`has_diagrams` boolean DEFAULT false,
	`board` text,
	`class_level` int,
	`subject` text,
	`chapter` text,
	`topic` text,
	`subtopic` text,
	`usage_count` int,
	`total_attempts` int,
	`correct_attempts` int,
	`average_time_seconds` int,
	`validation_status` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `practest_question_bank_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practest_test_configurations` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(36),
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
	`partial_marking` boolean DEFAULT false,
	`difficulty_distribution` json,
	`question_type_distribution` json,
	`bloom_distribution` json,
	`randomize_questions` boolean DEFAULT false,
	`randomize_options` boolean DEFAULT false,
	`allow_review` boolean DEFAULT false,
	`show_results_immediately` boolean DEFAULT false,
	`instructions` text,
	`rules` json,
	`is_active` boolean DEFAULT false,
	`is_public` boolean DEFAULT false,
	`created_by` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `practest_test_configurations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practest_test_sessions` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(36),
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
CREATE TABLE `quota_alerts` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`alert_type` varchar(50),
	`message` text,
	`is_read` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `quota_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sarvagya_credit_transactions` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
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
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
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
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
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
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
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
CREATE TABLE `subscription_history` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
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
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
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
	`is_active` boolean DEFAULT true,
	`is_featured` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plans_plan_name_unique` UNIQUE(`plan_name`),
	CONSTRAINT `subscription_plans_plan_code_unique` UNIQUE(`plan_code`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`domain` varchar(255),
	`subscription_plan` enum('starter','pro','enterprise') NOT NULL DEFAULT 'starter',
	`subscription_status` enum('active','inactive','trial','pending','expired','cancelled') NOT NULL DEFAULT 'trial',
	`settings` json,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(255) NOT NULL,
	`name` text NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`role` varchar(255) DEFAULT 'student',
	`class_id` varchar(255),
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `user_material_access` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(36),
	`user_id` text,
	`access_type` text,
	`filter_data` json,
	`ip_address` text,
	`user_agent` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_material_access_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_notes` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`clerk_id` varchar(255) NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
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
	`is_favorite` boolean DEFAULT false,
	`is_archived` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`last_accessed_at` timestamp DEFAULT (now()),
	CONSTRAINT `user_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`organization_id` varchar(255),
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
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
	`auto_renew` boolean DEFAULT true,
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
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`clerk_user_id` varchar(255) NOT NULL,
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
	CONSTRAINT `unique_user_word` UNIQUE(`user_id`,`word_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`tenant_id` varchar(36),
	`clerk_id` varchar(255),
	`email` varchar(255) NOT NULL,
	`role` enum('student','teacher','parent','admin','parent_guardian') NOT NULL,
	`approval_status` enum('approved','pending','rejected'),
	`verification_status` enum('verified_email','unverified','manual'),
	`verification_method` varchar(255),
	`email_domain` varchar(255),
	`is_educational_domain` boolean DEFAULT false,
	`verified_at` timestamp,
	`first_name` varchar(100),
	`last_name` varchar(100),
	`class_id` varchar(36),
	`profile_image_url` text,
	`preferences` json,
	`last_login` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
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
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD CONSTRAINT `admin_activity_log_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_activity_log` ADD CONSTRAINT `admin_activity_log_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_tutor_usage` ADD CONSTRAINT `ai_tutor_usage_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `answer_feedback` ADD CONSTRAINT `answer_feedback_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_phrases` ADD CONSTRAINT `community_phrases_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `community_phrases` ADD CONSTRAINT `community_phrases_word_id_dictionary_words_id_fk` FOREIGN KEY (`word_id`) REFERENCES `dictionary_words`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_offline_sync` ADD CONSTRAINT `dictionary_offline_sync_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_search_history` ADD CONSTRAINT `dictionary_search_history_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_search_history` ADD CONSTRAINT `dict_search_word_fk` FOREIGN KEY (`selected_word_id`) REFERENCES `dictionary_words`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_user_stats` ADD CONSTRAINT `dictionary_user_stats_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictionary_words` ADD CONSTRAINT `dictionary_words_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enhanced_user_profiles` ADD CONSTRAINT `enhanced_user_profiles_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `free_trials` ADD CONSTRAINT `free_trials_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `google_drive_config` ADD CONSTRAINT `google_drive_config_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `google_drive_config` ADD CONSTRAINT `google_drive_config_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `google_drive_folders` ADD CONSTRAINT `google_drive_folders_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_inviter_id_user_id_fk` FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_approval_log` ADD CONSTRAINT `material_approval_log_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_approval_log` ADD CONSTRAINT `material_approval_log_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `material_approval_log` ADD CONSTRAINT `material_approval_log_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member` ADD CONSTRAINT `member_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member` ADD CONSTRAINT `member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_activity_log` ADD CONSTRAINT `note_activity_log_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_activity_log` ADD CONSTRAINT `note_activity_log_note_id_user_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `user_notes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_folders` ADD CONSTRAINT `note_folders_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_shares` ADD CONSTRAINT `note_shares_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_shares` ADD CONSTRAINT `note_shares_note_id_user_notes_id_fk` FOREIGN KEY (`note_id`) REFERENCES `user_notes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `note_templates` ADD CONSTRAINT `note_templates_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD CONSTRAINT `practest_question_bank_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practest_question_bank` ADD CONSTRAINT `practest_question_bank_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` ADD CONSTRAINT `practest_test_configurations_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practest_test_configurations` ADD CONSTRAINT `practest_test_configurations_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practest_test_sessions` ADD CONSTRAINT `practest_test_sessions_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `practest_test_sessions` ADD CONSTRAINT `practest_test_sessions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quota_alerts` ADD CONSTRAINT `quota_alerts_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_credit_transactions` ADD CONSTRAINT `sarvagya_credit_transactions_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_documents` ADD CONSTRAINT `sarvagya_documents_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_documents` ADD CONSTRAINT `sarvagya_documents_space_id_sarvagya_spaces_id_fk` FOREIGN KEY (`space_id`) REFERENCES `sarvagya_spaces`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_queries` ADD CONSTRAINT `sarvagya_queries_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_queries` ADD CONSTRAINT `sarvagya_queries_space_id_sarvagya_spaces_id_fk` FOREIGN KEY (`space_id`) REFERENCES `sarvagya_spaces`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sarvagya_spaces` ADD CONSTRAINT `sarvagya_spaces_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_history` ADD CONSTRAINT `subscription_history_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_history` ADD CONSTRAINT `subscription_history_subscription_id_user_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `user_subscriptions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_plans` ADD CONSTRAINT `subscription_plans_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_material_access` ADD CONSTRAINT `user_material_access_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_material_access` ADD CONSTRAINT `user_material_access_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_notes` ADD CONSTRAINT `user_notes_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_subscription_plan_id_subscription_plans_id_fk` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_vocab_progress` ADD CONSTRAINT `user_vocab_progress_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_vocab_progress` ADD CONSTRAINT `user_vocab_progress_word_id_dictionary_words_id_fk` FOREIGN KEY (`word_id`) REFERENCES `dictionary_words`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);