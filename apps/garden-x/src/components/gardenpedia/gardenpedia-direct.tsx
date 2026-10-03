import { useEffect, useState } from "react";

import { preferredLanguage } from "@/lib/ui-copy";
import { buildDonorPlantDetail, findCanonicalEntry } from "./donor/canonical-adapter";
import { GardenLibrary, type GardenpediaLanguage } from "./donor/explore";
import type { SeedProfileViewModel } from "./donor/seed-profile-adapter";
import "./donor/gardenpedia-direct.css";

type PlantDetailComponent = typeof import("./donor/plant-detail").DonorPlantDetailPage;
type SeedProfileComponent = typeof import("./donor/seed-profile").SeedProfilePage;
type MachineProfileComponent = typeof import("./donor/machine-profile").MachineProfilePage;

function hashTarget() {
  if (typeof window === "undefined") return null;
  const value = window.location.hash.replace(/^#/, "").trim();
  if (!value) return null;
  return value.startsWith("seed:")
    ? { kind: "seed" as const, id: value.slice("seed:".length) }
    : value.startsWith("machine:")
      ? { kind: "machine" as const, id: value.slice("machine:".length) }
      : { kind: "plant" as const, id: value };
}

export function GardenpediaDirect() {
  const [language, setLanguage] = useState<GardenpediaLanguage>(() => preferredLanguage());
  const [target, setTarget] = useState(() => hashTarget());
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
    const onHashChange = () => setTarget(hashTarget());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
      void Promise.all([
        import("./donor/seed-profile"),
        import("./donor/seed-profile-adapter"),
      ]).then(([page, adapter]) => {
        if (cancelled) return;
        setSeedProfileComponent(() => page.SeedProfilePage);
        setSeedProfile(adapter.seedProfileForEntry(target.id, language));
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
        <SeedProfilePage profile={seedProfile} language={language} onLanguageChange={setLanguage} />
      </div>
    );
  }
  if (machineId && MachineProfilePage) {
    return (
      <div className="gardenpedia-direct">
        <MachineProfilePage modelId={machineId} language={language} />
      </div>
    );
  }
  if (entry && DonorPlantDetailPage) {
    return (
      <div className="gardenpedia-direct">
        <DonorPlantDetailPage detail={buildDonorPlantDetail(entry, language)} language={language} />
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
      <GardenLibrary language={language} onLanguageChange={setLanguage} />
    </div>
  );
}
