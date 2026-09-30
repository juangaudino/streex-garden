// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, getSession, uploadPrepared } = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn(), uploadPrepared: vi.fn() }));

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ auth: { getSession }, rpc }),
}));
vi.mock("./photo-storage-provider", () => ({
  photoStorageProvider: {
    uploadPrepared,
    download: vi.fn(),
    remove: vi.fn(),
    removeGarden: vi.fn(),
  },
}));

import {
  createGardenRecord,
  loadGardenState,
  persistMoment,
  retryPendingEventPhoto,
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
    uploadPrepared.mockReset();
    uploadPrepared.mockResolvedValue(undefined);
    getSession.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    getSession.mockResolvedValue({ data: { session: { access_token: "session" } } });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1200, height: 800, close: vi.fn() })));
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: vi.fn() }),
          toBlob: (callback: BlobCallback) => callback(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })),
        } as unknown as HTMLCanvasElement;
      }
      return createElement(tagName, options);
    }) as typeof document.createElement);
    rpc.mockImplementation(async (name: string) => {
      if (name === "garden_get_cycle") return { data: { revision: 7, history: [] }, error: null };
      if (name === "garden_x_create_observation")
        return { data: { event_id: "event-observation" }, error: null };
      if (name === "garden_x_create_journal_moment")
        return { data: { event_id: "event-journal" }, error: null };
      if (name === "garden_x_record_harvest")
        return { data: { event_id: "event-harvest" }, error: null };
      if (name === "garden_record_cycle_fact") return { data: { event_id: "event-fact" }, error: null };
      if (name === "garden_x_prepare_event_photo")
        return { data: { storage_path: "owner/photo/original.jpg" }, error: null };
      if (name === "garden_mark_photo_uploaded") return { data: null, error: null };
      if (name === "garden_x_update_garden_settings")
        return { data: { updated: true }, error: null };
      if (name === "garden_x_create_garden")
        return { data: { garden_id: "garden-1" }, error: null };
      if (name === "garden_x_create_garden_with_layout")
        return { data: { garden_id: "garden-1", layout_configured: true }, error: null };
      if (name === "garden_x_set_machine_model")
        return { data: { garden_id: "garden-1", gardenpedia_model_id: "uruq-hp-gc001" }, error: null };
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
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps observation and its photo on the selected effective date", async () => {
    await persistMoment(plant, event("note"), photo);
    const observation = rpc.mock.calls.find(([name]) => name === "garden_x_create_observation");
    const prepare = rpc.mock.calls.find(([name]) => name === "garden_x_prepare_event_photo");
    expect(observation?.[1]).toMatchObject({ p_occurred_on: "2026-09-04" });
    expect(prepare?.[1]).toMatchObject({ p_captured_at: "2026-09-04T12:00:00.000Z" });
    expect(uploadPrepared).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(false);
  });

  it("uploads display and preview sidecars next to the canonical original without changing its path", async () => {
    const bitmapClose = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1600, height: 1200, close: bitmapClose })));
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: (blob: Blob) => void) => callback(new Blob([new Uint8Array([1])], { type: "image/jpeg" })),
      }),
    });

    await persistMoment(plant, event("note"), photo);

    expect(uploadPrepared).toHaveBeenCalledWith(
      expect.any(String),
      "owner/photo/original.jpg",
      expect.objectContaining({ width: 1600, height: 1200 }),
      expect.any(String),
    );
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(false);
    expect(bitmapClose).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("retries incomplete photo media against the same canonical photo/event without duplicating a Moment", async () => {
    await retryPendingEventPhoto(
      { eventId: "event-journal", photoId: "00000000-0000-4000-8000-000000000001", effectiveDate: "2026-09-04" },
      photo,
    );

    const prepare = rpc.mock.calls.find(([name]) => name === "garden_x_prepare_event_photo");
    expect(prepare?.[1]).toMatchObject({
      p_photo_id: "00000000-0000-4000-8000-000000000001",
      p_event_id: "event-journal",
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "garden_x_prepare_event_photo",
    ]);
    expect(uploadPrepared).toHaveBeenCalledTimes(1);
  });

  it("keeps a closed grow cycle and its canonical events/photos available to Plant Journal", async () => {
    const closedPhoto = {
      id: "photo-closed",
      plant_instance_id: "plant-closed",
      grow_cycle_id: "cycle-closed",
      event_id: "event-ended",
      storage_path: "owner/photo.jpg",
      original_filename: "photo.jpg",
      content_type: "image/jpeg",
      byte_size: 128,
      captured_at: "2026-09-20T12:00:00Z",
      captured_at_precision: "exact",
      width: 1,
      height: 1,
      media_scope: "cycle_evidence",
    };
    rpc.mockImplementation(async (name: string) => {
      if (name === "garden_x_get_bootstrap")
        return {
          data: {
            gardens: [],
            plants: [
              {
                id: "plant-closed",
                nickname: null,
                reference_key: "lettuce",
                common_name: "Buttercrunch Lettuce",
                scientific_name: "Lactuca sativa",
                cultivar: "Buttercrunch",
                status: "ended",
                grow_cycle_id: "cycle-closed",
                cycle_state: "closed",
                planted_on: "2026-08-01",
                planted_on_precision: "exact",
                harvest_readiness: "not_applicable",
                garden_id: "garden-1",
                system_instance_id: "system-1",
                position_id: "position-1",
                position_number: 1,
                occupied_from: "2026-08-01",
                occupied_until: "2026-09-24",
                latest_photo_id: "photo-closed",
                latest_photo_storage_path: closedPhoto.storage_path,
                latest_photo_captured_at: closedPhoto.captured_at,
                latest_photo_captured_at_precision: "exact",
              },
            ],
            events: [
              {
                id: "event-ended",
                plant_instance_id: "plant-closed",
                grow_cycle_id: "cycle-closed",
                event_type: "cycle_ended",
                occurred_at: "2026-09-24T12:00:00Z",
                created_at: "2026-09-24T12:00:00Z",
                note: "Harvest completed",
                event_data: { reason: "productive_end" },
                revision: 1,
              },
            ],
            photos: [closedPhoto],
            attention: [],
          },
          error: null,
        };
      if (name === "garden_get_system_maintenance_events") return { data: [], error: null };
      if (name === "garden_x_get_saved_films") return { data: [], error: null };
      if (name === "garden_x_get_historical_photos") return { data: [], error: null };
      if (name === "garden_x_get_invalidated_event_photos") return { data: [], error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });

    const { state } = await loadGardenState();
    expect(state.plants).toEqual([]);
    expect(state.historicalPlants).toHaveLength(1);
    expect(state.historicalPlants[0]).toMatchObject({
      id: "plant-closed",
      cycleClosed: true,
      plantedDatePrecision: "exact",
    });
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ plantId: "plant-closed", type: "note" });
    expect(state.photos).toHaveLength(1);
    expect(state.photos[0]).toMatchObject({ plantId: "plant-closed", backendGrowCycleId: "cycle-closed" });
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
    expect(uploadPrepared).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(false);
  });

  it("records sprouted as a dated human-confirmed state with optional photo evidence", async () => {
    await persistMoment(plant, { ...event("sprouted"), title: "Sprouted" }, photo);
    const observation = rpc.mock.calls.find(([name]) => name === "garden_x_create_observation");
    const prepare = rpc.mock.calls.find(([name]) => name === "garden_x_prepare_event_photo");
    expect(observation?.[1]).toMatchObject({ p_occurred_on: "2026-09-04" });
    expect(prepare?.[1]).toMatchObject({ p_captured_at: "2026-09-04T12:00:00.000Z" });
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(false);
  });

  it("stores the journal milestone and note together before attaching its photo", async () => {
    await persistMoment(plant, {
      ...event("flowering"),
      title: "First flowers",
      detail: "Two flowers opened today.",
      journalMilestone: "flowering",
    }, photo);

    const moment = rpc.mock.calls.find(([name]) => name === "garden_x_create_journal_moment");
    const prepare = rpc.mock.calls.find(([name]) => name === "garden_x_prepare_event_photo");
    expect(moment?.[1]).toMatchObject({
      p_grow_cycle_id: "cycle-1",
      p_occurred_on: "2026-09-04",
      p_note: "Two flowers opened today.",
      p_milestone: "flowering",
      p_has_photo: true,
    });
    expect(prepare?.[1]).toMatchObject({ p_event_id: "event-journal" });
  });

  it("persists a canonical F1B Life Event identifier through the existing F1 moment RPC", async () => {
    await persistMoment(plant, {
      ...event("flowering"),
      title: "Floreció",
      detail: "Floreció",
      lifeEvent: "flowered",
      milestone: true,
    });
    const moment = rpc.mock.calls.find(([name]) => name === "garden_x_create_journal_moment");
    expect(moment?.[1]).toMatchObject({
      p_grow_cycle_id: "cycle-1",
      p_milestone: "flowered",
      p_note: "Floreció",
      p_has_photo: false,
    });
  });

  it("persists a photo-only journal entry as an observation plus the canonical photo attachment", async () => {
    await persistMoment(plant, {
      ...event("photo"),
      title: "Photo added",
      detail: undefined,
    }, photo);

    expect(rpc).toHaveBeenCalledWith("garden_x_create_observation", expect.objectContaining({
      p_grow_cycle_id: "cycle-1",
      p_note: "Photo added",
    }));
    expect(rpc.mock.calls.some(([name]) => name === "garden_x_prepare_event_photo")).toBe(true);
  });

  it("records Looks good through the existing canonical visual_review fact", async () => {
    await persistMoment(plant, {
      ...event("note"),
      backendEventType: "visual_review",
      title: "Reviewed — looks good",
      detail: "Reassuring visual review confirmed by the user.",
      provenance: "observed",
    });
    const review = rpc.mock.calls.find(([name]) => name === "garden_record_cycle_fact");
    expect(review?.[1]).toMatchObject({
      p_grow_cycle_id: "cycle-1",
      p_fact_type: "visual_review",
      p_occurred_on: "2026-09-04",
      p_fact_data: { result: "reassuring" },
    });
  });

  it("records Water + nutrients as one plant intervention with the combined action key", async () => {
    await persistMoment(plant, { ...event("maintenance"), title: "Water + nutrients" });
    const intervention = rpc.mock.calls.find(([name]) => name === "garden_record_cycle_fact");
    expect(intervention?.[1]).toMatchObject({
      p_fact_type: "intervention",
      p_fact_data: { class: "other", action: "water_and_nutrients" },
    });
    expect(rpc.mock.calls.filter(([name]) => name === "garden_record_cycle_fact")).toHaveLength(1);
  });

  it("does not report photo persistence success when the R2 gateway upload fails", async () => {
    uploadPrepared.mockRejectedValue(new Error("R2 gateway unavailable"));

    await expect(persistMoment(plant, event("note"), photo)).rejects.toMatchObject({
      name: "IncompleteGardenPhotoProcessingError",
      retry: { eventId: "event-observation", photoId: expect.any(String) },
    });
    expect(rpc.mock.calls.some(([name]) => name === "garden_x_prepare_event_photo")).toBe(true);
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(false);
  });

  it("sends Garden name, location, purpose, and System Instance name as distinct fields", async () => {
    const garden: Garden = {
      id: "garden-1",
      name: "H5 Greens",
      kind: "hydroponic",
      cover: "",
      place: "Kitchen",
      note: "Dedicado a Greens",
      machine: { name: "Uruq", pods: 12 },
      backendSystemInstanceId: "system-1",
      systemDefinitionKey: "uruq_12_v1",
      coverPhotoId: "preserved-cover-id",
      backendPositions: Array.from({ length: 12 }, (_, index) => ({ id: `position-${index + 1}`, number: index + 1 })),
      systemLayoutLevels: [{ levelNumber: 1, rows: 3, columns: 7 }],
    };

    await updateGardenRecord(garden, { updateSystemName: true });

    expect(rpc).toHaveBeenCalledWith(
      "garden_x_update_garden_settings",
      expect.objectContaining({
        p_garden_id: "garden-1",
        p_system_instance_id: "system-1",
        p_name: "H5 Greens",
        p_place: "Kitchen",
        p_note: "Dedicado a Greens",
      p_system_name: "Uruq",
      }),
    );
    const args = rpc.mock.calls.find(([name]) => name === "garden_x_update_garden_settings")?.[1];
    expect(args).not.toHaveProperty("p_system_definition_key");
    expect(args).not.toHaveProperty("p_position_capacity");
    expect(garden.machine?.pods).toBe(12);
    expect(garden.systemDefinitionKey).toBe("uruq_12_v1");
    expect(garden.coverPhotoId).toBe("preserved-cover-id");
    expect(garden.systemLayoutLevels).toHaveLength(1);
  });

  it("does not request a System Instance mutation for Garden-only metadata", async () => {
    const garden: Garden = {
      id: "garden-1",
      name: "H5 Renamed",
      kind: "hydroponic",
      cover: "",
      place: "Kitchen",
      note: "Metadata only",
      machine: { name: "Uruq", pods: 12 },
      backendSystemInstanceId: "system-1",
      systemDefinitionKey: "uruq_12_v1",
      backendPositions: [],
    };

    await updateGardenRecord(garden, { updateSystemName: false });
    const args = rpc.mock.calls.find(([name]) => name === "garden_x_update_garden_settings")?.[1];
    expect(args).toMatchObject({ p_name: "H5 Renamed", p_place: "Kitchen", p_note: "Metadata only" });
    expect(args).toMatchObject({ p_system_name: null });
  });

  it("reconstructs Garden metadata and System Instance identity independently from canonical bootstrap", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "garden_x_get_bootstrap") return { data: {
        gardens: [{
          id: "garden-h5", name: "H5 Greens", system_instance_id: "system-instance-h5",
          system_instance_name: "Uruq", system_definition_key: "uruq_12_v1", legacy_system_model: "Uruq 12",
          position_capacity: 12, map_layout: "uruq_12_v1", cover_photo_id: "preserved-cover-id",
          kind: "hydroponic", cultivation_method: "hydroponic", place: "Kitchen",
          note: "Dedicado a Greens", sort_order: 4, archived_at: null,
          positions: [{ id: "position-1", position_number: 1, layout: { site_id: "site-1", site_kind: "grow", is_active: true, grid_x: 2, grid_y: 1, label: "Pod 1" } }],
        }], plants: [{
          id: "plant-bare-root", nickname: null, reference_key: "monterey-strawberry",
          common_name: "Monterey Strawberry", scientific_name: "Fragaria × ananassa", cultivar: null,
          status: "active", grow_cycle_id: "cycle-bare-root", cycle_state: "active",
          planted_on: "2026-09-01", planted_on_precision: "exact", origin_type: "bare_root",
          harvest_readiness: "unknown", garden_id: "garden-h5", system_instance_id: "system-instance-h5",
          position_id: "position-1", position_number: 1, occupied_from: "2026-09-01", occupied_until: null,
          latest_photo_id: null, latest_photo_storage_path: null,
          latest_photo_captured_at: null, latest_photo_captured_at_precision: "unknown",
          library_plant_id: "monterey-strawberry", library_catalog_version: "gardenpedia-v1",
          library_common_name_snapshot: "Monterey Strawberry", library_scientific_name_snapshot: "Fragaria × ananassa",
          library_cultivar_snapshot: null,
        }], events: [{
          id: "f1-flowering-event", plant_instance_id: "plant-bare-root", grow_cycle_id: "cycle-bare-root",
          garden_id: "garden-h5", event_type: "observation", occurred_at: "2026-09-02T12:00:00.000Z",
          created_at: "2026-09-02T12:00:00.000Z", note: "Flowers opened",
          event_data: { source: "garden_x_journal", occurred_on: "2026-09-02", occurred_at_precision: "date", journal_milestone: "flowering", photo_expected: false },
          revision: 1,
        }], photos: [], attention: [],
      }, error: null };
      if (name === "garden_get_system_maintenance_events" || name === "garden_x_get_saved_films" || name === "garden_x_get_historical_photos" || name === "garden_x_get_invalidated_event_photos") return { data: [], error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });

    const { state } = await loadGardenState();
    expect(state.gardens).toHaveLength(1);
    expect(state.gardens[0]).toMatchObject({
      id: "garden-h5", name: "H5 Greens", place: "Kitchen", note: "Dedicado a Greens",
      machine: { name: "Uruq", pods: 12 }, backendSystemInstanceId: "system-instance-h5",
      systemDefinitionKey: "uruq_12_v1", coverPhotoId: "preserved-cover-id",
    });
    expect(state.gardens[0]?.backendPositions?.[0]).toMatchObject({ id: "position-1", number: 1, gridX: 2, gridY: 1 });
    expect(state.plants[0]).toMatchObject({
      id: "plant-bare-root",
      originType: "bare_root",
      libraryPlantId: "monterey-strawberry",
      backendGrowCycleId: "cycle-bare-root",
    });
    expect(state.events[0]).toMatchObject({
      id: "f1-flowering-event",
      lifeEvent: "flowered",
      journalMilestone: "flowering",
      detail: "Flowers opened",
    });
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

  it("links a known Gardenpedia machine model without duplicating its public definition", async () => {
    const garden: Garden = {
      id: "garden-1",
      name: "H1",
      kind: "hydroponic",
      cultivationMethod: "hydroponic",
      systemDefinitionKey: "uruq_8_v1",
      gardenpediaModelId: "uruq-hp-gc001",
      machine: { name: "URUQ 8-Pod", pods: 8 },
      cover: "",
      place: "",
      note: "",
    };

    await createGardenRecord(garden, garden.systemDefinitionKey ?? undefined);

    expect(rpc).toHaveBeenCalledWith(
      "garden_x_set_machine_model",
      expect.objectContaining({
        p_garden_id: "garden-1",
        p_gardenpedia_model_id: "uruq-hp-gc001",
      }),
    );
  });

  it("creates a known machine with an explicit independent instance layout", async () => {
    const garden: Garden = {
      id: "garden-new",
      name: "Test URUQ",
      kind: "hydroponic",
      cultivationMethod: "hydroponic",
      systemDefinitionKey: "uruq_8_v1",
      gardenpediaModelId: "uruq-hp-gc001",
      machine: { name: "URUQ 8-Pod", pods: 8 },
      initialSystemLayout: [{ rows: 2, columns: 4, activeCells: [{ row: 1, column: 1 }, { row: 1, column: 2 }, { row: 2, column: 3 }, { row: 2, column: 4 }, { row: 1, column: 4 }, { row: 2, column: 1 }, { row: 1, column: 3 }, { row: 2, column: 2 }] }],
      cover: "",
      place: "",
      note: "",
    };

    await createGardenRecord(garden, garden.systemDefinitionKey ?? undefined);

    expect(rpc).toHaveBeenCalledWith(
      "garden_x_create_garden_with_layout",
      expect.objectContaining({
        p_garden_id: "garden-new",
        p_gardenpedia_model_id: "uruq-hp-gc001",
        p_levels: [{ rows: 2, columns: 4, active_cells: garden.initialSystemLayout[0].activeCells }],
      }),
    );
    expect(rpc.mock.calls.some(([name]) => name === "garden_x_set_machine_model")).toBe(false);
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
