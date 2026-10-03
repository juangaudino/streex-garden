import { useEffect, useState } from "react";

export type GardenpediaAuthState = {
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
};

export type GardenpediaPrivateView = "my-plants" | "my-seeds" | "my-machines";

/**
 * A UI-only hint for the public Gardenpedia shell. It never authorizes a
 * private read; private surfaces still perform their normal server-authorized
 * Supabase session check. Keeping this probe local avoids booting Supabase
 * Auth on the anonymous public catalog path.
 */
export function hasPersistedGardenpediaSession() {
  if (typeof window === "undefined") return false;
  try {
    const configuredUrl = String(import.meta.env["VITE_SUPABASE_URL"] || "").trim();
    if (!configuredUrl) return false;
    const projectRef = new URL(configuredUrl).hostname.split(".")[0];
    return Boolean(projectRef && window.localStorage.getItem(`sb-${projectRef}-auth-token`));
  } catch {
    return false;
  }
}

/**
 * Keep Supabase auth out of the public Gardenpedia entry chunk. The public
 * catalog can render first; the auth client is loaded only to reveal private
 * navigation when a session exists.
 */
export function useGardenpediaAuth(enabled = true): GardenpediaAuthState {
  const [state, setState] = useState<GardenpediaAuthState>({
    loading: true,
    signedIn: false,
    userId: null,
  });

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void import("@/lib/supabase").then(({ getSupabaseClient, hasSupabaseConfiguration }) => {
      if (!active) return;
      if (!hasSupabaseConfiguration()) {
        setState({ loading: false, signedIn: false, userId: null });
        return;
      }

      const client = getSupabaseClient();
      void client.auth.getSession().then(({ data }) => {
        if (!active) return;
        setState({
          loading: false,
          signedIn: Boolean(data.session),
          userId: data.session?.user.id ?? null,
        });
      });

      const authSubscription = client.auth.onAuthStateChange((_event, session) => {
        if (active) {
          setState({
            loading: false,
            signedIn: Boolean(session),
            userId: session?.user.id ?? null,
          });
        }
      });
      unsubscribe = () => authSubscription.data.subscription.unsubscribe();
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [enabled]);

  return state;
}
