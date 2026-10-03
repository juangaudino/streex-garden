import { createFileRoute } from "@tanstack/react-router";
import { GardenpediaLibraryTextDiagnostic } from "@/components/gardenpedia/gardenpedia-library-text-diagnostic";

export const Route = createFileRoute("/gardenpedia/")({
  head: () => ({
    meta: [{ title: "Gardenpedia · Garden X" }],
  }),
  component: GardenpediaIndex,
});

function GardenpediaIndex() {
  return <GardenpediaLibraryTextDiagnostic />;
}
