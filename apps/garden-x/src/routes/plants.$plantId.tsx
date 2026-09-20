import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { useGarden } from "@/lib/garden-store";
import { RouteLoading } from "@/components/garden/route-loading";

export const Route = createFileRoute("/plants/$plantId")({
  component: PlantLayout,
});

function PlantLayout() {
  const { plantId } = Route.useParams();
  const store = useGarden();
  // A browser Back can restore the URL before the authenticated store has
  // hydrated. Do not turn that valid URL into a false route-level 404.
  if (store.hydration === "loading") return <RouteLoading />;
  if (!store.plants.some((plant) => plant.id === plantId)) throw notFound();
  return <Outlet />;
}
