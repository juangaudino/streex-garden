import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ auth: { getSession } }),
}));

import { runAiCheck } from "./garden-backend";

describe("AI Check request isolation", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getSession.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    getSession.mockResolvedValue({ data: { session: { access_token: "test-session" } } });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ proposal: { summary: "independent result" }, request_id: "request-1" }),
    });
  });

  it("constructs each request from its own cycle and selected photo", async () => {
    await runAiCheck("cycle-a", "photo-a");
    await runAiCheck("cycle-b", "photo-b");

    const first = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    const second = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string);

    expect(first).toMatchObject({
      operation: "ai_check",
      grow_cycle_id: "cycle-a",
      photo_id: "photo-a",
    });
    expect(second).toMatchObject({
      operation: "ai_check",
      grow_cycle_id: "cycle-b",
      photo_id: "photo-b",
    });
    expect(first.request_key).not.toBe(second.request_key);
  });

  it("surfaces a failed model request instead of returning a diagnosis", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "provider unavailable" }),
    });

    await expect(runAiCheck("cycle-a", "photo-a")).rejects.toThrow("provider unavailable");
  });
});
