CREATE TABLE `alert_instances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ruleId` integer,
	`documentId` integer,
	`title` text NOT NULL,
	`summary` text,
	`severity` text DEFAULT 'warning' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`type` text NOT NULL,
	`city` text,
	`source` text,
	`acknowledgedAt` integer,
	`resolvedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`ruleId`) REFERENCES `alert_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `alert_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_entities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`documentId` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`city` text,
	FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`source` text NOT NULL,
	`city` text NOT NULL,
	`category` text NOT NULL,
	`publishedAt` integer,
	`scrapedAt` integer NOT NULL,
	`analysis` text,
	`sentiment` text,
	`impactLevel` integer,
	`topics` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_url_unique` ON `documents` (`url`);--> statement-breakpoint
CREATE TABLE `generated_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text DEFAULT 'daily' NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`tokensUsed` integer DEFAULT 0,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sourceId` integer,
	`status` text DEFAULT 'running' NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`documentsFound` integer DEFAULT 0 NOT NULL,
	`documentsAnalyzed` integer DEFAULT 0 NOT NULL,
	`articlesGenerated` integer DEFAULT 0 NOT NULL,
	`tokensUsed` integer DEFAULT 0 NOT NULL,
	`errorMessage` text,
	`log` text,
	`startedAt` integer NOT NULL,
	`completedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`sourceId`) REFERENCES `ingestion_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ingestion_schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`intervalMinutes` integer DEFAULT 360 NOT NULL,
	`autoGenerateNews` integer DEFAULT true NOT NULL,
	`autoGenerateReports` integer DEFAULT false NOT NULL,
	`lastRunAt` integer,
	`nextRunAt` integer,
	`weeklyDigestEnabled` integer DEFAULT false NOT NULL,
	`digestDayOfWeek` integer DEFAULT 1 NOT NULL,
	`lastDigestSentAt` integer,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingestion_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`city` text NOT NULL,
	`category` text NOT NULL,
	`sourceLabel` text NOT NULL,
	`config` text,
	`enabled` integer DEFAULT true NOT NULL,
	`intervalMinutes` integer DEFAULT 360 NOT NULL,
	`lastScrapedAt` integer,
	`documentCount` integer DEFAULT 0 NOT NULL,
	`lastError` text,
	`consecutiveFailures` integer DEFAULT 0 NOT NULL,
	`healthStatus` text DEFAULT 'healthy' NOT NULL,
	`lastAlertSentAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `news_articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`headline` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`whyItMatters` text,
	`city` text NOT NULL,
	`category` text NOT NULL,
	`importance` integer DEFAULT 5 NOT NULL,
	`citations` text NOT NULL,
	`metadata` text,
	`isBreaking` integer DEFAULT false NOT NULL,
	`edition` text NOT NULL,
	`tokensUsed` integer DEFAULT 0,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `query_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`tokensUsed` integer DEFAULT 0,
	`sourcesConsulted` integer DEFAULT 0,
	`model` text,
	`createdAt` integer NOT NULL
);
