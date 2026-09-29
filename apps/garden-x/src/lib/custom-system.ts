export type GridCell = { row: number; column: number };

export type CustomSystemLevel = { rows: number; columns: number; activeCells?: GridCell[] };

export type CustomSystemPosition = {
  number: number;
  level: number;
  row: number;
  column: number;
};

export type PhysicalSystemPosition = {
  id?: string;
  number: number;
  levelNumber?: number;
  rowNumber?: number;
  columnNumber?: number;
  gridX?: number;
  gridY?: number;
};

export type GeometryLevel = CustomSystemLevel & { levelNumber?: number };

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

function positionCell(position: PhysicalSystemPosition): GridCell | null {
  const row = position.rowNumber ?? position.gridY;
  const column = position.columnNumber ?? position.gridX;
  return row && column ? { row, column } : null;
}

function cellKey(cell: GridCell) {
  return `${cell.row}:${cell.column}`;
}

/**
 * Returns the physical blueprint cells, preserving both persisted layout cells
 * and canonical position coordinates. Persisted active_cells can be stale or
 * occupied-only after a legacy layout join; physical positions must still win.
 */
export function physicalGridCells(
  level: GeometryLevel,
  positions: readonly PhysicalSystemPosition[],
): GridCell[] {
  const normalized = normalizeGeometryLevels([level])[0] ?? level;
  const levelPositions = positions.filter(
    (position) => (position.levelNumber ?? 1) === (level.levelNumber ?? 1),
  );
  // Render the complete matrix so inactive cells preserve the real physical
  // spacing. Position mapping below still uses only active cells.
  const cells = [...allGridCells(normalized)];
  levelPositions.forEach((position) => {
    const cell = positionCell(position);
    if (cell && !cells.some((candidate) => cellKey(candidate) === cellKey(cell))) cells.push(cell);
  });
  if (!cells.length) return allGridCells(normalized);
  return cells.sort((a, b) => a.row - b.row || a.column - b.column);
}

/**
 * Maps canonical positions to their blueprint cell. Positions with persisted
 * coordinates keep them; legacy positions without coordinates are assigned in
 * canonical number order to the remaining physical cells.
 */
export function physicalPositionCellMap(
  level: GeometryLevel,
  positions: readonly PhysicalSystemPosition[],
): Map<string, PhysicalSystemPosition> {
  const normalized = normalizeGeometryLevels([level])[0] ?? level;
  const mapped = new Map<string, PhysicalSystemPosition>();
  const unplaced: PhysicalSystemPosition[] = [];
  positions
    .filter((position) => (position.levelNumber ?? 1) === (level.levelNumber ?? 1))
    .sort((a, b) => a.number - b.number)
    .forEach((position) => {
      const cell = positionCell(position);
      if (!cell) {
        unplaced.push(position);
        return;
      }
      mapped.set(cellKey(cell), position);
    });
  const activeCells = activeGridCells(normalized);
  const available = activeCells.filter((cell) => !mapped.has(cellKey(cell)));
  unplaced.forEach((position, index) => {
    const cell = available[index];
    if (cell) mapped.set(cellKey(cell), position);
  });
  return mapped;
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
    activeGridCells(level)
      .slice()
      .sort((a, b) => a.row - b.row || a.column - b.column)
      .forEach(({ row, column }) => {
      number += 1;
      positions.push({ number, level: levelIndex + 1, row, column });
      });
  });
  return positions;
}
