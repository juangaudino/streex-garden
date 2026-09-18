import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  createGardenRecord,
  deleteGardenRecord,
  correctPlantingRecord,
  createFollowUpRecord,
  createPlantRecord,
  loadGardenState,
  reorderGardenRecords,
  saveFilmRecord,
  movePlantRecord,
  persistMoment,
  updateGardenRecord,
  updatePlantIdentityRecord,
} from "./garden-backend";
import { getSupabaseClient, hasSupabaseConfiguration } from "./supabase";

interface StoreApi extends GardenState {
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
  updatePlant: (id: string, patch: Partial<Omit<Plant, "id">>) => void;
  updateGarden: (id: string, patch: Partial<Omit<Garden, "id">>) => void;
  setGardenArchived: (id: string, archived: boolean) => void;
  deleteGarden: (id: string) => void;
  addGarden: (g: Omit<Garden, "id">) => string;
  reorderGardens: (orderedIds: string[]) => void;
  publicStories: PublicStory[];
  savePublicStory: (story: PublicStory) => void;
}

export type Appearance = "light" | "dark" | "system";
export type MeasurementSystem = "metric" | "imperial";
export type TemperatureUnit = "c" | "f";
export interface UserProfile { name: string; email: string; signedIn: boolean }

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

const Ctx = createContext<StoreApi | null>(null);

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${seq++}`;

export function GardenProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GardenState>(initialState);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [publicStories, setPublicStories] = useState<PublicStory[]>([]);
  const pendingPhotos = useRef(new Map<string, Photo>());

  const refreshFromBackend = useCallback(async () => {
    if (!hasSupabaseConfiguration()) return;
    const client = getSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return;
    const { state: next } = await loadGardenState();
    setState(next);
    const user = sessionData.session.user;
    setPreferences((current) => ({
      ...current,
      profile: { ...current.profile, email: user.email ?? current.profile.email, signedIn: true },
    }));
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfiguration()) return;
    const client = getSupabaseClient();
    void refreshFromBackend().catch(() => undefined);
    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const user = session.user;
        setPreferences((current) => ({
          ...current,
          profile: { ...current.profile, email: user.email ?? current.profile.email, signedIn: true },
        }));
        void refreshFromBackend().catch(() => undefined);
      } else {
        setPreferences((current) => ({
          ...current,
          profile: { ...current.profile, signedIn: false },
        }));
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, [refreshFromBackend]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(preferenceKey);
      if (saved) setPreferences({ ...defaults, ...JSON.parse(saved) as Partial<Preferences> });
    } catch {
      // The prototype remains usable when browser storage is unavailable.
    }
  }, []);

  const updatePreferences = (patch: Partial<Preferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      try { window.localStorage.setItem(preferenceKey, JSON.stringify(next)); } catch { /* no-op */ }
      return next;
    });
  };

  const api = useMemo<StoreApi>(
    () => ({
      ...state,
      ...preferences,
      setLanguage: (language) => updatePreferences({ language }),
      setAppearance: (appearance) => updatePreferences({ appearance }),
      setMeasurementSystem: (measurementSystem) => updatePreferences({ measurementSystem }),
      setTemperatureUnit: (temperatureUnit) => updatePreferences({ temperatureUnit }),
      updateProfile: (patch) => updatePreferences({ profile: { ...preferences.profile, ...patch } }),
      publicStories,
      savePublicStory: (story) =>
        setPublicStories((stories) => [...stories.filter((item) => item.id !== story.id), story]),
      addEvent: (e) => {
        const plant = state.plants.find((p) => p.id === e.plantId);
        const pendingPhoto = e.photoId ? pendingPhotos.current.get(e.photoId) : undefined;
        if (plant?.backendGrowCycleId) {
          const skipSynthetic =
            (e.title === "Cycle closed" || e.title === "Planting record corrected" || e.title.startsWith("Follow-up set:"));
          if (!skipSynthetic) {
            void persistMoment(plant, e, pendingPhoto)
              .then(() => {
                if (e.photoId) pendingPhotos.current.delete(e.photoId);
                return refreshFromBackend();
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
          void createFollowUpRecord(plant, t.label, t.dueInDays).then(refreshFromBackend).catch(() => undefined);
        }
        setState((s) => ({ ...s, tasks: [...s.tasks, { ...t, id: uid("task"), done: false }] }));
      },
      completeTask: (id, note) => {
        const task = state.tasks.find((t) => t.id === id);
        if (task?.backendAttentionId) {
          void completeAttention(task.backendAttentionId, note)
            .then(refreshFromBackend)
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
        if (plant?.backendGrowCycleId) void saveFilmRecord({ ...f, id }).then(refreshFromBackend).catch(() => undefined);
        setState((s) => ({ ...s, films: [...s.films, film] }));
      },
      addPlant: (p, photo) => {
        const id = crypto.randomUUID();
        const nextPlant: Plant = { ...p, id };
        const garden = state.gardens.find((g) => g.id === p.gardenId);
        const positionNumber = Number(p.slot?.match(/\d+/)?.[0] ?? "");
        const position = garden?.backendPositions?.find((item) => item.number === positionNumber);
        if (position) {
          const canonicalPhoto = photo ? { ...photo, id: crypto.randomUUID(), plantId: id } : undefined;
          void createPlantRecord(nextPlant, position.id, canonicalPhoto)
            .then(refreshFromBackend)
            .catch(() => undefined);
        }
        setState((s) => {
          const photoId = photo ? uid("photo") : undefined;
          return {
            ...s,
            plants: [...s.plants, { ...nextPlant, heroPhotoId: photoId ?? p.heroPhotoId }],
            photos: photo && photoId ? [...s.photos, { ...photo, id: photoId, plantId: id }] : s.photos,
            events: [...s.events, { id: uid("ev"), plantId: id, daysAgo: 0, type: "planted" as EventType,
              title: "Added to garden", detail: "Identity confirmed by you.", milestone: true, provenance: "recorded" }],
          };
        });
        return id;
      },
      updatePlant: (id, patch) => {
        const current = state.plants.find((p) => p.id === id);
        if (current?.backendGrowCycleId) {
          const next = { ...current, ...patch };
          if (patch.plantedDaysAgo !== undefined && patch.plantedDaysAgo !== current.plantedDaysAgo) {
            void correctPlantingRecord(current, patch.plantedDaysAgo, "Corrected in Garden X").then(refreshFromBackend).catch(() => undefined);
          }
          const targetGarden = patch.gardenId ? state.gardens.find((g) => g.id === patch.gardenId) : undefined;
          const targetNumber = patch.slot ? Number(patch.slot.match(/\d+/)?.[0] ?? "") : undefined;
          const targetPosition = targetGarden?.backendPositions?.find((item) => item.number === targetNumber);
          if (targetPosition && targetPosition.id !== current.backendPositionId) {
            void movePlantRecord(id, targetPosition.id, 0).then(refreshFromBackend).catch(() => undefined);
          }
          if (patch.name !== undefined || patch.species !== undefined || patch.scientific !== undefined || patch.variety !== undefined || patch.knowledgeId !== undefined) {
            void updatePlantIdentityRecord(next).then(refreshFromBackend).catch(() => undefined);
          }
          if (patch.cycleClosed === true && !current.cycleClosed) {
            void closePlantCycleRecord(current, 0, "closed", "Closed in Garden X").then(refreshFromBackend).catch(() => undefined);
          }
        }
        setState((s) => ({ ...s, plants: s.plants.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
      },
      updateGarden: (id, patch) => {
        const current = state.gardens.find((g) => g.id === id);
        if (current?.backendSystemInstanceId) void updateGardenRecord({ ...current, ...patch }).then(refreshFromBackend).catch(() => undefined);
        setState((s) => ({ ...s, gardens: s.gardens.map((garden) => (garden.id === id ? { ...garden, ...patch } : garden)) }));
      },
      setGardenArchived: (id, archived) => {
        const current = state.gardens.find((g) => g.id === id);
        if (current?.backendSystemInstanceId) void updateGardenRecord({ ...current, archived }).then(refreshFromBackend).catch(() => undefined);
        setState((s) => ({ ...s, gardens: s.gardens.map((garden) => (garden.id === id ? { ...garden, archived } : garden)) }));
      },
      deleteGarden: (id) => {
        const current = state.gardens.find((g) => g.id === id);
        if (current?.backendSystemInstanceId) {
          void deleteGardenRecord(id).then(refreshFromBackend).catch(() => undefined);
          return;
        }
        setState((s) => {
          const plantIds = new Set(s.plants.filter((p) => p.gardenId === id).map((p) => p.id));
          return { ...s, gardens: s.gardens.filter((garden) => garden.id !== id),
            plants: s.plants.filter((p) => !plantIds.has(p.id)), photos: s.photos.filter((photo) => !plantIds.has(photo.plantId)),
            events: s.events.filter((event) => !plantIds.has(event.plantId)), tasks: s.tasks.filter((task) => !plantIds.has(task.plantId)),
            films: s.films.filter((film) => !plantIds.has(film.plantId)) };
        });
      },
      addGarden: (g) => {
        const id = crypto.randomUUID();
        const next: Garden = { ...g, id, backendSystemInstanceId: crypto.randomUUID() };
        void createGardenRecord(next).then(refreshFromBackend).catch(() => undefined);
        setState((s) => ({ ...s, gardens: [...s.gardens, next] }));
        return id;
      },
      reorderGardens: (orderedIds) => {
        void reorderGardenRecords(orderedIds).catch(() => undefined);
        setState((s) => ({ ...s, gardens: [
          ...orderedIds.map((id) => s.gardens.find((garden) => garden.id === id)).filter((garden): garden is Garden => Boolean(garden)),
          ...s.gardens.filter((garden) => !orderedIds.includes(garden.id)),
        ] }));
      },
    }),
    [preferences, publicStories, refreshFromBackend, state],
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