import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getSession = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ auth: { getSession }, rpc }),
}));

import {
  createGardenRecord,
  loadGardenState,
  persistMoment,
  updateGardenRecord,
} from "./garden-backend";
import type { Garden, Photo, Plant, PlantEvent } from "./garden-data";

const plant: Plant = {
  id: "plant-1",
  gardenId: "garden-1",
  name: "Basil",
  species: "Basil",
  scientific: "Ocimum basilicum",
  variety: "Genovese",
  knowledgeId: "basil",
  plantedDaysAgo: 12,
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
  backendGrowCycleId: "cycle-1",
};

const photo: Photo = {
  id: "photo-local",
  plantId: plant.id,
  src: "data:image/jpeg;base64,ZmFrZQ==",
  daysAgo: 18,
  capturedAt: null,
  capturedAtPrecision: "unknown",
  caption: "historical moment",
  metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
};

const event = (type: PlantEvent["type"]): Omit<PlantEvent, "id"> => ({
  plantId: plant.id,
  daysAgo: 18,
  occurredAt: "2026-09-04T12:00:00.000Z",
  type,
  title: type === "harvest" ? "First harvest" : "Leaves looked pale",
  detail: "Recorded from a historical moment",
  provenance: "recorded",
});

describe("Record a Moment canonical temporal propagation", () => {
  beforeEach(() => {
    rpc.mockReset();
    getSession.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    getSession.mockResolvedValue({ data: { session: { access_token: "session" } } });
    rpc.mockImplementation(async (name: string) => {
      if (name === "garden_get_cycle") return { data: { revision: 7, history: [] }, error: null };
      if (name === "garden_x_create_observation")
        return { data: { event_id: "event-observation" }, error: null };
      if (name === "garden_x_record_harvest")
        return { data: { event_id: "event-harvest" }, error: null };
      if (name === "garden_x_prepare_event_photo")
        return { data: { storage_path: "owner/photo/original.jpg" }, error: null };
      if (name === "garden_mark_photo_uploaded") return { data: null, error: null };
      if (name === "garden_x_update_garden_with_system")
        return { data: { updated: true }, error: null };
      if (name === "garden_x_create_garden")
        return { data: { garden_id: "garden-1" }, error: null };
      if (name === "garden_x_set_cultivation_method")
        return { data: { updated: true }, error: null };
      if (name === "garden_x_get_bootstrap")
        return {
          data: { gardens: [], plants: [], events: [], photos: [], attention: [] },
          error: null,
        };
      if (name === "garden_get_system_maintenance_events") return { data: [], error: null };
      if (name === "garden_x_get_saved_films") return { data: [], error: null };
      if (name === "garden_x_get_historical_photos") return { data: [], error: null };
      if (name === "garden_x_get_invalidated_event_photos") return { data: [], error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });
  });

  it("keeps observation and its photo on the selected effective date", async () => {
    await persistMoment(plant, event("note"), photo);
    const observation = rpc.mock.calls.find(([name]) => name === "garden_x_create_observation");
    const prepare = rpc.mock.calls.find(([name]) => name === "garden_x_prepare_event_photo");
    expect(observation?.[1]).toMatchObject({ p_occurred_on: "2026-09-04" });
    expect(prepare?.[1]).toMatchObject({ p_captured_at: "2026-09-04T12:00:00.000Z" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(true);
  });

  it("maps the Record a Moment date precision to the canonical photo contract", async () => {
    await persistMoment(plant, event("note"), {
      ...photo,
      capturedAt: "2026-09-04T12:00:00.000Z",
      capturedAtPrecision: "date",
    });

    const prepare = rpc.mock.calls.find(([name]) => name === "garden_x_prepare_event_photo");
    expect(prepare?.[1]).toMatchObject({
      p_captured_at: "2026-09-04T12:00:00.000Z",
      p_captured_at_precision: "exact",
    });
  });

  it("keeps harvest and its photo on the selected effective date", async () => {
    await persistMoment(plant, event("harvest"), photo);
    const harvest = rpc.mock.calls.find(([name]) => name === "garden_x_record_harvest");
    const prepare = rpc.mock.calls.find(([name]) => name === "garden_x_prepare_event_photo");
    expect(harvest?.[1]).toMatchObject({ p_occurred_on: "2026-09-04" });
    expect(prepare?.[1]).toMatchObject({ p_captured_at: "2026-09-04T12:00:00.000Z" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(true);
  });

  it("records sprouted as a dated human-confirmed state with optional photo evidence", async () => {
    await persistMoment(plant, { ...event("sprouted"), title: "Sprouted" }, photo);
    const observation = rpc.mock.calls.find(([name]) => name === "garden_x_create_observation");
    const prepare = rpc.mock.calls.find(([name]) => name === "garden_x_prepare_event_photo");
    expect(observation?.[1]).toMatchObject({ p_occurred_on: "2026-09-04" });
    expect(prepare?.[1]).toMatchObject({ p_captured_at: "2026-09-04T12:00:00.000Z" });
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(true);
  });

  it("does not report photo persistence success when Storage upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(persistMoment(plant, event("note"), photo)).rejects.toThrow(
      "Photo upload failed.",
    );
    expect(rpc.mock.calls.some(([name]) => name === "garden_x_prepare_event_photo")).toBe(true);
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(false);
  });

  it("persists the editable system name with garden metadata", async () => {
    const garden: Garden = {
      id: "garden-1",
      name: "Garden 1",
      kind: "hydroponic",
      cover: "",
      place: "Kitchen",
      note: "",
      machine: { name: "H1", pods: 8 },
      backendSystemInstanceId: "system-1",
    };

    await updateGardenRecord(garden);

    expect(rpc).toHaveBeenCalledWith(
      "garden_x_update_garden_with_system",
      expect.objectContaining({ p_garden_id: "garden-1", p_system_name: "H1" }),
    );
  });

  it("persists explicit cultivation method and stable system identity separately from Garden kind", async () => {
    const garden: Garden = {
      id: "garden-1",
      name: "Balcony",
      kind: "balcony",
      cultivationMethod: "container",
      systemDefinitionKey: "balcony-pots-v1",
      cover: "",
      place: "",
      note: "",
    };

    await createGardenRecord(garden, garden.systemDefinitionKey ?? undefined);

    expect(rpc).toHaveBeenCalledWith(
      "garden_x_create_garden",
      expect.objectContaining({ p_system_definition_key: "balcony-pots-v1", p_kind: "balcony" }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "garden_x_set_cultivation_method",
      expect.objectContaining({ p_garden_id: "garden-1", p_cultivation_method: "container" }),
    );
  });

  it("loads only recognized canonical cultivation values and leaves absent values unknown", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "garden_x_get_bootstrap")
        return {
          data: {
            gardens: [
              {
                id: "garden-hydro",
                name: "Hydro",
                system_instance_id: "system-hydro",
                system_instance_name: "Aera One",
                system_definition_key: "aera-one-v1",
                legacy_system_model: null,
                position_capacity: 1,
                map_layout: "custom_grid",
                cover_photo_id: null,
                kind: "hydroponic",
                cultivation_method: "hydroponic",
                place: "",
                note: "",
                sort_order: 0,
                archived_at: null,
                positions: [],
              },
              {
                id: "garden-unknown",
                name: "Unknown",
                system_instance_id: "system-unknown",
                system_instance_name: "Custom",
                system_definition_key: null,
                legacy_system_model: null,
                position_capacity: 1,
                map_layout: "custom_grid",
                cover_photo_id: null,
                kind: "hydroponic",
                cultivation_method: "future_value",
                place: "",
                note: "",
                sort_order: 1,
                archived_at: null,
                positions: [],
              },
            ],
            plants: [],
            events: [],
            photos: [],
            attention: [],
          },
          error: null,
        };
      if (
        name === "garden_get_system_maintenance_events" ||
        name === "garden_x_get_saved_films" ||
        name === "garden_x_get_historical_photos" ||
        name === "garden_x_get_invalidated_event_photos"
      )
        return { data: [], error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });

    const { state } = await loadGardenState();
    expect(state.gardens.find((garden) => garden.id === "garden-hydro")?.cultivationMethod).toBe(
      "hydroponic",
    );
    expect(
      state.gardens.find((garden) => garden.id === "garden-unknown")?.cultivationMethod,
    ).toBeNull();
    expect(state.gardens.find((garden) => garden.id === "garden-hydro")?.systemDefinitionKey).toBe(
      "aera-one-v1",
    );
  });
});
