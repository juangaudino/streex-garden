import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { gardenLibraryManifest } from "@/generated/garden-library-manifest";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}

async function ensureCatalogCache() {
  const url = process.env["GARDEN_LABS_SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const serviceKey = process.env["GARDEN_LABS_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) throw new Error("Garden Library catalog sync is not configured.");
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.rpc("garden_x_sync_library_catalog", {
    p_catalog: gardenLibraryManifest.entries.map((entry) => ({
      ...entry,
      catalogVersion: gardenLibraryManifest.catalogVersion,
    })),
  });
  if (error) throw error;
}

export const Route = createFileRoute("/api/garden-library/catalog")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await ensureCatalogCache();
          return json(gardenLibraryManifest);
        } catch (error) {
          console.error("Garden Library catalog sync failed", error);
          return json({ error: "catalog_unavailable" }, 503);
        }
      },
    },
  },
});
