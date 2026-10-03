import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), "apps/garden-x/src", file), "utf8");

describe("Gardenpedia Library text diagnostic", () => {
  it("remains a non-production harness after the full React route is restored", () => {
    const route = source("routes/gardenpedia.index.tsx");
    const diagnostic = source("components/gardenpedia/gardenpedia-library-text-diagnostic.tsx");

    expect(route).toContain("GardenpediaDirect");
    expect(route).not.toContain("gardenpedia-library-text-diagnostic");
    expect(route).not.toContain("gardenpedia-library-visual-diagnostic");
    expect(diagnostic).toContain("./donor/canonical-adapter");
    expect(diagnostic).not.toMatch(/seed-profile|machine-library|calculator-page|private-surfaces/);
    expect(diagnostic).not.toMatch(/<img\b|import .*?(image|photo|visual|rendition|preload)/i);
  });
});
