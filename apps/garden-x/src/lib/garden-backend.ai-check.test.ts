import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({ auth: { getSession } }),
}));

import { askGardenAi, runAiCheck, runAiCheckDraft } from "./garden-backend";

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

  it("sends the active language without changing request isolation", async () => {
    await runAiCheck("cycle-a", "photo-a", undefined, "en");
    const request = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);

    expect(request.language).toBe("en");
  });

  it("supports a new photo draft scoped to the selected grow cycle", async () => {
    await runAiCheckDraft("cycle-new", "data:image/jpeg;base64,ZmFrZQ==", "en");
    const request = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(request).toMatchObject({
      operation: "ai_check_draft",
      grow_cycle_id: "cycle-new",
      draft_image_data_url: "data:image/jpeg;base64,ZmFrZQ==",
      language: "en",
    });
  });

  it("requests a photo-only AI Check without fabricating plant or cycle context", async () => {
    await runAiCheckDraft(null, "data:image/jpeg;base64,ZmFrZQ==", "es");
    const request = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(request).toMatchObject({
      operation: "ai_check_draft",
      context_mode: "photo_only",
      draft_image_data_url: "data:image/jpeg;base64,ZmFrZQ==",
      language: "es",
    });
    expect(request).not.toHaveProperty("grow_cycle_id");
  });

  it("sends the temporary Care photo and check context through the existing Ask Garden operation", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ answer: { answer_type: "answer", answer: "Review outer leaves.", confirmed_facts: [], suggested_next_actions: [] } }),
    });
    await askGardenAi("Can I harvest?", [{ question: "What does the check say?", answer: "Outer leaves are visible." }], {
      photoDataUrl: "data:image/jpeg;base64,ZmFrZQ==",
      context: "Current care photo is attached; AI Check result is unconfirmed.",
    });
    const request = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(request).toMatchObject({
      operation: "ask_garden",
      question: "Can I harvest?",
      care_review_photo_data_url: "data:image/jpeg;base64,ZmFrZQ==",
      care_review_context: "Current care photo is attached; AI Check result is unconfirmed.",
    });
    expect(request.conversation).toHaveLength(1);
  });

  it("sends both the Care review photo and the new current-turn image without changing conversation scope", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ answer: { answer_type: "answer", answer: "The wider view shows the reservoir.", confirmed_facts: [], suggested_next_actions: [] } }),
    });
    const previous = [{ question: "Can I relocate it?", answer: "A wider view would help." }];
    await askGardenAi("Can you decide from this?", previous, {
      photoDataUrl: "data:image/jpeg;base64,cmV2aWV3",
      context: "Plant plant-1, cycle cycle-1; prior AI Check remains unconfirmed.",
      messageImageDataUrl: "data:image/png;base64,bmV3",
    });
    const request = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(request).toMatchObject({
      operation: "ask_garden",
      question: "Can you decide from this?",
      care_review_photo_data_url: "data:image/jpeg;base64,cmV2aWV3",
      care_review_context: expect.stringContaining("cycle cycle-1"),
      message_image_data_url: "data:image/png;base64,bmV3",
      conversation: previous,
    });
  });
});
