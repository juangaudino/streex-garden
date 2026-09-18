import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/gardens/$gardenId")({
  component: GardenLayout,
});

function GardenLayout() {
  return <Outlet />;
}