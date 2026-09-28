import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("./supabase", () => ({ getSupabaseClient: () => ({ auth: { getSession } }) }));

import { photoStorageProvider } from "./photo-storage-provider";

const media = {
  width: 1200,
  height: 800,
  contentType: "image/jpeg" as const,
  master: new Uint8Array([1, 2]),
  renditions: { display: new Uint8Array([3]), preview: new Uint8Array([4]) },
};

describe("Garden R2 photo gateway adapter", () => {
  afterEach(() => {
    getSession.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends all immutable V1 renditions through the authenticated gateway", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    getSession.mockResolvedValue({ data: { session: { access_token: "session-token" } } });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    await photoStorageProvider.uploadPrepared("photo-id", "owner/photo/original.jpg", media, "a".repeat(64));

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://project.supabase.co/functions/v1/garden-media/photos/photo-id");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer session-token");
    expect(new Headers(init?.headers).get("apikey")).toBe("publishable-test-key");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("storage_path")).toBe("owner/photo/original.jpg");
    expect((init?.body as FormData).get("master")).toBeInstanceOf(File);
  });

  it("reads one exact rendition and never asks the browser for an R2 URL", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    getSession.mockResolvedValue({ data: { session: { access_token: "session-token" } } });
    const fetchMock = vi.fn(async () => new Response(new Blob(["display"], { type: "image/jpeg" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await photoStorageProvider.download("photo-id", "display");
    expect(result.error).toBeNull();
    expect(await result.data?.text()).toBe("display");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://project.supabase.co/functions/v1/garden-media/photos/photo-id/display");
  });

  it("requires an authenticated session before any gateway request", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(photoStorageProvider.download("photo-id", "preview")).resolves.toMatchObject({ error: expect.any(Error) });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
