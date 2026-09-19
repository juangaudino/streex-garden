import { describe, expect, it } from "vitest";
import { canCreateCustomSystem, customSystemPositionCount, customSystemPositions } from "./custom-system";

describe("custom system geometry", () => {
  it("supports a 1×1 system", () => {
    expect(customSystemPositionCount([{ rows: 1, columns: 1 }])).toBe(1);
    expect(customSystemPositions([{ rows: 1, columns: 1 }])).toEqual([{ number: 1, level: 1, row: 1, column: 1 }]);
  });

  it("numbers a rectangular grid left-to-right and top-to-bottom", () => {
    expect(customSystemPositions([{ rows: 2, columns: 3 }])).toEqual([
      { number: 1, level: 1, row: 1, column: 1 }, { number: 2, level: 1, row: 1, column: 2 },
      { number: 3, level: 1, row: 1, column: 3 }, { number: 4, level: 1, row: 2, column: 1 },
      { number: 5, level: 1, row: 2, column: 2 }, { number: 6, level: 1, row: 2, column: 3 },
    ]);
  });

  it("continues numbering across levels with different geometry", () => {
    const positions = customSystemPositions([{ rows: 3, columns: 4 }, { rows: 2, columns: 3 }]);
    expect(positions).toHaveLength(18);
    expect(positions[11]).toEqual({ number: 12, level: 1, row: 3, column: 4 });
    expect(positions[12]).toEqual({ number: 13, level: 2, row: 1, column: 1 });
    expect(positions[17]).toEqual({ number: 18, level: 2, row: 2, column: 3 });
  });

  it("keeps the V1 total within the canonical position capacity", () => {
    expect(canCreateCustomSystem([{ rows: 4, columns: 8 }, { rows: 1, columns: 4 }])).toBe(true);
    expect(canCreateCustomSystem([{ rows: 5, columns: 8 }, { rows: 1, columns: 1 }])).toBe(false);
  });
});
