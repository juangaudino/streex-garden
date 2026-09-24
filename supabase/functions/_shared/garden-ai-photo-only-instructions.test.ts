import { describe, expect, it } from "vitest";
import { gardenAiPhotoOnlyCheckInstructionsFor, GARDEN_AI_PHOTO_ONLY_CHECK_PROMPT_VERSION } from "./garden-ai-instructions";

describe("photo-only AI Check instructions", () => {
  it("uses a distinct version and explicitly prevents unselected identity claims", () => {
    expect(GARDEN_AI_PHOTO_ONLY_CHECK_PROMPT_VERSION).toBe("garden_ai_photo_only_check_v1");
    expect(gardenAiPhotoOnlyCheckInstructionsFor("en")).toMatch(/without a selected plant/i);
    expect(gardenAiPhotoOnlyCheckInstructionsFor("en")).toMatch(/Do not identify or name a species/i);
    expect(gardenAiPhotoOnlyCheckInstructionsFor("es")).toMatch(/sin una planta seleccionada/i);
    expect(gardenAiPhotoOnlyCheckInstructionsFor("es")).toMatch(/No identifiques ni nombres una especie/i);
  });
});
