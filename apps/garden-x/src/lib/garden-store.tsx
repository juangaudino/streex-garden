import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  initialState,
  knowledge,
  type CareTask,
  type Film,
  type Garden,
  type GardenState,
  type MaintenanceType,
  type Photo,
  type Plant,
  type PlantEvent,
  type EventType,
} from "./garden-data";
import type { PublicStory } from "./public-story";
import {
  closePlantCycleRecord,
  completeAttention,
  createCustomSystemRecord,
  createGardenRecord,
  deleteGardenRecord,
  deletePhotoRecord,
  correctPlantingRecord,
  createFollowUpRecord,
  createPlantRecord,
  createLibraryPlantRecord,
  loadGardenState,
  loadMeaningfulChangeResults,
  loadGardenSummaryContext,
  loadGardenSummaryResults,
  requestMeaningfulChange,
  requestGardenSummary,
  reorderGardenRecords,
  saveFilmRecord,
  movePlantRecord,
  persistMoment,
  invalidateEventRecord,
  updateGardenRecord,
  updateCustomSystemLayoutRecord,
  updatePlantIdentityRecord,
  confirmPlantLibraryIdentityRecord,
  clearPersistentPhotoCache,
  setPersistentPhotoCacheUserId,
} from "./garden-backend";
import type { CustomSystemDraft, DeleteGardenResult, DeletePhotoResult } from "./garden-backend";
import { getSupabaseClient, hasSupabaseConfiguration } from "./supabase";
import { chooseSessionHighlight } from "./garden-logic";
import { selectMeaningfulChangeCandidate, shouldGenerateMeaningfulChange, type MeaningfulChangeResult } from "./meaningful-changes";
import {
  GARDEN_SUMMARY_COALESCE_WINDOW_MS,
  GARDEN_SUMMARY_SCHEMA_VERSION,
  gardenSummaryRequestKey,
  selectCurrentSummary,
  type GardenSummaryResult,
} from "./garden-summaries";

interface StoreApi extends GardenState {
  meaningfulChanges: MeaningfulChangeResult[];
  gardenSummaries: GardenSummaryResult[];
  hydration: "loading" | "ready" | "reconnecting" | "error" | "offline";
  highlightedPlantId: string | null;
  language: "en" | "es";
  setLanguage: (language: "en" | "es") => void;
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  measurementSystem: MeasurementSystem;
  setMeasurementSystem: (system: MeasurementSystem) => void;
  temperatureUnit: TemperatureUnit;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  addEvent: (e: Omit<PlantEvent, "id">) => void;
  addPhoto: (p: Omit<Photo, "id">) => string;
  addTask: (t: Omit<CareTask, "id" | "done">) => void;
  completeTask: (id: string, note?: string) => void;
  reopenTask: (id: string) => void;
  addFilm: (f: Omit<Film, "id" | "createdDaysAgo">) => void;
  addPlant: (p: Omit<Plant, "id">, photo?: Omit<Photo, "id" | "plantId">) => string;
  createLibraryPlant: (draft: {
    gardenId: string;
    positionId: string;
    libraryPlantId: string;
    nickname?: string;
    plantedOn: string | null;
    plantedOnPrecision: "exact" | "approximate" | "unknown";
    photo?: Omit<Photo, "id" | "plantId">;
  }) => Promise<string>;
  confirmPlantLibraryIdentity: (plantId: string, libraryPlantId: string) => Promise<void>;
  updatePlant: (id: string, patch: Partial<Omit<Plant, "id">>) => void;
  updateGarden: (id: string, patch: Partial<Omit<Garden, "id">>) => void;
  setGardenArchived: (id: string, archived: boolean) => Promise<void>;
  deleteGarden: (id: string) => Promise<DeleteGardenResult>;
  deleteEvent: (id: string) => Promise<void>;
  deletePhoto: (id: string) => Promise<DeletePhotoResult>;
  addGarden: (g: Omit<Garden, "id">) => string;
  createCustomSystem: (
    draft: CustomSystemDraft,
  ) => Promise<{ gardenId: string; photoWarning?: string }>;
  updateCustomSystemLayout: (gardenId: string, levels: Array<{ rows: number; columns: number; activeCells?: Array<{ row: number; column: number }> }>) => Promise<void>;
  reorderGardens: (orderedIds: string[]) => void;
  publicStories: PublicStory[];
  savePublicStory: (story: PublicStory) => void;
}

export type Appearance = "light" | "dark" | "system";
export type MeasurementSystem = "metric" | "imperial";
export type TemperatureUnit = "c" | "f";
export interface UserProfile {
  name: string;
  email: string;
  signedIn: boolean;
}

interface Preferences {
  language: "en" | "es";
  appearance: Appearance;
  measurementSystem: MeasurementSystem;
  temperatureUnit: TemperatureUnit;
  profile: UserProfile;
}

const defaults: Preferences = {
  language: "en",
  appearance: "system",
  measurementSystem: "metric",
  temperatureUnit: "c",
  profile: { name: "Juan", email: "juan@gardenx.app", signedIn: true },
};

const preferenceKey = "garden-x-preferences";
const highlightedPlantKey = "garden-x-last-highlighted-plant";

const Ctx = createContext<StoreApi | null>(null);

const emptyState: GardenState = {
  gardens: [],
  plants: [],
  photos: [],
  events: [],
  tasks: [],
  films: [],
};

export function hydrationAfterRefreshFailure(hasSnapshot: boolean): "reconnecting" | "error" {
  return hasSnapshot ? "reconnecting" : "error";
}

export function isBackgroundHydration(hydration: StoreApi["hydration"]): boolean {
  return hydration === "reconnecting" || hydration === "offline";
}
const demoPlantIds = new Set(initialState.plants.map((plant) => plant.id));

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${seq++}`;

export function GardenProvider({ children }: { children: ReactNode }) {
  const backendConfigured = hasSupabaseConfiguration();
  const [state, setState] = useState<GardenState>(() =>
    backendConfigured ? emptyState : initialState,
  );
  const [hydration, setHydration] = useState<StoreApi["hydration"]>(
    backendConfigured ? "loading" : "ready",
  );
  const [highlightedPlantId, setHighlightedPlantId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [publicStories, setPublicStories] = useState<PublicStory[]>([]);
  const [meaningfulChanges, setMeaningfulChanges] = useState<MeaningfulChangeResult[]>([]);
  const [gardenSummaries, setGardenSummaries] = useState<GardenSummaryResult[]>([]);
  const pendingPhotos = useRef(new Map<string, Photo>());
  const highlightResolved = useRef(false);
  const hasSuccessfulSnapshot = useRef(!backendConfigured);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshSequence = useRef(0);
  const photoCacheUserId = useRef<string | null>(null);
  const summaryGenerationInFlight = useRef(new Set<string>());
  const summaryGenerationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSummaryGeneration = useRef<{
    state: GardenState;
    summaries: GardenSummaryResult[];
    language: "en" | "es";
  } | null>(null);

  const resetHighlight = useCallback(() => {
    highlightResolved.current = false;
    setHighlightedPlantId(null);
  }, []);

  const resolveHighlight = useCallback((plantsForSession: Plant[]) => {
    if (highlightResolved.current) return;
    const candidates = plantsForSession.filter((plant) => !demoPlantIds.has(plant.id));
    let previousId: string | null = null;
    try {
      previousId = window.localStorage.getItem(highlightedPlantKey);
    } catch {
      /* no-op */
    }
    const selected = chooseSessionHighlight(candidates, previousId);
    if (!selected) return;
    highlightResolved.current = true;
    setHighlightedPlantId(selected.id);
    try {
      window.localStorage.setItem(highlightedPlantKey, selected.id);
    } catch {
      /* no-op */
    }
  }, []);

  const generateGardenSummariesFor = useCallback(async (
    nextState: GardenState,
    existingSummaries: GardenSummaryResult[],
    language: "en" | "es",
  ) => {
    if (!backendConfigured) return;
    const targets: Array<{ scopeType: "global" | "garden"; scopeId: string | null }> = [
      { scopeType: "global", scopeId: null },
      ...nextState.gardens.filter((garden) => !garden.archived).map((garden) => ({ scopeType: "garden" as const, scopeId: garden.id })),
    ];
    await Promise.all(targets.map(async (target) => {
      const hasPlants = nextState.plants.some((plant) =>
        plant.gardenId === target.scopeId || (target.scopeType === "global" && nextState.gardens.some((garden) => !garden.archived && garden.id === plant.gardenId)),
      );
      if (!hasPlants) return;
      const context = await loadGardenSummaryContext(target.scopeType, target.scopeId);
      if (!context) return;
      if (selectCurrentSummary(existingSummaries, context, language)) return;
      const requestKey = gardenSummaryRequestKey(target.scopeType, target.scopeId, context.materialFingerprint, language, GARDEN_SUMMARY_SCHEMA_VERSION);
      if (summaryGenerationInFlight.current.has(requestKey)) return;
      summaryGenerationInFlight.current.add(requestKey);
      try {
        const { proposal } = await requestGardenSummary(target.scopeType, target.scopeId, context.materialFingerprint, language);
        setGardenSummaries((summaries) => [
          proposal,
          ...summaries.filter((summary) => !(summary.scopeType === proposal.scopeType && summary.scopeId === proposal.scopeId && summary.language === proposal.language && summary.materialFingerprint === proposal.materialFingerprint)),
        ]);
      } catch {
        // Derived summaries are optional; keep the last valid snapshot on failure.
      } finally {
        summaryGenerationInFlight.current.delete(requestKey);
      }
    }));
  }, [backendConfigured]);

  const scheduleGardenSummaryGeneration = useCallback((
    nextState: GardenState,
    existingSummaries: GardenSummaryResult[],
    language: "en" | "es",
  ) => {
    if (!backendConfigured) return;
    pendingSummaryGeneration.current = { state: nextState, summaries: existingSummaries, language };
    if (summaryGenerationTimer.current !== null) clearTimeout(summaryGenerationTimer.current);
    summaryGenerationTimer.current = setTimeout(() => {
      summaryGenerationTimer.current = null;
      const pending = pendingSummaryGeneration.current;
      pendingSummaryGeneration.current = null;
      if (pending) void generateGardenSummariesFor(pending.state, pending.summaries, pending.language);
    }, GARDEN_SUMMARY_COALESCE_WINDOW_MS);
  }, [backendConfigured, generateGardenSummariesFor]);

  useEffect(() => () => {
    if (summaryGenerationTimer.current !== null) clearTimeout(summaryGenerationTimer.current);
    summaryGenerationTimer.current = null;
    pendingSummaryGeneration.current = null;
  }, []);

  const refreshFromBackend = useCallback(async (reason: "initial" | "reconnect" | "auth" | "mutation" = "mutation") => {
    if (!backendConfigured) return;
    if (refreshInFlight.current) return refreshInFlight.current;
    const sequence = ++refreshSequence.current;
    const run = (async () => {
      setHydration(hasSuccessfulSnapshot.current && reason !== "initial" ? "reconnecting" : "loading");
      const client = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        if (hasSuccessfulSnapshot.current) throw new Error("Garden session is temporarily unavailable.");
        setState(emptyState);
        resetHighlight();
        setHydration("ready");
        return;
      }
      const [{ state: next }, derivedResults, summaryResults] = await Promise.all([
        loadGardenState(),
        loadMeaningfulChangeResults(),
        loadGardenSummaryResults(),
      ]);
      if (sequence !== refreshSequence.current) return;
      resolveHighlight(next.plants);
      setState(next);
      setMeaningfulChanges(derivedResults);
      setGardenSummaries(summaryResults);
      hasSuccessfulSnapshot.current = true;
      setHydration("ready");
      const user = sessionData.session.user;
      setPreferences((current) => ({
        ...current,
        profile: { ...current.profile, email: user.email ?? current.profile.email, signedIn: true },
      }));
      if (reason === "mutation") scheduleGardenSummaryGeneration(next, summaryResults, preferences.language);
    })();
    refreshInFlight.current = run;
    run.catch(() => {
      if (sequence !== refreshSequence.current) return;
      setHydration(hydrationAfterRefreshFailure(hasSuccessfulSnapshot.current));
    }).finally(() => {
      if (refreshInFlight.current === run) refreshInFlight.current = null;
    });
    return run;
  }, [backendConfigured, preferences.language, resetHighlight, resolveHighlight, scheduleGardenSummaryGeneration]);

  useEffect(() => {
    if (!backendConfigured) return;
    const client = getSupabaseClient();
    void refreshFromBackend("initial").catch(() => undefined);
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const user = session.user;
        if (photoCacheUserId.current && photoCacheUserId.current !== user.id) {
          void clearPersistentPhotoCache(photoCacheUserId.current);
        }
        photoCacheUserId.current = user.id;
        setPersistentPhotoCacheUserId(user.id);
        setPreferences((current) => ({
          ...current,
          profile: {
            ...current.profile,
            email: user.email ?? current.profile.email,
            signedIn: true,
          },
        }));
        void refreshFromBackend("auth").catch(() => undefined);
      } else {
        if (photoCacheUserId.current) void clearPersistentPhotoCache(photoCacheUserId.current);
        photoCacheUserId.current = null;
        setPersistentPhotoCacheUserId(null);
        hasSuccessfulSnapshot.current = false;
        setState(emptyState);
        setMeaningfulChanges([]);
        setGardenSummaries([]);
        if (summaryGenerationTimer.current !== null) clearTimeout(summaryGenerationTimer.current);
        summaryGenerationTimer.current = null;
        pendingSummaryGeneration.current = null;
        resetHighlight();
        setHydration("ready");
        setPreferences((current) => ({
          ...current,
          profile: { ...current.profile, signedIn: false },
        }));
      }
    });
    const refreshOnResume = () => {
      if (document.visibilityState === "hidden") return;
      void refreshFromBackend("reconnect").catch(() => undefined);
    };
    const onVisibility = () => { if (document.visibilityState === "visible") refreshOnResume(); };
    const onPageShow = () => refreshOnResume();
    const onOnline = () => refreshOnResume();
    const onOffline = () => {
      if (hasSuccessfulSnapshot.current) setHydration("offline");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      authListener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [backendConfigured, refreshFromBackend, resetHighlight]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(preferenceKey);
      if (saved) setPreferences({ ...defaults, ...(JSON.parse(saved) as Partial<Preferences>) });
    } catch {
      // The prototype remains usable when browser storage is unavailable.
    }
  }, []);

  const updatePreferences = (patch: Partial<Preferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(preferenceKey, JSON.stringify(next));
      } catch {
        /* no-op */
      }
      return next;
    });
  };

  const api = useMemo<StoreApi>(
    () => ({
      ...state,
      meaningfulChanges,
      gardenSummaries,
      hydration,
      highlightedPlantId,
      ...preferences,
      setLanguage: (language) => {
        updatePreferences({ language });
        if (language !== preferences.language) scheduleGardenSummaryGeneration(state, gardenSummaries, language);
      },
      setAppearance: (appearance) => updatePreferences({ appearance }),
      setMeasurementSystem: (measurementSystem) => updatePreferences({ measurementSystem }),
      setTemperatureUnit: (temperatureUnit) => updatePreferences({ temperatureUnit }),
      updateProfile: (patch) =>
        updatePreferences({ profile: { ...preferences.profile, ...patch } }),
      publicStories,
      savePublicStory: (story) =>
        setPublicStories((stories) => [...stories.filter((item) => item.id !== story.id), story]),
      addEvent: (e) => {
        const plant = state.plants.find((p) => p.id === e.plantId);
        const pendingPhoto = e.photoId ? pendingPhotos.current.get(e.photoId) : undefined;
        if (plant?.backendGrowCycleId) {
          const skipSynthetic =
            e.title === "Cycle closed" ||
            e.title === "Planting record corrected" ||
            e.title.startsWith("Follow-up set:");
          if (!skipSynthetic) {
            void persistMoment(plant, e, pendingPhoto)
              .then(() => {
                if (e.photoId) pendingPhotos.current.delete(e.photoId);
                return refreshFromBackend("mutation").then(async () => {
                  // Comparison generation is deliberately after persistence and
                  // refresh. Home only reads completed, owner-scoped results.
                  if (!shouldGenerateMeaningfulChange(e)) return;
                  const fresh = await loadGardenState();
                  const candidate = selectMeaningfulChangeCandidate(
                    fresh.state.plants.find((item) => item.id === plant.id) ?? plant,
                    fresh.state.photos,
                    fresh.state.events,
                    meaningfulChanges,
                    preferences.language,
                  );
                  if (!candidate) return;
                  await requestMeaningfulChange(candidate.growCycleId, candidate.beforePhotoId, candidate.afterPhotoId, preferences.language).catch(() => undefined);
                  const latestMeaningfulChanges = await loadMeaningfulChangeResults();
                  setMeaningfulChanges(latestMeaningfulChanges);
                  const latest = await loadGardenState();
                  scheduleGardenSummaryGeneration(latest.state, gardenSummaries, preferences.language);
                });
              })
              .catch(() => undefined);
          }
        }
        setState((s) => {
          const event: PlantEvent = {
            id: uid("ev"),
            plantId: e.plantId,
            daysAgo: e.daysAgo,
            type: e.type,
            title: e.title,
            provenance: e.provenance,
            ...(e.detail !== undefined && { detail: e.detail }),
            ...(e.milestone !== undefined && { milestone: e.milestone }),
            ...(e.photoId !== undefined && { photoId: e.photoId }),
          };
          return { ...s, events: [...s.events, event] };
        });
      },
      addPhoto: (photo) => {
        const id = uid("photo");
        const next = { ...photo, id };
        pendingPhotos.current.set(id, next);
        setState((s) => ({ ...s, photos: [...s.photos, next] }));
        return id;
      },
      addTask: (t) => {
        const plant = state.plants.find((p) => p.id === t.plantId);
        if (plant?.backendGrowCycleId) {
          void createFollowUpRecord(plant, t.label, t.dueInDays)
            .then(() => refreshFromBackend("mutation"))
            .catch(() => undefined);
        }
        setState((s) => ({ ...s, tasks: [...s.tasks, { ...t, id: uid("task"), done: false }] }));
      },
      completeTask: (id, note) => {
        const task = state.tasks.find((t) => t.id === id);
        if (task?.backendAttentionId) {
          void completeAttention(task.backendAttentionId, note)
            .then(() => refreshFromBackend("mutation"))
            .catch(() => undefined);
        }
        setState((s) => {
          const current = s.tasks.find((t) => t.id === id);
          if (!current) return s;
          const detail = note ?? current.hint;
          const event: PlantEvent = {
            id: uid("ev"),
            plantId: current.plantId,
            daysAgo: 0,
            type: maintenanceEventType(current.type),
            title: current.label,
            provenance: "recorded",
            ...(detail !== undefined && { detail }),
          };
          return {
            ...s,
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: true } : t)),
            events: [...s.events, event],
          };
        });
      },
      reopenTask: (id) =>
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: false } : t)),
        })),
      addFilm: (f) => {
        const id = crypto.randomUUID();
        const film = { ...f, id, createdDaysAgo: 0 };
        const plant = state.plants.find((p) => p.id === f.plantId);
        if (plant?.backendGrowCycleId)
          void saveFilmRecord({ ...f, id })
            .then(() => refreshFromBackend("mutation"))
            .catch(() => undefined);
        setState((s) => ({ ...s, films: [...s.films, film] }));
      },
      addPlant: (p, photo) => {
        const id = crypto.randomUUID();
        const nextPlant: Plant = { ...p, id };
        const garden = state.gardens.find((g) => g.id === p.gardenId);
        const positionNumber = Number(p.slot?.match(/\d+/)?.[0] ?? "");
        const position = garden?.backendPositions?.find((item) => item.number === positionNumber);
        if (position) {
          const canonicalPhoto = photo
            ? { ...photo, id: crypto.randomUUID(), plantId: id }
            : undefined;
          void createPlantRecord(nextPlant, position.id, canonicalPhoto)
            .then(() => refreshFromBackend("mutation"))
            .catch(() => undefined);
        }
        setState((s) => {
          const photoId = photo ? uid("photo") : undefined;
          return {
            ...s,
            plants: [...s.plants, { ...nextPlant, heroPhotoId: photoId ?? p.heroPhotoId }],
            photos:
              photo && photoId ? [...s.photos, { ...photo, id: photoId, plantId: id }] : s.photos,
            events: [
              ...s.events,
              {
                id: uid("ev"),
                plantId: id,
                daysAgo: 0,
                type: "planted" as EventType,
                title: "Added to garden",
                detail: "Identity confirmed by you.",
                milestone: true,
                provenance: "recorded",
              },
            ],
          };
        });
        return id;
      },
      createLibraryPlant: async (draft) => {
        const id = crypto.randomUUID();
        const photo = draft.photo
          ? { ...draft.photo, id: crypto.randomUUID(), plantId: id }
          : undefined;
        await createLibraryPlantRecord({
          plantInstanceId: id,
          positionId: draft.positionId,
          libraryPlantId: draft.libraryPlantId,
          plantedOn: draft.plantedOn,
          plantedOnPrecision: draft.plantedOnPrecision,
          ...(draft.nickname ? { nickname: draft.nickname } : {}),
          ...(photo ? { photo } : {}),
        });
        await refreshFromBackend();
        return id;
      },
      confirmPlantLibraryIdentity: async (plantId, libraryPlantId) => {
        const current = state.plants.find((item) => item.id === plantId);
        if (!current) throw new Error("Plant not found.");
        await confirmPlantLibraryIdentityRecord(current, libraryPlantId);
        await refreshFromBackend();
      },
      updatePlant: (id, patch) => {
        const current = state.plants.find((p) => p.id === id);
        if (current?.backendGrowCycleId) {
          const next = { ...current, ...patch };
          if (
            patch.plantedDaysAgo !== undefined &&
            patch.plantedDaysAgo !== current.plantedDaysAgo
          ) {
            void correctPlantingRecord(current, patch.plantedDaysAgo, "Corrected in Garden X")
              .then(() => refreshFromBackend("mutation"))
              .catch(() => undefined);
          }
          const targetGarden = patch.gardenId
            ? state.gardens.find((g) => g.id === patch.gardenId)
            : undefined;
          const targetNumber = patch.slot ? Number(patch.slot.match(/\d+/)?.[0] ?? "") : undefined;
          const targetPosition = targetGarden?.backendPositions?.find(
            (item) => item.number === targetNumber,
          );
          if (targetPosition && targetPosition.id !== current.backendPositionId) {
            void movePlantRecord(id, targetPosition.id, 0)
              .then(() => refreshFromBackend("mutation"))
              .catch(() => undefined);
          }
          if (
            patch.name !== undefined ||
            patch.species !== undefined ||
            patch.scientific !== undefined ||
            patch.variety !== undefined ||
            patch.knowledgeId !== undefined
          ) {
            void updatePlantIdentityRecord(next)
              .then(() => refreshFromBackend("mutation"))
              .catch(() => undefined);
          }
          if (patch.cycleClosed === true && !current.cycleClosed) {
            void closePlantCycleRecord(current, 0, "closed", "Closed in Garden X")
              .then(() => refreshFromBackend("mutation"))
              .catch(() => undefined);
          }
        }
        setState((s) => ({
          ...s,
          plants: s.plants.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }));
      },
      updateGarden: (id, patch) => {
        const current = state.gardens.find((g) => g.id === id);
        if (current?.backendSystemInstanceId)
          void updateGardenRecord({ ...current, ...patch })
            .then(() => refreshFromBackend("mutation"))
            .catch(() => undefined);
        setState((s) => ({
          ...s,
          gardens: s.gardens.map((garden) => (garden.id === id ? { ...garden, ...patch } : garden)),
        }));
      },
      setGardenArchived: async (id, archived) => {
        const current = state.gardens.find((g) => g.id === id);
        if (!current) return;
        setState((s) => ({
          ...s,
          gardens: s.gardens.map((garden) => (garden.id === id ? { ...garden, archived } : garden)),
        }));
        if (!current.backendSystemInstanceId) return;
        try {
          await updateGardenRecord({ ...current, archived });
          await refreshFromBackend();
        } catch (error) {
          setState((s) => ({
            ...s,
            gardens: s.gardens.map((garden) => (garden.id === id ? current : garden)),
          }));
          throw error;
        }
      },
      deleteGarden: async (id) => {
        const current = state.gardens.find((g) => g.id === id);
        if (current?.backendSystemInstanceId) {
          const result = await deleteGardenRecord(id);
          await refreshFromBackend();
          return result;
        }
        setState((s) => {
          const plantIds = new Set(s.plants.filter((p) => p.gardenId === id).map((p) => p.id));
          return {
            ...s,
            gardens: s.gardens.filter((garden) => garden.id !== id),
            plants: s.plants.filter((p) => !plantIds.has(p.id)),
            photos: s.photos.filter((photo) => !plantIds.has(photo.plantId)),
            events: s.events.filter((event) => !plantIds.has(event.plantId)),
            tasks: s.tasks.filter((task) => !plantIds.has(task.plantId)),
            films: s.films.filter((film) => !plantIds.has(film.plantId)),
          };
        });
        return {};
      },
      deleteEvent: async (id) => {
        const current = state.events.find((event) => event.id === id);
        if (!current) return;
        if (current.backendEventType && current.backendRevision !== undefined) {
          await invalidateEventRecord(id, current.backendRevision);
          setState((s) => ({ ...s, events: s.events.filter((event) => event.id !== id) }));
          void refreshFromBackend().catch(() => undefined);
          return;
        }
        // Offline/fixture events are removed from the projection only. Their
        // photos remain available as independent evidence, matching backend
        // invalidation semantics.
        setState((s) => ({ ...s, events: s.events.filter((event) => event.id !== id) }));
      },
      deletePhoto: async (id) => {
        const current = state.photos.find((photo) => photo.id === id);
        if (!current) return {};
        let result: DeletePhotoResult = {};
        if (current.backendStoragePath) {
          result = await deletePhotoRecord(id);
          void refreshFromBackend().catch(() => undefined);
        }
        pendingPhotos.current.delete(id);
        setState((s) => ({ ...s, photos: s.photos.filter((photo) => photo.id !== id) }));
        return result;
      },
      addGarden: (g) => {
        const id = crypto.randomUUID();
        const next: Garden = { ...g, id, backendSystemInstanceId: crypto.randomUUID() };
        void createGardenRecord(next)
          .then(() => refreshFromBackend("mutation"))
          .catch(() => undefined);
        setState((s) => ({ ...s, gardens: [...s.gardens, next] }));
        return id;
      },
      createCustomSystem: async (draft) => {
        const result = await createCustomSystemRecord(draft);
        await refreshFromBackend();
        return result;
      },
      updateCustomSystemLayout: async (gardenId, levels) => {
        await updateCustomSystemLayoutRecord(gardenId, levels);
        await refreshFromBackend();
      },
      reorderGardens: (orderedIds) => {
        void reorderGardenRecords(orderedIds).catch(() => undefined);
        setState((s) => ({
          ...s,
          gardens: [
            ...orderedIds
              .map((id) => s.gardens.find((garden) => garden.id === id))
              .filter((garden): garden is Garden => Boolean(garden)),
            ...s.gardens.filter((garden) => !orderedIds.includes(garden.id)),
          ],
        }));
      },
    }),
    [scheduleGardenSummaryGeneration, gardenSummaries, highlightedPlantId, hydration, meaningfulChanges, preferences, publicStories, refreshFromBackend, state],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useGarden() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGarden must be used inside GardenProvider");
  return ctx;
}

function maintenanceEventType(type: MaintenanceType): EventType {
  if (type === "pruning") return "pruning";
  if (type === "harvest") return "harvest";
  if (type === "transplant") return "transplant";
  return "maintenance";
}

export const knowledgeById = (id: string) => knowledge.find((k) => k.id === id);
export { knowledge };
