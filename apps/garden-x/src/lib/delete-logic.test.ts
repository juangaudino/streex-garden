import { describe, expect, it } from "vitest";
import { planEventDeletion, planPhotoDeletion, photoStoragePaths } from "./delete-logic";

describe("safe delete planning", () => {
  it("invalidates an event without photos while preserving the audit model", () => {
    expect(planEventDeletion("event-1", [])).toEqual({
      strategy: "invalidate",
      eventId: "event-1",
      evidencePhotoIds: [],
      evidencePreserved: false,
    });
  });

  it("preserves one or many photos when an event is removed", () => {
    const photos = [
      { id: "photo-1", backendEventId: "event-1" },
      { id: "photo-2", backendEventId: "event-1" },
      { id: "photo-other", backendEventId: "event-2" },
    ];
    expect(planEventDeletion("event-1", photos).evidencePhotoIds).toEqual(["photo-1", "photo-2"]);
    expect(planEventDeletion("event-1", photos).evidencePreserved).toBe(true);
  });

  it("deletes an independent photo without an event", () => {
    const plan = planPhotoDeletion({
      id: "photo-1",
      backendStoragePath: "owner/photo-1/original.jpg",
    });
    expect(plan.linkedEventId).toBeNull();
    expect(plan.preserveEvent).toBe(false);
    expect(plan.storagePaths).toHaveLength(3);
  });

  it("deletes a linked photo while preserving its event", () => {
    const plan = planPhotoDeletion({
      id: "photo-1",
      backendEventId: "event-1",
      backendStoragePath: "owner/photo-1/original.jpg",
    });
    expect(plan.linkedEventId).toBe("event-1");
    expect(plan.preserveEvent).toBe(true);
  });

  it("marks the cover for recalculation and never broadens Storage cleanup", () => {
    const plan = planPhotoDeletion(
      { id: "photo-1", backendStoragePath: "owner/photo-1/original.jpg" },
      "photo-1",
    );
    expect(plan.recalculateCover).toBe(true);
    expect(plan.storagePaths).toEqual([
      "owner/photo-1/original.jpg",
      "owner/photo-1/preview.jpg",
      "owner/photo-1/display.jpg",
    ]);
    expect(photoStoragePaths("owner/photo-2/original.png")).toEqual([
      "owner/photo-2/original.png",
      "owner/photo-2/preview.jpg",
      "owner/photo-2/display.jpg",
    ]);
  });
});
