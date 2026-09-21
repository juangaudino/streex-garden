import { describe, expect, it } from "vitest";
import { canRunAiCheck } from "./garden-logic";

describe("AI Check availability", () => {
  it("allows persisted historical evidence without an event id", () => {
    expect(
      canRunAiCheck(
        { backendGrowCycleId: "cycle-1" },
        { backendStoragePath: "owner-1/cycle/photo/original.jpg" },
      ),
    ).toBe(true);
  });

  it("does not start for local-only photos or plants without a cycle", () => {
    expect(
      canRunAiCheck({ backendGrowCycleId: "cycle-1" }, {}),
    ).toBe(false);
    expect(
      canRunAiCheck({}, { backendStoragePath: "owner/photo.jpg" }),
    ).toBe(false);
  });
});
