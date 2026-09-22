import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getSession = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ auth: { getSession }, rpc }),
}));

import { persistMoment } from "./garden-backend";
import type { Photo, Plant, PlantEvent } from "./garden-data";

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

  it("does not report photo persistence success when Storage upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(persistMoment(plant, event("note"), photo)).rejects.toThrow(
      "Photo upload failed.",
    );
    expect(rpc.mock.calls.some(([name]) => name === "garden_x_prepare_event_photo")).toBe(true);
    expect(rpc.mock.calls.some(([name]) => name === "garden_mark_photo_uploaded")).toBe(false);
  });
});
