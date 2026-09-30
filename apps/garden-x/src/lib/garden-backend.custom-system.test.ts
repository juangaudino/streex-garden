import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

import { createCustomSystemRecord, updateCustomSystemLayoutRecord } from "./garden-backend";

describe("custom system backend boundary", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("creates the definition, instance and geometry through the owner-scoped RPC", async () => {
    rpc.mockResolvedValue({ data: { garden_id: "garden-1" }, error: null });

    await expect(createCustomSystemRecord({
      name: "Kitchen shelf",
      levels: [{ rows: 3, columns: 4 }, { rows: 2, columns: 3 }],
    })).resolves.toEqual({ gardenId: "garden-1" });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("garden_x_create_custom_system", expect.objectContaining({
      p_name: "Kitchen shelf",
      p_levels: [
        { rows: 3, columns: 4, active_cells: Array.from({ length: 12 }, (_, index) => ({ row: Math.floor(index / 4) + 1, column: (index % 4) + 1 })) },
        { rows: 2, columns: 3, active_cells: Array.from({ length: 6 }, (_, index) => ({ row: Math.floor(index / 3) + 1, column: (index % 3) + 1 })) },
      ],
      p_garden_id: expect.any(String),
      p_system_instance_id: expect.any(String),
      p_definition_id: expect.any(String),
      p_request_id: expect.any(String),
    }));
  });

  it("does not try to upload a photo when none was selected", async () => {
    rpc.mockResolvedValue({ data: { garden_id: "garden-1" }, error: null });
    await createCustomSystemRecord({ name: "No photo", levels: [{ rows: 1, columns: 1 }] });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["garden_x_create_custom_system"]);
  });

  it("keeps the created system when its optional photo cannot be attached", async () => {
    rpc.mockResolvedValueOnce({ data: { garden_id: "garden-1" }, error: null });
    await expect(createCustomSystemRecord({
      name: "Photo warning",
      levels: [{ rows: 1, columns: 1 }],
      photoDataUrl: "not-a-data-url",
    })).resolves.toEqual({ gardenId: "garden-1", photoWarning: "System photo could not be read." });
  });

  it("surfaces a rejected creation without local writes", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "System name is required" } });
    await expect(createCustomSystemRecord({ name: "", levels: [{ rows: 1, columns: 1 }] })).rejects.toThrow("System name is required");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("sends an explicit new capacity with a custom layout update", async () => {
    rpc.mockResolvedValue({ data: { updated: true, position_count: 16 }, error: null });

    await expect(updateCustomSystemLayoutRecord(
      "kratky-garden",
      [{ rows: 4, columns: 4, activeCells: Array.from({ length: 16 }, (_, index) => ({ row: Math.floor(index / 4) + 1, column: (index % 4) + 1 })) }],
      16,
    )).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith("garden_x_update_custom_system_layout_v2", expect.objectContaining({
      p_garden_id: "kratky-garden",
      p_position_capacity: 16,
      p_levels: [{
        rows: 4,
        columns: 4,
        active_cells: Array.from({ length: 16 }, (_, index) => ({ row: Math.floor(index / 4) + 1, column: (index % 4) + 1 })),
      }],
    }));
  });
});
