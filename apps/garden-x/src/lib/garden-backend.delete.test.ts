import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const remove = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({
    rpc,
    storage: { from: () => ({ remove }) },
  }),
}));

import { deletePhotoRecord, invalidateEventRecord } from "./garden-backend";

describe("backend safe delete boundaries", () => {
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset();
    remove.mockResolvedValue({ error: null });
  });

  it("keeps the row result while reporting a Storage cleanup failure", async () => {
    rpc.mockResolvedValue({ data: { storage_path: "owner/photo/original.jpg" }, error: null });
    remove.mockResolvedValue({ error: { message: "Storage unavailable" } });

    await expect(deletePhotoRecord("photo-1")).resolves.toEqual({
      storageCleanupWarning: "Storage unavailable",
    });
    expect(remove).toHaveBeenCalledWith([
      "owner/photo/original.jpg",
      "owner/photo/preview.jpg",
      "owner/photo/display.jpg",
    ]);
  });

  it("surfaces an owner-scoped RPC rejection instead of mutating local state", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Photo not found" } });
    await expect(deletePhotoRecord("foreign-photo")).rejects.toThrow("Photo not found");
    expect(remove).not.toHaveBeenCalled();
  });

  it("passes the event revision guard to the existing invalidation command", async () => {
    rpc.mockResolvedValue({ data: { invalidated: true }, error: null });
    await expect(invalidateEventRecord("event-1", 3)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith(
      "garden_invalidate_event",
      expect.objectContaining({
        p_event_id: "event-1",
        p_expected_revision: 3,
      }),
    );
  });
});
