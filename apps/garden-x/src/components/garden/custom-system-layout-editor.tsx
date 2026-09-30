import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Garden } from "@/lib/garden-data";
import { allGridCells, canCreateCustomSystem, customSystemPositionCount, maxCustomSystemPositions, type CustomSystemLevel } from "@/lib/custom-system";
import { useGarden } from "@/lib/garden-store";
import { localizeKnownError, ui } from "@/lib/ui-copy";
import { Button } from "@/components/ui/button";
import { SystemLayoutConfigurator } from "@/components/garden/system-layout-configurator";

export function CustomSystemLayoutEditor({ garden }: { garden: Garden }) {
  const { updateCustomSystemLayout, language } = useGarden();
  const initial = (garden.systemLayoutLevels ?? []).map(({ rows, columns, activeCells }) => ({ rows, columns, activeCells: activeCells?.length ? activeCells : allGridCells({ rows, columns }) }));
  const [levels, setLevels] = useState<CustomSystemLevel[]>(initial);
  const [positionCapacity, setPositionCapacity] = useState(garden.backendPositions?.length ?? garden.machine?.pods ?? 1);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setLevels(initial);
    setPositionCapacity(garden.backendPositions?.length ?? garden.machine?.pods ?? 1);
  }, [garden.id, garden.systemLayoutLevels]);
  const total = customSystemPositionCount(levels);
  const currentTotal = garden.backendPositions?.length ?? total;
  const canEditCapacity = garden.gardenpediaModelId == null;
  const expectedTotal = canEditCapacity ? positionCapacity : currentTotal;
  const valid = canCreateCustomSystem(levels) && total === expectedTotal;

  if (!garden.systemLayoutLevels?.length) return null;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await updateCustomSystemLayout(garden.id, levels, canEditCapacity ? expectedTotal : undefined);
      toast.success(ui(language, "layoutUpdated"));
    } catch (error) {
      toast.error(localizeKnownError(error, language, ui(language, "layoutUpdateFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 border-t border-border/70 pt-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{ui(language, "systemLayout")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ui(language, canEditCapacity ? "rearrangeLayout" : "rearrangeLayoutFixed")}</p>
        </div>
        {canEditCapacity ? (
          <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span>{ui(language, "capacity")}</span>
            <input
              aria-label={ui(language, "capacity")}
              type="number"
              min={1}
              max={maxCustomSystemPositions}
              inputMode="numeric"
              className="input-soft h-9 w-20 min-w-0 px-2 text-center numeral"
              value={positionCapacity}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) setPositionCapacity(Math.max(1, Math.min(maxCustomSystemPositions, Math.floor(next))));
              }}
            />
          </label>
        ) : (
          <span className="numeral shrink-0 text-xs text-muted-foreground">{currentTotal} {ui(language, "positions").toLowerCase()}</span>
        )}
      </div>
      <SystemLayoutConfigurator levels={levels} onChange={setLevels} language={language} requiredPositionCount={expectedTotal} capacityIsEditable={canEditCapacity} />
      <Button type="button" className="mt-3 w-full rounded-full" onClick={() => void save()} disabled={!valid || saving}>
        {saving ? ui(language, "savingLayout") : ui(language, "saveLayout")}
      </Button>
    </div>
  );
}
