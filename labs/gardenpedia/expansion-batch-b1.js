(() => {
  const ASSET_BASE = window.GROW_GUIDE_ASSET_BASE || ".";
  const assetUrl = (path) => `${ASSET_BASE}/${path}`;
  const BATCH_VERSION = "0.10-b1";
  const DATA = {
    plants: "data/plants-expansion-batch-b1.json",
    sources: "data/sources-expansion-batch-b1.json",
    translations: "data/translations-expansion-batch-b1-es.json",
  };

  function waitForPreviousBatch(timeoutMs = 10000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        try {
          if (typeof state !== "undefined" && typeof applyLanguage === "function" && Array.isArray(state.plants) && state.plants.length >= 34 && state.sources) {
            resolve(); return;
          }
        } catch {}
        if (Date.now() - started >= timeoutMs) { reject(new Error("Garden Labs A1/base app did not become ready in time.")); return; }
        setTimeout(check, 50);
      };
      check();
    });
  }

  async function loadBatch() {
    try {
      const [pr, sr, tr] = await Promise.all([
        fetch(assetUrl(DATA.plants), { cache: "no-store" }),
        fetch(assetUrl(DATA.sources), { cache: "no-store" }),
        fetch(assetUrl(DATA.translations), { cache: "no-store" }),
      ]);
      if (!pr.ok || !sr.ok || !tr.ok) throw new Error("Expansion Batch B1 data could not be loaded.");
      const [plants, sources, translations] = await Promise.all([pr.json(), sr.json(), tr.json()]);
      await waitForPreviousBatch();
      const existing = new Set(state.plants.map((p) => p.id));
      const additions = plants.filter((p) => p?.id && !existing.has(p.id));
      state.plants = [...state.plants, ...additions];
      sources.forEach((source) => { if (source?.id) state.sources[source.id] = source; });
      state.translations = { ...state.translations, ...translations };
      if (typeof ui !== "undefined") {
        ui.en.version = "V0.10 · 41 guides · ES/EN · source-aware + 36 inventory items";
        ui.es.version = "V0.10 · 41 guías · ES/EN · fuentes reconciliadas + 36 materiales";
      }
      applyLanguage();
      document.documentElement.dataset.gardenLabsExpansionB1 = BATCH_VERSION;
      window.dispatchEvent(new CustomEvent("garden-labs:expansion-b1-loaded", { detail: { version: BATCH_VERSION, added: additions.length } }));
    } catch (error) {
      console.warn("Garden Labs expansion batch B1 skipped:", error);
    }
  }
  loadBatch();
})();
