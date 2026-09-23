import { describe, expect, it } from "vitest";
import { buildAiCheckPresentation, projectCareActions, shouldShowFindingConfidence } from "./ai-check-presentation";

const proposal = {
  headline: "Elongated growth and drooping leaves",
  summary: "The selected photo shows several visible changes that deserve a closer look.",
  confidence: "medium" as const,
  observations: ["The stems look long and thin.", "Lower leaves look pale or dry."],
  interpretations: ["The pattern could relate to competition or support."],
  uncertainty: ["The historical photo cannot confirm the plant's current condition."],
  development_recommendations: [
    {
      kind: "thinning",
      recommendation: "evaluate",
      rationale: "Review density before intervening.",
      confidence: "medium" as const,
    },
    {
      kind: "support",
      recommendation: "monitor",
      rationale: "Check whether the stems need support.",
      confidence: "high" as const,
    },
    {
      kind: "pruning",
      recommendation: "no_action",
      rationale: "No pruning is supported yet.",
      confidence: "medium" as const,
    },
  ],
};

describe("AI Check presentation", () => {
  it("projects action-first Care guidance from the existing structured result", () => {
    const actions = projectCareActions({
      ...proposal,
      possible_harvest_readiness: "possible_evaluate",
      overall_visible_state: "watch",
      suggested_next_actions: [
        { kind: "evaluate_harvest_readiness", rationale: "Outer leaves may be evaluated for selective harvest." },
        { kind: "monitor", rationale: "Recheck leaf color during the next review." },
      ],
      uncertainty: ["The photo does not show the entire plant."],
    }, "en");
    expect(actions.map((item) => item.key)).toEqual(["harvest", "thinning", "support", "pruning", "watch", "nextCheck"]);
    expect(actions[0]?.detail).toContain("Outer leaves");
    expect(actions[4]?.detail).toContain("does not show the entire plant");
    expect(actions.map((item) => item.detail).join(" ")).not.toContain("possible_evaluate");
  });

  it("omits empty action sections and derives cautious harvest guidance only from explicit structured readiness", () => {
    expect(projectCareActions({ ...proposal, possible_harvest_readiness: "insufficient_evidence", overall_visible_state: "insufficient_evidence", development_recommendations: [], suggested_next_actions: [] }, "es")).toEqual([]);
    const notReady = projectCareActions({ ...proposal, possible_harvest_readiness: "possible_not_yet", development_recommendations: [], suggested_next_actions: [] }, "es");
    expect(notReady).toEqual([{ key: "harvest", label: "Cosecha", detail: expect.any(String) }]);
  });

  it("keeps detailed content while removing repeated item labels", () => {
    const result = buildAiCheckPresentation(proposal, "es", [
      "Foto · 9 sep",
      "2 eventos registrados",
    ]);
    const observed = result.findings.filter((finding) => finding.kind === "observed");
    const interpretations = result.findings.filter(
      (finding) => finding.kind === "inference" && !finding.subkind,
    );
    const uncertainty = result.findings.filter((finding) => finding.subkind === "uncertainty");

    expect(result.headline).toBe(proposal.headline);
    expect(result.summary).toBe(proposal.summary);
    expect(observed).toHaveLength(2);
    expect(observed.every((finding) => finding.title === undefined)).toBe(true);
    expect(interpretations).toHaveLength(1);
    expect(interpretations[0]?.title).toBeUndefined();
    expect(uncertainty).toHaveLength(1);
    expect(uncertainty[0]?.title).toBeUndefined();
    expect(result.findings.find((finding) => finding.title === "Raleo")?.body).toBe(
      "Review density before intervening.",
    );
    expect(result.findings.find((finding) => finding.title === "Soporte")?.body).toBe(
      "Check whether the stems need support.",
    );
  });

  it("only shows an item confidence when it differs from the global confidence", () => {
    const result = buildAiCheckPresentation(proposal, "en", []);
    const same = result.findings.find((finding) => finding.title === "Thinning");
    const different = result.findings.find((finding) => finding.title === "Support");

    expect(shouldShowFindingConfidence(same!, result.confidence)).toBe(false);
    expect(shouldShowFindingConfidence(different!, result.confidence)).toBe(true);
  });

  it("localizes recommendation labels without exposing internal enums", () => {
    const result = buildAiCheckPresentation(proposal, "es", []);
    const visibleText = result.findings
      .map((finding) => `${finding.title ?? ""} ${finding.body}`)
      .join(" ");

    expect(visibleText).toContain("Raleo");
    expect(visibleText).toContain("Soporte");
    expect(visibleText).not.toContain("no_action");
    expect(visibleText).not.toContain("possible_");
  });
});
