import { describe, expect, it } from "vitest";
import { chooseSessionHighlight } from "./garden-logic";

const plant = (id: string, cycleClosed = false) => ({ id, cycleClosed });

describe("chooseSessionHighlight", () => {
  it("returns no plant for an empty dataset", () => {
    expect(chooseSessionHighlight([], null)).toBeUndefined();
  });

  it("keeps the only active plant eligible", () => {
    expect(chooseSessionHighlight([plant("one")], null, () => 0)?.id).toBe("one");
  });

  it("ignores closed plants and avoids the previous session when possible", () => {
    const plants = [plant("previous"), plant("next"), plant("closed", true)];
    expect(chooseSessionHighlight(plants, "previous", () => 0)?.id).toBe("next");
  });

  it("falls back to the active pool when the previous id is the only option", () => {
    expect(chooseSessionHighlight([plant("previous")], "previous", () => 0)?.id).toBe("previous");
  });

  it("uses the supplied random source exactly once for a stable selection", () => {
    let calls = 0;
    const selected = chooseSessionHighlight([plant("one"), plant("two")], null, () => {
      calls += 1;
      return 0.99;
    });
    expect(calls).toBe(1);
    expect(selected?.id).toBe("two");
  });
});
