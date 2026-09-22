import { describe, expect, it } from "vitest";
import { hydrationAfterRefreshFailure, isBackgroundHydration } from "./garden-store";

describe("Garden lifecycle hydration", () => {
  it("keeps a valid snapshot in reconnecting state after a transient failure", () => {
    expect(hydrationAfterRefreshFailure(true)).toBe("reconnecting");
  });

  it("reports an initial failure separately from a genuine empty state", () => {
    expect(hydrationAfterRefreshFailure(false)).toBe("error");
  });

  it("keeps a valid snapshot visible during background reconnect states", () => {
    expect(isBackgroundHydration("reconnecting")).toBe(true);
    expect(isBackgroundHydration("offline")).toBe(true);
    expect(isBackgroundHydration("loading")).toBe(false);
    expect(isBackgroundHydration("ready")).toBe(false);
  });
});
