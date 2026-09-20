import type { Garden, Plant } from "./garden-data";

export type LibraryGuidanceProfile = {
  climate: string;
  height: number;
  spread: number;
  nutrient: number;
  root: number;
  traits: readonly string[];
};

export type GardenLibraryReference = {
  germination: string | null;
  light: string | null;
  temperature: string | null;
  ph: string | null;
  ec: string | null;
  spacing: string | null;
  pruning: string | null;
  harvest: string | null;
  expectedCycle: string | null;
  commonProblems: readonly string[];
  recommendations: readonly string[];
  goodNeighborIds: readonly string[];
  betterSeparateIds: readonly string[];
  sourceIds: readonly string[];
  sources: readonly { id: string; title: string; publisher: string; url: string }[];
};

export type GardenLibraryEntry = {
  libraryPlantId: string;
  commonName: string;
  spanishName?: string | null;
  scientificName: string | null;
  cultivar: string | null;
  aliases: readonly string[];
  category: string;
  status: "active" | "retired";
  provenance: readonly string[];
  guidanceProfile: LibraryGuidanceProfile | null;
  reference: GardenLibraryReference;
};

export function localizedLibraryName(entry: GardenLibraryEntry, language: "en" | "es") {
  return language === "es" ? entry.spanishName || entry.commonName : entry.commonName;
}

export type GardenLibraryManifest = {
  schemaVersion: number;
  catalogVersion: string;
  generatedAt: string;
  entries: readonly GardenLibraryEntry[];
  neighborRules: {
    researchPairs: ReadonlyArray<{ a: string; b: string; sourceId: string; label: string }>;
    beneficialRoles: Record<string, { role: string; sourceId: string }>;
  };
};

export type PlantingGuidance = {
  kind: "evidence-backed fit" | "consideration" | "insufficient evidence";
  message: string;
  neighborPlantId?: string;
  sourceId?: string;
};

export type PlantingContext = {
  positionId: string;
  neighbors: Array<{ plant: Plant; positionId: string }>;
};

let catalogPromise: Promise<GardenLibraryManifest> | undefined;

export function loadGardenLibraryCatalog(force = false) {
  if (!catalogPromise || force) {
    catalogPromise = fetch("/api/garden-library/catalog", {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Garden Library is unavailable. Please try again.");
        return response.json() as Promise<GardenLibraryManifest>;
      })
      .then((catalog) => {
        if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries))
          throw new Error("Garden Library returned an invalid catalog.");
        return catalog;
      });
  }
  return catalogPromise;
}

export function searchGardenLibrary(catalog: GardenLibraryManifest, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  const active = catalog.entries.filter((entry) => entry.status === "active");
  if (!needle) return active;
  return active.filter((entry) =>
    [entry.commonName, entry.scientificName, entry.cultivar, ...entry.aliases]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(needle)),
  );
}

type PhysicalPosition = NonNullable<Garden["backendPositions"]>[number];

function coordinates(position: PhysicalPosition) {
  const row = position.rowNumber ?? position.gridY;
  const column = position.columnNumber ?? position.gridX;
  if (row === undefined || column === undefined) return null;
  return { level: position.levelNumber ?? 1, row, column };
}

/** Orthogonal adjacency only: same level, one physical grid step away. */
export function physicalNeighbors(garden: Garden, positionId: string) {
  const positions = garden.backendPositions ?? [];
  const current = positions.find((position) => position.id === positionId);
  const currentCoordinates = current ? coordinates(current) : null;
  if (!currentCoordinates) return [];
  return positions.filter((position) => {
    if (position.id === positionId || position.active === false) return false;
    const candidate = coordinates(position);
    return Boolean(
      candidate &&
      candidate.level === currentCoordinates.level &&
      Math.abs(candidate.row - currentCoordinates.row) +
        Math.abs(candidate.column - currentCoordinates.column) ===
        1,
    );
  });
}

export function resolvePlantingContext(
  garden: Garden,
  positionId: string,
  plants: Plant[],
): PlantingContext {
  const byPosition = new Map(
    plants
      .filter((plant) => plant.gardenId === garden.id && plant.backendPositionId)
      .map((plant) => [plant.backendPositionId!, plant]),
  );
  return {
    positionId,
    neighbors: physicalNeighbors(garden, positionId)
      .map((position) => ({ positionId: position.id, plant: byPosition.get(position.id) }))
      .filter((item): item is { positionId: string; plant: Plant } => Boolean(item.plant)),
  };
}

function explicitPair(catalog: GardenLibraryManifest, a: string, b: string) {
  return catalog.neighborRules.researchPairs.find(
    (pair) => (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a),
  );
}

export function evaluatePlanting(
  candidate: GardenLibraryEntry,
  catalog: GardenLibraryManifest,
  context: PlantingContext,
  language: "en" | "es" = "en",
): PlantingGuidance[] {
  if (!context.neighbors.length) {
    return [
      {
        kind: "insufficient evidence",
        message: language === "es"
          ? "Todavía no hay vecinos físicos ocupados. Garden seguirá evaluando esta posición mientras se llena el sistema."
          : "No occupied physical neighbors yet. Garden will keep evaluating this position as the system fills.",
      },
    ];
  }

  const guidance: PlantingGuidance[] = [];
  for (const neighbor of context.neighbors) {
    const pair = explicitPair(catalog, candidate.libraryPlantId, neighbor.plant.knowledgeId);
    if (pair) {
      guidance.push({
        kind: "evidence-backed fit",
        neighborPlantId: neighbor.plant.id,
        sourceId: pair.sourceId,
        message: language === "es" ? `Asociación respaldada por evidencia con ${neighbor.plant.name}: ${pair.label}.` : `Evidence-backed pairing with ${neighbor.plant.name}: ${pair.label}.`,
      });
      continue;
    }
    const profile = candidate.guidanceProfile;
    if (profile?.traits.includes("large-footprint") || profile?.traits.includes("aggressive")) {
      guidance.push({
        kind: "consideration",
        neighborPlantId: neighbor.plant.id,
        message: language === "es" ? `${candidate.commonName} tiene un rasgo documentado de expansión o gran huella. Garden no tiene un modelo de espaciado para este sistema, así que revisa el espacio disponible cerca de ${neighbor.plant.name}.` : `${candidate.commonName} has a documented spreading or large-footprint trait. Garden has no spacing model for this system, so review the available room near ${neighbor.plant.name}.`,
      });
      continue;
    }
    guidance.push({
      kind: "insufficient evidence",
      neighborPlantId: neighbor.plant.id,
      message: language === "es" ? `Garden no tiene una regla de compatibilidad respaldada por evidencia para ${candidate.commonName} junto a ${neighbor.plant.name}.` : `Garden has no evidence-backed compatibility rule for ${candidate.commonName} next to ${neighbor.plant.name}.`,
    });
  }
  return guidance;
}

export function candidatesForPosition(catalog: GardenLibraryManifest, context: PlantingContext) {
  const entries = catalog.entries.filter((entry) => entry.status === "active");
  if (!context.neighbors.length) return entries;
  return [...entries].sort((a, b) => {
    const rank = (entry: GardenLibraryEntry) => {
      const findings = evaluatePlanting(entry, catalog, context);
      if (findings.some((item) => item.kind === "evidence-backed fit")) return 0;
      if (!findings.some((item) => item.kind === "consideration")) return 1;
      return 2;
    };
    return rank(a) - rank(b) || a.commonName.localeCompare(b.commonName);
  });
}
