import { afterEach, describe, expect, it, vi } from "vitest";
import { askGardenpediaQuestion, GardenpediaAskError } from "./plant-advisor.ask";

afterEach(() => vi.unstubAllGlobals());

describe("public Gardenpedia Ask client", () => {
  it("sends only the current question, language, and bounded public conversation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answerType: "answer",
          answer: "The public profile documents this point.",
          citations: [
            { id: "source-1", label: "Extension · Basil", url: "https://example.org/basil" },
          ],
          evidenceSupport: [
            {
              id: "e1",
              plantName: "Basil",
              section: "Care",
              evidenceType: "source_backed",
              confidence: "high",
              sourceIds: ["source-1"],
            },
          ],
          followUpQuestion: null,
          quota: { hour_remaining: 5, day_remaining: 19, site_remaining: 149 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const answer = await askGardenpediaQuestion({
      question: "How should I care for basil?",
      language: "en",
      history: [{ question: "I mean indoors", answer: "Let's check the catalog." }],
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/gardenpedia/ask");
    expect(JSON.parse(init!.body as string)).toEqual({
      question: "How should I care for basil?",
      language: "en",
      history: [{ question: "I mean indoors", answer: "Let's check the catalog." }],
    });
    expect(answer.citations[0]?.id).toBe("source-1");
    expect(answer.quota?.day_remaining).toBe(19);
  });

  it("surfaces the backend's verifiable visitor limit response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "visitor_hourly_limit" }), {
          status: 429,
          headers: { "Retry-After": "1200" },
        }),
      ),
    );

    await expect(
      askGardenpediaQuestion({ question: "Question?", language: "en", history: [] }),
    ).rejects.toMatchObject<Partial<GardenpediaAskError>>({
      code: "visitor_hourly_limit",
      retryAfterSeconds: 1200,
    });
  });
});
