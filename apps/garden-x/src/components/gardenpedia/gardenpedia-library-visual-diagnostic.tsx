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

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="gardenpedia-direct">
      <GardenLibrary language={language} onLanguageChange={setLanguage} diagnosticOnly />
    </div>
  );
}
