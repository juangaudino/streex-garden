export function validateTaxonomyReconciliation(bundle, publishedIds = new Set()) {
  if (!bundle || bundle.schemaVersion !== "gardenpedia_taxonomy_reconciliation_v1") {
    throw new Error("Unsupported Gardenpedia taxonomy reconciliation version");
  }
  if (!Array.isArray(bundle.records)) throw new Error("Taxonomy reconciliation records must be an array");
  const ids = new Set();
  for (const [index, record] of bundle.records.entries()) {
    if (!record || typeof record !== "object") throw new Error(`Invalid taxonomy record ${index}`);
    if (typeof record.plantIdentityId !== "string" || !record.plantIdentityId.trim()) throw new Error(`Taxonomy record ${index} has no plantIdentityId`);
    if (ids.has(record.plantIdentityId)) throw new Error(`Duplicate taxonomy record: ${record.plantIdentityId}`);
    ids.add(record.plantIdentityId);
    if (publishedIds.size && !publishedIds.has(record.plantIdentityId)) throw new Error(`Taxonomy record has no published identity: ${record.plantIdentityId}`);
    if (typeof record.acceptedScientificName !== "string" || !record.acceptedScientificName.trim()) throw new Error(`Taxonomy record ${record.plantIdentityId} has no accepted name`);
    if (!Array.isArray(record.sourceIds) || record.sourceIds.length === 0) throw new Error(`Taxonomy record ${record.plantIdentityId} has no source provenance`);
    if (!["high", "medium", "low", "pending"].includes(record.confidence)) throw new Error(`Taxonomy record ${record.plantIdentityId} has invalid confidence`);
    if (record.conflicts !== undefined && !Array.isArray(record.conflicts)) throw new Error(`Taxonomy record ${record.plantIdentityId} has malformed conflicts`);
  }
  return bundle;
}
