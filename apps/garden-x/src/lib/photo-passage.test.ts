import { describe, expect, it } from "vitest";
import { photoPassageLabel } from "./garden-logic";

describe("human photo passage wording", () => {
  it("uses days for a short positive interval", () => {
    expect(photoPassageLabel(2, "en")).toBe("2 days, held in two photographs");
    expect(photoPassageLabel(2, "es")).toBe("2 días, conservados en dos fotografías");
  });

  it("uses weeks only when the interval has reached a week", () => {
    expect(photoPassageLabel(28, "en")).toBe("4 weeks, held in two photographs");
  });

  it("never renders zero weeks", () => {
    expect(photoPassageLabel(2, "en")).not.toContain("0 weeks");
  });
});
