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
};

export function SystemLayoutConfigurator({ levels, onChange, language, requiredPositionCount }: Props) {
  const total = customSystemPositionCount(levels);
  const valid = canCreateCustomSystem(levels) && (requiredPositionCount === undefined || total === requiredPositionCount);

  const changeLevel = (index: number, key: "rows" | "columns", delta: number) => {
    onChange(levels.map((level, currentIndex) => {
      if (currentIndex !== index) return level;
      const next = { ...level, [key]: Math.max(1, level[key] + delta) };
      return { ...next, activeCells: activeGridCells(next) };
    }));
  };

  const toggleCell = (levelIndex: number, row: number, column: number) => {
    onChange(levels.map((level, currentIndex) => {
      if (currentIndex !== levelIndex) return level;
      const active = activeGridCells(level);
      const exists = active.some((cell) => cell.row === row && cell.column === column);
      return { ...level, activeCells: exists ? active.filter((cell) => cell.row !== row || cell.column !== column) : [...active, { row, column }] };
    }));
  };

  const positions = customSystemPositions(levels);
  return (
    <div className="grid gap-3">
      {levels.map((level, index) => (
        <div key={index} className="rounded-2xl border border-border/70 bg-secondary/35 p-3">
          <p className="text-sm font-medium">{ui(language, "level")} {index + 1}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(["rows", "columns"] as const).map((key) => (
              <div key={key} className="rounded-xl bg-background p-2.5 text-center">
                <p className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">{ui(language, key)}</p>
                <div className="mt-2 flex items-center justify-center gap-3">
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
          <p className="mt-3 text-xs text-muted-foreground">{level.rows} {ui(language, "rows").toLowerCase()} × {level.columns} {ui(language, "columns").toLowerCase()} · {activeGridCells(level).length} {ui(language, "activePositions")}</p>
        </div>
      ))}
      <SystemPreview language={language} positions={positions} levels={levels} interactive onToggleCell={toggleCell} />
      {!valid && requiredPositionCount !== undefined ? <p className="text-xs text-clay">{ui(language, "keepSamePositions")} ({requiredPositionCount}) {ui(language, "toSave")}</p> : null}
    </div>
  );
}
