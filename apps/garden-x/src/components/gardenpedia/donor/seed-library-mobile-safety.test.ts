import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const donorRoot = fileURLToPath(new URL(".", import.meta.url));
const seedProfileSource = readFileSync(resolve(donorRoot, "seed-profile.tsx"), "utf8");
const stylesSource = readFileSync(resolve(donorRoot, "gardenpedia-direct.css"), "utf8");

describe("Gardenpedia mobile seed landing", () => {
  it("keeps the public seed landing progressively rendered", () => {
    expect(seedProfileSource).toContain("const SEED_LIBRARY_PAGE_SIZE = 48");
    expect(seedProfileSource).toContain("profiles.slice(0, visibleCount)");
    expect(seedProfileSource).toContain("labels.showMore");
  });

  it("removes mobile WebKit compositor pressure from catalog surfaces", () => {
    expect(stylesSource).toContain("background-attachment: scroll");
    expect(stylesSource).toContain("-webkit-backdrop-filter: none");
    expect(stylesSource).toContain("backdrop-filter: none");
    expect(stylesSource).toContain("animation: none");
  });
});
