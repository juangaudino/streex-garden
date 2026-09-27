const capabilityKeys = new Set([
  "can_flower",
  "can_fruit",
  "harvestable_leaf",
  "harvestable_fruit",
  "can_regrow_after_harvest",
  "can_propagate",
]);

function fail(path, message) {
  throw new Error(`Invalid Gardenpedia life capabilities at ${path}: ${message}`);
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

function validateEvidence(evidence, path, knownSourceIds) {
  if (!Array.isArray(evidence) || evidence.length === 0)
    fail(path, "known capabilities require evidence");

  for (const [index, raw] of evidence.entries()) {
    const itemPath = `${path}[${index}]`;
    const item = object(raw, itemPath);
    exactKeys(
      item,
      ["sourceIds", "evidenceType", "confidence", "taxonomicScope", "note"],
      itemPath,
    );
    if (
      !Array.isArray(item.sourceIds) ||
      item.sourceIds.length === 0 ||
      item.sourceIds.some(
        (sourceId) =>
          typeof sourceId !== "string" || !knownSourceIds.has(sourceId),
      )
    )
      fail(`${itemPath}.sourceIds`, "expected published source IDs");
    if (item.evidenceType !== "source_backed")
      fail(`${itemPath}.evidenceType`, "life capabilities require source-backed evidence");
    if (!["high", "medium"].includes(item.confidence))
      fail(`${itemPath}.confidence`, "expected high or medium confidence");
    if (typeof item.note !== "string" || !item.note.trim())
      fail(`${itemPath}.note`, "a scope and claim note is required");

    const scope = object(item.taxonomicScope, `${itemPath}.taxonomicScope`);
    if (scope.level === "identity") {
      exactKeys(scope, ["level"], `${itemPath}.taxonomicScope`);
    } else if (["species", "genus"].includes(scope.level)) {
      exactKeys(scope, ["level", "taxon"], `${itemPath}.taxonomicScope`);
      if (typeof scope.taxon !== "string" || !scope.taxon.trim())
        fail(`${itemPath}.taxonomicScope.taxon`, "a taxon name is required");
    } else {
      fail(`${itemPath}.taxonomicScope.level`, "expected identity, species, or genus");
    }
  }
}

export function validateGardenpediaLifeCapabilities(
  capabilities,
  knownSourceIds,
) {
  const value = object(capabilities, "lifeCapabilities");
  if (!(knownSourceIds instanceof Set))
    fail("knownSourceIds", "expected a Set of published source IDs");

  for (const [key, raw] of Object.entries(value)) {
    const path = `lifeCapabilities.${key}`;
    if (!capabilityKeys.has(key)) fail(path, "unsupported capability key");
    const item = object(raw, path);
    if (item.status === "known") {
      exactKeys(item, ["status", "value", "evidence"], path);
      if (typeof item.value !== "boolean") fail(`${path}.value`, "expected a boolean");
      validateEvidence(item.evidence, `${path}.evidence`, knownSourceIds);
    } else if (item.status === "unknown" || item.status === "pending") {
      exactKeys(item, ["status", "reason"], path);
      if (item.reason !== undefined && typeof item.reason !== "string")
        fail(`${path}.reason`, "expected text");
      if ("value" in item || "evidence" in item)
        fail(path, `${item.status} capabilities cannot carry a claim or evidence`);
    } else {
      fail(`${path}.status`, "expected known, unknown, or pending");
    }
  }

  return value;
}
