import { describe, expect, it } from "vitest";
import { photoMetricEntries } from "./garden-logic";

describe("photoMetricEntries", () => {
  it("omits unknown measurements instead of rendering them as zero", () => {
    expect(
      photoMetricEntries({ heightCm: null, leafCount: null, greenness: 0, density: null }),
    ).toEqual([]);
  });

  it("keeps only the measurements that are present", () => {
    expect(
      photoMetricEntries({ heightCm: 12, leafCount: null, greenness: 0, density: 25 }),
    ).toEqual([
      { kind: "height", value: 12 },
      { kind: "density", value: 25 },
    ]);
  });

  it("preserves legitimate zero measurements", () => {
    expect(photoMetricEntries({ heightCm: 0, leafCount: 0, greenness: 0, density: 0 })).toEqual([
      { kind: "height", value: 0 },
      { kind: "leaves", value: 0 },
      { kind: "density", value: 0 },
    ]);
  });
});
