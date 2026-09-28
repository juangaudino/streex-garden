import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gardenStore = readFileSync(new URL("./garden-store.tsx", import.meta.url), "utf8");
const aiCheckRoute = readFileSync(
  new URL("../routes/plants.$plantId.check.tsx", import.meta.url),
  "utf8",
);

describe("photo egress guardrails", () => {
  it("does not start background visual AI when a Moment is saved", () => {
    const addEventProjection =
      gardenStore.split("addEvent: (e, options) => {")[1]?.split("addPhoto: (photo) =>")[0] ?? "";
    expect(addEventProjection).toContain("persistMoment(plant, e, pendingPhoto)");
    expect(addEventProjection).not.toMatch(
      /requestMeaningfulChange|selectMeaningfulChangeCandidate|shouldGenerateMeaningfulChange/,
    );
  });

  it("does not preload adjacent displays from the AI Check render path", () => {
    expect(aiCheckRoute).not.toContain("preloadPhotoRendition");
    expect(aiCheckRoute).not.toContain("photoIds");
  });
});
