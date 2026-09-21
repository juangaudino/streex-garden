import { describe, expect, it } from "vitest";
import { buildAiCheckPresentation, shouldShowFindingConfidence } from "./ai-check-presentation";

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
