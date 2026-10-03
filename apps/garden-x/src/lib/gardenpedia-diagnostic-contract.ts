export const GARDENPEDIA_DIAGNOSTIC_MILESTONES = [
  "gardenpedia_boot_start",
  "gardenpedia_hydration_start",
  "gardenpedia_hydration_complete",
  "gardenpedia_library_mount",
  "gardenpedia_navigation_start",
  "gardenpedia_view_unmount",
  "gardenpedia_seeds_import_start",
  "gardenpedia_seeds_import_complete",
  "gardenpedia_seeds_import_error",
  "gardenpedia_seeds_mount",
  "gardenpedia_library_return",
  "gardenpedia_auth_init",
  "gardenpedia_storage_init",
  "gardenpedia_sw_state",
  "gardenpedia_client_error",
  "gardenpedia_pagehide",
] as const;

export type GardenpediaDiagnosticMilestone = (typeof GARDENPEDIA_DIAGNOSTIC_MILESTONES)[number];

const milestoneSet = new Set<string>(GARDENPEDIA_DIAGNOSTIC_MILESTONES);
const viewSet = new Set([
  "library",
  "seeds",
  "machines",
  "calculator",
  "my-plants",
  "my-seeds",
  "my-machines",
]);

export type GardenpediaDiagnosticEvent = {
  version: 1;
  sessionId: string;
  timestamp: string;
  browser: string;
  view: string;
  milestone: GardenpediaDiagnosticMilestone;
  detail?: string;
  metrics?: {
    domNodes?: number;
    usedHeapSize?: number;
    totalHeapSize?: number;
    jsHeapSizeLimit?: number;
  };
};

export function sanitizeGardenpediaDiagnosticPayload(
  value: unknown,
): GardenpediaDiagnosticEvent | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const milestone = typeof payload.milestone === "string" ? payload.milestone : "";
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  const timestamp = typeof payload.timestamp === "string" ? payload.timestamp : "";
  const browser = typeof payload.browser === "string" ? payload.browser : "";
  const view = typeof payload.view === "string" ? payload.view : "";
  if (
    !milestoneSet.has(milestone) ||
    !/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId) ||
    !timestamp ||
    browser.length < 1 ||
    browser.length > 40 ||
    !viewSet.has(view)
  ) {
    return null;
  }

  const metricsValue = payload.metrics;
  const metrics =
    metricsValue && typeof metricsValue === "object"
      ? Object.fromEntries(
          ["domNodes", "usedHeapSize", "totalHeapSize", "jsHeapSizeLimit"]
            .map((key) => [key, (metricsValue as Record<string, unknown>)[key]])
            .filter(([, metric]) => typeof metric === "number" && Number.isFinite(metric)),
        )
      : undefined;
  const detail = typeof payload.detail === "string" ? payload.detail.slice(0, 80) : undefined;

  return {
    version: 1,
    sessionId,
    timestamp,
    browser,
    view,
    milestone: milestone as GardenpediaDiagnosticMilestone,
    ...(detail ? { detail } : {}),
    ...(metrics && Object.keys(metrics).length ? { metrics } : {}),
  } as GardenpediaDiagnosticEvent;
}
