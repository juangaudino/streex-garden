import { describe, expect, it } from "vitest";
import { validateCompatibilityProfile } from "../../../../scripts/gardenpedia-compatibility-profile.mjs";
import type { CompatibilityProfileV1 } from "./garden-library";
import { gardenLibraryManifest } from "../generated/garden-library-manifest";

const sourceIds = new Set(["ferry-petunia-dwarf"]);

function profile(): CompatibilityProfileV1 {
  return {
    profileVersion: 1,
    hydroponicSuitability: { status: "unknown", reason: "No validated crop-specific evidence." },
    growthHabits: { status: "unknown" },
    matureSize: {
      height: { status: "unknown" },
      spread: { status: "pending", reason: "Awaiting a context-specific source." },
    },
    spacing: { status: "unknown" },
    light: { status: "unknown" },
  };
}

function evidence() {
  return [
    {
      sourceIds: ["ferry-petunia-dwarf"],
      evidenceType: "source_backed" as const,
      confidence: "high" as const,
      taxonomicScope: { level: "identity" as const },
    },
  ];
}

describe("Gardenpedia compatibility profile contract", () => {
  it("publishes profiles for exactly the eight real-data pilot identities", () => {
    expect(gardenLibraryManifest.entries).toHaveLength(43);
    const profiled = gardenLibraryManifest.entries.filter((entry) => entry.compatibilityProfile);
    expect(profiled.map((entry) => entry.libraryPlantId).sort()).toEqual(
      [
        "buttercrunch-lettuce",
        "cascading-petunia",
        "cherry-tomato",
        "common-mint",
        "evergreen-bunching-onion-nabuka",
        "genovese-basil",
        "monterey-strawberry",
        "tiny-tim-tomato",
      ].sort(),
    );
    expect(profiled).toHaveLength(8);
  });

  it("keeps cultivar evidence separate from generic crop identities", () => {
    const tinyTim = gardenLibraryManifest.entries.find(
      (entry) => entry.libraryPlantId === "tiny-tim-tomato",
    )!.compatibilityProfile!;
    const cherry = gardenLibraryManifest.entries.find(
      (entry) => entry.libraryPlantId === "cherry-tomato",
    )!.compatibilityProfile!;
    expect(tinyTim.growthHabits).toMatchObject({ status: "known", value: ["bushy"] });
    expect(tinyTim.matureSize.height).toMatchObject({
      status: "known",
      value: { minCm: 10, maxCm: 50 },
    });
    expect(cherry.growthHabits.status).toBe("unknown");
    expect(cherry.matureSize.height.status).toBe("unknown");
    expect(cherry.spacing.status).toBe("unknown");
  });

  it("publishes profile source references with the containing claim and scope", () => {
    const tinyTim = gardenLibraryManifest.entries.find(
      (entry) => entry.libraryPlantId === "tiny-tim-tomato",
    )!;
    expect(tinyTim.compatibilityProfile?.growthHabits).toMatchObject({
      status: "known",
      evidence: [{ sourceIds: ["rhs-tiny-tim"], taxonomicScope: { level: "identity" } }],
    });
    expect(tinyTim.reference.sources).toContainEqual(
      expect.objectContaining({ id: "rhs-tiny-tim", publisher: "Royal Horticultural Society" }),
    );

    const mint = gardenLibraryManifest.entries.find(
      (entry) => entry.libraryPlantId === "common-mint",
    )!;
    expect(mint.compatibilityProfile?.spacing).toMatchObject({
      status: "known",
      value: [{ minCm: 61, context: "in_ground", spacingType: "between_rows" }],
      evidence: [{ sourceIds: ["usu-mint"], taxonomicScope: { level: "genus", taxon: "Mentha" } }],
    });
  });

  it("keeps every pilot claim source resolvable in the public catalog", () => {
    const profiled = gardenLibraryManifest.entries.filter((entry) => entry.compatibilityProfile);
    for (const entry of profiled) {
      const claimSourceIds = new Set<string>();
      const collect = (value: unknown) => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
          value.forEach(collect);
          return;
        }
        const record = value as Record<string, unknown>;
        if (Array.isArray(record.sourceIds)) {
          record.sourceIds.forEach((sourceId) => claimSourceIds.add(String(sourceId)));
        }
        Object.values(record).forEach(collect);
      };
      collect(entry.compatibilityProfile);
      const publicSourceIds = new Set(entry.reference.sources.map((source) => source.id));
      expect([...claimSourceIds].every((sourceId) => publicSourceIds.has(sourceId))).toBe(true);
      expect(
        entry.reference.sources.some((source) => /etsy\.com|user zero/i.test(source.url)),
      ).toBe(false);
    }
    expect(
      gardenLibraryManifest.entries.find(
        (entry) => entry.libraryPlantId === "evergreen-bunching-onion-nabuka",
      )?.commonName,
    ).toBe("Evergreen Bunching Onion Nabuka");
  });

  it("preserves the pilot distinctions for runners, spreading mint, cascading petunia, and clumping onion", () => {
    const byId = new Map(
      gardenLibraryManifest.entries.map((entry) => [
        entry.libraryPlantId,
        entry.compatibilityProfile,
      ]),
    );
    expect(byId.get("monterey-strawberry")?.growthHabits).toMatchObject({
      status: "known",
      value: ["spreading"],
    });
    expect(byId.get("common-mint")?.growthHabits).toMatchObject({
      status: "known",
      value: ["spreading"],
    });
    expect(byId.get("common-mint")?.hydroponicSuitability.status).toBe("pending");
    expect(byId.get("cascading-petunia")?.growthHabits).toMatchObject({
      status: "known",
      value: ["trailing"],
    });
    expect(byId.get("evergreen-bunching-onion-nabuka")?.growthHabits).toMatchObject({
      status: "known",
      value: ["clumping"],
    });
    expect(byId.get("evergreen-bunching-onion-nabuka")?.hydroponicSuitability.status).toBe(
      "pending",
    );
  });

  it("accepts explicit unknown and pending states without values", () => {
    expect(validateCompatibilityProfile(profile(), sourceIds)).toMatchObject({
      profileVersion: 1,
      hydroponicSuitability: { status: "unknown" },
      matureSize: { height: { status: "unknown" }, spread: { status: "pending" } },
    });
  });

  it("requires property-level published evidence for known values", () => {
    const candidate = profile();
    candidate.hydroponicSuitability = { status: "compatible", evidence: evidence() };
    candidate.growthHabits = {
      status: "known",
      value: ["compact", "upright"],
      evidence: evidence(),
    };
    candidate.matureSize.height = {
      status: "known",
      value: { minCm: 20, maxCm: 30, context: "container" },
      evidence: evidence(),
    };
    expect(validateCompatibilityProfile(candidate, sourceIds)).toBe(candidate);
    candidate.matureSize.height = {
      status: "known",
      value: { minCm: 20, maxCm: 30, context: "container" },
      evidence: [{ ...evidence()[0]!, sourceIds: ["missing-source"] }],
    };
    expect(() => validateCompatibilityProfile(candidate, sourceIds)).toThrow(
      /unknown or unpublished source/,
    );
  });

  it("rejects undocumented dimensions, reversed ranges, and unsupported growth habits", () => {
    const candidate = profile();
    candidate.matureSize.height = {
      status: "known",
      value: { minCm: 30, maxCm: 20, context: "container" },
      evidence: evidence(),
    };
    expect(() => validateCompatibilityProfile(candidate, sourceIds)).toThrow(
      /minCm must not exceed maxCm/,
    );
    candidate.matureSize.height = {
      status: "known",
      value: { minCm: 20, maxCm: 30, context: "container" },
      evidence: evidence(),
    };
    candidate.growthHabits = { status: "known", value: ["giant" as never], evidence: evidence() };
    expect(() => validateCompatibilityProfile(candidate, sourceIds)).toThrow(
      /unsupported growth habit/,
    );
  });

  it("requires explicit hydroponic conditions for conditional suitability", () => {
    const candidate = profile();
    candidate.hydroponicSuitability = {
      status: "conditional",
      conditions: [],
      evidence: evidence(),
    };
    expect(() => validateCompatibilityProfile(candidate, sourceIds)).toThrow(
      /requires at least one condition/,
    );
    candidate.hydroponicSuitability = {
      status: "conditional",
      conditions: [{ kind: "support", description: "Use a support structure." }],
      evidence: evidence(),
    };
    expect(validateCompatibilityProfile(candidate, sourceIds)).toBe(candidate);
  });

  it("keeps plant spacing context and separates germination light from growing light", () => {
    const candidate = profile();
    candidate.spacing = {
      status: "known",
      value: [{ minCm: 30, maxCm: 45, context: "in_ground", spacingType: "between_rows" }],
      evidence: evidence(),
    };
    candidate.light = {
      status: "known",
      value: [
        { phase: "germination", requirement: { kind: "partial_sun" } },
        { phase: "growing", requirement: { kind: "hours_per_day", minHours: 12, maxHours: 14 } },
      ],
      evidence: evidence(),
    };
    expect(validateCompatibilityProfile(candidate, sourceIds)).toBe(candidate);
    candidate.spacing = {
      status: "known",
      value: [{ minCm: 45, maxCm: 30, context: "hydroponic", spacingType: "position_spacing" }],
      evidence: evidence(),
    };
    expect(() => validateCompatibilityProfile(candidate, sourceIds)).toThrow(
      /minimum must not exceed maximum/,
    );
  });

  it("preserves source-backed one-sided size and spacing bounds", () => {
    const candidate = profile();
    candidate.matureSize.height = {
      status: "known",
      value: { maxCm: 30, context: "hydroponic" },
      evidence: evidence(),
    };
    candidate.spacing = {
      status: "known",
      value: [
        {
          minCm: 60,
          context: "in_ground",
          spacingType: "between_rows",
        },
      ],
      evidence: evidence(),
    };
    expect(validateCompatibilityProfile(candidate, sourceIds)).toBe(candidate);

    candidate.matureSize.height = {
      status: "known",
      value: { context: "hydroponic" } as never,
      evidence: evidence(),
    };
    expect(() => validateCompatibilityProfile(candidate, sourceIds)).toThrow(
      /expected a minimum, maximum, or both/,
    );
  });

  it("rejects missing profile properties and rejects Pending as a claimed value", () => {
    const incomplete = profile() as Partial<CompatibilityProfileV1>;
    delete incomplete.spacing;
    expect(() => validateCompatibilityProfile(incomplete, sourceIds)).toThrow(/spacing/);
    const candidate = profile();
    candidate.hydroponicSuitability = { status: "Pending" as never };
    expect(() => validateCompatibilityProfile(candidate, sourceIds)).toThrow(/expected compatible/);
    candidate.hydroponicSuitability = {
      status: "compatible",
      evidence: evidence(),
      compatible: true,
    } as never;
    expect(() => validateCompatibilityProfile(candidate, sourceIds)).toThrow(
      /unsupported field compatible/,
    );
  });
});
