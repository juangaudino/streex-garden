const API_BASE = "https://trefle.io/api/v1";

function normalizeCandidate(value) {
  return {
    provider: "trefle",
    providerId: value?.slug || value?.id || null,
    scientificName: value?.scientific_name || value?.scientificName || null,
    commonName: value?.common_name || value?.commonName || null,
    synonyms: Array.isArray(value?.synonyms) ? value.synonyms : [],
    traits: value?.main_species || value?.traits || {},
    provenance: {
      provider: "trefle",
      license: value?.license || null,
      sourceUrl: value?.link || null,
      canonical: false,
    },
  };
}

export function createTrefleAdapter({ token = null, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Trefle adapter requires a fetch implementation");
  const request = async (path) => {
    const url = new URL(`${API_BASE}/${path.replace(/^\//, "")}`);
    if (token) url.searchParams.set("token", token);
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Trefle request failed: ${response.status}`);
    return response.json();
  };
  return Object.freeze({
    provider: "trefle",
    canonicalPublication: false,
    async searchTaxa(query) {
      const payload = await request(`plants/search?q=${encodeURIComponent(query)}`);
      return (payload?.data || []).map(normalizeCandidate);
    },
    async getTaxon(id) {
      const payload = await request(`plants/${encodeURIComponent(id)}`);
      return normalizeCandidate(payload?.data || payload);
    },
  });
}

export { normalizeCandidate as normalizeTrefleCandidate };
