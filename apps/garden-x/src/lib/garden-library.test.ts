import { describe, expect, it } from "vitest";
import { gardenLibraryManifest as manifest } from "../generated/garden-library-manifest";
import {
  candidatesForPosition,
  evaluatePlanting,
  physicalNeighbors,
  resolvePlantingContext,
  searchGardenLibrary,
  localizedLibraryName,
} from "./garden-library";
import type { Garden, Plant } from "./garden-data";

const catalog = manifest;

function gardenWithGrid(): Garden {
  return {
    id: "garden-1",
    name: "Garden",
    kind: "hydroponic",
    cover: "",
    place: "",
    note: "",
    backendPositions: [
      { id: "p-1", number: 1, active: true, levelNumber: 1, rowNumber: 1, columnNumber: 1 },
      { id: "p-2", number: 2, active: true, levelNumber: 1, rowNumber: 1, columnNumber: 2 },
      { id: "p-3", number: 3, active: true, levelNumber: 1, rowNumber: 2, columnNumber: 1 },
      { id: "p-4", number: 4, active: true, levelNumber: 2, rowNumber: 1, columnNumber: 2 },
    ],
  };
}

const basil: Plant = {
  id: "basil",
  gardenId: "garden-1",
  backendPositionId: "p-2",
  name: "Basil",
  species: "Basil",
  scientific: "Ocimum basilicum",
  variety: "Genovese",
  knowledgeId: "genovese-basil",
  plantedDaysAgo: 0,
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
  slot: "P2",
};

describe("Garden Library catalog and planting guidance", () => {
  it("publishes 43 unique stable identities", () => {
    expect(catalog.entries).toHaveLength(43);
    expect(new Set(catalog.entries.map((entry) => entry.libraryPlantId)).size).toBe(
      43,
    );
    expect(
      catalog.entries.every((entry) => entry.reference && Array.isArray(entry.reference.sourceIds)),
    ).toBe(true);
    expect(
      catalog.entries.find((entry) => entry.libraryPlantId === "genovese-basil")?.reference.ph,
    ).toBeTruthy();
    expect(
      localizedLibraryName(
        catalog.entries.find((entry) => entry.libraryPlantId === "genovese-basil")!,
        "es",
      ),
    ).toBe("Albahaca genovesa");
    expect(
      catalog.entries.some((entry) => entry.libraryPlantId === "english-thyme"),
    ).toBe(true);
    expect(
      catalog.entries.some((entry) => entry.libraryPlantId === "german-thyme"),
    ).toBe(true);
    expect(
      catalog.entries.some((entry) => entry.libraryPlantId === "petunia-dwarf-bedding-mixed"),
    ).toBe(true);
    expect(
      catalog.entries.some((entry) => entry.libraryPlantId === "cascading-petunia"),
    ).toBe(true);
  });

  it("searches common, scientific, cultivar, and aliases without plant-specific UI code", () => {
    expect(
      searchGardenLibrary(catalog, "Ocimum basilicum").some(
        (entry) => entry.libraryPlantId === "genovese-basil",
      ),
    ).toBe(true);
    expect(
      searchGardenLibrary(catalog, "Genovese").some(
        (entry) => entry.libraryPlantId === "genovese-basil",
      ),
    ).toBe(true);
    expect(
      searchGardenLibrary(catalog, "albahaca").some(
        (entry) => entry.libraryPlantId === "genovese-basil",
      ),
    ).toBe(true);
    expect(
      searchGardenLibrary(catalog, "tomillo alemán").some(
        (entry) => entry.libraryPlantId === "german-thyme",
      ),
    ).toBe(true);
    expect(
      searchGardenLibrary(catalog, "trailing petunia").some(
        (entry) => entry.libraryPlantId === "cascading-petunia",
      ),
    ).toBe(true);
  });

  it("uses same-level orthogonal geometry, never display-number adjacency", () => {
    const neighbors = physicalNeighbors(gardenWithGrid(), "p-1").map((position) => position.id);
    expect(neighbors).toEqual(["p-2", "p-3"]);
    expect(neighbors).not.toContain("p-4");
  });

  it("uses explicit evidence when a catalog pair exists and says insufficient evidence otherwise", () => {
    const garden = gardenWithGrid();
    const context = resolvePlantingContext(garden, "p-1", [basil]);
    const tomato = catalog.entries.find((entry) => entry.libraryPlantId === "cherry-tomato")!;
    const unknown = catalog.entries.find((entry) => entry.libraryPlantId === "lavender-vera")!;
    expect(
      evaluatePlanting(tomato, catalog, context).some(
        (item) => item.kind === "evidence-backed fit",
      ),
    ).toBe(true);
    expect(
      evaluatePlanting(unknown, catalog, context).every(
        (item) => item.kind !== "evidence-backed fit",
      ),
    ).toBe(true);
  });

  it("keeps guidance advisory and admits a newly published catalog entry", () => {
    const context = resolvePlantingContext(gardenWithGrid(), "p-1", [basil]);
    const extended = {
      ...catalog,
      entries: [
        ...catalog.entries,
        {
          ...catalog.entries[0]!,
          libraryPlantId: "future-library-entry",
          commonName: "Future variety",
        },
      ],
    };
    expect(
      candidatesForPosition(extended, context).some(
        (entry) => entry.libraryPlantId === "future-library-entry",
      ),
    ).toBe(true);
  });
});
