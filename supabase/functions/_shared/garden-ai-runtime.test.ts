import { describe, expect, it, vi } from "vitest";
const { getR2PhotoObject } = vi.hoisted(() => ({ getR2PhotoObject: vi.fn() }));
vi.mock("./r2-photo-storage", () => ({ getR2PhotoObject }));
import { runAiCheckRuntime } from "./garden-ai-runtime";

const context = {
  cycle: { id: "cycle-1" },
  selected_photo: {
    id: "photo-1",
    storage_path: "owner-1/cycle-1/photo-1/original.jpg",
    content_type: "image/jpeg",
    byte_size: 9 * 1024 * 1024,
  },
  comparison_photo: null,
};

function clients(download: (path: string) => Promise<{ data: Blob | null; error: Error | null }>) {
  return {
    userClient: {
      rpc: async () => ({ data: context, error: null }),
    },
    storageClient: {
      storage: { from: () => ({ download }) },
    },
  };
}

describe("AI image input integrity", () => {
  it("keeps before/after photo ordering for Meaningful Changes", async () => {
    getR2PhotoObject.mockReset();
    getR2PhotoObject.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "image/jpeg" });
    const after = { ...context, comparison_photo: { id: "photo-2", storage_path: "owner-1/cycle-1/photo-2/original.jpg", content_type: "image/jpeg", byte_size: 1 } };
    const result = await runAiCheckRuntime({
      userClient: { rpc: async () => ({ data: after, error: null }) } as never,
      storageClient: {} as never,
      ownerId: "owner-1",
      growCycleId: "cycle-1",
      photoId: "photo-1",
      comparePhotoId: "photo-2",
      operation: "meaningful_change",
      provider: { id: "test", analyze: async () => ({ raw: {}, model: "test" }) },
      standardVersion: "standard",
      promptVersion: "prompt",
    });
    expect(result.providerRequest.operation).toBe("meaningful_change");
    expect(result.providerRequest.imageDataUrls).toHaveLength(2);
    expect(getR2PhotoObject).toHaveBeenCalledTimes(2);
  });

  it("uses a bounded display rendition even when the original metadata is large", async () => {
    getR2PhotoObject.mockReset();
    getR2PhotoObject.mockResolvedValue({ bytes: new Uint8Array(128), contentType: "image/jpeg" });
    const { userClient } = clients(async () => ({ data: null, error: new Error("unused") }));

    const result = await runAiCheckRuntime({
      userClient: userClient as never,
      storageClient: {} as never,
      ownerId: "owner-1",
      growCycleId: "cycle-1",
      photoId: "photo-1",
      provider: { id: "test", analyze: async () => ({ raw: {}, model: "test" }) },
      standardVersion: "standard",
      promptVersion: "prompt",
    });

    expect(getR2PhotoObject).toHaveBeenCalledWith(context.selected_photo.storage_path, "display");
    expect(result.providerRequest.imageDataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("rejects an oversized downloaded original when no bounded rendition exists", async () => {
    getR2PhotoObject.mockReset();
    getR2PhotoObject.mockRejectedValue(new Error("not found"));
    const { userClient } = clients(async () => ({ data: null, error: new Error("unused") }));

    await expect(runAiCheckRuntime({
      userClient: userClient as never,
      storageClient: {} as never,
      ownerId: "owner-1",
      growCycleId: "cycle-1",
      photoId: "photo-1",
      provider: { id: "test", analyze: async () => ({ raw: {}, model: "test" }) },
      standardVersion: "standard",
      promptVersion: "prompt",
    })).rejects.toThrow("not found");
  });
});
