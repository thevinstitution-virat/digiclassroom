CREATE TABLE "account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_activity_log" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"admin_id" text,
	"action" text,
	"details" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_tutor_usage" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"date" timestamp DEFAULT now(),
	"questions_asked" integer DEFAULT 0,
	"total_tokens_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"org_id" varchar(36) NOT NULL,
	"author_id" varchar(36) NOT NULL,
	"title" varchar(150) NOT NULL,
	"body" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answer_feedback" (
	"organization_id" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"question_text" text,
	"answer_text" text,
	"subject" varchar(100),
	"class_level" integer,
	"board" varchar(50),
	"star_rating" integer,
	"thumbs_rating" varchar(10),
	"feedback_text" text,
	"validation_status" varchar(20) DEFAULT 'pending',
	"validated_by" varchar(255),
	"validated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"debug_mode" boolean DEFAULT false NOT NULL,
	"session_timeout_minutes" integer DEFAULT 60 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "batch_coupons" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"code" varchar(50) NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"level_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "batch_waitlist" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"notified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"template_id" varchar(36),
	"org_id" varchar(255) NOT NULL,
	"level_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10, 2) DEFAULT '0.00',
	"start_date" date,
	"is_active" boolean DEFAULT true,
	"join_code" varchar(8),
	"max_students" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "batches_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"org_id" varchar(36) NOT NULL,
	"certificate_number" varchar(50) NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_certificate_number_unique" UNIQUE("certificate_number")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"description" text,
	"grade_level" integer NOT NULL,
	"qdrant_namespace" varchar(255),
	"subjects" json,
	"teacher_ids" json,
	"student_count" integer DEFAULT 0,
	"settings" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_phrases" (
	"organization_id" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"word_id" bigint NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"clerk_user_id" varchar(255),
	"phrase" text NOT NULL,
	"context" text,
	"region" varchar(100),
	"language_variant" varchar(50),
	"is_approved" boolean DEFAULT false,
	"approved_by" varchar(255),
	"approved_at" timestamp,
	"rejection_reason" text,
	"upvotes" integer DEFAULT 0,
	"downvotes" integer DEFAULT 0,
	"reports" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dictionary_offline_sync" (
	"organization_id" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"clerk_user_id" varchar(255),
	"sync_version" integer DEFAULT 1,
	"last_full_sync" timestamp,
	"last_incremental_sync" timestamp,
	"words_synced" integer DEFAULT 0,
	"audio_files_cached" integer DEFAULT 0,
	"total_cache_size_mb" numeric(8, 2) DEFAULT '0.00',
	"auto_sync_enabled" boolean DEFAULT true,
	"wifi_only_sync" boolean DEFAULT true,
	"max_cache_size_mb" integer DEFAULT 100,
	"pending_progress_updates" json,
	"pending_phrase_submissions" json,
	"pending_search_history" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dictionary_offline_sync_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "dictionary_search_history" (
	"organization_id" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"clerk_user_id" varchar(255),
	"search_query" varchar(255) NOT NULL,
	"search_type" text NOT NULL,
	"results_count" integer DEFAULT 0,
	"selected_word_id" bigint,
	"search_context" text DEFAULT 'browse',
	"device_type" text DEFAULT 'desktop',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dictionary_user_stats" (
	"organization_id" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"clerk_user_id" varchar(255),
	"total_words_learned" integer DEFAULT 0,
	"words_mastered" integer DEFAULT 0,
	"current_streak_days" integer DEFAULT 0,
	"longest_streak_days" integer DEFAULT 0,
	"last_activity_date" date,
	"total_quiz_attempts" integer DEFAULT 0,
	"correct_quiz_answers" integer DEFAULT 0,
	"average_accuracy" numeric(5, 2) DEFAULT '0.00',
	"total_points" integer DEFAULT 0,
	"level" integer DEFAULT 1,
	"badges_earned" json,
	"achievements" json,
	"phrases_contributed" integer DEFAULT 0,
	"phrases_approved" integer DEFAULT 0,
	"community_reputation" integer DEFAULT 0,
	"daily_goal_words" integer DEFAULT 5,
	"preferred_difficulty" text DEFAULT 'mixed',
	"notification_preferences" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dictionary_user_stats_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "dictionary_user_stats_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "dictionary_words" (
	"organization_id" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"word" varchar(255) NOT NULL,
	"pronunciation" varchar(255),
	"part_of_speech" text NOT NULL,
	"english_definition" text NOT NULL,
	"english_synonyms" json,
	"english_antonyms" json,
	"hindi_translation" varchar(500) NOT NULL,
	"hindi_synonyms" json,
	"devanagari_script" varchar(500),
	"amarkosha_category" varchar(100),
	"semantic_cluster" varchar(100),
	"etymology" text,
	"examples" json,
	"cultural_context" text,
	"regional_usage" json,
	"audio_url" varchar(500),
	"audio_accent" text DEFAULT 'indian',
	"difficulty_level" text DEFAULT 'intermediate',
	"frequency_rank" integer,
	"source" varchar(100) DEFAULT 'system',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dictionary_words_word_unique" UNIQUE("word")
);
--> statement-breakpoint
CREATE TABLE "enhanced_user_profiles" (
	"organization_id" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"role" text DEFAULT 'student',
	"board_type" text DEFAULT 'CBSE',
	"medium" text DEFAULT 'ENGLISH',
	"grade_level" integer,
	"stream" text,
	"subjects" json,
	"preferences" json,
	"learning_style" varchar(50) DEFAULT 'mixed',
	"learning_pace" varchar(50) DEFAULT 'average',
	"preferred_explanation_complexity" varchar(50) DEFAULT 'intermediate',
	"language_preference" varchar(50) DEFAULT 'english',
	"teaching_experience_years" integer,
	"specialization_subjects" json,
	"classroom_size_preference" integer,
	"child_grade_levels" json,
	"involvement_level" varchar(50),
	"support_preferences" json,
	"interaction_history" json,
	"performance_metrics" json,
	"difficulty_preferences" json,
	"is_onboarding_complete" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "enhanced_user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"status" text DEFAULT 'active',
	"enrolled_at" timestamp DEFAULT now(),
	"email_opt_out" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "free_trials" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"trial_start" timestamp DEFAULT now(),
	"trial_end" timestamp,
	"is_converted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "google_drive_config" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_type" text,
	"scope" text,
	"expiry_date" timestamp,
	"configured_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "google_drive_folders" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"folder_id" varchar(255) NOT NULL,
	"folder_name" varchar(255) NOT NULL,
	"parent_folder_id" varchar(255),
	"folder_path" text NOT NULL,
	"board" text,
	"class" integer,
	"subject" varchar(100),
	"material_type" text,
	"status" text DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_drive_folders_folder_id_unique" UNIQUE("folder_id")
);
--> statement-breakpoint
CREATE TABLE "institution_classes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"level" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "institution_join_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"message" text,
	"requested_class" integer,
	"requested_board" varchar(50),
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "institution_profiles" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"type" text DEFAULT 'school' NOT NULL,
	"address" text,
	"website" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"established_year" integer,
	"primary_color" varchar(50),
	"logo_url" text,
	"banner_url" text,
	"onboarding_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "institution_profiles_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "institution_sections" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"class_id" varchar(36) NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(255),
	"status" varchar(255) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"batch_id" varchar(36),
	"org_id" varchar(36) NOT NULL,
	"event_type" text NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_approval_log" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"material_id" varchar(36),
	"admin_id" text,
	"action" text,
	"comments" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"board" text NOT NULL,
	"medium" text NOT NULL,
	"class" integer NOT NULL,
	"stream" text,
	"subject" varchar(100) NOT NULL,
	"sm_type" varchar(100) DEFAULT 'Chapter Notes',
	"google_drive_file_id" varchar(255) NOT NULL,
	"google_drive_folder_id" varchar(255),
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) DEFAULT 'application/pdf',
	"download_url" text,
	"view_url" text,
	"thumbnail_url" text,
	"download_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"tags" json,
	"difficulty" varchar(50) DEFAULT 'medium',
	"metadata" json,
	"status" text DEFAULT 'draft',
	"is_active" boolean DEFAULT true,
	"created_by" varchar(255),
	"approved_by" varchar(255),
	"rejected_by" varchar(255),
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "materials_google_drive_file_id_unique" UNIQUE("google_drive_file_id")
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" varchar(255) DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_activity_log" (
	"organization_id" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"note_id" varchar(36) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"activity_type" text NOT NULL,
	"changes_summary" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_folders" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"clerk_id" varchar(255),
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(20) DEFAULT 'blue',
	"icon" varchar(50) DEFAULT 'folder',
	"parent_folder_id" varchar(36),
	"folder_path" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_links" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"source_note_id" varchar(36) NOT NULL,
	"target_note_id" varchar(36),
	"link_text" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "note_shares" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"note_id" varchar(36) NOT NULL,
	"shared_by_user_id" varchar(255) NOT NULL,
	"shared_with_user_id" varchar(255),
	"permission" text DEFAULT 'view',
	"is_public" boolean DEFAULT false,
	"share_link" varchar(255),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"accessed_at" timestamp,
	CONSTRAINT "note_shares_share_link_unique" UNIQUE("share_link")
);
--> statement-breakpoint
CREATE TABLE "note_templates" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"template_content" text NOT NULL,
	"category" text DEFAULT 'general',
	"subject" varchar(100),
	"class_level" varchar(20),
	"is_public" boolean DEFAULT false,
	"created_by_user_id" varchar(255),
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" varchar(50),
	"title" varchar(255),
	"message" text,
	"is_read" boolean DEFAULT false,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"student_id" varchar(255) NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"org_id" varchar(255) NOT NULL,
	"amount_paise" integer NOT NULL,
	"platform_fee_paise" integer NOT NULL,
	"platform_fee_rate" numeric(5, 4) NOT NULL,
	"institution_paise" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"razorpay_order_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "orders_razorpay_order_id_unique" UNIQUE("razorpay_order_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(255) NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	"subscription_plan" text DEFAULT 'starter',
	"subscription_status" text DEFAULT 'trial',
	"settings" json,
	"razorpay_linked_account_id" varchar(255),
	"platform_fee_rate" numeric(5, 4) DEFAULT '0.0500',
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"order_id" varchar(36) NOT NULL,
	"razorpay_payment_id" varchar(255) NOT NULL,
	"razorpay_transfer_id" varchar(255),
	"status" text NOT NULL,
	"captured_at" timestamp,
	"refund_id" varchar(255),
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payments_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
CREATE TABLE "practest_attempt_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255),
	"session_id" varchar(36) NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"selected_answer" text,
	"is_correct" boolean DEFAULT false NOT NULL,
	"marks_awarded" integer DEFAULT 0 NOT NULL,
	"time_spent_seconds" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "practest_question_bank" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"question_text" text,
	"question_type" text,
	"option_a" text,
	"option_b" text,
	"option_c" text,
	"option_d" text,
	"correct_option" text,
	"model_answer" text,
	"marking_rubric" json,
	"keywords" json,
	"explanation" text,
	"max_marks" integer,
	"time_limit_seconds" integer,
	"question_image_url" text,
	"option_images" json,
	"explanation_image_url" text,
	"has_math_content" boolean DEFAULT false,
	"has_chemical_formulas" boolean DEFAULT false,
	"has_diagrams" boolean DEFAULT false,
	"board" text,
	"class_level" integer,
	"subject" text,
	"chapter" text,
	"topic" text,
	"subtopic" text,
	"difficulty_level" text,
	"bloom_level" text,
	"casa_book" varchar(255),
	"casa_edition" varchar(50),
	"casa_page" integer,
	"casa_anchor" varchar(255),
	"casa_verified" boolean DEFAULT false NOT NULL,
	"usage_count" integer,
	"total_attempts" integer,
	"correct_attempts" integer,
	"average_time_seconds" integer,
	"validation_status" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "practest_test_configurations" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text,
	"description" text,
	"board" text,
	"class_level" integer,
	"subject" text,
	"chapters" json,
	"topics" json,
	"total_questions" integer,
	"duration_minutes" integer,
	"max_marks" integer,
	"negative_marking" integer,
	"partial_marking" boolean DEFAULT false,
	"difficulty_distribution" json,
	"question_type_distribution" json,
	"bloom_distribution" json,
	"randomize_questions" boolean DEFAULT false,
	"randomize_options" boolean DEFAULT false,
	"allow_review" boolean DEFAULT false,
	"show_results_immediately" boolean DEFAULT false,
	"instructions" text,
	"rules" json,
	"is_active" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "practest_test_sessions" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255),
	"configuration_id" varchar(36),
	"custom_parameters" json,
	"selected_questions" json,
	"max_possible_score" integer,
	"start_time" timestamp,
	"status" text,
	"current_question_index" integer,
	"user_responses" json,
	"time_remaining_seconds" integer,
	"total_score" integer,
	"percentage" integer,
	"end_time" timestamp,
	"duration_seconds" integer,
	"question_wise_results" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"attempt_id" varchar(36) NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"selected_option_id" varchar(36),
	"is_correct" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"quiz_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"org_id" varchar(36) NOT NULL,
	"score" numeric(5, 2),
	"total_questions" integer NOT NULL,
	"correct_answers" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "quiz_options" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"option_text" varchar(500) NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"quiz_id" varchar(36) NOT NULL,
	"question_text" text NOT NULL,
	"explanation" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"org_id" varchar(36) NOT NULL,
	"title" varchar(200) NOT NULL,
	"time_limit_minutes" integer,
	"passing_score" numeric(5, 2),
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"allow_multiple_attempts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_alerts" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"alert_type" varchar(50),
	"message" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sarvagya_credit_transactions" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"amount" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sarvagya_documents" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"space_id" varchar(36),
	"internal_doc_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text,
	"file_type" varchar(50),
	"size" integer,
	"status" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sarvagya_queries" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"space_id" varchar(36),
	"user_id" varchar(255) NOT NULL,
	"query" text NOT NULL,
	"response" text,
	"tokens_used" integer DEFAULT 0,
	"credits_deducted" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sarvagya_spaces" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"internal_space_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" varchar(255) NOT NULL,
	"active_organization_id" varchar(255),
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "student_engagement_snapshots" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"batch_id" varchar(36) NOT NULL,
	"org_id" varchar(36) NOT NULL,
	"week_of" date NOT NULL,
	"engagement_score" numeric(5, 2) DEFAULT '0',
	"risk_score" numeric(5, 2) DEFAULT '0',
	"videos_watched" integer DEFAULT 0,
	"quizzes_taken" integer DEFAULT 0,
	"avg_quiz_score" numeric(5, 2),
	"minutes_active" integer DEFAULT 0,
	"streak_days" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "student_enrollments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"class_id" varchar(36) NOT NULL,
	"section_id" varchar(36),
	"roll_number" varchar(50),
	"academic_year" varchar(50),
	"status" varchar(20) DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_video_progress" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"video_id" varchar(36) NOT NULL,
	"max_watched_seconds" integer DEFAULT 0,
	"completion_percentage" numeric(5, 2) DEFAULT '0.00',
	"last_watched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_yearly_growth" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"year" integer NOT NULL,
	"total_minutes" integer DEFAULT 0,
	"courses_enrolled" integer DEFAULT 0,
	"courses_completed" integer DEFAULT 0,
	"avg_quiz_score" numeric(5, 2),
	"certificates_earned" integer DEFAULT 0,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_history" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"subscription_id" varchar(36),
	"action" varchar(50),
	"previous_status" varchar(50),
	"new_status" varchar(50),
	"reason" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"plan_name" varchar(100) NOT NULL,
	"plan_code" varchar(50) NOT NULL,
	"plan_type" text NOT NULL,
	"board" text NOT NULL,
	"class_level" integer,
	"class_access_type" text DEFAULT 'single',
	"included_subjects" json,
	"monthly_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"quarterly_price" numeric(10, 2),
	"yearly_price" numeric(10, 2),
	"daily_question_limit" integer DEFAULT 30,
	"features" json,
	"display_name" varchar(150) NOT NULL,
	"description" text,
	"highlight_text" varchar(255),
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_plans_plan_name_unique" UNIQUE("plan_name"),
	CONSTRAINT "subscription_plans_plan_code_unique" UNIQUE("plan_code")
);
--> statement-breakpoint
CREATE TABLE "taxonomy_courses" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"domain_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "taxonomy_domains" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "taxonomy_levels" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"course_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "taxonomy_subjects" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"level_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teacher_activity_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"teacher_id" varchar(255) NOT NULL,
	"activity_type" varchar(100) NOT NULL,
	"activity_description" text,
	"metadata" json,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teacher_class_assignments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"teacher_id" varchar(255) NOT NULL,
	"class_id" varchar(36) NOT NULL,
	"assigned_by" varchar(255),
	"is_active" boolean DEFAULT true,
	"assigned_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teacher_verification_documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"teacher_id" varchar(255) NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"file_path" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tutor_topic_events" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"subject" varchar(100),
	"chapter" varchar(255),
	"topic" varchar(255),
	"board" text,
	"class_level" varchar(20),
	"event_type" text DEFAULT 'doubt_asked' NOT NULL,
	"agent_id" varchar(64),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" varchar(255) DEFAULT 'student',
	"class_id" varchar(255),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"approval_status" text,
	"verification_status" text,
	"verification_method" varchar(255),
	"email_domain" varchar(255),
	"is_educational_domain" boolean DEFAULT false,
	"verified_at" timestamp,
	"preferences" json,
	"last_login" timestamp,
	"approved_by" varchar(255),
	"approved_at" timestamp,
	"rejection_reason" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_material_access" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"organization_id" varchar(255),
	"user_id" varchar(255),
	"material_id" varchar(36),
	"access_count" integer DEFAULT 1 NOT NULL,
	"access_type" text,
	"filter_data" json,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"clerk_id" varchar(255),
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"subject" varchar(100),
	"chapter" varchar(255),
	"board" text,
	"class_level" varchar(20),
	"orientation" text DEFAULT 'portrait',
	"tags" json,
	"source_type" text DEFAULT 'manual',
	"source_query" text,
	"source_answer" text,
	"source_visualizations" json,
	"folder_id" varchar(36),
	"content_format" text DEFAULT 'markdown',
	"is_favorite" boolean DEFAULT false,
	"is_archived" boolean DEFAULT false,
	"is_pinned" boolean DEFAULT false,
	"cover_design" varchar(50) DEFAULT 'solid-blue',
	"spine_color" varchar(20) DEFAULT '#3B82F6',
	"page_size" varchar(16) DEFAULT 'A4',
	"page_margins" varchar(16) DEFAULT 'normal',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_accessed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"organization_id" varchar(255),
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"clerk_id" varchar(255),
	"subscription_plan_id" varchar(36),
	"subscription_type" text NOT NULL,
	"subscription_status" text DEFAULT 'trial' NOT NULL,
	"purchased_board" text,
	"purchased_class" integer,
	"class_access_type" text DEFAULT 'single',
	"purchased_subjects" json,
	"plan_name" varchar(100) NOT NULL,
	"plan_code" varchar(50) NOT NULL,
	"monthly_price" numeric(10, 2) NOT NULL,
	"billing_cycle" text DEFAULT 'monthly',
	"daily_question_limit" integer DEFAULT 30,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"expiry_date" timestamp NOT NULL,
	"last_payment_date" timestamp,
	"next_billing_date" timestamp,
	"cancelled_at" timestamp,
	"payment_status" text DEFAULT 'pending',
	"payment_gateway" varchar(50),
	"transaction_id" varchar(255),
	"payment_metadata" json,
	"auto_renew" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"sarvagya_credits" integer DEFAULT 0,
	"sarvagya_monthly_quota" integer DEFAULT 100,
	"sarvagya_daily_limit" integer DEFAULT 10,
	"last_credits_reset" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_vocab_progress" (
	"organization_id" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"clerk_user_id" varchar(255),
	"word_id" bigint NOT NULL,
	"efactor" numeric(3, 2) DEFAULT '2.50',
	"interval_days" integer DEFAULT 1,
	"repetitions" integer DEFAULT 0,
	"next_due_date" date NOT NULL,
	"last_reviewed" timestamp,
	"correct_attempts" integer DEFAULT 0,
	"total_attempts" integer DEFAULT 0,
	"accuracy_percentage" numeric(5, 2) DEFAULT '0.00',
	"status" text DEFAULT 'new',
	"first_learned_at" timestamp,
	"mastered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_assets" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"tenant_id" varchar(255),
	"domain" varchar(100) NOT NULL,
	"course" varchar(100) NOT NULL,
	"level" varchar(100) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"book" varchar(100) NOT NULL,
	"level_id" varchar(36),
	"subject_id" varchar(36),
	"book_tag" text,
	"title" varchar(255) NOT NULL,
	"description" text,
	"provider" varchar(50) DEFAULT 'bunny' NOT NULL,
	"provider_video_id" varchar(255) NOT NULL,
	"duration_seconds" integer,
	"thumbnail_url" varchar(512),
	"status" text DEFAULT 'uploading',
	"sort_order" integer DEFAULT 0,
	"is_free_preview" boolean DEFAULT false,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "video_chapters" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"video_asset_id" varchar(36) NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"start_seconds" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_activity_log" ADD CONSTRAINT "admin_activity_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_tutor_usage" ADD CONSTRAINT "ai_tutor_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_feedback" ADD CONSTRAINT "answer_feedback_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_coupons" ADD CONSTRAINT "batch_coupons_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_templates" ADD CONSTRAINT "batch_templates_level_id_taxonomy_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."taxonomy_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_waitlist" ADD CONSTRAINT "batch_waitlist_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_waitlist" ADD CONSTRAINT "batch_waitlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_waitlist" ADD CONSTRAINT "batch_waitlist_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_template_id_batch_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."batch_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_level_id_taxonomy_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."taxonomy_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_phrases" ADD CONSTRAINT "community_phrases_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_phrases" ADD CONSTRAINT "community_phrases_word_id_dictionary_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."dictionary_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_offline_sync" ADD CONSTRAINT "dictionary_offline_sync_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_search_history" ADD CONSTRAINT "dictionary_search_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_search_history" ADD CONSTRAINT "dict_search_word_fk" FOREIGN KEY ("selected_word_id") REFERENCES "public"."dictionary_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_user_stats" ADD CONSTRAINT "dictionary_user_stats_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dictionary_words" ADD CONSTRAINT "dictionary_words_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enhanced_user_profiles" ADD CONSTRAINT "enhanced_user_profiles_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_trials" ADD CONSTRAINT "free_trials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_drive_config" ADD CONSTRAINT "google_drive_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_drive_folders" ADD CONSTRAINT "google_drive_folders_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_classes" ADD CONSTRAINT "institution_classes_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_join_requests" ADD CONSTRAINT "institution_join_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_join_requests" ADD CONSTRAINT "institution_join_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_profiles" ADD CONSTRAINT "institution_profiles_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_sections" ADD CONSTRAINT "institution_sections_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_sections" ADD CONSTRAINT "institution_sections_class_id_institution_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."institution_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_approval_log" ADD CONSTRAINT "material_approval_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_approval_log" ADD CONSTRAINT "material_approval_log_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_activity_log" ADD CONSTRAINT "note_activity_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_activity_log" ADD CONSTRAINT "note_activity_log_note_id_user_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."user_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_folders" ADD CONSTRAINT "note_folders_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_source_note_id_user_notes_id_fk" FOREIGN KEY ("source_note_id") REFERENCES "public"."user_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_shares" ADD CONSTRAINT "note_shares_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_shares" ADD CONSTRAINT "note_shares_note_id_user_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."user_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_templates" ADD CONSTRAINT "note_templates_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practest_question_bank" ADD CONSTRAINT "practest_question_bank_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practest_test_configurations" ADD CONSTRAINT "practest_test_configurations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practest_test_sessions" ADD CONSTRAINT "practest_test_sessions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_alerts" ADD CONSTRAINT "quota_alerts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarvagya_credit_transactions" ADD CONSTRAINT "sarvagya_credit_transactions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarvagya_documents" ADD CONSTRAINT "sarvagya_documents_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarvagya_documents" ADD CONSTRAINT "sarvagya_documents_space_id_sarvagya_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."sarvagya_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarvagya_queries" ADD CONSTRAINT "sarvagya_queries_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarvagya_queries" ADD CONSTRAINT "sarvagya_queries_space_id_sarvagya_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."sarvagya_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarvagya_spaces" ADD CONSTRAINT "sarvagya_spaces_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_class_id_institution_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."institution_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_section_id_institution_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."institution_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_video_progress" ADD CONSTRAINT "student_video_progress_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_video_progress" ADD CONSTRAINT "student_video_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_video_progress" ADD CONSTRAINT "student_video_progress_video_id_video_assets_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."video_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_courses" ADD CONSTRAINT "taxonomy_courses_domain_id_taxonomy_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."taxonomy_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_levels" ADD CONSTRAINT "taxonomy_levels_course_id_taxonomy_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."taxonomy_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_subjects" ADD CONSTRAINT "taxonomy_subjects_level_id_taxonomy_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."taxonomy_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_activity_logs" ADD CONSTRAINT "teacher_activity_logs_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_class_assignments" ADD CONSTRAINT "teacher_class_assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_verification_documents" ADD CONSTRAINT "teacher_verification_documents_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_topic_events" ADD CONSTRAINT "tutor_topic_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_material_access" ADD CONSTRAINT "user_material_access_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_material_access" ADD CONSTRAINT "user_material_access_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vocab_progress" ADD CONSTRAINT "user_vocab_progress_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_vocab_progress" ADD CONSTRAINT "user_vocab_progress_word_id_dictionary_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."dictionary_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_level_id_taxonomy_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."taxonomy_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_subject_id_taxonomy_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."taxonomy_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_chapters" ADD CONSTRAINT "video_chapters_video_asset_id_video_assets_id_fk" FOREIGN KEY ("video_asset_id") REFERENCES "public"."video_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_announcements_batch" ON "announcements" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_announcements_org" ON "announcements" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_batch_coupons_code" ON "batch_coupons" USING btree ("batch_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "batch_templates_name_levelId_idx" ON "batch_templates" USING btree ("name","level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_waitlist_batch_user" ON "batch_waitlist" USING btree ("batch_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cert_user_batch" ON "certificates" USING btree ("user_id","batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_enrollments_batch_user" ON "enrollments" USING btree ("batch_id","user_id");--> statement-breakpoint
CREATE INDEX "ic_org_idx" ON "institution_classes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ijr_org_idx" ON "institution_join_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ijr_user_idx" ON "institution_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ijr_status_idx" ON "institution_join_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "is_org_idx" ON "institution_sections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "is_class_idx" ON "institution_sections" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_le_user_time" ON "learning_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_le_batch_time" ON "learning_events" USING btree ("batch_id","created_at");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member_user_org" ON "member" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "pae_question_idx" ON "practest_attempt_events" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "pae_session_idx" ON "practest_attempt_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "pae_user_idx" ON "practest_attempt_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quiz_attempts_user" ON "quiz_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_snapshot_user_batch_week" ON "student_engagement_snapshots" USING btree ("user_id","batch_id","week_of");--> statement-breakpoint
CREATE INDEX "se_org_idx" ON "student_enrollments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "se_user_idx" ON "student_enrollments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "se_class_idx" ON "student_enrollments" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_svp_user_video" ON "student_video_progress" USING btree ("user_id","video_id");--> statement-breakpoint
CREATE INDEX "idx_svp_tenant_user" ON "student_video_progress" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_growth_user_year" ON "student_yearly_growth" USING btree ("user_id","year");--> statement-breakpoint
CREATE INDEX "idx_tte_user_time" ON "tutor_topic_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_tte_user_subject_topic" ON "tutor_topic_events" USING btree ("user_id","subject","topic");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_uma_user_material" ON "user_material_access" USING btree ("user_id","material_id");--> statement-breakpoint
CREATE INDEX "idx_uma_org_user" ON "user_material_access" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_uma_material" ON "user_material_access" USING btree ("material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_word" ON "user_vocab_progress" USING btree ("user_id","word_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_provider_idx" ON "video_assets" USING btree ("tenant_id","provider_video_id");--> statement-breakpoint
CREATE INDEX "idx_video_chapters_asset" ON "video_chapters" USING btree ("video_asset_id");--> statement-breakpoint
CREATE INDEX "idx_video_chapters_tenant" ON "video_chapters" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chapter_video_start" ON "video_chapters" USING btree ("video_asset_id","start_seconds");