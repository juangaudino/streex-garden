import type { Garden, GardenCultivationMethod, GardenKind, Plant } from "./garden-data";
import type {
  CompatibilityEvidence,
  CompatibilityProfileV1,
  GardenLibraryEntry,
} from "./garden-library";
import { gardenMachineFacts } from "../generated/garden-machine-facts";

export type CompatibilityState = "compatible" | "conditional" | "unknown" | "incompatible";
export type CompatibilityLightKind = "full_sun" | "partial_sun" | "shade";

export type CompatibilityPosition = {
  id: string;
  number: number;
  active: boolean;
  coordinates: { level: number; row: number; column: number } | null;
  /** Every active Plant Instance is retained; shared positions are intentional. */
  occupants: readonly CompatibilityOccupant[];
};

export type SpecificSystemFit = "unknown" | "documented_condition_met";

export type CompatibilityOccupant = {
  plantInstanceId: string;
  libraryPlantId: string | null;
  growCycleId: string | null;
  identity: GardenLibraryEntry | null;
};

export type VerifiedPositionFacts = {
  /** Measured position dimensions or documented dimensions from an exactly matched system model. */
  clearance?: {
    heightCm?: number;
    spreadCm?: number;
    context: "hydroponic" | "container" | "in_ground" | "outdoor_general" | "unspecified";
    kind?: "measured_clearance" | "documented_grow_height_limit";
  };
  /** Measured center-to-center target spacing, distinct from plant spread/clearance. */
  positionSpacing?: {
    distanceCm: number;
    context: "hydroponic" | "container" | "in_ground" | "outdoor_general" | "unspecified";
  };
  /** Garden X does not currently persist this; callers must not infer it from garden kind. */
  light?: CompatibilityLightKind;
  /** True only when physical space beyond a perimeter position is explicitly known to be clear. */
  clearBeyondPerimeter?: boolean;
};

/** Exact, source-backed machine specification, joined only by canonical model key. */
export type VerifiedMachineContext = {
  verifiedFacts: VerifiedPositionFacts;
  machineFact: {
    modelName: string;
    modelNumber: string;
    maxGrowHeightCm: number;
    source: { title: string; publisher: string; url: string; note: string };
  } | null;
};

export function verifiedMachineContextForGarden(
  garden: Pick<Garden, "systemDefinitionKey">,
): VerifiedMachineContext {
  const definitionKey = garden.systemDefinitionKey;
  const machine =
    definitionKey && Object.hasOwn(gardenMachineFacts.systemDefinitions, definitionKey)
      ? gardenMachineFacts.systemDefinitions[
          definitionKey as keyof typeof gardenMachineFacts.systemDefinitions
        ]
      : undefined;
  if (!machine) return { verifiedFacts: {}, machineFact: null };
  const maxGrowHeightCm = machine.maxGrowHeightCm;
  return {
    verifiedFacts: {
      clearance: {
        heightCm: maxGrowHeightCm,
        context: "hydroponic",
        kind: "documented_grow_height_limit",
      },
    },
    machineFact: {
      modelName: machine.modelName,
      modelNumber: machine.modelNumber,
      maxGrowHeightCm,
      source: machine.source,
    },
  };
}

export type EmptyGardenPositionInput = {
  garden: {
    id: string;
    kind: GardenKind;
    systemName: string | null;
    systemInstanceId: string | null;
    systemDefinitionKey: string | null;
    customSystemDefinitionId: string | null;
  };
  target: {
    positionId: string;
    valid: boolean;
    active: boolean;
    coordinates: CompatibilityPosition["coordinates"];
    isPerimeter: boolean | null;
    /** Explicit canonical system cultivation method; null/unknown is not inferred from Garden kind. */
    cultivationContext: GardenCultivationMethod | null;
    verifiedFacts: VerifiedPositionFacts;
  };
  positions: readonly CompatibilityPosition[];
  /** Topological adjacency from explicit coordinates; never represents distance. */
  adjacentPositionIds: readonly string[];
};

export type CompatibilityReason = {
  code: string;
  property: string;
  statement: string;
  sourceIds: readonly string[];
  taxonomicScopes: readonly string[];
};

export type CompatibilityUnknown = {
  property: string;
  reason: string;
};

export type CompatibilityExclusion = {
  code: string;
  property: string;
  statement: string;
  sourceIds: readonly string[];
  taxonomicScopes: readonly string[];
};

export type CompatibilityRankingSignal = {
  code: string;
  effect: "supports_context" | "needs_review" | "context_recorded";
  statement: string;
  sourceIds: readonly string[];
};

/**
 * `compatibility` is evidence about the candidate's explicit cultivation method:
 * compatible = documented support (not confirmed physical fit); conditional =
 * support depends on a condition not yet established; unknown = evidence/context
 * is insufficient; incompatible = explicit evidence conflicts with the method.
 * `systemFit` separately reports a verified named-system condition only. Neither
 * field establishes physical fit without comparable clearance data.
 */
export type GardenCompatibilityResult = {
  candidate: Pick<
    GardenLibraryEntry,
    "libraryPlantId" | "commonName" | "scientificName" | "cultivar"
  >;
  compatibility: CompatibilityState;
  /** Compatibility is cultivation-method suitability, not confirmed physical fit. */
  systemFit: SpecificSystemFit;
  eligibility: "eligible" | "excluded";
  reasons: readonly CompatibilityReason[];
  unknowns: readonly CompatibilityUnknown[];
  exclusions: readonly CompatibilityExclusion[];
  rankingSignals: readonly CompatibilityRankingSignal[];
};

function scopeLabel(evidence: CompatibilityEvidence) {
  return evidence.taxonomicScope.level === "identity"
    ? "identity"
    : `${evidence.taxonomicScope.level}: ${evidence.taxonomicScope.taxon}`;
}

function reasonFromEvidence(
  code: string,
  property: string,
  statement: string,
  evidence: readonly CompatibilityEvidence[],
): CompatibilityReason {
  return {
    code,
    property,
    statement,
    sourceIds: [...new Set(evidence.flatMap((item) => item.sourceIds))].sort(),
    taxonomicScopes: [...new Set(evidence.map(scopeLabel))].sort(),
  };
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function knownAeroGardenCondition(
  profile: CompatibilityProfileV1,
  systemDefinitionKey: string | null,
) {
  const normalizedSystem = normalizeName(systemDefinitionKey);
  if (!normalizedSystem.includes("aerogarden")) return false;
  return (
    profile.hydroponicSuitability.status === "conditional" &&
    profile.hydroponicSuitability.conditions.some(
      (condition) =>
        condition.kind === "system_type" &&
        normalizeName(condition.description).includes("aerogarden"),
    )
  );
}

function currentHydroponicState(
  profile: CompatibilityProfileV1,
  systemDefinitionKey: string | null,
): { state: CompatibilityState; conditionMet: boolean } {
  const suitability = profile.hydroponicSuitability;
  if (suitability.status === "incompatible") return { state: "incompatible", conditionMet: false };
  if (suitability.status === "compatible") return { state: "compatible", conditionMet: false };
  if (suitability.status === "conditional") {
    const conditionMet = knownAeroGardenCondition(profile, systemDefinitionKey);
    return { state: conditionMet ? "compatible" : "conditional", conditionMet };
  }
  return { state: "unknown", conditionMet: false };
}

function resultFor(
  entry: GardenLibraryEntry,
  input: EmptyGardenPositionInput,
): GardenCompatibilityResult {
  const profile = entry.compatibilityProfile!;
  const reasons: CompatibilityReason[] = [];
  const unknowns: CompatibilityUnknown[] = [];
  const exclusions: CompatibilityExclusion[] = [];
  const rankingSignals: CompatibilityRankingSignal[] = [];
  let compatibility: CompatibilityState = "unknown";
  let systemFit: SpecificSystemFit = "unknown";

  if (input.target.cultivationContext === "hydroponic") {
    const { state, conditionMet } = currentHydroponicState(
      profile,
      input.garden.systemDefinitionKey,
    );
    compatibility = state;
    if (conditionMet) systemFit = "documented_condition_met";
    const claim = profile.hydroponicSuitability;
    if (claim.status === "compatible") {
      reasons.push(
        reasonFromEvidence(
          "documented_hydroponic_compatibility",
          "hydroponic_suitability",
          "Gardenpedia documents hydroponic suitability; the evidence scope is preserved below.",
          claim.evidence,
        ),
      );
    } else if (claim.status === "conditional") {
      if (conditionMet) {
        rankingSignals.push({
          code: "documented_system_condition_met",
          effect: "supports_context",
          statement: "The explicitly documented AeroGarden system condition is satisfied.",
          sourceIds: claim.evidence.flatMap((item) => item.sourceIds),
        });
        reasons.push(
          reasonFromEvidence(
            "documented_system_condition_met",
            "hydroponic_suitability",
            "The Garden system matches the explicitly named AeroGarden condition in this evidence.",
            claim.evidence,
          ),
        );
      } else {
        unknowns.push({
          property: "hydroponic_suitability",
          reason: `Suitability is documented only under a condition not established for system “${input.garden.systemName ?? "unknown"}”. This is not evidence of incompatibility.`,
        });
      }
    } else if (claim.status === "incompatible") {
      const exclusion = reasonFromEvidence(
        "explicit_hydroponic_incompatibility",
        "hydroponic_suitability",
        "Gardenpedia explicitly documents incompatibility with hydroponic cultivation.",
        claim.evidence,
      );
      exclusions.push(exclusion);
    } else {
      unknowns.push({
        property: "hydroponic_suitability",
        reason:
          claim.reason ??
          (claim.status === "pending"
            ? "Evidence is pending."
            : "No validated hydroponic suitability evidence."),
      });
    }
  } else {
    unknowns.push({
      property: "cultivation_suitability",
      reason: input.target.cultivationContext
        ? `The profile contains hydroponic suitability evidence, but no ${input.target.cultivationContext}-specific suitability fact is available.`
        : "Garden X has no explicit cultivation method for this Garden, so the profile's hydroponic evidence cannot be applied.",
    });
  }

  const habit = profile.growthHabits;
  if (habit.status === "known") {
    reasons.push(
      reasonFromEvidence(
        "documented_growth_habit",
        "growth_habit",
        `Documented growth habit: ${habit.value.join(", ")}.`,
        habit.evidence,
      ),
    );
  } else {
    unknowns.push({
      property: "growth_habit",
      reason:
        habit.reason ??
        (habit.status === "pending"
          ? "Evidence is pending."
          : "No supported growth habit is recorded."),
    });
  }

  const clearance = input.target.verifiedFacts.clearance;
  const heightLimitLabel =
    clearance?.kind === "documented_grow_height_limit"
      ? "documented system grow-height limit"
      : "explicitly recorded height clearance";
  const relevantSize: Array<["height" | "spread", CompatibilityProfileV1["matureSize"]["height"]]> =
    [
      ["height", profile.matureSize.height],
      ["spread", profile.matureSize.spread],
    ];
  for (const [dimension, knowledge] of relevantSize) {
    const limit = dimension === "height" ? clearance?.heightCm : clearance?.spreadCm;
    if (
      knowledge.status === "known" &&
      clearance &&
      limit !== undefined &&
      knowledge.value.context === clearance.context
    ) {
      const minimum = knowledge.value.minCm;
      const maximum = knowledge.value.maxCm;
      if (maximum !== undefined && maximum <= limit) {
        const reason = reasonFromEvidence(
          `documented_${dimension}_within_clearance`,
          `mature_${dimension}`,
          dimension === "height"
            ? `Documented mature height is within the ${heightLimitLabel} of ${limit} cm (${clearance.context} context).`
            : `Documented mature ${dimension} is within the explicitly recorded ${limit} cm clearance (${clearance.context} context).`,
          knowledge.evidence,
        );
        reasons.push(reason);
        rankingSignals.push({
          code: `known_${dimension}_fits`,
          effect: "supports_context",
          statement: reason.statement,
          sourceIds: reason.sourceIds,
        });
      } else if (minimum !== undefined && minimum > limit) {
        const reason = reasonFromEvidence(
          `documented_${dimension}_may_exceed_clearance`,
          `mature_${dimension}`,
          dimension === "height"
            ? `The documented minimum mature height (${minimum} cm) exceeds the ${heightLimitLabel} of ${limit} cm; this is a consideration, not an exclusion.`
            : `The documented minimum mature ${dimension} (${minimum} cm) exceeds the explicitly recorded ${limit} cm clearance; this is a consideration, not an exclusion.`,
          knowledge.evidence,
        );
        rankingSignals.push({
          code: `known_${dimension}_needs_review`,
          effect: "needs_review",
          statement: reason.statement,
          sourceIds: reason.sourceIds,
        });
      } else {
        unknowns.push({
          property: `mature_${dimension}_fit`,
          reason: `The documented ${dimension} bound does not establish whether the plant fits within the explicitly recorded ${limit} cm clearance.`,
        });
      }
    } else if (knowledge.status !== "known") {
      unknowns.push({
        property: `mature_${dimension}`,
        reason:
          knowledge.reason ??
          (knowledge.status === "pending"
            ? "Evidence is pending."
            : "No supported mature dimension is recorded."),
      });
    } else if (!clearance || limit === undefined || knowledge.value.context !== clearance.context) {
      unknowns.push({
        property: `mature_${dimension}_fit`,
        reason:
          "A comparable, explicitly recorded target clearance is not available; profile dimensions are not treated as a fit or failure.",
      });
    }
  }

  const applicableSpacing =
    profile.spacing.status === "known"
      ? profile.spacing.value.filter(
          (spacing) =>
            input.target.verifiedFacts.positionSpacing &&
            spacing.context === input.target.verifiedFacts.positionSpacing.context &&
            spacing.spacingType === "position_spacing",
        )
      : [];
  if (applicableSpacing.length && input.target.verifiedFacts.positionSpacing) {
    for (const spacing of applicableSpacing) {
      const available = input.target.verifiedFacts.positionSpacing.distanceCm;
      const withinMinimum = spacing.minCm === undefined || available >= spacing.minCm;
      const withinMaximum = spacing.maxCm === undefined || available <= spacing.maxCm;
      if (withinMinimum && withinMaximum) {
        const reason = reasonFromEvidence(
          "documented_position_spacing_available",
          "spacing",
          `The explicitly recorded ${available} cm position spacing is within the documented ${spacing.context} spacing range.`,
          profile.spacing.status === "known" ? profile.spacing.evidence : [],
        );
        reasons.push(reason);
        rankingSignals.push({
          code: "known_position_spacing_fits",
          effect: "supports_context",
          statement: reason.statement,
          sourceIds: reason.sourceIds,
        });
      } else {
        const signal = reasonFromEvidence(
          "documented_position_spacing_differs",
          "spacing",
          `The explicitly recorded ${available} cm position spacing is outside the documented ${spacing.context} spacing range; this is a consideration, not an exclusion.`,
          profile.spacing.status === "known" ? profile.spacing.evidence : [],
        );
        rankingSignals.push({
          code: "known_position_spacing_needs_review",
          effect: "needs_review",
          statement: signal.statement,
          sourceIds: signal.sourceIds,
        });
      }
    }
  } else if (profile.spacing.status !== "known") {
    unknowns.push({
      property: "spacing",
      reason:
        profile.spacing.reason ??
        (profile.spacing.status === "pending"
          ? "Evidence is pending."
          : "No supported spacing is recorded."),
    });
  } else {
    unknowns.push({
      property: "applicable_spacing",
      reason:
        "No spacing rule matches a measured position-spacing context; field or row spacing is not treated as pod spacing.",
    });
  }

  if (profile.light.status === "known" && input.target.verifiedFacts.light) {
    const growingLight = profile.light.value.find((item) => item.phase === "growing");
    if (growingLight?.requirement.kind === input.target.verifiedFacts.light) {
      const reason = reasonFromEvidence(
        "documented_growing_light_match",
        "light",
        `The documented growing-light requirement matches the explicitly recorded ${input.target.verifiedFacts.light} Garden condition.`,
        profile.light.evidence,
      );
      reasons.push(reason);
      rankingSignals.push({
        code: "known_growing_light_match",
        effect: "supports_context",
        statement: reason.statement,
        sourceIds: reason.sourceIds,
      });
    } else if (growingLight) {
      const reason = reasonFromEvidence(
        "documented_growing_light_differs",
        "light",
        `The documented growing-light requirement (${growingLight.requirement.kind}) differs from the explicitly recorded ${input.target.verifiedFacts.light} Garden condition; this is a consideration, not an exclusion.`,
        profile.light.evidence,
      );
      rankingSignals.push({
        code: "known_growing_light_needs_review",
        effect: "needs_review",
        statement: reason.statement,
        sourceIds: reason.sourceIds,
      });
    }
  } else if (profile.light.status !== "known") {
    unknowns.push({
      property: "light",
      reason:
        profile.light.reason ??
        (profile.light.status === "pending"
          ? "Evidence is pending."
          : "No phase-specific light requirement is recorded."),
    });
  } else {
    unknowns.push({
      property: "applicable_light",
      reason:
        "Garden X has no explicit light condition for this position; garden kind is not used to infer exposure.",
    });
  }

  const neighboringOccupants = input.adjacentPositionIds.flatMap(
    (id) => input.positions.find((position) => position.id === id)?.occupants ?? [],
  );
  if (neighboringOccupants.length) {
    const occupiedAdjacentPositionCount = input.adjacentPositionIds.filter(
      (id) => (input.positions.find((position) => position.id === id)?.occupants.length ?? 0) > 0,
    ).length;
    rankingSignals.push({
      code: "adjacent_occupancy_known",
      effect: "context_recorded",
      statement: `${neighboringOccupants.length} active Plant Instance(s) occupy ${occupiedAdjacentPositionCount} adjacent physical position(s); no companion-planting relationship is inferred.`,
      sourceIds: [],
    });
    const expansiveHabits = new Set(["spreading", "trailing"]);
    const candidateIsExpansive =
      habit.status === "known" && habit.value.some((item) => expansiveHabits.has(item));
    const expansiveNeighbors = neighboringOccupants.flatMap((occupant) => {
      const neighborHabit = occupant.identity?.compatibilityProfile?.growthHabits;
      return neighborHabit?.status === "known" &&
        neighborHabit.value.some((item) => expansiveHabits.has(item))
        ? [neighborHabit]
        : [];
    });
    if (candidateIsExpansive) {
      const reason = reasonFromEvidence(
        "expansive_habit_clearance_unresolved",
        "physical_clearance",
        `A ${habit.value.filter((item) => item === "spreading" || item === "trailing").join(" / ")} habit is documented and adjacent positions are occupied, but Garden has no measured clearance to determine whether the habit has room.`,
        habit.evidence,
      );
      reasons.push(reason);
      rankingSignals.push({
        code: "expansive_habit_clearance_unresolved",
        effect: "needs_review",
        statement: reason.statement,
        sourceIds: reason.sourceIds,
      });
    }
    if (expansiveNeighbors.length) {
      const neighborEvidence = expansiveNeighbors.flatMap((item) => item.evidence);
      const evidence = [...(habit.status === "known" ? habit.evidence : []), ...neighborEvidence];
      const reason = reasonFromEvidence(
        "documented_expansive_neighbor_fit_needs_review",
        "growth_habit",
        `${expansiveNeighbors.length} neighboring active plant(s) have documented spreading or trailing habits; measured clearance is unavailable, so spatial fit needs review.`,
        evidence,
      );
      reasons.push(reason);
      rankingSignals.push({
        code: "documented_expansive_neighbor_fit_needs_review",
        effect: "needs_review",
        statement: reason.statement,
        sourceIds: reason.sourceIds,
      });
    }
  }

  if (
    input.target.isPerimeter === true &&
    input.target.verifiedFacts.clearBeyondPerimeter === true &&
    habit.status === "known" &&
    habit.value.some((item) => item === "trailing" || item === "spreading")
  ) {
    const reason = reasonFromEvidence(
      "documented_expansive_habit_has_clear_perimeter_space",
      "physical_clearance",
      `A ${habit.value.filter((item) => item === "trailing" || item === "spreading").join(" / ")} habit is documented, and explicitly recorded space is clear beyond this perimeter position.`,
      habit.evidence,
    );
    reasons.push(reason);
    rankingSignals.push({
      code: "documented_expansive_habit_has_clear_perimeter_space",
      effect: "supports_context",
      statement: reason.statement,
      sourceIds: reason.sourceIds,
    });
  }

  return {
    candidate: {
      libraryPlantId: entry.libraryPlantId,
      commonName: entry.commonName,
      scientificName: entry.scientificName,
      cultivar: entry.cultivar,
    },
    compatibility,
    systemFit,
    eligibility: exclusions.length ? "excluded" : "eligible",
    reasons,
    unknowns,
    exclusions,
    rankingSignals,
  };
}

function compatibilityOrder(state: CompatibilityState) {
  return state === "compatible" ? 0 : state === "conditional" ? 1 : state === "unknown" ? 2 : 3;
}

/** Order: eligible, documented system compatibility, no explicit review signals, explicit fit signals, then stable name. Unknown facts never affect rank. */
export function evaluateEmptyGardenPosition(
  input: EmptyGardenPositionInput,
  catalogEntries: readonly GardenLibraryEntry[],
): GardenCompatibilityResult[] {
  if (!input.target.valid || !input.target.active)
    throw new Error("Target position is not structurally valid and active.");
  const targetPosition = input.positions.find(
    (position) => position.id === input.target.positionId,
  );
  if (!targetPosition) throw new Error("Target position is missing from the Garden geometry.");
  if (targetPosition.occupants.length !== 0) throw new Error("Target position must be empty.");

  const results = catalogEntries
    .filter(
      (entry) => entry.status === "active" && entry.compatibilityProfile?.profileVersion === 1,
    )
    .map((entry) => resultFor(entry, input));

  return results.sort((a, b) => {
    const eligibility = Number(a.eligibility === "excluded") - Number(b.eligibility === "excluded");
    if (eligibility) return eligibility;
    const state = compatibilityOrder(a.compatibility) - compatibilityOrder(b.compatibility);
    if (state) return state;
    const systemFit =
      Number(b.systemFit === "documented_condition_met") -
      Number(a.systemFit === "documented_condition_met");
    if (systemFit) return systemFit;
    const reviewA = a.rankingSignals.some((signal) => signal.effect === "needs_review");
    const reviewB = b.rankingSignals.some((signal) => signal.effect === "needs_review");
    if (reviewA !== reviewB) return Number(reviewA) - Number(reviewB);
    const supportA = a.rankingSignals.some((signal) => signal.effect === "supports_context");
    const supportB = b.rankingSignals.some((signal) => signal.effect === "supports_context");
    if (supportA !== supportB) return Number(supportB) - Number(supportA);
    return a.candidate.commonName < b.candidate.commonName
      ? -1
      : a.candidate.commonName > b.candidate.commonName
        ? 1
        : 0;
  });
}

function positionCoordinates(position: NonNullable<Garden["backendPositions"]>[number]) {
  const row = position.rowNumber ?? position.gridY;
  const column = position.columnNumber ?? position.gridX;
  if (row === undefined || column === undefined) return null;
  return { level: position.levelNumber ?? 1, row, column };
}

function perimeterStatus(
  coordinates: CompatibilityPosition["coordinates"],
  garden: Garden,
): boolean | null {
  if (!coordinates) return null;
  const level =
    garden.systemLayoutLevels?.find((item) => item.levelNumber === coordinates.level) ??
    garden.customSystemLevels?.find((item) => item.levelNumber === coordinates.level);
  if (!level) return null;
  return (
    coordinates.row === 1 ||
    coordinates.column === 1 ||
    coordinates.row === level.rows ||
    coordinates.column === level.columns
  );
}

/**
 * Builds the engine packet from Garden X's current canonical client model.
 * It preserves every active occupant and never treats position number as geometry.
 */
export function buildEmptyGardenPositionInput(
  garden: Garden,
  targetPositionId: string,
  plants: readonly Plant[],
  catalogEntries: readonly GardenLibraryEntry[],
  verifiedFacts: VerifiedPositionFacts = {},
): EmptyGardenPositionInput {
  const backendPositions = garden.backendPositions ?? [];
  const byId = new Map(catalogEntries.map((entry) => [entry.libraryPlantId, entry]));
  const activePlants = plants.filter(
    (plant) => plant.gardenId === garden.id && plant.cycleClosed !== true,
  );
  const positions: CompatibilityPosition[] = backendPositions.map((position) => {
    const coordinates = positionCoordinates(position);
    const occupants = activePlants
      .filter((plant) => plant.backendPositionId === position.id)
      .map((plant) => {
        const libraryPlantId = plant.libraryPlantId ?? plant.knowledgeId ?? null;
        return {
          plantInstanceId: plant.id,
          libraryPlantId,
          growCycleId: plant.backendGrowCycleId ?? null,
          identity: libraryPlantId ? (byId.get(libraryPlantId) ?? null) : null,
        };
      });
    return {
      id: position.id,
      number: position.number,
      active: position.active !== false,
      coordinates,
      occupants,
    };
  });
  const targetPosition = backendPositions.find((position) => position.id === targetPositionId);
  const target = positions.find((position) => position.id === targetPositionId);
  const machineFacts = verifiedMachineContextForGarden(garden).verifiedFacts;
  const combinedFacts: VerifiedPositionFacts = {
    ...machineFacts,
    ...verifiedFacts,
    clearance: verifiedFacts.clearance ?? machineFacts.clearance,
    positionSpacing: verifiedFacts.positionSpacing ?? machineFacts.positionSpacing,
    light: verifiedFacts.light ?? machineFacts.light,
    clearBeyondPerimeter: verifiedFacts.clearBeyondPerimeter ?? machineFacts.clearBeyondPerimeter,
  };
  const adjacentPositionIds = target?.coordinates
    ? positions
        .filter((position) => {
          if (!position.active || position.id === targetPositionId || !position.coordinates)
            return false;
          const a = position.coordinates;
          const b = target.coordinates!;
          // Grid coordinates establish topological adjacency only. Diagonal
          // neighbors count as adjacent; no physical distance is inferred.
          return (
            a.level === b.level &&
            Math.abs(a.row - b.row) <= 1 &&
            Math.abs(a.column - b.column) <= 1
          );
        })
        .map((position) => position.id)
    : [];

  return {
    garden: {
      id: garden.id,
      kind: garden.kind,
      systemName: garden.machine?.name ?? null,
      systemInstanceId: garden.backendSystemInstanceId ?? null,
      systemDefinitionKey: garden.systemDefinitionKey ?? null,
      customSystemDefinitionId: garden.customSystemDefinitionId ?? null,
    },
    target: {
      positionId: targetPositionId,
      valid: Boolean(targetPosition),
      active: target?.active ?? false,
      coordinates: target?.coordinates ?? null,
      isPerimeter: perimeterStatus(target?.coordinates ?? null, garden),
      cultivationContext: garden.cultivationMethod ?? null,
      verifiedFacts: combinedFacts,
    },
    positions,
    adjacentPositionIds,
  };
}

/** Plain diagnostic formatter for tests/development; not UI copy. */
export function formatCompatibilityDiagnostics(results: readonly GardenCompatibilityResult[]) {
  return results
    .map((result) => {
      const lines = [
        `${result.candidate.commonName} — ${result.compatibility} (${result.eligibility})`,
        `  Reasons: ${result.reasons.length ? result.reasons.map((reason) => `${reason.statement}${reason.sourceIds.length ? ` [${reason.sourceIds.join(", ")}; ${reason.taxonomicScopes.join(", ")}]` : ""}`).join(" | ") : "none"}`,
        `  Unknowns: ${result.unknowns.length ? result.unknowns.map((unknown) => `${unknown.property}: ${unknown.reason}`).join(" | ") : "none"}`,
        `  Exclusions: ${result.exclusions.length ? result.exclusions.map((item) => `${item.statement} [${item.sourceIds.join(", ")}]`).join(" | ") : "none"}`,
        `  Ranking signals: ${result.rankingSignals.length ? result.rankingSignals.map((signal) => `${signal.effect}: ${signal.statement}`).join(" | ") : "none"}`,
      ];
      return lines.join("\n");
    })
    .join("\n");
}
