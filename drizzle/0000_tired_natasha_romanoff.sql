CREATE TABLE `inventory_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`part_id` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`actor` text NOT NULL,
	`used_in` text,
	`note` text,
	`recorded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inventory_changes_part_idx` ON `inventory_changes` (`part_id`);--> statement-breakpoint
CREATE INDEX `inventory_changes_transaction_idx` ON `inventory_changes` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `inventory_changes_recorded_at_idx` ON `inventory_changes` (`recorded_at`);--> statement-breakpoint
CREATE TABLE `parts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mfg_part_number` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`metadata` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parts_mfg_part_number_idx` ON `parts` (`mfg_part_number`);--> statement-breakpoint
CREATE INDEX `parts_name_idx` ON `parts` (`name`);
--> statement-breakpoint
CREATE VIRTUAL TABLE `parts_fts` USING fts5(
	`name`,
	`mfg_part_number`,
	`description`,
	content='parts',
	content_rowid='rowid'
);
--> statement-breakpoint
INSERT INTO `parts_fts` (`rowid`, `name`, `mfg_part_number`, `description`)
SELECT `rowid`, `name`, `mfg_part_number`, `description` FROM `parts`;
--> statement-breakpoint
CREATE TRIGGER `parts_ai` AFTER INSERT ON `parts` BEGIN
	INSERT INTO `parts_fts` (`rowid`, `name`, `mfg_part_number`, `description`)
	VALUES (new.rowid, new.name, new.mfg_part_number, new.description);
END;
--> statement-breakpoint
CREATE TRIGGER `parts_ad` AFTER DELETE ON `parts` BEGIN
	INSERT INTO `parts_fts` (`parts_fts`, `rowid`, `name`, `mfg_part_number`, `description`)
	VALUES ('delete', old.rowid, old.name, old.mfg_part_number, old.description);
END;
--> statement-breakpoint
CREATE TRIGGER `parts_au` AFTER UPDATE ON `parts` BEGIN
	INSERT INTO `parts_fts` (`parts_fts`, `rowid`, `name`, `mfg_part_number`, `description`)
	VALUES ('delete', old.rowid, old.name, old.mfg_part_number, old.description);
	INSERT INTO `parts_fts` (`rowid`, `name`, `mfg_part_number`, `description`)
	VALUES (new.rowid, new.name, new.mfg_part_number, new.description);
END;