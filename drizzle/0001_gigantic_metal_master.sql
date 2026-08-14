CREATE TABLE `alert_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleId` int,
	`documentId` varchar(64),
	`title` varchar(500) NOT NULL,
	`summary` text,
	`severity` enum('critical','warning','info') NOT NULL DEFAULT 'warning',
	`status` enum('active','acknowledged','resolved') NOT NULL DEFAULT 'active',
	`type` varchar(64) NOT NULL,
	`city` varchar(128),
	`source` varchar(255),
	`acknowledgedBy` int,
	`acknowledgedAt` timestamp,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_instances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alert_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`type` enum('keyword','sentiment_threshold','impact_level','anomaly') NOT NULL,
	`config` json NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`severity` enum('critical','warning','info') NOT NULL DEFAULT 'warning',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('daily','weekly','custom') NOT NULL DEFAULT 'daily',
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`generatedBy` int,
	`tokensUsed` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `query_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`tokensUsed` int DEFAULT 0,
	`sourcesConsulted` int DEFAULT 0,
	`model` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `query_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `alert_instances` ADD CONSTRAINT `alert_instances_ruleId_alert_rules_id_fk` FOREIGN KEY (`ruleId`) REFERENCES `alert_rules`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_instances` ADD CONSTRAINT `alert_instances_acknowledgedBy_users_id_fk` FOREIGN KEY (`acknowledgedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_rules` ADD CONSTRAINT `alert_rules_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `generated_reports` ADD CONSTRAINT `generated_reports_generatedBy_users_id_fk` FOREIGN KEY (`generatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `query_history` ADD CONSTRAINT `query_history_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;