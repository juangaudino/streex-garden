import { describe, expect, it } from "vitest";
import { formatStatusLine, plantIdentityParts } from "./plant-identity";
import type { Plant } from "./garden-data";

const plant: Plant = {
  id: "plant-1",
  gardenId: "garden-1",
  name: "Luna",
  species: "Cilantro",
  scientific: "Coriandrum sativum",
  variety: "Leaf cilantro",
  knowledgeId: "cilantro",
  libraryPlantId: "cilantro",
  libraryCatalogVersion: "v1",
  libraryIdentitySnapshot: {
    commonName: "Cilantro",
    scientificName: "Coriandrum sativum",
    cultivar: "Leaf cilantro",
  },
  plantedDaysAgo: 4,
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
};

describe("Plant identity presentation", () => {
  it("keeps nickname separate from Library identity", () => {
    expect(plant.name).toBe("Luna");
    expect(plantIdentityParts(plant)).toEqual({
      commonName: "Cilantro",
      scientificName: "Coriandrum sativum",
      cultivar: "Leaf cilantro",
    });
  });

  it("omits empty status separators", () => {
    expect(formatStatusLine("Steady", "")).toBe("Steady");
    expect(formatStatusLine("Thriving", "Approaching first cut.")).toBe(
      "Thriving — Approaching first cut.",
    );
  });
});
