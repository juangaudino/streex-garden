import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const seedPersonalState = sqliteTable("seed_personal_state", {
  seedKey: text("seed_key").primaryKey(),
  packageStatus: text("package_status").notNull().default("unknown"),
  quantityLevel: text("quantity_level").notNull().default("unknown"),
  storageLocation: text("storage_location"),
  purchaseDate: text("purchase_date"),
  legacyPurchaseYear: text("legacy_purchase_year"),
  germinationTestDate: text("germination_test_date"),
  germinationResultPct: integer("germination_result_pct"),
  notes: text("notes"),
  archived: integer("archived").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const customSeeds = sqliteTable("custom_seeds", {
  seedKey: text("seed_key").primaryKey(),
  packetName: text("packet_name").notNull(),
  brand: text("brand"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Prevent stale device-local data from being re-imported after the initial move.
export const seedSyncMeta = sqliteTable("seed_sync_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
