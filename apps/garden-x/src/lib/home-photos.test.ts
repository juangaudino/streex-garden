import { describe, expect, it } from "vitest";
import { distinctPhotoEvidence, gardenCoverChoices, plantsRepresentedInPhotos, recentPlantPhotos } from "./garden-logic";
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
  it("keeps garden cover uploads isolated and deduplicated from plant evidence", () => {
    const gardenCover = photo({ id: "garden-photo", plantId: "", mediaScope: "garden_cover" });
    expect(gardenCoverChoices([gardenCover], [gardenCover, photo({ id: "plant-photo" })]).map((item) => item.id)).toEqual([
      "garden-photo",
      "plant-photo",
    ]);
  });

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
      recentPlantPhotos([photo({ id: "legacy" })], plants).map(
        (item) => item.id,
      ),
    ).toEqual(["legacy"]);
  });

  it("deduplicates status pills by plant in photo-strip order", () => {
    const orderedPlants = [{ id: "plant-2" }, { id: "plant-1" }];
    const represented = plantsRepresentedInPhotos(
      [photo({ plantId: "plant-1" }), photo({ id: "second", plantId: "plant-1" }), photo({ id: "third", plantId: "plant-2" })],
      orderedPlants,
    );
    expect(represented.map((plant) => plant.id)).toEqual(["plant-1", "plant-2"]);
  });

  it("treats the same stored evidence as one comparison frame", () => {
    const frames = distinctPhotoEvidence([
      photo({ id: "photo-a", backendStoragePath: "owners/u/photos/a.jpg" }),
      photo({ id: "duplicate-row", backendStoragePath: "owners/u/photos/a.jpg" }),
      photo({ id: "photo-b", backendStoragePath: "owners/u/photos/b.jpg" }),
    ]);
    expect(frames.map((item) => item.id)).toEqual(["photo-a", "photo-b"]);
  });
});
