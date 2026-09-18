import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/plants/$plantId")({
  component: PlantLayout,
});

function PlantLayout() {
  return <Outlet />;
}