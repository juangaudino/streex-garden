export type GridCell = { row: number; column: number };

export type CustomSystemLevel = { rows: number; columns: number; activeCells?: GridCell[] };

export type CustomSystemPosition = {
  number: number;
  level: number;
  row: number;
  column: number;
};

export type GeometryLevel = CustomSystemLevel;

export const maxCustomSystemPositions = 36;
export const maxCustomSystemLevels = 12;
export const maxCustomSystemRows = 9;
export const maxCustomSystemColumns = 8;

export function normalizeCustomSystemLevels(levels: CustomSystemLevel[]): CustomSystemLevel[] {
  return levels.slice(0, maxCustomSystemLevels).map((level) => ({
    rows: Math.max(1, Math.min(maxCustomSystemRows, Math.floor(level.rows) || 1)),
    columns: Math.max(1, Math.min(maxCustomSystemColumns, Math.floor(level.columns) || 1)),
  }));
}

export function allGridCells(level: CustomSystemLevel): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 1; row <= level.rows; row += 1) {
    for (let column = 1; column <= level.columns; column += 1) cells.push({ row, column });
  }
  return cells;
}

export function normalizeGeometryLevels(levels: GeometryLevel[]): GeometryLevel[] {
  return levels.slice(0, maxCustomSystemLevels).map((level) => {
    const normalized = {
      rows: Math.max(1, Math.min(maxCustomSystemRows, Math.floor(level.rows) || 1)),
      columns: Math.max(1, Math.min(maxCustomSystemColumns, Math.floor(level.columns) || 1)),
    };
    const cells = level.activeCells
      ? level.activeCells.filter((cell, index, list) =>
          cell.row >= 1 && cell.row <= normalized.rows &&
          cell.column >= 1 && cell.column <= normalized.columns &&
          list.findIndex((candidate) => candidate.row === cell.row && candidate.column === cell.column) === index,
        )
      : allGridCells(normalized);
    return { ...normalized, activeCells: cells };
  });
}

export function activeGridCells(level: GeometryLevel): GridCell[] {
  return normalizeGeometryLevels([level])[0]?.activeCells ?? [];
}

export function customSystemPositionCount(levels: GeometryLevel[]) {
  return normalizeGeometryLevels(levels).reduce((total, level) => total + activeGridCells(level).length, 0);
}

export function canCreateCustomSystem(levels: GeometryLevel[]) {
  const normalized = normalizeGeometryLevels(levels);
  return normalized.length >= 1 && normalized.length <= maxCustomSystemLevels &&
    normalized.every((level) => activeGridCells(level).length > 0) &&
    customSystemPositionCount(normalized) <= maxCustomSystemPositions;
}

/** Picks a deterministic rectangular editor starting point for legacy systems
 * that predate persisted level geometry. It never changes data by itself. */
export function defaultRectangularLevels(positionCount: number): CustomSystemLevel[] {
  const total = Math.max(1, Math.min(maxCustomSystemPositions, Math.floor(positionCount) || 1));
  const candidates: CustomSystemLevel[] = [];
  for (let rows = 1; rows <= maxCustomSystemRows; rows += 1) {
    for (let columns = 1; columns <= maxCustomSystemColumns; columns += 1) {
      if (rows * columns === total) candidates.push({ rows, columns });
    }
  }
  return [candidates.sort((a, b) => Math.abs(a.rows - a.columns) - Math.abs(b.rows - b.columns) || a.rows - b.rows)[0] ?? { rows: 1, columns: total }];
}

/** Left-to-right, top-to-bottom, with numbering continuing across levels. */
export function customSystemPositions(levels: GeometryLevel[]): CustomSystemPosition[] {
  const positions: CustomSystemPosition[] = [];
  let number = 0;
  normalizeGeometryLevels(levels).forEach((level, levelIndex) => {
    activeGridCells(level).forEach(({ row, column }) => {
      number += 1;
      positions.push({ number, level: levelIndex + 1, row, column });
    });
  });
  return positions;
}
