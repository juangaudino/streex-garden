(() => {
  // Gardenpedia shares Garden X's Supabase session. It never presents a
  // second login and it never falls back to a privileged or anonymous token.
  const SUPABASE_URL = "https://sabulxbfdimoqnbgnmso.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_oBTDsdC9aEI5Sgm7WWNndw_lPXd9zKH";
  const STORAGE_KEY = "sb-sabulxbfdimoqnbgnmso-auth-token";
  const nativeFetch = window.fetch.bind(window);

  const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

  function readSession() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return stored?.currentSession || stored || null;
    } catch {
      return null;
    }
  }

  function saveSession(value) {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // A read-only public session must remain usable if storage is blocked.
    }
  }

  async function refresh(session) {
    if (!session?.refresh_token) return null;
    const response = await nativeFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) {
      saveSession(null);
      return null;
    }
    const next = await response.json();
    saveSession(next);
    return next;
  }

  async function getSession() {
    let current = readSession();
    if (!current?.access_token) return null;
    const expiresAt = Number(current.expires_at || 0) * 1000;
    if (!expiresAt || expiresAt > Date.now() + 60_000) return current;
    current = await refresh(current);
    return current;
  }

  async function rpc(name, body = {}) {
    const current = await getSession();
    if (!current) return jsonResponse({ error: "authentication_required" }, 401);
    const response = await nativeFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: PUBLISHABLE_KEY,
        authorization: `Bearer ${current.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 401) {
      const refreshed = await refresh(current);
      if (refreshed) {
        return nativeFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
          method: "POST",
          headers: {
            apikey: PUBLISHABLE_KEY,
            authorization: `Bearer ${refreshed.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          cache: "no-store",
        });
      }
    }
    return response;
  }

  window.GARDEN_X_AUTH = { getSession };

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url === "/api/machine-state") {
      try {
        const method = (init.method || "GET").toUpperCase();
        if (method === "GET") return rpc("garden_lab_get_machine_storage");
        const payload = JSON.parse(init.body || "{}");
        if (payload.operation !== "save" || !payload.instance) return jsonResponse({ error: "unsupported_operation" }, 400);
        return rpc("garden_lab_save_machine", { p_instance: payload.instance });
      } catch (error) {
        console.warn("Garden X machine storage unavailable", error);
        return jsonResponse({ error: "lab_storage_unavailable" }, 503);
      }
    }
    if (url.startsWith("/api/gardenpedia-machine-performance")) {
      const current = await getSession();
      if (!current) return jsonResponse({ error: "authentication_required" }, 401);
      const headers = new Headers(init.headers || {});
      headers.set("Authorization", `Bearer ${current.access_token}`);
      return nativeFetch(input, { ...init, headers, cache: "no-store" });
    }
    return nativeFetch(input, init);
  };
})();
