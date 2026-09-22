import type { GardenState } from "./garden-data";
import { ui } from "./ui-copy";

export const GARDEN_SUMMARY_SCHEMA_VERSION = "garden_summary_v1";

export type GardenSummaryScope = "global" | "garden";

export interface GardenSummaryEvidenceCoverage {
  plantCount: number;
  gardenCount: number;
  openAttentionCount: number;
  recentEventCount: number;
  meaningfulChangeCount: number;
  aiCheckCount: number;
}

export interface GardenSummaryResult {
  id?: string;
  analysisVersion: string;
  summaryText: string;
  scopeType: GardenSummaryScope;
  scopeId: string | null;
  materialFingerprint: string;
  evidenceCoverage: GardenSummaryEvidenceCoverage;
  referencedPlantInstanceIds: string[];
  referencedMeaningfulChangeIds: string[];
  referencedAiCheckIds: string[];
  epistemicNotes: string[];
  generatedAt?: string;
  language?: "en" | "es";
}

export interface GardenSummaryContextFingerprint {
  scopeType: GardenSummaryScope;
  scopeId: string | null;
  materialFingerprint: string;
}

export function gardenSummaryRequestKey(
  scopeType: GardenSummaryScope,
  scopeId: string | null,
  materialFingerprint: string,
  language: "en" | "es",
  analysisVersion = GARDEN_SUMMARY_SCHEMA_VERSION,
) {
  return `summary:${analysisVersion}:${scopeType}:${scopeId ?? "global"}:${materialFingerprint}:${language}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Client-side mirror used for deterministic tests and offline fallback. The server RPC is authoritative for production fingerprints. */
export function buildSummaryMaterialFingerprint(
  state: GardenState,
  meaningfulChanges: Array<{
    id?: string;
    plantInstanceId: string;
    growCycleId: string;
    analysisVersion: string;
    comparisonStatus: string;
  }>,
  scopeType: GardenSummaryScope,
  scopeId: string | null,
): string {
  const gardens = state.gardens
    .filter((garden) => !garden.archived && (scopeType === "global" || garden.id === scopeId))
    .map((garden) => ({ id: garden.id, name: garden.name }));
  const gardenIds = new Set(gardens.map((garden) => garden.id));
  const plants = state.plants
    .filter((plant) => gardenIds.has(plant.gardenId))
    .map((plant) => ({
      id: plant.id,
      gardenId: plant.gardenId,
      status: plant.status,
      cycle: plant.backendGrowCycleId ?? null,
      closed: Boolean(plant.cycleClosed),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const plantIds = new Set(plants.map((plant) => plant.id));
  const events = state.events
    .filter((event) => plantIds.has(event.plantId) && event.type !== "photo")
    .map((event) => ({
      id: event.id,
      plantId: event.plantId,
      type: event.type,
      occurredAt: event.occurredAt ?? null,
      title: event.title,
      detail: event.detail ?? null,
      provenance: event.provenance,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const tasks = state.tasks
    .filter((task) => plantIds.has(task.plantId) && !task.done)
    .map((task) => ({
      id: task.id,
      plantId: task.plantId,
      type: task.type,
      dueInDays: task.dueInDays,
      label: task.label,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const changes = meaningfulChanges
    .filter((result) => plantIds.has(result.plantInstanceId))
    .map((result) => ({
      id: result.id ?? null,
      plantInstanceId: result.plantInstanceId,
      growCycleId: result.growCycleId,
      analysisVersion: result.analysisVersion,
      comparisonStatus: result.comparisonStatus,
    }))
    .sort((a, b) => `${a.id}`.localeCompare(`${b.id}`));
  const source = stableStringify({ scopeType, scopeId, gardens, plants, events, tasks, changes });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1)
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(4);
}

export function normalizeGardenSummaryResult(value: unknown): GardenSummaryResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const proposal =
    row.proposal && typeof row.proposal === "object" && !Array.isArray(row.proposal)
      ? (row.proposal as Record<string, unknown>)
      : row;
  if (
    proposal.schema_version !== undefined &&
    proposal.schema_version !== GARDEN_SUMMARY_SCHEMA_VERSION
  )
    return null;
  if (
    typeof proposal.summary_text !== "string" ||
    proposal.summary_text.trim().length === 0 ||
    proposal.summary_text.length > 700
  )
    return null;
  if (proposal.scope_type !== "global" && proposal.scope_type !== "garden") return null;
  const scopeId =
    proposal.scope_id === null || proposal.scope_id === undefined
      ? null
      : String(proposal.scope_id);
  if (proposal.scope_type === "global" && scopeId !== null) return null;
  if (proposal.scope_type === "garden" && !scopeId) return null;
  if (
    typeof proposal.material_fingerprint !== "string" ||
    !/^[a-f0-9]{32}$/i.test(proposal.material_fingerprint)
  )
    return null;
  const coverage = proposal.evidence_coverage;
  if (!coverage || typeof coverage !== "object" || Array.isArray(coverage)) return null;
  const c = coverage as Record<string, unknown>;
  const number = (key: string) =>
    typeof c[key] === "number" && Number.isInteger(c[key]) && c[key] >= 0
      ? (c[key] as number)
      : null;
  const evidenceCoverage = {
    plantCount: number("plant_count"),
    gardenCount: number("garden_count"),
    openAttentionCount: number("open_attention_count"),
    recentEventCount: number("recent_event_count"),
    meaningfulChangeCount: number("meaningful_change_count"),
    aiCheckCount: number("ai_check_count"),
  };
  if (Object.values(evidenceCoverage).some((item) => item === null)) return null;
  const strings = (input: unknown) =>
    Array.isArray(input) && input.every((item) => typeof item === "string")
      ? (input as string[])
      : null;
  const plantIds = strings(proposal.referenced_plant_instance_ids);
  const changeIds = strings(proposal.referenced_meaningful_change_ids);
  const checkIds = strings(proposal.referenced_ai_check_ids);
  const notes = strings(proposal.epistemic_notes);
  if (!plantIds || !changeIds || !checkIds || !notes) return null;
  if (
    /(?:\b(?:plant_instance_id|grow_cycle_id|storage_path|not_yet|insufficient_evidence)\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b)/i.test(
      proposal.summary_text,
    )
  )
    return null;
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    analysisVersion:
      typeof proposal.schema_version === "string"
        ? proposal.schema_version
        : GARDEN_SUMMARY_SCHEMA_VERSION,
    summaryText: proposal.summary_text,
    scopeType: proposal.scope_type,
    scopeId,
    materialFingerprint: proposal.material_fingerprint,
    evidenceCoverage: evidenceCoverage as GardenSummaryEvidenceCoverage,
    referencedPlantInstanceIds: plantIds,
    referencedMeaningfulChangeIds: changeIds,
    referencedAiCheckIds: checkIds,
    epistemicNotes: notes,
    generatedAt: typeof row.created_at === "string" ? row.created_at : undefined,
    language: row.language === "en" || row.language === "es" ? row.language : undefined,
  };
}

export function selectCurrentSummary(
  summaries: GardenSummaryResult[],
  context: GardenSummaryContextFingerprint,
  language: "en" | "es",
) {
  return (
    summaries.find(
      (summary) =>
        summary.scopeType === context.scopeType &&
        summary.scopeId === context.scopeId &&
        summary.materialFingerprint === context.materialFingerprint &&
        (!summary.language || summary.language === language),
    ) ?? null
  );
}

export function selectStaleSummary(
  summaries: GardenSummaryResult[],
  scopeType: GardenSummaryScope,
  scopeId: string | null,
  language: "en" | "es",
) {
  return (
    summaries.find(
      (summary) =>
        summary.scopeType === scopeType &&
        summary.scopeId === scopeId &&
        (!summary.language || summary.language === language),
    ) ?? null
  );
}

export function summaryUpdatedLabel(generatedAt: string | undefined, language: "en" | "es") {
  if (!generatedAt) return "";
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${ui(language, "summaryUpdated")} ${date.toLocaleDateString(language === "es" ? "es-ES" : "en-US", { month: "short", day: "numeric" })}`;
}

export type SummaryEvidenceInput = Pick<
  GardenState,
  "gardens" | "plants" | "events" | "tasks" | "photos"
>;
