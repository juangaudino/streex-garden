import type { Photo, Plant, PlantEvent } from "./garden-data";
import { ui } from "./ui-copy";

const dayMs = 86_400_000;
const compareIds = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
export const HOME_HIGHLIGHT_LOOKBACK_DAYS = 14;
export const HOME_MEANINGFUL_CHANGE_MIN_GAP_DAYS = 3;
export const HOME_MEANINGFUL_CHANGE_LIMIT = 3;
export const HOME_RECENT_ACTIVITY_LIMIT = 4;

const operationalEventTypes = new Set<PlantEvent["type"]>([
  "maintenance",
  "pruning",
  "thinning",
  "ai",
]);
const careOnlyBackendTypes = new Set([
  "system_maintenance",
  "visual_review",
  "development_review",
  "plant_count_observed",
]);

function parsedTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (dateParts) {
    const year = Number(dateParts[1]);
    const month = Number(dateParts[2]);
    const day = Number(dateParts[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    )
      return null;
    if (value.length === 10) return new Date(year, month - 1, day, 12).getTime();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dayOrdinal(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / dayMs;
}

function timestampForPhoto(photo: Photo, eventById: Map<string, PlantEvent>): number | null {
  return (
    parsedTimestamp(photo.capturedAt) ??
    (photo.backendEventId ? parsedTimestamp(eventById.get(photo.backendEventId)?.occurredAt) : null)
  );
}

function isOperationalSignal(event: PlantEvent): boolean {
  return (
    operationalEventTypes.has(event.type) ||
    careOnlyBackendTypes.has(event.backendEventType ?? "") ||
    event.title.startsWith("Follow-up set:")
  );
}

/** Only owner-recorded/observed plant facts can influence this Home preference. */
function isMeaningfulPlantEvent(event: PlantEvent): boolean {
  if (event.provenance === "inferred" || isOperationalSignal(event)) return false;
  if (event.lifeEvent) return true;
  return (event.type === "note" || event.type === "photo") && Boolean(event.detail?.trim());
}

/** Home's journal activity omits Care operations while keeping separate facts separate. */
export function isHomeJournalActivity(event: PlantEvent): boolean {
  return event.provenance !== "inferred" && !isOperationalSignal(event);
}

/** Home keeps one row for each canonical event, even when one Moment has several parts. */
export function projectHomeRecentActivity(events: PlantEvent[]): PlantEvent[] {
  return events.filter(isHomeJournalActivity).sort((a, b) => a.daysAgo - b.daysAgo);
}

/**
 * Selects recent factual evidence first, then rotates deterministically through
 * active plant IDs by local calendar day when the journal has no recent signal.
 */
export function selectHomeHighlightedPlant(
  plants: Plant[],
  events: PlantEvent[],
  photos: Photo[],
  now = new Date(),
): Plant | undefined {
  const active = plants.filter((plant) => !plant.cycleClosed);
  if (!active.length) return undefined;
  const activeById = new Map(active.map((plant) => [plant.id, plant]));
  const newestEvidence = new Map<string, number>();
  const record = (plantId: string, timestamp: number | null) => {
    if (!activeById.has(plantId) || timestamp === null) return;
    const elapsedDays = dayOrdinal(now.getTime()) - dayOrdinal(timestamp);
    if (elapsedDays < 0 || elapsedDays > HOME_HIGHLIGHT_LOOKBACK_DAYS) return;
    newestEvidence.set(plantId, Math.max(newestEvidence.get(plantId) ?? -Infinity, timestamp));
  };

  for (const event of events) {
    if (event.plantId && isMeaningfulPlantEvent(event)) {
      record(event.plantId, parsedTimestamp(event.occurredAt));
    }
  }
  const eventById = new Map(events.map((event) => [event.id, event]));
  for (const photo of photos) {
    const plant = activeById.get(photo.plantId);
    if (
      plant?.backendGrowCycleId &&
      photo.backendGrowCycleId === plant.backendGrowCycleId &&
      photo.mediaScope === "cycle_evidence" &&
      photo.backendStoragePath &&
      photo.provenance !== "inferred"
    ) {
      record(photo.plantId, timestampForPhoto(photo, eventById));
    }
  }

  const recent = [...newestEvidence.entries()].sort(
    ([idA, timeA], [idB, timeB]) => timeB - timeA || compareIds(idA, idB),
  );
  if (recent[0]) return activeById.get(recent[0][0]);

  const stableActive = [...active].sort((a, b) => compareIds(a.id, b.id));
  const localDay = dayOrdinal(now.getTime());
  return stableActive[localDay % stableActive.length];
}

export interface HomeMeaningfulChangePair {
  plant: Plant;
  before: Photo;
  after: Photo;
  beforeTimestamp: number;
  elapsedDays: number;
  afterTimestamp: number;
}

/**
 * Selects one recent, same-cycle photo pair per plant. This establishes that
 * two dated visual records exist; it makes no claim about what changed biologically.
 */
export function selectHomeMeaningfulChangePairs(
  plants: Plant[],
  photos: Photo[],
  events: PlantEvent[],
): HomeMeaningfulChangePair[] {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const pairs = plants.flatMap((plant) => {
    const growCycleId = plant.backendGrowCycleId;
    if (!growCycleId || plant.cycleClosed) return [];
    const byPath = new Map<string, { photo: Photo; timestamp: number }>();
    for (const photo of photos) {
      if (
        photo.plantId !== plant.id ||
        photo.backendGrowCycleId !== growCycleId ||
        photo.mediaScope !== "cycle_evidence" ||
        !photo.backendStoragePath ||
        photo.provenance === "inferred"
      )
        continue;
      const timestamp = timestampForPhoto(photo, eventById);
      if (timestamp === null) continue;
      const existing = byPath.get(photo.backendStoragePath);
      if (
        !existing ||
        timestamp < existing.timestamp ||
        (timestamp === existing.timestamp && compareIds(photo.id, existing.photo.id) < 0)
      ) {
        byPath.set(photo.backendStoragePath, { photo, timestamp });
      }
    }
    const dated = [...byPath.values()].sort(
      (a, b) => a.timestamp - b.timestamp || compareIds(a.photo.id, b.photo.id),
    );
    const after = dated.at(-1);
    if (!after) return [];
    const afterDay = dayOrdinal(after.timestamp);
    const before = [...dated]
      .reverse()
      .find(
        (candidate) =>
          candidate.timestamp < after.timestamp &&
          afterDay - dayOrdinal(candidate.timestamp) >= HOME_MEANINGFUL_CHANGE_MIN_GAP_DAYS,
      );
    if (!before) return [];
    const elapsedDays = afterDay - dayOrdinal(before.timestamp);
    return [
      {
        plant,
        before: before.photo,
        after: after.photo,
        beforeTimestamp: before.timestamp,
        elapsedDays,
        afterTimestamp: after.timestamp,
      },
    ];
  });

  return pairs.sort(
    (a, b) =>
      b.afterTimestamp - a.afterTimestamp ||
      b.elapsedDays - a.elapsedDays ||
      compareIds(a.plant.id, b.plant.id),
  );
}

export function projectHomeMeaningfulChanges(
  plants: Plant[],
  photos: Photo[],
  events: PlantEvent[],
) {
  return selectHomeMeaningfulChangePairs(plants, photos, events).slice(
    0,
    HOME_MEANINGFUL_CHANGE_LIMIT,
  );
}

export function homePlantGardenCountCopy(
  language: "en" | "es",
  plantCount: number,
  gardenCount: number,
) {
  const plantLabel = (
    plantCount === 1 ? ui(language, "plant") : ui(language, "plants")
  ).toLocaleLowerCase(language);
  const gardenLabel =
    gardenCount === 1
      ? ui(language, "garden")
      : ui(language, "gardens").toLocaleLowerCase(language);
  return `${plantCount} ${plantLabel} ${ui(language, "homeCountsAcross")} ${gardenCount} ${gardenLabel}`;
}

export function formatHomeEvidenceDate(timestamp: number, language: "en" | "es"): string {
  return new Date(timestamp).toLocaleDateString(language === "es" ? "es-ES" : "en-US", {
    month: "short",
    day: "numeric",
    year: new Date(timestamp).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
