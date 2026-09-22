import type { Photo, Plant, PlantEvent, PlantStatus } from "./garden-data";
import { photoEvidenceKey } from "./garden-logic";

export type MeaningfulChangeStatus =
  | "meaningful_change"
  | "no_meaningful_change"
  | "limited_comparability";

export const MEANINGFUL_CHANGE_SCHEMA_VERSION = "garden_meaningful_change_v1";
export const MEANINGFUL_CHANGE_MIN_GAP_DAYS = 3;

export function meaningfulChangeRequestKey(
  growCycleId: string,
  beforePhotoId: string,
  afterPhotoId: string,
  language: "en" | "es",
  analysisVersion = MEANINGFUL_CHANGE_SCHEMA_VERSION,
) {
  return `meaningful:${analysisVersion}:${growCycleId}:${beforePhotoId}:${afterPhotoId}:${language}`;
}

export function shouldGenerateMeaningfulChange(event: Pick<PlantEvent, "photoId">) {
  return Boolean(event.photoId);
}

export interface MeaningfulChangeContextFact {
  kind: "event" | "observation" | "care" | "follow_up" | "ai_check" | "status";
  text: string;
  provenance: "recorded" | "observed" | "inferred";
}

export interface MeaningfulChangeCandidate {
  plantInstanceId: string;
  growCycleId: string;
  beforePhotoId: string;
  afterPhotoId: string;
  before: Photo;
  after: Photo;
  elapsedDays: number;
  contextFacts: MeaningfulChangeContextFact[];
}

export interface MeaningfulChangeResult {
  id?: string;
  analysisVersion: string;
  comparisonStatus: MeaningfulChangeStatus;
  primaryVisualObservation: string;
  supportingVisualObservations: string[];
  comparabilityNotes: string[];
  interpretation?: string | null;
  interpretationConfidence?: "low" | "medium" | "high" | null;
  relevantContextFacts: string[];
  beforePhotoId: string;
  afterPhotoId: string;
  growCycleId: string;
  plantInstanceId: string;
  createdAt?: string;
  language?: "en" | "es";
}

function photoTime(photo: Photo): number | null {
  const captured = photo.capturedAt ? Date.parse(photo.capturedAt) : Number.NaN;
  if (!Number.isNaN(captured)) return captured;
  return Date.now() - photo.daysAgo * 86_400_000;
}

function eventTime(event: PlantEvent): number {
  const occurred = event.occurredAt ? Date.parse(event.occurredAt) : Number.NaN;
  return Number.isNaN(occurred) ? Date.now() - event.daysAgo * 86_400_000 : occurred;
}

function isBetween(value: number, start: number, end: number) {
  return value > start && value <= end;
}

export function contextFactsBetween(
  before: Photo,
  after: Photo,
  events: PlantEvent[],
): MeaningfulChangeContextFact[] {
  const beforeTime = photoTime(before);
  const afterTime = photoTime(after);
  if (beforeTime === null || afterTime === null || afterTime <= beforeTime) return [];
  return events
    .filter((event) => event.plantId === after.plantId && isBetween(eventTime(event), beforeTime, afterTime))
    .sort((a, b) => eventTime(a) - eventTime(b))
    .slice(0, 8)
    .map((event) => ({
      kind: event.type === "maintenance" || event.type === "pruning" || event.type === "thinning" || event.type === "harvest" ? "care" : "event",
      text: event.detail?.trim() || event.title,
      provenance: event.provenance === "inferred" ? "inferred" : "recorded",
    }));
}

/**
 * Selects one conservative, deterministic pair. A short interval is only
 * useful when a recorded context fact exists; otherwise three days is the
 * minimum separation used by the product today.
 */
export function selectMeaningfulChangeCandidate(
  plant: Pick<Plant, "id" | "backendGrowCycleId" | "status" | "statusNote">,
  photos: Photo[],
  events: PlantEvent[],
  existingResults: MeaningfulChangeResult[] = [],
  language?: "en" | "es",
): MeaningfulChangeCandidate | null {
  if (!plant.backendGrowCycleId) return null;
  const distinct = photos
    .filter((photo) => photo.plantId === plant.id && photo.backendGrowCycleId === plant.backendGrowCycleId && Boolean(photo.backendStoragePath))
    .sort((a, b) => (photoTime(a) ?? 0) - (photoTime(b) ?? 0))
    .filter((photo, index, all) => all.findIndex((candidate) => photoEvidenceKey(candidate) === photoEvidenceKey(photo)) === index);
  if (distinct.length < 2) return null;

  for (let index = distinct.length - 1; index > 0; index -= 1) {
    const before = distinct[index - 1]!;
    const after = distinct[index]!;
    const beforeTime = photoTime(before);
    const afterTime = photoTime(after);
    if (beforeTime === null || afterTime === null || afterTime <= beforeTime) continue;
    const elapsedDays = (afterTime - beforeTime) / 86_400_000;
    const contextFacts = contextFactsBetween(before, after, events);
    const statusChanged = plant.status !== "steady" || Boolean(plant.statusNote.trim());
    if (elapsedDays < MEANINGFUL_CHANGE_MIN_GAP_DAYS && contextFacts.length === 0 && !statusChanged) continue;
    const alreadyExists = existingResults.some(
      (result) =>
        result.plantInstanceId === plant.id &&
        result.growCycleId === plant.backendGrowCycleId &&
        result.beforePhotoId === before.id &&
        result.afterPhotoId === after.id &&
        result.analysisVersion === MEANINGFUL_CHANGE_SCHEMA_VERSION &&
        (!language || !result.language || result.language === language),
    );
    if (alreadyExists) return null;
    if (elapsedDays >= MEANINGFUL_CHANGE_MIN_GAP_DAYS || contextFacts.length > 0 || statusChanged) {
      return {
        plantInstanceId: plant.id,
        growCycleId: plant.backendGrowCycleId,
        beforePhotoId: before.id,
        afterPhotoId: after.id,
        before,
        after,
        elapsedDays,
        contextFacts,
      };
    }
  }
  return null;
}

export function rankMeaningfulChanges(
  results: MeaningfulChangeResult[],
  plants: Array<Pick<Plant, "id" | "status">>,
): MeaningfulChangeResult[] {
  const statusRank: Record<MeaningfulChangeStatus, number> = {
    meaningful_change: 0,
    limited_comparability: 1,
    no_meaningful_change: 2,
  };
  const plantStatus = new Map(plants.map((plant) => [plant.id, plant.status]));
  const attentionRank = (status: PlantStatus | undefined) => (status === "watching" || status === "recovering" ? 0 : 1);
  return [...results]
    .filter((result) => plantStatus.has(result.plantInstanceId))
    .sort((a, b) => {
      const statusDelta = statusRank[a.comparisonStatus] - statusRank[b.comparisonStatus];
      if (statusDelta) return statusDelta;
      const attentionDelta = attentionRank(plantStatus.get(a.plantInstanceId)) - attentionRank(plantStatus.get(b.plantInstanceId));
      if (attentionDelta) return attentionDelta;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
}

export function normalizeMeaningfulChangeResult(value: unknown): MeaningfulChangeResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.schema_version !== undefined && row.schema_version !== MEANINGFUL_CHANGE_SCHEMA_VERSION) return null;
  const status = row.comparison_status;
  if (!['meaningful_change', 'no_meaningful_change', 'limited_comparability'].includes(String(status))) return null;
  const strings = (input: unknown) => Array.isArray(input) && input.every((item) => typeof item === "string") ? input as string[] : null;
  const supporting = strings(row.supporting_visual_observations);
  const notes = strings(row.comparability_notes);
  const facts = strings(row.relevant_context_facts);
  if (typeof row.primary_visual_observation !== "string" || !supporting || !notes || !facts) return null;
  if (typeof row.before_photo_id !== "string" || typeof row.after_photo_id !== "string" || typeof row.grow_cycle_id !== "string" || typeof row.plant_instance_id !== "string") return null;
  if (row.before_photo_id === row.after_photo_id) return null;
  if ([row.primary_visual_observation, ...supporting, ...notes, ...facts, row.interpretation].some((item) => typeof item === "string" && /\b\d+(?:\.\d+)?\s*(?:cm|mm|in(?:ches)?|%|percent)\b/i.test(item))) return null;
  return {
    analysisVersion: typeof row.schema_version === "string" ? row.schema_version : MEANINGFUL_CHANGE_SCHEMA_VERSION,
    comparisonStatus: status as MeaningfulChangeStatus,
    primaryVisualObservation: row.primary_visual_observation,
    supportingVisualObservations: supporting,
    comparabilityNotes: notes,
    interpretation: typeof row.interpretation === "string" ? row.interpretation : null,
    interpretationConfidence: ['low', 'medium', 'high'].includes(String(row.interpretation_confidence)) ? row.interpretation_confidence as "low" | "medium" | "high" : null,
    relevantContextFacts: facts,
    beforePhotoId: row.before_photo_id,
    afterPhotoId: row.after_photo_id,
    growCycleId: row.grow_cycle_id,
    plantInstanceId: row.plant_instance_id,
    ...(typeof row.created_at === "string" ? { createdAt: row.created_at } : {}),
    ...(row.language === "en" || row.language === "es" ? { language: row.language } : {}),
  };
}
