import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

import { closePlantCycleRecord, movePlantRecord } from "./garden-backend";

describe("canonical plant relocation", () => {
  beforeEach(() => rpc.mockReset());

  it("calls the owner-scoped move RPC with the effective move date", async () => {
    rpc.mockResolvedValue({
      data: { plant_instance_id: "plant-a", event_id: "event-1" },
      error: null,
    });
    await movePlantRecord("plant-a", "position-b", 2);
    expect(rpc).toHaveBeenCalledWith(
      "garden_x_move_plant",
      expect.objectContaining({
        p_plant_instance_id: "plant-a",
        p_target_position_id: "position-b",
        p_moved_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        p_request_id: expect.any(String),
      }),
    );
  });

  it("surfaces canonical failure without projecting a successful move", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Target position not found" } });
    await expect(movePlantRecord("plant-a", "missing", 0)).rejects.toThrow(
      "Target position not found",
    );
  });

  it("closes the canonical cycle with the removal reason instead of deleting its records", async () => {
    rpc.mockResolvedValue({ data: { revision: 4, grow_cycle_id: "cycle-a" }, error: null });
    await closePlantCycleRecord(
      {
        id: "plant-a",
        gardenId: "garden-a",
        name: "Tiny Tim",
        species: "Tomato",
        scientific: "Solanum lycopersicum",
        variety: "Tiny Tim",
        knowledgeId: "tiny-tim",
        plantedDaysAgo: 10,
        status: "steady",
        statusNote: "",
        heroPhotoId: "",
        identityConfirmed: true,
        backendGrowCycleId: "cycle-a",
      },
      0,
      "removal",
      "Removed from active garden",
    );
    expect(rpc).toHaveBeenCalledWith(
      "garden_close_cycle",
      expect.objectContaining({
        p_grow_cycle_id: "cycle-a",
        p_expected_revision: 4,
        p_reason: "removal",
      }),
    );
  });
});
