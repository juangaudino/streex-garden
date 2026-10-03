import { useEffect, useState } from "react";

import { preferredLanguage } from "@/lib/ui-copy";
import { GardenLibrary, type GardenpediaLanguage } from "./donor/explore";
import "./donor/gardenpedia-direct.css";

/**
 * Temporary P0 bisection stage: the current React Library/Explore surface only.
 * Do not add navigation, profiles, images, or other Gardenpedia features here.
 */
export function GardenpediaLibraryVisualDiagnostic() {
  const [language, setLanguage] = useState<GardenpediaLanguage>(() => preferredLanguage());
  const [selection, setSelection] = useState<{ name: string; id: string } | null>(null);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="gardenpedia-direct">
      <GardenLibrary
        language={language}
        onLanguageChange={setLanguage}
        diagnosticOnly
        onPlantSelect={(plant) => setSelection({ name: plant.name, id: plant.id })}
      />
      {selection ? (
        <div role="status">
          Selected: {selection.name} · ID: {selection.id}
        </div>
      ) : null}
    </div>
  );
}
