import { describe, expect, it } from "vitest";
import { GARDEN_AI_PROPOSAL_SCHEMA_VERSION, GARDEN_MEANINGFUL_CHANGE_SCHEMA_VERSION, validateAiCheckProposal, validateMeaningfulChangeProposal } from "./ai-contract";

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

describe("Meaningful Changes output contract", () => {
  const validComparison = (overrides: Record<string, unknown> = {}) => ({
    schema_version: GARDEN_MEANINGFUL_CHANGE_SCHEMA_VERSION,
    comparison_status: "meaningful_change",
    primary_visual_observation: "Foliage appears denser",
    supporting_visual_observations: ["Several leaves appear larger"],
    comparability_notes: [],
    interpretation: "The change is consistent with continued growth.",
    interpretation_confidence: "medium",
    relevant_context_facts: ["Pruning was recorded between these photos."],
    before_photo_id: "photo-before",
    after_photo_id: "photo-after",
    grow_cycle_id: "cycle-1",
    plant_instance_id: "plant-1",
    ...overrides,
  });

  it("keeps visual observation, interpretation and context separate", () => {
    const proposal = validateMeaningfulChangeProposal(validComparison());
    expect(proposal?.primary_visual_observation).toContain("denser");
    expect(proposal?.interpretation).toContain("consistent");
    expect(proposal?.relevant_context_facts).toHaveLength(1);
  });

  it("supports honest no-change and limited-comparability outcomes", () => {
    expect(validateMeaningfulChangeProposal(validComparison({ comparison_status: "no_meaningful_change" }))).not.toBeNull();
    expect(validateMeaningfulChangeProposal(validComparison({ comparison_status: "limited_comparability", comparability_notes: ["The lighting differs between photos."] }))).not.toBeNull();
  });

  it("rejects duplicate evidence and invented physical measurements", () => {
    expect(validateMeaningfulChangeProposal(validComparison({ before_photo_id: "photo-after" }))).toBeNull();
    expect(validateMeaningfulChangeProposal(validComparison({ primary_visual_observation: "Grew 14 cm" }))).toBeNull();
  });
});
