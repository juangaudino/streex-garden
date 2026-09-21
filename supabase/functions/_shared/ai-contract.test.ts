import { describe, expect, it } from "vitest";
import { GARDEN_AI_PROPOSAL_SCHEMA_VERSION, validateAiCheckProposal } from "./ai-contract";

const validProposal = (overrides: Record<string, unknown> = {}) => ({
  schema_version: GARDEN_AI_PROPOSAL_SCHEMA_VERSION,
  status: "complete",
  headline: "Elongated growth and drooping leaves",
  summary: "The selected photo shows a visible change that merits a closer look.",
  evidence_used: [{ kind: "photo", id: "photo-1" }],
  overall_visible_state: "watch",
  development_recommendations: [{ kind: "support", recommendation: "monitor", rationale: "Check the current plant before intervening.", confidence: "medium" }],
  possible_harvest_readiness: "possible_evaluate",
  possible_incident: "possible",
  observations: ["Several stems lean outward in the selected photo."],
  interpretations: ["This may indicate crowding, although the historical image cannot confirm the current condition."],
  uncertainty: ["The selected photo is historical."],
  questions: [],
  suggested_next_actions: [{ kind: "monitor", rationale: "Take a current photo before changing care." }],
  confidence: "medium",
  ...overrides,
});

describe("AI Check output contract", () => {
  it("keeps a concise headline while preserving detailed explanation fields", () => {
    const proposal = validateAiCheckProposal(validProposal());
    expect(proposal).not.toBeNull();
    expect(proposal?.headline).toBe("Elongated growth and drooping leaves");
    expect(proposal?.observations).toHaveLength(1);
    expect(proposal?.interpretations).toHaveLength(1);
  });

  it("rejects a paragraph used as a headline", () => {
    const proposal = validateAiCheckProposal(validProposal({ headline: "Garden 1 position 2 Dill Bouquet Anethum graveolens active cycle captured on September 10 shows long stems and yellow leaves" }));
    expect(proposal).toBeNull();
  });

  it("rejects raw internal enum or implementation language in user-facing text", () => {
    expect(validateAiCheckProposal(validProposal({ headline: "Harvest not_yet" }))).toBeNull();
    expect(validateAiCheckProposal(validProposal({ interpretations: ["The grow_cycle_id is not_yet"] }))).toBeNull();
  });

  it("does not discard the rich explanation when the headline is shortened", () => {
    const proposal = validateAiCheckProposal(validProposal({ headline: "Visible stress" }));
    expect(proposal).not.toBeNull();
    expect(proposal?.summary).toContain("selected photo");
    expect(proposal?.interpretations).toEqual(expect.any(Array));
  });
});
