CREATE TABLE "admin_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"admin_id" text,
	"action" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "google_drive_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"access_token" text,
	"refresh_token" text,
	"token_type" text,
	"scope" text,
	"expiry_date" timestamp,
	"configured_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "material_approval_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"material_id" uuid,
	"admin_id" text,
	"action" text,
	"comments" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "practest_question_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"question_text" text,
	"question_type" text,
	"option_a" text,
	"option_b" text,
	"option_c" text,
	"option_d" text,
	"correct_option" text,
	"model_answer" text,
	"marking_rubric" jsonb,
	"keywords" jsonb,
	"explanation" text,
	"max_marks" integer,
	"time_limit_seconds" integer,
	"question_image_url" text,
	"option_images" jsonb,
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
	"usage_count" integer,
	"total_attempts" integer,
	"correct_attempts" integer,
	"average_time_seconds" integer,
	"validation_status" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "practest_test_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"name" text,
	"description" text,
	"board" text,
	"class_level" integer,
	"subject" text,
	"chapters" jsonb,
	"topics" jsonb,
	"total_questions" integer,
	"duration_minutes" integer,
	"max_marks" integer,
	"negative_marking" integer,
	"partial_marking" boolean DEFAULT false,
	"difficulty_distribution" jsonb,
	"question_type_distribution" jsonb,
	"bloom_distribution" jsonb,
	"randomize_questions" boolean DEFAULT false,
	"randomize_options" boolean DEFAULT false,
	"allow_review" boolean DEFAULT false,
	"show_results_immediately" boolean DEFAULT false,
	"instructions" text,
	"rules" jsonb,
	"is_active" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "practest_test_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" text,
	"configuration_id" text,
	"custom_parameters" jsonb,
	"selected_questions" jsonb,
	"max_possible_score" integer,
	"start_time" timestamp,
	"status" text,
	"current_question_index" integer,
	"user_responses" jsonb,
	"time_remaining_seconds" integer,
	"total_score" integer,
	"percentage" integer,
	"end_time" timestamp,
	"duration_seconds" integer,
	"question_wise_results" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_material_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" text,
	"access_type" text,
	"filter_data" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "admin_activity_log" ADD CONSTRAINT "admin_activity_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_drive_config" ADD CONSTRAINT "google_drive_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_approval_log" ADD CONSTRAINT "material_approval_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_approval_log" ADD CONSTRAINT "material_approval_log_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practest_question_bank" ADD CONSTRAINT "practest_question_bank_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practest_test_configurations" ADD CONSTRAINT "practest_test_configurations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practest_test_sessions" ADD CONSTRAINT "practest_test_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_material_access" ADD CONSTRAINT "user_material_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;