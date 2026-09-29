import { describe, expect, it } from "vitest";
import type { Garden, Photo, Plant, PlantEvent } from "./garden-data";
import { buildPlantStoryContext } from "./plant-story-context";

const plant: Plant = {
  id: "plant-1",
  gardenId: "garden-1",
  name: "Basil H1/P1",
  species: "Basil",
  scientific: "Ocimum basilicum",
  variety: "Genovese",
  knowledgeId: "basil",
  libraryPlantId: "genovese-basil",
  plantedDatePrecision: "exact",
  plantedDaysAgo: 30,
  originType: "seed",
  status: "steady",
  statusNote: "",
  heroPhotoId: "photo-2",
  identityConfirmed: true,
  backendGrowCycleId: "cycle-1",
  backendPositionId: "position-1",
  slot: "Pod 1",
};

const garden: Garden = {
  id: "garden-1",
  name: "Garden 1",
  kind: "hydroponic",
  cover: "",
  place: "Kitchen",
  note: "",
  machine: { name: "URUQ 8-Pod", pods: 8 },
};

function event(id: string, daysAgo: number, type: PlantEvent["type"], title: string): PlantEvent {
  return {
    id,
    plantId: plant.id,
    daysAgo,
    occurredAt: `2026-09-${String(28 - daysAgo).padStart(2, "0")}T12:00:00.000Z`,
    type,
    title,
    provenance: "recorded",
  };
}

function photo(
  id: string,
  daysAgo: number,
  metrics: Photo["metrics"],
  options: Partial<Pick<Photo, "backendStoragePath" | "src" | "isHistoricalEvidence">> = {},
): Photo {
  return {
    id,
    plantId: plant.id,
    src: options.src ?? "data:image/gif;base64,fixture",
    daysAgo,
    caption: id,
    metrics,
    capturedAt: `2026-09-${String(28 - daysAgo).padStart(2, "0")}T12:00:00.000Z`,
    ...options,
  };
}

describe("plant story context", () => {
  it("assembles bounded facts, observations, interpretations, and grounding", () => {
    const context = buildPlantStoryContext(
      plant,
      garden,
      [
        event("origin", 30, "planted", "Planted"),
        event("move", 10, "transplant", "Moved to Pod 1"),
      ],
      [
        photo(
          "photo-1",
          20,
          { heightCm: 5, leafCount: 4, greenness: 70, density: 20 },
          { backendStoragePath: "owner/photo-1/display.jpg" },
        ),
        photo(
          "photo-2",
          1,
          { heightCm: 12, leafCount: 9, greenness: 78, density: 42 },
          { backendStoragePath: "owner/photo-2/display.jpg" },
        ),
      ],
      null,
      "en",
    );

    expect(context.schemaVersion).toBe("plant_story_context_v1");
    expect(context.knowledge.libraryPlantId).toBe("genovese-basil");
    expect(context.facts.map((fact) => fact.id)).toEqual([
      "identity",
      "cycle-age",
      "current-location",
      "record-coverage",
    ]);
    expect(context.observations[0]?.text).toContain("height increased by 7 cm");
    expect(context.interpretations[0]?.confidence).toBe("moderate");
    expect(context.interpretations[0]?.evidence.map((ref) => ref.id)).toEqual([
      "photo-1",
      "photo-2",
    ]);
    expect(context.events.map((item) => item.title)).toEqual(["Planted", "Moved to Pod 1"]);
    expect(context.coverage).toMatchObject({
      totalEvents: 2,
      selectedEvents: 2,
      totalPhotos: 2,
      measuredPhotos: 2,
    });
  });

  it("does not claim a trend from one photo", () => {
    const context = buildPlantStoryContext(
      plant,
      garden,
      [event("origin", 2, "planted", "Planted")],
      [photo("photo-1", 1, { heightCm: 5, leafCount: null, greenness: 70, density: null })],
      null,
      "es",
    );

    expect(context.observations).toHaveLength(0);
    expect(context.interpretations).toHaveLength(0);
    expect(
      context.uncertainties.some((item) => /suficiente evidencia fotográfica/i.test(item.text)),
    ).toBe(true);
  });

  it("keeps historical metadata useful when the media body is unavailable", () => {
    const context = buildPlantStoryContext(
      plant,
      garden,
      [event("origin", 20, "planted", "Planted")],
      [
        photo(
          "historical-photo",
          15,
          { heightCm: null, leafCount: null, greenness: 0, density: null },
          {
            src: "",
            isHistoricalEvidence: true,
          },
        ),
      ],
      null,
      "en",
    );

    expect(context.photos[0]).toMatchObject({ id: "historical-photo", metadataOnly: true });
    expect(context.coverage.metadataOnlyPhotos).toBe(1);
    expect(context.uncertainties.some((item) => /historical metadata/i.test(item.text))).toBe(true);
    expect(context.facts.find((fact) => fact.id === "record-coverage")?.value).toContain("1 photo");
  });

  it("uses factual history without inventing visual meaning when no photos exist", () => {
    const context = buildPlantStoryContext(
      plant,
      garden,
      [event("origin", 20, "planted", "Planted"), event("note", 3, "note", "Leaves checked")],
      [],
      null,
      "en",
    );

    expect(context.events.map((item) => item.id)).toEqual(["origin", "note"]);
    expect(context.interpretations).toHaveLength(0);
    expect(context.uncertainties.some((item) => /not enough photo evidence/i.test(item.text))).toBe(
      true,
    );
  });

  it("bounds large histories deterministically", () => {
    const context = buildPlantStoryContext(
      plant,
      garden,
      Array.from({ length: 20 }, (_, index) =>
        event(`event-${index}`, 30 - index, "note", `Note ${index}`),
      ),
      Array.from({ length: 10 }, (_, index) =>
        photo(`photo-${index}`, 20 - index, {
          heightCm: null,
          leafCount: null,
          greenness: 0,
          density: null,
        }),
      ),
      null,
      "en",
    );

    expect(context.events).toHaveLength(12);
    expect(context.photos).toHaveLength(6);
  });
});
