const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
const gardenIndoor = EMPTY_IMAGE;
const gardenBackyard = EMPTY_IMAGE;
const gardenBalcony = EMPTY_IMAGE;
const tomato1 = EMPTY_IMAGE;
const tomato2 = EMPTY_IMAGE;
const tomato3 = EMPTY_IMAGE;
const basil1 = EMPTY_IMAGE;
const basil2 = EMPTY_IMAGE;
const monstera1 = EMPTY_IMAGE;
const monstera2 = EMPTY_IMAGE;
const lettuce1 = EMPTY_IMAGE;
const pepper1 = EMPTY_IMAGE;

export const covers = { gardenIndoor, gardenBackyard, gardenBalcony };

/* ---------------------------------------------------------------- types */

export type GardenKind = "hydroponic" | "indoor" | "balcony" | "backyard" | "herb";

export type PlantStatus = "thriving" | "steady" | "watching" | "recovering";

export type MaintenanceType =
  | "watering"
  | "nutrients"
  | "pruning"
  | "harvest"
  | "thinning"
  | "transplant"
  | "cleaning"
  | "pest"
  | "light"
  | "custom";

export type EventType =
  | "planted"
  | "germinated"
  | "photo"
  | "maintenance"
  | "pruning"
  | "harvest"
  | "thinning"
  | "transplant"
  | "problem"
  | "recovery"
  | "flowering"
  | "fruiting"
  | "ai"
  | "note";

/** Every record declares how it was established. AI never writes "fact". */
export type Provenance = "recorded" | "observed" | "inferred";

export interface Garden {
  id: string;
  name: string;
  kind: GardenKind;
  cover: string;
  coverPhotoId?: string | null;
  place: string;
  note: string;
  machine?: { name: string; pods: number };
  archived?: boolean;
}

export interface PlantMetrics {
  heightCm: number;
  leafCount: number;
  greenness: number; // 0-100 deterministic image score
  density: number; // 0-100
}

export interface Photo {
  id: string;
  plantId: string;
  src: string;
  daysAgo: number;
  caption: string;
  metrics: PlantMetrics;
  backendStoragePath?: string;
  backendEventId?: string;
}

export interface PlantEvent {
  id: string;
  plantId: string;
  daysAgo: number;
  type: EventType;
  title: string;
  detail?: string;
  milestone?: boolean;
  photoId?: string;
  provenance: Provenance;
  backendEventType?: string;
  backendRevision?: number;
}

export interface CareTask {
  id: string;
  plantId: string;
  type: MaintenanceType;
  label: string;
  dueInDays: number; // negative = overdue
  done: boolean;
  hint?: string;
  backendAttentionId?: string;
}

export interface Plant {
  id: string;
  gardenId: string;
  name: string;
  species: string;
  scientific: string;
  variety: string;
  knowledgeId: string;
  plantedDaysAgo: number;
  acquired?: string;
  slot?: string;
  status: PlantStatus;
  statusNote: string;
  heroPhotoId: string;
  identityConfirmed: boolean;
  cycleClosed?: boolean;
  backendGrowCycleId?: string;
  backendPositionId?: string;
}

export interface KnowledgeEntry {
  id: string;
  common: string;
  scientific: string;
  variety: string;
  germinationDays: string;
  light: string;
  temperature: string;
  ph: string;
  ec?: string;
  spacing: string;
  pruning: string;
  harvest: string;
  cycle: string;
  problems: string[];
  recommendations: string[];
}

export interface Film {
  id: string;
  plantId: string;
  title: string;
  photoIds: string[];
  music: string;
  createdDaysAgo: number;
}

export interface GardenState {
  gardens: Garden[];
  plants: Plant[];
  photos: Photo[];
  events: PlantEvent[];
  tasks: CareTask[];
  films: Film[];
}

/* ---------------------------------------------------------------- seed */

const g = {
  indoor: "garden-indoor",
  balcony: "garden-balcony",
  backyard: "garden-backyard",
};

export const gardens: Garden[] = [
  {
    id: g.indoor,
    name: "Indoor Studio",
    kind: "hydroponic",
    cover: gardenIndoor,
    place: "Living room, north window",
    note: "Deep water culture unit, 6 pods, LED 14h/day.",
    machine: { name: "Aera One", pods: 6 },
  },
  {
    id: g.balcony,
    name: "Balcony Herbs",
    kind: "balcony",
    cover: gardenBalcony,
    place: "South balcony, 4th floor",
    note: "Terracotta pots, full afternoon sun, wind exposed.",
  },
  {
    id: g.backyard,
    name: "Backyard Beds",
    kind: "backyard",
    cover: gardenBackyard,
    place: "Raised bed, west side",
    note: "Two beds, drip line, compost topped in spring.",
  },
];

export const plants: Plant[] = [
  {
    id: "aurora",
    gardenId: g.backyard,
    name: "Aurora",
    species: "Tomato",
    scientific: "Solanum lycopersicum",
    variety: "San Marzano",
    knowledgeId: "tomato",
    plantedDaysAgo: 96,
    slot: "Bed A · stake 2",
    status: "thriving",
    statusNote: "Fruit set on three trusses.",
    heroPhotoId: "aurora-p3",
    identityConfirmed: true,
  },
  {
    id: "ember",
    gardenId: g.backyard,
    name: "Ember",
    species: "Sweet pepper",
    scientific: "Capsicum annuum",
    variety: "Corno di Toro",
    knowledgeId: "pepper",
    plantedDaysAgo: 74,
    slot: "Bed A · stake 5",
    status: "watching",
    statusNote: "Interveinal yellowing on lower leaves.",
    heroPhotoId: "ember-p2",
    identityConfirmed: true,
  },
  {
    id: "rex",
    gardenId: g.balcony,
    name: "Rex",
    species: "Basil",
    scientific: "Ocimum basilicum",
    variety: "Genovese",
    knowledgeId: "basil",
    plantedDaysAgo: 61,
    slot: "Pot 3 · 18cm terracotta",
    status: "thriving",
    statusNote: "Second flush after pinching.",
    heroPhotoId: "rex-p2",
    identityConfirmed: true,
  },
  {
    id: "ora",
    gardenId: g.indoor,
    name: "Ora",
    species: "Monstera",
    scientific: "Monstera deliciosa",
    variety: "Standard",
    knowledgeId: "monstera",
    plantedDaysAgo: 412,
    acquired: "Adopted from a friend's cutting",
    slot: "Floor pot, 2m from window",
    status: "steady",
    statusNote: "New leaf unfurling, ninth fenestrated.",
    heroPhotoId: "ora-p2",
    identityConfirmed: true,
  },
  {
    id: "nova",
    gardenId: g.indoor,
    name: "Nova",
    species: "Butterhead lettuce",
    scientific: "Lactuca sativa",
    variety: "Rex butterhead",
    knowledgeId: "lettuce",
    plantedDaysAgo: 33,
    slot: "Pod 2",
    status: "thriving",
    statusNote: "Approaching first cut.",
    heroPhotoId: "nova-p2",
    identityConfirmed: true,
  },
  {
    id: "willow",
    gardenId: g.indoor,
    name: "Willow",
    species: "Oak leaf lettuce",
    scientific: "Lactuca sativa",
    variety: "Green oak",
    knowledgeId: "lettuce",
    plantedDaysAgo: 19,
    slot: "Pod 5",
    status: "recovering",
    statusNote: "Recovered after pump interruption on day 9.",
    heroPhotoId: "willow-p1",
    identityConfirmed: true,
  },
];

export const photos: Photo[] = [
  // Aurora — tomato, full arc
  {
    id: "aurora-p1",
    plantId: "aurora",
    src: tomato1,
    daysAgo: 88,
    caption: "First true leaves, sown indoors",
    metrics: { heightCm: 6, leafCount: 4, greenness: 71, density: 18 },
  },
  {
    id: "aurora-p2",
    plantId: "aurora",
    src: tomato2,
    daysAgo: 41,
    caption: "Moved outdoors, first flower cluster",
    metrics: { heightCm: 46, leafCount: 38, greenness: 78, density: 54 },
  },
  {
    id: "aurora-p3",
    plantId: "aurora",
    src: tomato3,
    daysAgo: 4,
    caption: "Three trusses of green fruit",
    metrics: { heightCm: 132, leafCount: 96, greenness: 82, density: 79 },
  },
  // Ember — pepper
  {
    id: "ember-p1",
    plantId: "ember",
    src: pepper1,
    daysAgo: 21,
    caption: "Lower leaf, faint pale patches",
    metrics: { heightCm: 52, leafCount: 41, greenness: 68, density: 49 },
  },
  {
    id: "ember-p2",
    plantId: "ember",
    src: pepper1,
    daysAgo: 3,
    caption: "Same leaf, clearer yellowing between veins",
    metrics: { heightCm: 58, leafCount: 44, greenness: 58, density: 52 },
  },
  // Rex — basil
  {
    id: "rex-p1",
    plantId: "rex",
    src: basil1,
    daysAgo: 47,
    caption: "Two weeks after transplant",
    metrics: { heightCm: 11, leafCount: 10, greenness: 74, density: 22 },
  },
  {
    id: "rex-p2",
    plantId: "rex",
    src: basil2,
    daysAgo: 6,
    caption: "Bushed out after the second pinch",
    metrics: { heightCm: 34, leafCount: 88, greenness: 81, density: 86 },
  },
  // Ora — monstera
  {
    id: "ora-p1",
    plantId: "ora",
    src: monstera1,
    daysAgo: 240,
    caption: "First month in the new pot",
    metrics: { heightCm: 74, leafCount: 9, greenness: 69, density: 38 },
  },
  {
    id: "ora-p2",
    plantId: "ora",
    src: monstera2,
    daysAgo: 9,
    caption: "New leaf unfurling, deeper colour",
    metrics: { heightCm: 128, leafCount: 17, greenness: 77, density: 66 },
  },
  // Nova — lettuce pod 2
  {
    id: "nova-p1",
    plantId: "nova",
    src: lettuce1,
    daysAgo: 16,
    caption: "Rosette closing over the collar",
    metrics: { heightCm: 9, leafCount: 14, greenness: 76, density: 41 },
  },
  {
    id: "nova-p2",
    plantId: "nova",
    src: lettuce1,
    daysAgo: 2,
    caption: "Full head, ready within days",
    metrics: { heightCm: 17, leafCount: 26, greenness: 80, density: 72 },
  },
  // Willow — lettuce pod 5
  {
    id: "willow-p1",
    plantId: "willow",
    src: lettuce1,
    daysAgo: 1,
    caption: "Back in rhythm after the pump stall",
    metrics: { heightCm: 8, leafCount: 11, greenness: 74, density: 33 },
  },
];

export const events: PlantEvent[] = [
  // Aurora
  ev("aurora", 96, "planted", "Sown indoors", "Seed tray, heat mat 24°C.", true),
  ev("aurora", 90, "germinated", "Germinated", "5 of 6 seeds up on day 6.", true),
  ev("aurora", 88, "photo", "First true leaves", undefined, true, "aurora-p1"),
  ev("aurora", 62, "transplant", "Transplanted to Bed A", "Buried stem to first leaf node.", true),
  ev("aurora", 54, "maintenance", "Nutrients", "Tomato feed, half strength."),
  ev("aurora", 47, "pruning", "First pruning", "Removed lower suckers.", true),
  ev("aurora", 44, "flowering", "First flowers", "Cluster on truss 1.", true),
  ev("aurora", 41, "photo", "Growth photo", undefined, false, "aurora-p2"),
  ev("aurora", 33, "problem", "Leaf curl after heatwave", "Three days above 34°C."),
  ev("aurora", 26, "recovery", "Curl resolved", "Shade cloth + evening watering.", true),
  ev("aurora", 18, "fruiting", "First fruit set", "Four fruits on truss 1.", true),
  ev("aurora", 9, "maintenance", "Watering", "12L, drip line 40 min."),
  ev("aurora", 4, "photo", "Growth photo", undefined, false, "aurora-p3"),
  ev("aurora", 4, "ai", "AI check: healthy vigour", "Density up, no stress signals found.", false, "aurora-p3", "inferred"),
  // Ember
  ev("ember", 74, "planted", "Planted as seedling", "Nursery start, 12cm tall.", true),
  ev("ember", 55, "maintenance", "Nutrients", "Balanced feed 5-5-5."),
  ev("ember", 38, "flowering", "First flowers", undefined, true),
  ev("ember", 21, "photo", "Lower leaf photo", undefined, false, "ember-p1"),
  ev("ember", 12, "note", "Noticed pale patches", "Only lower third of the plant.", false, undefined, "observed"),
  ev("ember", 3, "photo", "Follow-up photo", undefined, false, "ember-p2"),
  ev("ember", 3, "ai", "AI check: possible magnesium shortfall", "Pattern between veins, older leaves first.", false, "ember-p2", "inferred"),
  // Rex
  ev("rex", 61, "planted", "Sown in tray", undefined, true),
  ev("rex", 54, "germinated", "Germinated", "Day 7, warm windowsill.", true),
  ev("rex", 47, "photo", "Growth photo", undefined, false, "rex-p1"),
  ev("rex", 40, "transplant", "Moved to balcony pot", undefined, true),
  ev("rex", 31, "pruning", "First pinch", "Topped above second node.", true),
  ev("rex", 20, "harvest", "First harvest", "28g of leaves for pesto.", true),
  ev("rex", 12, "pruning", "Second pinch", "Removed early flower buds."),
  ev("rex", 6, "photo", "Growth photo", undefined, false, "rex-p2"),
  ev("rex", 2, "maintenance", "Watering", "1L, soil dry at 3cm."),
  // Ora
  ev("ora", 412, "planted", "Adopted as a cutting", "Rooted in water for 5 weeks.", true),
  ev("ora", 300, "transplant", "Potted up to 30cm", undefined, true),
  ev("ora", 240, "photo", "Growth photo", undefined, false, "ora-p1"),
  ev("ora", 180, "note", "First fenestrated leaf", "Leaf 6 opened with holes.", true, undefined, "observed"),
  ev("ora", 120, "maintenance", "Cleaning", "Dusted leaves, wiped both sides."),
  ev("ora", 64, "problem", "Two lower leaves yellowed", "Likely overwatering in winter."),
  ev("ora", 40, "recovery", "Stabilised", "Watering interval moved to 12 days.", true),
  ev("ora", 14, "maintenance", "Nutrients", "Diluted foliage feed."),
  ev("ora", 9, "photo", "New leaf unfurling", undefined, true, "ora-p2"),
  // Nova
  ev("nova", 33, "planted", "Sown in pod 2", "Rockwool plug, EC 0.8.", true),
  ev("nova", 29, "germinated", "Germinated", "Day 4 under dome.", true),
  ev("nova", 24, "thinning", "Thinned to one seedling", undefined),
  ev("nova", 21, "maintenance", "Nutrients", "EC raised to 1.4."),
  ev("nova", 16, "photo", "Growth photo", undefined, false, "nova-p1"),
  ev("nova", 10, "maintenance", "Water change", "Full reservoir change, pH 5.9."),
  ev("nova", 2, "photo", "Growth photo", undefined, false, "nova-p2"),
  // Willow
  ev("willow", 19, "planted", "Sown in pod 5", undefined, true),
  ev("willow", 15, "germinated", "Germinated", undefined, true),
  ev("willow", 9, "problem", "Pump interruption", "Reservoir circulation stopped ~14h."),
  ev("willow", 8, "maintenance", "Water change", "Refilled, pH 6.0, EC 1.2."),
  ev("willow", 4, "recovery", "New growth resumed", "Two new leaves since the stall.", true),
  ev("willow", 1, "photo", "Growth photo", undefined, false, "willow-p1"),
];

function ev(
  plantId: string,
  daysAgo: number,
  type: EventType,
  title: string,
  detail?: string,
  milestone?: boolean,
  photoId?: string,
  provenance: Provenance = "recorded",
): PlantEvent {
  return {
    id: `${plantId}-${type}-${daysAgo}`,
    plantId,
    daysAgo,
    type,
    title,
    provenance,
    ...(detail !== undefined && { detail }),
    ...(milestone !== undefined && { milestone }),
    ...(photoId !== undefined && { photoId }),
  };
}

export const tasks: CareTask[] = [
  t("ember", "nutrients", "Magnesium correction feed", -1, "Epsom 1g/L, water in at the root."),
  t("aurora", "watering", "Deep water", 0, "12L via drip, early morning."),
  t("aurora", "pruning", "Remove lower suckers", 2),
  t("rex", "harvest", "Cut top third", 0, "Take above a leaf pair to keep it bushy."),
  t("nova", "harvest", "First cut", 1, "Outer leaves first, leave the crown."),
  t("nova", "nutrients", "Top up reservoir", 3),
  t("willow", "cleaning", "Check pump and lines", -2, "Confirm flow at pod 5."),
  t("ora", "watering", "Water when dry at 5cm", 4),
  t("ora", "cleaning", "Dust leaves", 9),
  t("ember", "pest", "Inspect undersides", 1, "Looking for aphids on new growth."),
];

function t(
  plantId: string,
  type: MaintenanceType,
  label: string,
  dueInDays: number,
  hint?: string,
): CareTask {
  return {
    id: `${plantId}-${type}-${dueInDays}`,
    plantId,
    type,
    label,
    dueInDays,
    done: false,
    ...(hint !== undefined && { hint }),
  };
}

export const films: Film[] = [
  {
    id: "film-aurora",
    plantId: "aurora",
    title: "Aurora · seed to fruit",
    photoIds: ["aurora-p1", "aurora-p2", "aurora-p3"],
    music: "Still Water",
    createdDaysAgo: 3,
  },
];

export const knowledge: KnowledgeEntry[] = [
  {
    id: "tomato",
    common: "Tomato",
    scientific: "Solanum lycopersicum",
    variety: "San Marzano",
    germinationDays: "6–10 days at 22–26°C",
    light: "6–8h direct sun",
    temperature: "18–27°C, above 34°C causes flower drop",
    ph: "6.0–6.8",
    ec: "2.0–3.5 mS/cm in hydroponics",
    spacing: "50–60cm",
    pruning: "Remove suckers weekly, keep 1–2 main stems",
    harvest: "60–85 days after transplant",
    cycle: "Annual, 4–6 months",
    problems: ["Blossom end rot", "Leaf curl in heat", "Early blight", "Magnesium shortfall"],
    recommendations: [
      "Water deeply and less often to build deep roots",
      "Feed potassium-forward once fruit sets",
      "Keep foliage dry when watering",
    ],
  },
  {
    id: "pepper",
    common: "Sweet pepper",
    scientific: "Capsicum annuum",
    variety: "Corno di Toro",
    germinationDays: "8–14 days at 25–28°C",
    light: "6h+ direct sun",
    temperature: "20–30°C",
    ph: "6.0–6.8",
    ec: "1.8–2.8 mS/cm",
    spacing: "40–45cm",
    pruning: "Remove the first king flower to build structure",
    harvest: "70–90 days from transplant",
    cycle: "Annual in cold climates, perennial in mild ones",
    problems: ["Magnesium deficiency on older leaves", "Aphids", "Sunscald", "Blossom drop in heat"],
    recommendations: [
      "Correct interveinal yellowing with magnesium, not more nitrogen",
      "Stake early, branches get brittle when loaded",
    ],
  },
  {
    id: "basil",
    common: "Basil",
    scientific: "Ocimum basilicum",
    variety: "Genovese",
    germinationDays: "5–8 days at 20–25°C",
    light: "5–6h sun, light shade in extreme heat",
    temperature: "18–30°C, damaged below 10°C",
    ph: "6.0–7.0",
    ec: "1.0–1.6 mS/cm",
    spacing: "20–25cm",
    pruning: "Pinch above a leaf pair every 2–3 weeks, remove flower buds",
    harvest: "From 4 weeks, continuous",
    cycle: "Annual, 4–5 months productive",
    problems: ["Bolting", "Downy mildew", "Cold damage", "Leggy growth in low light"],
    recommendations: ["Pinch early and often", "Harvest in the morning for the best oils"],
  },
  {
    id: "lettuce",
    common: "Lettuce",
    scientific: "Lactuca sativa",
    variety: "Butterhead / Green oak",
    germinationDays: "3–6 days at 18–22°C",
    light: "12–16h under LED",
    temperature: "15–22°C, bolts above 26°C",
    ph: "5.8–6.2",
    ec: "1.2–1.8 mS/cm",
    spacing: "One plant per pod, 20cm",
    pruning: "Outer-leaf harvest, keep the crown",
    harvest: "28–45 days from sowing",
    cycle: "Fast annual, 5–7 weeks",
    problems: ["Tip burn", "Bolting in heat", "Root rot if flow stops", "Algae in the reservoir"],
    recommendations: [
      "Change the reservoir every 10–14 days",
      "Keep water below 22°C to protect the roots",
    ],
  },
  {
    id: "monstera",
    common: "Monstera",
    scientific: "Monstera deliciosa",
    variety: "Standard",
    germinationDays: "Propagated from cuttings, roots in 3–6 weeks",
    light: "Bright indirect, no harsh midday sun",
    temperature: "18–27°C",
    ph: "5.5–7.0",
    spacing: "Pot 5cm wider than the root ball",
    pruning: "Remove damaged leaves, guide aerial roots to a pole",
    harvest: "Not applicable",
    cycle: "Perennial, decades",
    problems: ["Overwatering and root rot", "Small leaves without fenestration in low light", "Spider mites"],
    recommendations: [
      "Let the top 5cm dry before watering",
      "Fenestration follows light and maturity, not fertiliser",
    ],
  },
];

export const initialState: GardenState = { gardens, plants, photos, events, tasks, films };

export const musicOptions = [
  { id: "still-water", name: "Still Water", mood: "Slow piano, wide reverb" },
  { id: "first-light", name: "First Light", mood: "Warm strings, gentle rise" },
  { id: "soil", name: "Soil", mood: "Low hum, close textures" },
  { id: "none", name: "No music", mood: "Silence, just the photos" },
];