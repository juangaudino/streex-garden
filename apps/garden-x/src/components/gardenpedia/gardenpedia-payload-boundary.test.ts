import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const directory = dirname(fileURLToPath(import.meta.url));
const source = (relativePath: string) => readFileSync(resolve(directory, relativePath), "utf8");

describe("Gardenpedia public payload boundary", () => {
  it("keeps private and secondary public surfaces out of the initial Explore graph", () => {
    const explore = source("donor/explore.tsx");
    const direct = source("gardenpedia-direct.tsx");

    expect(explore).not.toMatch(/from ["']\.\.\/private-surfaces["']/);
    expect(explore).not.toMatch(/from ["']\.\/seed-profile["']/);
    expect(explore).not.toMatch(/from ["']\.\/calculator-page["']/);
    expect(explore).toMatch(/import\(["']\.\/seed-profile["']\)/);
    expect(explore).toMatch(/import\(["']\.\/calculator-page["']\)/);
    expect(direct).not.toMatch(
      /from ["']\.\/donor\/(?:seed-profile|machine-profile|plant-detail)["']/,
    );
  });

  it("uses an ID-only seed index in the public catalog adapter", () => {
    const adapter = source("donor/canonical-adapter.ts");

    expect(adapter).toContain("garden-seed-profile-index");
    expect(adapter).not.toMatch(/labs\/gardenpedia\/data\/seed-profiles-/);
  });

  it("keeps the public Seeds list on card metadata and out of full profile bodies", () => {
    const list = source("donor/seed-library-adapter.ts");
    const page = source("donor/seed-profile.tsx");
    const fullAdapter = source("donor/seed-profile-adapter.ts");

    expect(list).toContain("gardenSeedProfileCatalog");
    expect(list).not.toMatch(/seed-profiles-(?:v0|expansion)/);
    expect(page).toContain("buildSeedLibraryCards");
    expect(page).not.toContain("buildSeedProfiles");
    expect(fullAdapter).toMatch(/seedProfilesV0|seedProfilesWave1/);
  });

  it("does not boot Supabase Auth while the public catalog is active", () => {
    const explore = source("donor/explore.tsx");

    expect(explore).toContain("hasPersistedGardenpediaSession");
    expect(explore).toContain("privateView !== null");
    expect(explore).toContain("sessionHint || auth.signedIn");
  });
});
