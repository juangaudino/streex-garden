import type { GardenState, Garden, Plant, Photo, PlantEvent, CareTask, EventType, MaintenanceType, Provenance } from "./garden-data";
import { getSupabaseClient } from "./supabase";

type BootstrapGarden = {
  id: string; name: string; system_instance_id: string; system_instance_name: string;
  system_definition_key: string | null; legacy_system_model: string | null;
  position_capacity: number; map_layout: string; cover_photo_id: string | null;
  positions: Array<{ id: string; position_number: number; layout: { site_id: string; site_kind: string; is_active: boolean; grid_x: number; grid_y: number; label: string | null } | null }>;
};
type BootstrapPlant = {
  id: string; nickname: string | null; reference_key: string | null; common_name: string; scientific_name: string | null;
  cultivar: string | null; status: string; grow_cycle_id: string; cycle_state: string; planted_on: string | null;
  planted_on_precision: string; harvest_readiness: string; garden_id: string; system_instance_id: string | null;
  position_id: string; position_number: number; occupied_from: string | null; occupied_until: string | null;
  latest_photo_id: string | null; latest_photo_storage_path: string | null; latest_photo_captured_at: string | null;
  latest_photo_captured_at_precision: string | null;
};
type BootstrapEvent = {
  id: string; plant_instance_id: string; grow_cycle_id: string; event_type: string; occurred_at: string; created_at: string;
  note: string | null; event_data: Record<string, unknown>; revision: number;
};
type BootstrapPhoto = {
  id: string; plant_instance_id: string; grow_cycle_id: string; event_id: string; storage_path: string; original_filename: string;
  content_type: string; byte_size: number; captured_at: string | null; captured_at_precision: string; width: number | null; height: number | null;
  media_scope: string;
};
type BootstrapAttention = {
  id: string; plant_instance_id: string; grow_cycle_id: string; garden_id: string | null; purpose: string; subject_key: string;
  title: string; origin: string; status: string; due_on: string | null; next_review_on: string | null; created_at: string;
};
type Bootstrap = { gardens: BootstrapGarden[]; plants: BootstrapPlant[]; events: BootstrapEvent[]; photos: BootstrapPhoto[]; attention: BootstrapAttention[] };

export type BackendIndex = {
  growCycleByPlantId: Map<string, string>;
  positionByPlantId: Map<string, string>;
  positionNumberByPlantId: Map<string, number>;
  revisionByEventId: Map<string, number>;
};

const dayMs = 86_400_000;
function daysAgo(value: string | null | undefined): number {
  if (!value) return 0;
  const date = new Date(value);
  const today = new Date();
  date.setHours(0,0,0,0); today.setHours(0,0,0,0);
  return Math.max(0, Math.round((today.getTime() - date.getTime()) / dayMs));
}
function eventType(type: string, data: Record<string, unknown>): EventType {
  if (type === "cycle_started" || type === "seeds_added") return "planted";
  if (type === "germination_observed" || type === "germination_confirmed") return "germinated";
  if (type === "harvest") return "harvest";
  if (type === "incident_opened") return "problem";
  if (type === "incident_resolved") return "recovery";
  if (type === "cycle_moved") return "transplant";
  if (type === "intervention") {
    const action = String(data.action ?? data.class ?? "").toLowerCase();
    if (action.includes("prun")) return "pruning";
    if (action.includes("thin")) return "thinning";
    if (action.includes("transplant") || action.includes("move")) return "transplant";
    return "maintenance";
  }
  return "note";
}
function provenance(type: string): Provenance {
  return ["observation","visual_review","development_review","plant_count_observed","germination_observed"].includes(type)
    ? "observed" : "recorded";
}
function titleFor(e: BootstrapEvent): string {
  if (e.note?.trim()) return e.note.trim().slice(0, 80);
  const labels: Record<string,string> = {
    cycle_started: "Cycle started", cycle_ended: "Cycle closed", cycle_moved: "Relocated",
    germination_confirmed: "Germination confirmed", germination_observed: "Germination observed",
    harvest: "Harvest", incident_opened: "Problem recorded", incident_resolved: "Problem resolved",
    visual_review: "Visual review", development_review: "Development review", plant_count_observed: "Plant count observed",
    seeds_added: "Seeds added", intervention: "Care recorded", observation: "Observation",
  };
  return labels[e.event_type] ?? e.event_type.replaceAll("_"," ");
}
function maintenanceType(purpose: string, subject: string): MaintenanceType {
  const value = (purpose + " " + subject).toLowerCase();
  if (value.includes("harvest")) return "harvest";
  if (value.includes("thin")) return "thinning";
  if (value.includes("water") || value.includes("reservoir")) return "watering";
  if (value.includes("nutrient") || value.includes("feed")) return "nutrients";
  if (value.includes("prun")) return "pruning";
  if (value.includes("pest")) return "pest";
  if (value.includes("light")) return "light";
  if (value.includes("clean") || value.includes("pump")) return "cleaning";
  return "custom";
}
async function signedUrl(path: string): Promise<string> {
  const { data, error } = await getSupabaseClient().storage.from("garden-originals").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function loadGardenState(): Promise<{ state: GardenState; index: BackendIndex }> {
  const { data, error } = await getSupabaseClient().rpc("garden_x_get_bootstrap");
  if (error) throw new Error(error.message);
  const b = data as Bootstrap;

  const urlEntries = await Promise.all((b.photos ?? []).map(async p => [p.id, await signedUrl(p.storage_path)] as const));
  const photoUrl = new Map(urlEntries);

  const gardens: Garden[] = (b.gardens ?? []).map(g => ({
    id: g.id,
    name: g.name,
    kind: "hydroponic",
    cover: "",
    coverPhotoId: g.cover_photo_id,
    place: "",
    note: "",
    machine: { name: g.system_instance_name || g.legacy_system_model || "Growing system", pods: g.position_capacity },
  }));

  const plants: Plant[] = (b.plants ?? []).filter(p => p.cycle_state === "active").map(p => ({
    id: p.id,
    gardenId: p.garden_id,
    name: p.nickname?.trim() || p.common_name,
    species: p.common_name,
    scientific: p.scientific_name ?? "",
    variety: p.cultivar ?? "",
    knowledgeId: p.reference_key ?? "",
    plantedDaysAgo: daysAgo(p.planted_on),
    slot: `Pod ${p.position_number}`,
    status: (b.attention ?? []).some(a => a.plant_instance_id === p.id) ? "watching" : "steady",
    statusNote: p.harvest_readiness === "ready" ? "Ready to harvest." : "",
    heroPhotoId: p.latest_photo_id ?? "",
    identityConfirmed: true,
    backendGrowCycleId: p.grow_cycle_id,
    backendPositionId: p.position_id,
  }));

  const events: PlantEvent[] = (b.events ?? []).map(e => ({
    id: e.id,
    plantId: e.plant_instance_id,
    daysAgo: daysAgo(e.occurred_at),
    type: eventType(e.event_type, e.event_data ?? {}),
    title: titleFor(e),
    detail: e.note ?? undefined,
    provenance: provenance(e.event_type),
    backendEventType: e.event_type,
    backendRevision: e.revision,
  }));

  const eventById = new Map((b.events ?? []).map(e => [e.id, e]));
  const photos: Photo[] = (b.photos ?? []).map(p => {
    const e = eventById.get(p.event_id);
    return {
      id: p.id,
      plantId: p.plant_instance_id,
      src: photoUrl.get(p.id) ?? "",
      daysAgo: daysAgo(p.captured_at ?? e?.occurred_at),
      caption: e?.note?.trim() || "Garden photo",
      metrics: { heightCm: 0, leafCount: 0, greenness: 0, density: 0 },
      backendStoragePath: p.storage_path,
      backendEventId: p.event_id,
    };
  });

  for (const g of gardens) {
    const own = plants.filter(p => p.gardenId === g.id).map(p => photos.find(ph => ph.id === p.heroPhotoId)).filter(Boolean) as Photo[];
    g.cover = own.sort((a,b) => a.daysAgo-b.daysAgo)[0]?.src ?? "";
  }

  const tasks: CareTask[] = (b.attention ?? []).map(a => {
    const due = a.due_on ?? a.next_review_on;
    const delta = due ? Math.round((new Date(due + "T00:00:00").getTime() - new Date().setHours(0,0,0,0)) / dayMs) : 0;
    return {
      id: a.id,
      plantId: a.plant_instance_id,
      type: maintenanceType(a.purpose, a.subject_key),
      label: a.title,
      dueInDays: delta,
      done: false,
      hint: a.origin,
      backendAttentionId: a.id,
    };
  });

  return {
    state: { gardens, plants, photos, events, tasks, films: [] },
    index: {
      growCycleByPlantId: new Map((b.plants ?? []).map(p => [p.id, p.grow_cycle_id])),
      positionByPlantId: new Map((b.plants ?? []).map(p => [p.id, p.position_id])),
      positionNumberByPlantId: new Map((b.plants ?? []).map(p => [p.id, p.position_number])),
      revisionByEventId: new Map((b.events ?? []).map(e => [e.id, e.revision])),
    },
  };
}

export async function completeAttention(taskId: string, note?: string) {
  const { error } = await getSupabaseClient().rpc("garden_complete_attention_item", {
    p_request_id: crypto.randomUUID(), p_task_id: taskId, p_note: note ?? null, p_review_result: null,
  });
  if (error) throw new Error(error.message);
}
