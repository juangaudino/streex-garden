CREATE TABLE `custom_seeds` (
	`seed_key` text PRIMARY KEY NOT NULL,
	`packet_name` text NOT NULL,
	`brand` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seed_personal_state` (
	`seed_key` text PRIMARY KEY NOT NULL,
	`package_status` text DEFAULT 'unknown' NOT NULL,
	`quantity_level` text DEFAULT 'unknown' NOT NULL,
	`storage_location` text,
	`purchase_date` text,
	`legacy_purchase_year` text,
	`germination_test_date` text,
	`germination_result_pct` integer,
	`notes` text,
	`archived` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seed_sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
