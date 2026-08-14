CREATE TABLE `ingestion_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int,
	`status` enum('running','completed','failed','partial') NOT NULL DEFAULT 'running',
	`trigger` enum('manual','scheduled','system') NOT NULL DEFAULT 'manual',
	`documentsFound` int NOT NULL DEFAULT 0,
	`documentsAnalyzed` int NOT NULL DEFAULT 0,
	`articlesGenerated` int NOT NULL DEFAULT 0,
	`tokensUsed` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`log` json,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ingestion_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingestion_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`intervalMinutes` int NOT NULL DEFAULT 360,
	`autoGenerateNews` int NOT NULL DEFAULT 1,
	`autoGenerateReports` int NOT NULL DEFAULT 0,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingestion_schedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingestion_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`type` enum('rss','webpage','api','sitemap') NOT NULL,
	`city` varchar(128) NOT NULL,
	`category` varchar(64) NOT NULL,
	`sourceLabel` varchar(255) NOT NULL,
	`config` json,
	`enabled` int NOT NULL DEFAULT 1,
	`intervalMinutes` int NOT NULL DEFAULT 360,
	`lastScrapedAt` timestamp,
	`documentCount` int NOT NULL DEFAULT 0,
	`lastError` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ingestion_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD CONSTRAINT `ingestion_runs_sourceId_ingestion_sources_id_fk` FOREIGN KEY (`sourceId`) REFERENCES `ingestion_sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ingestion_schedule` ADD CONSTRAINT `ingestion_schedule_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ingestion_sources` ADD CONSTRAINT `ingestion_sources_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;