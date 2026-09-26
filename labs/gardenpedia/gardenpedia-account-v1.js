(() => {
  const endpoint = "/api/gardenpedia/seed-packages";
  const requestEndpoint = "/api/gardenpedia/requests";
  const localState = () => {
    try { return JSON.parse(localStorage.getItem("gardenLabsSeedStateV1") || "{}"); }
    catch { return {}; }
  };
  const localCustom = () => {
    try { return JSON.parse(localStorage.getItem("gardenLabsCustomSeedsV1") || "[]"); }
    catch { return []; }
  };
  const fetchJson = async (url, payload) => {
    const response = await fetch(url, payload ? {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store",
    } : { cache: "no-store" });
    if (!response.ok) throw new Error(`Gardenpedia account request failed (${response.status})`);
    return response.json();
  };

  window.GARDEN_LABS_STORAGE_HYDRATE = async (state) => {
    state.seedPackages = [];
    state.seedUserState = {};
    state.customSeeds = [];
    state.accountMode = "signed_out";
    try {
      const session = await window.GARDEN_X_AUTH?.getSession?.();
      if (!session?.user?.id) return;
      state.accountUserId = session.user.id;
      state.accountMode = "loading";
      const result = await fetchJson(endpoint);
      state.seedPackages = Array.isArray(result.packages) ? result.packages : [];
      state.accountMode = "ready";
    } catch (error) {
      console.warn("Gardenpedia account inventory could not be loaded", error);
      state.accountMode = "error";
    }
  };

  window.GARDENPEDIA_ACCOUNT = Object.freeze({
    hasLocalLegacyData: () => Object.keys(localState()).length > 0 || localCustom().length > 0,
    async savePackage(packageData) {
      if (packageData?.libraryPlantId) {
        const catalog = await fetch("/api/garden-library/catalog", { cache: "no-store" });
        if (!catalog.ok) throw new Error("published_catalog_unavailable");
      }
      return fetchJson(endpoint, { operation: "save", package: packageData });
    },
    async deletePackage(packageId) {
      return fetchJson(endpoint, { operation: "delete", packageId });
    },
    async reconcileLegacy() {
      return fetchJson(endpoint, {
        operation: "reconcile", seedUserState: localState(), customSeeds: localCustom(),
      });
    },
    async createRequest(requestedText) {
      return fetchJson(requestEndpoint, { operation: "create", requestedText });
    },
    async listRequests() { return fetchJson(requestEndpoint); },
    async curatorStatus() { return fetchJson("/api/gardenpedia/curator"); },
    async curatorQueue() { return fetchJson("/api/gardenpedia/curator", { operation: "queue" }); },
    async researchRequest(requestId) { return fetchJson("/api/gardenpedia/research", { requestId }); },
    async reviewProposal(proposalId, decision, note = "") {
      return fetchJson("/api/gardenpedia/curator", { operation: "review", proposalId, decision, note });
    },
    async approveProposal(proposalId) {
      return fetchJson("/api/gardenpedia/curator", { operation: "approve", proposalId });
    },
    async exportPublicationBundle(proposalId) {
      return fetchJson("/api/gardenpedia/curator", { operation: "export", proposalId });
    },
    async publicationStarted(proposalId, reference) {
      return fetchJson("/api/gardenpedia/curator", { operation: "publication_started", proposalId, reference });
    },
    async publicationFailed(proposalId, error) {
      return fetchJson("/api/gardenpedia/curator", { operation: "publication_failed", proposalId, error });
    },
    async reloadPackages() {
      return fetchJson(endpoint);
    },
  });
})();
