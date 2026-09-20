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
  }).schema("garden");
  const { count, error: countError } = await db
    .from("library_catalog_items")
    .select("library_plant_id", { count: "exact", head: true })
    .eq("catalog_version", gardenLibraryManifest.catalogVersion);
  if (countError) throw countError;
  if (count === gardenLibraryManifest.entries.length) return;
  const { error } = await db.from("library_catalog_items").upsert(
    gardenLibraryManifest.entries.map((entry) => ({
      library_plant_id: entry.libraryPlantId,
      catalog_version: gardenLibraryManifest.catalogVersion,
      common_name: entry.commonName,
      scientific_name: entry.scientificName,
      cultivar: entry.cultivar,
      aliases: entry.aliases,
      category: entry.category,
      status: entry.status,
      provenance: entry.provenance,
    })),
    { onConflict: "library_plant_id" },
  );
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
