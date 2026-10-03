import { describe, expect, it } from "vitest";

import { sanitizeGardenpediaDiagnosticPayload } from "./gardenpedia-diagnostic-contract";

describe("Gardenpedia diagnostic contract", () => {
  it("accepts only bounded anonymous milestone payloads", () => {
    expect(
      sanitizeGardenpediaDiagnosticPayload({
        version: 1,
        sessionId: "abc12345_session",
        timestamp: "2026-10-03T15:00:00.000Z",
        browser: "ios-safari",
        view: "seeds",
        milestone: "gardenpedia_seeds_mount",
        metrics: { domNodes: 1200, privateValue: "discarded" },
      }),
    ).toMatchObject({
      version: 1,
      browser: "ios-safari",
      view: "seeds",
      milestone: "gardenpedia_seeds_mount",
      metrics: { domNodes: 1200 },
    });
  });

  it("rejects unknown milestones while accepting bounded view names", () => {
    expect(
      sanitizeGardenpediaDiagnosticPayload({
        sessionId: "abc12345_session",
        timestamp: "2026-10-03T15:00:00.000Z",
        browser: "ios-safari",
        view: "seeds",
        milestone: "gardenpedia_unknown",
        userId: "should-not-be-accepted",
      }),
    ).toBeNull();
    expect(
      sanitizeGardenpediaDiagnosticPayload({
        sessionId: "abc12345_session",
        timestamp: "2026-10-03T15:00:00.000Z",
        browser: "ios-safari",
        view: "my-seeds",
        milestone: "gardenpedia_seeds_mount",
      }),
    ).toMatchObject({ view: "my-seeds" });
  });
});
