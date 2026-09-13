(() => {
  const endpoint = "/api/seed-state";
  const pendingKey = "gardenLabsPendingWritesV1";
  const backupPrefix = "gardenLabsPreSitesBackupV1";
  let mode = window.GARDEN_LABS_STORAGE_MODE || "checking";

  const copy = {
    synced: { en: "Lab personal state · synced in this Site", es: "Estado personal del Lab · sincronizado en este Site" },
    local: { en: "Sync unavailable · changes are saved on this device and are not visible elsewhere yet.", es: "Sin sincronización · los cambios quedan guardados en este dispositivo y aún no aparecen en otros." },
    checking: { en: "Connecting personal Lab storage…", es: "Conectando el almacenamiento personal del Lab…" },
  };

  function safeRead(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  }

  function setMode(next) {
    mode = next;
    if (typeof ui !== "undefined") {
      ui.en.seedStorageNote = copy[next]?.en || copy.local.en;
      ui.es.seedStorageNote = copy[next]?.es || copy.local.es;
      ui.en.localOnly = copy[next]?.en || copy.local.en;
      ui.es.localOnly = copy[next]?.es || copy.local.es;
    }
    document.querySelectorAll('[data-i18n="seedStorageNote"]').forEach((node) => {
      const language = document.documentElement.lang === "en" ? "en" : "es";
      node.textContent = copy[next]?.[language] || copy.local[language];
    });
  }

  function persistCache(state) {
    try {
      localStorage.setItem("gardenLabsSeedStateV1", JSON.stringify(state.seedUserState));
      localStorage.setItem("gardenLabsCustomSeedsV1", JSON.stringify(state.customSeeds));
    } catch (error) {
      console.warn("Garden Labs local fallback cache could not be updated", error);
    }
  }

  function hasLocalData(state) {
    return Object.keys(state.seedUserState || {}).length > 0 || (state.customSeeds || []).length > 0;
  }

  function readPending() {
    const pending = safeRead(pendingKey, []);
    return Array.isArray(pending) ? pending : [];
  }

  function savePending(items) {
    try { localStorage.setItem(pendingKey, JSON.stringify(items)); } catch (error) {
      console.warn("Garden Labs could not persist the pending sync queue", error);
    }
  }

  async function post(payload) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Storage request failed (${response.status})`);
    return response.json();
  }

  function applyPending(state, operation) {
    if (operation.operation === "delete-custom") {
      state.customSeeds = state.customSeeds.filter((seed) => seed.id !== operation.seedKey);
      delete state.seedUserState[operation.seedKey];
      return;
    }
    state.seedUserState[operation.seedKey] = operation.state;
    if (operation.customSeed) {
      const existing = state.customSeeds.find((seed) => seed.id === operation.seedKey);
      if (existing) Object.assign(existing, operation.customSeed);
      else state.customSeeds.push({ ...operation.customSeed, id: operation.seedKey, aliases: [], createdInLab: true });
    }
  }

  async function hydrate(state) {
    setMode("checking");
    const localState = structuredClone(state.seedUserState || {});
    const localSeeds = structuredClone(state.customSeeds || []);
    try {
      let remote = await (await fetch(endpoint, { cache: "no-store" })).json();
      if (!remote || !remote.seedUserState || !remote.customSeeds) throw new Error("Malformed storage response");

      const remoteHasData = Object.keys(remote.seedUserState).length > 0 || remote.customSeeds.length > 0;
      if (!remoteHasData && !remote.importCompleted && hasLocalData(state)) {
        const backup = `${backupPrefix}-${Date.now()}`;
        try {
          if (!localStorage.getItem(`${backup}-seed`)) localStorage.setItem(`${backup}-seed`, JSON.stringify(localState));
          if (!localStorage.getItem(`${backup}-custom`)) localStorage.setItem(`${backup}-custom`, JSON.stringify(localSeeds));
          localStorage.setItem(`${backupPrefix}Latest`, backup);
        } catch (error) {
          throw new Error("A recoverable local backup could not be created", { cause: error });
        }
        try {
          await post({ operation: "import", seedUserState: localState, customSeeds: localSeeds });
          remote = await (await fetch(endpoint, { cache: "no-store" })).json();
        } catch (error) {
          if (!(error instanceof Error) || !String(error.message).includes("409")) throw error;
          remote = await (await fetch(endpoint, { cache: "no-store" })).json();
        }
      }

      state.seedUserState = remote.seedUserState;
      state.customSeeds = remote.customSeeds;
      setMode("synced");
      const pending = readPending();
      if (pending.length) {
        const remaining = [];
        for (const operation of pending) {
          applyPending(state, operation);
          try { await post(operation); }
          catch { remaining.push(operation); }
        }
        savePending(remaining);
        if (remaining.length) setMode("local");
      }
      persistCache(state);
    } catch (error) {
      console.warn("Garden Labs is using its device cache because D1 could not be reached", error);
      setMode("local");
    }
  }

  async function write(state, operation) {
    try {
      await post(operation);
      setMode("synced");
      persistCache(state);
      return true;
    } catch (error) {
      console.warn("Garden Labs change was saved to the device cache; D1 sync failed", error);
      applyPending(state, operation);
      const pending = readPending().filter((item) => item.seedKey !== operation.seedKey);
      pending.push(operation);
      savePending(pending);
      persistCache(state);
      setMode("local");
      return false;
    }
  }

  function personalStateFor(user) {
    return {
      packageStatus: user.packageStatus || "unknown",
      quantityLevel: user.quantityLevel || "unknown",
      storageLocation: user.storageLocation || null,
      purchaseDate: user.purchaseDate || null,
      legacyPurchaseYear: user.purchaseDate ? null : (user.legacyPurchaseYear || user.purchaseYear || null),
      lastGerminationTestAt: user.lastGerminationTestAt || "",
      lastGerminationResultPct: user.lastGerminationResultPct === "" ? null : (user.lastGerminationResultPct ?? null),
      notes: user.notes || null,
      archived: Boolean(user.archived),
    };
  }

  window.GARDEN_LABS_STORAGE = {
    hydrate,
    write,
    personalStateFor,
    persistCache,
    get mode() { return mode; },
  };

  ui.en.seedsIntro = "The packets you own, their approximate state and where they are. Personal Lab state is shared through this private Site.";
  ui.es.seedsIntro = "Qué paquetes tienes realmente, su estado aproximado y dónde están. El estado personal del Lab se comparte en este Site privado.";
  ui.en.personalStateNote = "Personal Lab state is stored separately from packet evidence and Grow Guide knowledge.";
  ui.es.personalStateNote = "El estado personal del Lab se guarda por separado de la evidencia del sobre y del conocimiento de Grow Guide.";
  setMode("checking");

  saveSeedEditor = async function saveSeedEditorWithSitesStorage(seedId, form) {
    const data = new FormData(form);
    let id = seedId;
    let seed = id ? getSeedById(id) : null;
    if (!seed) {
      const packetName = String(data.get("seedName") || "").trim();
      if (!packetName) { form.querySelector("#seedName")?.focus(); return; }
      id = `custom-${crypto.randomUUID()}`;
      seed = { id, packetName, brand: String(data.get("seedBrand") || "").trim(), aliases: [], createdInLab: true };
      state.customSeeds.push(seed);
    } else if (seed.id) {
      seed.packetName = String(data.get("seedName") || seed.packetName).trim() || seed.packetName;
      seed.brand = String(data.get("seedBrand") || "").trim();
    }
    state.seedUserState[id] = {
      ...(state.seedUserState[id] || {}),
      packageStatus: String(data.get("packageStatus") || "unknown"),
      quantityLevel: String(data.get("quantityLevel") || "unknown"),
      storageLocation: String(data.get("storageLocation") || "").trim(),
      purchaseDate: String(data.get("purchaseDate") || ""),
      purchaseYear: "",
      lastGerminationTestAt: String(data.get("germinationTest") || ""),
      lastGerminationResultPct: data.get("germinationResult") === "" ? "" : Number(data.get("germinationResult")),
      notes: String(data.get("seedNotes") || "").trim(),
      archived: false,
    };
    const customSeed = seed?.id ? { id, packetName: seed.packetName, brand: seed.brand || "" } : null;
    await write(state, { operation: "save", seedKey: id, state: personalStateFor(state.seedUserState[id]), customSeed });
    refs.seedDialog.close();
    renderSeeds();
    renderPlants();
  };

  removeSeed = async function removeSeedWithSitesStorage(seedId) {
    const seed = getSeedById(seedId);
    if (!seed) return;
    if (seed.id) {
      state.customSeeds = state.customSeeds.filter((item) => item.id !== seedId);
      delete state.seedUserState[seedId];
      await write(state, { operation: "delete-custom", seedKey: seedId });
    } else {
      state.seedUserState[seedId] = { ...(state.seedUserState[seedId] || {}), archived: true };
      await write(state, { operation: "save", seedKey: seedId, state: personalStateFor(state.seedUserState[seedId]) });
    }
    refs.seedDialog.close();
    renderSeeds();
    renderPlants();
  };

  restoreSeed = async function restoreSeedWithSitesStorage(seedId) {
    state.seedUserState[seedId] = { ...(state.seedUserState[seedId] || {}), archived: false };
    await write(state, { operation: "save", seedKey: seedId, state: personalStateFor(state.seedUserState[seedId]) });
    refs.seedDialog.close();
    state.seedFilter = "all";
    buildSeedFilters();
    renderSeeds();
    renderPlants();
  };
})();
