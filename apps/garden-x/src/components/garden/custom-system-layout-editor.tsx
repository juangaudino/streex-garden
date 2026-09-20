import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Garden } from "@/lib/garden-data";
import { activeGridCells, allGridCells, canCreateCustomSystem, customSystemPositionCount, customSystemPositions, type CustomSystemLevel } from "@/lib/custom-system";
import { useGarden } from "@/lib/garden-store";
import { localizeKnownError, ui } from "@/lib/ui-copy";
import { Button } from "@/components/ui/button";
import { SystemPreview } from "@/components/garden/custom-system-builder";

export function CustomSystemLayoutEditor({ garden }: { garden: Garden }) {
  const { updateCustomSystemLayout, language } = useGarden();
  const initial = (garden.systemLayoutLevels ?? []).map(({ rows, columns, activeCells }) => ({ rows, columns, activeCells: activeCells?.length ? activeCells : allGridCells({ rows, columns }) }));
  const [levels, setLevels] = useState<CustomSystemLevel[]>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setLevels(initial);
  }, [garden.id, garden.systemLayoutLevels]);
  const total = customSystemPositionCount(levels);
  const positions = useMemo(() => customSystemPositions(levels), [levels]);
  const expectedTotal = garden.backendPositions?.length ?? total;
  const valid = canCreateCustomSystem(levels) && total === expectedTotal;

  if (!garden.systemLayoutLevels?.length) return null;

  const changeLevel = (index: number, key: "rows" | "columns", delta: number) => {
    setLevels((current) => current.map((level, currentIndex) =>
      currentIndex === index ? { ...level, [key]: Math.max(1, level[key] + delta), activeCells: activeGridCells({ ...level, [key]: Math.max(1, level[key] + delta) }) } : level,
    ));
  };

  const toggleCell = (levelIndex: number, row: number, column: number) => {
    setLevels((current) => current.map((level, currentIndex) => {
      if (currentIndex !== levelIndex) return level;
      const active = activeGridCells(level);
      const exists = active.some((cell) => cell.row === row && cell.column === column);
      return { ...level, activeCells: exists ? active.filter((cell) => cell.row !== row || cell.column !== column) : [...active, { row, column }] };
    }));
  };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await updateCustomSystemLayout(garden.id, levels);
      toast.success(ui(language, "layoutUpdated"));
    } catch (error) {
      toast.error(localizeKnownError(error, language, ui(language, "layoutUpdateFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 border-t border-border/70 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{ui(language, "systemLayout")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ui(language, "rearrangeLayout")}</p>
        </div>
        <span className="numeral shrink-0 text-xs text-muted-foreground">{expectedTotal} {ui(language, "positions").toLowerCase()}</span>
      </div>
      <div className="mt-3 grid gap-3">
        {levels.map((level, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-secondary/35 p-3">
            <p className="text-sm font-medium">{ui(language, "level")} {index + 1}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(["rows", "columns"] as const).map((key) => (
                <div key={key} className="rounded-xl bg-background p-2.5 text-center">
                  <p className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">{ui(language, key)}</p>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => changeLevel(index, key, -1)} disabled={level[key] <= 1 || saving}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="numeral w-5 text-sm">{level[key]}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => changeLevel(index, key, 1)} disabled={(key === "rows" ? level.rows >= 9 : level.columns >= 8) || saving}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{level.rows} {ui(language, "rows").toLowerCase()} × {level.columns} {ui(language, "columns").toLowerCase()} · {activeGridCells(level).length} {ui(language, "activePositions")}</p>
          </div>
        ))}
      </div>
      <SystemPreview language={language} positions={positions} levels={levels} interactive onToggleCell={toggleCell} />
      {!valid ? <p className="mt-2 text-xs text-clay">{ui(language, "keepSamePositions")} ({expectedTotal}) {ui(language, "toSave")}</p> : null}
      <Button type="button" className="mt-3 w-full rounded-full" onClick={() => void save()} disabled={!valid || saving}>
        {saving ? ui(language, "savingLayout") : ui(language, "saveLayout")}
      </Button>
    </div>
  );
}
