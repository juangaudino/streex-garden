import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), "apps/garden-x/src", file), "utf8");

describe("Gardenpedia P0 diagnostic entry", () => {
  it("keeps the temporary entry independent from feature surfaces and recovery", () => {
    const route = source("routes/gardenpedia.index.tsx");
    const shell = source("components/gardenpedia/gardenpedia-diagnostic-shell.tsx");

    expect(route).toContain("gardenpedia-library-text-diagnostic");
    expect(route).not.toContain("gardenpedia-diagnostic-shell");
    expect(route).not.toContain("gardenpedia-direct");
    expect(route).not.toContain("private-surfaces");
    expect(route).not.toContain("seed-profile");
    expect(route).not.toContain("machine-library");
    expect(route).not.toContain("calculator-page");
    expect(route).not.toContain("gardenpedia-runtime-recovery");
    expect(route).not.toContain("gardenpedia-direct");
    expect(route).not.toContain("private-surfaces");
    expect(route).not.toContain("seed-profile");
    expect(route).not.toContain("machine-library");
    expect(route).not.toContain("calculator-page");
    expect(route).not.toContain("gardenpedia-runtime-recovery");
    expect(shell).toContain("Diagnostic shell");
    expect(shell).not.toMatch(/from ["'][^"']*gardenpedia\/(?:donor|private-surfaces)/);
  });
});
