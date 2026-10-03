import { describe, expect, it } from "vitest";

import { stripPublicGardenpediaModulepreloads } from "./server";

describe("public Gardenpedia SSR preload boundary", () => {
  it("removes only modulepreload hints while preserving scripts and styles", () => {
    const html = [
      '<link rel="stylesheet" href="/assets/styles.css">',
      '<link rel="modulepreload" href="/assets/garden-store.js">',
      '<script type="module" src="/assets/index.js"></script>',
    ].join("");

    const result = stripPublicGardenpediaModulepreloads(html);

    expect(result).toContain('rel="stylesheet"');
    expect(result).toContain('src="/assets/index.js"');
    expect(result).not.toContain("modulepreload");
    expect(result).not.toContain("garden-store.js");
  });
});
