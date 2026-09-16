CREATE TABLE `machine_personal_state` (
  `machine_key` text PRIMARY KEY NOT NULL,
  `ownership_status` text DEFAULT 'on_hand' NOT NULL,
  `operational_status` text DEFAULT 'unknown' NOT NULL,
  `purchase_date` text,
  `seller` text,
  `purchase_channel` text,
  `price_paid` real,
  `currency` text DEFAULT 'USD' NOT NULL,
  `received_date` text,
  `first_use_date` text,
  `location` text,
  `current_garden_id` text,
  `notes` text,
  `ratings_json` text DEFAULT '{}' NOT NULL,
  `overall_rating` integer,
  `would_buy_again` text,
  `updated_at` text NOT NULL
);
