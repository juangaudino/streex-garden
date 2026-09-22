import { describe, expect, it } from "vitest";
import { dateOnlyFromIso, dateOnlyToUtcNoon } from "./temporal";

describe("date-only event semantics", () => {
  it("keeps a selected calendar date stable", () => {
    expect(dateOnlyToUtcNoon("2026-09-04")).toBe("2026-09-04T12:00:00.000Z");
    expect(dateOnlyFromIso("2026-09-04T12:00:00.000Z")).toBe("2026-09-04");
  });

  it("rejects malformed date-only values", () => {
    expect(dateOnlyToUtcNoon("2026-9-4")).toBeNull();
    expect(dateOnlyFromIso(null)).toBeNull();
  });
});
