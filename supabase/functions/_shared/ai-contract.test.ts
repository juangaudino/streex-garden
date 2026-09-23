import { describe, expect, it } from "vitest";
import { GARDEN_AI_PROPOSAL_SCHEMA_VERSION, GARDEN_MEANINGFUL_CHANGE_SCHEMA_VERSION, GARDEN_SHARE_CAPTION_SCHEMA_VERSION, validateAiCheckProposal, validateMeaningfulChangeProposal, validateShareCaptionProposal } from "./ai-contract";

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

describe("Share Story caption contract", () => {
  it("accepts a short optional caption or an explicit empty suggestion", () => {
    expect(validateShareCaptionProposal({ schema_version: GARDEN_SHARE_CAPTION_SCHEMA_VERSION, caption: "Lista para su primera cosecha." })).not.toBeNull();
    expect(validateShareCaptionProposal({ schema_version: GARDEN_SHARE_CAPTION_SCHEMA_VERSION, caption: null })).not.toBeNull();
  });

  it("rejects internal language and overlong captions", () => {
    expect(validateShareCaptionProposal({ schema_version: GARDEN_SHARE_CAPTION_SCHEMA_VERSION, caption: "grow_cycle_id not_yet" })).toBeNull();
    expect(validateShareCaptionProposal({ schema_version: GARDEN_SHARE_CAPTION_SCHEMA_VERSION, caption: "x".repeat(241) })).toBeNull();
  });
});

describe("Garden Summary runtime contract", () => {
  const summary = {
    schema_version: "garden_summary_v1",
    summary_text: "Most plants are steady, with one open item to review.",
    scope_type: "global",
    scope_id: null,
    material_fingerprint: "a".repeat(32),
    evidence_coverage: { plant_count: 1, garden_count: 1, open_attention_count: 1, recent_event_count: 0, meaningful_change_count: 0, ai_check_count: 0 },
    referenced_plant_instance_ids: ["plant-1"],
    referenced_meaningful_change_ids: [],
    referenced_ai_check_ids: [],
    epistemic_notes: ["Derived results remain inferred evidence."],
  };

  it("accepts the bounded structured summary shape", async () => {
    const { validateGardenSummaryProposal } = await import("./ai-contract");
    expect(validateGardenSummaryProposal(summary)).toEqual(summary);
  });

  it("rejects internal language and invalid scope identity", async () => {
    const { validateGardenSummaryProposal } = await import("./ai-contract");
    expect(validateGardenSummaryProposal({ ...summary, summary_text: "plant_instance_id not_yet" })).toBeNull();
    expect(validateGardenSummaryProposal({ ...summary, scope_type: "garden", scope_id: null })).toBeNull();
  });
});
