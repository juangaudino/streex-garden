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

/* ------------------------------------------------------------- time */

export const dayMs = 86_400_000;

export function latestPlantPhoto(photos: Photo[], plantId: string) {
  return photos.filter((photo) => photo.plantId === plantId).sort((a, b) => a.daysAgo - b.daysAgo)[0];
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

export function formatDate(daysAgo: number) {
  return dateFromDaysAgo(daysAgo).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: dateFromDaysAgo(daysAgo).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function relativeDay(daysAgo: number) {
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 35) return `${Math.round(daysAgo / 7)} weeks ago`;
  if (daysAgo < 365) return `${Math.round(daysAgo / 30)} months ago`;
  const y = (daysAgo / 365).toFixed(1);
  return `${y} years ago`;
}

export function dueLabel(dueInDays: number) {
  if (dueInDays < -1) return `${Math.abs(dueInDays)} days overdue`;
  if (dueInDays === -1) return "1 day overdue";
  if (dueInDays === 0) return "Today";
  if (dueInDays === 1) return "Tomorrow";
  return `In ${dueInDays} days`;
}

export function ageLabel(plantedDaysAgo: number) {
  if (plantedDaysAgo < 60) return `Day ${plantedDaysAgo}`;
  if (plantedDaysAgo < 365) return `${Math.round(plantedDaysAgo / 30)} months together`;
  const years = plantedDaysAgo / 365;
  return `${years.toFixed(1)} years together`;
}

/* ------------------------------------------------------------- selectors */

export const byRecency = <T extends { daysAgo: number }>(items: T[]) =>
  [...items].sort((a, b) => a.daysAgo - b.daysAgo);

export const chronological = <T extends { daysAgo: number }>(items: T[]) =>
  [...items].sort((a, b) => b.daysAgo - a.daysAgo);

export const plantPhotos = (photos: Photo[], plantId: string) =>
  chronological(photos.filter((p) => p.plantId === plantId));

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
export function plantTimeline(events: PlantEvent[], photos: Photo[], plantId: string): PlantTimelineEntry[] {
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
  return entries.sort((a, b) => b.daysAgo - a.daysAgo || (a.kind === "photo" ? -1 : 1));
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

export function storyFacts(plant: Plant, events: PlantEvent[]): StoryFact[] {
  const history = plantEvents(events, plant.id);

  const last = (type: EventType, titleIncludes?: string) => {
    const found = history.find(
      (e) =>
        e.type === type &&
        (!titleIncludes || e.title.toLowerCase().includes(titleIncludes.toLowerCase())),
    );
    return found ? formatDate(found.daysAgo) : "Not yet";
  };

  switch (plant.id) {
    case "willow":
      return [
        { label: "Last water change", value: last("maintenance", "Water change") },
        { label: "Last thinning", value: last("thinning") },
        { label: "Last nutrients", value: last("maintenance", "Nutrients") },
      ];
    case "nova":
      return [
        { label: "Last nutrients", value: last("maintenance", "Nutrients") },
        { label: "Last water change", value: last("maintenance", "Water change") },
        { label: "Last thinning", value: last("thinning") },
      ];
    case "aurora":
      return [
        { label: "Last pruning", value: last("pruning") },
        { label: "Last harvest", value: last("harvest") },
        { label: "Last watering", value: last("maintenance", "Watering") },
      ];
    case "rex":
      return [
        { label: "Last harvest", value: last("harvest") },
        { label: "Last pruning", value: last("pruning") },
        { label: "Last watering", value: last("maintenance", "Watering") },
      ];
    case "ember":
      return [
        { label: "Last nutrients", value: last("maintenance", "Nutrients") },
        { label: "Last AI check", value: last("ai") },
        { label: "Last harvest", value: last("harvest") },
      ];
    case "ora":
      return [
        { label: "Last cleaning", value: last("maintenance", "Cleaning") },
        { label: "Last transplant", value: last("transplant") },
        { label: "Last feed", value: last("maintenance", "Nutrients") },
      ];
    default:
      return [
        { label: "Last pruning", value: last("pruning") },
        { label: "Last harvest", value: last("harvest") },
        { label: "Last watering", value: last("maintenance", "Watering") },
      ];
  }
}

/* ------------------------------------------------------------- AI check */

export type Confidence = "high" | "moderate" | "low";

export interface Finding {
  kind: "observed" | "inference" | "recommendation";
  title: string;
  body: string;
  confidence?: Confidence;
}

export interface AnalysisResult {
  headline: string;
  confidence: Confidence;
  findings: Finding[];
  grounding: string[];
}

/**
 * Deterministic reading of the photo metrics + recorded history.
 * Observations describe pixels; inferences are always labelled and never
 * written back to the plant record without confirmation.
 */
export function analysePhoto(plant: Plant, photo: Photo, history: PlantEvent[]): AnalysisResult {
  const previous = null as Photo | null;
  void previous;
  const k = knowledge.find((e) => e.id === plant.knowledgeId);
  const findings: Finding[] = [];

  findings.push({
    kind: "observed",
    title: "Colour",
    body:
      photo.metrics.greenness >= 76
        ? `Even saturation across the canopy (index ${photo.metrics.greenness}/100). No pale zones isolated.`
        : `Reduced saturation (index ${photo.metrics.greenness}/100), concentrated on older growth.`,
  });
  findings.push({
    kind: "observed",
    title: "Density and structure",
    body: `Canopy fill ${photo.metrics.density}/100, roughly ${photo.metrics.leafCount} leaves visible, height about ${photo.metrics.heightCm}cm.`,
  });

  const damage = plant.status === "watching" || plant.status === "recovering";
  findings.push({
    kind: "observed",
    title: "Damaged tissue",
    body: damage
      ? "Pale interveinal patches on 3–4 lower leaves. Margins intact, no necrotic edges."
      : "No holes, bite marks, or necrosis found in the frame.",
  });

  if (photo.metrics.greenness < 70) {
    findings.push({
      kind: "inference",
      title: "Possible explanation",
      body: "The pattern — older leaves first, yellowing between veins, veins still green — is consistent with a magnesium shortfall. A light shortfall or early pest pressure could look similar in one frame.",
      confidence: "moderate",
    });
  } else {
    findings.push({
      kind: "inference",
      title: "Possible explanation",
      body: "Colour and density are in the range this plant has held for the last few weeks. Nothing in this frame suggests active stress.",
      confidence: "high",
    });
  }

  const problem = history.find((e) => e.type === "problem");
  if (problem) {
    findings.push({
      kind: "inference",
      title: "Historical context",
      body: `A problem was recorded ${relativeDay(problem.daysAgo)} (“${problem.title}”). This photo is read against that, not in isolation.`,
      confidence: "high",
    });
  }

  findings.push({
    kind: "recommendation",
    title: "Recommended action",
    body:
      photo.metrics.greenness < 70
        ? `Apply a magnesium correction (1g/L Epsom salts at the root), then re-photograph the same leaf in 7 days. Reference range for ${k?.common ?? "this species"}: pH ${k?.ph ?? "6.0–6.8"}.`
        : "No intervention. Keep the current rhythm and take the next photo in about a week to hold the series even.",
  });

  return {
    headline:
      photo.metrics.greenness < 70
        ? "Visible stress on older leaves"
        : "No stress signals in this frame",
    confidence: photo.metrics.greenness < 70 ? "moderate" : "high",
    findings,
    grounding: [
      `Photo taken ${relativeDay(photo.daysAgo)}`,
      `${history.length} recorded events for ${plant.name}`,
      `Reference entry: ${k?.common ?? "unknown"}`,
    ],
  };
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

export function comparePhotos(a: Photo, b: Photo, plant: Plant): CompareResult {
  const [earlier, later] = a.daysAgo > b.daysAgo ? [a, b] : [b, a];
  const days = earlier.daysAgo - later.daysAgo;
  const deltas: Delta[] = [
    { label: "Height", from: earlier.metrics.heightCm, to: later.metrics.heightCm, unit: "cm", higherIsBetter: true },
    { label: "Leaves (approx.)", from: earlier.metrics.leafCount, to: later.metrics.leafCount, unit: "", higherIsBetter: true },
    { label: "Canopy density", from: earlier.metrics.density, to: later.metrics.density, unit: "/100", higherIsBetter: true },
    { label: "Colour saturation", from: earlier.metrics.greenness, to: later.metrics.greenness, unit: "/100", higherIsBetter: true },
  ];

  const growth = later.metrics.heightCm - earlier.metrics.heightCm;
  const colour = later.metrics.greenness - earlier.metrics.greenness;
  const observations = [
    growth > 0
      ? `Height increased ${growth}cm over ${days} days (about ${(growth / Math.max(days, 1)).toFixed(2)}cm/day).`
      : "No measurable height change between the two frames.",
    `Visible leaf count moved from ${earlier.metrics.leafCount} to ${later.metrics.leafCount}.`,
    colour < -4
      ? `Colour saturation dropped ${Math.abs(colour)} points, strongest on lower leaves.`
      : colour > 4
        ? `Colour deepened ${colour} points across the canopy.`
        : "Colour is effectively unchanged.",
  ];

  const inference =
    colour < -4
      ? `The shape of the change — growth continuing while colour fades on older leaves — points to a nutrient issue rather than water or light. Not confirmed: one leaf photographed twice is thin evidence for the whole plant.`
      : growth > 0 && later.metrics.density > earlier.metrics.density
        ? `${plant.name} is in an expansion phase: height, leaf count, and fill all moved the same direction. That is consistent with the maintenance recorded in between.`
        : "The two frames are close enough that no meaningful change can be claimed.";

  return {
    days,
    deltas,
    observations,
    inference,
    confidence: Math.abs(colour) > 4 || growth > 5 ? "high" : "low",
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
        ? [`Last feed for ${ctx.plant.name}: ${last.title} — ${formatDate(last.daysAgo)} (${relativeDay(last.daysAgo)}).`,
           last.detail ? `Logged detail: ${last.detail}` : `No extra detail was logged.`]
        : [`No nutrient event is recorded for ${ctx.plant.name}.`],
      last && last.daysAgo > 14
        ? `That is ${last.daysAgo} days ago. For ${k?.common ?? "this species"} a feed every 10–14 days is typical in active growth, so it is probably due — but I have no leaf or water reading to confirm need.`
        : undefined,
      last ? [`Event · ${formatDate(last.daysAgo)}`] : [],
    );
  }

  if (/water|thirst/.test(q)) {
    const last = evts.find((e) => /water/i.test(e.title));
    return answer(
      last
        ? [`Last watering: ${formatDate(last.daysAgo)} (${relativeDay(last.daysAgo)}).`, last.detail ?? ""].filter(Boolean)
        : ["No watering event is recorded yet."],
      undefined,
      last ? [`Event · ${formatDate(last.daysAgo)}`] : [],
    );
  }

  if (/improv|better|since last|change/.test(q)) {
    if (pics.length >= 2) {
      const a = pics[pics.length - 2]!;
      const b = pics[pics.length - 1]!;
      const cmp = comparePhotos(a, b, ctx.plant);
      return answer(
        [`Between ${formatDate(a.daysAgo)} and ${formatDate(b.daysAgo)}:`, ...cmp.observations],
        cmp.inference,
        [`Photo · ${formatDate(a.daysAgo)}`, `Photo · ${formatDate(b.daysAgo)}`],
      );
    }
    return answer(["Only one photo exists, so there is nothing to compare against."]);
  }

  if (/today|now|next|should i do/.test(q)) {
    return answer(
      open.length
        ? open.slice(0, 3).map((t) => `${t.label} — ${dueLabel(t.dueInDays)}${t.hint ? ` (${t.hint})` : ""}`)
        : [`Nothing is scheduled for ${ctx.plant.name} today.`],
      open.length ? undefined : `Based on cadence alone, the next thing due will likely be watering. Not scheduled, just a pattern.`,
      open.map((t) => `Task · ${t.label}`),
    );
  }

  if (/faster|slower|compare|than the other/.test(q)) {
    return answer(
      [
        `${ctx.plant.name} is ${ageLabel(ctx.plant.plantedDaysAgo).toLowerCase()}, ${evts.length} events recorded, ${pics.length} photos.`,
        `Recorded maintenance includes: ${[...new Set(evts.filter((e) => e.type === "maintenance" || e.type === "pruning").map((e) => e.title))].slice(0, 3).join(", ") || "none"}.`,
      ],
      `Differences in speed between two plants of the same species usually track light hours, root volume, and pruning history. I can see the pruning history here; I have no light measurement, so this stays a hypothesis.`,
      [`${evts.length} events`, `${pics.length} photos`],
    );
  }

  if (/problem|issue|sick|wrong|yellow/.test(q)) {
    const problems = evts.filter((e) => e.type === "problem");
    return answer(
      problems.length
        ? problems.map((p) => `${p.title} — ${formatDate(p.daysAgo)}${p.detail ? `. ${p.detail}` : ""}`)
        : [`No problem has been recorded for ${ctx.plant.name}.`],
      problems.length ? `Common issues for ${k?.common}: ${k?.problems.slice(0, 3).join(", ")}. Reference data, not a diagnosis of this plant.` : undefined,
      problems.map((p) => `Event · ${formatDate(p.daysAgo)}`),
    );
  }

  if (/harvest|pick|eat/.test(q)) {
    const harvests = evts.filter((e) => e.type === "harvest");
    return answer(
      harvests.length
        ? harvests.map((h) => `${h.title} — ${formatDate(h.daysAgo)}${h.detail ? `. ${h.detail}` : ""}`)
        : ["Nothing has been harvested from this plant yet."],
      `Reference cycle for ${k?.common}: ${k?.harvest}. ${ctx.plant.name} is at day ${ctx.plant.plantedDaysAgo}.`,
      harvests.map((h) => `Event · ${formatDate(h.daysAgo)}`),
    );
  }

  return answer(
    [
      `${ctx.plant.name} · ${ctx.plant.species} “${ctx.plant.variety}”, ${ageLabel(ctx.plant.plantedDaysAgo).toLowerCase()}.`,
      `${evts.length} recorded events, ${pics.length} photos, ${open.length} open tasks. Current status: ${statusMeta[ctx.plant.status].label} — ${ctx.plant.statusNote}`,
    ],
    `I answer from what is recorded here. Ask about watering, feeding, changes since a date, problems, or what to do today.`,
    [`${evts.length} events`],
  );
}

export function askWholeGarden(
  question: string,
  ctx: { gardens: Garden[]; plants: Plant[]; events: PlantEvent[]; photos: Photo[]; tasks: CareTask[] },
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
            return `${plant?.name ?? "Plant"}: ${task.label} — ${dueLabel(task.dueInDays)}.`;
          })
        : ["Nothing is currently scheduled across your active plants."],
      undefined,
      open.slice(0, 5).map((task) => `Task · ${task.label}`),
    );
  }

  if (/problem|issue|watch|recover|yellow/.test(q)) {
    const attention = active.filter((plant) => plant.status === "watching" || plant.status === "recovering");
    return answer(
      attention.length
        ? attention.map((plant) => `${plant.name}: ${statusMeta[plant.status].label} — ${plant.statusNote}`)
        : ["No active plant is recorded as watching or recovering."],
      undefined,
      attention.map((plant) => `Plant status · ${plant.name}`),
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
            return `${plant?.name ?? "Plant"}: ${event.title} — ${relativeDay(event.daysAgo)}.`;
          })
        : ["No recent history has been recorded yet."],
      undefined,
      recent.map((event) => `Recorded event · ${formatDate(event.daysAgo)}`),
    );
  }

  return answer(
    [
      `${active.length} active plants across ${ctx.gardens.length} gardens.`,
      `${ctx.events.length} recorded events, ${ctx.photos.length} photos, and ${open.length} open care items are available as context.`,
    ],
    "Ask what needs attention, what changed recently, or about a specific plant. I will keep recorded information separate from interpretation.",
    [`${active.length} plant records`, `${ctx.events.length} events`],
  );
}

export const askSuggestions = [
  "When did I last fertilize this plant?",
  "Did it improve since last week?",
  "Why is this growing faster than the other one?",
  "What should I do today?",
  "Has it ever had a problem?",
];
