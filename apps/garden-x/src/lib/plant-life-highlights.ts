import type { Plant, PlantEvent } from "./garden-data";
import { normalizeLifeEvent } from "./plant-life";

export type PlantLifeHighlightKind =
  | "planted"
  | "sprouted"
  | "firstFlower"
  | "firstFruit"
  | "firstHarvest"
  | "harvestCount"
  | "lastHarvest"
  | "recovered"
  | "propagated";

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
  const sprouted = firstDate("sprouted");
  const flowered = firstDate("flowered");
  const fruited = firstDate("fruited");
  const harvests = facts.filter((fact) => fact.id === "harvested");
  const recovered = latestDate("recovered");
  const propagated = latestDate("propagated");

  if (sprouted !== undefined) candidates.push({ kind: "sprouted", daysAgo: sprouted });
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

  return candidates.slice(0, 6);
}
