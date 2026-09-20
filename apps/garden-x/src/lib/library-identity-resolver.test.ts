import { describe, expect, it } from "vitest";
import { classifyLegacyIdentity } from "./library-identity-resolver";
import type { GardenLibraryManifest } from "./garden-library";

const entry = (libraryPlantId: string, commonName: string, cultivar = "") => ({
  libraryPlantId,
  commonName,
  scientificName: "Species",
  cultivar: cultivar || null,
  aliases: [commonName],
  category: "herb",
  status: "active" as const,
  provenance: [],
  guidanceProfile: null,
  reference: {
    germination: null,
    light: null,
    temperature: null,
    ph: null,
    ec: null,
    spacing: null,
    pruning: null,
    harvest: null,
    expectedCycle: null,
    commonProblems: [],
    recommendations: [],
    goodNeighborIds: [],
    betterSeparateIds: [],
    sourceIds: [],
    sources: [],
  },
});

const catalog = (entries: ReturnType<typeof entry>[]): GardenLibraryManifest => ({
  schemaVersion: 1,
  catalogVersion: "test",
  generatedAt: "2026-01-01T00:00:00.000Z",
  entries,
  neighborRules: { researchPairs: [], beneficialRoles: {} },
});

describe("legacy Library identity suggestions", () => {
  it("classifies a unique candidate without confirming it", () => {
    const result = classifyLegacyIdentity(
      {
        libraryPlantId: null,
        species: "Genovese Basil",
        scientific: "",
        variety: "",
        knowledgeId: "",
      },
      catalog([entry("genovese-basil", "Genovese Basil")]),
    );
    expect(result.kind).toBe("exact");
    expect(result.candidates[0]?.libraryPlantId).toBe("genovese-basil");
  });

  it("keeps multiple matches ambiguous", () => {
    const result = classifyLegacyIdentity(
      { libraryPlantId: null, species: "Basil", scientific: "", variety: "", knowledgeId: "" },
      catalog([
        entry("genovese-basil", "Basil", "Genovese"),
        entry("sweet-basil", "Basil", "Sweet"),
      ]),
    );
    expect(result.kind).toBe("ambiguous");
  });

  it("does not invent a match", () => {
    const result = classifyLegacyIdentity(
      {
        libraryPlantId: null,
        species: "Unknown plant",
        scientific: "",
        variety: "",
        knowledgeId: "",
      },
      catalog([entry("genovese-basil", "Genovese Basil")]),
    );
    expect(result.kind).toBe("none");
  });
});
