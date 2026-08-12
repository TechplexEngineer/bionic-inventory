ALTER TABLE `parts` ADD `archived_at` text;
--> statement-breakpoint
CREATE INDEX `parts_archived_at_idx` ON `parts` (`archived_at`);
