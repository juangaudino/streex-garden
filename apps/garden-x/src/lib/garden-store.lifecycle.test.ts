import { describe, expect, it } from "vitest";
import { hydrationAfterRefreshFailure } from "./garden-store";

describe("Garden lifecycle hydration", () => {
  it("keeps a valid snapshot in reconnecting state after a transient failure", () => {
    expect(hydrationAfterRefreshFailure(true)).toBe("reconnecting");
  });

  it("reports an initial failure separately from a genuine empty state", () => {
    expect(hydrationAfterRefreshFailure(false)).toBe("error");
  });
});
