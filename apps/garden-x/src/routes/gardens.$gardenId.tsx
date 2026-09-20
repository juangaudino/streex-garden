import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { useGarden } from "@/lib/garden-store";
import { RouteLoading } from "@/components/garden/route-loading";

export const Route = createFileRoute("/gardens/$gardenId")({
  component: GardenLayout,
});

function GardenLayout() {
  const { gardenId } = Route.useParams();
  const store = useGarden();
  if (store.hydration === "loading") return <RouteLoading />;
  if (!store.gardens.some((garden) => garden.id === gardenId)) throw notFound();
  return <Outlet />;
}
