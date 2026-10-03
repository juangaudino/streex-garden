import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/gardenpedia")({
  component: Gardenpedia,
});

function Gardenpedia() {
  return <Outlet />;
}
