import { describe, expect, it } from "vitest";
import type { Photo, Plant, PlantEvent } from "./garden-data";
import {
  HOME_MEANINGFUL_CHANGE_MIN_GAP_DAYS,
  HOME_MEANINGFUL_CHANGE_LIMIT,
  HOME_RECENT_ACTIVITY_LIMIT,
  homePlantGardenCountCopy,
  isHomeJournalActivity,
  projectHomeRecentActivity,
  projectHomeMeaningfulChanges,
  selectHomeHighlightedPlant,
  selectHomeMeaningfulChangePairs,
} from "./home-journal";

const plant = (id: string, overrides: Partial<Plant> = {}): Plant => ({
  id,
  gardenId: "garden-a",
  name: id,
  species: "Lettuce",
  scientific: "Lactuca sativa",
  variety: "",
  knowledgeId: "lettuce",
  plantedDaysAgo: 12,
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
  backendGrowCycleId: `cycle-${id}`,
  ...overrides,
});

const event = (
  id: string,
  plantId: string,
  occurredAt: string,
  overrides: Partial<PlantEvent> = {},
): PlantEvent => ({
  id,
  plantId,
  daysAgo: 0,
  occurredAt,
  type: "note",
  title: id,
  detail: "A recorded note",
  provenance: "recorded",
  ...overrides,
});

const photo = (
  plantId: string,
  id: string,
  capturedAt: string,
  overrides: Partial<Photo> = {},
): Photo => ({
  id,
  plantId,
  src: "",
  daysAgo: 0,
  caption: id,
  metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
  mediaScope: "cycle_evidence",
  backendStoragePath: `owner/${plantId}/${id}/original.jpg`,
  backendGrowCycleId: `cycle-${plantId}`,
  capturedAt,
  provenance: "recorded",
  ...overrides,
});

describe("Journal Home selectors", () => {
  it("prefers the newest eligible recorded fact in the 14-day window and breaks ties by stable plant ID", () => {
    const now = new Date(2026, 8, 27, 15);
    const plants = [plant("z"), plant("a"), plant("closed", { cycleClosed: true })];
    const selected = selectHomeHighlightedPlant(
      plants,
      [
        event("recent-z", "z", new Date(2026, 8, 26, 10).toISOString(), { lifeEvent: "harvested" }),
        event("recent-a", "a", new Date(2026, 8, 26, 10).toISOString(), { lifeEvent: "flowered" }),
        event("old", "closed", new Date(2026, 8, 26, 11).toISOString(), { lifeEvent: "ended" }),
      ],
      [],
      now,
    );

    expect(selected?.id).toBe("a");
  });

  it("ignores operational and inferred events, but accepts a non-empty user note or uploaded cycle photo", () => {
    const now = new Date(2026, 8, 27, 15);
    const plants = [plant("operational"), plant("note"), plant("photo")];
    const selected = selectHomeHighlightedPlant(
      plants,
      [
        event("care", "operational", new Date(2026, 8, 27, 10).toISOString(), {
          type: "maintenance",
        }),
        event("ai", "note", new Date(2026, 8, 27, 12).toISOString(), {
          type: "ai",
          provenance: "inferred",
          lifeEvent: "flowered",
        }),
        event("note", "note", new Date(2026, 8, 27, 14).toISOString(), {
          detail: "  a real note  ",
        }),
      ],
      [photo("photo", "today", new Date(2026, 8, 27, 9).toISOString())],
      now,
    );

    expect(selected?.id).toBe("note");
  });

  it("uses stable local-day rotation when there is no recent evidence and skips closed cycles", () => {
    const plants = [plant("z"), plant("closed", { cycleClosed: true }), plant("a")];
    const now = new Date(2026, 8, 27, 15);
    const stableActive = [plant("a"), plant("z")];
    const expected =
      stableActive[
        Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000) %
          stableActive.length
      ];

    expect(selectHomeHighlightedPlant(plants, [], [], now)?.id).toBe(expected?.id);
    expect(selectHomeHighlightedPlant([], [], [], now)).toBeUndefined();
  });

  it("selects one same-cycle visual pair per plant, with the closest earlier photo at least three days before", () => {
    const plants = [plant("lettuce")];
    const photos = [
      photo("lettuce", "before", "2026-09-01"),
      photo("lettuce", "too-close", "2026-09-02"),
      photo("lettuce", "after", "2026-09-04"),
      photo("lettuce", "duplicate-path-row", "2026-09-01", {
        backendStoragePath: "owner/lettuce/before/original.jpg",
      }),
      photo("lettuce", "wrong-cycle", "2026-09-08", { backendGrowCycleId: "old-cycle" }),
      photo("lettuce", "not-cycle-photo", "2026-09-09", { mediaScope: "garden_cover" }),
      photo("lettuce", "inferred", "2026-09-10", { provenance: "inferred" }),
      photo("lettuce", "pending", "2026-09-11", { backendStoragePath: "" }),
    ];
    const pairs = selectHomeMeaningfulChangePairs(plants, photos, []);

    expect(HOME_MEANINGFUL_CHANGE_MIN_GAP_DAYS).toBe(3);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({
      before: expect.objectContaining({ id: "before" }),
      after: expect.objectContaining({ id: "after" }),
      elapsedDays: 3,
    });
  });

  it("ranks at most one pair per plant by newest after date, then elapsed days, then plant ID", () => {
    const plants = [plant("b"), plant("a"), plant("older")];
    const photos = [
      photo("b", "b-before", "2026-09-01"),
      photo("b", "b-after", "2026-09-07"),
      photo("a", "a-before", "2026-09-01"),
      photo("a", "a-after", "2026-09-07"),
      photo("older", "older-before", "2026-08-20"),
      photo("older", "older-after", "2026-09-06"),
      photo("a", "a-latest", "2026-09-08"),
    ];

    expect(
      selectHomeMeaningfulChangePairs(plants, photos, []).map((pair) => pair.plant.id),
    ).toEqual(["a", "b", "older"]);
  });

  it("caps the Home surface at three cards without filling missing pairs", () => {
    const plants = [plant("d"), plant("c"), plant("b"), plant("a")];
    const photos = plants.flatMap(({ id }) => [
      photo(id, `${id}-before`, "2026-09-01"),
      photo(id, `${id}-after`, "2026-09-05"),
    ]);
    const projected = projectHomeMeaningfulChanges(plants, photos, []);

    expect(HOME_MEANINGFUL_CHANGE_LIMIT).toBe(3);
    expect(projected.map(({ plant: item }) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps a Moment with attached note, Life Event and photo as one canonical activity event", () => {
    const moment = event("moment", "plant", "2026-09-20T12:00:00Z", {
      type: "harvest",
      lifeEvent: "harvested",
      title: "Harvested",
      detail: "Testing",
      photoIds: ["moment-photo"],
    });
    const attached = photo("plant", "moment-photo", "2026-09-20T12:00:00Z", {
      backendEventId: moment.id,
    });

    expect(isHomeJournalActivity(moment)).toBe(true);
    expect(projectHomeRecentActivity([moment])).toEqual([moment]);
    expect(selectHomeMeaningfulChangePairs([plant("plant")], [attached], [moment])).toEqual([]);
    expect(HOME_RECENT_ACTIVITY_LIMIT).toBe(4);
  });

  it("localizes greeting counts with correct singular and plural forms", () => {
    expect(homePlantGardenCountCopy("en", 1, 1)).toBe("1 plant across 1 garden");
    expect(homePlantGardenCountCopy("en", 2, 3)).toBe("2 plants across 3 gardens");
    expect(homePlantGardenCountCopy("es", 1, 1)).toBe("1 planta en 1 jardín");
    expect(homePlantGardenCountCopy("es", 2, 3)).toBe("2 plantas en 3 jardines");
  });
});
