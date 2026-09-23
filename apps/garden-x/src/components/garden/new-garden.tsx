import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { covers } from "@/lib/garden-data";
import type { GardenKind } from "@/lib/garden-data";
import { gardenSetups, setupById } from "@/lib/garden-systems";
import { useGarden } from "@/lib/garden-store";
import { setupCopy, ui } from "@/lib/ui-copy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomSystemBuilder } from "@/components/garden/custom-system-builder";
import { cn } from "@/lib/utils";

const coverChoices: { id: string; label: string; src: string }[] = [
  { id: "indoor", label: "Indoor", src: covers.gardenIndoor },
  { id: "balcony", label: "Balcony", src: covers.gardenBalcony },
  { id: "backyard", label: "Backyard", src: covers.gardenBackyard },
];

const defaultCover = (kind: GardenKind) =>
  kind === "backyard" ? covers.gardenBackyard : kind === "balcony" ? covers.gardenBalcony : covers.gardenIndoor;

export function NewGarden() {
  const { addGarden, language } = useGarden();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [setupId, setSetupId] = useState<string | null>(null);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const setup = setupId ? setupById(setupId) : undefined;

  const start = () => {
    setStep(0);
    setName("");
    setPlace("");
    setSetupId(null);
    setCoverId(null);
    setOpen(true);
  };

  const create = () => {
    const kind = setup?.kind ?? "indoor";
    const machine = setup?.system;
    const id = addGarden({
      name: name.trim() || ui(language, "newGardenDefault"),
      kind,
      cover: coverChoices.find((choice) => choice.id === coverId)?.src ?? defaultCover(kind),
      place: place.trim(),
      note: setup?.hint ?? ui(language, "setupStillCompleting"),
      ...(machine && { machine }),
    });
    setOpen(false);
    toast.success(ui(language, "gardenCreatedMessage"));
    void navigate({ to: "/gardens/$gardenId", params: { gardenId: id }, search: { view: "overview" } });
  };

  return (
    <>
      <Button type="button" size="sm" onClick={start} className="rounded-full">
        <Plus /> {ui(language, "newGarden")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] min-w-0 max-w-lg rounded-3xl p-4 [&>*]:min-w-0 sm:max-h-[88vh] sm:w-full sm:p-6">
          <DialogHeader className="min-w-0 text-left">
            <div className="flex items-center gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  aria-label={ui(language, "back")}
                  onClick={() => setStep((current) => current - 1)}
                  className="press grid h-7 w-7 place-items-center rounded-full bg-secondary text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <p className="eyebrow">{ui(language, "newGarden")}</p>
            </div>
            <DialogTitle className="font-display text-2xl font-medium">
              {step === 0 ? ui(language, "newGardenNameQuestion") : step === 1 ? ui(language, "newGardenSetupQuestion") : ui(language, "newGardenCoverQuestion")}
            </DialogTitle>
            <DialogDescription>
              {step === 0 ? ui(language, "newGardenNameHint") : step === 1 ? ui(language, "newGardenSetupHint") : ui(language, "newGardenCoverHint")}
            </DialogDescription>
          </DialogHeader>

          {step === 0 ? (
            <div className="grid min-w-0 gap-4">
              <label className="min-w-0 text-sm">
                <span className="mb-2 block text-muted-foreground">{ui(language, "gardenName")}</span>
                <input
                  className="input-soft min-w-0"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={ui(language, "gardenNamePlaceholder")}
                  autoFocus
                />
              </label>
              <label className="min-w-0 text-sm">
                <span className="mb-2 block text-muted-foreground">{ui(language, "locationOptional")}</span>
                <input
                  className="input-soft min-w-0"
                  value={place}
                  onChange={(event) => setPlace(event.target.value)}
                  placeholder={ui(language, "locationPlaceholder")}
                />
              </label>
              <Button className="rounded-full" disabled={!name.trim()} onClick={() => setStep(1)}>
                {ui(language, "continueAction")}
              </Button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid min-w-0 gap-2">
              {gardenSetups.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => {
                    if (choice.id === "custom") {
                      setOpen(false);
                      setCustomOpen(true);
                      return;
                    }
                    setSetupId(choice.id);
                  }}
                  className={cn(
                    "press grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border bg-background px-4 py-3.5 text-left",
                    setupId === choice.id ? "border-primary" : "border-border/60",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{setupCopy(language, choice.id as Parameters<typeof setupCopy>[1], "label")}</span>
                    <span className="block truncate text-xs text-muted-foreground">{setupCopy(language, choice.id as Parameters<typeof setupCopy>[1], "hint")}</span>
                  </span>
                  {setupId === choice.id ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              ))}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Button variant="outline" className="rounded-full" onClick={create}>
                  {ui(language, "createGarden")}
                </Button>
                <Button className="rounded-full" disabled={!setupId} onClick={() => setStep(2)}>
                  {ui(language, "continueAction")}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="min-w-0">
              <div className="no-scrollbar flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
                {coverChoices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setCoverId(choice.id)}
                    className={cn(
                      "press relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 p-1",
                      coverId === choice.id ? "border-primary" : "border-transparent",
                    )}
                  >
                    <img src={choice.src} alt={choice.id === "indoor" ? ui(language, "coverIndoor") : choice.id === "balcony" ? ui(language, "coverBalcony") : ui(language, "coverBackyard")} className="h-full w-full rounded-xl object-cover" />
                  </button>
                ))}
              </div>
              <Button className="mt-4 w-full rounded-full" onClick={create}>
                {ui(language, "createGarden")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <CustomSystemBuilder open={customOpen} onOpenChange={setCustomOpen} />
    </>
  );
}
