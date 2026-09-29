import type { Plant, PlantEvent } from "./garden-data";
import { normalizeLifeEvent } from "./plant-life";

export type PlantLifeHighlightKind =
  | "planted"
  | "germinated"
  | "sprouted"
  | "growthObserved"
  | "firstFlower"
  | "firstFruit"
  | "firstHarvest"
  | "harvestCount"
  | "lastHarvest"
  | "recovered"
  | "propagated"
  | "moved"
  | "transplanted";

export interface PlantLifeHighlight {
  kind: PlantLifeHighlightKind;
  daysAgo?: number;
  count?: number;
}

function lifeEventId(event: PlantEvent) {
  const metadata = normalizeLifeEvent(event.lifeEvent ?? event.journalMilestone);
  if (metadata) return metadata;
  if (event.type === "germinated" || event.type === "sprouted" || event.type === "planted") {
    return event.type;
  }
  if (event.type === "flowering") return "flowered";
  if (event.type === "fruiting") return "fruited";
  if (event.type === "harvest") return "harvested";
  if (event.type === "recovery") return "recovered";
  if (event.type === "transplant") return "transplanted";
  return null;
}

function oldestFirst(events: readonly PlantEvent[]) {
  return events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const leftTime = left.event.occurredAt ? Date.parse(left.event.occurredAt) : Number.NaN;
      const rightTime = right.event.occurredAt ? Date.parse(right.event.occurredAt) : Number.NaN;
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return right.event.daysAgo - left.event.daysAgo || left.index - right.index;
    })
    .map(({ event }) => event);
}

/**
 * Selects up to six concise highlights from recorded cycle facts. This is a
 * deterministic summary, not a progression score; repeated activity stays in
 * Timeline even when it does not fit in the highlight surface.
 */
export function buildPlantLifeHighlights(
  plant: Plant,
  events: readonly PlantEvent[],
): PlantLifeHighlight[] {
  const candidates: PlantLifeHighlight[] = [];
  if (
    plant.plantedDatePrecision !== "unknown" &&
    Number.isFinite(plant.plantedDaysAgo) &&
    plant.plantedDaysAgo >= 0
  ) {
    candidates.push({ kind: "planted", daysAgo: plant.plantedDaysAgo });
  }

  const facts = oldestFirst(
    events.filter((event) => event.plantId === plant.id && event.provenance !== "inferred"),
  ).flatMap((event) => {
    const id = lifeEventId(event);
    return id ? [{ id, daysAgo: event.daysAgo }] : [];
  });

  const firstDate = (id: string) => facts.find((fact) => fact.id === id)?.daysAgo;
  const latestDate = (id: string) => [...facts].reverse().find((fact) => fact.id === id)?.daysAgo;
  const germinated = firstDate("germinated");
  const sprouted = firstDate("sprouted");
  const growthObserved = firstDate("growth_observed");
  const flowered = firstDate("flowered");
  const fruited = firstDate("fruited");
  const harvests = facts.filter((fact) => fact.id === "harvested");
  const recovered = latestDate("recovered");
  const propagated = latestDate("propagated");
  const moved = latestDate("moved");
  const transplanted = latestDate("transplanted");

  if (germinated !== undefined) candidates.push({ kind: "germinated", daysAgo: germinated });
  if (sprouted !== undefined) candidates.push({ kind: "sprouted", daysAgo: sprouted });
  if (growthObserved !== undefined) candidates.push({ kind: "growthObserved", daysAgo: growthObserved });
  if (flowered !== undefined) candidates.push({ kind: "firstFlower", daysAgo: flowered });
  if (fruited !== undefined) candidates.push({ kind: "firstFruit", daysAgo: fruited });
  if (harvests.length) {
    candidates.push({ kind: "firstHarvest", daysAgo: harvests[0]!.daysAgo });
    if (harvests.length > 1) {
      candidates.push({ kind: "harvestCount", count: harvests.length });
      candidates.push({ kind: "lastHarvest", daysAgo: harvests.at(-1)!.daysAgo });
    }
  }
  if (recovered !== undefined) candidates.push({ kind: "recovered", daysAgo: recovered });
  if (propagated !== undefined) candidates.push({ kind: "propagated", daysAgo: propagated });
  if (moved !== undefined) candidates.push({ kind: "moved", daysAgo: moved });
  if (transplanted !== undefined) candidates.push({ kind: "transplanted", daysAgo: transplanted });

  return candidates.slice(0, 6);
}

export type PlantLifeHighlightAudit = {
  eligible: Array<{ eventId: string; title: string; kind: string }>;
  selected: Array<{ eventId: string; title: string; kind: string }>;
  excluded: Array<{ eventId: string; title: string; reason: "inferred" | "unclassified" | "capacity" }>;
};

/** Read-only audit data for QA; it never changes the bounded highlight output. */
export function auditPlantLifeHighlights(
  plant: Plant,
  events: readonly PlantEvent[],
): PlantLifeHighlightAudit {
  const rows = oldestFirst(events.filter((event) => event.plantId === plant.id));
  const eligible: PlantLifeHighlightAudit["eligible"] = [];
  const excluded: PlantLifeHighlightAudit["excluded"] = [];
  for (const event of rows) {
    if (event.provenance === "inferred") {
      excluded.push({ eventId: event.id, title: event.title, reason: "inferred" });
      continue;
    }
    const kind = lifeEventId(event);
    if (!kind) {
      excluded.push({ eventId: event.id, title: event.title, reason: "unclassified" });
      continue;
    }
    eligible.push({ eventId: event.id, title: event.title, kind });
  }
  const highlights = buildPlantLifeHighlights(plant, events);
  const selectedKinds = new Set(highlights.map((highlight) =>
    highlight.kind === "firstFlower" ? "flowered" :
    highlight.kind === "firstFruit" ? "fruited" :
    highlight.kind === "firstHarvest" || highlight.kind === "harvestCount" || highlight.kind === "lastHarvest" ? "harvested" :
    highlight.kind === "growthObserved" ? "growth_observed" : highlight.kind,
  ));
  const selected = eligible.filter((event) => selectedKinds.has(event.kind));
  const selectedIds = new Set(selected.map((event) => event.eventId));
  for (const event of eligible) {
    if (!selectedIds.has(event.eventId)) {
      excluded.push({ eventId: event.eventId, title: event.title, reason: "capacity" });
    }
  }
  return { eligible, selected, excluded };
}
