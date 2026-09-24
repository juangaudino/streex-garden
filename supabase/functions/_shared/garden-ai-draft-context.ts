export type AiCheckDraftScope =
  | { mode: "cycle"; growCycleId: string }
  | { mode: "photo_only" };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveAiCheckDraftScope(
  growCycleId: unknown,
  contextMode: unknown,
): AiCheckDraftScope | null {
  if (contextMode === undefined && typeof growCycleId === "string" && uuidPattern.test(growCycleId)) {
    return { mode: "cycle", growCycleId };
  }
  if (contextMode === "photo_only" && growCycleId === undefined) {
    return { mode: "photo_only" };
  }
  return null;
}

export function photoOnlyAiCheckContext() {
  return {
    review_scope: "photo_only",
    plant_instance: null,
    grow_cycle: null,
    garden: null,
    canonical_history: null,
    context_note: "No Garden X plant identity, grow cycle, garden, or plant history was selected for this visual review.",
  } as const;
}
