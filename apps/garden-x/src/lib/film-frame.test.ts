import { describe, expect, it } from "vitest";
import { visibleFilmFrames } from "./film-frame";

describe("visible Growth Film frames", () => {
  it("keeps only the current and immediately next frame mounted", () => {
    const history = Array.from({ length: 200 }, (_, index) => `photo-${index}`);
    const visible = visibleFilmFrames(history, 119);

    expect(visible).toEqual([
      { item: "photo-119", index: 119 },
      { item: "photo-120", index: 120 },
    ]);
    expect(visible).toHaveLength(2);
  });

  it("mounts only the current frame at the end of a sequence", () => {
    expect(visibleFilmFrames(["first", "second", "third"], 2)).toEqual([
      { item: "third", index: 2 },
    ]);
  });

  it("mounts the next frame for an initial transition", () => {
    expect(visibleFilmFrames(["first", "second", "third"], 0)).toEqual([
      { item: "first", index: 0 },
      { item: "second", index: 1 },
    ]);
  });
});
