import { afterEach, describe, expect, it, vi } from "vitest";
import { photoRenditionStoragePaths, preparePhotoRenditions } from "./photo-renditions";

describe("photo rendition preparation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("derives display and preview siblings from the canonical original path", () => {
    expect(photoRenditionStoragePaths("user/photo/original.jpg")).toEqual({
      preview: "user/photo/preview.jpg",
      display: "user/photo/display.jpg",
    });
    expect(photoRenditionStoragePaths("original.jpg")).toBeNull();
  });

  it("encodes bounded preview/display files while preserving original dimensions", async () => {
    const drawImage = vi.fn();
    const close = vi.fn();
    const encoded: Array<{ width: number; height: number; quality: number }> = [];
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 3000, height: 2000, close })),
    );
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toBlob: (callback: (blob: Blob) => void, _type: string, quality: number) => {
          const target = drawImage.mock.calls.at(-1)?.slice(-2) as [number, number];
          encoded.push({ width: target[0], height: target[1], quality });
          callback(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }));
        },
      }),
    });

    const result = await preparePhotoRenditions(new Uint8Array(100_000), "image/heic");

    expect(result?.width).toBe(3000);
    expect(result?.height).toBe(2000);
    expect(encoded).toEqual([
      { width: 640, height: 427, quality: 0.68 },
      { width: 1600, height: 1067, quality: 0.78 },
    ]);
    expect(result?.renditions.preview?.byteLength).toBe(3);
    expect(result?.renditions.display?.byteLength).toBe(3);
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not upscale small images and degrades to original-only when browser decoding is unavailable", async () => {
    const drawImage = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 240, height: 120, close: vi.fn() })),
    );
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toBlob: (callback: (blob: Blob) => void) =>
          callback(new Blob([new Uint8Array([1])], { type: "image/jpeg" })),
      }),
    });
    await preparePhotoRenditions(new Uint8Array(100), "image/jpeg");
    expect(drawImage.mock.calls.map((call) => call.slice(-2))).toEqual([
      [240, 120],
      [240, 120],
    ]);

    vi.stubGlobal("createImageBitmap", undefined);
    await expect(preparePhotoRenditions(new Uint8Array(100), "image/jpeg")).resolves.toBeNull();
  });
});
