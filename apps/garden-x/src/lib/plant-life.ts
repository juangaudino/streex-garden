import type {
  LifeEventId,
  MomentLifeEvent,
  Plant,
  PlantEvent,
  PlantOriginType,
} from "./garden-data";
import type { GardenpediaLifeCapabilities } from "./garden-library";

export type { LifeEventId, PlantOriginType } from "./garden-data";

export type { MomentLifeEvent } from "./garden-data";

export const PLANT_ORIGINS: readonly PlantOriginType[] = [
  "unknown",
  "seed",
  "bare_root",
  "cutting",
  "seedling",
  "transplant",
];

/** Repeatability is guidance for recording, never a database uniqueness rule. */
export const LIFE_EVENT_DEFINITIONS: readonly {
  id: LifeEventId;
  repeatable: boolean;
  recordedBy: "moment" | "cycle_start" | "cycle_move" | "cycle_close";
}[] = [
  { id: "planted", repeatable: false, recordedBy: "cycle_start" },
  { id: "germinated", repeatable: false, recordedBy: "moment" },
  { id: "sprouted", repeatable: false, recordedBy: "moment" },
  { id: "growth_observed", repeatable: true, recordedBy: "moment" },
  { id: "flowered", repeatable: true, recordedBy: "moment" },
  { id: "fruited", repeatable: true, recordedBy: "moment" },
  { id: "harvested", repeatable: true, recordedBy: "moment" },
  { id: "regrowth", repeatable: true, recordedBy: "moment" },
  { id: "propagated", repeatable: true, recordedBy: "moment" },
  { id: "ended", repeatable: false, recordedBy: "cycle_close" },
  { id: "moved", repeatable: true, recordedBy: "cycle_move" },
  { id: "transplanted", repeatable: true, recordedBy: "moment" },
  { id: "damaged", repeatable: true, recordedBy: "moment" },
  { id: "recovered", repeatable: true, recordedBy: "moment" },
];

export const MOMENT_LIFE_EVENTS: readonly MomentLifeEvent[] = [
  "germinated",
  "sprouted",
  "growth_observed",
  "flowered",
  "fruited",
  "harvested",
  "regrowth",
  "propagated",
  "transplanted",
  "damaged",
  "recovered",
];

const storedAliases: Record<string, LifeEventId> = {
  germinated: "germinated",
  sprouted: "sprouted",
  growth_observed: "growth_observed",
  flowered: "flowered",
  flowering: "flowered", // F1 stored this identifier; old rows remain unchanged.
  fruited: "fruited",
  fruiting: "fruited", // F1 stored this identifier; old rows remain unchanged.
  harvested: "harvested",
  harvest: "harvested", // F1 stored this identifier; old rows remain unchanged.
  regrowth: "regrowth",
  propagated: "propagated",
  planted: "planted",
  ended: "ended",
  moved: "moved",
  transplanted: "transplanted",
  damaged: "damaged",
  recovered: "recovered",
};

export function normalizeLifeEvent(value: unknown): LifeEventId | null {
  if (typeof value !== "string") return null;
  return storedAliases[value] ?? null;
}

export function lifeEventIsRepeatable(value: LifeEventId): boolean {
  return LIFE_EVENT_DEFINITIONS.find((definition) => definition.id === value)?.repeatable ?? false;
}

export function originType(value: unknown): PlantOriginType {
  return typeof value === "string" && PLANT_ORIGINS.includes(value as PlantOriginType)
    ? (value as PlantOriginType)
    : "unknown";
}

/** Reuses the canonical Life Model projection for exports and other read-only views. */
export function lifeEventForPlantEvent(event: PlantEvent): LifeEventId | null {
  const fromMetadata = normalizeLifeEvent(event.lifeEvent ?? event.journalMilestone);
  if (fromMetadata) return fromMetadata;
  if (event.type === "germinated" || event.type === "sprouted") return event.type;
  if (event.type === "flowering") return "flowered";
  if (event.type === "fruiting") return "fruited";
  if (event.type === "harvest") return "harvested";
  if (event.type === "planted") return "planted";
  if (event.type === "problem") return "damaged";
  if (event.type === "recovery") return "recovered";
  return null;
}

/** Return a short, non-binding set. Capability knowledge only informs priorities. */
export function contextualLifeEventSuggestions(input: {
  plant: Plant;
  history: readonly PlantEvent[];
  capabilities?: GardenpediaLifeCapabilities | undefined;
}): MomentLifeEvent[] {
  const { plant, history, capabilities } = input;
  const plantHistory = history
    .filter((event) => event.plantId === plant.id)
    .sort((left, right) => right.daysAgo - left.daysAgo);
  const legacyHistoryIds = plantHistory
    .map(lifeEventForPlantEvent)
    .filter((value): value is LifeEventId => Boolean(value));
  const historyIds = [...plantHistory]
    .reverse()
    .map(lifeEventForPlantEvent)
    .filter((value): value is LifeEventId => Boolean(value));
  const seen = new Set(historyIds);
  const hasKnownCapability = Object.values(capabilities ?? {}).some(
    (item) => item?.status === "known",
  );
  const capabilityIsTrue = (key: keyof GardenpediaLifeCapabilities) => {
    const capability = capabilities?.[key];
    return capability?.status === "known" && capability.value;
  };

  const suggestions: MomentLifeEvent[] = ["growth_observed"];
  if (originType(plant.originType) === "seed") {
    if (!seen.has("germinated")) suggestions.push("germinated");
    else if (!seen.has("sprouted")) suggestions.push("sprouted");
  }

  if (hasKnownCapability) {
    const lifecycleEvents = new Set<LifeEventId>([
      "germinated",
      "sprouted",
      "growth_observed",
      "flowered",
      "fruited",
      "harvested",
      "regrowth",
      "propagated",
    ]);
    const latestLifecycleEvent = historyIds.find((value) => lifecycleEvents.has(value));
    const established = historyIds.some((value) =>
      ["growth_observed", "flowered", "fruited", "harvested", "regrowth"].includes(value),
    );

    if (latestLifecycleEvent === "flowered" && capabilityIsTrue("can_fruit")) {
      suggestions.push("fruited");
    } else if (latestLifecycleEvent === "fruited" && capabilityIsTrue("harvestable_fruit")) {
      suggestions.push("harvested");
    } else if (
      latestLifecycleEvent === "harvested" &&
      capabilityIsTrue("can_regrow_after_harvest")
    ) {
      suggestions.push("regrowth");
    } else if (capabilityIsTrue("harvestable_leaf") && (established || seen.has("harvested"))) {
      suggestions.push("harvested");
    } else if (latestLifecycleEvent === "harvested" && capabilityIsTrue("harvestable_fruit")) {
      suggestions.push("harvested");
    } else if (
      established &&
      latestLifecycleEvent !== "flowered" &&
      latestLifecycleEvent !== "fruited" &&
      capabilityIsTrue("can_flower") &&
      !capabilityIsTrue("harvestable_leaf")
    ) {
      suggestions.push("flowered");
    } else if (established && capabilityIsTrue("can_propagate")) {
      suggestions.push("propagated");
    }
  } else {
    // Preserve the F1B origin/history-only behavior for older and unresolved identities.
    if (seen.has("harvested")) suggestions.push("harvested");
  }

  // A prior occurrence remains a useful, repeatable fact; suggestions are never gates.
  const repeatableHistory = hasKnownCapability ? historyIds : legacyHistoryIds;
  const lastRepeatable = repeatableHistory.find((value) => value && lifeEventIsRepeatable(value));
  if (lastRepeatable && MOMENT_LIFE_EVENTS.includes(lastRepeatable as MomentLifeEvent)) {
    suggestions.push(lastRepeatable as MomentLifeEvent);
  }
  return [...new Set(suggestions)].slice(0, 3);
}

export function otherMomentLifeEvents(suggestions: readonly MomentLifeEvent[]) {
  return MOMENT_LIFE_EVENTS.filter((event) => !suggestions.includes(event));
}
