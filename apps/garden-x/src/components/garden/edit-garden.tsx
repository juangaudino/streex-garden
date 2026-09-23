import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Garden, Photo, Plant } from "@/lib/garden-data";
import { useGarden } from "@/lib/garden-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PhotoImage } from "@/components/garden/photo-image";
import { localizeKnownError, ui } from "@/lib/ui-copy";
import { normalizePhotoDataUrl } from "@/lib/photo-input";
import { CustomSystemLayoutEditor } from "@/components/garden/custom-system-layout-editor";
import { PhotoSourcePicker } from "@/components/garden/photo-source-picker";
import { gardenCoverChoices } from "@/lib/garden-logic";

export function EditGarden({ garden, plants, photos, className }: { garden: Garden; plants: Plant[]; photos: Photo[]; className?: string }) {
  const { updateGarden, updatePlant, deleteGarden, language, loadGardenCoverPhotos, setGardenCoverPhoto, uploadGardenCoverPhoto } = useGarden();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(garden.name);
  const [place, setPlace] = useState(garden.place);
  const [note, setNote] = useState(garden.note);
  const [machineName, setMachineName] = useState(garden.machine?.name ?? "");
  const [pods, setPods] = useState(garden.machine?.pods ?? 6);
  const [coverPhotoId, setCoverPhotoId] = useState(garden.coverPhotoId ?? "auto");
  const [gardenCoverPhotos, setGardenCoverPhotos] = useState<Photo[]>([]);
  const [pendingCover, setPendingCover] = useState<{ src: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [personalName, setPersonalName] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const plantIds = useMemo(() => new Set(plants.map((plant) => plant.id)), [plants]);
  const choices = useMemo(() => photos.filter((photo) => plantIds.has(photo.plantId)).sort((a, b) => a.daysAgo - b.daysAgo), [photos, plantIds]);
  const coverChoices = useMemo(() => gardenCoverChoices(gardenCoverPhotos, choices), [choices, gardenCoverPhotos]);

  useEffect(() => {
    if (!open) return;
    setName(garden.name); setPlace(garden.place); setNote(garden.note);
    setMachineName(garden.machine?.name ?? ""); setPods(garden.machine?.pods ?? 6);
    setCoverPhotoId(garden.coverPhotoId ?? "auto");
    setPendingCover(null);
    void loadGardenCoverPhotos(garden.id).then(setGardenCoverPhotos).catch(() => setGardenCoverPhotos([]));
    setSelectedPlantId(null); setPersonalName(""); setConfirmName("");
  }, [open, garden]);

  const readCoverFile = (file: File) => {
    const reader = new FileReader();
    reader.onerror = () => toast.error(ui(language, "photoCouldNotRead"));
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setPendingCover({ src: normalizePhotoDataUrl(reader.result, file), name: file.name });
      setCoverPhotoId("new");
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const machine = machineName.trim() ? { name: machineName.trim(), pods: Math.max(1, Math.min(24, pods)) } : undefined;
    updateGarden(garden.id, {
      name: name.trim() || garden.name,
      place: place.trim(),
      note: note.trim(),
      ...(machine !== undefined && { machine }),
    });
    try {
      if (garden.backendSystemInstanceId) {
        const nextCoverId = pendingCover
          ? await uploadGardenCoverPhoto(garden.id, pendingCover.src, pendingCover.name)
          : coverPhotoId === "auto"
            ? null
            : coverPhotoId;
        if (!pendingCover) await setGardenCoverPhoto(garden.id, nextCoverId);
        updateGarden(garden.id, { coverPhotoId: nextCoverId });
      } else {
        updateGarden(garden.id, { coverPhotoId: coverPhotoId === "auto" ? null : coverPhotoId });
      }
      setOpen(false);
      toast.success(ui(language, "gardenUpdated"));
    } catch (error) {
      toast.error(localizeKnownError(error, language, ui(language, "gardenUpdateFailed")));
    } finally {
      setSaving(false);
    }
  };

  const selectedPlant = plants.find((plant) => plant.id === selectedPlantId);

  const savePlantName = () => {
    if (!selectedPlant || !personalName.trim()) return;
    updatePlant(selectedPlant.id, { name: personalName.trim() });
    setSelectedPlantId(null);
    setPersonalName("");
    toast.success(ui(language, "personalNameUpdated"));
  };

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className={cn("rounded-full bg-card/15 text-primary-foreground ring-1 ring-card/25 backdrop-blur-md hover:bg-card/25 hover:text-primary-foreground", className)}>
        <Settings2 /> {ui(language, "editGarden")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="box-border max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] min-w-0 max-w-[calc(100vw-1rem)] rounded-3xl p-4 [&>*]:min-w-0 sm:max-h-[88vh] sm:w-full sm:max-w-3xl sm:p-6 lg:max-w-5xl">
          <DialogHeader className="min-w-0 text-left">
            <p className="eyebrow">{ui(language, "gardenSettings")}</p>
          <DialogTitle className="font-display text-2xl font-medium">{ui(language, "makeGardenYours")}</DialogTitle>
          <DialogDescription>{ui(language, "editGardenDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-x-6">
            <label className="min-w-0 text-sm"><span className="mb-2 block text-muted-foreground">{ui(language, "gardenName")}</span><input className="input-soft min-w-0" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="min-w-0 text-sm"><span className="mb-2 block text-muted-foreground">{ui(language, "location")}</span><input className="input-soft min-w-0" value={place} onChange={(event) => setPlace(event.target.value)} /></label>
            <label className="min-w-0 text-sm"><span className="mb-2 block text-muted-foreground">{ui(language, "growingSetup")}</span><textarea className="input-soft min-h-20 min-w-0 resize-none" value={note} onChange={(event) => setNote(event.target.value)} /></label>
            {garden.machine ? <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(4.5rem,5.5rem)]"><label className="min-w-0 text-sm"><span className="mb-2 block text-muted-foreground">{ui(language, "system")}</span><input className="input-soft min-w-0" value={machineName} onChange={(event) => setMachineName(event.target.value)} /></label><label className="min-w-0 text-sm"><span className="mb-2 block text-muted-foreground">{ui(language, "positions")}</span><input type="number" min={1} max={24} className="input-soft min-w-0 px-3" value={pods} onChange={(event) => setPods(Number(event.target.value))} /></label></div> : null}
          </div>
          <div className="min-w-0 max-w-full lg:col-span-2 lg:rounded-2xl lg:border lg:border-border/70 lg:bg-secondary/20 lg:p-4">
            <p className="text-sm font-medium">{ui(language, "gardenCover")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ui(language, "automaticCoverDescription")}</p>
            <div className="mt-3 grid w-full min-w-0 max-w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Button type="button" variant="ghost" onClick={() => { setPendingCover(null); setCoverPhotoId("auto"); }} className={cn("h-24 w-24 shrink-0 rounded-2xl border text-xs", coverPhotoId === "auto" ? "border-primary bg-accent" : "border-border")}><span>{ui(language, "automatic")}</span>{coverPhotoId === "auto" ? <Check /> : null}</Button>
              {coverChoices.map((photo) => <Button type="button" key={photo.id} variant="ghost" onClick={() => { setPendingCover(null); setCoverPhotoId(photo.id); }} className={cn("relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 p-1", coverPhotoId === photo.id ? "border-primary" : "border-transparent")}><PhotoImage photo={photo} alt={photo.caption} rendition="preview" className="h-full w-full rounded-xl object-cover" />{coverPhotoId === photo.id ? <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-card text-primary"><Check className="h-3 w-3" /></span> : null}</Button>)}
              {pendingCover ? <Button type="button" variant="ghost" onClick={() => setCoverPhotoId("new")} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-primary p-1"><img src={pendingCover.src} alt={ui(language, "newGardenCoverPhoto")} className="h-full w-full rounded-xl object-cover" /><span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-card text-primary"><Check className="h-3 w-3" /></span></Button> : null}
            </div>
            <PhotoSourcePicker language={language} onFile={readCoverFile} className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 p-3" />
          </div>
          <CustomSystemLayoutEditor garden={garden} />
          <div className="min-w-0 border-t border-border/70 pt-5">
            <p className="text-sm font-medium">{ui(language, "plants")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ui(language, "editPlantNamesDescription")}</p>
            <div className="mt-3 grid min-w-0 gap-1">
              {plants.map((plant) => {
                const plantPhoto = photos.filter((photo) => photo.plantId === plant.id).sort((a, b) => a.daysAgo - b.daysAgo)[0];
                const editing = selectedPlantId === plant.id;
                return <div key={plant.id} className="min-w-0 rounded-2xl border border-border/70 bg-card p-2.5">
                  <Button type="button" variant="ghost" onClick={() => { setSelectedPlantId(editing ? null : plant.id); setPersonalName(plant.name); }} className="grid h-auto w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-1 text-left">
                    {plantPhoto ? <PhotoImage photo={plantPhoto} alt="" rendition="preview" className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <span className="h-11 w-11 shrink-0 rounded-xl bg-secondary" />}
                    <span className="min-w-0"><span className="block truncate font-medium">{plant.name}</span><span className="block truncate text-xs font-normal text-muted-foreground">{plant.species} · <span className="italic">{plant.scientific}</span></span></span>
                    <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", editing && "rotate-90")} />
                  </Button>
                  {editing ? <div className="grid min-w-0 gap-2 px-1 pb-1 pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input aria-label={`${ui(language, "personalNameFor")} ${plant.name}`} className="input-soft min-w-0" value={personalName} onChange={(event) => setPersonalName(event.target.value)} maxLength={32} autoFocus />
                    <Button type="button" className="rounded-full" onClick={savePlantName} disabled={!personalName.trim()}>{ui(language, "saveName")}</Button>
                  </div> : null}
                </div>;
              })}
            </div>
          </div>
          <div className="min-w-0 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">{ui(language, "dangerZone")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ui(language, "deleteGardenWarning")}</p>
              <label className="mt-3 block min-w-0 text-sm">
                <span className="mb-2 block text-muted-foreground">
                  {ui(language, "typeNameToConfirm")}: <span className="font-medium text-foreground">{garden.name}</span>
                </span>
                <input
                  className="input-soft min-w-0"
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                  placeholder={garden.name}
                />
              </label>
              <Button
                type="button"
                variant="destructive"
                className="mt-3 rounded-full"
                disabled={confirmName.trim() !== garden.name}
                onClick={() => {
                  void deleteGarden(garden.id)
                    .then((result) => {
                      setOpen(false);
                      toast.success(`${garden.name} · ${ui(language, "gardenDeleted")}`);
                      if (result.storageCleanupWarning) toast.warning(localizeKnownError(new Error(result.storageCleanupWarning), language, ui(language, "photoStorageWarning")));
                    })
                    .catch((error: unknown) => toast.error(localizeKnownError(error, language, ui(language, "gardenDeleteFailed"))));
                }}
              >
                <Trash2 /> {ui(language, "deletePermanently")}
              </Button>
          </div>
          <Button className="rounded-full" onClick={() => void save()} disabled={saving}>{ui(language, "saveGarden")}</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
