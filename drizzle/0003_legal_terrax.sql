CREATE TABLE `video_chapters` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
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
ALTER TABLE `video_assets` MODIFY COLUMN `provider` varchar(50) NOT NULL DEFAULT 'bunny';--> statement-breakpoint
ALTER TABLE `student_video_progress` ADD CONSTRAINT `uq_svp_user_video` UNIQUE(`user_id`,`video_id`);--> statement-breakpoint
ALTER TABLE `video_chapters` ADD CONSTRAINT `video_chapters_video_asset_id_video_assets_id_fk` FOREIGN KEY (`video_asset_id`) REFERENCES `video_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_video_chapters_asset` ON `video_chapters` (`video_asset_id`);--> statement-breakpoint
CREATE INDEX `idx_video_chapters_tenant` ON `video_chapters` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_svp_tenant_user` ON `student_video_progress` (`tenant_id`,`user_id`);