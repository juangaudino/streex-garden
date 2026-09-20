export type CustomSystemLevel = { rows: number; columns: number };

export type CustomSystemPosition = {
  number: number;
  level: number;
  row: number;
  column: number;
};

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

export function customSystemPositionCount(levels: CustomSystemLevel[]) {
  return normalizeCustomSystemLevels(levels).reduce((total, level) => total + level.rows * level.columns, 0);
}

export function canCreateCustomSystem(levels: CustomSystemLevel[]) {
  return levels.length >= 1 && levels.length <= maxCustomSystemLevels && customSystemPositionCount(levels) <= maxCustomSystemPositions;
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
export function customSystemPositions(levels: CustomSystemLevel[]): CustomSystemPosition[] {
  const positions: CustomSystemPosition[] = [];
  let number = 0;
  normalizeCustomSystemLevels(levels).forEach((level, levelIndex) => {
    for (let row = 1; row <= level.rows; row += 1) {
      for (let column = 1; column <= level.columns; column += 1) {
        number += 1;
        positions.push({ number, level: levelIndex + 1, row, column });
      }
    }
  });
  return positions;
}
