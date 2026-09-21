import { describe, expect, it } from "vitest";
import { recentPlantPhotos } from "./garden-logic";
import type { Photo, Plant } from "./garden-data";

const plants: Pick<Plant, "id">[] = [{ id: "plant-1" }];
const photo = (overrides: Partial<Photo>): Photo => ({
  id: "photo",
  plantId: "plant-1",
  src: "",
  daysAgo: 0,
  caption: "Photo",
  metrics: { heightCm: 0, leafCount: 0, greenness: 0, density: 0 },
  ...overrides,
});

describe("Home new photos projection", () => {
  it("excludes garden-level media so every item has a canonical plant route", () => {
    const photos = [
      photo({ id: "garden-cover", plantId: "", mediaScope: "garden_cover" }),
      photo({ id: "plant-photo", mediaScope: "cycle_evidence" }),
    ];

    expect(recentPlantPhotos(photos, plants).map((item) => item.id)).toEqual(["plant-photo"]);
  });

  it("does not expose a stale photo link for a plant missing from the canonical state", () => {
    const photos = [photo({ id: "stale", plantId: "missing", mediaScope: "cycle_evidence" })];

    expect(recentPlantPhotos(photos, plants)).toEqual([]);
  });

  it("keeps legacy plant evidence without a media scope", () => {
    expect(
      recentPlantPhotos([photo({ id: "legacy", mediaScope: undefined })], plants).map(
        (item) => item.id,
      ),
    ).toEqual(["legacy"]);
  });
});
