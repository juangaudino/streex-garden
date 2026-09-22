import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUrls = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({
    storage: { from: () => ({ createSignedUrls }) },
  }),
}));

import { photoRenditionCandidates, preloadPhotoRendition, resolvePhotoUrl } from "./garden-backend";

const photo = {
  id: "photo-1",
  src: "",
  backendStoragePath: "owner/photo-1/original.jpg",
};

describe("photo renditions", () => {
  beforeEach(() => {
    createSignedUrls.mockReset();
  });

  it("derives the safe fallback order for each rendition", () => {
    expect(photoRenditionCandidates(photo.backendStoragePath, "preview")).toEqual([
      "owner/photo-1/preview.jpg",
      "owner/photo-1/display.jpg",
      "owner/photo-1/original.jpg",
    ]);
    expect(photoRenditionCandidates(photo.backendStoragePath, "display")).toEqual([
      "owner/photo-1/display.jpg",
      "owner/photo-1/original.jpg",
    ]);
    expect(photoRenditionCandidates(photo.backendStoragePath, "original")).toEqual([
      "owner/photo-1/original.jpg",
    ]);
  });

  it("falls back from a missing preview to display", async () => {
    createSignedUrls.mockResolvedValue({
      data: [{ path: "owner/photo-1/display.jpg", signedUrl: "https://signed/display" }],
      error: null,
    });

    await expect(resolvePhotoUrl(photo, "preview")).resolves.toBe("https://signed/display");
    expect(createSignedUrls).toHaveBeenCalledWith(
      [
        "owner/photo-1/preview.jpg",
        "owner/photo-1/display.jpg",
        "owner/photo-1/original.jpg",
      ],
      3600,
    );
  });

  it("falls back from a missing display to the original", async () => {
    const original = { ...photo, id: "photo-display-fallback" };
    createSignedUrls.mockResolvedValue({
      data: [{ path: original.backendStoragePath, signedUrl: "https://signed/original" }],
      error: null,
    });

    await expect(resolvePhotoUrl(original, "display")).resolves.toBe("https://signed/original");
  });

  it("batches same-tick requests and deduplicates candidate paths", async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })),
      error: null,
    }));
    const first = { ...photo, id: "photo-batch-a", backendStoragePath: "owner/shared-batch/original.jpg" };
    const second = { ...photo, id: "photo-batch-b", backendStoragePath: "owner/shared-batch/original.jpg" };

    const firstUrl = resolvePhotoUrl(first, "preview");
    const secondUrl = resolvePhotoUrl(second, "preview");

    await expect(Promise.all([firstUrl, secondUrl])).resolves.toEqual([
      "https://signed/owner/shared-batch/preview.jpg",
      "https://signed/owner/shared-batch/preview.jpg",
    ]);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith([
      "owner/shared-batch/preview.jpg",
      "owner/shared-batch/display.jpg",
      "owner/shared-batch/original.jpg",
    ], 3600);
  });

  it("resolves preview and display to their requested stored renditions in one batch", async () => {
    createSignedUrls.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })),
      error: null,
    }));
    const samePhoto = { ...photo, id: "photo-two-renditions", backendStoragePath: "owner/two-renditions/original.jpg" };

    const preview = resolvePhotoUrl(samePhoto, "preview");
    const display = resolvePhotoUrl(samePhoto, "display");

    await expect(Promise.all([preview, display])).resolves.toEqual([
      "https://signed/owner/two-renditions/preview.jpg",
      "https://signed/owner/two-renditions/display.jpg",
    ]);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls).toHaveBeenCalledWith([
      "owner/two-renditions/preview.jpg",
      "owner/two-renditions/display.jpg",
      "owner/two-renditions/original.jpg",
    ], 3600);
  });

  it("reuses a still-valid signed URL cache entry", async () => {
    createSignedUrls.mockResolvedValue({
      data: [{ path: "owner/photo-cache-valid/display.jpg", signedUrl: "https://signed/cache-valid" }],
      error: null,
    });
    const cached = { ...photo, id: "photo-cache-valid", backendStoragePath: "owner/photo-cache-valid/original.jpg" };

    await expect(resolvePhotoUrl(cached, "display")).resolves.toBe("https://signed/cache-valid");
    await expect(resolvePhotoUrl(cached, "display")).resolves.toBe("https://signed/cache-valid");
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("rejects only the photo whose batch response has no signed path", async () => {
    createSignedUrls.mockResolvedValue({
      data: [{ path: "owner/photo-error-a/display.jpg", signedUrl: "https://signed/error-a" }],
      error: null,
    });
    const available = { ...photo, id: "photo-error-a", backendStoragePath: "owner/photo-error-a/original.jpg" };
    const missing = { ...photo, id: "photo-error-b", backendStoragePath: "owner/photo-error-b/original.jpg" };

    const availableUrl = resolvePhotoUrl(available, "display");
    const missingUrl = resolvePhotoUrl(missing, "display");

    await expect(availableUrl).resolves.toBe("https://signed/error-a");
    await expect(missingUrl).rejects.toThrow("No signed URL returned");
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("keeps signed URL cache entries separate by photo and rendition", async () => {
    const cachedPhoto = { ...photo, id: "photo-cache" };
    createSignedUrls
      .mockResolvedValueOnce({
        data: [{ path: "owner/photo-1/display.jpg", signedUrl: "https://signed/preview-fallback" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ path: "owner/photo-1/original.jpg", signedUrl: "https://signed/original" }],
        error: null,
      });

    await expect(resolvePhotoUrl(cachedPhoto, "preview")).resolves.toBe("https://signed/preview-fallback");
    await expect(resolvePhotoUrl(cachedPhoto, "original")).resolves.toBe("https://signed/original");
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
  });

  it("does not sign public or fixture photos", async () => {
    await expect(resolvePhotoUrl({ id: "public", src: "data:image/gif;base64,fixture" }, "display"))
      .resolves.toBe("data:image/gif;base64,fixture");
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("warms the browser cache for a selected display rendition", async () => {
    const imageSources: string[] = [];
    class FakeImage {
      decoding = "";
      set src(value: string) {
        imageSources.push(value);
      }
    }
    vi.stubGlobal("Image", FakeImage);
    createSignedUrls.mockResolvedValue({
      data: [{ path: "owner/photo-preload/display.jpg", signedUrl: "https://signed/display" }],
      error: null,
    });

    await preloadPhotoRendition({ ...photo, id: "photo-preload", backendStoragePath: "owner/photo-preload/original.jpg" }, "display");

    expect(imageSources).toEqual(["https://signed/display"]);
    vi.unstubAllGlobals();
  });
});
