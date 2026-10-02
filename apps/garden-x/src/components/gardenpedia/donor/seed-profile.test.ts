import { describe, expect, it } from "vitest";

import { findCanonicalEntry } from "./canonical-adapter";
import {
  buildSeedProfile,
  buildSeedProfiles,
  canonicalSeedEntries,
  seedProfileCount,
  seedProfileForEntry,
} from "./seed-profile-adapter";

describe("canonical Seed Profile adapter", () => {
  it("exposes every published Seed Profile through the public catalog", () => {
    expect(seedProfileCount).toBe(211);
    expect(canonicalSeedEntries).toHaveLength(211);
    expect(buildSeedProfiles("en")).toHaveLength(211);
    expect(new Set(canonicalSeedEntries.map((entry) => entry.libraryPlantId)).size).toBe(211);
  });

  it("keeps the rich Genovese Basil profile connected to canonical sources", () => {
    const profile = seedProfileForEntry("genovese-basil", "en");

    expect(profile).not.toBeNull();
    expect(profile?.name).toBe("Genovese Basil");
    expect(profile?.scientificName).toContain("Ocimum");
    expect(profile?.protocol.length).toBeGreaterThan(0);
    expect(profile?.sources.length).toBeGreaterThan(0);
    expect(profile?.sources.every((source) => source.url.startsWith("http"))).toBe(true);
  });

  it("localizes profile identity and protocol text without changing its identity", () => {
    const entry = findCanonicalEntry("genovese-basil");
    const profile = entry ? buildSeedProfile(entry, "es") : null;

    expect(profile?.plantIdentityId).toBe("genovese-basil");
    expect(profile?.name).toBe("Genovese Basil");
    expect(profile?.spanishName).toBe("Albahaca genovesa");
    expect(profile?.summary).not.toBe(profile?.protocol[0]?.body);
    expect(profile?.protocol[0]?.title).toBeTruthy();
  });

  it("preserves uncertainty in a lower-density profile instead of filling donor slots", () => {
    const profile = seedProfileForEntry("arugula", "en");

    expect(profile).not.toBeNull();
    expect(profile?.evidence.needsValidation).toBeGreaterThan(0);
    expect(JSON.stringify(profile)).not.toContain("URUQ 12");
    expect(JSON.stringify(profile)).not.toContain("User Zero");
    expect(JSON.stringify(profile)).not.toContain("2026-A");
  });

  it("does not expose deferred or private inventory as public Seed Profiles", () => {
    expect(seedProfileForEntry("italian-oregano", "en")).toBeNull();
    expect(JSON.stringify(buildSeedProfiles("en"))).not.toMatch(
      /"(packetName|purchaseYear|germinationRatePct|purityPct|userId|sowings)"/,
    );
    expect(JSON.stringify(buildSeedProfiles("en"))).not.toContain("User Zero");
  });
});
