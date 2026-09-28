import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Garden } from "@/lib/garden-data";
import { allGridCells, canCreateCustomSystem, customSystemPositionCount, type CustomSystemLevel } from "@/lib/custom-system";
import { useGarden } from "@/lib/garden-store";
import { localizeKnownError, ui } from "@/lib/ui-copy";
import { Button } from "@/components/ui/button";
import { SystemLayoutConfigurator } from "@/components/garden/system-layout-configurator";

export function CustomSystemLayoutEditor({ garden }: { garden: Garden }) {
  const { updateCustomSystemLayout, language } = useGarden();
  const initial = (garden.systemLayoutLevels ?? []).map(({ rows, columns, activeCells }) => ({ rows, columns, activeCells: activeCells?.length ? activeCells : allGridCells({ rows, columns }) }));
  const [levels, setLevels] = useState<CustomSystemLevel[]>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setLevels(initial);
  }, [garden.id, garden.systemLayoutLevels]);
  const total = customSystemPositionCount(levels);
  const expectedTotal = garden.backendPositions?.length ?? total;
  const valid = canCreateCustomSystem(levels) && total === expectedTotal;

  if (!garden.systemLayoutLevels?.length) return null;

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
      <SystemLayoutConfigurator levels={levels} onChange={setLevels} language={language} requiredPositionCount={expectedTotal} />
      {!valid ? <p className="mt-2 text-xs text-clay">{ui(language, "keepSamePositions")} ({expectedTotal}) {ui(language, "toSave")}</p> : null}
      <Button type="button" className="mt-3 w-full rounded-full" onClick={() => void save()} disabled={!valid || saving}>
        {saving ? ui(language, "savingLayout") : ui(language, "saveLayout")}
      </Button>
    </div>
  );
}
