// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, download } = vi.hoisted(() => ({ getSession: vi.fn(), download: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabaseClient: () => ({ auth: { getSession } }) }));
vi.mock("./photo-storage-provider", () => ({
  photoStorageProvider: { download, uploadPrepared: vi.fn(), remove: vi.fn(), removeGarden: vi.fn() },
}));

import { clearPersistentPhotoCache, photoRenditionCandidates, resolvePhotoUrl } from "./garden-backend";

const photo = { id: "photo-1", src: "", backendStoragePath: "owner/photo-1/original.jpg" };

describe("R2 photo rendition reads", () => {
  beforeEach(() => {
    getSession.mockReset();
    download.mockReset();
    getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:photo"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    clearPersistentPhotoCache();
    vi.unstubAllGlobals();
  });

  it("maps each UI tier to its exact canonical rendition", () => {
    expect(photoRenditionCandidates(photo.backendStoragePath, "preview")).toEqual(["owner/photo-1/preview.jpg"]);
    expect(photoRenditionCandidates(photo.backendStoragePath, "display")).toEqual(["owner/photo-1/display.jpg"]);
    expect(photoRenditionCandidates(photo.backendStoragePath, "master")).toEqual(["owner/photo-1/original.jpg"]);
  });

  it("reads display through the authenticated provider boundary", async () => {
    download.mockResolvedValue({ data: new Blob(["display"], { type: "image/jpeg" }), error: null });
    await expect(resolvePhotoUrl(photo, "display")).resolves.toBe("blob:photo");
    expect(download).toHaveBeenCalledWith("photo-1", "display");
  });

  it("does not fall back from a missing preview to a larger rendition", async () => {
    download.mockResolvedValue({ data: null, error: new Error("missing") });
    await expect(resolvePhotoUrl(photo, "preview")).rejects.toThrow("Photo preview rendition is unavailable.");
    expect(download).toHaveBeenCalledWith("photo-1", "preview");
  });

  it("uses master only when the caller explicitly requests it", async () => {
    download.mockResolvedValue({ data: new Blob(["master"], { type: "image/jpeg" }), error: null });
    await expect(resolvePhotoUrl(photo, "master")).resolves.toBe("blob:photo");
    expect(download).toHaveBeenCalledWith("photo-1", "master");
  });
});
