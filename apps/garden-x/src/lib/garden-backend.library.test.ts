import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ rpc, storage: { from: () => ({ upload: vi.fn() }) } }),
}));

import { createLibraryPlantRecord } from "./garden-backend";

describe("Library-backed plant creation", () => {
  beforeEach(() => rpc.mockReset());

  it("writes only through the owner-scoped Library RPC", async () => {
    rpc.mockResolvedValue({
      data: { plant_instance_id: "plant-1", event_id: "event-1" },
      error: null,
    });
    await expect(
      createLibraryPlantRecord({
        plantInstanceId: "plant-1",
        positionId: "position-1",
        libraryPlantId: "genovese-basil",
        plantedOn: "2026-09-20",
        plantedOnPrecision: "exact",
      }),
    ).resolves.toEqual({ plantInstanceId: "plant-1" });
    expect(rpc).toHaveBeenCalledWith(
      "garden_x_create_library_plant",
      expect.objectContaining({
        p_plant_instance_id: "plant-1",
        p_position_id: "position-1",
        p_library_plant_id: "genovese-basil",
        p_request_id: expect.any(String),
      }),
    );
  });

  it("surfaces canonical failure before any local success can be projected", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Position already has a current plant" },
    });
    await expect(
      createLibraryPlantRecord({
        plantInstanceId: "plant-1",
        positionId: "occupied",
        libraryPlantId: "genovese-basil",
        plantedOn: null,
        plantedOnPrecision: "unknown",
      }),
    ).rejects.toThrow("Position already has a current plant");
  });
});
