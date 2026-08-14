ALTER TABLE `ingestion_schedule` ADD `weeklyDigestEnabled` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_schedule` ADD `digestDayOfWeek` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_schedule` ADD `lastDigestSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `ingestion_sources` ADD `consecutiveFailures` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_sources` ADD `healthStatus` enum('healthy','degraded','failing','offline') DEFAULT 'healthy' NOT NULL;--> statement-breakpoint
ALTER TABLE `ingestion_sources` ADD `lastAlertSentAt` timestamp;