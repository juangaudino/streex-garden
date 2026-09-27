import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { PlantOriginType } from "@/lib/garden-data";
import { originType, PLANT_ORIGINS } from "@/lib/plant-life";
import { useGarden } from "@/lib/garden-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ui, type UiCopyKey } from "@/lib/ui-copy";

const selectableOrigins = PLANT_ORIGINS.filter(
  (value): value is Exclude<PlantOriginType, "unknown"> => value !== "unknown",
);

export function PlantOriginEditor({
  origin,
  plantId,
}: {
  origin: PlantOriginType | undefined;
  plantId: string;
}) {
  const { language, updatePlantOrigin } = useGarden();
  const currentOrigin = originType(origin);
  const [open, setOpen] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState<PlantOriginType>(currentOrigin);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setSelectedOrigin(currentOrigin);
      setSaveFailed(false);
    }
    setOpen(nextOpen);
  };

  const saveOrigin = async () => {
    if (
      selectedOrigin === "unknown" ||
      selectedOrigin === currentOrigin ||
      !selectableOrigins.includes(selectedOrigin)
    ) {
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    try {
      await updatePlantOrigin(plantId, selectedOrigin);
      setOpen(false);
    } catch {
      // The store updates the canonical projection only after the owner-scoped
      // RPC succeeds, so the existing hero value remains visible on failure.
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        aria-label={ui(language, "editPlantOrigin")}
        className="press -mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-inherit underline decoration-dotted underline-offset-4 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <span>{ui(language, `plantOrigin_${currentOrigin}` as UiCopyKey)}</span>
        <ChevronDown className="h-3 w-3 opacity-80" aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="rounded-3xl border-border/70 p-5 shadow-lift sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="font-display text-2xl font-medium">
              {ui(language, currentOrigin === "unknown" ? "resolvePlantOrigin" : "correctPlantOrigin")}
            </DialogTitle>
            <DialogDescription>{ui(language, "plantOriginEditorDescription")}</DialogDescription>
          </DialogHeader>

          <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            {ui(language, "currentPlantOrigin")}: {ui(language, `plantOrigin_${currentOrigin}` as UiCopyKey)}
          </p>

          <RadioGroup
            value={selectedOrigin === "unknown" ? "" : selectedOrigin}
            onValueChange={(value) => setSelectedOrigin(originType(value))}
            aria-label={ui(language, "choosePlantOrigin")}
            className="gap-2"
          >
            {selectableOrigins.map((value) => {
              const inputId = `plant-origin-${plantId}-${value}`;
              const selected = selectedOrigin === value;
              return (
                <div
                  key={value}
                  className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 transition-colors ${
                    selected
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/70 bg-card hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem id={inputId} value={value} />
                  <label htmlFor={inputId} className="flex min-h-12 flex-1 cursor-pointer items-center justify-between gap-3 py-2 text-sm font-medium">
                    <span>{ui(language, `plantOrigin_${value}` as UiCopyKey)}</span>
                    {selected ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
                  </label>
                </div>
              );
            })}
          </RadioGroup>

          {saveFailed ? (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {ui(language, "plantOriginSaveFailed")}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={saving} onClick={() => handleOpenChange(false)}>
              {ui(language, "cancel")}
            </Button>
            <Button
              type="button"
              disabled={saving || selectedOrigin === "unknown" || selectedOrigin === currentOrigin}
              onClick={() => void saveOrigin()}
            >
              {ui(language, saving ? "saving" : "savePlantOrigin")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
