import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { useGarden } from "@/lib/garden-store";
import { RouteLoading } from "@/components/garden/route-loading";

export const Route = createFileRoute("/gardens/$gardenId")({
  component: GardenLayout,
});

function GardenLayout() {
  const { gardenId } = Route.useParams();
  const store = useGarden();
  if (store.hydration === "loading") return <RouteLoading label={store.language === "es" ? "Cargando tu jardín…" : "Loading your garden…"} />;
  if (store.hydration === "reconnecting" || store.hydration === "offline") return <RouteLoading label={store.language === "es" ? "Reconectando con tu jardín…" : "Reconnecting to your garden…"} />;
  if (!store.gardens.some((garden) => garden.id === gardenId)) throw notFound();
  return <Outlet />;
}
