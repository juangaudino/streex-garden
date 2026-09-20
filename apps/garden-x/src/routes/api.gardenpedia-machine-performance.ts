import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

const UUID = /^[0-9a-f-]{36}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/gardenpedia-machine-performance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authorization = request.headers.get("authorization") || "";
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
        const gardenId = new URL(request.url).searchParams.get("gardenId") || "";
        if (!token) return json({ error: "authentication_required" }, 401);
        if (!UUID.test(gardenId)) return json({ error: "invalid_garden_id" }, 400);

        const url = process.env["GARDEN_LABS_SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
        const serviceKey = process.env["GARDEN_LABS_SUPABASE_SERVICE_ROLE_KEY"];
        if (!url || !serviceKey) return json({ error: "storage_not_configured" }, 503);

        const db = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userError } = await db.auth.getUser(token);
        if (userError || !userData.user) return json({ error: "authentication_required" }, 401);

        const { data, error } = await db.rpc("garden_lab_service_get_machine_performance", {
          p_owner: userData.user.id,
          p_garden_id: gardenId,
        });
        if (error) {
          console.error("Gardenpedia machine performance gateway failed", error);
          return json({ error: "storage_error" }, 500);
        }
        return json(data || null);
      },
    },
  },
});
