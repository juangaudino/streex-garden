import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), "apps/garden-x/src", file), "utf8");

describe("Gardenpedia diagnostic shell", () => {
  it("remains an isolated non-production harness", () => {
    const route = source("routes/gardenpedia.index.tsx");
    const shell = source("components/gardenpedia/gardenpedia-diagnostic-shell.tsx");

    expect(route).toContain("GardenpediaDirect");
    expect(route).not.toContain("gardenpedia-library-visual-diagnostic");
    expect(route).not.toContain("gardenpedia-diagnostic-shell");
    expect(route).not.toContain("gardenpedia-runtime-recovery");
    expect(shell).toContain("Diagnostic shell");
    expect(shell).not.toMatch(/from ["'][^"']*gardenpedia\/(?:donor|private-surfaces)/);
  });
});
