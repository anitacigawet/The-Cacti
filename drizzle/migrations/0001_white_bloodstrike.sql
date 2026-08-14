CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`googleId` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatarUrl` text,
	`tier` text DEFAULT 'invited' NOT NULL,
	`createdAt` integer NOT NULL,
	`lastSeenAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_googleId_unique` ON `users` (`googleId`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);