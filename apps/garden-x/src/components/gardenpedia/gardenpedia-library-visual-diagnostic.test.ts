import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), "apps/garden-x/src", file), "utf8");

describe("Gardenpedia Library visual diagnostic", () => {
  it("mounts the current Library surface without restoring excluded features", () => {
    const route = source("routes/gardenpedia.index.tsx");
    const diagnostic = source("components/gardenpedia/gardenpedia-library-visual-diagnostic.tsx");

    expect(route).toContain("gardenpedia-library-visual-diagnostic");
    expect(route).not.toContain("gardenpedia-direct");
    expect(route).not.toContain("gardenpedia-library-text-diagnostic");
    expect(diagnostic).toContain('from "./donor/explore"');
    expect(diagnostic).not.toMatch(/seed-profile|machine-library|calculator-page|private-surfaces/);
    expect(diagnostic).toContain("diagnosticOnly");
  });

  it("records the current image boundary instead of inventing a plant-image loader", () => {
    const explore = source("components/gardenpedia/donor/explore.tsx");

    expect(explore).toContain('src="/icons/garden-x-512.png"');
    expect(explore).not.toMatch(/thumbnailUrl|imageSrc|rendition|preload/i);
  });
});
