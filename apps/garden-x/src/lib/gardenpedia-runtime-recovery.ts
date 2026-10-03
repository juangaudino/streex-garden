/**
 * The pre-React Gardenpedia registered a worker under /gardenpedia/ and cached
 * its static application shell. The React cutover no longer uses a worker, so
 * an existing registration must be retired when a current Gardenpedia page is
 * able to run. Keep this narrowly scoped: the Garden X photo cache is a
 * separate namespace and must never be cleared here.
 */

export const GARDENPEDIA_RUNTIME_RECOVERY_KEY = "gardenpedia.runtime-recovery.v1";

type WorkerState = { scriptURL?: string } | null;

type RegistrationLike = {
  scope: string;
  active?: WorkerState;
  waiting?: WorkerState;
  installing?: WorkerState;
};

export function isLegacyGardenpediaRegistration(registration: RegistrationLike) {
  const scripts = [
    registration.active?.scriptURL,
    registration.waiting?.scriptURL,
    registration.installing?.scriptURL,
  ].filter((value): value is string => Boolean(value));

  return (
    registration.scope.includes("/gardenpedia/") ||
    scripts.some((script) => /\/(?:gardenpedia\/service-worker|sw)\.js(?:[?#]|$)/.test(script))
  );
}

export function isLegacyGardenpediaCacheName(name: string) {
  return name.startsWith("garden-labs-timeline-evidence-");
}

function requestRecoveryReload() {
  try {
    if (window.sessionStorage.getItem(GARDENPEDIA_RUNTIME_RECOVERY_KEY) === "1") return false;
    window.sessionStorage.setItem(GARDENPEDIA_RUNTIME_RECOVERY_KEY, "1");
    return true;
  } catch {
    // Private browsing modes may deny sessionStorage. In that case the
    // registration is still retired, but avoid risking a reload loop.
    return false;
  }
}

/** Retire stale Gardenpedia workers/caches and reload once from the network. */
export async function retireLegacyGardenpediaRuntime() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const stale = registrations.filter(isLegacyGardenpediaRegistration);
  const unregistered = (
    await Promise.all(stale.map((registration) => registration.unregister()))
  ).some(Boolean);

  if (typeof caches !== "undefined") {
    const names = await caches.keys();
    await Promise.all(
      names.filter(isLegacyGardenpediaCacheName).map((name) => caches.delete(name)),
    );
  }

  if (unregistered && requestRecoveryReload()) {
    window.location.reload();
  }

  return unregistered;
}
