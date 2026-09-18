import type { GardenState, Garden, Plant, Photo, PlantEvent, CareTask, EventType, MaintenanceType, Provenance, Film } from "./garden-data";
import type { PublicStory, PublicStoryMoment } from "./public-story";
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
  const filmsResponse = await getSupabaseClient().rpc("garden_x_get_saved_films");
  if (filmsResponse.error) throw new Error(filmsResponse.error.message);
  const savedFilms = (filmsResponse.data ?? []) as Array<{ id: string; plant_instance_id: string; title: string; photo_ids: string[]; music: string; created_at: string }>;

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
    backendSystemInstanceId: g.system_instance_id,
    backendPositions: (g.positions ?? []).map((p) => ({
      id: p.id,
      number: p.position_number,
      gridX: p.layout?.grid_x,
      gridY: p.layout?.grid_y,
      label: p.layout?.label,
      active: p.layout?.is_active ?? true,
    })),
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
    state: { gardens, plants, photos, events, tasks, films: savedFilms.map((film) => ({ id: film.id, plantId: film.plant_instance_id, title: film.title, photoIds: film.photo_ids, music: film.music, createdDaysAgo: daysAgo(film.created_at) })) },
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


function isoDateFromDaysAgo(value: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, value));
  return d.toISOString().slice(0, 10);
}

async function cycleDetail(growCycleId: string): Promise<{ revision: number; history?: Array<{ id: string; event_type: string; occurred_at: string }> }> {
  const { data, error } = await getSupabaseClient().rpc("garden_get_cycle", { p_grow_cycle_id: growCycleId });
  if (error) throw new Error(error.message);
  const row = data as { revision?: number; history?: Array<{ id: string; event_type: string; occurred_at: string }> } | null;
  if (!row || typeof row.revision !== "number") throw new Error("Cycle revision unavailable.");
  return { revision: row.revision, history: row.history ?? [] };
}

function decodeDataUrl(src: string): { mime: string; bytes: Uint8Array } | null {
  const match = src.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const raw = atob(match[2]!);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return { mime: match[1]!, bytes };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function uploadEventPhoto(eventId: string, photo: Photo): Promise<void> {
  const decoded = decodeDataUrl(photo.src);
  if (!decoded) return;
  const photoId = crypto.randomUUID();
  const checksum = await sha256Hex(decoded.bytes);
  const capturedDate = isoDateFromDaysAgo(photo.daysAgo);
  const { data, error } = await getSupabaseClient().rpc("garden_x_prepare_event_photo", {
    p_photo_id: photoId,
    p_event_id: eventId,
    p_original_filename: "garden-photo",
    p_content_type: decoded.mime,
    p_byte_size: decoded.bytes.byteLength,
    p_captured_at: capturedDate + "T12:00:00Z",
    p_captured_at_precision: "approximate",
    p_checksum_sha256: checksum,
  });
  if (error) throw new Error(error.message);
  const prepared = data as { storage_path: string };
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/garden-originals/${prepared.storage_path}`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        Authorization: `Bearer ${session.access_token}`,
        "content-type": decoded.mime,
        "cache-control": "max-age=3600",
        "x-upsert": "false",
      },
      body: decoded.bytes,
    },
  );
  if (!response.ok && response.status !== 409) throw new Error("Photo upload failed.");
  const confirmation = await getSupabaseClient().rpc("garden_mark_photo_uploaded", {
    p_photo_id: photoId,
    p_checksum_sha256: checksum,
    p_width: null,
    p_height: null,
  });
  if (confirmation.error) throw new Error(confirmation.error.message);
}

export async function createPlantRecord(plant: Plant, positionId: string, photo?: Photo): Promise<void> {
  const plantedOn = isoDateFromDaysAgo(plant.plantedDaysAgo);
  const { data, error } = await getSupabaseClient().rpc("garden_x_create_plant", {
    p_request_id: crypto.randomUUID(),
    p_plant_instance_id: plant.id,
    p_position_id: positionId,
    p_nickname: plant.name,
    p_common_name: plant.species,
    p_scientific_name: plant.scientific || null,
    p_cultivar: plant.variety || null,
    p_reference_key: plant.knowledgeId || null,
    p_planted_on: plantedOn,
    p_planted_on_precision: "exact",
  });
  if (error) throw new Error(error.message);
  if (photo) {
    const created = data as { event_id: string };
    await uploadEventPhoto(created.event_id, photo);
  }
}

export async function updatePlantIdentityRecord(plant: Plant): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_update_plant_identity", {
    p_request_id: crypto.randomUUID(),
    p_plant_instance_id: plant.id,
    p_nickname: plant.name,
    p_common_name: plant.species,
    p_scientific_name: plant.scientific || null,
    p_cultivar: plant.variety || null,
    p_reference_key: plant.knowledgeId || null,
  });
  if (error) throw new Error(error.message);
}

export async function movePlantRecord(plantId: string, targetPositionId: string, movedDaysAgo: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_move_plant", {
    p_request_id: crypto.randomUUID(),
    p_plant_instance_id: plantId,
    p_target_position_id: targetPositionId,
    p_moved_on: isoDateFromDaysAgo(movedDaysAgo),
  });
  if (error) throw new Error(error.message);
}

export async function correctPlantingRecord(plant: Plant, newDaysAgo: number, reason?: string): Promise<void> {
  if (!plant.backendGrowCycleId) return;
  const cycle = await cycleDetail(plant.backendGrowCycleId);
  const { error } = await getSupabaseClient().rpc("garden_correct_cycle_planting", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: plant.backendGrowCycleId,
    p_expected_revision: cycle.revision,
    p_planted_on: isoDateFromDaysAgo(newDaysAgo),
    p_planted_on_precision: "exact",
    p_reason: reason?.trim() || "Corrected in Garden X",
  });
  if (error) throw new Error(error.message);
}

export async function closePlantCycleRecord(plant: Plant, daysAgoValue: number, reason: string, note?: string): Promise<void> {
  if (!plant.backendGrowCycleId) return;
  const cycle = await cycleDetail(plant.backendGrowCycleId);
  const { error } = await getSupabaseClient().rpc("garden_close_cycle", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: plant.backendGrowCycleId,
    p_expected_revision: cycle.revision,
    p_ended_on: isoDateFromDaysAgo(daysAgoValue),
    p_reason: reason || "closed",
    p_note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function createFollowUpRecord(plant: Plant, label: string, dueInDays: number): Promise<void> {
  if (!plant.backendGrowCycleId) return;
  const due = new Date();
  due.setHours(12,0,0,0);
  due.setDate(due.getDate() + Math.max(0, dueInDays));
  const subject = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";
  const value = label.toLowerCase();
  const purpose =
    value.includes("nutrient") ? "perform_nutrients" :
    value.includes("water") || value.includes("reservoir") ? "perform_water_change" :
    value.includes("harvest") ? "perform_harvest" :
    value.includes("prun") ? "evaluate_pruning" :
    value.includes("thin") ? "evaluate_thinning" :
    "evaluate_visual_review";
  const { error } = await getSupabaseClient().rpc("garden_create_attention_item", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: plant.gardenId,
    p_grow_cycle_id: plant.backendGrowCycleId,
    p_purpose: purpose,
    p_subject_key: subject,
    p_due_on: due.toISOString().slice(0,10),
  });
  if (error) throw new Error(error.message);
}

async function recordFact(
  growCycleId: string,
  factType: string,
  occurredDaysAgo: number,
  note: string | undefined,
  factData: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("garden_record_cycle_fact", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: growCycleId,
    p_fact_type: factType,
    p_occurred_on: isoDateFromDaysAgo(occurredDaysAgo),
    p_note: note?.trim() || null,
    p_fact_data: factData,
  });
  if (error) throw new Error(error.message);
  return (data as { event_id: string }).event_id;
}

async function recordObservation(growCycleId: string, event: Omit<PlantEvent, "id">): Promise<string> {
  const note = [event.title, event.detail].filter(Boolean).join(" — ").slice(0, 1000);
  const occurred = isoDateFromDaysAgo(event.daysAgo);
  const { data, error } = await getSupabaseClient().rpc("garden_create_observation", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: growCycleId,
    p_note: note || "Observation",
    p_original_filename: null,
    p_content_type: null,
    p_byte_size: null,
    p_captured_at: null,
    p_captured_at_precision: "unknown",
    p_checksum_sha256: null,
  });
  if (error) throw new Error(error.message);
  const eventId = (data as { event_id: string }).event_id;
  // Preserve the user-selected moment date as a correction of the event timestamp.
  if (event.daysAgo > 0) {
    const { error: dateError } = await getSupabaseClient().rpc("garden_correct_event_date", {
      p_request_id: crypto.randomUUID(),
      p_event_id: eventId,
      p_occurred_on: occurred,
      p_reason: "Date selected in Garden X Record a moment",
    });
    if (dateError) {
      // Older deployments may not expose this helper; the observation remains canonical.
    }
  }
  return eventId;
}

export async function persistMoment(plant: Plant, event: Omit<PlantEvent, "id">, photo?: Photo): Promise<void> {
  if (!plant.backendGrowCycleId) return;
  const cycleId = plant.backendGrowCycleId;
  let eventId: string;

  if (event.type === "germinated") {
    eventId = await recordFact(cycleId, "germination_observed", event.daysAgo, event.detail || event.title, {});
  } else if (event.type === "problem") {
    eventId = await recordFact(cycleId, "incident_opened", event.daysAgo, event.detail || event.title, { severity: "watch" });
  } else if (event.type === "recovery") {
    const detail = await cycleDetail(cycleId);
    const history = [...(detail.history ?? [])].sort((a,b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    const incident = history.find(h => h.event_type === "incident_opened");
    eventId = incident
      ? await recordFact(cycleId, "incident_resolved", event.daysAgo, event.detail || event.title, { incident_event_id: incident.id })
      : await recordObservation(cycleId, event);
  } else if (event.type === "pruning" || event.type === "thinning") {
    eventId = await recordFact(cycleId, "intervention", event.daysAgo, event.detail || event.title, {
      class: event.type === "pruning" ? "pruning" : "thinning",
      action: event.title.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    });
  } else if (event.type === "harvest") {
    const detail = await cycleDetail(cycleId);
    const { data, error } = await getSupabaseClient().rpc("garden_record_harvest", {
      p_request_id: crypto.randomUUID(),
      p_grow_cycle_id: cycleId,
      p_expected_revision: detail.revision,
      p_note: event.detail || event.title,
    });
    if (error) throw new Error(error.message);
    eventId = (data as { event_id?: string } | null)?.event_id ?? "";
    if (!eventId) {
      const refreshed = await cycleDetail(cycleId);
      eventId = refreshed.history?.find(h => h.event_type === "harvest")?.id ?? "";
    }
  } else if (event.type === "maintenance") {
    eventId = await recordFact(cycleId, "intervention", event.daysAgo, event.detail || event.title, {
      class: "other",
      action: event.title.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    });
  } else if (event.type === "transplant" && event.title === "Relocated") {
    return;
  } else {
    eventId = await recordObservation(cycleId, event);
  }

  if (photo && eventId) await uploadEventPhoto(eventId, photo);
}


export async function createGardenRecord(garden: Garden, systemDefinitionKey?: string): Promise<void> {
  const systemId = garden.backendSystemInstanceId ?? crypto.randomUUID();
  const capacity = Math.max(1, Math.min(36, garden.machine?.pods ?? garden.backendPositions?.length ?? 1));
  const { error } = await getSupabaseClient().rpc("garden_x_create_garden", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: garden.id,
    p_system_instance_id: systemId,
    p_name: garden.name,
    p_kind: garden.kind,
    p_place: garden.place,
    p_note: garden.note,
    p_system_definition_key: systemDefinitionKey ?? null,
    p_system_name: garden.machine?.name ?? null,
    p_position_capacity: capacity,
  });
  if (error) throw new Error(error.message);
}

export async function updateGardenRecord(garden: Garden): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_update_garden", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: garden.id,
    p_name: garden.name,
    p_kind: garden.kind,
    p_place: garden.place,
    p_note: garden.note,
    p_archived: Boolean(garden.archived),
  });
  if (error) throw new Error(error.message);
}

export async function reorderGardenRecords(gardenIds: string[]): Promise<void> {
  if (!gardenIds.length) return;
  const { error } = await getSupabaseClient().rpc("garden_x_reorder_gardens", {
    p_request_id: crypto.randomUUID(),
    p_garden_ids: gardenIds,
  });
  if (error) throw new Error(error.message);
}

export async function deleteGardenRecord(gardenId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_delete_garden", {
    p_request_id: crypto.randomUUID(),
    p_garden_id: gardenId,
  });
  if (error) throw new Error(error.message);
}

export async function replacePlantRecord(oldPlant: Plant, newPlant: Plant): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_replace_plant", {
    p_request_id: crypto.randomUUID(),
    p_old_plant_instance_id: oldPlant.id,
    p_new_plant_instance_id: newPlant.id,
    p_nickname: newPlant.name,
    p_common_name: newPlant.species,
    p_scientific_name: newPlant.scientific || null,
    p_cultivar: newPlant.variety || null,
    p_reference_key: newPlant.knowledgeId || null,
    p_started_on: isoDateFromDaysAgo(newPlant.plantedDaysAgo),
  });
  if (error) throw new Error(error.message);
}


export async function askGardenAi(question: string, conversation: Array<{ question: string; answer: string }> = []) {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garden-ai`, {
    method: "POST",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operation: "ask_garden",
      question,
      conversation,
      request_key: `ask:${crypto.randomUUID()}`,
    }),
  });
  const body = await response.json().catch(() => null) as {
    answer?: { answer_type: string; answer: string; confirmed_facts: Array<{ source: { kind: string; id: string }; claim: string }>; suggested_next_actions: string[] };
    error?: string;
  } | null;
  if (!response.ok || !body?.answer) throw new Error(body?.error ?? "Garden AI could not answer.");
  return body.answer;
}


export async function runAiCheck(growCycleId: string, photoId: string, comparePhotoId?: string) {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const session = sessionData.session;
  if (!session) throw new Error("Authentication required");
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/garden-ai`, {
    method: "POST",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operation: "ai_check",
      grow_cycle_id: growCycleId,
      photo_id: photoId,
      compare_photo_id: comparePhotoId ?? null,
      request_key: `check:${crypto.randomUUID()}`,
    }),
  });
  const body = await response.json().catch(() => null) as { proposal?: Record<string, unknown>; request_id?: string; error?: string } | null;
  if (!response.ok || !body?.proposal) throw new Error(body?.error ?? "Garden AI could not analyse this photo.");
  return { proposal: body.proposal, requestId: body.request_id ?? "" };
}


export async function saveFilmRecord(film: Omit<Film, "id" | "createdDaysAgo"> & { id: string }): Promise<void> {
  const { error } = await getSupabaseClient().rpc("garden_x_save_film", {
    p_request_id: crypto.randomUUID(),
    p_film_id: film.id,
    p_plant_instance_id: film.plantId,
    p_title: film.title,
    p_photo_ids: film.photoIds,
    p_music: film.music,
  });
  if (error) throw new Error(error.message);
}


async function hashShareToken(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createPublicPlantStory(
  plant: Plant,
  selection: Array<{ event_id?: string; photo_id?: string; include_note?: boolean }>,
): Promise<string> {
  if (!plant.backendGrowCycleId) throw new Error("Plant history is not connected.");
  const token = crypto.randomUUID().toLowerCase();
  const { error } = await getSupabaseClient().rpc("garden_create_guest_plant_story", {
    p_request_id: crypto.randomUUID(),
    p_grow_cycle_id: plant.backendGrowCycleId,
    p_token_hash: await hashShareToken(token),
    p_item_selection: selection,
  });
  if (error) throw new Error(error.message);
  return token;
}

export async function loadPublicPlantStory(token: string): Promise<PublicStory> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-plant-story`, {
    method: "POST",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  const body = await response.json().catch(() => null) as { story?: Record<string, unknown>; error?: string } | null;
  if (!response.ok || !body?.story) throw new Error(body?.error ?? "Story unavailable.");
  const s = body.story as {
    id: string; crop_name?: string; planted_on?: string | null; created_at?: string;
    history?: Array<{ id: string; event_type: string; occurred_at?: string | null; note?: string | null; photo?: { id: string; url?: string } | null }>;
  };
  const plantedDaysAgo = daysAgo(s.planted_on);
  const moments: PublicStoryMoment[] = [];
  for (const item of s.history ?? []) {
    const momentDays = daysAgo(item.occurred_at);
    if (item.photo?.url) {
      moments.push({ id: `photo:${item.photo.id}`, daysAgo: momentDays, kind: "photo", photo: {
        id: item.photo.id, plantId: s.id, src: item.photo.url, daysAgo: momentDays, caption: item.note ?? "Garden photo",
        metrics: { heightCm: 0, leafCount: 0, greenness: 0, density: 0 },
      } });
    }
    if (item.note) {
      moments.push({ id: `event:${item.id}`, daysAgo: momentDays, kind: "event", event: {
        id: item.id, plantId: s.id, daysAgo: momentDays, type: eventType(item.event_type, {}), title: item.note,
        provenance: provenance(item.event_type),
      } });
    }
  }
  return {
    id: token,
    plant: { id: s.id, name: s.crop_name ?? "Plant", species: s.crop_name ?? "Plant", scientific: "", variety: "", plantedDaysAgo },
    moments,
  };
}
