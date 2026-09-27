import { describe, expect, it } from "vitest";
import type { Photo } from "./garden-data";
import { requestedComparePhotoPair, validateComparePhotoSearch } from "./compare-photo-selection";

const photo = (id: string, plantId = "plant", cycleId = "cycle"): Photo => ({
  id,
  plantId,
  backendGrowCycleId: cycleId,
  src: "",
  daysAgo: 0,
  caption: id,
  metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
});

describe("Compare photo deep links", () => {
  const history = [
    photo("before"),
    photo("after"),
    photo("other-plant", "another"),
    photo("old-cycle", "plant", "old"),
  ];

  it("accepts only bounded string search parameters and preserves the existing Garden AI source", () => {
    expect(
      validateComparePhotoSearch({
        from: "garden-ai",
        beforePhotoId: "before",
        afterPhotoId: "after",
        injected: true,
      }),
    ).toEqual({ from: "garden-ai", beforePhotoId: "before", afterPhotoId: "after" });
    expect(
      validateComparePhotoSearch({ beforePhotoId: " ", afterPhotoId: "x".repeat(201) }),
    ).toEqual({ from: undefined });
  });

  it("resolves exactly the requested pair from the requested plant and current cycle", () => {
    expect(requestedComparePhotoPair(history, "plant", "cycle", "before", "after")).toEqual({
      before: history[0],
      after: history[1],
    });
  });

  it.each([
    ["missing ID", "missing", "after"],
    ["another plant's photo", "other-plant", "after"],
    ["a stale cycle photo", "old-cycle", "after"],
    ["the same photo twice", "before", "before"],
  ])(
    "rejects %s so Compare can use its existing selection fallback",
    (_case, beforeId, afterId) => {
      expect(requestedComparePhotoPair(history, "plant", "cycle", beforeId, afterId)).toBeNull();
    },
  );
});
