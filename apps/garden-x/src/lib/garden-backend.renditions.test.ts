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
