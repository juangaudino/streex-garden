import { describe, expect, it } from "vitest";
import { allGridCells, canCreateCustomSystem, customSystemPositionCount, customSystemPositions, defaultRectangularLevels, physicalGridCells, physicalPositionCellMap } from "./custom-system";

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

  it("preserves deterministic coordinates across the supported rectangular geometries", () => {
    for (const level of [
      { rows: 1, columns: 3 },
      { rows: 2, columns: 4 },
      { rows: 4, columns: 2 },
      { rows: 2, columns: 6 },
      { rows: 6, columns: 2 },
    ]) {
      const positions = customSystemPositions([level]);
      expect(positions).toHaveLength(level.rows * level.columns);
      expect(positions[0]).toEqual({ number: 1, level: 1, row: 1, column: 1 });
      expect(positions.at(-1)).toEqual({
        number: level.rows * level.columns,
        level: 1,
        row: level.rows,
        column: level.columns,
      });
    }
  });

  it("keeps position identity while changing only coordinates when totals match", () => {
    const before = customSystemPositions([{ rows: 2, columns: 4 }]);
    const after = customSystemPositions([{ rows: 4, columns: 2 }]);
    expect(after.map((position) => position.number)).toEqual(before.map((position) => position.number));
    expect(after[1]).toMatchObject({ number: 2, row: 1, column: 2 });
    expect(after[2]).toMatchObject({ number: 3, row: 2, column: 1 });
  });

  it("supports an irregular lattice with inactive cells", () => {
    const activeCells = [
      { row: 1, column: 2 },
      { row: 2, column: 1 }, { row: 2, column: 2 }, { row: 2, column: 3 }, { row: 2, column: 4 },
      { row: 3, column: 2 }, { row: 3, column: 3 }, { row: 3, column: 4 },
      { row: 4, column: 1 }, { row: 4, column: 2 }, { row: 4, column: 3 }, { row: 4, column: 4 },
    ];
    const positions = customSystemPositions([{ rows: 4, columns: 4, activeCells }]);
    expect(customSystemPositionCount([{ rows: 4, columns: 4, activeCells }])).toBe(12);
    expect(positions).toHaveLength(12);
    expect(positions[0]).toEqual({ number: 1, level: 1, row: 1, column: 2 });
    expect(positions[11]).toEqual({ number: 12, level: 1, row: 4, column: 4 });
  });

  it("keeps inactive cells out of position numbering while preserving coordinates", () => {
    const levels = [{ rows: 2, columns: 3, activeCells: [{ row: 1, column: 1 }, { row: 2, column: 3 }] }];
    expect(customSystemPositions(levels)).toEqual([
      { number: 1, level: 1, row: 1, column: 1 },
      { number: 2, level: 1, row: 2, column: 3 },
    ]);
  });

  it("keeps a fresh 8-position model independent while resizing its candidate grid", () => {
    const selected = [
      { row: 1, column: 1 }, { row: 1, column: 2 }, { row: 1, column: 3 }, { row: 1, column: 4 },
      { row: 2, column: 1 }, { row: 2, column: 2 }, { row: 2, column: 3 }, { row: 2, column: 4 },
    ];
    const resized = { rows: 3, columns: 7, activeCells: selected };
    expect(allGridCells(resized)).toHaveLength(21);
    expect(customSystemPositionCount([resized])).toBe(8);
    expect(customSystemPositions([resized]).map(({ number, row, column }) => ({ number, row, column }))).toEqual(
      selected.map((cell, index) => ({ number: index + 1, ...cell })),
    );
  });

  it("supports an explicit custom capacity increase to sixteen positions", () => {
    const level = { rows: 4, columns: 4, activeCells: allGridCells({ rows: 4, columns: 4 }) };
    expect(customSystemPositionCount([level])).toBe(16);
    expect(customSystemPositions([level])).toHaveLength(16);
    expect(customSystemPositions([level]).at(-1)).toEqual({ number: 16, level: 1, row: 4, column: 4 });
  });

  it("requires at least one active cell per level", () => {
    expect(canCreateCustomSystem([{ rows: 2, columns: 2, activeCells: [] }])).toBe(false);
  });

  it("chooses a stable rectangular starting point for legacy capacities", () => {
    expect(defaultRectangularLevels(8)).toEqual([{ rows: 2, columns: 4 }]);
    expect(defaultRectangularLevels(12)).toEqual([{ rows: 3, columns: 4 }]);
    expect(defaultRectangularLevels(3)).toEqual([{ rows: 1, columns: 3 }]);
  });

  it("keeps every physical position when a persisted layout only lists a subset", () => {
    const positions = Array.from({ length: 8 }, (_, index) => ({
      id: `h1-${index + 1}`,
      number: index + 1,
      rowNumber: Math.floor(index / 4) + 1,
      columnNumber: (index % 4) + 1,
    }));
    const level = { rows: 2, columns: 4, levelNumber: 1, activeCells: [{ row: 1, column: 1 }, { row: 1, column: 2 }] };
    const cells = physicalGridCells(level, positions);
    const map = physicalPositionCellMap(level, positions);
    expect(cells).toHaveLength(8);
    expect(map.size).toBe(8);
    expect([...map.values()].map((position) => position.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("renders all twelve physical positions for a full machine", () => {
    const positions = Array.from({ length: 12 }, (_, index) => ({
      id: `h2-${index + 1}`,
      number: index + 1,
      rowNumber: Math.floor(index / 4) + 1,
      columnNumber: (index % 4) + 1,
    }));
    const level = { rows: 3, columns: 4, levelNumber: 1, activeCells: [{ row: 1, column: 1 }] };
    expect(physicalGridCells(level, positions)).toHaveLength(12);
    expect(physicalPositionCellMap(level, positions).size).toBe(12);
  });

  it("preserves the canonical H5 4×7 geometry instead of flattening positions", () => {
    const coordinates = [
      [1, 2], [1, 6],
      [2, 1], [2, 3], [2, 5], [2, 7],
      [3, 2], [3, 4], [3, 6],
      [4, 1], [4, 3], [4, 5],
    ];
    const positions = coordinates.map(([rowNumber, columnNumber], index) => ({
      id: `h5-${index + 1}`,
      number: index + 1,
      rowNumber,
      columnNumber,
    }));
    const level = { rows: 4, columns: 7, levelNumber: 1, activeCells: coordinates.map(([row, column]) => ({ row, column })) };
    expect(physicalGridCells(level, positions)).toHaveLength(28);
    expect([...physicalPositionCellMap(level, positions).entries()]).toEqual(
      coordinates.map(([row, column], index) => [`${row}:${column}`, positions[index]]),
    );
  });

  it("assigns legacy positions without coordinates without losing empty cells", () => {
    const positions = Array.from({ length: 8 }, (_, index) => ({ id: `legacy-${index + 1}`, number: index + 1 }));
    const level = { rows: 2, columns: 4, levelNumber: 1 };
    expect(physicalGridCells(level, positions)).toHaveLength(8);
    expect([...physicalPositionCellMap(level, positions).values()].map((position) => position.id)).toEqual(
      positions.map((position) => position.id),
    );
  });
});
