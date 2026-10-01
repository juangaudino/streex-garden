import fs from "node:fs";
import path from "node:path";

export const SOURCE_TYPES = new Set([
  "botanical_taxonomy",
  "grower_reference",
  "horticulture_reference",
  "product_reference",
  "purchase_listing",
  "seed_reference",
  "specialist_grower",
  "university_extension",
  "university_research",
  "manufacturer_guide",
  "discovery_provider",
]);

const SOURCE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeSourceRecord(record, origin = "source") {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`Invalid source record in ${origin}`);
  }

  const id = text(record.id);
  const publisher = text(record.publisher) || text(record.name)?.split(" — ")[0] || null;
  const title = text(record.title) || text(record.name) || id;
  const url = text(record.url);
  const type = text(record.type);
  const tier = record.tier === undefined || record.tier === null ? null : record.tier;
  const scope = record.scope === undefined ? null : record.scope;
  const taxonomicScope = record.taxonomicScope === undefined ? null : record.taxonomicScope;
  const accessed = text(record.accessed);
  const license = text(record.license);
  const provenance = text(record.provenance) || text(record.note);
  const claimKinds = record.claimKinds === undefined ? null : record.claimKinds;

  if (!id || !SOURCE_ID.test(id)) throw new Error(`Invalid source ID in ${origin}: ${String(record.id)}`);
  if (!publisher || !title || !url) throw new Error(`Source ${id} is missing publisher, title, or URL in ${origin}`);
  if (type && !SOURCE_TYPES.has(type)) throw new Error(`Source ${id} has unsupported type ${type}`);
  if (tier !== null && (!Number.isInteger(tier) || tier < 1 || tier > 4)) {
    throw new Error(`Source ${id} has malformed tier ${String(tier)}`);
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Source ${id} has an invalid URL`);
  }
  if (parsedUrl.protocol !== "https:") throw new Error(`Source ${id} must use HTTPS`);
  if (scope !== null && typeof scope !== "string" && (typeof scope !== "object" || Array.isArray(scope))) {
    throw new Error(`Source ${id} has malformed scope`);
  }
  if (taxonomicScope !== null && typeof taxonomicScope !== "object") {
    throw new Error(`Source ${id} has malformed taxonomicScope`);
  }
  if (accessed !== null && !/^\d{4}-\d{2}-\d{2}$/.test(accessed)) {
    throw new Error(`Source ${id} has malformed accessed date`);
  }
  if (license !== null && typeof license !== "string") throw new Error(`Source ${id} has malformed license`);
  if (claimKinds !== null && !Array.isArray(claimKinds)) throw new Error(`Source ${id} has malformed claimKinds`);

  return {
    id,
    publisher,
    title,
    url: parsedUrl.href,
    type: type || null,
    tier,
    scope,
    taxonomicScope,
    accessed,
    license,
    provenance,
    claimKinds,
  };
}

export function validateSourceRegistry(records, origin = "source registry") {
  const normalized = records.map((record, index) => normalizeSourceRecord(record, `${origin}[${index}]`));
  const ids = new Set();
  for (const record of normalized) {
    if (ids.has(record.id)) throw new Error(`Duplicate source ID: ${record.id}`);
    ids.add(record.id);
  }
  return normalized;
}

export function loadSourceRegistry(dataDir, relativeFiles, { publicOnly = false } = {}) {
  const records = relativeFiles.flatMap((relativePath) => {
    const target = path.join(dataDir, relativePath);
    if (!fs.existsSync(target)) return [];
    return JSON.parse(fs.readFileSync(target, "utf8"));
  });
  const normalized = validateSourceRegistry(records, relativeFiles.join(", "));
  if (!publicOnly) return normalized;
  return normalized.filter((record) => {
    const searchable = JSON.stringify(record).toLowerCase();
    return !searchable.includes("user zero") &&
      record.type !== "purchase_listing" &&
      !searchable.includes("etsy.com");
  });
}
