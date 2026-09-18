import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  CalendarClock,
  History,
  Move,
  Sprout,
  StickyNote,
  X,
  Leaf,
  CircleDot,
  Repeat,
  Sparkles,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import { formatDate, maintenanceLabels, plantPhotos } from "@/lib/garden-logic";
import type { EventType, MaintenanceType, Plant } from "@/lib/garden-data";
import { maintenanceIcons, ProvenanceTag } from "@/components/garden/atoms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MomentFlow =
  | "observation"
  | "care"
  | "followup"
  | "planting"
  | "move"
  | "close"
  | "replace"
  | "other";

interface FlowMeta {
  key: MomentFlow;
  label: string;
  hint: string;
  icon: typeof Leaf;
}

const flows: FlowMeta[] = [
  { key: "observation", label: "Add an observation", hint: "A note, with a photo if you have one", icon: StickyNote },
  { key: "care", label: "Record care or something I did", hint: "Water, feed, prune, harvest, and more", icon: Leaf },
  { key: "followup", label: "Schedule a follow-up", hint: "Decide what to review, and when", icon: CalendarClock },
  { key: "planting", label: "Correct planting information", hint: "Fix a setup record that was wrong", icon: History },
  { key: "move", label: "Move / relocate", hint: "New garden, system, pod or position", icon: Move },
  { key: "close", label: "Close cycle", hint: "End this cycle, keep the whole history", icon: CircleDot },
  { key: "replace", label: "Replace / reseed", hint: "Start a new record, keep the old story", icon: Repeat },
  { key: "other", label: "Record another state or action", hint: "Anything else worth remembering", icon: Sparkles },
];

const careTypes: MaintenanceType[] = [
  "watering",
  "nutrients",
  "pruning",
  "harvest",
  "thinning",
  "transplant",
  "cleaning",
  "pest",
  "light",
  "custom",
];

const otherStates: { type: EventType; label: string }[] = [
  { type: "germinated", label: "Germinated" },
  { type: "flowering", label: "Flowering" },
  { type: "fruiting", label: "Fruiting" },
  { type: "problem", label: "Problem appeared" },
  { type: "recovery", label: "Recovered" },
  { type: "note", label: "Something else" },
];

const followUps = [
  "Check leaf colour",
  "Check for pests",
  "Water level / reservoir",
  "Nutrient mix",
  "Ready to harvest?",
  "Support and staking",
];

const whenOptions = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "In a week", days: 7 },
  { label: "In two weeks", days: 14 },
];

const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayInputValue = () => dateInputValue(new Date());

const daysAgoFromDate = (value: string) => {
  if (!value) return 0;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return 0;
  const selected = new Date(year, month - 1, day);
  const today = new Date();
  selected.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - selected.getTime()) / 86_400_000));
};

function careEventType(type: MaintenanceType): EventType {
  if (type === "pruning") return "pruning";
  if (type === "harvest") return "harvest";
  if (type === "thinning") return "thinning";
  if (type === "transplant") return "transplant";
  return "maintenance";
}

/** Contextual Care shortcuts — a small, stage-aware subset of the same system. */
export function careShortcuts(plant: Plant): MaintenanceType[] {
  if (plant.gardenId === "garden-indoor") return ["watering", "nutrients", "thinning"];
  if (plant.species.toLowerCase().includes("basil")) return ["harvest", "pruning", "watering"];
  if (plant.status === "recovering") return ["watering", "pest", "cleaning"];
  if (plant.plantedDaysAgo > 120) return ["harvest", "pruning", "nutrients"];
  return ["watering", "nutrients", "pruning"];
}

interface Props {
  plant: Plant;
  open: boolean;
  initialFlow?: MomentFlow | undefined;
  initialCareType?: MaintenanceType | undefined;
  onRecorded?: ((flow: MomentFlow) => void) | undefined;
  onClose: () => void;
}

export function RecordMomentSheet({ plant, open, initialFlow, initialCareType, onRecorded, onClose }: Props) {
  const store = useGarden();
  const [flow, setFlow] = useState<MomentFlow | null>(initialFlow ?? null);
  const [done, setDone] = useState<{ title: string; lines: string[] } | null>(null);

  // form state
  const [note, setNote] = useState("");
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [careType, setCareType] = useState<MaintenanceType>(initialCareType ?? "watering");
  const [subject, setSubject] = useState<string>(followUps[0]!);
  const [when, setWhen] = useState(3);
  const [plantedDays, setPlantedDays] = useState(plant.plantedDaysAgo);
  const [gardenId, setGardenId] = useState(plant.gardenId);
  const [slot, setSlot] = useState(plant.slot ?? "");
  const [closeReason, setCloseReason] = useState("Harvest complete");
  const [newName, setNewName] = useState("");
  const [otherType, setOtherType] = useState<EventType>("flowering");
  const [otherTitle, setOtherTitle] = useState("");
  const [momentDate, setMomentDate] = useState("");

  const photos = useMemo(() => plantPhotos(store.photos, plant.id), [store.photos, plant.id]);

  useEffect(() => {
    if (!open) return;
    setFlow(initialFlow ?? null);
    setDone(null);
    setNote("");
    setPhotoId(null);
    setNewPhoto(null);
    setMomentDate(todayInputValue());
    if (initialCareType) setCareType(initialCareType);
  }, [open, initialFlow, initialCareType]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const finish = (title: string, lines: string[]) => {
    setDone({ title, lines });
    if (flow) onRecorded?.(flow);
    toast.success(`${title} · added to ${plant.name}'s history`);
  };

  const currentFlow = flows.find((f) => f.key === flow);
  const momentDaysAgo = daysAgoFromDate(momentDate);
  const saveNewPhoto = (caption: string) => {
    if (!newPhoto) return null;
    return store.addPhoto({
      plantId: plant.id,
      src: newPhoto,
      daysAgo: momentDaysAgo,
      caption,
      metrics: { heightCm: 0, leafCount: 0, greenness: 0, density: 0 },
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
      />
      <div className="rise relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-card shadow-lift sm:max-w-xl sm:rounded-[2rem]">
        {/* header */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-5 py-4">
          {flow && !done ? (
            <button
              onClick={() => setFlow(null)}
              className="press grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
              <Sprout className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="eyebrow">{plant.name} · day {plant.plantedDaysAgo}</p>
            <p className="truncate font-display text-lg">
              {done ? "Recorded" : (currentFlow?.label ?? "Record a moment")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="press grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* ---------------------------------------- completion */}
          {done ? (
            <div className="rise text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/12 text-primary">
                <Check className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-2xl">{done.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Written into {plant.name}'s timeline. Nothing is ever overwritten.
              </p>
              <ul className="mt-5 space-y-1.5 rounded-3xl border border-border/70 bg-secondary/50 p-4 text-left text-sm text-muted-foreground">
                {done.lines.map((l) => (
                  <li key={l}>· {l}</li>
                ))}
              </ul>
              <div className="mt-4 flex justify-center">
                <ProvenanceTag kind="recorded" />
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  onClick={() => {
                    setDone(null);
                    setFlow(null);
                    setNote("");
                    setPhotoId(null);
                     setNewPhoto(null);
                  }}
                  className="press rounded-full border border-border/70 px-5 py-3 text-sm"
                >
                  Record another moment
                </button>
                <button
                  onClick={onClose}
                  className="press rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground"
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}

          {/* ---------------------------------------- menu */}
          {!done && !flow ? (
            <div className="rise">
              <p className="mb-4 text-sm text-muted-foreground">
                Everything you record here becomes part of this plant's story.
              </p>
              <ul className="grid gap-2">
                {flows.map((f) => (
                  <li key={f.key}>
                    <button
                      onClick={() => setFlow(f.key)}
                      className="press grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5 rounded-2xl border border-border/60 bg-background px-4 py-3.5 text-left hover:border-primary/40"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary">
                        <f.icon className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{f.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{f.hint}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ---------------------------------------- observation */}
          {!done && flow === "observation" ? (
            <div className="rise space-y-4">
              <Field label="What did you notice?">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Lower leaves paler than last week, new growth still tight…"
                  className="input-soft resize-none"
                />
              </Field>
              <PhotoAttachment
                photo={newPhoto}
                onPhoto={(src) => {
                  setNewPhoto(src);
                  if (src) setPhotoId(null);
                }}
              />
              {photos.length ? (
                <Field label="Or use an existing Garden photo">
                  <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {photos.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPhotoId(photoId === p.id ? null : p.id);
                          setNewPhoto(null);
                        }}
                        className={cn(
                          "relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-2 transition",
                          photoId === p.id ? "ring-primary" : "ring-transparent",
                        )}
                      >
                        <img src={p.src} alt={p.caption} loading="lazy" className="h-full w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[0.6rem] text-white">
                          {formatDate(p.daysAgo)}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
              ) : null}
              <MomentDateField value={momentDate} onChange={setMomentDate} />
              <Submit
                disabled={!note.trim()}
                label="Save observation"
                onClick={() => {
                   const attachedPhotoId = saveNewPhoto(note.trim().slice(0, 60) || "Observation photo") ?? photoId;
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: momentDaysAgo,
                     type: attachedPhotoId ? "photo" : "note",
                    title: note.trim().slice(0, 60),
                    detail: note.trim(),
                    provenance: "recorded",
                     ...(attachedPhotoId ? { photoId: attachedPhotoId } : {}),
                  });
                  finish("Observation added", [
                    formatDate(momentDaysAgo),
                    note.trim(),
                     attachedPhotoId ? "One photo attached as evidence" : "No photo attached",
                  ]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- care */}
          {!done && flow === "care" ? (
            <div className="rise space-y-4">
              <Field label="What did you do?">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {careTypes.map((t) => {
                    const Icon = maintenanceIcons[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setCareType(t)}
                        className={cn(
                          "press flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm",
                          careType === t
                            ? "border-primary/60 bg-primary/8 text-foreground"
                            : "border-border/60 bg-background text-muted-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} />
                        <span className="truncate">{maintenanceLabels[t]}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Details (optional)">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="2 litres, half-strength mix…"
                  className="input-soft resize-none"
                />
              </Field>
              <PhotoAttachment photo={newPhoto} onPhoto={setNewPhoto} />
              <MomentDateField value={momentDate} onChange={setMomentDate} />
              <Submit
                label={`Log ${maintenanceLabels[careType].toLowerCase()}`}
                onClick={() => {
                   const attachedPhotoId = saveNewPhoto(`${maintenanceLabels[careType]} · ${plant.name}`);
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: momentDaysAgo,
                    type: careEventType(careType),
                    title: maintenanceLabels[careType],
                    detail: note.trim() || "Recorded from Record a moment.",
                    provenance: "recorded",
                     ...(attachedPhotoId ? { photoId: attachedPhotoId } : {}),
                  });
                  finish(`${maintenanceLabels[careType]} logged`, [
                    formatDate(momentDaysAgo),
                    note.trim() || "No extra detail",
                     attachedPhotoId ? "One photo attached" : "No photo attached",
                  ]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- follow-up */}
          {!done && flow === "followup" ? (
            <div className="rise space-y-4">
              <Field label="What should be reviewed?">
                <div className="flex flex-wrap gap-2">
                  {followUps.map((s) => (
                    <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="When?">
                <div className="flex flex-wrap gap-2">
                  {whenOptions.map((w) => (
                    <Chip key={w.label} active={when === w.days} onClick={() => setWhen(w.days)}>
                      {w.label}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Note (optional)">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="If it hasn't improved, move it closer to the window."
                  className="input-soft resize-none"
                />
              </Field>
              <Submit
                label="Schedule follow-up"
                onClick={() => {
                  store.addTask({
                    plantId: plant.id,
                    type: "custom",
                    label: subject,
                    dueInDays: when,
                    ...(note.trim() ? { hint: note.trim() } : {}),
                  });
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: 0,
                    type: "note",
                    title: `Follow-up set: ${subject}`,
                    detail: `Due ${formatDate(-when)}. ${note.trim()}`.trim(),
                    provenance: "recorded",
                  });
                  finish("Follow-up scheduled", [subject, `Due ${formatDate(-when)}`]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- planting correction */}
          {!done && flow === "planting" ? (
            <div className="rise space-y-4">
              <p className="text-sm text-muted-foreground">
                The original record says planted {formatDate(plant.plantedDaysAgo)}. Corrections are kept visible in
                the timeline — the old entry is never silently replaced.
              </p>
              <Field label="Actually planted (days ago)">
                <input
                  type="number"
                  min={0}
                  value={plantedDays}
                  onChange={(e) => setPlantedDays(Number(e.target.value))}
                  className="input-soft numeral"
                />
                <p className="mt-2 text-xs text-muted-foreground">= {formatDate(plantedDays)}</p>
              </Field>
              <Field label="Why the change?">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="I sowed it a week earlier than I logged."
                  className="input-soft resize-none"
                />
              </Field>
              <MomentDateField value={momentDate} onChange={setMomentDate} />
              <Submit
                label="Correct the record"
                onClick={() => {
                  store.updatePlant(plant.id, { plantedDaysAgo: plantedDays });
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: momentDaysAgo,
                    type: "note",
                    title: "Planting record corrected",
                    detail: `Planted date changed from ${formatDate(plant.plantedDaysAgo)} to ${formatDate(
                      plantedDays,
                    )}. ${note.trim()}`.trim(),
                    provenance: "recorded",
                  });
                  finish("Planting record corrected", [
                    `Now planted ${formatDate(plantedDays)}`,
                    `Correction recorded ${formatDate(momentDaysAgo)}`,
                    "Correction visible in the timeline",
                  ]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- move */}
          {!done && flow === "move" ? (
            <div className="rise space-y-4">
              <Field label="Move to">
                <div className="grid gap-2">
                  {store.gardens.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGardenId(g.id)}
                      className={cn(
                        "press grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border px-3 py-2.5 text-left",
                        gardenId === g.id ? "border-primary/60 bg-primary/8" : "border-border/60 bg-background",
                      )}
                    >
                      <img src={g.cover} alt={g.name} className="h-10 w-10 rounded-xl object-cover" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{g.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {g.machine ? `${g.machine.name} · ${g.machine.pods} positions` : g.place}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Position / pod">
                <input
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  placeholder="Pod 4"
                  className="input-soft"
                />
              </Field>
              <MomentDateField value={momentDate} onChange={setMomentDate} />
              <Submit
                label="Record the move"
                onClick={() => {
                  const target = store.gardens.find((g) => g.id === gardenId);
                  store.updatePlant(plant.id, { gardenId, ...(slot.trim() ? { slot: slot.trim() } : {}) });
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: momentDaysAgo,
                    type: "transplant",
                    title: "Relocated",
                    detail: `Moved to ${target?.name ?? "another garden"}${slot.trim() ? ` · ${slot.trim()}` : ""}.`,
                    milestone: true,
                    provenance: "recorded",
                  });
                  finish("Move recorded", [
                    `${target?.name ?? "New garden"}${slot.trim() ? ` · ${slot.trim()}` : ""}`,
                    formatDate(momentDaysAgo),
                    "Added as a milestone",
                  ]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- close cycle */}
          {!done && flow === "close" ? (
            <div className="rise space-y-4">
              <p className="text-sm text-muted-foreground">
                Closing a cycle ends the active record. Every photo, event and milestone stays exactly where it is.
              </p>
              <Field label="Reason">
                <div className="flex flex-wrap gap-2">
                  {["Harvest complete", "End of season", "Plant lost", "Making room"].map((r) => (
                    <Chip key={r} active={closeReason === r} onClick={() => setCloseReason(r)}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Closing note (optional)">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Four harvests over 96 days. Worth repeating."
                  className="input-soft resize-none"
                />
              </Field>
              <MomentDateField value={momentDate} onChange={setMomentDate} />
              <Submit
                label="Close this cycle"
                onClick={() => {
                  store.updatePlant(plant.id, {
                    cycleClosed: true,
                    statusNote: `Cycle closed · ${closeReason.toLowerCase()}`,
                  });
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: momentDaysAgo,
                    type: "note",
                    title: "Cycle closed",
                    detail: `${closeReason}. ${note.trim()}`.trim(),
                    milestone: true,
                    provenance: "recorded",
                  });
                  finish("Cycle closed", [closeReason, formatDate(momentDaysAgo), `${plant.plantedDaysAgo} days of history preserved`]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- replace / reseed */}
          {!done && flow === "replace" ? (
            <div className="rise space-y-4">
              <p className="text-sm text-muted-foreground">
                {plant.name}'s story is kept and closed. A new record starts in the same place, ready to build its own.
              </p>
              <Field label="Name the new plant">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`${plant.name} II`}
                  className="input-soft"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Inherits {plant.species} · {plant.variety}
                  {plant.slot ? ` · ${plant.slot}` : ""} — you can correct it later.
                </p>
              </Field>
              <MomentDateField value={momentDate} onChange={setMomentDate} />
              <Submit
                label="Reseed this position"
                onClick={() => {
                  const name = newName.trim() || `${plant.name} II`;
                  store.updatePlant(plant.id, { cycleClosed: true, statusNote: "Cycle closed · replaced" });
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: momentDaysAgo,
                    type: "note",
                    title: "Replaced by a new sowing",
                    detail: `${name} now occupies this position. History preserved.`,
                    milestone: true,
                    provenance: "recorded",
                  });
                  store.addPlant({
                    gardenId: plant.gardenId,
                    name,
                    species: plant.species,
                    scientific: plant.scientific,
                    variety: plant.variety,
                    knowledgeId: plant.knowledgeId,
                    plantedDaysAgo: momentDaysAgo,
                    status: "steady",
                    statusNote: `Reseeded after ${plant.name}`,
                    heroPhotoId: plant.heroPhotoId,
                    identityConfirmed: true,
                    ...(plant.slot ? { slot: plant.slot } : {}),
                  });
                  finish("Reseeded", [`${name} started ${formatDate(momentDaysAgo)}`, `${plant.name}'s history kept intact`]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- other */}
          {!done && flow === "other" ? (
            <div className="rise space-y-4">
              <Field label="What kind of moment?">
                <div className="flex flex-wrap gap-2">
                  {otherStates.map((s) => (
                    <Chip key={s.type} active={otherType === s.type} onClick={() => setOtherType(s.type)}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Title">
                <input
                  value={otherTitle}
                  onChange={(e) => setOtherTitle(e.target.value)}
                  placeholder="First flower opened"
                  className="input-soft"
                />
              </Field>
              <Field label="Detail (optional)">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Two trusses, both on the sunny side."
                  className="input-soft resize-none"
                />
              </Field>
              <PhotoAttachment photo={newPhoto} onPhoto={setNewPhoto} />
              <MomentDateField value={momentDate} onChange={setMomentDate} />
              <Submit
                disabled={!otherTitle.trim()}
                label="Add to history"
                onClick={() => {
                   const attachedPhotoId = saveNewPhoto(otherTitle.trim());
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: momentDaysAgo,
                    type: otherType,
                    title: otherTitle.trim(),
                    ...(note.trim() ? { detail: note.trim() } : {}),
                    milestone: otherType !== "note",
                    provenance: "recorded",
                     ...(attachedPhotoId ? { photoId: attachedPhotoId } : {}),
                  });
                  finish("Moment recorded", [
                    otherTitle.trim(),
                    formatDate(momentDaysAgo),
                    otherStates.find((s) => s.type === otherType)?.label ?? "Event",
                     attachedPhotoId ? "One photo attached" : "No photo attached",
                  ]);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PhotoAttachment({ photo, onPhoto }: { photo: string | null; onPhoto: (photo: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  return (
    <Field label="Add a photo (optional)">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          pickPhoto(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="flex items-center gap-3">
        {photo ? (
          <img src={photo} alt="New moment" className="h-20 w-20 rounded-2xl object-cover" />
        ) : (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-dashed border-border bg-secondary/50 text-muted-foreground">
            <Camera className="h-4 w-4" />
          </span>
        )}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()}>
            {photo ? "Choose another photo" : "Add a photo"}
          </Button>
          {photo ? (
            <Button type="button" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => onPhoto(null)}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

function MomentDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const isToday = value === todayInputValue();
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
      <span className="text-xs text-muted-foreground">When?</span>
      <label className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{isToday ? "Today" : "Earlier date"}</span>
        <input
          type="date"
          value={value}
          max={todayInputValue()}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="When this moment happened"
        />
      </label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-2">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press rounded-full border px-3.5 py-2 text-sm transition",
        active ? "border-primary/60 bg-primary/8 text-foreground" : "border-border/60 bg-background text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Submit({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press w-full rounded-full bg-primary px-6 py-3.5 text-sm text-primary-foreground disabled:opacity-40"
    >
      {label}
    </button>
  );
}