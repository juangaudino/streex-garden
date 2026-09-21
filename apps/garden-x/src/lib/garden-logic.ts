import {
  knowledge,
  type CareTask,
  type Garden,
  type MaintenanceType,
  type Photo,
  type Plant,
  type PlantEvent,
  type EventType,
  type PlantStatus,
} from "./garden-data";
import { preferredLanguage, ui, type UiLanguage } from "./ui-copy";

/* ------------------------------------------------------------- time */

export const dayMs = 86_400_000;

export function latestPlantPhoto(photos: Photo[], plantId: string) {
  return photos.filter((photo) => photo.plantId === plantId).sort((a, b) => a.daysAgo - b.daysAgo)[0];
}

export type PhotoMetricKind = "height" | "leaves" | "density";

/** Returns only measurements that were actually recorded. Null is never rendered as zero. */
export function photoMetricEntries(metrics: Photo["metrics"]): Array<{ kind: PhotoMetricKind; value: number }> {
  return [
    metrics.heightCm == null ? null : { kind: "height" as const, value: metrics.heightCm },
    metrics.leafCount == null ? null : { kind: "leaves" as const, value: metrics.leafCount },
    metrics.density == null ? null : { kind: "density" as const, value: metrics.density },
  ].filter((entry): entry is { kind: PhotoMetricKind; value: number } => entry !== null);
}

export function gardenCover(garden: Garden, plants: Plant[], photos: Photo[]) {
  if (garden.coverPhotoId) {
    const selected = photos.find((photo) => photo.id === garden.coverPhotoId);
    if (selected) return selected.src;
  }
  const plantIds = new Set(plants.filter((plant) => plant.gardenId === garden.id).map((plant) => plant.id));
  return photos.filter((photo) => plantIds.has(photo.plantId)).sort((a, b) => a.daysAgo - b.daysAgo)[0]?.src ?? garden.cover;
}

export function gardenCoverPhoto(garden: Garden, plants: Plant[], photos: Photo[]) {
  if (garden.coverPhotoId) {
    const selected = photos.find((photo) => photo.id === garden.coverPhotoId);
    if (selected) return selected;
  }
  const plantIds = new Set(plants.filter((plant) => plant.gardenId === garden.id).map((plant) => plant.id));
  return photos.filter((photo) => plantIds.has(photo.plantId)).sort((a, b) => a.daysAgo - b.daysAgo)[0];
}

export function dateFromDaysAgo(daysAgo: number) {
  return new Date(Date.now() - daysAgo * dayMs);
}

export function formatDate(daysAgo: number, language = preferredLanguage()) {
  return dateFromDaysAgo(daysAgo).toLocaleDateString(language === "es" ? "es-ES" : "en-US", {
    month: "short",
    day: "numeric",
    year: dateFromDaysAgo(daysAgo).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function relativeDay(daysAgo: number, language = preferredLanguage()) {
  const es = language === "es";
  if (daysAgo <= 0) return es ? "Hoy" : "Today";
  if (daysAgo === 1) return es ? "Ayer" : "Yesterday";
  if (daysAgo < 7) return es ? `hace ${daysAgo} días` : `${daysAgo} days ago`;
  if (daysAgo < 35) return es ? `hace ${Math.round(daysAgo / 7)} semanas` : `${Math.round(daysAgo / 7)} weeks ago`;
  if (daysAgo < 365) return es ? `hace ${Math.round(daysAgo / 30)} meses` : `${Math.round(daysAgo / 30)} months ago`;
  const y = (daysAgo / 365).toFixed(1);
  return es ? `hace ${y} años` : `${y} years ago`;
}

export function dueLabel(dueInDays: number, language = preferredLanguage()) {
  const es = language === "es";
  if (dueInDays < -1) return es ? `${Math.abs(dueInDays)} días de retraso` : `${Math.abs(dueInDays)} days overdue`;
  if (dueInDays === -1) return es ? "1 día de retraso" : "1 day overdue";
  if (dueInDays === 0) return es ? "Hoy" : "Today";
  if (dueInDays === 1) return es ? "Mañana" : "Tomorrow";
  return es ? `En ${dueInDays} días` : `In ${dueInDays} days`;
}

export function ageLabel(plantedDaysAgo: number, language = preferredLanguage()) {
  const es = language === "es";
  if (plantedDaysAgo < 60) return es ? `Día ${plantedDaysAgo}` : `Day ${plantedDaysAgo}`;
  if (plantedDaysAgo < 365) return es ? `${Math.round(plantedDaysAgo / 30)} meses juntas` : `${Math.round(plantedDaysAgo / 30)} months together`;
  const years = plantedDaysAgo / 365;
  return es ? `${years.toFixed(1)} años juntas` : `${years.toFixed(1)} years together`;
}

/* ------------------------------------------------------------- selectors */

export const byRecency = <T extends { daysAgo: number }>(items: T[]) =>
  [...items].sort((a, b) => a.daysAgo - b.daysAgo);

export const chronological = <T extends { daysAgo: number }>(items: T[]) =>
  [...items].sort((a, b) => b.daysAgo - a.daysAgo);

export type SortOrder = "newest" | "oldest";

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function compareTemporal(
  aTimestamp: string | null | undefined,
  bTimestamp: string | null | undefined,
  aDaysAgo: number,
  bDaysAgo: number,
  order: SortOrder,
) {
  const aTime = timestamp(aTimestamp);
  const bTime = timestamp(bTimestamp);
  const direction = order === "newest" ? -1 : 1;
  if (aTime !== null && bTime !== null && aTime !== bTime) return (aTime - bTime) * direction;
  if (aDaysAgo !== bDaysAgo) return (aDaysAgo - bDaysAgo) * (order === "newest" ? 1 : -1);
  return 0;
}

export function sortPhotosByCapturedAt(photos: Photo[], order: SortOrder = "newest") {
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => compareTemporal(a.photo.capturedAt, b.photo.capturedAt, a.photo.daysAgo, b.photo.daysAgo, order) || a.index - b.index)
    .map(({ photo }) => photo);
}

export const plantPhotos = (photos: Photo[], plantId: string) =>
  chronological(photos.filter((p) => p.plantId === plantId));

/**
 * AI Check can analyse both event-linked photos and historical cycle evidence.
 * The backend authorizes either relationship, so the UI must require a
 * persisted storage path rather than an event id.
 */
export function canRunAiCheck(
  plant: Pick<Plant, "backendGrowCycleId">,
  photo: Pick<Photo, "backendStoragePath">,
) {
  return Boolean(plant.backendGrowCycleId && photo.backendStoragePath);
}

/**
 * Photos that can be shown in Home's plant-history "New photos" strip.
 *
 * The bootstrap also carries garden-level media so the garden cover can be
 * rendered from the same photo cache. Those rows have no plant id and must
 * never become plant-detail links. Keep the fallback for fixture/legacy rows
 * that predate mediaScope, while explicitly excluding other non-plant scopes.
 */
export function recentPlantPhotos(photos: Photo[], plants: Pick<Plant, "id">[]) {
  const plantIds = new Set(plants.map((plant) => plant.id));
  return photos.filter(
    (photo) =>
      plantIds.has(photo.plantId) &&
      (photo.mediaScope === undefined || photo.mediaScope === "cycle_evidence"),
  );
}

/** Pick one active plant for the lifetime of an app session. */
export function chooseSessionHighlight<T extends Pick<Plant, "id" | "cycleClosed">>(
  plants: T[],
  previousId: string | null,
  random = Math.random,
): T | undefined {
  const active = plants.filter((plant) => !plant.cycleClosed);
  if (!active.length) return undefined;
  const withoutPrevious = active.length > 1 && previousId
    ? active.filter((plant) => plant.id !== previousId)
    : active;
  const pool = withoutPrevious.length ? withoutPrevious : active;
  return pool[Math.floor(random() * pool.length)];
}

export const plantEvents = (events: PlantEvent[], plantId: string) =>
  byRecency(events.filter((e) => e.plantId === plantId));

export type PlantTimelineEntry =
  | { kind: "event"; event: PlantEvent; photos: Photo[]; daysAgo: number }
  | { kind: "photo"; photo: Photo; photos: Photo[]; daysAgo: number };

/**
 * Projects the canonical event stream together with photo evidence that has
 * no event row. Evidence-only photos remain evidence; this function never
 * manufactures a PlantEvent or changes the persisted domain model.
 */
export function plantTimeline(
  events: PlantEvent[],
  photos: Photo[],
  plantId: string,
  order: SortOrder = "newest",
): PlantTimelineEntry[] {
  const plantEventsById = new Map(
    events.filter((event) => event.plantId === plantId).map((event) => [event.id, event]),
  );
  const photosByEventId = new Map<string, Photo[]>();
  const evidenceOnly: Photo[] = [];
  for (const photo of photos.filter((item) => item.plantId === plantId)) {
    if (photo.backendEventId && plantEventsById.has(photo.backendEventId)) {
      const group = photosByEventId.get(photo.backendEventId) ?? [];
      group.push(photo);
      photosByEventId.set(photo.backendEventId, group);
    } else {
      evidenceOnly.push(photo);
    }
  }
  const entries: PlantTimelineEntry[] = [
    ...plantEventsById.values().map((event) => ({
      kind: "event" as const,
      event,
      photos: photosByEventId.get(event.id) ?? [],
      daysAgo: event.daysAgo,
    })),
    ...evidenceOnly.map((photo) => ({
      kind: "photo" as const,
      photo,
      photos: [photo],
      daysAgo: photo.daysAgo,
    })),
  ];
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aTimestamp = a.entry.kind === "photo" ? a.entry.photo.capturedAt : a.entry.event.occurredAt;
      const bTimestamp = b.entry.kind === "photo" ? b.entry.photo.capturedAt : b.entry.event.occurredAt;
      return compareTemporal(aTimestamp, bTimestamp, a.entry.daysAgo, b.entry.daysAgo, order)
        || (a.entry.kind === "photo" ? -1 : 1) - (b.entry.kind === "photo" ? -1 : 1)
        || a.index - b.index;
    })
    .map(({ entry }) => entry);
}

export function eventsBetween(events: PlantEvent[], plantId: string, aDaysAgo: number, bDaysAgo: number) {
  const oldest = Math.max(aDaysAgo, bDaysAgo);
  const newest = Math.min(aDaysAgo, bDaysAgo);
  return chronological(
    events.filter((event) => event.plantId === plantId && event.daysAgo <= oldest && event.daysAgo >= newest),
  );
}

export function gardenPhotos(photos: Photo[], plants: Plant[], gardenId: string) {
  const plantIds = new Set(plants.filter((plant) => plant.gardenId === gardenId).map((plant) => plant.id));
  return chronological(photos.filter((photo) => plantIds.has(photo.plantId)));
}

export const openTasks = (tasks: CareTask[]) =>
  [...tasks.filter((t) => !t.done)].sort((a, b) => a.dueInDays - b.dueInDays);

export function lastOfType(events: PlantEvent[], plantId: string, match: (e: PlantEvent) => boolean) {
  return plantEvents(events, plantId).find(match);
}

export function lastReview(events: PlantEvent[], plantId: string) {
  return plantEvents(events, plantId).find(
    (e) => e.type === "note" && /reviewed|check-in/i.test(e.title),
  );
}


export const statusMeta: Record<PlantStatus, { label: string; tone: string; dot: string }> = {
  thriving: { label: "Thriving", tone: "text-primary", dot: "bg-primary" },
  steady: { label: "Steady", tone: "text-muted-foreground", dot: "bg-moss" },
  watching: { label: "Watching", tone: "text-clay", dot: "bg-clay" },
  recovering: { label: "Recovering", tone: "text-fact", dot: "bg-fact" },
};

export const maintenanceLabels: Record<MaintenanceType, string> = {
  watering: "Watering",
  nutrients: "Nutrients",
  pruning: "Pruning",
  harvest: "Harvest",
  thinning: "Thinning",
  transplant: "Transplant",
  cleaning: "Cleaning",
  pest: "Pest treatment",
  light: "Light adjustment",
  custom: "Custom",
};

export const eventLabels: Record<EventType, string> = {
  planted: "Planted",
  germinated: "Germinated",
  photo: "Photo",
  maintenance: "Maintenance",
  thinning: "Thinning",
  pruning: "Pruning",
  harvest: "Harvest",
  transplant: "Transplant",
  problem: "Problem",
  recovery: "Recovery",
  flowering: "Flowering",
  fruiting: "Fruiting",
  ai: "AI analysis",
  note: "Note",
};

export function localizedStatusLabel(status: PlantStatus, language = preferredLanguage()) {
  const labels: Record<PlantStatus, [string, string]> = { thriving: ["Thriving", "Floreciente"], steady: ["Steady", "Estable"], watching: ["Watching", "En observación"], recovering: ["Recovering", "En recuperación"] };
  return labels[status][language === "es" ? 1 : 0];
}

export function localizedMaintenanceLabel(type: MaintenanceType, language = preferredLanguage()) {
  const labels: Record<MaintenanceType, [string, string]> = { watering: ["Watering", "Riego"], nutrients: ["Nutrients", "Nutrientes"], pruning: ["Pruning", "Poda"], harvest: ["Harvest", "Cosecha"], thinning: ["Thinning", "Aclareo"], transplant: ["Transplant", "Trasplante"], cleaning: ["Cleaning", "Limpieza"], pest: ["Pest treatment", "Tratamiento de plagas"], light: ["Light adjustment", "Ajuste de luz"], custom: ["Custom", "Personalizado"] };
  return labels[type][language === "es" ? 1 : 0];
}

export function localizedEventLabel(type: EventType, language = preferredLanguage()) {
  const labels: Record<EventType, [string, string]> = { planted: ["Planted", "Plantada"], germinated: ["Germinated", "Germinada"], photo: ["Photo", "Foto"], maintenance: ["Maintenance", "Mantenimiento"], thinning: ["Thinning", "Aclareo"], pruning: ["Pruning", "Poda"], harvest: ["Harvest", "Cosecha"], transplant: ["Transplant", "Trasplante"], problem: ["Problem", "Problema"], recovery: ["Recovery", "Recuperación"], flowering: ["Flowering", "Floración"], fruiting: ["Fruiting", "Fructificación"], ai: ["AI analysis", "Análisis de IA"], note: ["Note", "Nota"] };
  return labels[type][language === "es" ? 1 : 0];
}

/* ------------------------------------------------------------- story facts */

export interface StoryFact {
  label: string;
  value: string;
}

export interface PlantCompanions {
  good: string[];
  separate: string[];
}

export function plantCompanions(knowledgeId: string): PlantCompanions {
  const companions: Record<string, PlantCompanions> = {
    tomato: { good: ["Basil", "Lettuce", "Marigold"], separate: ["Fennel", "Potato"] },
    pepper: { good: ["Basil", "Lettuce", "Onion"], separate: ["Fennel", "Kohlrabi"] },
    basil: { good: ["Tomato", "Sweet pepper", "Parsley"], separate: ["Rue", "Sage"] },
    monstera: { good: ["Pothos", "Philodendron", "Peace lily"], separate: ["Dry-loving succulents"] },
    lettuce: { good: ["Tomato", "Radish", "Chives"], separate: ["Parsley", "Celery"] },
  };
  return companions[knowledgeId] ?? { good: ["Plants with similar light and water needs"], separate: ["Plants with conflicting care needs"] };
}

export function storyFacts(plant: Plant, events: PlantEvent[], language = preferredLanguage()): StoryFact[] {
  const history = plantEvents(events, plant.id);

  const last = (type: EventType, titleIncludes?: string) => {
    const found = history.find(
      (e) =>
        e.type === type &&
        (!titleIncludes || e.title.toLowerCase().includes(titleIncludes.toLowerCase())),
    );
    return found ? formatDate(found.daysAgo, language) : ui(language, "notYet");
  };
  const labels = {
    waterChange: language === "es" ? "Último cambio de agua" : "Last water change",
    thinning: language === "es" ? "Último aclareo" : "Last thinning",
    nutrients: language === "es" ? "Últimos nutrientes" : "Last nutrients",
    pruning: language === "es" ? "Última poda" : "Last pruning",
    harvest: language === "es" ? "Última cosecha" : "Last harvest",
    watering: language === "es" ? "Último riego" : "Last watering",
    ai: language === "es" ? "Última comprobación de IA" : "Last AI check",
    cleaning: language === "es" ? "Última limpieza" : "Last cleaning",
    transplant: language === "es" ? "Último trasplante" : "Last transplant",
    feed: language === "es" ? "Último abonado" : "Last feed",
  };

  switch (plant.id) {
    case "willow":
      return [
        { label: labels.waterChange, value: last("maintenance", "Water change") },
        { label: labels.thinning, value: last("thinning") },
        { label: labels.nutrients, value: last("maintenance", "Nutrients") },
      ];
    case "nova":
      return [
        { label: labels.nutrients, value: last("maintenance", "Nutrients") },
        { label: labels.waterChange, value: last("maintenance", "Water change") },
        { label: labels.thinning, value: last("thinning") },
      ];
    case "aurora":
      return [
        { label: labels.pruning, value: last("pruning") },
        { label: labels.harvest, value: last("harvest") },
        { label: labels.watering, value: last("maintenance", "Watering") },
      ];
    case "rex":
      return [
        { label: labels.harvest, value: last("harvest") },
        { label: labels.pruning, value: last("pruning") },
        { label: labels.watering, value: last("maintenance", "Watering") },
      ];
    case "ember":
      return [
        { label: labels.nutrients, value: last("maintenance", "Nutrients") },
        { label: labels.ai, value: last("ai") },
        { label: labels.harvest, value: last("harvest") },
      ];
    case "ora":
      return [
        { label: labels.cleaning, value: last("maintenance", "Cleaning") },
        { label: labels.transplant, value: last("transplant") },
        { label: labels.feed, value: last("maintenance", "Nutrients") },
      ];
    default:
      return [
        { label: labels.pruning, value: last("pruning") },
        { label: labels.harvest, value: last("harvest") },
        { label: labels.watering, value: last("maintenance", "Watering") },
      ];
  }
}

/* ------------------------------------------------------------- AI check */

export type Confidence = "high" | "moderate" | "low";

export interface Finding {
  kind: "observed" | "inference" | "recommendation";
  /** Optional only for compact labels such as a recommendation kind. */
  title?: string;
  body: string;
  confidence?: Confidence;
  subkind?: "uncertainty";
}

export interface AnalysisResult {
  headline: string;
  summary: string;
  confidence: Confidence;
  findings: Finding[];
  grounding: string[];
}

/* ------------------------------------------------------------- compare */

export interface Delta {
  label: string;
  from: number;
  to: number;
  unit: string;
  higherIsBetter: boolean;
}

export interface CompareResult {
  days: number;
  deltas: Delta[];
  observations: string[];
  inference: string;
  confidence: Confidence;
}

export function comparePhotos(a: Photo, b: Photo, plant: Plant, language = preferredLanguage()): CompareResult {
  const [earlier, later] = a.daysAgo > b.daysAgo ? [a, b] : [b, a];
  const days = earlier.daysAgo - later.daysAgo;
  const deltas: Delta[] = [
    ...(earlier.metrics.heightCm != null && later.metrics.heightCm != null
      ? [{ label: ui(language, "height"), from: earlier.metrics.heightCm, to: later.metrics.heightCm, unit: "cm", higherIsBetter: true }]
      : []),
    ...(earlier.metrics.leafCount != null && later.metrics.leafCount != null
      ? [{ label: ui(language, "leavesApprox"), from: earlier.metrics.leafCount, to: later.metrics.leafCount, unit: "", higherIsBetter: true }]
      : []),
    ...(earlier.metrics.density != null && later.metrics.density != null
      ? [{ label: ui(language, "canopyDensity"), from: earlier.metrics.density, to: later.metrics.density, unit: "/100", higherIsBetter: true }]
      : []),
    { label: ui(language, "colourSaturation"), from: earlier.metrics.greenness, to: later.metrics.greenness, unit: "/100", higherIsBetter: true },
  ];

  const growth = later.metrics.heightCm != null && earlier.metrics.heightCm != null
    ? later.metrics.heightCm - earlier.metrics.heightCm
    : null;
  const colour = later.metrics.greenness - earlier.metrics.greenness;
  const observations = [
    growth !== null && growth > 0
      ? language === "es"
        ? `${ui(language, "heightIncreased")} ${growth} cm ${ui(language, "overDays")} ${days} ${ui(language, "daysAbout")} ${(growth / Math.max(days, 1)).toFixed(2)} cm ${ui(language, "perDay")}`
        : `${ui(language, "heightIncreased")} ${growth}cm ${ui(language, "overDays")} ${days} ${ui(language, "daysAbout")} ${(growth / Math.max(days, 1)).toFixed(2)}cm/day).`
      : growth === null ? ui(language, "measurementsNotAvailable") : ui(language, "noHeightChange"),
    ...(earlier.metrics.leafCount != null && later.metrics.leafCount != null
      ? [`${ui(language, "visibleLeafCount")} ${earlier.metrics.leafCount} ${language === "es" ? "a" : "to"} ${later.metrics.leafCount}.`]
      : []),
    colour < -4
      ? language === "es" ? `${ui(language, "saturationDropped")} ${Math.abs(colour)} puntos, sobre todo en las hojas inferiores.` : `${ui(language, "saturationDropped")} ${Math.abs(colour)} points, strongest on lower leaves.`
      : colour > 4
        ? language === "es" ? `${ui(language, "colourDeepened")} ${colour} puntos en toda la copa.` : `${ui(language, "colourDeepened")} ${colour} points across the canopy.`
        : ui(language, "colourUnchanged"),
  ];

  const inference =
    colour < -4
      ? language === "es"
        ? "La forma del cambio — el crecimiento continúa mientras el color se desvanece en las hojas viejas — apunta a un problema de nutrientes más que de agua o luz. No está confirmado: fotografiar dos veces una hoja es poca evidencia para toda la planta."
        : `The shape of the change — growth continuing while colour fades on older leaves — points to a nutrient issue rather than water or light. Not confirmed: one leaf photographed twice is thin evidence for the whole plant.`
      : growth !== null && growth > 0 && later.metrics.density != null && earlier.metrics.density != null && later.metrics.density > earlier.metrics.density
        ? `${plant.name} ${ui(language, "expansionPhase")}`
        : ui(language, "noMeaningfulChange");

  return {
    days,
    deltas,
    observations,
    inference,
    confidence: Math.abs(colour) > 4 || (growth !== null && growth > 5) ? "high" : "low",
  };
}

/* ------------------------------------------------------------- ask garden */

export interface AskAnswer {
  question: string;
  grounded: string[];
  inference?: string;
  evidence: string[];
}

export function askGarden(
  question: string,
  ctx: { plant: Plant; events: PlantEvent[]; photos: Photo[]; tasks: CareTask[] },
  language = preferredLanguage(),
): AskAnswer {
  const q = question.toLowerCase();
  const evts = plantEvents(ctx.events, ctx.plant.id);
  const pics = plantPhotos(ctx.photos, ctx.plant.id);
  const open = openTasks(ctx.tasks.filter((t) => t.plantId === ctx.plant.id));
  const k = knowledge.find((e) => e.id === ctx.plant.knowledgeId);

  const answer = (grounded: string[], inference?: string, evidence: string[] = []) => ({
    question,
    grounded,
    evidence,
    ...(inference !== undefined && { inference }),
  });

  if (/fertil|nutrient|feed/.test(q)) {
    const last = evts.find((e) => /nutrient|feed|epsom/i.test(e.title) || /nutrient/i.test(e.detail ?? ""));
    return answer(
      last
        ? [language === "es" ? `Último abonado de ${ctx.plant.name}: ${last.title} — ${formatDate(last.daysAgo, language)} (${relativeDay(last.daysAgo, language)}).` : `Last feed for ${ctx.plant.name}: ${last.title} — ${formatDate(last.daysAgo, language)} (${relativeDay(last.daysAgo, language)}).`,
           last.detail ? `${language === "es" ? "Detalle registrado" : "Logged detail"}: ${last.detail}` : (language === "es" ? "No se registró ningún detalle adicional." : "No extra detail was logged.")]
        : [language === "es" ? `No hay ningún evento de nutrientes registrado para ${ctx.plant.name}.` : `No nutrient event is recorded for ${ctx.plant.name}.`],
      last && last.daysAgo > 14
        ? language === "es" ? `Fue hace ${last.daysAgo} días. Para ${k?.common ?? "esta especie"}, abonar cada 10–14 días suele ser habitual durante el crecimiento activo, así que probablemente corresponda — pero no tengo una lectura de hojas o agua que confirme la necesidad.` : `That is ${last.daysAgo} days ago. For ${k?.common ?? "this species"} a feed every 10–14 days is typical in active growth, so it is probably due — but I have no leaf or water reading to confirm need.`
        : undefined,
      last ? [`${ui(language, "recordedEventEvidence")} · ${formatDate(last.daysAgo, language)}`] : [],
    );
  }

  if (/water|thirst/.test(q)) {
    const last = evts.find((e) => /water/i.test(e.title));
    return answer(
      last
        ? [language === "es" ? `Último riego: ${formatDate(last.daysAgo, language)} (${relativeDay(last.daysAgo, language)}).` : `Last watering: ${formatDate(last.daysAgo, language)} (${relativeDay(last.daysAgo, language)}).`, last.detail ?? ""].filter(Boolean)
        : [language === "es" ? "Todavía no hay ningún evento de riego registrado." : "No watering event is recorded yet."],
      undefined,
      last ? [`${ui(language, "recordedEventEvidence")} · ${formatDate(last.daysAgo, language)}`] : [],
    );
  }

  if (/improv|better|since last|change/.test(q)) {
    if (pics.length >= 2) {
      const a = pics[pics.length - 2]!;
      const b = pics[pics.length - 1]!;
      const cmp = comparePhotos(a, b, ctx.plant, language);
      return answer(
        [language === "es" ? `Entre el ${formatDate(a.daysAgo, language)} y el ${formatDate(b.daysAgo, language)}:` : `Between ${formatDate(a.daysAgo, language)} and ${formatDate(b.daysAgo, language)}:`, ...cmp.observations],
        cmp.inference,
        [`${ui(language, "photo")} · ${formatDate(a.daysAgo, language)}`, `${ui(language, "photo")} · ${formatDate(b.daysAgo, language)}`],
      );
    }
    return answer([language === "es" ? "Sólo existe una foto, así que no hay otra con la que comparar." : "Only one photo exists, so there is nothing to compare against."]);
  }

  if (/today|now|next|should i do/.test(q)) {
    return answer(
      open.length
        ? open.slice(0, 3).map((t) => `${t.label} — ${dueLabel(t.dueInDays, language)}${t.hint ? ` (${t.hint})` : ""}`)
        : [language === "es" ? `Hoy no hay nada programado para ${ctx.plant.name}.` : `Nothing is scheduled for ${ctx.plant.name} today.`],
      open.length ? undefined : language === "es" ? "Sólo por el ritmo habitual, lo siguiente probablemente sea regar. No está programado; es sólo un patrón." : "Based on cadence alone, the next thing due will likely be watering. Not scheduled, just a pattern.",
      open.map((t) => `${ui(language, "taskEvidence")} · ${t.label}`),
    );
  }

  if (/faster|slower|compare|than the other/.test(q)) {
    return answer(
      [
        language === "es" ? `${ctx.plant.name} lleva ${ageLabel(ctx.plant.plantedDaysAgo, language).toLowerCase()}, con ${evts.length} eventos registrados y ${pics.length} fotos.` : `${ctx.plant.name} is ${ageLabel(ctx.plant.plantedDaysAgo, language).toLowerCase()}, ${evts.length} events recorded, ${pics.length} photos.`,
        `${language === "es" ? "Los cuidados registrados incluyen" : "Recorded maintenance includes"}: ${[...new Set(evts.filter((e) => e.type === "maintenance" || e.type === "pruning").map((e) => e.title))].slice(0, 3).join(", ") || (language === "es" ? "ninguno" : "none")}.`,
      ],
      `Differences in speed between two plants of the same species usually track light hours, root volume, and pruning history. I can see the pruning history here; I have no light measurement, so this stays a hypothesis.`,
      [`${evts.length} ${ui(language, "eventRecords")}`, `${pics.length} ${ui(language, "photos").toLowerCase()}`],
    );
  }

  if (/problem|issue|sick|wrong|yellow/.test(q)) {
    const problems = evts.filter((e) => e.type === "problem");
    return answer(
      problems.length
        ? problems.map((p) => `${p.title} — ${formatDate(p.daysAgo, language)}${p.detail ? `. ${p.detail}` : ""}`)
        : [language === "es" ? `No hay ningún problema registrado para ${ctx.plant.name}.` : `No problem has been recorded for ${ctx.plant.name}.`],
      problems.length ? language === "es" ? `Problemas comunes de ${k?.common}: ${k?.problems.slice(0, 3).join(", ")}. Datos de referencia, no un diagnóstico de esta planta.` : `Common issues for ${k?.common}: ${k?.problems.slice(0, 3).join(", ")}. Reference data, not a diagnosis of this plant.` : undefined,
      problems.map((p) => `${ui(language, "recordedEventEvidence")} · ${formatDate(p.daysAgo, language)}`),
    );
  }

  if (/harvest|pick|eat/.test(q)) {
    const harvests = evts.filter((e) => e.type === "harvest");
    return answer(
      harvests.length
        ? harvests.map((h) => `${h.title} — ${formatDate(h.daysAgo, language)}${h.detail ? `. ${h.detail}` : ""}`)
        : [language === "es" ? "Todavía no se ha cosechado nada de esta planta." : "Nothing has been harvested from this plant yet."],
      language === "es" ? `Ciclo de referencia de ${k?.common}: ${k?.harvest}. ${ctx.plant.name} está en el día ${ctx.plant.plantedDaysAgo}.` : `Reference cycle for ${k?.common}: ${k?.harvest}. ${ctx.plant.name} is at day ${ctx.plant.plantedDaysAgo}.`,
      harvests.map((h) => `${ui(language, "recordedEventEvidence")} · ${formatDate(h.daysAgo, language)}`),
    );
  }

  return answer(
    [
      `${ctx.plant.name} · ${ctx.plant.species} “${ctx.plant.variety}”, ${ageLabel(ctx.plant.plantedDaysAgo, language).toLowerCase()}.`,
      `${evts.length} ${ui(language, "eventRecords")}, ${pics.length} ${ui(language, "photos").toLowerCase()}, ${open.length} ${language === "es" ? "tareas abiertas" : "open tasks"}. ${ui(language, "currentStatus")}: ${localizedStatusLabel(ctx.plant.status, language)} — ${ctx.plant.statusNote}`,
    ],
    ui(language, "askRecordedContext"),
    [`${evts.length} ${ui(language, "eventRecords")}`],
  );
}

export function askWholeGarden(
  question: string,
  ctx: { gardens: Garden[]; plants: Plant[]; events: PlantEvent[]; photos: Photo[]; tasks: CareTask[] },
  language = preferredLanguage(),
): AskAnswer {
  const q = question.toLowerCase();
  const active = ctx.plants.filter((plant) => !plant.cycleClosed);
  const open = openTasks(ctx.tasks);
  const answer = (grounded: string[], inference?: string, evidence: string[] = []): AskAnswer => ({
    question,
    grounded,
    evidence,
    ...(inference !== undefined && { inference }),
  });

  if (/today|now|attention|need|next/.test(q)) {
    return answer(
      open.length
        ? open.slice(0, 5).map((task) => {
            const plant = active.find((item) => item.id === task.plantId);
            return `${plant?.name ?? ui(language, "plant")}: ${task.label} — ${dueLabel(task.dueInDays, language)}.`;
          })
        : [ui(language, "nothingScheduled")],
      undefined,
      open.slice(0, 5).map((task) => `${ui(language, "taskEvidence")} · ${task.label}`),
    );
  }

  if (/problem|issue|watch|recover|yellow/.test(q)) {
    const attention = active.filter((plant) => plant.status === "watching" || plant.status === "recovering");
    return answer(
      attention.length
        ? attention.map((plant) => `${plant.name}: ${localizedStatusLabel(plant.status, language)} — ${plant.statusNote}`)
        : [ui(language, "noAttentionPlants")],
      undefined,
      attention.map((plant) => `${ui(language, "plantStatusEvidence")} · ${plant.name}`),
    );
  }

  if (/photo|change|history|recent/.test(q)) {
    const recent = [...ctx.events]
      .filter((event) => active.some((plant) => plant.id === event.plantId))
      .sort((a, b) => a.daysAgo - b.daysAgo)
      .slice(0, 5);
    return answer(
      recent.length
        ? recent.map((event) => {
            const plant = active.find((item) => item.id === event.plantId);
            return `${plant?.name ?? ui(language, "plant")}: ${event.title} — ${relativeDay(event.daysAgo, language)}.`;
          })
        : [ui(language, "noRecentHistory")],
      undefined,
      recent.map((event) => `${ui(language, "recordedEventEvidence")} · ${formatDate(event.daysAgo)}`),
    );
  }

  return answer(
    [
      `${active.length} ${ui(language, "activePlantsAcross")} ${ctx.gardens.length} ${ui(language, "gardens").toLowerCase()}.`,
      `${ctx.events.length} ${ui(language, "eventRecords")}, ${ctx.photos.length} ${ui(language, "photos").toLowerCase()}, ${open.length} ${language === "es" ? "tareas de cuidado abiertas" : "open care items"} ${ui(language, "contextAvailable")}`,
    ],
    ui(language, "askInterpretation"),
    [`${active.length} ${ui(language, "plantRecords")}`, `${ctx.events.length} ${ui(language, "eventRecords")}`],
  );
}

export function askSuggestions(language: UiLanguage = preferredLanguage()) {
  return language === "es"
    ? [
        "¿Cuándo fertilicé esta planta por última vez?",
        "¿Mejoró desde la semana pasada?",
        "¿Por qué crece más rápido que la otra?",
        "¿Qué debería hacer hoy?",
        "¿Tuvo algún problema?",
      ]
    : [
        "When did I last fertilize this plant?",
        "Did it improve since last week?",
        "Why is this growing faster than the other one?",
        "What should I do today?",
        "Has it ever had a problem?",
      ];
}
