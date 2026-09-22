import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { useGarden } from "@/lib/garden-store";
import { RouteLoading } from "@/components/garden/route-loading";
import { ui } from "@/lib/ui-copy";

export const Route = createFileRoute("/gardens/$gardenId")({
  component: GardenLayout,
});

function GardenLayout() {
  const { gardenId } = Route.useParams();
  const store = useGarden();
  if (store.hydration === "loading") return <RouteLoading label={ui(store.language, "loadingGarden")} />;
  if (!store.gardens.some((garden) => garden.id === gardenId)) throw notFound();
  return <Outlet />;
}
