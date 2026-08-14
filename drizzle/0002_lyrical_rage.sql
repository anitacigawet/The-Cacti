CREATE TABLE `news_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`headline` varchar(500) NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`whyItMatters` text,
	`city` varchar(128) NOT NULL,
	`category` varchar(64) NOT NULL,
	`importance` int NOT NULL DEFAULT 5,
	`citations` json NOT NULL,
	`metadata` json,
	`isBreaking` int NOT NULL DEFAULT 0,
	`edition` varchar(32) NOT NULL,
	`generatedBy` int,
	`tokensUsed` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `news_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `news_articles` ADD CONSTRAINT `news_articles_generatedBy_users_id_fk` FOREIGN KEY (`generatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;