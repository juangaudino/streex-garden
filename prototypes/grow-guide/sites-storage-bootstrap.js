(() => {
  const endpoint = "/api/seed-state";
  const pendingKey = "gardenLabsPendingWritesV1";
  const backupPrefix = "gardenLabsPreSitesBackupV1";
  window.GARDEN_LABS_STORAGE_MODE = "checking";

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const persist = (state) => {
    try {
      localStorage.setItem("gardenLabsSeedStateV1", JSON.stringify(state.seedUserState));
      localStorage.setItem("gardenLabsCustomSeedsV1", JSON.stringify(state.customSeeds));
    } catch (error) { console.warn("Garden Labs cache could not be updated", error); }
  };
  const post = async (payload) => {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store",
    });
    if (!response.ok) throw new Error(`Storage request failed (${response.status})`);
    return response.json();
  };
  const hasLocalData = (state) => Object.keys(state.seedUserState || {}).length > 0 || (state.customSeeds || []).length > 0;

  window.GARDEN_LABS_STORAGE_HYDRATE = async (state) => {
    const localState = structuredClone(state.seedUserState || {});
    const localSeeds = structuredClone(state.customSeeds || []);
    try {
      let response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error(`Storage request failed (${response.status})`);
      let remote = await response.json();
      if (!remote?.seedUserState || !Array.isArray(remote.customSeeds)) throw new Error("Malformed storage response");

      const remoteHasData = Object.keys(remote.seedUserState).length > 0 || remote.customSeeds.length > 0;
      if (remoteHasData && hasLocalData(state) && !localStorage.getItem(`${backupPrefix}Latest`)) {
        const backup = `${backupPrefix}-${Date.now()}`;
        localStorage.setItem(`${backup}-seed`, JSON.stringify(localState));
        localStorage.setItem(`${backup}-custom`, JSON.stringify(localSeeds));
        localStorage.setItem(`${backupPrefix}Latest`, backup);
      }
      if (!remoteHasData && !remote.importCompleted && hasLocalData(state)) {
        const backup = `${backupPrefix}-${Date.now()}`;
        localStorage.setItem(`${backup}-seed`, JSON.stringify(localState));
        localStorage.setItem(`${backup}-custom`, JSON.stringify(localSeeds));
        localStorage.setItem(`${backupPrefix}Latest`, backup);
        try {
          await post({ operation: "import", seedUserState: localState, customSeeds: localSeeds });
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("409")) throw error;
        }
        response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) throw new Error(`Storage request failed (${response.status})`);
        remote = await response.json();
      }

      state.seedUserState = remote.seedUserState;
      state.customSeeds = remote.customSeeds;
      window.GARDEN_LABS_STORAGE_MODE = "synced";

      const queue = readJson(pendingKey, []);
      const remaining = [];
      for (const operation of Array.isArray(queue) ? queue : []) {
        if (operation.operation === "delete-custom") {
          state.customSeeds = state.customSeeds.filter((seed) => seed.id !== operation.seedKey);
          delete state.seedUserState[operation.seedKey];
        } else {
          state.seedUserState[operation.seedKey] = operation.state;
          if (operation.customSeed) {
            const existing = state.customSeeds.find((seed) => seed.id === operation.seedKey);
            if (existing) Object.assign(existing, operation.customSeed);
            else state.customSeeds.push({ ...operation.customSeed, id: operation.seedKey, aliases: [], createdInLab: true });
          }
        }
        try { await post(operation); } catch { remaining.push(operation); }
      }
      localStorage.setItem(pendingKey, JSON.stringify(remaining));
      if (remaining.length) window.GARDEN_LABS_STORAGE_MODE = "local";
      persist(state);
    } catch (error) {
      console.warn("Garden Labs is using device-local data because D1 is unavailable", error);
      window.GARDEN_LABS_STORAGE_MODE = "local";
    }
  };
})();
