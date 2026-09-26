import type {
  GardenState,
  Garden,
  GardenCultivationMethod,
  Plant,
  Photo,
  PlantEvent,
  CareTask,
  EventType,
  MaintenanceType,
  Provenance,
  Film,
} from "./garden-data";
import {
  MEANINGFUL_CHANGE_SCHEMA_VERSION,
  meaningfulChangeRequestKey,
  normalizeMeaningfulChangeResult,
  type MeaningfulChangeResult,
} from "./meaningful-changes";
import {
  GARDEN_SUMMARY_SCHEMA_VERSION,
  gardenSummaryRequestKey,
  normalizeGardenSummaryResult,
  type GardenSummaryContextFingerprint,
  type GardenSummaryResult,
  type GardenSummaryScope,
} from "./garden-summaries";
import type { PublicStory, PublicStoryMoment } from "./public-story";
import { getSupabaseClient } from "./supabase";
import { photoStoragePaths } from "./delete-logic";
import { activeGridCells, allGridCells, defaultRectangularLevels, type CustomSystemLevel } from "./custom-system";
import { dateOnlyFromIso, dateOnlyToUtcNoon } from "./temporal";
import { normalizeTimelineNote } from "./garden-logic";

export type GardenMaintenanceAction = "water_change" | "nutrients" | "water_and_nutrients";

type BootstrapGarden = {
  id: string;
  name: string;
  system_instance_id: string;
  system_instance_name: string;
  system_definition_key: string | null;
  cultivation_method?: string | null;
  legacy_system_model: string | null;
  custom_definition_id?: string | null;
  position_capacity: number;
  map_layout: string;
  cover_photo_id: string | null;
  kind: Garden["kind"];
  place: string;
  note: string;
  sort_order: number;
  archived_at: string | null;
  levels?: Array<{ level_number: number; row_count: number; column_count: number; active_cells?: Array<{ row: number; column: number }> }>;
  positions: Array<{
    id: string;
    position_number: number;
    layout: {
      site_id: string;
      site_kind: string;
      is_active: boolean;
      grid_x: number;
      grid_y: number;
      level_number?: number;
      row_number?: number;
      column_number?: number;
      label: string | null;
    } | null;
  }>;
};
type BootstrapPlant = {
  id: string;
  nickname: string | null;
  reference_key: string | null;
  common_name: string;
  scientific_name: string | null;
  cultivar: string | null;
  status: string;
  grow_cycle_id: string;
  cycle_state: string;
  planted_on: string | null;
  planted_on_precision: string;
  harvest_readiness: string;
  garden_id: string;
  system_instance_id: string | null;
  position_id: string;
  position_number: number;
  occupied_from: string | null;
  occupied_until: string | null;
  latest_photo_id: string | null;
  latest_photo_storage_path: string | null;
  latest_photo_captured_at: string | null;
  latest_photo_captured_at_precision: string | null;
  library_plant_id?: string | null;
  library_catalog_version?: string | null;
  library_common_name_snapshot?: string | null;
  library_scientific_name_snapshot?: string | null;
  library_cultivar_snapshot?: string | null;
};
type BootstrapEvent = {
  id: string;
  plant_instance_id: string | null;
  grow_cycle_id: string | null;
  garden_id?: string | null;
  event_type: string;
  occurred_at: string;
  created_at: string;
  note: string | null;
  event_data: Record<string, unknown>;
  revision: number;
};
type BootstrapPhoto = {
  id: string;
  plant_instance_id: string | null;
  grow_cycle_id: string | null;
  event_id: string | null;
  storage_path: string;
  original_filename: string;
  content_type: string;
  byte_size: number;
  captured_at: string | null;
  captured_at_precision: string;
  width: number | null;
  height: number | null;
  media_scope: string;
  provenance?: string | null;
};
type BootstrapAttention = {
  id: string;
  plant_instance_id: string;
  grow_cycle_id: string;
  garden_id: string | null;
  purpose: string;
  subject_key: string;
  title: string;
  origin: string;
  status: string;
  due_on: string | null;
  next_review_on: string | null;
  created_at: string;
};
type Bootstrap = {
  gardens: BootstrapGarden[];
  plants: BootstrapPlant[];
  events: BootstrapEvent[];
  photos: BootstrapPhoto[];
  attention: BootstrapAttention[];
};

export type BackendIndex = {
  growCycleByPlantId: Map<string, string>;
  positionByPlantId: Map<string, string>;
  positionNumberByPlantId: Map<string, number>;
  revisionByEventId: Map<string, number>;
};

function normalizeCultivationMethod(value: unknown): GardenCultivationMethod | null {
  return value === "hydroponic" || value === "soil" || value === "container" ? value : null;
}

const dayMs = 86_400_000;
function daysAgo(value: string | null | undefined): number {
  if (!value) return 0;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value);
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - date.getTime()) / dayMs));
}
function dateOnlyEventValue(event: BootstrapEvent): string | null {
  if (String(event.event_data?.occurred_at_precision ?? "") !== "date") return null;
  const value = String(event.event_data?.occurred_on ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
function eventType(type: string, data: Record<string, unknown>): EventType {
  const journalMilestone = data["journal_milestone"];
  if (type === "observation" && ["germinated", "sprouted", "flowering", "fruiting", "harvest"].includes(String(journalMilestone))) {
    return journalMilestone as EventType;
  }
  if (type === "system_maintenance") return "maintenance";
  if (type === "cycle_started" || type === "seeds_added") return "planted";
  if (type === "germination_observed" || type === "germination_confirmed") return "germinated";
  if (type === "sprouted") return "sprouted";
  if (type === "harvest") return "harvest";
  if (type === "incident_opened") return "problem";
  if (type === "incident_resolved") return "recovery";
  if (type === "cycle_moved") return "transplant";
  if (type === "intervention") {
    const action = String(data["action"] ?? data["class"] ?? "").toLowerCase();
    if (action.includes("prun")) return "pruning";
    if (action.includes("thin")) return "thinning";
    if (action.includes("transplant") || action.includes("move")) return "transplant";
    return "maintenance";
  }
  return "note";
}
function provenance(type: string, data: Record<string, unknown>): Provenance {
  if (data["source"] === "garden_x_journal") return "recorded";
  return [
    "observation",
    "visual_review",
    "development_review",
    "plant_count_observed",
    "germination_observed",
  ].includes(type)
    ? "observed"
    : "recorded";
}
function titleFor(e: BootstrapEvent): string {
  if (e.note?.trim()) return normalizeTimelineNote(e.note).slice(0, 80);
  if (e.event_type === "system_maintenance") {
    const action = String(e.event_data?.class ?? "");
    if (action === "water_and_nutrients") return "Water + nutrients";
    if (action === "water_change") return "Water change";
    if (action === "nutrients") return "Nutrients";
  }
  const labels: Record<string, string> = {
    cycle_started: "Cycle started",
    cycle_ended: "Cycle closed",
    cycle_moved: "Relocated",
    germination_confirmed: "Germination confirmed",
    germination_observed: "Germination observed",
    harvest: "Harvest",
    incident_opened: "Problem recorded",
    incident_resolved: "Problem resolved",
    visual_review: "Visual review",
    development_review: "Development review",
    plant_count_observed: "Plant count observed",
    seeds_added: "Seeds added",
    intervention: "Care recorded",
    observation: "Observation",
  };
  return labels[e.event_type] ?? e.event_type.replaceAll("_", " ");
}
function maintenanceType(purpose: string, subject: string): MaintenanceType {
  const value = (purpose + " " + subject).toLowerCase();
  if (value.includes("harvest")) return "harvest";
  if (value.includes("thin")) return "thinning";
  if (value.includes("water") || value.includes("reservoir")) return "watering";
  if (value.includes("nutrient") || value.includes("feed")) return "nutrients";
  if (value.includes("prun")) return "pruning";
  if (value.includes("pest")) return "pest";
  if (value.includes("light")) return "light";
  if (value.includes("clean") || value.includes("pump")) return "cleaning";
  return "custom";
}
export type PhotoRendition = "preview" | "display" | "original";

const signedUrlTtlSeconds = 60 * 60;
const signedUrlRefreshSkewMs = 60 * 1000;
const signedUrlCache = new Map<string, { url: string; path: string; expiresAt: number }>();
const photoPersistentCacheName = "garden-x-photo-renditions-v1";
const photoPersistentCacheVersion = "v1";
const photoPersistentCacheMaxAgeMs = {
  preview: 30 * 24 * 60 * 60 * 1000,
  display: 14 * 24 * 60 * 60 * 1000,
} as const;
const photoPersistentCacheMaxEntries = { preview: 120, display: 40 } as const;
const photoPersistentCacheMaxBytes = 50 * 1024 * 1024;
let photoCacheUserPromise: Promise<string | null> | null = null;
const persistentObjectUrls = new Set<string>();
const signedUrlPending = new Map<
  string,
  {
    photo: Pick<Photo, "id" | "src" | "backendStoragePath">;
    rendition: PhotoRendition;
    userId: string;
    paths: string[];
    waiters: Array<{ resolve: (url: string) => void; reject: (error: unknown) => void }>;
  }
>();
let signedUrlFlushScheduled = false;
const photoUrlMetrics = { signRequests: 0, pathsRequested: 0, cacheHits: 0, persistentCacheHits: 0, lastDurationMs: 0 };

function derivativePath(originalPath: string, rendition: PhotoRendition) {
  if (rendition === "original") return originalPath;
  const separator = originalPath.lastIndexOf("/");
  if (separator < 0) return originalPath;
  return `${originalPath.slice(0, separator)}/${rendition}.jpg`;
}

export function photoRenditionCandidates(
  originalPath: string,
  rendition: PhotoRendition,
) {
  const ordered = rendition === "preview"
    ? ["preview", "display", "original"] as const
    : rendition === "display"
      ? ["display", "original"] as const
      : ["original"] as const;
  return ordered.map((kind) => derivativePath(originalPath, kind));
}

function photoCacheKey(photoId: string, rendition: PhotoRendition, userId = "anonymous") {
  return `${userId}:${photoId}:${rendition}`;
}

function stablePhotoCacheHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function canUsePersistentPhotoCache() {
  return typeof window !== "undefined" && typeof globalThis.caches !== "undefined" && typeof URL.createObjectURL === "function";
}

/** Keep the cache namespace aligned with the authenticated session without clearing a valid cache on reload. */
export function setPersistentPhotoCacheUserId(userId: string | null) {
  photoCacheUserPromise = Promise.resolve(userId);
}

async function currentPhotoCacheUserId() {
  if (!canUsePersistentPhotoCache()) return null;
  if (!photoCacheUserPromise) {
    photoCacheUserPromise = (async () => {
      try {
        const { data } = await getSupabaseClient().auth.getSession();
        return data.session?.user.id ?? null;
      } catch {
        return null;
      }
    })();
  }
  return photoCacheUserPromise;
}

function persistentPhotoRequest(userId: string, photo: Pick<Photo, "id" | "backendStoragePath">, rendition: Exclude<PhotoRendition, "original">) {
  const origin = window.location.origin;
  const userKey = stablePhotoCacheHash(userId);
  const assetKey = stablePhotoCacheHash(`${photo.id}|${photo.backendStoragePath ?? ""}`);
  return new Request(`${origin}/__garden_x_photo_cache/${photoPersistentCacheVersion}/${userKey}/${assetKey}/${rendition}`);
}

async function openPersistentPhotoCache() {
  if (!canUsePersistentPhotoCache()) return null;
  try {
    return await globalThis.caches.open(photoPersistentCacheName);
  } catch {
    return null;
  }
}

async function evictPersistentPhotoCache(cache: Cache) {
  const requests = await cache.keys();
  const entries = (await Promise.all(requests.map(async (request) => {
    const response = await cache.match(request);
    if (!response) return null;
    const url = new URL(request.url);
    const rendition = url.pathname.endsWith("/preview") ? "preview" : url.pathname.endsWith("/display") ? "display" : null;
    if (!rendition) return null;
    const cachedAt = Number(response.headers.get("x-garden-cached-at") ?? 0);
    const bytes = Number(response.headers.get("content-length") ?? 0);
    return { request, rendition, cachedAt, bytes };
  }))).filter((entry): entry is { request: Request; rendition: "preview" | "display"; cachedAt: number; bytes: number } => Boolean(entry));
  const now = Date.now();
  const expired = entries.filter((entry) => now - entry.cachedAt > photoPersistentCacheMaxAgeMs[entry.rendition]);
  await Promise.all(expired.map((entry) => cache.delete(entry.request)));
  const live = entries.filter((entry) => !expired.includes(entry));
  const counts = { preview: 0, display: 0 };
  let totalBytes = 0;
  const oldestFirst = [...live].sort((a, b) => a.cachedAt - b.cachedAt);
  for (const entry of oldestFirst) {
    const overEntries = counts[entry.rendition] >= photoPersistentCacheMaxEntries[entry.rendition];
    const overBytes = totalBytes + entry.bytes > photoPersistentCacheMaxBytes;
    if (overEntries || overBytes) {
      await cache.delete(entry.request);
      continue;
    }
    counts[entry.rendition] += 1;
    totalBytes += entry.bytes;
  }
}

async function persistentPhotoUrl(photo: Pick<Photo, "id" | "backendStoragePath">, rendition: PhotoRendition) {
  if (rendition === "original") return null;
  const userId = await currentPhotoCacheUserId();
  const cache = userId ? await openPersistentPhotoCache() : null;
  if (!userId || !cache) return null;
  try {
    const candidates = rendition === "preview" ? ["preview", "display"] as const : ["display"] as const;
    for (const candidate of candidates) {
      const request = persistentPhotoRequest(userId, photo, candidate);
      const response = await cache.match(request);
      if (!response) continue;
      const cachedAt = Number(response.headers.get("x-garden-cached-at") ?? 0);
      if (!cachedAt || Date.now() - cachedAt > photoPersistentCacheMaxAgeMs[candidate]) {
        await cache.delete(request);
        continue;
      }
      photoUrlMetrics.persistentCacheHits += 1;
      const objectUrl = URL.createObjectURL(await response.blob());
      persistentObjectUrls.add(objectUrl);
      while (persistentObjectUrls.size > 200) {
        const oldest = persistentObjectUrls.values().next().value as string | undefined;
        if (!oldest) break;
        persistentObjectUrls.delete(oldest);
        URL.revokeObjectURL(oldest);
      }
      return objectUrl;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist only derived UI renditions; originals never enter the durable cache. */
export async function persistPhotoRendition(
  photo: Pick<Photo, "id" | "backendStoragePath">,
  rendition: PhotoRendition,
  signedUrl: string,
) {
  if (rendition === "original" || !photo.backendStoragePath || !signedUrl || signedUrl.startsWith("blob:") || !canUsePersistentPhotoCache()) return;
  const userId = await currentPhotoCacheUserId();
  const cache = userId ? await openPersistentPhotoCache() : null;
  if (!userId || !cache) return;
  const resolved = signedUrlCache.get(photoCacheKey(photo.id, rendition, userId));
  const originalPath = photoRenditionCandidates(photo.backendStoragePath, "original")[0];
  if (resolved?.url === signedUrl && resolved.path === originalPath) return;
  try {
    const response = await fetch(signedUrl, { cache: "force-cache" });
    if (!response.ok) return;
    const blob = await response.blob();
    const headers = new Headers({
      "content-type": blob.type || response.headers.get("content-type") || "image/jpeg",
      "content-length": String(blob.size),
      "x-garden-cached-at": String(Date.now()),
    });
    await cache.put(persistentPhotoRequest(userId, photo, rendition), new Response(blob, { headers }));
    await evictPersistentPhotoCache(cache);
  } catch {
    // Cache Storage is an enhancement. A signed URL remains the network fallback.
  }
}

/** Remove private image bytes for one identity after logout or account switching. */
export async function clearPersistentPhotoCache(userId?: string | null) {
  photoCacheUserPromise = null;
  signedUrlCache.clear();
  for (const objectUrl of persistentObjectUrls) URL.revokeObjectURL(objectUrl);
  persistentObjectUrls.clear();
  const cache = await openPersistentPhotoCache();
  if (!cache) return;
  try {
    const requests = await cache.keys();
    if (!userId) {
      await Promise.all(requests.map((request) => cache.delete(request)));
      return;
    }
    const userKey = stablePhotoCacheHash(userId);
    await Promise.all(requests.filter((request) => request.url.includes(`/__garden_x_photo_cache/${photoPersistentCacheVersion}/${userKey}/`)).map((request) => cache.delete(request)));
  } catch {
    // Private cache cleanup must never block sign-out or the network fallback.
  }
}

function scheduleSignedUrlFlush() {
  if (signedUrlFlushScheduled) return;
  signedUrlFlushScheduled = true;
  queueMicrotask(() => {
    signedUrlFlushScheduled = false;
    void flushSignedUrlRequests();
  });
}

async function flushSignedUrlRequests() {
  const requests = [...signedUrlPending.values()];
  if (!requests.length) return;
  const paths = [...new Set(requests.flatMap((request) => request.paths))];
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  photoUrlMetrics.signRequests += 1;
  photoUrlMetrics.pathsRequested += paths.length;
  const settleError = (reason: unknown) => {
    for (const request of requests) {
      signedUrlPending.delete(photoCacheKey(request.photo.id, request.rendition, request.userId));
      for (const waiter of request.waiters) waiter.reject(reason);
    }
  };
  try {
    const { data, error } = await getSupabaseClient()
      .storage.from("garden-originals")
      .createSignedUrls(paths, signedUrlTtlSeconds);
    if (error) {
      settleError(error);
      return;
    }
    const signedByPath = new Map(
      (data ?? []).flatMap((item) =>
        item.signedUrl && item.path ? [[item.path, item.signedUrl] as const] : [],
      ),
    );
    for (const request of requests) {
      const key = photoCacheKey(request.photo.id, request.rendition, request.userId);
      signedUrlPending.delete(key);
      const url = request.paths.map((path) => signedByPath.get(path)).find(Boolean);
      if (!url) {
        const error = new Error(`No signed URL returned for ${request.rendition} photo.`);
        for (const waiter of request.waiters) waiter.reject(error);
        continue;
      }
      const servedPath = request.paths.find((path) => signedByPath.has(path));
      if (!servedPath) {
        const error = new Error(`No signed URL path returned for ${request.rendition} photo.`);
        for (const waiter of request.waiters) waiter.reject(error);
        continue;
      }
      signedUrlCache.set(key, { url, path: servedPath, expiresAt: Date.now() + signedUrlTtlSeconds * 1000 });
      for (const waiter of request.waiters) waiter.resolve(url);
    }
  } catch (reason) {
    settleError(reason);
  } finally {
    photoUrlMetrics.lastDurationMs =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
  }
}

/** Resolve one private photo only when a rendered surface needs it. */
export function resolvePhotoUrl(
  photo: Pick<Photo, "id" | "src" | "backendStoragePath">,
  rendition: PhotoRendition = "original",
): Promise<string> {
  if (!photo.backendStoragePath) return Promise.resolve(photo.src);
  return (async () => {
    const durableUrl = await persistentPhotoUrl(photo, rendition);
    if (durableUrl) return durableUrl;
    const userId = (await currentPhotoCacheUserId()) ?? "anonymous";
    const key = photoCacheKey(photo.id, rendition, userId);
    const cached = signedUrlCache.get(key);
    if (cached && cached.expiresAt - Date.now() > signedUrlRefreshSkewMs) {
      photoUrlMetrics.cacheHits += 1;
      return cached.url;
    }
    return new Promise<string>((resolve, reject) => {
      const pending = signedUrlPending.get(key);
      if (pending) {
        pending.waiters.push({ resolve, reject });
      } else {
        signedUrlPending.set(key, {
          photo,
          rendition,
          userId,
          paths: photoRenditionCandidates(photo.backendStoragePath!, rendition),
          waiters: [{ resolve, reject }],
        });
      }
      scheduleSignedUrlFlush();
    });
  })();
}

/** Warm the browser and signed-URL caches before a photo becomes visible. */
export async function preloadPhotoRendition(
  photo: Pick<Photo, "id" | "src" | "backendStoragePath">,
  rendition: PhotoRendition = "display",
): Promise<string> {
  const url = await resolvePhotoUrl(photo, rendition);
  if (url && typeof Image !== "undefined") {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => void persistPhotoRendition(photo, rendition, url);
    image.src = url;
  }
  return url;
}

export function getPhotoUrlMetrics() {
  return { ...photoUrlMetrics };
}

function inferRectangularLevels(
  positions: Array<{ levelNumber?: number; rowNumber?: number; columnNumber?: number }>,
) {
  if (!positions.length || positions.some((position) => position.rowNumber === undefined || position.columnNumber === undefined)) return [];
  const byLevel = new Map<number, { rows: number; columns: number; activeCells: Array<{ row: number; column: number }> }>();
  for (const position of positions) {
    const level = position.levelNumber ?? 1;
    const current = byLevel.get(level) ?? { rows: 0, columns: 0, activeCells: [] };
    current.rows = Math.max(current.rows, position.rowNumber ?? 0);
    current.columns = Math.max(current.columns, position.columnNumber ?? 0);
    current.activeCells.push({ row: position.rowNumber!, column: position.columnNumber! });
    byLevel.set(level, current);
  }
  return [...byLevel.entries()].sort(([a], [b]) => a - b).map(([levelNumber, value]) => ({ levelNumber, rows: value.rows, columns: value.columns, activeCells: value.activeCells }));
}

export async function loadGardenState(): Promise<{ state: GardenState; index: BackendIndex }> {
  const { data, error } = await getSupabaseClient().rpc("garden_x_get_bootstrap");
  if (error) throw new Error(error.message);
  const b = data as Bootstrap;
  const systemMaintenanceResponse = await getSupabaseClient().rpc("garden_get_system_maintenance_events");
  if (systemMaintenanceResponse.error) throw new Error(systemMaintenanceResponse.error.message);
  const systemMaintenance = (systemMaintenanceResponse.data ?? []) as BootstrapEvent[];
  const filmsResponse = await getSupabaseClient().rpc("garden_x_get_saved_films");
  if (filmsResponse.error) throw new Error(filmsResponse.error.message);
  const savedFilms = (filmsResponse.data ?? []) as Array<{
    id: string;
    plant_instance_id: string;
    title: string;
    photo_ids: string[];
    music: string;
    created_at: string;
  }>;
  const historicalResponse = await getSupabaseClient().rpc("garden_x_get_historical_photos");
  if (historicalResponse.error) throw new Error(historicalResponse.error.message);
  const invalidatedEventPhotosResponse = await getSupabaseClient().rpc(
    "garden_x_get_invalidated_event_photos",
  );
  if (invalidatedEventPhotosResponse.error)
    throw new Error(invalidatedEventPhotosResponse.error.message);
  const allPhotos = [
    ...(b.photos ?? []),
    ...((historicalResponse.data ?? []) as BootstrapPhoto[]),
    ...((invalidatedEventPhotosResponse.data ?? []) as BootstrapPhoto[]),
  ].filter((photo, index, list) => list.findIndex((item) => item.id === photo.id) === index);

  const gardens: Garden[] = (b.gardens ?? []).map((g) => {
    const backendPositions = (g.positions ?? []).map((p) => ({
      id: p.id,
      number: p.position_number,
      ...(p.layout?.grid_x !== undefined ? { gridX: p.layout.grid_x } : {}),
      ...(p.layout?.grid_y !== undefined ? { gridY: p.layout.grid_y } : {}),
      ...(p.layout?.level_number !== undefined ? { levelNumber: p.layout.level_number } : {}),
      ...(p.layout?.row_number !== undefined ? { rowNumber: p.layout.row_number } : {}),
      ...(p.layout?.column_number !== undefined ? { columnNumber: p.layout.column_number } : {}),
      ...(p.layout?.label !== undefined ? { label: p.layout.label } : {}),
      active: p.layout?.is_active ?? true,
    }));
    const persistedLevels = (g.levels ?? []).map((level) => ({
      levelNumber: level.level_number,
      rows: level.row_count,
      columns: level.column_count,
      activeCells: level.active_cells?.length ? level.active_cells : allGridCells({ rows: level.row_count, columns: level.column_count }),
    }));
    const physicalLevels = inferRectangularLevels(backendPositions);
    const systemLayoutLevels = persistedLevels.length
      ? persistedLevels
      : physicalLevels.length
        ? physicalLevels
        : defaultRectangularLevels(g.position_capacity).map((level, index) => ({ ...level, activeCells: activeGridCells(level), levelNumber: index + 1 }));
    return {
    id: g.id,
    name: g.name,
    kind: g.kind ?? "hydroponic",
    cultivationMethod: normalizeCultivationMethod(g.cultivation_method),
    cover: "",
    coverPhotoId: g.cover_photo_id,
    place: g.place ?? "",
    note: g.note ?? "",
    archived: Boolean(g.archived_at),
    machine: {
      name: g.system_instance_name || g.legacy_system_model || "Growing system",
      pods: g.position_capacity,
    },
    backendSystemInstanceId: g.system_instance_id,
    systemDefinitionKey: g.system_definition_key ?? null,
    customSystemDefinitionId: g.custom_definition_id ?? null,
    ...(g.custom_definition_id ? { customSystemLevels: persistedLevels } : {}),
    systemLayoutLevels,
    backendPositions,
  };
  });

  const plants: Plant[] = (b.plants ?? [])
    .filter((p) => p.cycle_state === "active")
    .map((p) => ({
      id: p.id,
      gardenId: p.garden_id,
      name: p.nickname?.trim() || p.common_name,
      nickname: p.nickname ?? null,
      species: p.common_name,
      scientific: p.scientific_name ?? "",
      variety: p.cultivar ?? "",
      knowledgeId: p.reference_key ?? "",
      libraryPlantId: p.library_plant_id ?? null,
      libraryCatalogVersion: p.library_catalog_version ?? null,
      libraryIdentitySnapshot: p.library_plant_id
        ? {
            commonName: p.library_common_name_snapshot ?? p.common_name,
            scientificName: p.library_scientific_name_snapshot ?? p.scientific_name,
            cultivar: p.library_cultivar_snapshot ?? p.cultivar,
          }
        : null,
      plantedDaysAgo: daysAgo(p.planted_on),
      slot: `Pod ${p.position_number}`,
      status: (b.attention ?? []).some((a) => a.plant_instance_id === p.id) ? "watching" : "steady",
      statusNote: p.harvest_readiness === "ready" ? "Ready to harvest." : "",
      heroPhotoId: p.latest_photo_id ?? "",
      identityConfirmed: Boolean(p.library_plant_id),
      backendGrowCycleId: p.grow_cycle_id,
      backendPositionId: p.position_id,
    }));

  const photosByEventId = new Map<string, string[]>();
  for (const photo of allPhotos) {
    if (!photo.event_id) continue;
    const ids = photosByEventId.get(photo.event_id) ?? [];
    ids.push(photo.id);
    photosByEventId.set(photo.event_id, ids);
  }

  const events: PlantEvent[] = ([...(b.events ?? []), ...systemMaintenance]).map((e) => {
    const eventPhotoIds = photosByEventId.get(e.id);
    const effectiveDateOnly = dateOnlyEventValue(e);
    return {
      id: e.id,
      plantId: e.plant_instance_id ?? "",
      ...(e.garden_id ? { gardenId: e.garden_id } : {}),
      daysAgo: daysAgo(effectiveDateOnly ?? e.occurred_at),
      occurredAt: e.occurred_at,
      type: eventType(e.event_type, e.event_data ?? {}),
      title: titleFor(e),
      ...(typeof e.event_data?.journal_milestone === "string" ? { journalMilestone: e.event_data.journal_milestone as PlantEvent["journalMilestone"] } : {}),
      ...(e.note ? { detail: normalizeTimelineNote(e.note) } : {}),
      provenance: provenance(e.event_type, e.event_data ?? {}),
      backendEventType: e.event_type,
      backendRevision: e.revision,
      ...(eventPhotoIds ? { photoIds: eventPhotoIds } : {}),
      ...(eventPhotoIds?.[0] ? { photoId: eventPhotoIds[0] } : {}),
    };
  });

  const eventById = new Map((b.events ?? []).map((e) => [e.id, e]));
  const photos: Photo[] = allPhotos.map((p) => {
    const e = p.event_id ? eventById.get(p.event_id) : undefined;
    const effectiveDateOnly = e ? dateOnlyEventValue(e) : null;
    return {
      id: p.id,
      plantId: p.plant_instance_id ?? "",
      mediaScope: p.media_scope,
      src: "",
      daysAgo: daysAgo(
        p.captured_at_precision === "date"
          ? effectiveDateOnly ?? p.captured_at ?? e?.occurred_at
          : p.captured_at ?? e?.occurred_at,
      ),
      caption: e?.note?.trim() || "",
      metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
      backendStoragePath: p.storage_path,
      capturedAt: p.captured_at,
      capturedAtPrecision: p.captured_at_precision,
      backendGrowCycleId: p.grow_cycle_id,
      provenance: p.provenance ?? (p.event_id ? "recorded" : "historical_evidence"),
      isHistoricalEvidence: !p.event_id,
      ...(p.event_id ? { backendEventId: p.event_id } : {}),
    };
  });

  for (const plant of plants) {
    const latest = photos
      .filter((photo) => photo.plantId === plant.id)
      .sort((a, b) => a.daysAgo - b.daysAgo)[0];
    if (latest) plant.heroPhotoId = latest.id;
  }

  for (const g of gardens) {
    const own = plants
      .filter((p) => p.gardenId === g.id)
      .map((p) => photos.find((ph) => ph.id === p.heroPhotoId))
      .filter(Boolean) as Photo[];
    g.cover = own.sort((a, b) => a.daysAgo - b.daysAgo)[0]?.src ?? "";
  }

  const tasks: CareTask[] = (b.attention ?? []).map((a) => {
    const due = a.due_on ?? a.next_review_on;
    const delta = due
      ? Math.round(
          (new Date(due + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / dayMs,
        )
      : 0;
    return {
      id: a.id,
      plantId: a.plant_instance_id,
      type: maintenanceType(a.purpose, a.subject_key),
      label: a.title,
      dueInDays: delta,
      done: false,
      hint: a.origin,
      backendAttentionId: a.id,
    };
  });

  return {
    state: {
      gardens,
      plants,
      photos,
      events,
      tasks,
      films: savedFilms.map((film) => ({
        id: film.id,
        plantId: film.plant_instance_id,
        title: film.title,
        photoIds: film.photo_ids,
        music: film.music,
        createdDaysAgo: daysAgo(film.created_at),
      })),
    },
    index: {
      growCycleByPlantId: new Map((b.plants ?? []).map((p) => [p.id, p.grow_cycle_id])),
      positionByPlantId: new Map((b.plants ?? []).map((p) => [p.id, p.position_id])),
      positionNumberByPlantId: new Map((b.plants ?? []).map((p) => [p.id, p.position_number])),
      revisionByEventId: new Map((b.events ?? []).map((e) => [e.id, e.revision])),
    },
  };
}

export async function completeAttention(taskId: string, note?: string) {
  const { error } = await getSupabaseClient().rpc("garden_complete_attention_item", {
    p_request_id: crypto.randomUUID(),
    p_task_id: taskId,
    p_note: note ?? null,
    p_review_result: null,
  });
  if (error) throw new Error(error.message);
}

function isoDateFromDaysAgo(value: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, value));
  return d.toISOString().slice(0, 10);
}

function effectiveDateFromEvent(event: Pick<PlantEvent, "occurredAt" | "daysAgo">): string {
  return dateOnlyFromIso(event.occurredAt) ?? isoDateFromDaysAgo(event.daysAgo);
}

async function cycleDetail(growCycleId: string): Promise<{
  revision: number;
  history?: Array<{ id: string; event_type: string; occurred_at: string }>;
}> {
  const { data, error } = await getSupabaseClient().rpc("garden_get_cycle", {
    p_grow_cycle_id: growCycleId,
  });
  if (error) throw new Error(error.message);
  const row = data as {
    revision?: number;
    history?: Array<{ id: string; event_type: string; occurred_at: string }>;
  } | null;
  if (!row || typeof row.revision !== "number") throw new Error("Cycle revision unavailable.");
  return { revision: row.revision, history: row.history ?? [] };
}

export async function recordGardenMaintenance(gardenId: string, action: GardenMaintenanceAction, occurredOn: string, note?: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_record_system_maintenance", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: gardenId,
    p_action: action,
    p_occurred_on: occurredOn,
    p_note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

function decodeDataUrl(src: string): { mime: string; bytes: Uint8Array } | null {
  const match = src.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const raw = atob(match[2]!);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return { mime: match[1]!, bytes };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function imageDimensions(
  bytes: Uint8Array,
  mime: string,
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(
      new Blob([
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      ], { type: mime }),
    );
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    // Some browser decoders cannot inspect formats such as HEIC. Uploading
    // remains valid; dimensions are simply left unknown for that asset.
    return null;
  }
}

async function uploadEventPhoto(eventId: string, photo: Photo, effectiveDate?: string): Promise<void> {
  const decoded = decodeDataUrl(photo.src);
  if (!decoded) throw new Error("Photo could not be read.");
  const photoId = crypto.randomUUID();
  const checksum = await sha256Hex(decoded.bytes);
  const dimensions = await imageDimensions(decoded.bytes, decoded.mime);
  // Record a Moment has one user-selected effective date. Keep photo evidence
  // on that same calendar day even if a browser omitted photo metadata.
  const capturedDate = effectiveDate ?? dateOnlyFromIso(photo.capturedAt) ?? isoDateFromDaysAgo(photo.daysAgo);
  const capturedAt = dateOnlyToUtcNoon(capturedDate);
  const { data, error } = await getSupabaseClient().rpc("garden_x_prepare_event_photo", {
    p_photo_id: photoId,
    p_event_id: eventId,
    p_original_filename: "garden-photo",
    p_content_type: decoded.mime,
    p_byte_size: decoded.bytes.byteLength,
    p_captured_at: capturedAt,
    // The UI keeps a calendar-date precision (`date`) for local photo state,
    // while the canonical RPC accepts only exact/approximate/unknown. A
    // selected calendar date is stored at UTC noon above and is exact at the
    // date-only level; never send the UI-only enum to Postgres.
    p_captured_at_precision: dateOnlyFromIso(photo.capturedAt) ? "exact" : "approximate",
    p_checksum_sha256: checksum,
  });
  if (error) throw new Error(error.message);
  const prepared = data as { storage_path: string };
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(
    `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/garden-originals/${prepared.storage_path}`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
        Authorization: `Bearer ${session.access_token}`,
        "content-type": decoded.mime,
        "cache-control": "max-age=3600",
        "x-upsert": "false",
      },
      body: decoded.bytes.buffer.slice(
        decoded.bytes.byteOffset,
        decoded.bytes.byteOffset + decoded.bytes.byteLength,
      ) as ArrayBuffer,
    },
  );
  if (!response.ok && response.status !== 409) throw new Error("Photo upload failed.");
  const confirmation = await getSupabaseClient().rpc("garden_mark_photo_uploaded", {
    p_photo_id: photoId,
    p_checksum_sha256: checksum,
    p_width: dimensions?.width ?? null,
    p_height: dimensions?.height ?? null,
  });
  if (confirmation.error) throw new Error(confirmation.error.message);
}

export async function createPlantRecord(
  plant: Plant,
  positionId: string,
  photo?: Photo,
): Promise<void> {
  const plantedOn = isoDateFromDaysAgo(plant.plantedDaysAgo);
  const { data, error } = await getSupabaseClient().rpc("garden_x_create_plant", {
    p_request_id: crypto.randomUUID(),
    p_plant_instance_id: plant.id,
    p_position_id: positionId,
    p_nickname: plant.name,
    p_common_name: plant.species,
    p_scientific_name: plant.scientific || null,
    p_cultivar: plant.variety || null,
    p_reference_key: plant.knowledgeId || null,
    p_planted_on: plantedOn,
    p_planted_on_precision: "exact",
  });
  if (error) throw new Error(error.message);
  if (photo) {
    const created = data as { event_id: string };
    await uploadEventPhoto(created.event_id, photo);
  }
}

export type LibraryPlantRecordDraft = {
  plantInstanceId: string;
  positionId: string;
  libraryPlantId: string;
  nickname?: string;
  plantedOn: string | null;
  plantedOnPrecision: "exact" | "approximate" | "unknown";
  photo?: Photo;
};

/** Creates only after the Library identity has been resolved server-side. */
export async function createLibraryPlantRecord(
  draft: LibraryPlantRecordDraft,
): Promise<{ plantInstanceId: string }> {
  const { data, error } = await getSupabaseClient().rpc("garden_x_create_library_plant", {
    p_request_id: crypto.randomUUID(),
    p_plant_instance_id: draft.plantInstanceId,
    p_position_id: draft.positionId,
    p_library_plant_id: draft.libraryPlantId,
    p_nickname: draft.nickname?.trim() || null,
    p_planted_on: draft.plantedOn,
    p_planted_on_precision: draft.plantedOnPrecision,
  });
  if (error) throw new Error(error.message);
  const created = data as { event_id: string; plant_instance_id: string };
  if (draft.photo) await uploadEventPhoto(created.event_id, draft.photo);
  return { plantInstanceId: created.plant_instance_id };
}

export async function updatePlantIdentityRecord(plant: Plant): Promise<void> {
  if (plant.libraryPlantId) {
    const { error } = await getSupabaseClient().rpc("garden_x_update_library_plant_identity", {
      p_request_id: crypto.randomUUID(),
      p_plant_instance_id: plant.id,
      p_nickname: plant.name,
      p_library_plant_id: plant.libraryPlantId,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await getSupabaseClient().rpc("garden_x_update_plant_identity", {
    p_request_id: crypto.randomUUID(),
    p_plant_instance_id: plant.id,
    p_nickname: plant.name,
    p_common_name: plant.species,
    p_scientific_name: plant.scientific || null,
    p_cultivar: plant.variety || null,
    p_reference_key: plant.knowledgeId || null,
  });
  if (error) throw new Error(error.message);
}

export async function confirmPlantLibraryIdentityRecord(
  plant: Plant,
  libraryPlantId: string,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_update_library_plant_identity", {
    p_request_id: crypto.randomUUID(),
    p_plant_instance_id: plant.id,
    p_nickname: plant.nickname ?? null,
    p_library_plant_id: libraryPlantId,
  });
  if (error) throw new Error(error.message);
}

export async function movePlantRecord(
  plantId: string,
  targetPositionId: string,
  movedDaysAgo: number,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_move_plant", {
    p_request_id: crypto.randomUUID(),
    p_plant_instance_id: plantId,
    p_target_position_id: targetPositionId,
    p_moved_on: isoDateFromDaysAgo(movedDaysAgo),
  });
  if (error) throw new Error(error.message);
}

export async function correctPlantingRecord(
  plant: Plant,
  newDaysAgo: number,
  reason?: string,
): Promise<void> {
  if (!plant.backendGrowCycleId) return;
  const cycle = await cycleDetail(plant.backendGrowCycleId);
  const { error } = await getSupabaseClient().rpc("garden_correct_cycle_planting", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: plant.backendGrowCycleId,
    p_expected_revision: cycle.revision,
    p_planted_on: isoDateFromDaysAgo(newDaysAgo),
    p_planted_on_precision: "exact",
    p_reason: reason?.trim() || "Corrected in Garden X",
  });
  if (error) throw new Error(error.message);
}

export async function closePlantCycleRecord(
  plant: Plant,
  daysAgoValue: number,
  reason: string,
  note?: string,
): Promise<void> {
  if (!plant.backendGrowCycleId) return;
  const cycle = await cycleDetail(plant.backendGrowCycleId);
  const { error } = await getSupabaseClient().rpc("garden_close_cycle", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: plant.backendGrowCycleId,
    p_expected_revision: cycle.revision,
    p_ended_on: isoDateFromDaysAgo(daysAgoValue),
    p_reason: reason || "closed",
    p_note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function createFollowUpRecord(
  plant: Plant,
  label: string,
  dueInDays: number,
): Promise<void> {
  if (!plant.backendGrowCycleId) return;
  const due = new Date();
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + Math.max(0, dueInDays));
  const subject =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "general";
  const value = label.toLowerCase();
  const purpose = value.includes("nutrient")
    ? "perform_nutrients"
    : value.includes("water") || value.includes("reservoir")
      ? "perform_water_change"
      : value.includes("harvest")
        ? "perform_harvest"
        : value.includes("prun")
          ? "evaluate_pruning"
          : value.includes("thin")
            ? "evaluate_thinning"
            : "evaluate_visual_review";
  const { error } = await getSupabaseClient().rpc("garden_create_attention_item", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: plant.gardenId,
    p_grow_cycle_id: plant.backendGrowCycleId,
    p_purpose: purpose,
    p_subject_key: subject,
    p_due_on: due.toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
}

async function recordFact(
  growCycleId: string,
  factType: string,
  occurredOn: string,
  note: string | undefined,
  factData: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("garden_record_cycle_fact", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: growCycleId,
    p_fact_type: factType,
    p_occurred_on: occurredOn,
    p_note: note?.trim() || null,
    p_fact_data: factData,
  });
  if (error) throw new Error(error.message);
  return (data as { event_id: string }).event_id;
}

async function recordObservation(
  growCycleId: string,
  event: Omit<PlantEvent, "id">,
): Promise<string> {
  const note = (event.detail?.trim() || event.title.trim()).slice(0, 1000);
  const { data, error } = await getSupabaseClient().rpc("garden_x_create_observation", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: growCycleId,
    p_occurred_on: effectiveDateFromEvent(event),
    p_note: note || "Observation",
  });
  if (error) throw new Error(error.message);
  return (data as { event_id: string }).event_id;
}

async function recordJournalMoment(
  growCycleId: string,
  event: Omit<PlantEvent, "id">,
  hasPhoto: boolean,
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("garden_x_create_journal_moment", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: growCycleId,
    p_occurred_on: effectiveDateFromEvent(event),
    p_note: event.detail?.trim() || null,
    p_milestone: event.journalMilestone ?? null,
    p_has_photo: hasPhoto,
  });
  if (error) throw new Error(error.message);
  return (data as { event_id: string }).event_id;
}

export async function persistMoment(
  plant: Plant,
  event: Omit<PlantEvent, "id">,
  photo?: Photo,
): Promise<void> {
  if (!plant.backendGrowCycleId) return;
  const cycleId = plant.backendGrowCycleId;
  let eventId: string;

  if (event.journalMilestone) {
    eventId = await recordJournalMoment(cycleId, event, Boolean(photo));
  } else if (event.type === "germinated") {
    eventId = await recordFact(
      cycleId,
      "germination_observed",
      effectiveDateFromEvent(event),
      event.detail || event.title,
      {},
    );
  } else if (event.type === "problem") {
    eventId = await recordFact(
      cycleId,
      "incident_opened",
      effectiveDateFromEvent(event),
      event.detail || event.title,
      { severity: "watch" },
    );
  } else if (event.type === "recovery") {
    const detail = await cycleDetail(cycleId);
    const history = [...(detail.history ?? [])].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
    const incident = history.find((h) => h.event_type === "incident_opened");
    eventId = incident
      ? await recordFact(cycleId, "incident_resolved", effectiveDateFromEvent(event), event.detail || event.title, {
          incident_event_id: incident.id,
        })
      : await recordObservation(cycleId, event);
  } else if (event.backendEventType === "visual_review") {
    eventId = await recordFact(
      cycleId,
      "visual_review",
      effectiveDateFromEvent(event),
      event.detail || event.title,
      { result: "reassuring" },
    );
  } else if (event.type === "pruning" || event.type === "thinning") {
    eventId = await recordFact(
      cycleId,
      "intervention",
      effectiveDateFromEvent(event),
      event.detail || event.title,
      {
        class: event.type === "pruning" ? "pruning" : "thinning",
        action: event.title.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      },
    );
  } else if (event.type === "harvest") {
    const detail = await cycleDetail(cycleId);
    const { data, error } = await getSupabaseClient().rpc("garden_x_record_harvest", {
      p_request_id: crypto.randomUUID(),
      p_grow_cycle_id: cycleId,
      p_expected_revision: detail.revision,
      p_occurred_on: effectiveDateFromEvent(event),
      p_note: event.detail || event.title,
    });
    if (error) throw new Error(error.message);
    eventId = (data as { event_id?: string } | null)?.event_id ?? "";
    if (!eventId) {
      const refreshed = await cycleDetail(cycleId);
      eventId = refreshed.history?.find((h) => h.event_type === "harvest")?.id ?? "";
    }
  } else if (event.type === "maintenance") {
    eventId = await recordFact(
      cycleId,
      "intervention",
      effectiveDateFromEvent(event),
      event.detail || event.title,
      {
        class: "other",
        action: /water\s*\+\s*nutrients|agua\s*\+\s*nutrientes/i.test(event.title)
          ? "water_and_nutrients"
          : event.title.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      },
    );
  } else if (event.type === "transplant" && event.title === "Relocated") {
    return;
  } else {
    eventId = await recordObservation(cycleId, event);
  }

  if (photo && eventId) await uploadEventPhoto(eventId, photo, effectiveDateFromEvent(event));
}

export async function createGardenRecord(
  garden: Garden,
  systemDefinitionKey?: string,
): Promise<void> {
  const systemId = garden.backendSystemInstanceId ?? crypto.randomUUID();
  const capacity = Math.max(
    1,
    Math.min(36, garden.machine?.pods ?? garden.backendPositions?.length ?? 1),
  );
  const { error } = await getSupabaseClient().rpc("garden_x_create_garden", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: garden.id,
    p_system_instance_id: systemId,
    p_name: garden.name,
    p_kind: garden.kind,
    p_place: garden.place,
    p_note: garden.note,
    p_system_definition_key: systemDefinitionKey ?? null,
    p_system_name: garden.machine?.name ?? null,
    p_position_capacity: capacity,
  });
  if (error) throw new Error(error.message);
  if (garden.cultivationMethod) {
    const { error: methodError } = await getSupabaseClient().rpc(
      "garden_x_set_cultivation_method",
      {
        p_request_id: crypto.randomUUID(),
        p_garden_id: garden.id,
        p_cultivation_method: garden.cultivationMethod,
      },
    );
    if (methodError) throw new Error(methodError.message);
  }
}

export type CustomSystemDraft = {
  name: string;
  levels: CustomSystemLevel[];
  photoDataUrl?: string | null;
};

async function uploadGardenCoverPhoto(
  gardenId: string,
  definitionId: string,
  src: string,
): Promise<void> {
  const decoded = decodeDataUrl(src);
  if (!decoded) throw new Error("System photo could not be read.");
  const checksum = await sha256Hex(decoded.bytes);
  const dimensions = await imageDimensions(decoded.bytes, decoded.mime);
  const { data, error } = await getSupabaseClient().rpc("garden_prepare_media_photo", {
    p_request_id: crypto.randomUUID(),
    p_scope: "garden_cover",
    p_garden_id: gardenId,
    p_original_filename: "custom-system-photo",
    p_content_type: decoded.mime,
    p_byte_size: decoded.bytes.byteLength,
    p_checksum_sha256: checksum,
  });
  if (error) throw new Error(error.message);
  const prepared = data as { photo_id: string; storage_path: string };
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(
    `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/garden-originals/${prepared.storage_path}`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
        Authorization: `Bearer ${session.access_token}`,
        "content-type": decoded.mime,
        "cache-control": "max-age=3600",
        "x-upsert": "false",
      },
      body: decoded.bytes.buffer.slice(
        decoded.bytes.byteOffset,
        decoded.bytes.byteOffset + decoded.bytes.byteLength,
      ) as ArrayBuffer,
    },
  );
  if (!response.ok && response.status !== 409) throw new Error("System photo upload failed.");
  const uploaded = await getSupabaseClient().rpc("garden_mark_photo_uploaded", {
    p_photo_id: prepared.photo_id,
    p_checksum_sha256: checksum,
    p_width: dimensions?.width ?? null,
    p_height: dimensions?.height ?? null,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  const attached = await getSupabaseClient().rpc("garden_x_set_custom_system_photo", {
    p_request_id: crypto.randomUUID(),
    p_definition_id: definitionId,
    p_photo_id: prepared.photo_id,
  });
  if (attached.error) throw new Error(attached.error.message);
}

/** Creates the user-owned definition, instance, levels and positions atomically. */
export async function createCustomSystemRecord(
  draft: CustomSystemDraft,
): Promise<{ gardenId: string; photoWarning?: string }> {
  const gardenId = crypto.randomUUID();
  const systemInstanceId = crypto.randomUUID();
  const definitionId = crypto.randomUUID();
  const { data, error } = await getSupabaseClient().rpc("garden_x_create_custom_system", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: gardenId,
    p_system_instance_id: systemInstanceId,
    p_definition_id: definitionId,
    p_name: draft.name,
    p_levels: draft.levels.map((level) => ({
      rows: level.rows,
      columns: level.columns,
      active_cells: level.activeCells ?? allGridCells(level),
    })),
  });
  if (error) throw new Error(error.message);
  let photoWarning: string | undefined;
  if (draft.photoDataUrl) {
    try {
      await uploadGardenCoverPhoto(gardenId, definitionId, draft.photoDataUrl);
    } catch (uploadError) {
      photoWarning =
        uploadError instanceof Error
          ? uploadError.message
          : "The system was created, but its photo could not be uploaded.";
    }
  }
  return {
    gardenId: (data as { garden_id?: string } | null)?.garden_id ?? gardenId,
    ...(photoWarning ? { photoWarning } : {}),
  };
}

export async function updateCustomSystemLayoutRecord(
  gardenId: string,
  levels: CustomSystemLevel[],
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_update_custom_system_layout", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: gardenId,
    p_levels: levels.map((level) => ({
      rows: level.rows,
      columns: level.columns,
      active_cells: level.activeCells ?? allGridCells(level),
    })),
  });
  if (error) throw new Error(error.message);
}

export async function updateGardenRecord(garden: Garden): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_update_garden_settings", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: garden.id,
    p_system_instance_id: garden.backendSystemInstanceId,
    p_name: garden.name,
    p_kind: garden.kind,
    p_place: garden.place,
    p_note: garden.note,
    p_system_name: garden.machine?.name ?? null,
    p_archived: Boolean(garden.archived),
  });
  if (error) throw new Error(error.message);
  if (garden.cultivationMethod !== undefined) {
    const { error: methodError } = await getSupabaseClient().rpc(
      "garden_x_set_cultivation_method",
      {
        p_request_id: crypto.randomUUID(),
        p_garden_id: garden.id,
        p_cultivation_method: garden.cultivationMethod,
      },
    );
    if (methodError) throw new Error(methodError.message);
  }
}

type GardenCoverPhotoRecord = {
  id: string;
  storage_path: string;
  original_filename?: string | null;
  content_type?: string | null;
  byte_size?: number | null;
  captured_at?: string | null;
  captured_at_precision?: string | null;
  is_cover?: boolean;
};

/** Loads only the uploaded garden-level media for one authorized garden. */
export async function loadGardenCoverPhotosRecord(gardenId: string): Promise<Photo[]> {
  const { data, error } = await getSupabaseClient().rpc("garden_get_garden_cover_photos", {
    p_garden_id: gardenId,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as GardenCoverPhotoRecord[]).map((photo) => ({
    id: photo.id,
    plantId: "",
    mediaScope: "garden_cover",
    src: "",
    daysAgo: 0,
    caption: "",
    metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
    backendStoragePath: photo.storage_path,
    capturedAt: photo.captured_at ?? null,
    capturedAtPrecision: photo.captured_at_precision,
    provenance: "recorded",
  }));
}

async function uploadPreparedGardenCoverPhoto(
  gardenId: string,
  src: string,
  originalFilename = "garden-cover",
): Promise<string> {
  const decoded = decodeDataUrl(src);
  if (!decoded) throw new Error("System photo could not be read.");
  const checksum = await sha256Hex(decoded.bytes);
  const dimensions = await imageDimensions(decoded.bytes, decoded.mime);
  const { data, error } = await getSupabaseClient().rpc("garden_prepare_media_photo", {
    p_request_id: crypto.randomUUID(),
    p_scope: "garden_cover",
    p_garden_id: gardenId,
    p_original_filename: originalFilename.slice(0, 240),
    p_content_type: decoded.mime,
    p_byte_size: decoded.bytes.byteLength,
    p_checksum_sha256: checksum,
  });
  if (error) throw new Error(error.message);
  const prepared = data as { photo_id: string; storage_path: string };
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(
    `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/garden-originals/${prepared.storage_path}`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
        Authorization: `Bearer ${session.access_token}`,
        "content-type": decoded.mime,
        "cache-control": "max-age=3600",
        "x-upsert": "false",
      },
      body: decoded.bytes.buffer.slice(
        decoded.bytes.byteOffset,
        decoded.bytes.byteOffset + decoded.bytes.byteLength,
      ) as ArrayBuffer,
    },
  );
  if (!response.ok && response.status !== 409) throw new Error("System photo upload failed.");
  const uploaded = await getSupabaseClient().rpc("garden_mark_photo_uploaded", {
    p_photo_id: prepared.photo_id,
    p_checksum_sha256: checksum,
    p_width: dimensions?.width ?? null,
    p_height: dimensions?.height ?? null,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  return prepared.photo_id;
}

export async function setGardenCoverPhotoRecord(
  gardenId: string,
  photoId: string | null,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_set_garden_cover", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: gardenId,
    p_photo_id: photoId,
  });
  if (error) throw new Error(error.message);
}

export async function uploadGardenCoverPhotoRecord(
  gardenId: string,
  src: string,
  originalFilename?: string,
): Promise<string> {
  const photoId = await uploadPreparedGardenCoverPhoto(gardenId, src, originalFilename);
  await setGardenCoverPhotoRecord(gardenId, photoId);
  return photoId;
}

export async function reorderGardenRecords(gardenIds: string[]): Promise<void> {
  if (!gardenIds.length) return;
  const { error } = await getSupabaseClient().rpc("garden_x_reorder_gardens", {
    p_request_id: crypto.randomUUID(),
    p_garden_ids: gardenIds,
  });
  if (error) throw new Error(error.message);
}

export type DeleteGardenResult = { storageCleanupWarning?: string; storagePathCount?: number };

export async function deleteGardenRecord(gardenId: string): Promise<DeleteGardenResult> {
  const { data, error } = await getSupabaseClient().rpc("garden_x_delete_garden", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: gardenId,
  });
  if (error) throw new Error(error.message);
  const result = (data ?? {}) as { storage_paths?: string[]; storage_path_count?: number };
  const paths = Array.isArray(result.storage_paths) ? result.storage_paths.filter((path): path is string => typeof path === "string" && path.length > 0) : [];
  if (!paths.length) return { storagePathCount: result.storage_path_count ?? 0 };
  const { error: storageError } = await getSupabaseClient().storage.from("garden-originals").remove(paths);
  return {
    storagePathCount: result.storage_path_count ?? paths.length,
    ...(storageError ? { storageCleanupWarning: storageError.message } : {}),
  };
}

/**
 * Events cannot be physically deleted in V1: event_revisions and attention
 * history intentionally retain their audit links. This calls the existing
 * owner-scoped invalidation command, which removes the event from current
 * projections while preserving its audit record and any attached evidence.
 */
export async function invalidateEventRecord(
  eventId: string,
  expectedRevision: number,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_invalidate_event", {
    p_request_id: crypto.randomUUID(),
    p_event_id: eventId,
    p_expected_revision: expectedRevision,
    p_reason: "Removed from Garden X timeline",
  });
  if (error) throw new Error(error.message);
}

export type DeletePhotoResult = { storageCleanupWarning?: string };

/** Delete one owner-scoped photo row, then remove only its exact Storage objects. */
export async function deletePhotoRecord(photoId: string): Promise<DeletePhotoResult> {
  const { data, error } = await getSupabaseClient().rpc("garden_x_delete_photo", {
    p_request_id: crypto.randomUUID(),
    p_photo_id: photoId,
  });
  if (error) throw new Error(error.message);
  const response = data as { storage_path?: string } | null;
  if (!response?.storage_path) return {};
  const paths = photoStoragePaths(response.storage_path);
  const { error: storageError } = await getSupabaseClient()
    .storage.from("garden-originals")
    .remove(paths);
  return storageError ? { storageCleanupWarning: storageError.message } : {};
}

export async function replacePlantRecord(oldPlant: Plant, newPlant: Plant): Promise<void> {
  if (newPlant.libraryPlantId) {
    const { error } = await getSupabaseClient().rpc("garden_x_replace_library_plant", {
      p_request_id: crypto.randomUUID(),
      p_old_plant_instance_id: oldPlant.id,
      p_new_plant_instance_id: newPlant.id,
      p_nickname: newPlant.name,
      p_library_plant_id: newPlant.libraryPlantId,
      p_started_on: isoDateFromDaysAgo(newPlant.plantedDaysAgo),
    });
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await getSupabaseClient().rpc("garden_x_replace_plant", {
    p_request_id: crypto.randomUUID(),
    p_old_plant_instance_id: oldPlant.id,
    p_new_plant_instance_id: newPlant.id,
    p_nickname: newPlant.name,
    p_common_name: newPlant.species,
    p_scientific_name: newPlant.scientific || null,
    p_cultivar: newPlant.variety || null,
    p_reference_key: newPlant.knowledgeId || null,
    p_started_on: isoDateFromDaysAgo(newPlant.plantedDaysAgo),
  });
  if (error) throw new Error(error.message);
}

export async function askGardenAi(
  question: string,
  conversation: Array<{ question: string; answer: string }> = [],
  attachments?: { photoDataUrl?: string; context?: string; messageImageDataUrl?: string },
) {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(`${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/garden-ai`, {
    method: "POST",
    headers: {
      apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operation: "ask_garden",
      question,
      conversation,
      ...(attachments?.photoDataUrl && attachments.context ? {
        care_review_photo_data_url: attachments.photoDataUrl,
        care_review_context: attachments.context,
      } : {}),
      ...(attachments?.messageImageDataUrl ? { message_image_data_url: attachments.messageImageDataUrl } : {}),
      request_key: `ask:${crypto.randomUUID()}`,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    answer?: {
      answer_type: string;
      answer: string;
      confirmed_facts: Array<{ source: { kind: string; id: string }; claim: string }>;
      suggested_next_actions: string[];
    };
    error?: string;
  } | null;
  if (!response.ok || !body?.answer) throw new Error(body?.error ?? "Garden AI could not answer.");
  return body.answer;
}

export interface AiCheckProposal {
  status?: "complete" | "insufficient_evidence";
  headline: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  evidence_used?: Array<{ kind: "photo" | "event" | "control"; id: string }>;
  overall_visible_state?: "appears_stable" | "watch" | "possible_issue" | "insufficient_evidence" | null;
  possible_harvest_readiness?: "not_assessed" | "possible_not_yet" | "possible_evaluate" | "possible_ready" | "possible_not_applicable" | "insufficient_evidence" | null;
  possible_incident?: "no_visible_signs" | "possible" | "insufficient_evidence" | null;
  observations: string[];
  interpretations: string[];
  uncertainty: string[];
  questions?: string[];
  suggested_next_actions?: Array<{
    kind: "none" | "monitor" | "create_follow_up" | "record_incident" | "confirm_plant_count" | "evaluate_harvest_readiness";
    rationale: string;
  }>;
  development_recommendations: Array<{
    kind: string;
    recommendation: string;
    rationale: string;
    confidence: "low" | "medium" | "high";
  }>;
}

export async function loadMeaningfulChangeResults(): Promise<MeaningfulChangeResult[]> {
  const { data, error } = await getSupabaseClient().rpc("garden_get_meaningful_change_results");
  // B1 remains safe while the additive production migration is pending: Home
  // simply has no derived comparisons to display yet.
  if (error || !Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const normalized = normalizeMeaningfulChangeResult(
      typeof row === "object" && row !== null
        ? {
            ...(row as Record<string, unknown>),
            ...(typeof (row as Record<string, unknown>).proposal === "object" && (row as Record<string, unknown>).proposal !== null
              ? (row as Record<string, unknown>).proposal as Record<string, unknown>
              : {}),
          }
        : row,
    );
    return normalized ? [{ ...normalized, id: typeof (row as Record<string, unknown>)?.id === "string" ? (row as Record<string, unknown>).id as string : undefined, createdAt: typeof (row as Record<string, unknown>)?.created_at === "string" ? (row as Record<string, unknown>).created_at as string : normalized.createdAt }] : [];
  });
}

export async function loadGardenSummaryResults(): Promise<GardenSummaryResult[]> {
  const { data, error } = await getSupabaseClient().rpc("garden_get_garden_summary_results");
  if (error || !Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const normalized = normalizeGardenSummaryResult(row);
    return normalized ? [normalized] : [];
  });
}

export async function loadGardenSummaryContext(scopeType: GardenSummaryScope, gardenId: string | null): Promise<GardenSummaryContextFingerprint | null> {
  const { data, error } = await getSupabaseClient().rpc("garden_get_garden_summary_context", {
    p_scope_type: scopeType,
    p_garden_id: gardenId,
  });
  if (error || !data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if ((row.scope_type !== "global" && row.scope_type !== "garden") || (row.scope_type === "garden" && typeof row.scope_id !== "string") || typeof row.material_fingerprint !== "string") return null;
  return { scopeType: row.scope_type, scopeId: row.scope_type === "garden" ? row.scope_id as string : null, materialFingerprint: row.material_fingerprint };
}

export async function requestGardenSummary(scopeType: GardenSummaryScope, gardenId: string | null, materialFingerprint: string, language: "en" | "es" = "es") {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(`${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/garden-ai`, {
    method: "POST",
    headers: {
      apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operation: "garden_summary",
      scope_type: scopeType,
      garden_id: gardenId,
      material_fingerprint: materialFingerprint,
      language,
      request_key: gardenSummaryRequestKey(scopeType, gardenId, materialFingerprint, language, GARDEN_SUMMARY_SCHEMA_VERSION),
    }),
  });
  const body = (await response.json().catch(() => null)) as { proposal?: unknown; request_id?: string; error?: string } | null;
  if (!response.ok || !body?.proposal) throw new Error(body?.error ?? "Garden AI could not prepare this summary.");
  const proposal = normalizeGardenSummaryResult(body.proposal);
  if (!proposal) throw new Error("Garden AI returned an invalid Garden Summary.");
  return { proposal: { ...proposal, language }, requestId: body.request_id ?? "" };
}

export async function requestMeaningfulChange(
  growCycleId: string,
  beforePhotoId: string,
  afterPhotoId: string,
  language: "en" | "es" = "es",
) {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(`${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/garden-ai`, {
    method: "POST",
    headers: {
      apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operation: "meaningful_change",
      grow_cycle_id: growCycleId,
      before_photo_id: beforePhotoId,
      after_photo_id: afterPhotoId,
      language,
      request_key: meaningfulChangeRequestKey(growCycleId, beforePhotoId, afterPhotoId, language),
    }),
  });
  const body = (await response.json().catch(() => null)) as { proposal?: unknown; request_id?: string; error?: string } | null;
  if (!response.ok || !body?.proposal) throw new Error(body?.error ?? "Garden AI could not compare these photos.");
  const proposal = normalizeMeaningfulChangeResult(body.proposal);
  if (!proposal) throw new Error("Garden AI returned an invalid comparison.");
  return { proposal, requestId: body.request_id ?? "" };
}

export async function runAiCheck(growCycleId: string, photoId: string, comparePhotoId?: string, language: "en" | "es" = "es") {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(`${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/garden-ai`, {
    method: "POST",
    headers: {
      apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operation: "ai_check",
      grow_cycle_id: growCycleId,
      photo_id: photoId,
      compare_photo_id: comparePhotoId ?? null,
      language,
      request_key: `check:${crypto.randomUUID()}`,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    proposal?: AiCheckProposal;
    request_id?: string;
    error?: string;
  } | null;
  if (!response.ok || !body?.proposal)
    throw new Error(body?.error ?? "Garden AI could not analyse this photo.");
  return { proposal: body.proposal, requestId: body.request_id ?? "" };
}

export async function runAiCheckDraft(
  growCycleId: string | null,
  draftImageDataUrl: string,
  language: "en" | "es" = "es",
) {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(`${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/garden-ai`, {
    method: "POST",
    headers: {
      apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operation: "ai_check_draft",
      ...(growCycleId ? { grow_cycle_id: growCycleId } : { context_mode: "photo_only" }),
      draft_image_data_url: draftImageDataUrl,
      language,
      request_key: `check-draft:${crypto.randomUUID()}`,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    proposal?: AiCheckProposal;
    request_id?: string;
    error?: string;
  } | null;
  if (!response.ok || !body?.proposal)
    throw new Error(body?.error ?? "Garden AI could not analyse this photo.");
  return { proposal: body.proposal, requestId: body.request_id ?? "" };
}

export async function saveFilmRecord(
  film: Omit<Film, "id" | "createdDaysAgo"> & { id: string },
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_save_film", {
    p_request_id: crypto.randomUUID(),
    p_film_id: film.id,
    p_plant_instance_id: film.plantId,
    p_title: film.title,
    p_photo_ids: film.photoIds,
    p_music: film.music,
  });
  if (error) throw new Error(error.message);
}

async function hashShareToken(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createPublicPlantStory(
  plant: Plant,
  selection: Array<{ event_id?: string; photo_id?: string; include_note?: boolean }>,
  config: { heroPhotoId?: string | null; captionOverrides?: Record<string, string> } = {},
): Promise<string> {
  if (!plant.backendGrowCycleId) throw new Error("Plant history is not connected.");
  const token = crypto.randomUUID().toLowerCase();
  const { error } = await getSupabaseClient().rpc("garden_create_guest_plant_story_v2", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: plant.backendGrowCycleId,
    p_token_hash: await hashShareToken(token),
    p_item_selection: selection,
    p_hero_photo_id: config.heroPhotoId ?? null,
    p_caption_overrides: config.captionOverrides ?? {},
  });
  if (error) throw new Error(error.message);
  return token;
}

export async function suggestShareCaption(growCycleId: string, photoId: string, language: "en" | "es" = "es"): Promise<string | null> {
  if (!growCycleId || !photoId) return null;
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(`${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/garden-ai`, {
    method: "POST",
    headers: { apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string, Authorization: `Bearer ${session.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ operation: "share_caption", grow_cycle_id: growCycleId, photo_id: photoId, language, request_key: `share-caption:${growCycleId}:${photoId}:${language}` }),
  });
  const body = (await response.json().catch(() => null)) as { proposal?: { caption?: unknown }; error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? "Garden AI could not suggest a caption.");
  return typeof body?.proposal?.caption === "string" && body.proposal.caption.trim() ? body.proposal.caption.trim() : null;
}

export async function loadPublicPlantStory(token: string): Promise<PublicStory> {
  const response = await fetch(
    `${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/guest-plant-story`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
        Authorization: `Bearer ${import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token }),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    story?: Record<string, unknown>;
    error?: string;
  } | null;
  if (!response.ok || !body?.story) throw new Error(body?.error ?? "Story unavailable.");
  const s = body.story as {
    id: string;
    crop_name?: string;
    planted_on?: string | null;
    created_at?: string;
    hero_photo_id?: string | null;
    caption_overrides?: Record<string, unknown>;
    history?: Array<{
      id: string;
      event_type: string;
      occurred_at?: string | null;
      note?: string | null;
      photo?: { id: string; url?: string } | null;
    }>;
  };
  const plantedDaysAgo = daysAgo(s.planted_on);
  const moments: PublicStoryMoment[] = [];
  for (const item of s.history ?? []) {
    const momentDays = daysAgo(item.occurred_at);
    if (item.photo?.url) {
      moments.push({
        id: `photo:${item.photo.id}`,
        daysAgo: momentDays,
        kind: "photo",
        photo: {
          id: item.photo.id,
          plantId: s.id,
          src: item.photo.url,
          daysAgo: momentDays,
          caption: typeof s.caption_overrides?.[item.photo.id] === "string" ? s.caption_overrides[item.photo.id] as string : "",
          metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
        },
      });
    }
    if (item.note) {
      moments.push({
        id: `event:${item.id}`,
        daysAgo: momentDays,
        kind: "event",
        event: {
          id: item.id,
          plantId: s.id,
          daysAgo: momentDays,
          type: eventType(item.event_type, {}),
          title: item.note,
          provenance: provenance(item.event_type),
        },
      });
    }
  }
  return {
    id: token,
    heroPhotoId: typeof s.hero_photo_id === "string" ? s.hero_photo_id : null,
    captionOverrides: Object.fromEntries(Object.entries(s.caption_overrides ?? {}).filter(([, value]) => typeof value === "string")) as Record<string, string>,
    plant: {
      id: s.id,
      name: s.crop_name ?? "Plant",
      species: s.crop_name ?? "Plant",
      scientific: "",
      variety: "",
      plantedDaysAgo,
    },
    moments,
  };
}

export async function identifyPlant(imageDataUrl: string): Promise<
  Array<{
    species: string;
    scientific: string;
    variety: string;
    knowledgeId: string;
    score: number;
  }>
> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(
    `${import.meta.env["VITE_SUPABASE_URL"]}/functions/v1/garden-identify`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
        Authorization: `Bearer ${session.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ image_data_url: imageDataUrl }),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    result?: {
      candidates?: Array<{
        species?: string;
        scientific?: string;
        variety?: string;
        confidence?: number;
      }>;
    };
    error?: string;
  } | null;
  if (!response.ok || !body?.result?.candidates?.length)
    throw new Error(body?.error ?? "Identification failed.");
  return body.result.candidates.map((candidate) => ({
    species: candidate.species?.trim() || "Unknown plant",
    scientific: candidate.scientific?.trim() || "",
    variety: candidate.variety?.trim() || "",
    knowledgeId: "",
    score: Math.max(0, Math.min(1, Number(candidate.confidence ?? 0))),
  }));
}
