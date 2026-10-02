import { useEffect, useState } from "react";

import { preferredLanguage } from "@/lib/ui-copy";
import { buildDonorPlantDetail, findCanonicalEntry } from "./donor/canonical-adapter";
import { GardenLibrary, type GardenpediaLanguage } from "./donor/explore";
import { DonorPlantDetailPage } from "./donor/plant-detail";
import { SeedProfilePage } from "./donor/seed-profile";
import { seedProfileForEntry } from "./donor/seed-profile-adapter";
import { MachineProfilePage } from "./donor/machine-profile";
import "./donor/gardenpedia-direct.css";

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

  useEffect(() => {
    const onHashChange = () => setTarget(hashTarget());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const entry = target?.kind === "plant" ? findCanonicalEntry(target.id) : null;
  const seedProfile = target?.kind === "seed" ? seedProfileForEntry(target.id, language) : null;
  const machineId = target?.kind === "machine" ? target.id : null;
  if (seedProfile) {
    return (
      <div className="gardenpedia-direct">
        <SeedProfilePage profile={seedProfile} language={language} onLanguageChange={setLanguage} />
      </div>
    );
  }
  if (machineId) {
    return (
      <div className="gardenpedia-direct">
        <MachineProfilePage modelId={machineId} language={language} />
      </div>
    );
  }
  if (entry) {
    return (
      <div className="gardenpedia-direct">
        <DonorPlantDetailPage detail={buildDonorPlantDetail(entry, language)} language={language} />
      </div>
    );
  }

  return (
    <div className="gardenpedia-direct">
      <GardenLibrary language={language} onLanguageChange={setLanguage} />
    </div>
  );
}
