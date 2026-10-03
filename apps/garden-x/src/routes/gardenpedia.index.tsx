import { createFileRoute } from "@tanstack/react-router";
import { GardenpediaLibraryVisualDiagnostic } from "@/components/gardenpedia/gardenpedia-library-visual-diagnostic";

export const Route = createFileRoute("/gardenpedia/")({
  head: () => ({
    meta: [{ title: "Gardenpedia · Garden X" }],
  }),
  component: GardenpediaIndex,
});

function GardenpediaIndex() {
  return <GardenpediaLibraryVisualDiagnostic />;
}
