import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const seedPersonalState = sqliteTable("seed_personal_state", {
  seedKey: text("seed_key").primaryKey(), packageStatus: text("package_status").notNull().default("unknown"), quantityLevel: text("quantity_level").notNull().default("unknown"), storageLocation: text("storage_location"), purchaseDate: text("purchase_date"), legacyPurchaseYear: text("legacy_purchase_year"), germinationTestDate: text("germination_test_date"), germinationResultPct: integer("germination_result_pct"), notes: text("notes"), archived: integer("archived").notNull().default(0), updatedAt: text("updated_at").notNull(),
});
export const customSeeds = sqliteTable("custom_seeds", { seedKey:text("seed_key").primaryKey(), packetName:text("packet_name").notNull(), brand:text("brand"), createdAt:text("created_at").notNull(), updatedAt:text("updated_at").notNull() });
export const seedSyncMeta = sqliteTable("seed_sync_meta", { key:text("key").primaryKey(), value:text("value").notNull() });

export const machinePersonalState = sqliteTable("machine_personal_state", {
  machineKey: text("machine_key").primaryKey(),
  ownershipStatus: text("ownership_status").notNull().default("on_hand"),
  operationalStatus: text("operational_status").notNull().default("unknown"),
  purchaseDate: text("purchase_date"), seller: text("seller"), purchaseChannel: text("purchase_channel"), pricePaid: real("price_paid"), currency: text("currency").notNull().default("USD"),
  receivedDate: text("received_date"), firstUseDate: text("first_use_date"), location: text("location"), currentGardenId: text("current_garden_id"), currentGardenSince: text("current_garden_since"), gardenHistoryJson: text("garden_history_json").notNull().default("[]"), maintenanceEventsJson: text("maintenance_events_json").notNull().default("[]"), notes: text("notes"), ratingsJson: text("ratings_json").notNull().default("{}"), overallRating: integer("overall_rating"), wouldBuyAgain: text("would_buy_again"), updatedAt: text("updated_at").notNull(),
});
