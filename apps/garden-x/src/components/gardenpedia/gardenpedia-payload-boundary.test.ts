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
});
