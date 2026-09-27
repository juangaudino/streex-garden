import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Plant } from "./garden-data";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabaseClient: () => ({ rpc }) }));

import { correctPlantOriginRecord } from "./garden-backend";

const plant: Plant = {
  id: "plant-1",
  gardenId: "garden-1",
  name: "Romaine",
  species: "Lettuce",
  scientific: "Lactuca sativa",
  variety: "",
  knowledgeId: "",
  plantedDaysAgo: 42,
  originType: "unknown",
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
  backendGrowCycleId: "cycle-1",
};

describe("canonical plant Origin correction", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation(async (name: string) => {
      if (name === "garden_get_cycle") return { data: { revision: 8 }, error: null };
      if (name === "garden_correct_cycle_origin") return { data: { grow_cycle_id: "cycle-1", revision: 9 }, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });
  });

  it("uses the owner-scoped, revision-checked Origin correction RPC", async () => {
    await expect(correctPlantOriginRecord(plant, "seed")).resolves.toBe(9);
    expect(rpc).toHaveBeenNthCalledWith(1, "garden_get_cycle", { p_grow_cycle_id: "cycle-1" });
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "garden_correct_cycle_origin",
      expect.objectContaining({
        p_grow_cycle_id: "cycle-1",
        p_expected_revision: 8,
        p_origin_type: "seed",
        p_reason: "User-confirmed in Plant Journal",
      }),
    );
  });

  it("does not send unsupported unknown values to the correction RPC", async () => {
    await expect(
      correctPlantOriginRecord(plant, "unknown" as Exclude<Plant["originType"], "unknown">),
    ).rejects.toThrow("Invalid plant origin.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not write when the canonical cycle revision cannot be read", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(correctPlantOriginRecord(plant, "cutting")).rejects.toThrow("Cycle revision unavailable.");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
