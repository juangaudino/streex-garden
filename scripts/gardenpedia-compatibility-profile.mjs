const growthHabits = new Set([
  "compact",
  "upright",
  "bushy",
  "spreading",
  "trailing",
  "rosette",
  "clumping",
  "mounded",
]);
const contexts = new Set([
  "in_ground",
  "container",
  "hydroponic",
  "outdoor_general",
  "unspecified",
]);
const evidenceTypes = new Set(["source_backed", "garden_adaptation"]);
const confidences = new Set(["high", "medium", "low"]);
const conditionKinds = new Set([
  "system_type",
  "support",
  "container",
  "root_space",
  "environment",
  "other",
]);

function fail(path, message) {
  throw new Error(
    `Invalid Gardenpedia compatibility profile at ${path}: ${message}`,
  );
}

function object(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(path, "expected an object");
  return value;
}

function exactKeys(value, allowed, path) {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) fail(path, `unsupported field ${unexpected}`);
}

function finite(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    fail(path, "expected a finite non-negative number");
}

function evidenceList(value, path, knownSourceIds) {
  if (!Array.isArray(value) || value.length === 0)
    fail(path, "known claims require evidence");
  for (const [index, raw] of value.entries()) {
    const itemPath = `${path}[${index}]`;
    const item = object(raw, itemPath);
    exactKeys(
      item,
      ["sourceIds", "evidenceType", "confidence", "taxonomicScope", "note"],
      itemPath,
    );
    if (!Array.isArray(item.sourceIds) || item.sourceIds.length === 0)
      fail(`${itemPath}.sourceIds`, "expected at least one source ID");
    for (const sourceId of item.sourceIds) {
      if (typeof sourceId !== "string" || !knownSourceIds.has(sourceId))
        fail(
          `${itemPath}.sourceIds`,
          `unknown or unpublished source ${String(sourceId)}`,
        );
    }
    if (!evidenceTypes.has(item.evidenceType))
      fail(`${itemPath}.evidenceType`, "unsupported evidence type");
    if (!confidences.has(item.confidence))
      fail(`${itemPath}.confidence`, "expected high, medium, or low");
    const scope = object(item.taxonomicScope, `${itemPath}.taxonomicScope`);
    if (scope.level === "identity") {
      exactKeys(scope, ["level"], `${itemPath}.taxonomicScope`);
      if ("taxon" in scope)
        fail(
          `${itemPath}.taxonomicScope`,
          "identity scope is supplied by the containing library identity",
        );
    } else if (["species", "genus", "family"].includes(scope.level)) {
      exactKeys(scope, ["level", "taxon"], `${itemPath}.taxonomicScope`);
      if (typeof scope.taxon !== "string" || !scope.taxon.trim())
        fail(
          `${itemPath}.taxonomicScope.taxon`,
          "broader taxonomic scopes require a taxon name",
        );
    } else
      fail(`${itemPath}.taxonomicScope.level`, "unsupported taxonomic scope");
    if (item.note !== undefined && typeof item.note !== "string")
      fail(`${itemPath}.note`, "expected text");
  }
}

function knowledge(value, path, validateKnown, knownSourceIds) {
  const item = object(value, path);
  if (item.status === "known") {
    exactKeys(item, ["status", "value", "evidence"], path);
    validateKnown(item.value, `${path}.value`);
    evidenceList(item.evidence, `${path}.evidence`, knownSourceIds);
  } else if (item.status === "unknown" || item.status === "pending") {
    exactKeys(item, ["status", "reason", "evidence"], path);
    if ("value" in item)
      fail(path, `${item.status} values cannot contain a claim value`);
    if (item.reason !== undefined && typeof item.reason !== "string")
      fail(`${path}.reason`, "expected text");
    if (item.evidence !== undefined)
      evidenceList(item.evidence, `${path}.evidence`, knownSourceIds);
  } else fail(`${path}.status`, "expected known, unknown, or pending");
}

function measurement(value, path) {
  const item = object(value, path);
  exactKeys(item, ["minCm", "maxCm", "context"], path);
  finite(item.minCm, `${path}.minCm`);
  finite(item.maxCm, `${path}.maxCm`);
  if (item.minCm > item.maxCm) fail(path, "minCm must not exceed maxCm");
  if (!contexts.has(item.context))
    fail(`${path}.context`, "unsupported growing context");
}

function numericRange(min, max, path) {
  finite(min, `${path}.min`);
  finite(max, `${path}.max`);
  if (min > max) fail(path, "minimum must not exceed maximum");
}

function range(value, path) {
  const item = object(value, path);
  exactKeys(item, ["minCm", "maxCm", "context", "spacingType"], path);
  numericRange(item.minCm, item.maxCm, path);
}

export function validateCompatibilityProfile(profile, knownSourceIds) {
  const value = object(profile, "compatibilityProfile");
  exactKeys(
    value,
    [
      "profileVersion",
      "hydroponicSuitability",
      "growthHabits",
      "matureSize",
      "spacing",
      "light",
    ],
    "compatibilityProfile",
  );
  if (value.profileVersion !== 1) fail("profileVersion", "expected version 1");
  if (!(knownSourceIds instanceof Set))
    fail("knownSourceIds", "expected a Set of published source IDs");

  const suitability = object(
    value.hydroponicSuitability,
    "hydroponicSuitability",
  );
  if (["compatible", "incompatible"].includes(suitability.status)) {
    exactKeys(suitability, ["status", "evidence"], "hydroponicSuitability");
    evidenceList(
      suitability.evidence,
      "hydroponicSuitability.evidence",
      knownSourceIds,
    );
  } else if (suitability.status === "conditional") {
    exactKeys(
      suitability,
      ["status", "conditions", "evidence"],
      "hydroponicSuitability",
    );
    if (
      !Array.isArray(suitability.conditions) ||
      suitability.conditions.length === 0
    )
      fail(
        "hydroponicSuitability.conditions",
        "conditional suitability requires at least one condition",
      );
    suitability.conditions.forEach((condition, index) => {
      const path = `hydroponicSuitability.conditions[${index}]`;
      const item = object(condition, path);
      exactKeys(item, ["kind", "description"], path);
      if (!conditionKinds.has(item.kind))
        fail(`${path}.kind`, "unsupported condition kind");
      if (typeof item.description !== "string" || !item.description.trim())
        fail(`${path}.description`, "expected a non-empty condition");
    });
    evidenceList(
      suitability.evidence,
      "hydroponicSuitability.evidence",
      knownSourceIds,
    );
  } else if (
    suitability.status === "unknown" ||
    suitability.status === "pending"
  ) {
    exactKeys(
      suitability,
      ["status", "reason", "evidence"],
      "hydroponicSuitability",
    );
    if ("value" in suitability || "conditions" in suitability)
      fail(
        "hydroponicSuitability",
        `${suitability.status} cannot contain compatibility claims`,
      );
    if (
      suitability.reason !== undefined &&
      typeof suitability.reason !== "string"
    )
      fail("hydroponicSuitability.reason", "expected text");
    if (suitability.evidence !== undefined)
      evidenceList(
        suitability.evidence,
        "hydroponicSuitability.evidence",
        knownSourceIds,
      );
  } else
    fail(
      "hydroponicSuitability.status",
      "expected compatible, conditional, incompatible, unknown, or pending",
    );

  knowledge(
    value.growthHabits,
    "growthHabits",
    (habits, path) => {
      if (!Array.isArray(habits) || habits.length === 0)
        fail(path, "known growth habit requires at least one value");
      const unique = new Set();
      for (const [index, habit] of habits.entries()) {
        if (!growthHabits.has(habit))
          fail(`${path}[${index}]`, "unsupported growth habit");
        if (unique.has(habit))
          fail(path, "duplicate growth habits are not allowed");
        unique.add(habit);
      }
    },
    knownSourceIds,
  );

  const size = object(value.matureSize, "matureSize");
  exactKeys(size, ["height", "spread"], "matureSize");
  for (const dimension of ["height", "spread"]) {
    knowledge(
      size[dimension],
      `matureSize.${dimension}`,
      (item, path) => measurement(item, path),
      knownSourceIds,
    );
  }

  knowledge(
    value.spacing,
    "spacing",
    (rules, path) => {
      if (!Array.isArray(rules) || rules.length === 0)
        fail(path, "known spacing requires at least one rule");
      for (const [index, raw] of rules.entries()) {
        const rulePath = `${path}[${index}]`;
        const rule = object(raw, rulePath);
        exactKeys(rule, ["minCm", "maxCm", "context", "spacingType"], rulePath);
        range(rule, rulePath);
        if (!contexts.has(rule.context))
          fail(`${rulePath}.context`, "unsupported growing context");
        if (
          ![
            "between_plants",
            "in_row",
            "between_rows",
            "container_clearance",
            "position_spacing",
          ].includes(rule.spacingType)
        )
          fail(`${rulePath}.spacingType`, "unsupported spacing type");
      }
    },
    knownSourceIds,
  );

  knowledge(
    value.light,
    "light",
    (requirements, path) => {
      if (!Array.isArray(requirements) || requirements.length === 0)
        fail(path, "known light guidance requires at least one requirement");
      for (const [index, raw] of requirements.entries()) {
        const itemPath = `${path}[${index}]`;
        const item = object(raw, itemPath);
        exactKeys(item, ["phase", "requirement"], itemPath);
        if (!["germination", "growing"].includes(item.phase))
          fail(`${itemPath}.phase`, "expected germination or growing");
        const requirement = object(item.requirement, `${itemPath}.requirement`);
        if (["full_sun", "partial_sun", "shade"].includes(requirement.kind)) {
          exactKeys(requirement, ["kind"], `${itemPath}.requirement`);
          if ("minHours" in requirement || "maxHours" in requirement)
            fail(
              `${itemPath}.requirement`,
              "sun category cannot contain hours",
            );
        } else if (requirement.kind === "hours_per_day") {
          exactKeys(
            requirement,
            ["kind", "minHours", "maxHours"],
            `${itemPath}.requirement`,
          );
          numericRange(
            requirement.minHours,
            requirement.maxHours,
            `${itemPath}.requirement`,
          );
          if (requirement.maxHours > 24)
            fail(
              `${itemPath}.requirement.maxHours`,
              "hours per day cannot exceed 24",
            );
        } else
          fail(`${itemPath}.requirement.kind`, "unsupported light requirement");
      }
    },
    knownSourceIds,
  );
  return value;
}
