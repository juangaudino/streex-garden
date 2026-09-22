import { describe, expect, it } from "vitest";
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
    const before = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
    const after = { ...context, comparison_photo: { id: "photo-2", storage_path: "owner-1/cycle-1/photo-2/original.jpg", content_type: "image/jpeg", byte_size: 1 } };
    const seen: string[] = [];
    const result = await runAiCheckRuntime({
      userClient: { rpc: async () => ({ data: after, error: null }) } as never,
      storageClient: { storage: { from: () => ({ download: async (path: string) => { seen.push(path); return { data: before, error: null }; } }) } } as never,
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
    expect(seen).toHaveLength(2);
  });

  it("uses a bounded display rendition even when the original metadata is large", async () => {
    const smallDisplay = new Blob([new Uint8Array(128)], { type: "image/jpeg" });
    const seen: string[] = [];
    const { userClient, storageClient } = clients(async (path) => {
      seen.push(path);
      return path.endsWith("/display.jpg")
        ? { data: smallDisplay, error: null }
        : { data: null, error: new Error("not found") };
    });

    const result = await runAiCheckRuntime({
      userClient: userClient as never,
      storageClient: storageClient as never,
      ownerId: "owner-1",
      growCycleId: "cycle-1",
      photoId: "photo-1",
      provider: { id: "test", analyze: async () => ({ raw: {}, model: "test" }) },
      standardVersion: "standard",
      promptVersion: "prompt",
    });

    expect(seen[0]).toContain("/display.jpg");
    expect(result.providerRequest.imageDataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("rejects an oversized downloaded original when no bounded rendition exists", async () => {
    const oversizedOriginal = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/jpeg" });
    const { userClient, storageClient } = clients(async (path) =>
      path.endsWith("/display.jpg")
        ? { data: null, error: new Error("not found") }
        : { data: oversizedOriginal, error: null },
    );

    await expect(runAiCheckRuntime({
      userClient: userClient as never,
      storageClient: storageClient as never,
      ownerId: "owner-1",
      growCycleId: "cycle-1",
      photoId: "photo-1",
      provider: { id: "test", analyze: async () => ({ raw: {}, model: "test" }) },
      standardVersion: "standard",
      promptVersion: "prompt",
    })).rejects.toThrow("AI image limit");
  });
});
