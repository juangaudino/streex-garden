(() => {
  const SUPABASE_URL = "https://sabulxbfdimoqnbgnmso.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_oBTDsdC9aEI5Sgm7WWNndw_lPXd9zKH";
  const SESSION_KEY = "gardenLabsSupabaseSessionV1";
  const nativeFetch = window.fetch.bind(window);

  const readSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } };
  const saveSession = (value) => { if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value)); else localStorage.removeItem(SESSION_KEY); };
  const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  async function signIn(email, password) {
    const response = await nativeFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (!response.ok) throw new Error("No se pudo iniciar sesión en Garden Labs.");
    const session = await response.json(); saveSession(session); return session;
  }
  async function refresh(session) {
    if (!session?.refresh_token) return null;
    const response = await nativeFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
    if (!response.ok) { saveSession(null); return null; }
    const next = await response.json(); saveSession(next); return next;
  }
  function loginDialog() {
    return new Promise((resolve, reject) => {
      let dialog = document.querySelector("#gardenLabsLoginDialog");
      if (!dialog) {
        dialog = document.createElement("dialog"); dialog.id = "gardenLabsLoginDialog";
        dialog.innerHTML = `<form method="dialog" style="min-width:min(360px,80vw);font:inherit"><h2>Garden Labs</h2><p>Inicia sesión con tu cuenta de Garden para sincronizar el estado personal del Lab.</p><label style="display:block;margin:.75rem 0">Email<input name="email" type="email" autocomplete="email" required style="display:block;width:100%;box-sizing:border-box;margin-top:.25rem"></label><label style="display:block;margin:.75rem 0">Contraseña<input name="password" type="password" autocomplete="current-password" required style="display:block;width:100%;box-sizing:border-box;margin-top:.25rem"></label><p data-error style="color:#b42318;min-height:1.2em"></p><button type="submit">Entrar</button></form>`;
        document.body.appendChild(dialog);
      }
      const form = dialog.querySelector("form"); const error = dialog.querySelector("[data-error]");
      form.onsubmit = async (event) => { event.preventDefault(); error.textContent = ""; const data = new FormData(form); try { const session = await signIn(String(data.get("email")), String(data.get("password"))); dialog.close(); resolve(session); } catch (e) { error.textContent = e.message; } };
      dialog.addEventListener("cancel", () => reject(new Error("Garden Labs login cancelled")), { once: true });
      dialog.showModal();
    });
  }
  async function session() {
    let current = readSession();
    if (current?.access_token) {
      const payload = (() => { try { return JSON.parse(atob(current.access_token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))); } catch { return {}; } })();
      if (!payload.exp || payload.exp * 1000 > Date.now() + 60000) return current;
      current = await refresh(current); if (current) return current;
    }
    return loginDialog();
  }
  async function rpc(name, body = {}) {
    let current = await session();
    let response = await nativeFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${current.access_token}`, "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    if (response.status === 401) { current = await refresh(current); if (current) response = await nativeFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${current.access_token}`, "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" }); }
    if (!response.ok) throw new Error(`Supabase RPC ${name} failed (${response.status})`);
    return response.json();
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url;
    if (url === "/api/seed-state") {
      try {
        if ((init.method || "GET").toUpperCase() === "GET") return jsonResponse(await rpc("garden_lab_get_seed_storage"));
        const payload = JSON.parse(init.body || "{}"); return jsonResponse(await rpc("garden_lab_seed_operation", { p_payload: payload }));
      } catch (error) { console.warn(error); return jsonResponse({ error: "lab_storage_unavailable" }, 503); }
    }
    if (url === "/api/machine-state") {
      try {
        if ((init.method || "GET").toUpperCase() === "GET") return jsonResponse(await rpc("garden_lab_get_machine_storage"));
        const payload = JSON.parse(init.body || "{}"); if (payload.operation !== "save" || !payload.instance) return jsonResponse({ error: "unsupported_operation" }, 400);
        return jsonResponse(await rpc("garden_lab_save_machine", { p_instance: payload.instance }));
      } catch (error) { console.warn(error); return jsonResponse({ error: "lab_storage_unavailable" }, 503); }
    }
    return nativeFetch(input, init);
  };
})();
