import type { GardenLibraryEntry } from "./garden-library";
import type { Garden, Photo, Plant, PlantEvent } from "./garden-data";
import { formatDate, plantEvents, plantPhotos } from "./garden-logic";
import { ui, type UiLanguage } from "./ui-copy";

export type PlantStoryEvidenceKind =
  "identity" | "origin" | "cycle" | "event" | "photo" | "location";

export type PlantStoryEvidenceRef = {
  id: string;
  kind: PlantStoryEvidenceKind;
  label: string;
};

export type PlantStoryFact = {
  id: string;
  label: string;
  value: string;
  evidence: PlantStoryEvidenceRef[];
};

export type PlantStoryInterpretation = {
  id: string;
  text: string;
  confidence: "high" | "moderate" | "low";
  evidence: PlantStoryEvidenceRef[];
};

export type PlantStoryObservation = {
  id: string;
  text: string;
  evidence: PlantStoryEvidenceRef[];
};

export type PlantStoryPhotoEvidence = {
  id: string;
  capturedAt: string;
  metadataOnly: boolean;
  evidence: PlantStoryEvidenceRef[];
};

export type PlantStoryContext = {
  schemaVersion: "plant_story_context_v1";
  plant: {
    id: string;
    name: string;
    commonName: string;
    scientificName: string | null;
    cultivar: string | null;
    libraryPlantId: string | null;
    originType: Plant["originType"];
    ageDays: number | null;
    cycleId: string | null;
    cycleClosed: boolean;
  };
  current: {
    gardenName: string;
    systemName: string | null;
    position: string | null;
    status: Plant["status"];
  };
  knowledge: {
    libraryPlantId: string | null;
    commonName: string;
    scientificName: string | null;
    cultivar: string | null;
    sourceIds: string[];
  };
  facts: PlantStoryFact[];
  observations: PlantStoryObservation[];
  interpretations: PlantStoryInterpretation[];
  recommendations: PlantStoryInterpretation[];
  uncertainties: PlantStoryObservation[];
  events: Array<{
    id: string;
    title: string;
    type: PlantEvent["type"];
    lifeEvent: PlantEvent["lifeEvent"] | null;
    occurredAt: string | null;
    evidence: PlantStoryEvidenceRef[];
  }>;
  photos: PlantStoryPhotoEvidence[];
  coverage: {
    totalEvents: number;
    selectedEvents: number;
    totalPhotos: number;
    selectedPhotos: number;
    measuredPhotos: number;
    metadataOnlyPhotos: number;
  };
};

const MAX_EVENTS = 12;
const MAX_PHOTOS = 6;

function eventTime(event: Pick<PlantEvent, "occurredAt" | "daysAgo">) {
  return event.occurredAt ? Date.parse(event.occurredAt) : Number.NaN;
}

function oldestFirst<T extends Pick<PlantEvent, "occurredAt" | "daysAgo">>(items: readonly T[]) {
  return [...items].sort((left, right) => {
    const leftTime = eventTime(left);
    const rightTime = eventTime(right);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return right.daysAgo - left.daysAgo;
  });
}

function languageText(language: UiLanguage, en: string, es: string) {
  return language === "es" ? es : en;
}

function eventEvidence(event: PlantEvent, language: UiLanguage): PlantStoryEvidenceRef {
  return {
    id: event.id,
    kind: "event",
    label: `${formatDate(event.daysAgo, language)} · ${event.title}`,
  };
}

function photoEvidence(photo: Photo, language: UiLanguage): PlantStoryEvidenceRef {
  return {
    id: photo.id,
    kind: "photo",
    label: `${formatDate(photo.daysAgo, language)} · ${languageText(language, "photo", "foto")}`,
  };
}

function metricValue(photo: Photo, key: "heightCm" | "leafCount" | "density") {
  return photo.metrics[key];
}

function measuredPhotoCount(photos: readonly Photo[]) {
  return photos.filter(
    (photo) =>
      metricValue(photo, "heightCm") !== null ||
      metricValue(photo, "leafCount") !== null ||
      metricValue(photo, "density") !== null,
  ).length;
}

function distinctEvidence(photos: readonly Photo[]) {
  const seen = new Set<string>();
  return photos.filter((photo) => {
    const key = photo.backendStoragePath
      ? `storage:${photo.backendStoragePath}`
      : `photo:${photo.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectEvents(events: readonly PlantEvent[]) {
  const factual = oldestFirst(events.filter((event) => event.provenance !== "inferred"));
  if (factual.length <= MAX_EVENTS) return factual;

  const selected = new Set<string>();
  const add = (event?: PlantEvent) => {
    if (event) selected.add(event.id);
  };
  add(factual[0]);
  add(factual.at(-1));
  for (const event of factual) {
    if (
      event.milestone ||
      event.lifeEvent ||
      [
        "planted",
        "germinated",
        "sprouted",
        "transplant",
        "harvest",
        "problem",
        "recovery",
      ].includes(event.type)
    ) {
      add(event);
    }
    if (selected.size >= MAX_EVENTS) break;
  }
  for (const event of factual) {
    if (selected.size >= MAX_EVENTS) break;
    add(event);
  }
  return factual.filter((event) => selected.has(event.id)).slice(0, MAX_EVENTS);
}

function selectPhotos(photos: readonly Photo[], selectedEvents: readonly PlantEvent[]) {
  const all = distinctEvidence(photos);
  if (all.length <= MAX_PHOTOS) return all;

  const selected = new Set<string>();
  const add = (photo?: Photo) => {
    if (photo) selected.add(photo.id);
  };
  add(all[0]);
  add(all.at(-1));
  const eventPhotoIds = new Set(
    selectedEvents.flatMap(
      (event) => [event.photoId, ...(event.photoIds ?? [])].filter(Boolean) as string[],
    ),
  );
  for (const photo of all) {
    if (eventPhotoIds.has(photo.id)) add(photo);
    if (selected.size >= MAX_PHOTOS) break;
  }
  for (const photo of all) {
    if (selected.size >= MAX_PHOTOS) break;
    add(photo);
  }
  return all.filter((photo) => selected.has(photo.id)).slice(0, MAX_PHOTOS);
}

function measurementInterpretation(
  plant: Plant,
  photos: readonly Photo[],
  language: UiLanguage,
): {
  observations: PlantStoryObservation[];
  interpretations: PlantStoryInterpretation[];
  uncertainties: PlantStoryObservation[];
} {
  const observations: PlantStoryObservation[] = [];
  const interpretations: PlantStoryInterpretation[] = [];
  const uncertainties: PlantStoryObservation[] = [];
  const withHeight = photos.filter((photo) => photo.metrics.heightCm !== null);
  const withLeaves = photos.filter((photo) => photo.metrics.leafCount !== null);
  const withDensity = photos.filter((photo) => photo.metrics.density !== null);
  const earlier = photos[0];
  const later = photos.at(-1);

  if (!earlier || !later || earlier.id === later.id) {
    uncertainties.push({
      id: "visual-change-insufficient",
      text: ui(language, "storyNoVisualEvidence"),
      evidence: earlier ? [photoEvidence(earlier, language)] : [],
    });
    return { observations, interpretations, uncertainties };
  }

  const evidence = [photoEvidence(earlier, language), photoEvidence(later, language)];
  const daysBetween = Math.max(0, earlier.daysAgo - later.daysAgo);
  const changes: string[] = [];
  if (withHeight.length >= 2) {
    const delta = (later.metrics.heightCm ?? 0) - (earlier.metrics.heightCm ?? 0);
    if (delta !== 0)
      changes.push(
        languageText(
          language,
          `height ${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta)} cm`,
          `la altura ${delta > 0 ? "aumentó" : "disminuyó"} ${Math.abs(delta)} cm`,
        ),
      );
  }
  if (withLeaves.length >= 2) {
    const delta = (later.metrics.leafCount ?? 0) - (earlier.metrics.leafCount ?? 0);
    if (delta !== 0)
      changes.push(
        languageText(
          language,
          `leaf count ${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta)}`,
          `el conteo de hojas ${delta > 0 ? "aumentó" : "disminuyó"} ${Math.abs(delta)}`,
        ),
      );
  }
  if (withDensity.length >= 2) {
    const delta = (later.metrics.density ?? 0) - (earlier.metrics.density ?? 0);
    if (delta !== 0)
      changes.push(
        languageText(
          language,
          `density ${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta)} points`,
          `la densidad ${delta > 0 ? "aumentó" : "disminuyó"} ${Math.abs(delta)} puntos`,
        ),
      );
  }

  if (!changes.length) {
    uncertainties.push({
      id: "visual-change-unmeasured",
      text: ui(language, "storyVisualComparisonInsufficient"),
      evidence,
    });
    return { observations, interpretations, uncertainties };
  }

  observations.push({
    id: "recorded-measurement-change",
    text: languageText(
      language,
      `Recorded measurements show ${changes.join(", ")} across ${daysBetween} day${daysBetween === 1 ? "" : "s"}.`,
      `Las mediciones registradas muestran ${changes.join(", ")} en ${daysBetween} día${daysBetween === 1 ? "" : "s"}.`,
    ),
    evidence,
  });
  interpretations.push({
    id: "bounded-growth-reading",
    text:
      daysBetween < 7
        ? languageText(
            language,
            `${plant.name} appears to be changing between these observations, but this short interval is not enough to establish a long-term trend.`,
            `${plant.name} parece estar cambiando entre estas observaciones, pero este intervalo corto no basta para establecer una tendencia a largo plazo.`,
          )
        : languageText(
            language,
            `${plant.name} shows a recorded change across the available observation window; the reading is limited to the measurements captured here.`,
            `${plant.name} muestra un cambio registrado durante el periodo observado; esta lectura se limita a las mediciones capturadas aquí.`,
          ),
    confidence: daysBetween < 7 ? "low" : "moderate",
    evidence,
  });
  return { observations, interpretations, uncertainties };
}

/**
 * Builds bounded, derived plant-story evidence from the canonical Garden
 * projections. It never calls a model, writes data, or treats an inference as
 * a fact. Photo bodies are intentionally not fetched; metadata remains useful
 * when historical media is unavailable.
 */
export function buildPlantStoryContext(
  plant: Plant,
  garden: Garden,
  events: readonly PlantEvent[],
  photos: readonly Photo[],
  libraryEntry: GardenLibraryEntry | null,
  language: UiLanguage,
): PlantStoryContext {
  const plantEventRows = plantEvents([...events], plant.id);
  const selectedEvents = selectEvents(plantEventRows);
  const plantPhotoRows = plantPhotos([...photos], plant.id);
  const selectedPhotos = selectPhotos(plantPhotoRows, selectedEvents);
  const commonName =
    libraryEntry?.commonName ?? plant.libraryIdentitySnapshot?.commonName ?? plant.species;
  const scientificName =
    libraryEntry?.scientificName ??
    plant.libraryIdentitySnapshot?.scientificName ??
    plant.scientific ??
    null;
  const cultivar =
    libraryEntry?.cultivar ?? plant.libraryIdentitySnapshot?.cultivar ?? (plant.variety || null);
  const identityRef: PlantStoryEvidenceRef = {
    id: plant.libraryPlantId ?? plant.id,
    kind: "identity",
    label: ui(language, "storyEvidenceIdentity"),
  };
  const originRef: PlantStoryEvidenceRef = {
    id: plant.backendGrowCycleId ?? plant.id,
    kind: "origin",
    label: ui(language, "storyEvidenceOrigin"),
  };
  const locationRef: PlantStoryEvidenceRef = {
    id: plant.backendPositionId ?? garden.id,
    kind: "location",
    label: ui(language, "storyEvidenceLocation"),
  };
  const facts: PlantStoryFact[] = [
    {
      id: "identity",
      label: ui(language, "storyIdentity"),
      value: [commonName, scientificName, cultivar ? `“${cultivar}”` : null]
        .filter(Boolean)
        .join(" · "),
      evidence: [identityRef],
    },
    ...(plant.plantedDatePrecision !== "unknown" && Number.isFinite(plant.plantedDaysAgo)
      ? [
          {
            id: "cycle-age",
            label: ui(language, "storyRecordedAge"),
            value: languageText(
              language,
              `Day ${plant.plantedDaysAgo}`,
              `Día ${plant.plantedDaysAgo}`,
            ),
            evidence: [originRef],
          },
        ]
      : []),
    {
      id: "current-location",
      label: ui(language, "storyNow"),
      value: [garden.name, plant.slot].filter(Boolean).join(" · "),
      evidence: [locationRef],
    },
    {
      id: "record-coverage",
      label: ui(language, "storyRecordedHistory"),
      value: languageText(
        language,
        `${plantEventRows.length} event${plantEventRows.length === 1 ? "" : "s"} · ${plantPhotoRows.length} photo${plantPhotoRows.length === 1 ? "" : "s"}`,
        `${plantEventRows.length} evento${plantEventRows.length === 1 ? "" : "s"} · ${plantPhotoRows.length} foto${plantPhotoRows.length === 1 ? "" : "s"}`,
      ),
      evidence: [
        ...selectedEvents.slice(-2).map((event) => eventEvidence(event, language)),
        ...selectedPhotos.slice(-2).map((photo) => photoEvidence(photo, language)),
      ],
    },
  ];
  const visual = measurementInterpretation(plant, selectedPhotos, language);
  const metadataOnlyPhotos = selectedPhotos.filter(
    (photo) => photo.isHistoricalEvidence === true && !photo.src,
  ).length;

  return {
    schemaVersion: "plant_story_context_v1",
    plant: {
      id: plant.id,
      name: plant.name,
      commonName,
      scientificName,
      cultivar,
      libraryPlantId: plant.libraryPlantId ?? null,
      originType: plant.originType,
      ageDays: plant.plantedDatePrecision === "unknown" ? null : plant.plantedDaysAgo,
      cycleId: plant.backendGrowCycleId ?? null,
      cycleClosed: Boolean(plant.cycleClosed),
    },
    current: {
      gardenName: garden.name,
      systemName: garden.machine?.name ?? garden.systemDefinitionKey ?? null,
      position: plant.slot ?? null,
      status: plant.status,
    },
    knowledge: {
      libraryPlantId: plant.libraryPlantId ?? null,
      commonName,
      scientificName,
      cultivar,
      sourceIds: libraryEntry?.reference.sourceIds ? [...libraryEntry.reference.sourceIds] : [],
    },
    facts,
    observations: visual.observations,
    interpretations: visual.interpretations,
    recommendations: [],
    uncertainties: [
      ...visual.uncertainties,
      ...(metadataOnlyPhotos > 0
        ? [
            {
              id: "historical-media-body",
              text: languageText(
                language,
                ui(language, "storyHistoricalMediaUnavailable"),
              ),
              evidence: selectedPhotos
                .filter((photo) => photo.isHistoricalEvidence === true && !photo.src)
                .map((photo) => photoEvidence(photo, language)),
            },
          ]
        : []),
    ],
    events: selectedEvents.map((event) => ({
      id: event.id,
      title: event.title,
      type: event.type,
      lifeEvent: event.lifeEvent ?? null,
      occurredAt: event.occurredAt ?? null,
      evidence: [eventEvidence(event, language)],
    })),
    photos: selectedPhotos.map((photo) => ({
      id: photo.id,
      capturedAt: photo.capturedAt ?? formatDate(photo.daysAgo, language),
      metadataOnly: photo.isHistoricalEvidence === true && !photo.src,
      evidence: [photoEvidence(photo, language)],
    })),
    coverage: {
      totalEvents: plantEventRows.length,
      selectedEvents: selectedEvents.length,
      totalPhotos: plantPhotoRows.length,
      selectedPhotos: selectedPhotos.length,
      measuredPhotos: measuredPhotoCount(selectedPhotos),
      metadataOnlyPhotos,
    },
  };
}
