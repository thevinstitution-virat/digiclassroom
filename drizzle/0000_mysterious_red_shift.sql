CREATE TYPE "public"."approval_status" AS ENUM('approved', 'pending', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."board" AS ENUM('CBSE', 'ICSE', 'STATE_BOARD', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."class_access_type" AS ENUM('single', 'all');--> statement-breakpoint
CREATE TYPE "public"."material_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('notes', 'summaries', 'mind_maps', 'quizzes', 'textbooks', 'reference');--> statement-breakpoint
CREATE TYPE "public"."medium" AS ENUM('ENGLISH', 'HINDI');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('paid', 'pending', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('free_trial', 'board_access', 'class_access', 'subject_bundle', 'full_access');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('student', 'teacher', 'parent', 'admin');--> statement-breakpoint
CREATE TYPE "public"."stream" AS ENUM('HUMANITIES', 'BIOLOGY', 'MATHEMATICS', 'COMMERCE');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'inactive', 'trial', 'pending', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('verified_email', 'unverified', 'manual');--> statement-breakpoint
CREATE TABLE "ai_tutor_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" timestamp DEFAULT now(),
	"questions_asked" integer DEFAULT 0,
	"total_tokens_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "free_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trial_start" timestamp DEFAULT now(),
	"trial_end" timestamp,
	"is_converted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "google_drive_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" varchar(255) NOT NULL,
	"folder_name" varchar(255) NOT NULL,
	"parent_folder_id" varchar(255),
	"folder_path" text NOT NULL,
	"board" "board",
	"class" integer,
	"subject" varchar(100),
	"material_type" "material_type",
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "google_drive_folders_folder_id_unique" UNIQUE("folder_id")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" "material_type" NOT NULL,
	"board" "board" NOT NULL,
	"medium" "medium" NOT NULL,
	"class" integer NOT NULL,
	"stream" "stream",
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
	"status" "material_status" DEFAULT 'draft',
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"approved_by" uuid,
	"rejected_by" uuid,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "materials_google_drive_file_id_unique" UNIQUE("google_drive_file_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50),
	"title" varchar(255),
	"message" text,
	"is_read" boolean DEFAULT false,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quota_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"alert_type" varchar(50),
	"message" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sarvagya_credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sarvagya_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid,
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
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"response" text,
	"tokens_used" integer DEFAULT 0,
	"credits_deducted" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sarvagya_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"internal_space_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"action" varchar(50),
	"previous_status" varchar(50),
	"new_status" varchar(50),
	"reason" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_name" varchar(100) NOT NULL,
	"plan_code" varchar(50) NOT NULL,
	"plan_type" "plan_type" NOT NULL,
	"board" "board" NOT NULL,
	"class_level" integer,
	"class_access_type" "class_access_type" DEFAULT 'single',
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
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"subscription_plan" "subscription_plan" DEFAULT 'starter' NOT NULL,
	"subscription_status" "subscription_status" DEFAULT 'trial' NOT NULL,
	"settings" json,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"role" "role" DEFAULT 'student',
	"board_type" "board" DEFAULT 'CBSE',
	"medium" "medium" DEFAULT 'ENGLISH',
	"grade_level" integer,
	"stream" "stream",
	"subjects" json,
	"preferences" json,
	"learning_style" varchar(50) DEFAULT 'mixed',
	"learning_pace" varchar(50) DEFAULT 'average',
	"preferred_explanation_complexity" varchar(50) DEFAULT 'intermediate',
	"is_onboarding_complete" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"clerk_id" varchar(255),
	"subscription_plan_id" uuid,
	"subscription_type" "plan_type" NOT NULL,
	"subscription_status" "subscription_status" DEFAULT 'trial' NOT NULL,
	"purchased_board" "board",
	"purchased_class" integer,
	"class_access_type" "class_access_type" DEFAULT 'single',
	"purchased_subjects" json,
	"plan_name" varchar(100) NOT NULL,
	"plan_code" varchar(50) NOT NULL,
	"monthly_price" numeric(10, 2) NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly',
	"daily_question_limit" integer DEFAULT 30,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"expiry_date" timestamp NOT NULL,
	"last_payment_date" timestamp,
	"next_billing_date" timestamp,
	"cancelled_at" timestamp,
	"payment_status" "payment_status" DEFAULT 'pending',
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
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"clerk_id" varchar(255),
	"email" varchar(255) NOT NULL,
	"role" "role" NOT NULL,
	"approval_status" "approval_status",
	"verification_status" "verification_status",
	"verification_method" varchar(255),
	"email_domain" varchar(255),
	"is_educational_domain" boolean DEFAULT false,
	"verified_at" timestamp,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"class_id" varchar(36),
	"profile_image_url" text,
	"preferences" json,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "sarvagya_documents" ADD CONSTRAINT "sarvagya_documents_space_id_sarvagya_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."sarvagya_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sarvagya_queries" ADD CONSTRAINT "sarvagya_queries_space_id_sarvagya_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."sarvagya_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;