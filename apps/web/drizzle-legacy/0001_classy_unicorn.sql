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
	`onboarding_completed` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `institution_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `institution_profiles_organization_id_unique` UNIQUE(`organization_id`)
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
	`class_id` varchar(36),
	`section_id` varchar(36),
	`roll_number` varchar(50),
	`academic_year` varchar(50),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_enrollment_per_year` UNIQUE(`user_id`,`academic_year`)
);
--> statement-breakpoint
ALTER TABLE `institution_classes` ADD CONSTRAINT `institution_classes_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_profiles` ADD CONSTRAINT `institution_profiles_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_sections` ADD CONSTRAINT `institution_sections_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `institution_sections` ADD CONSTRAINT `institution_sections_class_id_institution_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `institution_classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_class_id_institution_classes_id_fk` FOREIGN KEY (`class_id`) REFERENCES `institution_classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_enrollments` ADD CONSTRAINT `student_enrollments_section_id_institution_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `institution_sections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `enrollment_org_idx` ON `student_enrollments` (`organization_id`);--> statement-breakpoint
CREATE INDEX `enrollment_user_idx` ON `student_enrollments` (`user_id`);