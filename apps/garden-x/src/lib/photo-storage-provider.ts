import type { PreparedGardenPhotoMedia } from "./photo-renditions";
import { getSupabaseClient } from "./supabase";

export type PhotoStorageRendition = "master" | "display" | "preview";
type StorageResponse<T> = { data: T | null; error: Error | null };

function mediaUrl(path: string) {
  return `${String(import.meta.env["VITE_SUPABASE_URL"]).replace(/\/$/, "")}/functions/v1/garden-media${path}`;
}

async function sessionHeaders() {
  const { data } = await getSupabaseClient().auth.getSession();
  const session = data.session;
  if (!session) throw new Error("Authentication required");
  return {
    apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
    Authorization: `Bearer ${session.access_token}`,
  };
}

/** R2 is reached only through the authenticated Garden media Edge gateway. */
export const photoStorageProvider = {
  async uploadPrepared(photoId: string, storagePath: string, media: PreparedGardenPhotoMedia, checksum: string): Promise<void> {
    const form = new FormData();
    form.set("storage_path", storagePath);
    form.set("master_sha256", checksum);
    form.set("width", String(media.width));
    form.set("height", String(media.height));
    form.set("master", new Blob([media.master], { type: "image/jpeg" }), "original.jpg");
    form.set("display", new Blob([media.renditions.display!], { type: "image/jpeg" }), "display.jpg");
    form.set("preview", new Blob([media.renditions.preview!], { type: "image/jpeg" }), "preview.jpg");
    const response = await fetch(mediaUrl(`/photos/${encodeURIComponent(photoId)}`), { method: "POST", headers: await sessionHeaders(), body: form });
    if (!response.ok) throw new Error(`Photo media upload failed (${response.status}).`);
  },

  async download(photoId: string, rendition: PhotoStorageRendition): Promise<StorageResponse<Blob>> {
    try {
      const response = await fetch(mediaUrl(`/photos/${encodeURIComponent(photoId)}/${rendition}`), { headers: await sessionHeaders(), cache: "no-store" });
      if (!response.ok) return { data: null, error: new Error(`Photo media read failed (${response.status}).`) };
      return { data: await response.blob(), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error("Photo media read failed.") };
    }
  },

  async remove(photoId: string): Promise<StorageResponse<unknown>> {
    try {
      const response = await fetch(mediaUrl(`/photos/${encodeURIComponent(photoId)}`), { method: "DELETE", headers: await sessionHeaders() });
      if (!response.ok && response.status !== 202) return { data: null, error: new Error(`Photo media delete failed (${response.status}).`) };
      return { data: await response.json().catch(() => null), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error("Photo media delete failed.") };
    }
  },

  async removeGarden(gardenId: string): Promise<StorageResponse<{ storage_path_count?: number }>> {
    try {
      const response = await fetch(mediaUrl(`/gardens/${encodeURIComponent(gardenId)}`), { method: "DELETE", headers: await sessionHeaders() });
      if (!response.ok && response.status !== 202) return { data: null, error: new Error(`Garden media delete failed (${response.status}).`) };
      return { data: await response.json().catch(() => null), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error("Garden media delete failed.") };
    }
  },
};
