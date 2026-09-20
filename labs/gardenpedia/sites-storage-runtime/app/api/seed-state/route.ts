import { getD1Binding } from "../../../db";

type PersonalState = {
  packageStatus: "opened" | "unopened" | "unknown";
  quantityLevel: "full" | "high" | "medium" | "low" | "almost_empty" | "unknown";
  storageLocation: string | null;
  purchaseDate: string | null;
  legacyPurchaseYear: string | null;
  germinationTestDate: string | null;
  germinationResultPct: number | null;
  notes: string | null;
  archived: boolean;
};

type CustomSeed = { id: string; packetName: string; brand?: string | null };

const packageStatuses = new Set(["opened", "unopened", "unknown"]);
const quantityLevels = new Set(["full", "high", "medium", "low", "almost_empty", "unknown"]);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const keyPattern = /^[A-Za-z0-9_-]{1,200}$/;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function validDate(value: unknown): value is string | null {
  if (value == null) return true;
  if (typeof value !== "string" || !isoDate.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

type JsonRecord = Record<string, unknown>;

function normalizeState(value: unknown): PersonalState {
  if (!value || typeof value !== "object") throw new Error("Invalid personal state");
  const record = value as JsonRecord;
  const packageStatusValue = record.packageStatus ?? record.package_status ?? "unknown";
  const quantityLevelValue = record.quantityLevel ?? record.quantity_level ?? "unknown";
  const purchaseRaw = record.purchaseDate ?? record.purchase_date ?? null;
  const germinationRaw = record.lastGerminationTestAt ?? record.germinationTestDate ?? record.germination_test_date ?? null;
  const purchaseDate = purchaseRaw === "" ? null : purchaseRaw;
  const germinationTestDate = germinationRaw === "" ? null : germinationRaw;
  const result = record.lastGerminationResultPct ?? record.germinationResultPct ?? record.germination_result_pct ?? null;
  if (typeof packageStatusValue !== "string" || !packageStatuses.has(packageStatusValue)
    || typeof quantityLevelValue !== "string" || !quantityLevels.has(quantityLevelValue)) throw new Error("Invalid status value");
  const packageStatus = packageStatusValue as PersonalState["packageStatus"];
  const quantityLevel = quantityLevelValue as PersonalState["quantityLevel"];
  if (!validDate(purchaseDate) || !validDate(germinationTestDate)) throw new Error("Dates must use YYYY-MM-DD");
  if (result !== null && (!Number.isInteger(Number(result)) || Number(result) < 0 || Number(result) > 100)) throw new Error("Germination result must be 0–100");
  const location = record.storageLocation ?? record.storage_location ?? null;
  const note = record.notes ?? null;
  if (location != null && (typeof location !== "string" || location.length > 500)) throw new Error("Storage location is too long");
  if (note != null && (typeof note !== "string" || note.length > 5000)) throw new Error("Notes are too long");
  const oldYear = record.legacyPurchaseYear ?? record.legacy_purchase_year ?? record.purchaseYear ?? null;
  return {
    packageStatus,
    quantityLevel,
    storageLocation: location || null,
    purchaseDate,
    legacyPurchaseYear: purchaseDate ? null : (oldYear == null || oldYear === "" ? null : String(oldYear).slice(0, 4)),
    germinationTestDate,
    germinationResultPct: result === "" || result == null ? null : Number(result),
    notes: note || null,
    archived: Boolean(record.archived),
  };
}

function normalizeCustom(value: unknown): CustomSeed {
  if (!value || typeof value !== "object") throw new Error("Invalid custom seed");
  const record = value as JsonRecord;
  const key = String(record.id ?? record.seedKey ?? record.seed_key ?? "");
  if (!keyPattern.test(key)) throw new Error("Invalid custom seed key");
  const packetName = String(record.packetName ?? record.packet_name ?? "").trim();
  const brand = String(record.brand ?? "").trim();
  if (!packetName || packetName.length > 200 || brand.length > 200) throw new Error("Invalid custom seed details");
  return { id: key, packetName, brand };
}

function personalRow(row: JsonRecord) {
  return {
    packageStatus: row.package_status,
    quantityLevel: row.quantity_level,
    storageLocation: row.storage_location ?? "",
    purchaseDate: row.purchase_date ?? "",
    purchaseYear: row.legacy_purchase_year ?? "",
    legacyPurchaseYear: row.legacy_purchase_year ?? "",
    lastGerminationTestAt: row.germination_test_date ?? "",
    lastGerminationResultPct: row.germination_result_pct ?? "",
    notes: row.notes ?? "",
    archived: Boolean(row.archived),
  };
}

export async function GET() {
  try {
    const database = getD1Binding();
    const [stateResult, customResult, meta] = await Promise.all([
      database.prepare("SELECT * FROM seed_personal_state ORDER BY seed_key").all(),
      database.prepare("SELECT * FROM custom_seeds ORDER BY created_at, seed_key").all(),
      database.prepare("SELECT value FROM seed_sync_meta WHERE key = ?1").bind("local_import_complete").first<{ value: string }>(),
    ]);
    const state = Object.fromEntries((stateResult.results ?? []).map((value) => {
      const row = value as JsonRecord;
      return [String(row.seed_key), personalRow(row)];
    }));
    const customSeeds = (customResult.results ?? []).map((value) => {
      const row = value as JsonRecord;
      return { id: String(row.seed_key), packetName: String(row.packet_name), brand: row.brand ?? "", aliases: [], createdInLab: true };
    });
    return json({ seedUserState: state, customSeeds, importCompleted: meta?.value === "1" });
  } catch (error) {
    console.error("Garden Labs D1 load failed", error);
    return json({ error: "Personal Lab storage is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 250_000) return json({ error: "Request is too large." }, 413);
    const body = await request.json() as JsonRecord;
    const database = getD1Binding();

    if (body.operation === "import") {
      const current = await database.prepare("SELECT (SELECT COUNT(*) FROM seed_personal_state) + (SELECT COUNT(*) FROM custom_seeds) AS total").first<{ total: number }>();
      const marker = await database.prepare("SELECT value FROM seed_sync_meta WHERE key = ?1").bind("local_import_complete").first<{ value: string }>();
      if (marker?.value === "1") return json({ imported: false, reason: "already-imported" }, 409);
      if (Number(current?.total ?? 0) > 0) return json({ imported: false, reason: "remote-not-empty" }, 409);

      const entries = Object.entries((body.seedUserState ?? {}) as JsonRecord);
      const custom = (Array.isArray(body.customSeeds) ? body.customSeeds : []).map(normalizeCustom);
      if (entries.length > 300 || custom.length > 300) return json({ error: "Import is too large." }, 413);
      const now = new Date().toISOString();
      const writes: D1PreparedStatement[] = [];
      for (const [key, value] of entries) {
        if (!keyPattern.test(key)) throw new Error("Invalid seed key");
        const state = normalizeState(value);
        writes.push(database.prepare("INSERT INTO seed_personal_state (seed_key, package_status, quantity_level, storage_location, purchase_date, legacy_purchase_year, germination_test_date, germination_result_pct, notes, archived, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)")
          .bind(key, state.packageStatus, state.quantityLevel, state.storageLocation, state.purchaseDate, state.legacyPurchaseYear, state.germinationTestDate, state.germinationResultPct, state.notes, state.archived ? 1 : 0, now));
      }
      for (const seed of custom) {
        writes.push(database.prepare("INSERT INTO custom_seeds (seed_key, packet_name, brand, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)")
          .bind(seed.id, seed.packetName, seed.brand || null, now));
      }
      writes.push(database.prepare("INSERT INTO seed_sync_meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind("local_import_complete", "1"));
      await database.batch(writes);
      return json({ imported: true, count: entries.length + custom.length });
    }

    if (body.operation === "save") {
      const seedKey = String(body.seedKey ?? "");
      if (!keyPattern.test(seedKey)) return json({ error: "Invalid seed key." }, 400);
      const state = normalizeState(body.state);
      const now = new Date().toISOString();
      const writes: D1PreparedStatement[] = [];
      if (body.customSeed && typeof body.customSeed === "object") {
        const custom = normalizeCustom({ ...(body.customSeed as JsonRecord), id: seedKey });
        writes.push(database.prepare("INSERT INTO custom_seeds (seed_key, packet_name, brand, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4) ON CONFLICT(seed_key) DO UPDATE SET packet_name = excluded.packet_name, brand = excluded.brand, updated_at = excluded.updated_at")
          .bind(seedKey, custom.packetName, custom.brand || null, now));
      }
      writes.push(database.prepare("INSERT INTO seed_personal_state (seed_key, package_status, quantity_level, storage_location, purchase_date, legacy_purchase_year, germination_test_date, germination_result_pct, notes, archived, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT(seed_key) DO UPDATE SET package_status = excluded.package_status, quantity_level = excluded.quantity_level, storage_location = excluded.storage_location, purchase_date = excluded.purchase_date, legacy_purchase_year = excluded.legacy_purchase_year, germination_test_date = excluded.germination_test_date, germination_result_pct = excluded.germination_result_pct, notes = excluded.notes, archived = excluded.archived, updated_at = excluded.updated_at")
        .bind(seedKey, state.packageStatus, state.quantityLevel, state.storageLocation, state.purchaseDate, state.legacyPurchaseYear, state.germinationTestDate, state.germinationResultPct, state.notes, state.archived ? 1 : 0, now));
      await database.batch(writes);
      return json({ saved: true, updatedAt: now });
    }

    if (body.operation === "delete-custom") {
      const seedKey = String(body.seedKey ?? "");
      if (!keyPattern.test(seedKey)) return json({ error: "Invalid seed key." }, 400);
      await database.batch([
        database.prepare("DELETE FROM seed_personal_state WHERE seed_key = ?1").bind(seedKey),
        database.prepare("DELETE FROM custom_seeds WHERE seed_key = ?1").bind(seedKey),
      ]);
      return json({ deleted: true });
    }

    return json({ error: "Unsupported operation." }, 400);
  } catch (error) {
    console.error("Garden Labs D1 write failed", error);
    return json({ error: "Personal Lab storage is temporarily unavailable." }, 503);
  }
}
