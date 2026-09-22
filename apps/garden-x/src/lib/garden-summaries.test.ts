import { describe, expect, it } from "vitest";
import { initialState } from "./garden-data";
import {
  GARDEN_SUMMARY_SCHEMA_VERSION,
  buildSummaryMaterialFingerprint,
  gardenSummaryRequestKey,
  normalizeGardenSummaryResult,
  selectCurrentSummary,
  selectStaleSummary,
} from "./garden-summaries";

const baseState = {
  ...initialState,
  gardens: [{ ...initialState.gardens[0]!, id: "garden-1", archived: false }],
  plants: [
    {
      ...initialState.plants[0]!,
      id: "plant-1",
      gardenId: "garden-1",
      backendGrowCycleId: "cycle-1",
      status: "steady" as const,
    },
  ],
  events: [],
  tasks: [],
  photos: [],
};

const fingerprint = (
  state = baseState,
  scope: "global" | "garden" = "global",
  scopeId: string | null = null,
) => buildSummaryMaterialFingerprint(state, [], scope, scopeId);

describe("Garden Summary material identity", () => {
  it("keeps global and local scopes isolated", () => {
    const secondGarden = { ...baseState.gardens[0]!, id: "garden-2", name: "Second garden" };
    const secondPlant = { ...baseState.plants[0]!, id: "plant-2", gardenId: "garden-2" };
    const state = {
      ...baseState,
      gardens: [...baseState.gardens, secondGarden],
      plants: [...baseState.plants, secondPlant],
    };
    expect(fingerprint(state, "global")).not.toBe(fingerprint(state, "garden", "garden-1"));
    expect(fingerprint(state, "garden", "garden-1")).not.toBe(
      fingerprint(state, "garden", "garden-2"),
    );
  });

  it("is stable for the same material state and ignores a photo-only change", () => {
    const first = fingerprint();
    const withPhoto = {
      ...baseState,
      photos: [{ ...initialState.photos[0]!, id: "photo-1", plantId: "plant-1" }],
    };
    const withPhotoEvent = {
      ...baseState,
      events: [
        {
          ...initialState.events[0]!,
          id: "photo-event",
          plantId: "plant-1",
          type: "photo" as const,
        },
      ],
    };
    expect(fingerprint(withPhoto)).toBe(first);
    expect(fingerprint(withPhotoEvent)).toBe(first);
    expect(fingerprint()).toBe(first);
  });

  it("changes for status, event, follow-up, and completed derived evidence", () => {
    const statusChanged = {
      ...baseState,
      plants: [{ ...baseState.plants[0]!, status: "watching" as const }],
    };
    const eventAdded = {
      ...baseState,
      events: [{ ...initialState.events[0]!, id: "event-1", plantId: "plant-1" }],
    };
    const taskAdded = {
      ...baseState,
      tasks: [{ ...initialState.tasks[0]!, id: "task-1", plantId: "plant-1", done: false }],
    };
    const change = [
      {
        id: "change-1",
        plantInstanceId: "plant-1",
        growCycleId: "cycle-1",
        analysisVersion: "garden_meaningful_change_v1",
        comparisonStatus: "meaningful_change",
      },
    ];
    expect(fingerprint(statusChanged)).not.toBe(fingerprint());
    expect(fingerprint(eventAdded)).not.toBe(fingerprint());
    expect(fingerprint(taskAdded)).not.toBe(fingerprint());
    expect(buildSummaryMaterialFingerprint(baseState, change, "global", null)).not.toBe(
      fingerprint(),
    );
  });

  it("uses scope, language, and analysis version in the request identity", () => {
    const v1 = gardenSummaryRequestKey("global", null, "a".repeat(32), "en");
    expect(v1).toContain(GARDEN_SUMMARY_SCHEMA_VERSION);
    expect(v1).not.toBe(gardenSummaryRequestKey("global", null, "a".repeat(32), "es"));
    expect(v1).not.toBe(gardenSummaryRequestKey("garden", "garden-1", "a".repeat(32), "en"));
    expect(v1).not.toBe(
      gardenSummaryRequestKey("global", null, "a".repeat(32), "en", "garden_summary_v2"),
    );
    expect(v1.length).toBeLessThanOrEqual(160);
  });
});

describe("Garden Summary contract and stale snapshots", () => {
  const proposal = {
    schema_version: "garden_summary_v1",
    summary_text: "Most plants are steady, with one open item to review.",
    scope_type: "global",
    scope_id: null,
    material_fingerprint: "a".repeat(32),
    evidence_coverage: {
      plant_count: 1,
      garden_count: 1,
      open_attention_count: 1,
      recent_event_count: 0,
      meaningful_change_count: 0,
      ai_check_count: 0,
    },
    referenced_plant_instance_ids: ["plant-1"],
    referenced_meaningful_change_ids: [],
    referenced_ai_check_ids: [],
    epistemic_notes: ["Prior AI results remain inferred evidence."],
  };

  it("keeps prior results as stale snapshots without making them current", () => {
    const result = normalizeGardenSummaryResult({
      id: "summary-1",
      proposal,
      created_at: "2026-09-22T12:00:00Z",
      language: "en",
    });
    expect(result).not.toBeNull();
    expect(
      selectCurrentSummary(
        [result!],
        { scopeType: "global", scopeId: null, materialFingerprint: "b".repeat(32) },
        "en",
      ),
    ).toBeNull();
    expect(selectStaleSummary([result!], "global", null, "en")?.summaryText).toContain(
      "Most plants",
    );
  });

  it("rejects internal identifiers and enums in user-facing summary text", () => {
    expect(
      normalizeGardenSummaryResult({
        proposal: { ...proposal, summary_text: "plant_instance_id not_yet" },
      }),
    ).toBeNull();
  });
});
