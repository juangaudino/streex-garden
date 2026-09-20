import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ImagePlus, Layers, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  allGridCells,
  activeGridCells,
  canCreateCustomSystem,
  customSystemPositionCount,
  customSystemPositions,
  maxCustomSystemLevels,
  maxCustomSystemPositions,
  type CustomSystemLevel,
} from "@/lib/custom-system";
import { useGarden } from "@/lib/garden-store";
import { localizeKnownError, ui } from "@/lib/ui-copy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const initialLevels: CustomSystemLevel[] = [{ rows: 2, columns: 3, activeCells: allGridCells({ rows: 2, columns: 3 }) }];

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("PHOTO_READ_ERROR"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function CustomSystemBuilder({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const store = useGarden();
  const language = store.language;
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [levels, setLevels] = useState<CustomSystemLevel[]>(initialLevels);
  const [creating, setCreating] = useState(false);
  const total = customSystemPositionCount(levels);
  const positions = useMemo(() => customSystemPositions(levels), [levels]);
  const valid = Boolean(name.trim()) && canCreateCustomSystem(levels);

  const reset = () => {
    setStep(0);
    setName("");
    setPhoto(null);
    setLevels(initialLevels);
    setCreating(false);
  };
  const close = (nextOpen: boolean) => {
    if (!nextOpen && !creating) reset();
    onOpenChange(nextOpen);
  };
  const changeLevel = (index: number, key: "rows" | "columns", delta: number) => {
    setLevels((current) => current.map((level, currentIndex) => {
      if (currentIndex !== index) return level;
      const next = { ...level, [key]: Math.max(1, level[key] + delta) };
      return { ...next, activeCells: activeGridCells(next) };
    }));
  };
  const addLevel = () => {
    if (levels.length >= maxCustomSystemLevels || total + 1 > maxCustomSystemPositions) return;
    setLevels((current) => [...current, { rows: 1, columns: 1, activeCells: [{ row: 1, column: 1 }] }]);
  };
  const create = async () => {
    if (!valid || creating) return;
    setCreating(true);
    try {
      const result = await store.createCustomSystem({ name: name.trim(), levels, photoDataUrl: photo });
      toast.success(ui(language, "systemReadyAddPlant"));
      if (result.photoWarning) toast.warning(localizeKnownError(new Error(result.photoWarning), language, ui(language, "photoStorageWarning")));
      close(false);
      await navigate({ to: "/gardens/$gardenId", params: { gardenId: result.gardenId }, search: { view: "map" } });
    } catch (error) {
      toast.error(localizeKnownError(error, language, ui(language, "layoutUpdateFailed")));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] min-w-0 max-w-lg overflow-x-hidden overflow-y-auto rounded-3xl p-4 sm:max-h-[88vh] sm:w-full sm:p-6">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button type="button" aria-label={ui(language, "back")} onClick={() => setStep((current) => current - 1)} className="press grid h-7 w-7 place-items-center rounded-full bg-secondary text-muted-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            ) : <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-primary"><Layers className="h-3.5 w-3.5" /></span>}
            <p className="eyebrow">{ui(language, "customSystem")}</p>
          </div>
          <DialogTitle className="font-display text-2xl font-medium">
            {step === 0 ? ui(language, "aboutSystem") : step === 1 ? ui(language, "buildLayout") : ui(language, "reviewSystem")}
          </DialogTitle>
          <DialogDescription>
            {step === 0 ? ui(language, "customSystemDescription") : step === 1 ? ui(language, "buildLayoutDescription") : ui(language, "reviewSystemDescription")}
          </DialogDescription>
        </DialogHeader>

        {step === 0 ? (
          <div className="grid gap-4">
            <label className="text-sm"><span className="mb-2 block text-muted-foreground">{ui(language, "systemName")}</span>
              <input className="input-soft" value={name} onChange={(event) => setName(event.target.value)} placeholder={ui(language, "systemNamePlaceholder")} autoFocus />
            </label>
            <label className="press grid cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/35 p-4 text-center">
              {photo ? <img src={photo} alt={ui(language, "systemPhoto")} className="h-28 w-full rounded-xl object-cover" /> : <><ImagePlus className="h-5 w-5 text-primary" /><span className="mt-2 text-sm">{ui(language, "systemPhoto")}</span><span className="mt-1 text-xs text-muted-foreground">{ui(language, "optional")}</span></>}
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file).then(setPhoto).catch((error: unknown) => toast.error(localizeKnownError(error, language, ui(language, "photoCouldNotRead"))));
              }} />
            </label>
            {photo ? <Button variant="ghost" size="sm" className="justify-self-start rounded-full" onClick={() => setPhoto(null)}>{ui(language, "remove")} {ui(language, "photo").toLowerCase()}</Button> : null}
            <Button className="rounded-full" disabled={!name.trim()} onClick={() => setStep(1)}>{ui(language, "continueAction")}</Button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4">
            <div className="grid gap-3">
              {levels.map((level, index) => (
                <div key={index} className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{ui(language, "level")} {index + 1}</p>{levels.length > 1 ? <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setLevels((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{ui(language, "remove")}</Button> : null}</div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {(["rows", "columns"] as const).map((key) => <div key={key} className="rounded-xl bg-background p-2.5 text-center">
                      <p className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">{ui(language, key)}</p>
                      <div className="mt-2 flex items-center justify-center gap-3"><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => changeLevel(index, key, -1)} disabled={level[key] <= 1}><Minus className="h-3.5 w-3.5" /></Button><span className="numeral w-5 text-sm">{level[key]}</span><Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => changeLevel(index, key, 1)} disabled={key === "rows" ? level.rows >= 9 : level.columns >= 8}><Plus className="h-3.5 w-3.5" /></Button></div>
                    </div>)}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{level.rows} {ui(language, "rows").toLowerCase()} × {level.columns} {ui(language, "columns").toLowerCase()} · {activeGridCells(level).length} {ui(language, "activePositions")}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" className="rounded-full" disabled={levels.length >= maxCustomSystemLevels || total >= maxCustomSystemPositions} onClick={addLevel}><Plus /> {ui(language, "addLevel")}</Button>
            <SystemPreview language={language} positions={positions} levels={levels} interactive onToggleCell={(levelIndex, row, column) => setLevels((current) => current.map((level, currentIndex) => {
              if (currentIndex !== levelIndex) return level;
              const active = activeGridCells(level);
              const exists = active.some((cell) => cell.row === row && cell.column === column);
              const nextCells = exists ? active.filter((cell) => cell.row !== row || cell.column !== column) : [...active, { row, column }];
              return { ...level, activeCells: nextCells };
            }))} />
            {total > maxCustomSystemPositions ? <p className="text-sm text-clay">{ui(language, "maxPositions")}</p> : null}
            <Button className="rounded-full" disabled={!canCreateCustomSystem(levels)} onClick={() => setStep(2)}>{ui(language, "reviewLayout")}</Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4">
            <div className="surface p-4"><p className="text-sm font-medium">{name}</p><p className="mt-1 text-sm text-muted-foreground">{levels.length} {ui(language, "level").toLowerCase()}{levels.length === 1 ? "" : language === "es" ? "es" : "s"} · {total} {ui(language, "positionCount")}</p>{photo ? <img src={photo} alt={ui(language, "systemPhoto")} className="mt-3 h-28 w-full rounded-xl object-cover" /> : null}</div>
            <div className="grid gap-2">{levels.map((level, index) => <div key={index} className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2.5 text-sm"><span>{ui(language, "level")} {index + 1}</span><span className="text-muted-foreground">{level.rows} × {level.columns} · {activeGridCells(level).length} {ui(language, "activePositions")}</span></div>)}</div>
            <SystemPreview language={language} positions={positions} levels={levels} />
            <Button className="rounded-full" disabled={!valid || creating} onClick={create}>{creating ? ui(language, "creatingSystem") : <><Check /> {ui(language, "createSystem")}</>}</Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function SystemPreview({ positions, levels, interactive = false, onToggleCell, language = "en" }: { positions: ReturnType<typeof customSystemPositions>; levels: CustomSystemLevel[]; interactive?: boolean; onToggleCell?: (levelIndex: number, row: number, column: number) => void; language?: "en" | "es" }) {
  return <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{ui(language, "layoutPreview")}</p><span className="numeral text-xs text-muted-foreground">{positions.length} {ui(language, "positionCount")}</span></div><div className="mt-3 grid gap-4">{levels.map((level, index) => { const byCell = new Map(positions.filter((position) => position.level === index + 1).map((position) => [`${position.row}:${position.column}`, position])); return <div key={index}><p className="eyebrow mb-2">{ui(language, "level")} {index + 1}</p><div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${level.columns}, minmax(0, 1fr))` }}>{allGridCells(level).map((cell) => { const position = byCell.get(`${cell.row}:${cell.column}`); const cellClass = position ? "border-border bg-background text-foreground" : "border-dashed border-border/60 bg-background/30 text-muted-foreground/40"; return interactive ? <button key={`${cell.row}:${cell.column}`} type="button" aria-label={position ? `${ui(language, "positionLabel")} ${position.number}, ${ui(language, "activePositions")}` : `${ui(language, "positionLabel")} ${cell.row}:${cell.column}, ${ui(language, "inactivePosition").toLowerCase()}`} aria-pressed={Boolean(position)} onClick={() => onToggleCell?.(index, cell.row, cell.column)} className={`grid aspect-square place-items-center rounded-lg border text-xs numeral transition-colors ${cellClass}`}>{position?.number ?? "·"}</button> : <span key={`${cell.row}:${cell.column}`} className={`grid aspect-square place-items-center rounded-lg border text-xs numeral ${cellClass}`}>{position?.number ?? "·"}</span>; })}</div></div>; })}</div></div>;
}
