import { getSupabaseClient } from "./supabase";

const bucket = "garden-originals";

export type PhotoStorageWriteResult = "created" | "already_exists";

/** Supabase adapter for photo media; UI and media policy depend on this boundary. */
export const photoStorageProvider = {
  sign(paths: string[], expiresIn: number) {
    return getSupabaseClient().storage.from(bucket).createSignedUrls(paths, expiresIn);
  },

  async upload(
    path: string,
    bytes: Uint8Array,
    contentType: string,
    cacheControl: string,
  ): Promise<PhotoStorageWriteResult> {
    const client = getSupabaseClient();
    const { data } = await client.auth.getSession();
    const session = data.session;
    if (!session) throw new Error("Authentication required");
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(
      `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/${bucket}/${encodedPath}`,
      {
        method: "POST",
        headers: {
          apikey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string,
          Authorization: `Bearer ${session.access_token}`,
          "content-type": contentType,
          "cache-control": cacheControl,
          "x-upsert": "false",
        },
        body: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      },
    );
    if (response.status === 409) return "already_exists";
    if (response.status === 400) {
      const detail = await response.text().catch(() => "");
      if (/KeyAlreadyExists|Duplicate/i.test(detail)) return "already_exists";
    }
    if (!response.ok) throw new Error(`Photo storage upload failed (${response.status}).`);
    return "created";
  },

  download(path: string) {
    return getSupabaseClient().storage.from(bucket).download(path);
  },

  remove(paths: string[]) {
    return getSupabaseClient().storage.from(bucket).remove(paths);
  },
};
