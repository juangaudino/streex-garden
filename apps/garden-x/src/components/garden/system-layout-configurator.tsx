import { Minus, Plus } from "lucide-react";
import { activeGridCells, canCreateCustomSystem, customSystemPositionCount, customSystemPositions, type CustomSystemLevel } from "@/lib/custom-system";
import { ui } from "@/lib/ui-copy";
import { Button } from "@/components/ui/button";
import { SystemPreview } from "@/components/garden/custom-system-builder";

type Props = {
  levels: CustomSystemLevel[];
  onChange: (levels: CustomSystemLevel[]) => void;
  language: "en" | "es";
  requiredPositionCount?: number;
  capacityIsEditable?: boolean;
};

export function SystemLayoutConfigurator({ levels, onChange, language, requiredPositionCount, capacityIsEditable = false }: Props) {
  const total = customSystemPositionCount(levels);
  const valid = canCreateCustomSystem(levels) && (requiredPositionCount === undefined || total === requiredPositionCount);

  const changeLevel = (index: number, key: "rows" | "columns", delta: number) => {
    onChange(levels.map((level, currentIndex) => {
      if (currentIndex !== index) return level;
      const next = { ...level, [key]: Math.max(1, level[key] + delta) };
      // Resizing changes the containing geometry, not the user's physical
      // selection. Keep cells that still fit and expose the rest as candidates.
      return {
        ...next,
        activeCells: activeGridCells(level).filter(
          (cell) => cell.row <= next.rows && cell.column <= next.columns,
        ),
      };
    }));
  };

  const toggleCell = (levelIndex: number, row: number, column: number) => {
    onChange(levels.map((level, currentIndex) => {
      if (currentIndex !== levelIndex) return level;
      const active = activeGridCells(level);
      const exists = active.some((cell) => cell.row === row && cell.column === column);
      const next = exists
        ? active.filter((cell) => cell.row !== row || cell.column !== column)
        : [...active, { row, column }];
      return {
        ...level,
        activeCells: next.sort((a, b) => a.row - b.row || a.column - b.column),
      };
    }));
  };

  const positions = customSystemPositions(levels);
  return (
    <div className="grid min-w-0 max-w-full gap-3">
      {levels.map((level, index) => (
        <div key={index} className="min-w-0 max-w-full rounded-2xl border border-border/70 bg-secondary/35 p-3">
          <p className="min-w-0 text-sm font-medium">{ui(language, "level")} {index + 1}</p>
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
            {(["rows", "columns"] as const).map((key) => (
              <div key={key} className="min-w-0 rounded-xl bg-background p-2 text-center sm:p-2.5">
                <p className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">{ui(language, key)}</p>
                <div className="mt-2 flex items-center justify-center gap-1.5 sm:gap-3">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => changeLevel(index, key, -1)} disabled={level[key] <= 1}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="numeral w-5 text-sm">{level[key]}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => changeLevel(index, key, 1)} disabled={key === "rows" ? level.rows >= 9 : level.columns >= 8}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 min-w-0 text-xs leading-relaxed text-muted-foreground">
            {level.rows} {ui(language, "rows").toLowerCase()} × {level.columns} {ui(language, "columns").toLowerCase()} · {activeGridCells(level).length}{requiredPositionCount !== undefined ? ` / ${requiredPositionCount}` : ""} {ui(language, "activePositions")}
          </p>
        </div>
      ))}
      <SystemPreview language={language} positions={positions} levels={levels} interactive onToggleCell={toggleCell} />
      {!valid && requiredPositionCount !== undefined ? <p className="min-w-0 text-xs leading-relaxed text-clay">{ui(language, capacityIsEditable ? "selectCapacity" : "keepSamePositions")} ({requiredPositionCount}) {ui(language, "toSave")}</p> : null}
    </div>
  );
}
