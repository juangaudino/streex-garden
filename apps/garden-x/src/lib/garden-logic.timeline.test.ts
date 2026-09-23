import { describe, expect, it } from "vitest";
import { isRedundantTimelineDetail } from "./garden-logic";

describe("timeline detail presentation", () => {
  it("suppresses exact duplicate detail", () => {
    expect(isRedundantTimelineDetail("Relocated", "Relocated")).toBe(true);
  });

  it("suppresses casing, whitespace and punctuation variants", () => {
    expect(
      isRedundantTimelineDetail(
        "Recorded from Record a moment.",
        "  recorded FROM record a moment  ",
      ),
    ).toBe(true);
  });

  it("keeps genuinely distinct detail", () => {
    expect(isRedundantTimelineDetail("Harvest", "First harvest from the outer leaves.")).toBe(
      false,
    );
  });
});
