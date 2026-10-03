import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  GardenpediaDirect,
  type GardenpediaSearch,
  type GardenpediaView,
} from "@/components/gardenpedia/gardenpedia-direct";
import { recordGardenpediaMilestone } from "@/lib/gardenpedia-diagnostic";

const views = new Set([
  "library",
  "seeds",
  "machines",
  "calculator",
  "my-plants",
  "my-seeds",
  "my-machines",
]);

function validateSearch(search: Record<string, unknown>): GardenpediaSearch {
  const value = (key: string) =>
    typeof search[key] === "string" ? (search[key] as string) : undefined;
  const view = value("view");
  const result: GardenpediaSearch = {};
  if (view && views.has(view)) result.view = view as GardenpediaView;
  const plant = value("plant");
  const seed = value("seed");
  const machine = value("machine");
  if (plant) result.plant = plant;
  if (seed) result.seed = seed;
  if (machine) result.machine = machine;
  return result;
}

export const Route = createFileRoute("/gardenpedia/")({
  validateSearch,
  head: () => ({
    meta: [{ title: "Gardenpedia · Garden X" }],
  }),
  component: GardenpediaIndex,
});

function GardenpediaIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const previousView = useRef<GardenpediaView | null>(null);
  const currentView = search.view ?? "library";

  useEffect(() => {
    recordGardenpediaMilestone("gardenpedia_library_mount", { view: currentView });
    if (currentView === "library" && previousView.current && previousView.current !== "library") {
      recordGardenpediaMilestone("gardenpedia_library_return", { view: currentView });
    }
    previousView.current = currentView;
    return () => {
      recordGardenpediaMilestone("gardenpedia_view_unmount", { view: currentView });
    };
  }, [currentView]);

  return (
    <GardenpediaDirect
      search={search}
      onNavigate={(next) => {
        recordGardenpediaMilestone("gardenpedia_navigation_start", {
          view: next.view ?? "library",
          detail: next.plant ? "plant" : next.seed ? "seed" : next.machine ? "machine" : undefined,
        });
        void navigate({
          search: {
            ...(next.view ? { view: next.view } : {}),
            ...(next.plant ? { plant: next.plant } : {}),
            ...(next.seed ? { seed: next.seed } : {}),
            ...(next.machine ? { machine: next.machine } : {}),
          },
        });
      }}
    />
  );
}
