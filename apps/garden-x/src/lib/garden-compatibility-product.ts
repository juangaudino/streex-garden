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
  sourceTitle?: string;
  sourcePublisher?: string;
  sourceUrl?: string;
};

export type ProductMachineFact = {
  modelName: string;
  modelNumber: string;
  maxGrowHeightCm: number;
  source: { title: string; publisher: string; url: string; note: string };
};

export type EmptyPositionCandidate = {
  /** Product tier is a conservative surface decision, not an engine compatibility state. */
  tier: "recommended" | "check_first" | "insufficient_evidence" | "excluded";
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
  /** Source affordance for documented profile facts, independent of whether they affect this target. */
  supportingEvidence: readonly ProductEvidenceReference[];
  missingInformation: readonly {
    property: "cultivation_suitability" | "specific_system_fit" | "physical_clearance";
    reason: string;
  }[];
  requiresVerificationBeforePlanting: boolean;
};

export type EmptyPositionCandidateSet = {
  /** Engine order is deterministic and already includes its documented tie-breakers. */
  order: "engine_deterministic";
  machineFact: ProductMachineFact | null;
  candidates: readonly EmptyPositionCandidate[];
};

export type EmptyPositionProjectionContext = {
  cultivationMethod: GardenCultivationMethod | null;
  systemName: string | null;
  machineFact?: ProductMachineFact | null;
};

function compareStableText(a: string, b: string) {
  const left = a.normalize("NFKC").toLocaleLowerCase("en-US");
  const right = b.normalize("NFKC").toLocaleLowerCase("en-US");
  return left < right ? -1 : left > right ? 1 : 0;
}

function evidenceForReason(
  entry: GardenLibraryEntry,
  reason: {
    code: string;
    property: string;
    sourceIds: readonly string[];
    taxonomicScopes: readonly string[];
  },
  catalogEntries: readonly GardenLibraryEntry[],
): {
  property: ProductFactProperty;
  evidence: readonly CompatibilityEvidence[];
} {
  const property: ProductFactProperty =
    reason.property === "hydroponic_suitability"
      ? "cultivation_suitability"
      : reason.property === "growth_habit" || reason.code.includes("expansive_habit")
        ? "growth_habit"
        : reason.property === "mature_height"
          ? "mature_height"
          : reason.property === "mature_spread"
            ? "mature_spread"
            : reason.property === "spacing"
              ? "spacing"
              : "growing_light";
  const sourceIds = new Set(reason.sourceIds);
  const scopes = new Set(reason.taxonomicScopes);
  const relevantEntries = reason.code.includes("neighbor") ? catalogEntries : [entry];
  const evidence = relevantEntries.flatMap((candidateEntry) => {
    const profile = candidateEntry.compatibilityProfile;
    if (!profile) return [];
    const values =
      property === "cultivation_suitability"
        ? (profile.hydroponicSuitability.evidence ?? [])
        : property === "growth_habit"
          ? profile.growthHabits.status === "known"
            ? profile.growthHabits.evidence
            : []
          : property === "mature_height"
            ? profile.matureSize.height.status === "known"
              ? profile.matureSize.height.evidence
              : []
            : property === "mature_spread"
              ? profile.matureSize.spread.status === "known"
                ? profile.matureSize.spread.evidence
                : []
              : property === "spacing"
                ? profile.spacing.status === "known"
                  ? profile.spacing.evidence
                  : []
                : profile.light.status === "known"
                  ? profile.light.evidence
                  : [];
    return values.filter(
      (item) =>
        item.sourceIds.some((id) => sourceIds.has(id)) &&
        scopes.has(
          item.taxonomicScope.level === "identity"
            ? "identity"
            : `${item.taxonomicScope.level}: ${item.taxonomicScope.taxon}`,
        ),
    );
  });
  return { property, evidence };
}

function evidenceReferences(
  property: ProductFactProperty,
  evidence: readonly CompatibilityEvidence[],
  catalogEntries: readonly GardenLibraryEntry[],
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
        ...(() => {
          const source = catalogEntries
            .flatMap((entry) => entry.reference.sources)
            .find((candidate) => candidate.id === sourceId);
          return source
            ? {
                sourceTitle: source.title,
                sourcePublisher: source.publisher,
                sourceUrl: source.url,
              }
            : {};
        })(),
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
        "expansive_habit_clearance_unresolved",
        "documented_expansive_neighbor_fit_needs_review",
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
  catalogEntries: readonly GardenLibraryEntry[],
  context: EmptyPositionProjectionContext,
): EmptyPositionCandidate {
  const evidenceFor = (reason: {
    code: string;
    property: string;
    sourceIds: readonly string[];
    taxonomicScopes: readonly string[];
  }) => evidenceForReason(entry, reason, catalogEntries);
  const profile = entry.compatibilityProfile;
  const engineReasons = [...result.exclusions, ...result.reasons]
    .map((reason) => {
      const mapped = evidenceFor(reason);
      const evidence = evidenceReferences(mapped.property, mapped.evidence, catalogEntries);
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
      const evidence = evidenceReferences(
        "cultivation_suitability",
        claim.evidence,
        catalogEntries,
      );
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
  const hasReviewSignal = result.rankingSignals.some((signal) => signal.effect === "needs_review");
  const hasPositiveContextSignal = result.rankingSignals.some(
    (signal) => signal.effect === "supports_context",
  );
  const tier: EmptyPositionCandidate["tier"] =
    result.eligibility === "excluded"
      ? "excluded"
      : result.compatibility === "unknown" || result.compatibility === "incompatible"
        ? "insufficient_evidence"
        : result.compatibility === "conditional" || hasReviewSignal
          ? "check_first"
          : hasPositiveContextSignal
            ? "recommended"
            : "check_first";
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

  const supportingEvidence = profile
    ? [
        ["cultivation_suitability", profile.hydroponicSuitability.evidence ?? []],
        [
          "growth_habit",
          profile.growthHabits.status === "known" ? profile.growthHabits.evidence : [],
        ],
        [
          "mature_height",
          profile.matureSize.height.status === "known" ? profile.matureSize.height.evidence : [],
        ],
        [
          "mature_spread",
          profile.matureSize.spread.status === "known" ? profile.matureSize.spread.evidence : [],
        ],
        ["spacing", profile.spacing.status === "known" ? profile.spacing.evidence : []],
        ["growing_light", profile.light.status === "known" ? profile.light.evidence : []],
      ].flatMap(([property, evidence]) =>
        evidenceReferences(
          property as ProductFactProperty,
          evidence as readonly CompatibilityEvidence[],
          catalogEntries,
        ),
      )
    : [];
  const uniqueSupportingEvidence = new Map<string, ProductEvidenceReference>();
  for (const evidence of supportingEvidence) {
    uniqueSupportingEvidence.set(
      `${evidence.sourceId}:${evidence.property}:${evidence.taxonomicScope.level}:${"taxon" in evidence.taxonomicScope ? evidence.taxonomicScope.taxon : ""}`,
      evidence,
    );
  }

  return {
    tier,
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
    supportingEvidence: [...uniqueSupportingEvidence.values()],
    missingInformation,
    requiresVerificationBeforePlanting:
      result.compatibility !== "compatible" ||
      systemFit !== "documented" ||
      physicalFit !== "supported",
  };
}

/** Projects engine results into product tiers without exposing internal rank/signals/codes. */
export function projectEmptyPositionCandidates(
  results: readonly GardenCompatibilityResult[],
  catalogEntries: readonly GardenLibraryEntry[],
  context: EmptyPositionProjectionContext,
): EmptyPositionCandidateSet {
  const entries = new Map(catalogEntries.map((entry) => [entry.libraryPlantId, entry]));
  const candidates = results
    .map((result) => {
      const entry = entries.get(result.candidate.libraryPlantId);
      return entry ? candidateProjection(result, entry, catalogEntries, context) : null;
    })
    .filter((candidate): candidate is EmptyPositionCandidate => candidate !== null);
  return { order: "engine_deterministic", machineFact: context.machineFact ?? null, candidates };
}
