import {
  type GardenpediaDiagnosticEvent,
  type GardenpediaDiagnosticMilestone,
} from "./gardenpedia-diagnostic-contract";

const endpoint = "/api/gardenpedia-diagnostic";
const sessionStorageKey = "gardenpedia-diagnostic-session-v1";
let sentCount = 0;
let sessionId: string | null = null;

function isGardenpediaPath() {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname === "/gardenpedia" ||
    window.location.pathname.startsWith("/gardenpedia/")
  );
}

function randomSessionId() {
  try {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID().replaceAll("-", "");
  } catch {
    // Continue with the non-cryptographic fallback. This ID is diagnostic only.
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

function getSessionId() {
  if (sessionId) return sessionId;
  try {
    const saved = window.sessionStorage.getItem(sessionStorageKey);
    if (saved && /^[a-zA-Z0-9_-]{8,80}$/.test(saved)) sessionId = saved;
    if (!sessionId) {
      sessionId = randomSessionId();
      window.sessionStorage.setItem(sessionStorageKey, sessionId);
    }
  } catch {
    sessionId = randomSessionId();
  }
  return sessionId;
}

function browserFamily() {
  const userAgent = navigator.userAgent;
  if (/CriOS/i.test(userAgent)) return "ios-chrome";
  if (/FxiOS/i.test(userAgent)) return "ios-firefox";
  if (/EdgiOS/i.test(userAgent)) return "ios-edge";
  if (/iPad|iPhone|iPod/i.test(userAgent) && /Safari/i.test(userAgent)) return "ios-safari";
  if (/Android/i.test(userAgent)) return "android";
  if (/Safari/i.test(userAgent) && /AppleWebKit/i.test(userAgent)) return "safari";
  if (/AppleWebKit/i.test(userAgent)) return "webkit";
  if (/Firefox/i.test(userAgent)) return "firefox";
  if (/Chrome/i.test(userAgent)) return "chromium";
  return "other";
}

function currentView() {
  const view = new URL(window.location.href).searchParams.get("view");
  return [
    "library",
    "seeds",
    "machines",
    "calculator",
    "my-plants",
    "my-seeds",
    "my-machines",
  ].includes(view ?? "")
    ? view!
    : "library";
}

function safeMetrics(): GardenpediaDiagnosticEvent["metrics"] {
  const metrics: NonNullable<GardenpediaDiagnosticEvent["metrics"]> = {};
  try {
    metrics.domNodes = document.getElementsByTagName("*").length;
    const memory = (
      performance as Performance & {
        memory?: {
          usedJSHeapSize?: number;
          totalJSHeapSize?: number;
          jsHeapSizeLimit?: number;
        };
      }
    ).memory;
    if (memory?.usedJSHeapSize !== undefined) metrics.usedHeapSize = memory.usedJSHeapSize;
    if (memory?.totalJSHeapSize !== undefined) metrics.totalHeapSize = memory.totalJSHeapSize;
    if (memory?.jsHeapSizeLimit !== undefined) metrics.jsHeapSizeLimit = memory.jsHeapSizeLimit;
  } catch {
    return undefined;
  }
  return Object.keys(metrics).length ? metrics : undefined;
}

export function recordGardenpediaMilestone(
  milestone: GardenpediaDiagnosticMilestone,
  options: { view?: string; detail?: string } = {},
) {
  if (!isGardenpediaPath() || sentCount >= 100) return;
  sentCount += 1;
  const metrics = safeMetrics();
  const payload: GardenpediaDiagnosticEvent = {
    version: 1,
    sessionId: getSessionId(),
    timestamp: new Date().toISOString(),
    browser: browserFamily(),
    view: options.view ?? currentView(),
    milestone,
    ...(options.detail ? { detail: options.detail } : {}),
    ...(metrics ? { metrics } : {}),
  };
  const body = JSON.stringify(payload);
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(endpoint, blob)) return;
  } catch {
    // Fall through to a keepalive request where sendBeacon is unavailable.
  }
  void fetch(endpoint, {
    method: "POST",
    body,
    credentials: "omit",
    headers: { "content-type": "application/json" },
    keepalive: true,
  }).catch(() => undefined);
}

function installGlobalDiagnostics() {
  if (!isGardenpediaPath()) return;
  window.addEventListener("error", () =>
    recordGardenpediaMilestone("gardenpedia_client_error", { detail: "error" }),
  );
  window.addEventListener("unhandledrejection", () =>
    recordGardenpediaMilestone("gardenpedia_client_error", { detail: "unhandledrejection" }),
  );
  window.addEventListener("pagehide", () =>
    recordGardenpediaMilestone("gardenpedia_pagehide", { detail: "pagehide" }),
  );
  recordGardenpediaMilestone("gardenpedia_boot_start");
}

if (typeof window !== "undefined") installGlobalDiagnostics();
