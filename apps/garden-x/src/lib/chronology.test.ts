import { describe, expect, it } from "vitest";
import { plantEvents, plantTimeline, sortPhotosByCapturedAt } from "./garden-logic";
import type { Photo, PlantEvent } from "./garden-data";

const photo = (id: string, capturedAt: string | null, daysAgo: number): Photo => ({
  id,
  plantId: "plant-1",
  src: "",
  daysAgo,
  capturedAt,
  caption: id,
  metrics: { heightCm: 0, leafCount: 0, greenness: 0, density: 0 },
});

const event = (id: string, occurredAt: string, daysAgo: number): PlantEvent => ({
  id,
  plantId: "plant-1",
  daysAgo,
  occurredAt,
  type: "note",
  title: id,
  provenance: "recorded",
});

describe("chronology projections", () => {
  it("sorts photos by captured_at with newest first by default", () => {
    const photos = [
      photo("older", "2026-09-01T18:00:00Z", 1),
      photo("newer", "2026-09-01T19:00:00Z", 10),
    ];

    expect(sortPhotosByCapturedAt(photos).map((item) => item.id)).toEqual(["newer", "older"]);
    expect(sortPhotosByCapturedAt(photos, "oldest").map((item) => item.id)).toEqual([
      "older",
      "newer",
    ]);
  });

  it("falls back to the projected day when a photo has no captured_at", () => {
    const photos = [photo("older", null, 10), photo("newer", null, 1)];
    expect(sortPhotosByCapturedAt(photos).map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("sorts timeline events by occurred_at and evidence by captured_at", () => {
    const entries = plantTimeline(
      [
        event("event-old", "2026-09-01T10:00:00Z", 10),
        event("event-new", "2026-09-01T12:00:00Z", 1),
      ],
      [
        photo("photo-old", "2026-09-01T11:00:00Z", 8),
        photo("photo-new", "2026-09-01T13:00:00Z", 2),
      ],
      "plant-1",
    );

    expect(
      entries.map((entry) => (entry.kind === "photo" ? entry.photo.id : entry.event.id)),
    ).toEqual(["photo-new", "event-new", "photo-old", "event-old"]);
    expect(
      plantTimeline(
        [
          event("event-old", "2026-09-01T10:00:00Z", 10),
          event("event-new", "2026-09-01T12:00:00Z", 1),
        ],
        [
          photo("photo-old", "2026-09-01T11:00:00Z", 8),
          photo("photo-new", "2026-09-01T13:00:00Z", 2),
        ],
        "plant-1",
        "oldest",
      ).map((entry) => (entry.kind === "photo" ? entry.photo.id : entry.event.id)),
    ).toEqual(["event-old", "photo-old", "event-new", "photo-new"]);
  });

  it("uses effective event dates for latest-event selectors", () => {
    const events = [
      event("entered-late-but-older", "2026-09-04T12:00:00Z", 0),
      event("entered-later-date", "2026-09-15T12:00:00Z", 10),
    ];
    expect(plantEvents(events, "plant-1").map((item) => item.id)).toEqual([
      "entered-later-date",
      "entered-late-but-older",
    ]);
  });
});
