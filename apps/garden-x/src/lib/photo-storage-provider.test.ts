import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ auth: { getSession } }),
}));

import { photoStorageProvider } from "./photo-storage-provider";

describe("Supabase photo storage adapter", () => {
  afterEach(() => {
    getSession.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the authenticated owner session and create-only writes", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    getSession.mockResolvedValue({ data: { session: { access_token: "session-token" } } });
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: true, status: 201 }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      photoStorageProvider.upload(
        "owner/photo/master/original.jpg",
        new Uint8Array([1, 2]),
        "image/jpeg",
        "immutable",
      ),
    ).resolves.toBe("created");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "https://project.supabase.co/storage/v1/object/garden-originals/owner/photo/master/original.jpg",
    );
    expect(new Headers(init?.headers).get("x-upsert")).toBe("false");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer session-token");
    expect(new Headers(init?.headers).get("apikey")).toBe("publishable-test-key");
  });

  it("treats a create-only collision as a verification case and never replaces it", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    getSession.mockResolvedValue({ data: { session: { access_token: "session-token" } } });
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: false, status: 409 }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      photoStorageProvider.upload(
        "owner/photo/display.jpg",
        new Uint8Array([1]),
        "image/jpeg",
        "immutable",
      ),
    ).resolves.toBe("already_exists");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("x-upsert")).toBe("false");
  });

  it("does not attempt a write without an authenticated session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      photoStorageProvider.upload(
        "owner/photo/display.jpg",
        new Uint8Array([1]),
        "image/jpeg",
        "immutable",
      ),
    ).rejects.toThrow("Authentication required");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
