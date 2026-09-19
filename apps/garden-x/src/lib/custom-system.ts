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
