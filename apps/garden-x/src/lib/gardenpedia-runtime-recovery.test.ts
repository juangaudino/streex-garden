import { describe, expect, it } from "vitest";

import {
  isLegacyGardenpediaCacheName,
  isLegacyGardenpediaRegistration,
} from "./gardenpedia-runtime-recovery";

describe("Gardenpedia legacy runtime recovery", () => {
  it("identifies the old scoped Gardenpedia worker and the retired root worker", () => {
    expect(
      isLegacyGardenpediaRegistration({
        scope: "https://garden.getstreex.com/gardenpedia/",
        active: { scriptURL: "https://garden.getstreex.com/gardenpedia/service-worker.js" },
      }),
    ).toBe(true);
    expect(
      isLegacyGardenpediaRegistration({
        scope: "https://garden.getstreex.com/",
        active: { scriptURL: "https://garden.getstreex.com/sw.js" },
      }),
    ).toBe(true);
  });

  it("does not classify unrelated workers or the private photo cache as legacy", () => {
    expect(
      isLegacyGardenpediaRegistration({
        scope: "https://garden.getstreex.com/other-app/",
        active: { scriptURL: "https://garden.getstreex.com/other-app/worker.js" },
      }),
    ).toBe(false);
    expect(isLegacyGardenpediaCacheName("garden-labs-timeline-evidence-v0-1")).toBe(true);
    expect(isLegacyGardenpediaCacheName("garden-x-photo-renditions-v2")).toBe(false);
  });
});
