CREATE TABLE `inventory_type_properties` (
	`id` text PRIMARY KEY NOT NULL,
	`inventory_type_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`kind` text NOT NULL,
	`required` integer NOT NULL,
	`minimum` real,
	`maximum` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`inventory_type_id`) REFERENCES `inventory_types`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "inventory_type_properties_kind_check" CHECK("inventory_type_properties"."kind" IN ('text', 'numeric')),
	CONSTRAINT "inventory_type_properties_text_bounds_check" CHECK("inventory_type_properties"."kind" <> 'text' OR ("inventory_type_properties"."minimum" IS NULL AND "inventory_type_properties"."maximum" IS NULL)),
	CONSTRAINT "inventory_type_properties_bounds_check" CHECK("inventory_type_properties"."minimum" IS NULL OR "inventory_type_properties"."maximum" IS NULL OR "inventory_type_properties"."minimum" <= "inventory_type_properties"."maximum")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_type_properties_type_name_idx` ON `inventory_type_properties` (`inventory_type_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `inventory_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_types_normalized_name_idx` ON `inventory_types` (`normalized_name`);--> statement-breakpoint
ALTER TABLE `parts` ADD `inventory_type_id` text REFERENCES inventory_types(id) ON DELETE restrict;--> statement-breakpoint
CREATE INDEX `parts_inventory_type_idx` ON `parts` (`inventory_type_id`);
