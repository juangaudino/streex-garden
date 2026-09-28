import { afterEach, describe, expect, it, vi } from "vitest";
import { GARDEN_PHOTO_MEDIA_POLICY } from "./photo-media-policy";
import { photoRenditionStoragePaths, prepareGardenPhotoMedia } from "./photo-renditions";

describe("photo rendition preparation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("derives display and preview siblings from the canonical original path", () => {
    expect(photoRenditionStoragePaths("user/photo/original.jpg")).toEqual({
      preview: "user/photo/preview.jpg",
      display: "user/photo/display.jpg",
    });
    expect(photoRenditionStoragePaths("original.jpg")).toBeNull();
  });

  it("uses the approved Garden Media V1 policy and creates master/display/preview JPEGs", async () => {
    const drawImage = vi.fn();
    const close = vi.fn();
    const encoded: Array<{ width: number; height: number; quality: number }> = [];
    const createBitmap = vi.fn(async () => ({ width: 3000, height: 2000, close }));
    vi.stubGlobal("createImageBitmap", createBitmap);
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

    const result = await prepareGardenPhotoMedia(new Uint8Array(100_000), "image/heic");

    expect(GARDEN_PHOTO_MEDIA_POLICY).toMatchObject({
      version: "garden-media-v1",
      orientation: "from-image",
      master: { maxEdge: 2304, quality: 0.86 },
      display: { maxEdge: 1440, quality: 0.8 },
      preview: { maxEdge: 600, quality: 0.68 },
    });
    expect(createBitmap.mock.calls[0]?.[1]).toEqual({ imageOrientation: "from-image" });
    expect(result?.width).toBe(2304);
    expect(result?.height).toBe(1536);
    expect(result?.contentType).toBe("image/jpeg");
    expect(encoded).toEqual([
      { width: 2304, height: 1536, quality: 0.86 },
      { width: 1440, height: 960, quality: 0.8 },
      { width: 600, height: 400, quality: 0.68 },
    ]);
    expect(result?.master.byteLength).toBe(3);
    expect(result?.renditions.preview?.byteLength).toBe(3);
    expect(result?.renditions.display?.byteLength).toBe(3);
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not upscale small images and blocks upload when browser decoding is unavailable", async () => {
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
    const prepared = await prepareGardenPhotoMedia(new Uint8Array(100), "image/jpeg");
    expect(drawImage.mock.calls.map((call) => call.slice(-2))).toEqual([
      [240, 120],
      [240, 120],
      [240, 120],
    ]);
    expect(prepared?.master.byteLength).toBeGreaterThan(0);
    expect(prepared?.renditions.display?.byteLength).toBeGreaterThan(0);
    expect(prepared?.renditions.preview?.byteLength).toBeGreaterThan(0);

    vi.stubGlobal("createImageBitmap", undefined);
    await expect(prepareGardenPhotoMedia(new Uint8Array(100), "image/jpeg")).resolves.toBeNull();
  });
});
