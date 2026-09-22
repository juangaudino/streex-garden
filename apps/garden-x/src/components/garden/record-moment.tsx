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
import { formatDate, gardenCoverPhoto, plantPhotos } from "@/lib/garden-logic";
import type { EventType, MaintenanceType, Plant } from "@/lib/garden-data";
import { maintenanceIcons, ProvenanceTag } from "@/components/garden/atoms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PhotoImage } from "@/components/garden/photo-image";
import { ui } from "@/lib/ui-copy";
import { recordMomentGroups } from "@/lib/care-session";

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

function flowLabel(key: MomentFlow, language: "en" | "es") {
  const labels: Record<MomentFlow, [string, string]> = {
    observation: ["Add an observation", "Añadir una observación"], care: ["Record care or something I did", "Registrar un cuidado o algo que hice"], followup: ["Schedule a follow-up", "Programar un seguimiento"], planting: ["Correct planting information", "Corregir información de plantación"], move: ["Move / relocate", "Mover / trasladar"], close: ["Close cycle", "Cerrar ciclo"], replace: ["Replace / reseed", "Reemplazar / resembrar"], other: ["Record another state or action", "Registrar otro estado o acción"],
  };
  return labels[key][language === "es" ? 1 : 0];
}

function flowHint(key: MomentFlow, language: "en" | "es") {
  const hints: Record<MomentFlow, [string, string]> = {
    observation: ["A note, with a photo if you have one", "Una nota, con una foto si la tienes"], care: ["Water, feed, prune, harvest, and more", "Regar, nutrir, podar, cosechar y más"], followup: ["Decide what to review, and when", "Decide qué revisar y cuándo"], planting: ["Fix a setup record that was wrong", "Corrige un registro de configuración incorrecto"], move: ["New garden, system, pod or position", "Nuevo jardín, sistema, pod o posición"], close: ["End this cycle, keep the whole history", "Termina este ciclo y conserva todo el historial"], replace: ["Start a new record, keep the old story", "Inicia un registro nuevo y conserva la historia anterior"], other: ["Anything else worth remembering", "Cualquier otra cosa que valga la pena recordar"],
  };
  return hints[key][language === "es" ? 1 : 0];
}

function localizedMaintenanceLabel(type: MaintenanceType, language: "en" | "es") {
  const labels: Record<MaintenanceType, [string, string]> = {
    watering: ["Watering", "Riego"], nutrients: ["Nutrients", "Nutrientes"], pruning: ["Pruning", "Poda"], harvest: ["Harvest", "Cosecha"], thinning: ["Thinning", "Aclareo"], transplant: ["Transplant", "Trasplante"], cleaning: ["Cleaning", "Limpieza"], pest: ["Pest treatment", "Tratamiento de plagas"], light: ["Light adjustment", "Ajuste de luz"], custom: ["Custom", "Personalizado"],
  };
  return labels[type][language === "es" ? 1 : 0];
}

function localizedFollowUp(value: string, language: "en" | "es") {
  const es: Record<string, string> = { "Check leaf colour": "Revisar color de las hojas", "Check for pests": "Revisar plagas", "Water level / reservoir": "Nivel de agua / depósito", "Nutrient mix": "Mezcla de nutrientes", "Ready to harvest?": "¿Lista para cosechar?", "Support and staking": "Soporte y tutores" };
  return language === "es" ? es[value] ?? value : value;
}

function localizedWhen(days: number, language: "en" | "es") {
  if (days === 1) return ui(language, "tomorrow");
  if (days === 3) return ui(language, "inThreeDays");
  if (days === 7) return ui(language, "inAWeek");
  return ui(language, "inTwoWeeks");
}

function localizedOtherState(type: EventType, language: "en" | "es") {
  const labels: Record<EventType, [string, string]> = { planted: ["Planted", "Plantada"], germinated: ["Germinated", "Germinada"], photo: ["Photo", "Foto"], maintenance: ["Maintenance", "Mantenimiento"], thinning: ["Thinning", "Aclareo"], pruning: ["Pruning", "Poda"], harvest: ["Harvest", "Cosecha"], transplant: ["Transplant", "Trasplante"], problem: ["Problem appeared", "Apareció un problema"], recovery: ["Recovered", "Recuperada"], flowering: ["Flowering", "Floración"], fruiting: ["Fruiting", "Fructificación"], ai: ["AI analysis", "Análisis de IA"], note: ["Something else", "Algo más"] };
  return labels[type][language === "es" ? 1 : 0];
}

function localizedCloseReason(value: string, language: "en" | "es") {
  const labels: Record<string, [string, string]> = {
    "Harvest complete": ["Harvest complete", "Cosecha completada"],
    "End of season": ["End of season", "Fin de temporada"],
    "Plant lost": ["Plant lost", "Planta perdida"],
    "Making room": ["Making room", "Hacer espacio"],
  };
  return labels[value]?.[language === "es" ? 1 : 0] ?? value;
}

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
  const language = store.language;
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
    toast.success(`${title} · ${ui(language, "addedToHistoryToast")} ${plant.name}`);
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
      metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label={ui(language, "close")}
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
            <p className="eyebrow">{plant.name} · {language === "es" ? "día" : "day"} {plant.plantedDaysAgo}</p>
            <p className="truncate font-display text-lg">
              {done ? ui(language, "recorded") : (currentFlow ? flowLabel(currentFlow.key, language) : ui(language, "recordMoment"))}
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
                {ui(language, "writtenTimeline")}
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
                  {ui(language, "recordAnotherMoment")}
                </button>
                <button
                  onClick={onClose}
                  className="press rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground"
                >
                  {ui(language, "done")}
                </button>
              </div>
            </div>
          ) : null}

          {/* ---------------------------------------- menu */}
          {!done && !flow ? (
            <div className="rise">
              <p className="mb-4 text-sm text-muted-foreground">
                {ui(language, "everythingRecordedStory")}
              </p>
              <div className="space-y-6">
                {recordMomentGroups.map((group) => (
                  <section key={group.labelKey} aria-labelledby={`record-group-${group.labelKey}`}>
                    <h3 id={`record-group-${group.labelKey}`} className="eyebrow mb-2">{ui(language, group.labelKey)}</h3>
                    <ul className="grid gap-2">
                      {group.flowKeys.map((flowKey) => {
                        const f = flows.find((item) => item.key === flowKey)!;
                        return (
                          <li key={f.key}>
                            <button
                              onClick={() => setFlow(f.key)}
                              className="press grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5 rounded-2xl border border-border/60 bg-background px-4 py-3.5 text-left hover:border-primary/40"
                            >
                              <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary">
                                <f.icon className="h-4 w-4" strokeWidth={1.8} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-medium">{flowLabel(f.key, language)}</span>
                                <span className="block truncate text-xs text-muted-foreground">{flowHint(f.key, language)}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          ) : null}

          {/* ---------------------------------------- observation */}
          {!done && flow === "observation" ? (
            <div className="rise space-y-4">
              <Field label={ui(language, "whatNoticed")}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder={language === "es" ? "Hojas inferiores más pálidas que la semana pasada, brotes nuevos aún cerrados…" : "Lower leaves paler than last week, new growth still tight…"}
                  className="input-soft resize-none"
                />
              </Field>
              <PhotoAttachment
                language={language}
                photo={newPhoto}
                onPhoto={(src) => {
                  setNewPhoto(src);
                  if (src) setPhotoId(null);
                }}
              />
              {photos.length ? (
                <Field label={ui(language, "useExistingPhoto")}>
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
                        <PhotoImage photo={p} alt={p.caption} rendition="preview" className="h-full w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[0.6rem] text-white">
                          {formatDate(p.daysAgo)}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
              ) : null}
              <MomentDateField language={language} value={momentDate} onChange={setMomentDate} />
              <Submit
                disabled={!note.trim()}
                label={ui(language, "saveObservation")}
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
                  finish(ui(language, "observationAdded"), [
                    formatDate(momentDaysAgo, language),
                    note.trim(),
                     attachedPhotoId ? ui(language, "photoAttached") : ui(language, "noPhotoAttached"),
                  ]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- care */}
          {!done && flow === "care" ? (
            <div className="rise space-y-4">
              <Field label={ui(language, "whatDidYouDo")}>
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
                        <span className="truncate">{localizedMaintenanceLabel(t, language)}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label={ui(language, "detailsOptional")}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={language === "es" ? "2 litros, mezcla a media concentración…" : "2 litres, half-strength mix…"}
                  className="input-soft resize-none"
                />
              </Field>
              <PhotoAttachment language={language} photo={newPhoto} onPhoto={setNewPhoto} />
              <MomentDateField language={language} value={momentDate} onChange={setMomentDate} />
              <Submit
                label={`${ui(language, "logAction")} ${localizedMaintenanceLabel(careType, language).toLowerCase()}`}
                onClick={() => {
                   const attachedPhotoId = saveNewPhoto(`${localizedMaintenanceLabel(careType, language)} · ${plant.name}`);
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: momentDaysAgo,
                    type: careEventType(careType),
                    title: localizedMaintenanceLabel(careType, language),
                    detail: note.trim() || ui(language, "recordedFromMoment"),
                    provenance: "recorded",
                     ...(attachedPhotoId ? { photoId: attachedPhotoId } : {}),
                  });
                  finish(`${localizedMaintenanceLabel(careType, language)} ${ui(language, "logged")}`, [
                    formatDate(momentDaysAgo),
                    note.trim() || ui(language, "noExtraDetail"),
                     attachedPhotoId ? ui(language, "photoAttached") : ui(language, "noPhotoAttached"),
                  ]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- follow-up */}
          {!done && flow === "followup" ? (
            <div className="rise space-y-4">
              <Field label={ui(language, "whatReviewed")}>
                <div className="flex flex-wrap gap-2">
                  {followUps.map((s) => (
                    <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>
                      {localizedFollowUp(s, language)}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label={ui(language, "when")}>
                <div className="flex flex-wrap gap-2">
                  {whenOptions.map((w) => (
                    <Chip key={w.label} active={when === w.days} onClick={() => setWhen(w.days)}>
                      {localizedWhen(w.days, language)}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label={ui(language, "noteOptional")}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={language === "es" ? "Si no mejora, acércala a la ventana." : "If it hasn't improved, move it closer to the window."}
                  className="input-soft resize-none"
                />
              </Field>
              <Submit
                label={ui(language, "scheduleFollowupAction")}
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
                  finish(ui(language, "followupScheduled"), [localizedFollowUp(subject, language), `${ui(language, "when")} ${formatDate(-when)}`]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- planting correction */}
          {!done && flow === "planting" ? (
            <div className="rise space-y-4">
              <p className="text-sm text-muted-foreground">
                {ui(language, "originalRecordCorrection")} {formatDate(plant.plantedDaysAgo)}. {ui(language, "correctionsStayVisible")}
              </p>
              <Field label={ui(language, "actuallyPlanted")}>
                <input
                  type="number"
                  min={0}
                  value={plantedDays}
                  onChange={(e) => setPlantedDays(Number(e.target.value))}
                  className="input-soft numeral"
                />
                <p className="mt-2 text-xs text-muted-foreground">= {formatDate(plantedDays)}</p>
              </Field>
              <Field label={ui(language, "whyChange")}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={language === "es" ? "Lo sembré una semana antes de lo que registré." : "I sowed it a week earlier than I logged."}
                  className="input-soft resize-none"
                />
              </Field>
              <MomentDateField language={language} value={momentDate} onChange={setMomentDate} />
              <Submit
                label={ui(language, "correctRecord")}
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
                  finish(ui(language, "plantingRecordCorrected"), [
                    `${ui(language, "nowPlanted")} ${formatDate(plantedDays)}`,
                    `${ui(language, "correctionRecorded")} ${formatDate(momentDaysAgo)}`,
                    ui(language, "correctionVisible"),
                  ]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- move */}
          {!done && flow === "move" ? (
            <div className="rise space-y-4">
              <Field label={ui(language, "moveTo")}>
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
                      {gardenCoverPhoto(g, store.plants, store.photos) ? <PhotoImage photo={gardenCoverPhoto(g, store.plants, store.photos)!} alt={g.name} rendition="preview" className="h-10 w-10 rounded-xl object-cover" /> : <span className="h-10 w-10 rounded-xl bg-secondary" />}
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{g.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {g.machine ? `${g.machine.name} · ${g.machine.pods} ${ui(language, "positions").toLowerCase()}` : g.place}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={ui(language, "positionPod")}>
                <input
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  placeholder={language === "es" ? "Posición 4" : "Position 4"}
                  className="input-soft"
                />
              </Field>
              <MomentDateField language={language} value={momentDate} onChange={setMomentDate} />
              <Submit
                label={ui(language, "recordMove")}
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
                  finish(ui(language, "moveRecorded"), [
                    `${target?.name ?? ui(language, "newGarden")}${slot.trim() ? ` · ${slot.trim()}` : ""}`,
                    formatDate(momentDaysAgo),
                    ui(language, "addedMilestone"),
                  ]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- close cycle */}
          {!done && flow === "close" ? (
            <div className="rise space-y-4">
              <p className="text-sm text-muted-foreground">
                {ui(language, "closeCycleBody")}
              </p>
              <Field label={ui(language, "reason")}>
                <div className="flex flex-wrap gap-2">
                  {["Harvest complete", "End of season", "Plant lost", "Making room"].map((r) => (
                    <Chip key={r} active={closeReason === r} onClick={() => setCloseReason(r)}>
                      {r === "Harvest complete" ? ui(language, "reasonHarvestComplete") : r === "End of season" ? ui(language, "reasonEndSeason") : r === "Plant lost" ? ui(language, "reasonPlantLost") : ui(language, "reasonMakingRoom")}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label={ui(language, "closingNote")}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={language === "es" ? "Cuatro cosechas en 96 días. Vale la pena repetirlo." : "Four harvests over 96 days. Worth repeating."}
                  className="input-soft resize-none"
                />
              </Field>
              <MomentDateField language={language} value={momentDate} onChange={setMomentDate} />
              <Submit
                label={ui(language, "closeThisCycle")}
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
                  finish(ui(language, "cycleClosed"), [localizedCloseReason(closeReason, language), formatDate(momentDaysAgo), `${plant.plantedDaysAgo} ${ui(language, "days")} ${ui(language, "historyPreserved")}`]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- replace / reseed */}
          {!done && flow === "replace" ? (
            <div className="rise space-y-4">
              <p className="text-sm text-muted-foreground">
                {ui(language, "replacedStoryBody")}
              </p>
              <Field label={ui(language, "nameNewPlant")}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`${plant.name} II`}
                  className="input-soft"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {ui(language, "inherits")} {plant.species} · {plant.variety}
                  {plant.slot ? ` · ${plant.slot}` : ""} {ui(language, "canCorrectLater")}
                </p>
              </Field>
              <MomentDateField language={language} value={momentDate} onChange={setMomentDate} />
              <Submit
                label={ui(language, "reseedPosition")}
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
                  finish(ui(language, "reseeded"), [language === "es" ? `${name} comenzó ${formatDate(momentDaysAgo)}` : `${name} started ${formatDate(momentDaysAgo)}`, language === "es" ? `El historial de ${plant.name} se conserva` : `${plant.name}'s history kept intact`]);
                }}
              />
            </div>
          ) : null}

          {/* ---------------------------------------- other */}
          {!done && flow === "other" ? (
            <div className="rise space-y-4">
              <Field label={ui(language, "whatKindMoment")}>
                <div className="flex flex-wrap gap-2">
                  {otherStates.map((s) => (
                    <Chip key={s.type} active={otherType === s.type} onClick={() => setOtherType(s.type)}>
                      {localizedOtherState(s.type, language)}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label={ui(language, "title")}>
                <input
                  value={otherTitle}
                  onChange={(e) => setOtherTitle(e.target.value)}
                  placeholder={language === "es" ? "Se abrió la primera flor" : "First flower opened"}
                  className="input-soft"
                />
              </Field>
              <Field label={ui(language, "detailOptional")}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={language === "es" ? "Dos racimos, ambos del lado soleado." : "Two trusses, both on the sunny side."}
                  className="input-soft resize-none"
                />
              </Field>
              <PhotoAttachment language={language} photo={newPhoto} onPhoto={setNewPhoto} />
              <MomentDateField language={language} value={momentDate} onChange={setMomentDate} />
              <Submit
                disabled={!otherTitle.trim()}
                label={ui(language, "addToHistory")}
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
                  finish(ui(language, "momentRecorded"), [
                    otherTitle.trim(),
                    formatDate(momentDaysAgo),
                    localizedOtherState(otherType, language) || ui(language, "eventLabel"),
                     attachedPhotoId ? ui(language, "photoAttached") : ui(language, "noPhotoAttached"),
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

function PhotoAttachment({ photo, onPhoto, language }: { photo: string | null; onPhoto: (photo: string | null) => void; language: "en" | "es" }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  return (
    <Field label={ui(language, "addPhotoOptional")}>
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
          <img src={photo} alt={ui(language, "newMomentImage")} className="h-20 w-20 rounded-2xl object-cover" />
        ) : (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-dashed border-border bg-secondary/50 text-muted-foreground">
            <Camera className="h-4 w-4" />
          </span>
        )}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()}>
            {photo ? ui(language, "chooseAnotherPhoto") : ui(language, "addPhoto")}
          </Button>
          {photo ? (
            <Button type="button" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => onPhoto(null)}>
              {ui(language, "removePhoto")}
            </Button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

function MomentDateField({ value, onChange, language }: { value: string; onChange: (value: string) => void; language: "en" | "es" }) {
  const isToday = value === todayInputValue();
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3">
      <span className="text-xs text-muted-foreground">{ui(language, "when")}</span>
      <label className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{isToday ? ui(language, "today") : ui(language, "earlierDate")}</span>
        <input
          type="date"
          value={value}
          max={todayInputValue()}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40"
          aria-label={ui(language, "when")}
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
