import { useEffect, useState } from "react";

import { preferredLanguage } from "@/lib/ui-copy";
import { buildDonorPlantDetail, findCanonicalEntry } from "./donor/canonical-adapter";
import { GardenLibrary, type GardenpediaLanguage } from "./donor/explore";
import { DonorPlantDetailPage } from "./donor/plant-detail";
import "./donor/gardenpedia-direct.css";

function hashPlantId() {
  if (typeof window === "undefined") return null;
  const value = window.location.hash.replace(/^#/, "").trim();
  return value || null;
}

export function GardenpediaDirect() {
  const [language, setLanguage] = useState<GardenpediaLanguage>(() => preferredLanguage());
  const [selectedId, setSelectedId] = useState<string | null>(() => hashPlantId());

  useEffect(() => {
    const onHashChange = () => setSelectedId(hashPlantId());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const entry = selectedId ? findCanonicalEntry(selectedId) : null;
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
