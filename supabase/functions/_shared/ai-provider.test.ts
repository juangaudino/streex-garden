import { describe, expect, it, vi } from "vitest";
import { OpenAiResponsesAdapter } from "./ai-provider";

describe("OpenAI image transport", () => {
  it("sends current review and current-turn photos as separate images in one user request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: JSON.stringify({ answer: "I can see the wider reservoir." }) }), { status: 200 }));
    const provider = new OpenAiResponsesAdapter("test-key", "test-model", fetchMock as typeof fetch);
    await provider.analyze({
      operation: "ask_garden",
      context: { question: "Can you decide from this?", current_turn_photo: { applies_to_current_question: true } },
      imageDataUrls: ["data:image/jpeg;base64,cmV2aWV3", "data:image/png;base64,bmV3"],
      standardVersion: "garden_ai_standard_v1",
      promptVersion: "garden_ai_care_ask_v1",
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    const content = body.input[0].content;
    expect(content.filter((item: { type: string }) => item.type === "input_image")).toEqual([
      { type: "input_image", image_url: "data:image/jpeg;base64,cmV2aWV3", detail: "high" },
      { type: "input_image", image_url: "data:image/png;base64,bmV3", detail: "high" },
    ]);
    expect(JSON.parse(content[0].text).context.current_turn_photo.applies_to_current_question).toBe(true);
  });
});
