import type { AiCheckProposal } from "./garden-backend";
import type { AnalysisResult, Confidence, Finding } from "./garden-logic";
import { ui, type UiLanguage } from "./ui-copy";

function normalizeConfidence(value: string): Confidence {
  return value === "high" ? "high" : value === "medium" ? "moderate" : "low";
}

function recommendationLabel(language: UiLanguage, kind: string) {
  if (kind === "thinning") return ui(language, "aiThinning");
  if (kind === "pruning") return ui(language, "aiPruning");
  if (kind === "support") return ui(language, "aiSupport");
  return ui(language, "aiNextStep");
}

/** Adapts the rich V2 proposal to the compact Garden-native presentation. */
export function buildAiCheckPresentation(
  proposal: AiCheckProposal,
  language: UiLanguage,
  grounding: string[],
): AnalysisResult {
  const confidence = normalizeConfidence(proposal.confidence);
  const findings: Finding[] = [
    ...proposal.observations.map((body) => ({ kind: "observed" as const, body })),
    ...proposal.interpretations.map((body) => ({ kind: "inference" as const, body })),
    ...proposal.uncertainty.map((body) => ({
      kind: "inference" as const,
      subkind: "uncertainty" as const,
      body,
    })),
    ...proposal.development_recommendations
      .filter((item) => item.recommendation !== "no_action")
      .map((item) => ({
        kind: "recommendation" as const,
        title: recommendationLabel(language, item.kind),
        body: item.rationale,
        confidence: normalizeConfidence(item.confidence),
      })),
  ];

  return {
    headline: proposal.headline,
    summary: proposal.summary,
    confidence,
    findings,
    grounding,
  };
}

export function shouldShowFindingConfidence(finding: Finding, global: Confidence) {
  return Boolean(finding.confidence && finding.confidence !== global);
}
