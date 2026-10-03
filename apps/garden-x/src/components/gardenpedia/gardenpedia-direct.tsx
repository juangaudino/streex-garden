import { useEffect, useMemo, useState } from "react";

import { preferredLanguage } from "@/lib/ui-copy";
import { recordGardenpediaMilestone } from "@/lib/gardenpedia-diagnostic";
import { buildDonorPlantDetail, findCanonicalEntry } from "./donor/canonical-adapter";
import { GardenLibrary, type GardenpediaLanguage } from "./donor/explore";
import type { SeedProfileViewModel } from "./donor/seed-profile-adapter";
import "./donor/gardenpedia-direct.css";

type PlantDetailComponent = typeof import("./donor/plant-detail").DonorPlantDetailPage;
type SeedProfileComponent = typeof import("./donor/seed-profile").SeedProfilePage;
type MachineProfileComponent = typeof import("./donor/machine-profile").MachineProfilePage;

export type GardenpediaView =
  "library" | "seeds" | "machines" | "calculator" | "my-plants" | "my-seeds" | "my-machines";

export type GardenpediaSearch = {
  view?: GardenpediaView;
  plant?: string;
  seed?: string;
  machine?: string;
};

type GardenpediaNavigation = {
  view?: GardenpediaView | undefined;
  plant?: string | undefined;
  seed?: string | undefined;
  machine?: string | undefined;
};

export function GardenpediaDirect({
  search,
  onNavigate,
}: {
  search: GardenpediaSearch;
  onNavigate: (next: GardenpediaNavigation) => void;
}) {
  const [language, setLanguage] = useState<GardenpediaLanguage>(() => preferredLanguage());
  const target = useMemo(
    () =>
      search.plant
        ? { kind: "plant" as const, id: search.plant }
        : search.seed
          ? { kind: "seed" as const, id: search.seed }
          : search.machine
            ? { kind: "machine" as const, id: search.machine }
            : null,
    [search.machine, search.plant, search.seed],
  );
  const [plantDetailComponent, setPlantDetailComponent] = useState<PlantDetailComponent | null>(
    null,
  );
  const [seedProfileComponent, setSeedProfileComponent] = useState<SeedProfileComponent | null>(
    null,
  );
  const [machineProfileComponent, setMachineProfileComponent] =
    useState<MachineProfileComponent | null>(null);
  const [seedProfile, setSeedProfile] = useState<SeedProfileViewModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPlantDetailComponent(null);
    setSeedProfileComponent(null);
    setMachineProfileComponent(null);
    setSeedProfile(null);
    if (!target)
      return () => {
        cancelled = true;
      };

    if (target.kind === "plant") {
      void import("./donor/plant-detail").then(({ DonorPlantDetailPage }) => {
        if (!cancelled) setPlantDetailComponent(() => DonorPlantDetailPage);
      });
    }
    if (target.kind === "seed") {
      recordGardenpediaMilestone("gardenpedia_seeds_import_start", { view: "seeds" });
      void Promise.all([import("./donor/seed-profile"), import("./donor/seed-profile-adapter")])
        .then(([page, adapter]) => {
          if (cancelled) return;
          recordGardenpediaMilestone("gardenpedia_seeds_import_complete", { view: "seeds" });
          setSeedProfileComponent(() => page.SeedProfilePage);
          setSeedProfile(adapter.seedProfileForEntry(target.id, language));
        })
        .catch(() => {
          recordGardenpediaMilestone("gardenpedia_seeds_import_error", { view: "seeds" });
        });
    }
    if (target.kind === "machine") {
      void import("./donor/machine-profile").then(({ MachineProfilePage }) => {
        if (!cancelled) setMachineProfileComponent(() => MachineProfilePage);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [language, target]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const entry = target?.kind === "plant" ? findCanonicalEntry(target.id) : null;
  const machineId = target?.kind === "machine" ? target.id : null;
  const SeedProfilePage = seedProfileComponent;
  const MachineProfilePage = machineProfileComponent;
  const DonorPlantDetailPage = plantDetailComponent;
  if (target?.kind === "seed" && seedProfile && SeedProfilePage) {
    return (
      <div className="gardenpedia-direct">
        <SeedProfilePage
          profile={seedProfile}
          language={language}
          onLanguageChange={setLanguage}
          onBack={() => onNavigate({ seed: undefined, view: "seeds" })}
          onPlantSelect={(plantId) =>
            onNavigate({ plant: plantId, view: "library", seed: undefined, machine: undefined })
          }
        />
      </div>
    );
  }
  if (machineId && MachineProfilePage) {
    return (
      <div className="gardenpedia-direct">
        <MachineProfilePage
          modelId={machineId}
          language={language}
          onBack={() => onNavigate({ machine: undefined, view: "machines" })}
        />
      </div>
    );
  }
  if (entry && DonorPlantDetailPage) {
    return (
      <div className="gardenpedia-direct">
        <DonorPlantDetailPage
          detail={buildDonorPlantDetail(entry, language)}
          language={language}
          onBack={() => onNavigate({ plant: undefined, view: "library" })}
          onSeedSelect={(seedId) =>
            onNavigate({ seed: seedId, view: "seeds", plant: undefined, machine: undefined })
          }
        />
      </div>
    );
  }

  if (target) {
    return (
      <div className="gardenpedia-direct">
        <div className="garden-stage grid min-h-screen place-items-center p-6 text-foreground">
          Loading Gardenpedia…
        </div>
      </div>
    );
  }

  return (
    <div className="gardenpedia-direct">
      <GardenLibrary
        language={language}
        onLanguageChange={setLanguage}
        initialView={search.view ?? "library"}
        onViewChange={(view) =>
          onNavigate({ view, plant: undefined, seed: undefined, machine: undefined })
        }
        onPlantSelect={(plant) =>
          onNavigate({ plant: plant.id, view: "library", seed: undefined, machine: undefined })
        }
        onSeedSelect={(id) =>
          onNavigate({ seed: id, view: "seeds", plant: undefined, machine: undefined })
        }
        onMachineSelect={(id) =>
          onNavigate({ machine: id, view: "machines", plant: undefined, seed: undefined })
        }
      />
    </div>
  );
}
