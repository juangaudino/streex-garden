import type { GardenCultivationMethod } from "./garden-data";
import type { CompatibilityEvidence, GardenLibraryEntry } from "./garden-library";
import type { CompatibilityState, GardenCompatibilityResult } from "./garden-compatibility-engine";

export type ProductFactProperty =
  | "cultivation_suitability"
  | "growth_habit"
  | "mature_height"
  | "mature_spread"
  | "spacing"
  | "growing_light";

export type ProductEvidenceReference = {
  sourceId: string;
  property: ProductFactProperty;
  taxonomicScope: CompatibilityEvidence["taxonomicScope"];
  evidenceType: CompatibilityEvidence["evidenceType"];
  confidence: CompatibilityEvidence["confidence"];
};

export type EmptyPositionCandidate = {
  plant: {
    libraryPlantId: string;
    commonName: string;
    scientificName: string | null;
    cultivar: string | null;
  };
  cultivationCompatibility: {
    method: GardenCultivationMethod | null;
    state: CompatibilityState;
  };
  /** Exact-system evidence is separate from cultivation-method suitability. */
  systemFit: {
    systemName: string | null;
    state: "documented" | "conditional" | "unknown";
  };
  /** `supported` requires comparable recorded dimensions/spacing; habit alone is not a fit. */
  physicalFit: {
    state: "supported" | "needs_review" | "unknown";
  };
  factualReasons: readonly {
    property: ProductFactProperty;
    statement: string;
    evidence: readonly ProductEvidenceReference[];
  }[];
  missingInformation: readonly {
    property: "cultivation_suitability" | "specific_system_fit" | "physical_clearance";
    reason: string;
  }[];
  requiresVerificationBeforePlanting: boolean;
};

export type EmptyPositionCandidateSet = {
  /** Alphabetical display order only; array position is not a recommendation rank. */
  order: "common_name_alphabetical";
  candidates: readonly EmptyPositionCandidate[];
};

export type EmptyPositionProjectionContext = {
  cultivationMethod: GardenCultivationMethod | null;
  systemName: string | null;
};

function compareStableText(a: string, b: string) {
  const left = a.normalize("NFKC").toLocaleLowerCase("en-US");
  const right = b.normalize("NFKC").toLocaleLowerCase("en-US");
  return left < right ? -1 : left > right ? 1 : 0;
}

function evidenceForReason(
  entry: GardenLibraryEntry,
  result: GardenCompatibilityResult,
): (reason: { code: string; property: string; sourceIds: readonly string[] }) => {
  property: ProductFactProperty;
  evidence: readonly CompatibilityEvidence[];
} {
  const profile = entry.compatibilityProfile;
  return (reason) => {
    if (!profile) return { property: "cultivation_suitability", evidence: [] };

    let property: ProductFactProperty;
    let evidence: readonly CompatibilityEvidence[];
    if (reason.property === "hydroponic_suitability") {
      property = "cultivation_suitability";
      evidence = profile.hydroponicSuitability.evidence ?? [];
    } else if (reason.property === "growth_habit" || reason.code.includes("expansive_habit")) {
      property = "growth_habit";
      evidence = profile.growthHabits.status === "known" ? profile.growthHabits.evidence : [];
    } else if (reason.property === "mature_height") {
      property = "mature_height";
      evidence =
        profile.matureSize.height.status === "known" ? profile.matureSize.height.evidence : [];
    } else if (reason.property === "mature_spread") {
      property = "mature_spread";
      evidence =
        profile.matureSize.spread.status === "known" ? profile.matureSize.spread.evidence : [];
    } else if (reason.property === "spacing") {
      property = "spacing";
      evidence = profile.spacing.status === "known" ? profile.spacing.evidence : [];
    } else {
      property = "growing_light";
      evidence = profile.light.status === "known" ? profile.light.evidence : [];
    }

    const sourceIds = new Set(reason.sourceIds);
    return {
      property,
      evidence: evidence.filter((item) => item.sourceIds.some((id) => sourceIds.has(id))),
    };
  };
}

function evidenceReferences(
  property: ProductFactProperty,
  evidence: readonly CompatibilityEvidence[],
): ProductEvidenceReference[] {
  const unique = new Map<string, ProductEvidenceReference>();
  for (const item of evidence) {
    for (const sourceId of item.sourceIds) {
      const reference = {
        sourceId,
        property,
        taxonomicScope: item.taxonomicScope,
        evidenceType: item.evidenceType,
        confidence: item.confidence,
      } satisfies ProductEvidenceReference;
      unique.set(
        `${sourceId}:${property}:${item.taxonomicScope.level}:${"taxon" in item.taxonomicScope ? item.taxonomicScope.taxon : ""}`,
        reference,
      );
    }
  }
  return [...unique.values()].sort((a, b) => compareStableText(a.sourceId, b.sourceId));
}

function physicalFitState(
  result: GardenCompatibilityResult,
): EmptyPositionCandidate["physicalFit"]["state"] {
  if (
    result.rankingSignals.some((signal) =>
      ["known_height_fits", "known_spread_fits", "known_position_spacing_fits"].includes(
        signal.code,
      ),
    )
  ) {
    return "supported";
  }
  if (
    result.rankingSignals.some((signal) =>
      [
        "known_height_needs_review",
        "known_spread_needs_review",
        "known_position_spacing_needs_review",
      ].includes(signal.code),
    )
  ) {
    return "needs_review";
  }
  return "unknown";
}

function reasonPriority(code: string) {
  if (code === "explicit_hydroponic_incompatibility") return 0;
  if (code === "documented_hydroponic_compatibility" || code === "documented_system_condition_met")
    return 1;
  if (code.includes("within_clearance") || code === "documented_position_spacing_available")
    return 2;
  if (code === "documented_growth_habit") return 3;
  return 4;
}

function candidateProjection(
  result: GardenCompatibilityResult,
  entry: GardenLibraryEntry,
  context: EmptyPositionProjectionContext,
): EmptyPositionCandidate {
  const evidenceFor = evidenceForReason(entry, result);
  const engineReasons = [...result.exclusions, ...result.reasons]
    .map((reason) => {
      const mapped = evidenceFor(reason);
      const evidence = evidenceReferences(mapped.property, mapped.evidence);
      return evidence.length
        ? {
            property: mapped.property,
            statement: reason.statement,
            evidence,
            priority: reasonPriority(reason.code),
          }
        : null;
    })
    .filter((reason): reason is NonNullable<typeof reason> => reason !== null)
    .sort((a, b) => a.priority - b.priority || compareStableText(a.property, b.property));

  if (
    result.compatibility === "conditional" &&
    entry.compatibilityProfile?.hydroponicSuitability.status === "conditional"
  ) {
    const claim = entry.compatibilityProfile.hydroponicSuitability;
    const condition = claim.conditions[0];
    if (condition) {
      const evidence = evidenceReferences("cultivation_suitability", claim.evidence);
      if (evidence.length) {
        engineReasons.unshift({
          property: "cultivation_suitability",
          statement: condition.description,
          evidence,
          priority: 0,
        });
      }
    }
  }

  const physicalFit = physicalFitState(result);
  const systemFit: EmptyPositionCandidate["systemFit"]["state"] =
    result.systemFit === "documented_condition_met"
      ? "documented"
      : result.compatibility === "conditional"
        ? "conditional"
        : "unknown";

  const missingInformation: EmptyPositionCandidate["missingInformation"][number][] = [];
  if (result.compatibility === "unknown" || result.compatibility === "conditional") {
    const unknown = result.unknowns.find((item) =>
      ["hydroponic_suitability", "cultivation_suitability"].includes(item.property),
    );
    missingInformation.push({
      property: "cultivation_suitability",
      reason:
        unknown?.reason ?? "Cultivation suitability is not established by the available profile.",
    });
  }
  if (systemFit === "unknown" && result.compatibility === "compatible") {
    missingInformation.push({
      property: "specific_system_fit",
      reason: `No documented fit for the specific ${context.systemName ? `“${context.systemName}” ` : "Garden system "}is available.`,
    });
  }
  if (physicalFit !== "supported") {
    const unknown = result.unknowns.find((item) =>
      [
        "mature_height_fit",
        "mature_spread_fit",
        "applicable_spacing",
        "physical_clearance",
      ].includes(item.property),
    );
    missingInformation.push({
      property: "physical_clearance",
      reason:
        unknown?.reason ??
        "Comparable measured clearance or position spacing is not available for this position.",
    });
  }

  return {
    plant: result.candidate,
    cultivationCompatibility: {
      method: context.cultivationMethod,
      state: result.compatibility,
    },
    systemFit: { systemName: context.systemName, state: systemFit },
    physicalFit: { state: physicalFit },
    factualReasons: engineReasons.slice(0, 2).map(({ property, statement, evidence }) => ({
      property,
      statement,
      evidence,
    })),
    missingInformation,
    requiresVerificationBeforePlanting:
      result.compatibility !== "compatible" ||
      systemFit !== "documented" ||
      physicalFit !== "supported",
  };
}

/**
 * Projects deterministic engine results into a small product contract. The engine's internal
 * rank/signals/codes are not exposed; display order is alphabetical and never means "best".
 */
export function projectEmptyPositionCandidates(
  results: readonly GardenCompatibilityResult[],
  catalogEntries: readonly GardenLibraryEntry[],
  context: EmptyPositionProjectionContext,
): EmptyPositionCandidateSet {
  const entries = new Map(catalogEntries.map((entry) => [entry.libraryPlantId, entry]));
  const candidates = results
    .map((result) => {
      const entry = entries.get(result.candidate.libraryPlantId);
      return entry ? candidateProjection(result, entry, context) : null;
    })
    .filter((candidate): candidate is EmptyPositionCandidate => candidate !== null)
    .sort(
      (a, b) =>
        compareStableText(a.plant.commonName, b.plant.commonName) ||
        compareStableText(a.plant.libraryPlantId, b.plant.libraryPlantId),
    );
  return { order: "common_name_alphabetical", candidates };
}
