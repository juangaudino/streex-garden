import type { AiCheckProposal } from "./garden-backend";
import type { AnalysisResult, Confidence, Finding } from "./garden-logic";
import { ui, type UiLanguage } from "./ui-copy";

export interface CareActionSection {
  key: "harvest" | "pruning" | "thinning" | "support" | "watch" | "nextCheck";
  label: string;
  detail: string;
}

/** Projects the existing structured AI Check into a concise Care-only view. */
export function projectCareActions(proposal: AiCheckProposal, language: UiLanguage): CareActionSection[] {
  const actions: CareActionSection[] = [];
  const add = (key: CareActionSection["key"], detail?: string) => {
    const text = detail?.trim();
    if (!text) return;
    actions.push({ key, label: ui(language, `care${key[0]!.toUpperCase()}${key.slice(1)}` as Parameters<typeof ui>[1]), detail: text });
  };
  const harvestAction = proposal.suggested_next_actions?.find((item) => item.kind === "evaluate_harvest_readiness");
  if (harvestAction?.rationale) add("harvest", harvestAction.rationale);
  else if (proposal.possible_harvest_readiness === "possible_ready" || proposal.possible_harvest_readiness === "possible_evaluate") add("harvest", ui(language, "careHarvestReview"));
  else if (proposal.possible_harvest_readiness === "possible_not_yet") add("harvest", ui(language, "careHarvestNotYet"));

  for (const item of proposal.development_recommendations) {
    if (item.recommendation === "insufficient_evidence") continue;
    if (item.kind === "pruning" || item.kind === "thinning" || item.kind === "support") {
      add(item.kind, item.rationale);
    }
  }

  if (proposal.overall_visible_state === "watch" || proposal.overall_visible_state === "possible_issue") {
    add("watch", proposal.uncertainty[0] ?? proposal.interpretations[0]);
  }
  const nextCheck = proposal.suggested_next_actions?.find((item) => item.kind === "monitor" || item.kind === "create_follow_up");
  if (nextCheck) add("nextCheck", nextCheck.rationale);
  return actions.slice(0, 6);
}

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
