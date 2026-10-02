(() => {
  const ASSET_BASE = window.GROW_GUIDE_ASSET_BASE || ".";
  const assetUrl = (path) => `${ASSET_BASE}/${path}`;
  const DATA = {
    plants: "data/plants-expansion-wave-3.json",
    sources: "data/sources-expansion-wave-3.json",
    translations: "data/translations-expansion-wave-3-es.json",
    seedProfiles: "data/seed-profiles-expansion-wave-3.json",
  };

  function waitForWave2(timeoutMs = 12000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        try {
          if (typeof state !== "undefined" && typeof applyLanguage === "function" && Array.isArray(state.plants) && state.plants.length >= 108 && state.sources && state.seedProfiles) {
            resolve();
            return;
          }
        } catch {}
        if (Date.now() - started >= timeoutMs) reject(new Error("Gardenpedia Wave 2 catalog did not become ready in time."));
        else setTimeout(check, 50);
      };
      check();
    });
  }

  async function loadWave() {
    try {
      const [plantResponse, sourceResponse, translationResponse, seedResponse] = await Promise.all([
        fetch(assetUrl(DATA.plants), { cache: "no-store" }),
        fetch(assetUrl(DATA.sources), { cache: "no-store" }),
        fetch(assetUrl(DATA.translations), { cache: "no-store" }),
        fetch(assetUrl(DATA.seedProfiles), { cache: "no-store" }),
      ]);
      if (![plantResponse, sourceResponse, translationResponse, seedResponse].every((response) => response.ok)) throw new Error("Gardenpedia Wave 3 data could not be loaded.");
      const [plants, sources, translations, seedProfiles] = await Promise.all([
        plantResponse.json(), sourceResponse.json(), translationResponse.json(), seedResponse.json(),
      ]);
      await waitForWave2();
      const existing = new Set(state.plants.map((plant) => plant.id));
      const additions = plants.filter((plant) => plant?.id && !existing.has(plant.id));
      state.plants = [...state.plants, ...additions];
      sources.forEach((source) => { if (source?.id) state.sources[source.id] = source; });
      state.translations = { ...state.translations, ...translations };
      state.seedProfiles = { ...state.seedProfiles, profiles: { ...state.seedProfiles.profiles, ...seedProfiles.profiles } };
      if (typeof ui !== "undefined") {
        ui.en.version = "V1.3 · 155 identities · ES/EN · source-aware + Wave 3";
        ui.es.version = "V1.3 · 155 identidades · ES/EN · fuentes + Wave 3";
      }
      applyLanguage();
      document.documentElement.dataset.gardenpediaExpansionWave3 = "1";
      window.dispatchEvent(new CustomEvent("gardenpedia:expansion-wave-3-loaded", { detail: { added: additions.length } }));
    } catch (error) {
      console.warn("Gardenpedia Wave 3 skipped:", error);
    }
  }

  loadWave();
})();
