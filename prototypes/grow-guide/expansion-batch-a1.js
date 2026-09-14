(() => {
  const ASSET_BASE = window.GROW_GUIDE_ASSET_BASE || ".";
  const assetUrl = (path) => `${ASSET_BASE}/${path}`;
  const BATCH_VERSION = "0.9-a1";

  const DATA = {
    plants: "data/plants-expansion-batch-a1.json",
    sources: "data/sources-expansion-batch-a1.json",
    translations: "data/translations-expansion-batch-a1-es.json",
  };

  function waitForBaseApp(timeoutMs = 8000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        try {
          if (
            typeof state !== "undefined" &&
            typeof applyLanguage === "function" &&
            Array.isArray(state.plants) &&
            state.plants.length > 0 &&
            state.sources && Object.keys(state.sources).length > 0
          ) {
            resolve();
            return;
          }
        } catch {
          // Base app may still be hydrating/loading.
        }
        if (Date.now() - started >= timeoutMs) {
          reject(new Error("Garden Labs base app did not become ready in time."));
          return;
        }
        setTimeout(check, 40);
      };
      check();
    });
  }

  function mergeUniquePlants(incoming) {
    const existingIds = new Set(state.plants.map((plant) => plant.id));
    const additions = incoming.filter((plant) => plant?.id && !existingIds.has(plant.id));
    state.plants = [...state.plants, ...additions];
    return additions.length;
  }

  function mergeSources(incoming) {
    incoming.forEach((source) => {
      if (source?.id) state.sources[source.id] = source;
    });
  }

  function mergeTranslations(incoming) {
    state.translations = { ...state.translations, ...incoming };
  }

  function updateUiMetadata() {
    if (typeof ui === "undefined") return;
    ui.en.categories.vegetables = "vegetables";
    ui.es.categories.vegetables = "vegetales";
    ui.en.version = "V0.9 · 34 guides · ES/EN · source-aware + inventory";
    ui.es.version = "V0.9 · 34 guías · ES/EN · fuentes reconciliadas + inventario";
  }

  async function loadBatch() {
    try {
      const [plantsResponse, sourcesResponse, translationsResponse] = await Promise.all([
        fetch(assetUrl(DATA.plants), { cache: "no-store" }),
        fetch(assetUrl(DATA.sources), { cache: "no-store" }),
        fetch(assetUrl(DATA.translations), { cache: "no-store" }),
      ]);

      if (!plantsResponse.ok || !sourcesResponse.ok || !translationsResponse.ok) {
        throw new Error("Expansion Batch A1 data could not be loaded.");
      }

      const [plants, sources, translations] = await Promise.all([
        plantsResponse.json(),
        sourcesResponse.json(),
        translationsResponse.json(),
      ]);

      await waitForBaseApp();
      const added = mergeUniquePlants(plants);
      mergeSources(sources);
      mergeTranslations(translations);
      updateUiMetadata();
      applyLanguage();
      document.documentElement.dataset.gardenLabsExpansion = BATCH_VERSION;
      window.dispatchEvent(new CustomEvent("garden-labs:expansion-loaded", { detail: { version: BATCH_VERSION, added } }));
    } catch (error) {
      console.warn("Garden Labs expansion batch A1 skipped:", error);
    }
  }

  loadBatch();
})();
