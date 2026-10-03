import { createFileRoute } from "@tanstack/react-router";
import { GardenpediaDiagnosticShell } from "@/components/gardenpedia/gardenpedia-diagnostic-shell";

export const Route = createFileRoute("/gardenpedia/")({
  head: () => ({
    meta: [{ title: "Gardenpedia · Garden X" }],
  }),
  component: GardenpediaIndex,
});

function GardenpediaIndex() {
  return <GardenpediaDiagnosticShell />;
}
