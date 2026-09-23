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
  it("leaves current identities unpopulated rather than inventing compatibility values", () => {
    expect(gardenLibraryManifest.entries).toHaveLength(43);
    expect(gardenLibraryManifest.entries.every((entry) => !("compatibilityProfile" in entry))).toBe(
      true,
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
