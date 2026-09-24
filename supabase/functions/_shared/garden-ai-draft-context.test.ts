import { describe, expect, it } from "vitest";
import { photoOnlyAiCheckContext, resolveAiCheckDraftScope } from "./garden-ai-draft-context";

describe("AI Check draft scope", () => {
  it("retains owner-scoped cycle mode for a valid cycle id", () => {
    expect(resolveAiCheckDraftScope("a14b9cd2-0a51-47f4-8b56-a70bc718b3d0", undefined)).toEqual({
      mode: "cycle",
      growCycleId: "a14b9cd2-0a51-47f4-8b56-a70bc718b3d0",
    });
  });

  it("allows only an explicit photo-only mode with no cycle id", () => {
    expect(resolveAiCheckDraftScope(undefined, "photo_only")).toEqual({ mode: "photo_only" });
    expect(resolveAiCheckDraftScope(undefined, undefined)).toBeNull();
    expect(resolveAiCheckDraftScope("a14b9cd2-0a51-47f4-8b56-a70bc718b3d0", "photo_only")).toBeNull();
    expect(resolveAiCheckDraftScope(undefined, "garden")).toBeNull();
  });

  it("marks photo-only context as having no selected plant, cycle, garden, or history", () => {
    expect(photoOnlyAiCheckContext()).toMatchObject({
      review_scope: "photo_only",
      plant_instance: null,
      grow_cycle: null,
      garden: null,
      canonical_history: null,
    });
  });
});
