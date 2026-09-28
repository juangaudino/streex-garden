import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, remove } = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn() }));

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));
vi.mock("./photo-storage-provider", () => ({
  photoStorageProvider: { remove, removeGarden: vi.fn() },
}));

import { deletePhotoRecord, invalidateEventRecord } from "./garden-backend";

describe("backend safe delete boundaries", () => {
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset();
    remove.mockResolvedValue({ error: null });
  });

  it("keeps the row result while reporting a Storage cleanup failure", async () => {
    remove.mockResolvedValue({ error: { message: "Storage unavailable" } });

    await expect(deletePhotoRecord("photo-1")).resolves.toEqual({
      storageCleanupWarning: "Storage unavailable",
    });
    expect(remove).toHaveBeenCalledWith("photo-1");
  });

  it("surfaces a gateway authorization failure without local mutation", async () => {
    remove.mockResolvedValue({ error: { message: "Photo media delete failed (403)." } });
    await expect(deletePhotoRecord("foreign-photo")).resolves.toEqual({
      storageCleanupWarning: "Photo media delete failed (403).",
    });
    expect(remove).toHaveBeenCalledWith("foreign-photo");
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
