const state = {
  plants: [],
  sources: {},
  translations: {},
  visuals: {},
  seedInventory: {},
  neighborData: { meta: {}, profiles: {} },
  seedUserState: readLocalJson("gardenLabsSeedStateV1", {}),
  customSeeds: readLocalJson("gardenLabsCustomSeedsV1", []),
  query: "",
  category: "all",
  seedQuery: "",
  seedFilter: "all",
  view: localStorage.getItem("gardenLabsLibraryView") || "guide",
  language: localStorage.getItem("growGuideLanguage") || "es",
  activePlantId: null,
  activeSeedId: null,
};

const assetBase = window.GROW_GUIDE_ASSET_BASE || ".";
const assetUrl = (path) => `${assetBase}/${path}`;

const refs = {
  searchInput: document.querySelector("#searchInput"),
  categoryFilters: document.querySelector("#categoryFilters"),
  plantGrid: document.querySelector("#plantGrid"),
  resultCount: document.querySelector("#resultCount"),
  cardTemplate: document.querySelector("#plantCardTemplate"),
  dialog: document.querySelector("#plantDialog"),
  detail: document.querySelector("#plantDetail"),
  closeDialog: document.querySelector("#closeDialog"),
  installButton: document.querySelector("#installButton"),
  languageButtons: [...document.querySelectorAll("[data-language]")],
  translatable: [...document.querySelectorAll("[data-i18n]")],
  guideTab: document.querySelector("#guideTab"),
  seedsTab: document.querySelector("#seedsTab"),
  guideSurface: document.querySelector("#guideSurface"),
  seedsSurface: document.querySelector("#seedsSurface"),
  seedSearchInput: document.querySelector("#seedSearchInput"),
  seedFilters: document.querySelector("#seedFilters"),
  seedGrid: document.querySelector("#seedGrid"),
  seedResultCount: document.querySelector("#seedResultCount"),
  addSeedButton: document.querySelector("#addSeedButton"),
  seedDialog: document.querySelector("#seedDialog"),
  seedDetail: document.querySelector("#seedDetail"),
  closeSeedDialog: document.querySelector("#closeSeedDialog"),
};

const ui = {
  en: {
    prototype: "GARDEN LABS · EXPERIMENTAL", title: "Garden Library", labStatus: "Active lab · User Zero", install: "Install",
    kicker: "Garden X tests here before production.",
    heroTitle: "What Garden knows and what you own, together without mixing their truth.",
    heroBody: "Garden Library brings growing knowledge and personal inventory together inside Garden Labs. Each layer keeps its own source of truth.",
    labProofExperiment: "Isolated experiment", labProofUserZero: "User Zero validation", labProofSeparation: "Separate sources",
    guideTab: "Guide", seedsTab: "Seeds", guideEyebrow: "GARDEN LIBRARY · GUIDE", guideTitle: "Grow Guide", guideIntro: "Structured knowledge for knowing when, where and how much to intervene in each crop.",
    seedsEyebrow: "GARDEN LIBRARY · SEEDS", seedsTitle: "Your seeds", seedsIntro: "The packets you actually own, their approximate state and where they are. Lab changes are stored only on this device.",
    evidenceLegend: "Evidence legend", sourceBacked: "Source-backed", gardenAdaptation: "Garden adaptation", needsValidation: "Needs validation",
    searchPlaceholder: "Search basil, albahaca, lettuce, Jolly Jester…", filterLabel: "Guide filters", library: "USER ZERO CROP LIBRARY", version: "V0.6 · 29 guides · ES/EN · visual + neighbors + inventory",
    allPlants: "All", plant: "variety", plants: "varieties", guide: "guide", noMatches: "No variety matches that search yet.", unavailable: "Guide unavailable", loadError: "The prototype data could not be loaded.", close: "Close guide", avoid: "Avoid", context: "Context", confidence: "Confidence",
    confidence_high: "high", confidence_medium: "medium", confidence_pending: "pending",
    visualGuide: "Visual guide", visualGuideNote: "External references selected for the action itself — not decorative plant photos.", openSource: "Open source", sourceLinkOnly: "Open at source", rightsReview: "Rights review before production", externalReference: "External reference",
    media_photo: "Photo", media_diagram: "Diagram", media_video: "Video", media_guide: "Guide",
    actions: { thinning: "Thinning", pruning: "Pruning", harvest: "Harvest", flowering: "Flowering", hydroponics: "Hydroponics" },
    categories: { herbs: "herbs", "leafy greens": "leafy greens", fruiting: "fruiting", flowers: "flowers", alliums: "alliums", "root vegetables": "root vegetables" },
    sections: { germination: "Germination", thinning: "Thinning", pruning: "Pruning", harvest: "Harvest", flowering: "Flowering / bolting", hydroponics: "Hydroponics", problems: "Common issues" },
    ownedSeed: "In your seed inventory", packetArchived: "Packet documented · removed from active inventory", packet: "Packet", germinationRate: "Packet germination rate", purity: "Purity", seedCount: "Approx. seeds", daysToBloom: "Days to bloom", daysToHarvest: "Days to harvest", packetEvidence: "Inventory fact from your packet photo", openInSeeds: "Open in Seeds",
    neighbors: "Neighbors", neighborsNote: "Garden scores real growing compatibility first. A traditional companion claim is only promoted when a credible source supports it.", goodNeighbors: "Good neighbors", separateNeighbors: "Better separate", noStrongGood: "No strong positive matches yet.", noStrongBad: "No strong separation flags yet.", researchPair: "Research-backed companion pair", systemPair: "System-fit inference", nearbyRole: "Useful nearby outdoors", neighborDisclaimer: "‘Better separate’ usually means poor light / space / root / nutrient fit — not that one plant chemically harms the other.",
    addSeed: "+ Add seed", seedSearchPlaceholder: "Search tomato, basil, Ferry-Morse…", seedInventoryEyebrow: "USER ZERO INVENTORY", seedStorageNote: "Personal state is local · packet evidence stays separate", seedPackage: "packet", seedPackages: "packets", noSeedMatches: "No seed packets match this view.",
    seedFilters: { all: "All", opened: "Opened", unopened: "Unopened", low: "Low inventory", unset: "Needs status", removed: "Removed" },
    seedStatus: { opened: "Opened", unopened: "Unopened", unknown: "Not set" },
    quantity: { full: "Full", high: "High", medium: "Medium", low: "Low", almost_empty: "Almost empty", unknown: "Not set" },
    locationUnset: "Location not set", viewGuide: "View guide", editSeed: "Edit inventory", newSeed: "Add seed", personalState: "Personal inventory state", personalStateNote: "These Lab fields do not rewrite the packet evidence or Grow Guide knowledge.",
    plantVariety: "Plant / variety", brand: "Brand", packageStatus: "Package status", quantityLevel: "Approx. quantity", storageLocation: "Storage location", purchaseYear: "Purchase year", germinationTestDate: "Last germination test", germinationResult: "Germination result %", notes: "Notes", optional: "Optional", save: "Save", cancel: "Cancel", removeInventory: "Remove from inventory", restoreInventory: "Restore to inventory", deleteCustom: "Delete seed", customSeedNote: "Custom Lab seed. It has no Grow Guide link until identity is reconciled.", duplicateWarning: "Possible duplicate already in inventory: ", requiredName: "Plant / variety is required.", localOnly: "Stored locally in Garden Labs on this device.",
  },
  es: {
    prototype: "GARDEN LABS · EXPERIMENTAL", title: "Garden Library", labStatus: "Laboratorio activo · User Zero", install: "Instalar",
    kicker: "Garden X prueba aquí antes de producir.",
    heroTitle: "Lo que Garden sabe y lo que tú tienes, juntos sin mezclar su verdad.",
    heroBody: "Garden Library reúne conocimiento de cultivo e inventario personal dentro de Garden Labs. Cada capa conserva su propia fuente de verdad.",
    labProofExperiment: "Experimento aislado", labProofUserZero: "Validación User Zero", labProofSeparation: "Fuentes separadas",
    guideTab: "Guía", seedsTab: "Semillas", guideEyebrow: "GARDEN LIBRARY · GUÍA", guideTitle: "Grow Guide", guideIntro: "Conocimiento estructurado para saber cuándo, dónde y cuánto intervenir en cada cultivo.",
    seedsEyebrow: "GARDEN LIBRARY · SEMILLAS", seedsTitle: "Tus semillas", seedsIntro: "Qué paquetes tienes realmente, su estado aproximado y dónde están. Los cambios de este Lab se guardan solo en este dispositivo.",
    evidenceLegend: "Leyenda de evidencia", sourceBacked: "Respaldado por fuente", gardenAdaptation: "Adaptación de Garden", needsValidation: "Necesita validación",
    searchPlaceholder: "Busca albahaca, basil, lechuga, Jolly Jester…", filterLabel: "Filtros de la guía", library: "BIBLIOTECA DE CULTIVOS USER ZERO", version: "V0.6 · 29 guías · ES/EN · visual + vecinas + inventario",
    allPlants: "Todas", plant: "variedad", plants: "variedades", guide: "ficha", noMatches: "Todavía no hay una variedad que coincida con esa búsqueda.", unavailable: "Guía no disponible", loadError: "No se pudieron cargar los datos del prototipo.", close: "Cerrar guía", avoid: "Evitar", context: "Contexto", confidence: "Confianza",
    confidence_high: "alta", confidence_medium: "media", confidence_pending: "pendiente",
    visualGuide: "Guía visual", visualGuideNote: "Referencias externas elegidas por la acción que enseñan, no como fotos decorativas de la planta.", openSource: "Abrir fuente", sourceLinkOnly: "Ver en la fuente", rightsReview: "Revisar derechos antes de producción", externalReference: "Referencia externa",
    media_photo: "Foto", media_diagram: "Diagrama", media_video: "Video", media_guide: "Guía",
    actions: { thinning: "Raleo", pruning: "Poda", harvest: "Cosecha", flowering: "Floración", hydroponics: "Hidroponía" },
    categories: { herbs: "hierbas", "leafy greens": "hojas verdes", fruiting: "cultivos de fruto", flowers: "flores", alliums: "alliums", "root vegetables": "raíces" },
    sections: { germination: "Germinación", thinning: "Raleo", pruning: "Poda", harvest: "Cosecha", flowering: "Floración / espigado", hydroponics: "Hidroponía", problems: "Problemas comunes" },
    ownedSeed: "En tu inventario de semillas", packetArchived: "Sobre documentado · retirado del inventario activo", packet: "Sobre", germinationRate: "Germinación del sobre", purity: "Pureza", seedCount: "Semillas aprox.", daysToBloom: "Días a floración", daysToHarvest: "Días a cosecha", packetEvidence: "Dato de inventario leído de tu foto del sobre", openInSeeds: "Abrir en Semillas",
    neighbors: "Vecinas", neighborsNote: "Garden prioriza compatibilidad real de cultivo. Una asociación tradicional solo sube de nivel cuando una fuente confiable la respalda.", goodNeighbors: "Buenas vecinas", separateNeighbors: "Mejor separar", noStrongGood: "Todavía no hay coincidencias positivas fuertes.", noStrongBad: "No hay alertas fuertes de separación.", researchPair: "Pareja respaldada por investigación", systemPair: "Inferencia por compatibilidad del sistema", nearbyRole: "Útil cerca en exterior", neighborDisclaimer: "‘Mejor separar’ normalmente significa mala combinación de luz / espacio / raíces / nutrientes; no que una planta envenene químicamente a la otra.",
    addSeed: "+ Añadir semilla", seedSearchPlaceholder: "Busca tomate, basil, Ferry-Morse…", seedInventoryEyebrow: "INVENTARIO USER ZERO", seedStorageNote: "Estado personal local · evidencia del sobre separada", seedPackage: "paquete", seedPackages: "paquetes", noSeedMatches: "No hay paquetes que coincidan con esta vista.",
    seedFilters: { all: "Todas", opened: "Abiertas", unopened: "Sin abrir", low: "Poco inventario", unset: "Sin definir", removed: "Retiradas" },
    seedStatus: { opened: "Abierto", unopened: "Sin abrir", unknown: "Sin definir" },
    quantity: { full: "Full", high: "High", medium: "Medium", low: "Low", almost_empty: "Almost empty", unknown: "Sin definir" },
    locationUnset: "Ubicación sin definir", viewGuide: "Ver guía", editSeed: "Editar inventario", newSeed: "Añadir semilla", personalState: "Estado personal del inventario", personalStateNote: "Estos campos del Lab no reescriben la evidencia del sobre ni el conocimiento de Grow Guide.",
    plantVariety: "Planta / variedad", brand: "Marca", packageStatus: "Estado del paquete", quantityLevel: "Cantidad aproximada", storageLocation: "Ubicación", purchaseYear: "Año de compra", germinationTestDate: "Último test de germinación", germinationResult: "Resultado germinación %", notes: "Notas", optional: "Opcional", save: "Guardar", cancel: "Cancelar", removeInventory: "Quitar del inventario", restoreInventory: "Restaurar al inventario", deleteCustom: "Eliminar semilla", customSeedNote: "Semilla añadida en el Lab. No tiene vínculo a Grow Guide hasta reconciliar su identidad.", duplicateWarning: "Posible duplicado ya en inventario: ", requiredName: "Planta / variedad es obligatorio.", localOnly: "Guardado localmente en Garden Labs en este dispositivo.",
  },
};

const sectionIcons = { germination: "🌱", thinning: "✂️", pruning: "🌿", harvest: "🥬", flowering: "🌸", hydroponics: "💧", problems: "⚠️" };
const evidenceClasses = { source_backed: "source-backed", garden_adaptation: "garden-adaptation", needs_validation: "needs-validation" };
const visualIcons = { photo: "📷", diagram: "✂️", video: "▶", guide: "📖" };

async function init() {
  if (window.GARDEN_LABS_STORAGE_HYDRATE) await window.GARDEN_LABS_STORAGE_HYDRATE(state);
  const [pilotPlantResponse, currentPlantResponse, ownedPlantResponse, sourceResponse, currentSourceResponse, ownedSourceResponse, spanishResponse, ownedSpanishResponse, visualsResponse, inventoryResponse, neighborResponse] = await Promise.all([
    fetch(assetUrl("data/plants.json")),
    fetch(assetUrl("data/plants-current-gardens.json")),
    fetch(assetUrl("data/plants-owned-seeds.json")),
    fetch(assetUrl("data/sources.json")),
    fetch(assetUrl("data/sources-current-gardens.json")),
    fetch(assetUrl("data/sources-owned-seeds.json")),
    fetch(assetUrl("data/translations-es.json")),
    fetch(assetUrl("data/translations-owned-seeds-es.json")),
    fetch(assetUrl("data/visuals.json")),
    fetch(assetUrl("data/seed-inventory.json")),
    fetch(assetUrl("data/neighbor-profiles.json")),
  ]);

  state.plants = [...await pilotPlantResponse.json(), ...await currentPlantResponse.json(), ...await ownedPlantResponse.json()];
  const sources = [...await sourceResponse.json(), ...await currentSourceResponse.json(), ...await ownedSourceResponse.json()];
  state.sources = Object.fromEntries(sources.map((source) => [source.id, source]));
  state.translations = { ...await spanishResponse.json(), ...await ownedSpanishResponse.json() };
  state.visuals = await visualsResponse.json();
  const inventory = await inventoryResponse.json();
  state.seedInventory = Object.fromEntries(inventory.items.map((item) => [item.plantId, item]));
  state.neighborData = await neighborResponse.json();
  bindEvents();
  applyLanguage();
  switchView(state.view, false);
  registerServiceWorker();
}

function bindEvents() {
  refs.searchInput.addEventListener("input", (event) => { state.query = event.target.value.trim().toLowerCase(); renderPlants(); });
  refs.seedSearchInput.addEventListener("input", (event) => { state.seedQuery = event.target.value.trim().toLowerCase(); renderSeeds(); });
  refs.closeDialog.addEventListener("click", () => refs.dialog.close());
  refs.dialog.addEventListener("close", () => { state.activePlantId = null; });
  refs.dialog.addEventListener("click", (event) => { if (event.target === refs.dialog) refs.dialog.close(); });
  refs.closeSeedDialog.addEventListener("click", () => refs.seedDialog.close());
  refs.seedDialog.addEventListener("close", () => { state.activeSeedId = null; });
  refs.seedDialog.addEventListener("click", (event) => { if (event.target === refs.seedDialog) refs.seedDialog.close(); });
  refs.languageButtons.forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.language)));
  [refs.guideTab, refs.seedsTab].forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  refs.addSeedButton.addEventListener("click", () => openSeedEditor(null));
  refs.detail.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-seed-open]");
    if (!jump) return;
    const seedId = jump.dataset.seedOpen;
    refs.dialog.close();
    switchView("seeds");
    openSeedEditor(seedId);
  });
}

function setLanguage(language) {
  if (!ui[language] || state.language === language) return;
  state.language = language;
  localStorage.setItem("growGuideLanguage", language);
  applyLanguage();
}

function applyLanguage() {
  const text = ui[state.language];
  document.documentElement.lang = state.language;
  refs.translatable.forEach((element) => { const key = element.dataset.i18n; if (text[key]) element.textContent = text[key]; });
  refs.searchInput.placeholder = text.searchPlaceholder;
  refs.seedSearchInput.placeholder = text.seedSearchPlaceholder;
  refs.searchInput.closest(".controls")?.setAttribute("aria-label", text.filterLabel);
  document.querySelector(".trust-legend")?.setAttribute("aria-label", text.evidenceLegend);
  refs.closeDialog.setAttribute("aria-label", text.close);
  refs.closeSeedDialog.setAttribute("aria-label", text.cancel);
  refs.languageButtons.forEach((button) => { const active = button.dataset.language === state.language; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
  buildFilters();
  buildSeedFilters();
  renderPlants();
  renderSeeds();
  if (state.activePlantId) {
    const activePlant = state.plants.find((plant) => plant.id === state.activePlantId);
    if (activePlant) refs.detail.innerHTML = buildPlantDetail(activePlant);
  }
  if (state.activeSeedId) {
    const seedId = state.activeSeedId === "__new__" ? null : state.activeSeedId;
    refs.seedDetail.innerHTML = buildSeedEditor(seedId);
    bindSeedEditor(seedId);
  }
}

function switchView(view, persist = true) {
  state.view = view === "seeds" ? "seeds" : "guide";
  refs.guideSurface.hidden = state.view !== "guide";
  refs.seedsSurface.hidden = state.view !== "seeds";
  refs.guideTab.classList.toggle("active", state.view === "guide");
  refs.seedsTab.classList.toggle("active", state.view === "seeds");
  refs.guideTab.setAttribute("aria-pressed", String(state.view === "guide"));
  refs.seedsTab.setAttribute("aria-pressed", String(state.view === "seeds"));
  if (persist) localStorage.setItem("gardenLabsLibraryView", state.view);
  if (state.view === "seeds") renderSeeds();
}

function buildFilters() {
  const text = ui[state.language];
  const categories = ["all", ...new Set(state.plants.map((plant) => plant.category))];
  refs.categoryFilters.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = `filter-chip ${category === state.category ? "active" : ""}`;
    button.type = "button";
    button.textContent = category === "all" ? text.allPlants : (text.categories[category] || category);
    button.addEventListener("click", () => { state.category = category; buildFilters(); renderPlants(); });
    refs.categoryFilters.append(button);
  });
}

function buildSeedFilters() {
  const text = ui[state.language];
  refs.seedFilters.innerHTML = "";
  ["all", "opened", "unopened", "low", "unset", "removed"].forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `seed-filter-chip ${state.seedFilter === filter ? "active" : ""}`;
    button.textContent = text.seedFilters[filter];
    button.addEventListener("click", () => { state.seedFilter = filter; buildSeedFilters(); renderSeeds(); });
    refs.seedFilters.append(button);
  });
}

function getFilteredPlants() {
  return state.plants.filter((plant) => {
    const categoryMatch = state.category === "all" || plant.category === state.category;
    const seed = state.seedInventory[plant.id] || {};
    const haystack = [plant.name, plant.spanishName, plant.scientificName, plant.variety, seed.packetName, ...(seed.aliases || []), ...(plant.tags || [])].join(" ").toLowerCase();
    return categoryMatch && (!state.query || haystack.includes(state.query));
  });
}

function getLocalizedPlant(plant) {
  if (state.language !== "es") return plant;
  const translated = state.translations[plant.id] || {};
  const sections = {};
  Object.entries(plant.sections || {}).forEach(([key, section]) => { sections[key] = { ...section, ...(translated.sections?.[key] || {}) }; });
  const metrics = (plant.metrics || []).map((metric, index) => ({ ...metric, ...(translated.metrics?.[index] || {}) }));
  return { ...plant, ...translated, metrics, sections };
}

function renderPlants() {
  const text = ui[state.language];
  const plants = getFilteredPlants();
  refs.plantGrid.innerHTML = "";
  refs.resultCount.textContent = `${plants.length} ${plants.length === 1 ? text.plant : text.plants}`;
  if (!plants.length) {
    refs.plantGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.noMatches)}</div>`;
    return;
  }
  plants.forEach((plant) => {
    const localized = getLocalizedPlant(plant);
    const primaryName = state.language === "es" ? plant.spanishName : plant.name;
    const secondaryName = state.language === "es" ? plant.name : plant.spanishName;
    const fragment = refs.cardTemplate.content.cloneNode(true);
    fragment.querySelector(".plant-emoji").textContent = plant.emoji;
    fragment.querySelector(".category-pill").textContent = text.categories[plant.category] || plant.category;
    fragment.querySelector(".plant-spanish").textContent = secondaryName;
    fragment.querySelector(".plant-name").textContent = primaryName;
    fragment.querySelector(".plant-scientific").textContent = plant.scientificName;
    fragment.querySelector(".guide-status").textContent = isSeedActive(plant.id) ? `🌰 ${localized.guideCompletion}% ${text.guide}` : `${localized.guideCompletion}% ${text.guide}`;
    fragment.querySelector(".plant-card-button").addEventListener("click", () => openPlant(plant));
    refs.plantGrid.append(fragment);
  });
}

function openPlant(plant) {
  state.activePlantId = plant.id;
  refs.detail.innerHTML = buildPlantDetail(plant);
  refs.dialog.showModal();
  refs.dialog.scrollTop = 0;
}

function buildPlantDetail(plant) {
  const localized = getLocalizedPlant(plant);
  const primaryName = state.language === "es" ? plant.spanishName : plant.name;
  const secondaryName = state.language === "es" ? plant.name : plant.spanishName;
  const metrics = (localized.metrics || []).map((metric) => `<div class="metric-card"><div class="metric-label">${escapeHtml(metric.label)}</div><div class="metric-value">${escapeHtml(metric.value)}</div>${metric.note ? `<div class="metric-note">${escapeHtml(metric.note)}</div>` : ""}</div>`).join("");
  const seedCard = buildSeedInventoryCard(plant.id);
  const neighbors = buildNeighborGuide(plant.id);
  const visuals = buildVisualGuide(plant.id);
  const sections = Object.keys(sectionIcons).filter((key) => localized.sections?.[key]).map((key) => buildSection(localized.sections[key], key, false)).join("");
  return `<section class="detail-hero"><div class="detail-icon">${plant.emoji}</div><div class="detail-title"><p class="plant-spanish">${escapeHtml(secondaryName)}</p><h2>${escapeHtml(primaryName)}</h2><p class="scientific">${escapeHtml(plant.scientificName)}</p></div><p class="detail-summary">${escapeHtml(localized.summary)}</p></section>${seedCard}<section class="quick-facts">${metrics}</section>${neighbors}${visuals}<section class="guide-stack">${sections}</section>`;
}

function buildSeedInventoryCard(plantId) {
  const seed = state.seedInventory[plantId];
  if (!seed) return "";
  const text = ui[state.language];
  const user = state.seedUserState[plantId] || {};
  const archived = Boolean(user.archived);
  const facts = [];
  if (seed.germinationRatePct != null) facts.push(`${text.germinationRate}: ${seed.germinationRatePct}%`);
  if (seed.purityPct != null) facts.push(`${text.purity}: ${seed.purityPct}%`);
  if (seed.approxSeedCount != null) facts.push(`${text.seedCount}: ${seed.approxSeedCount}`);
  if (seed.daysToBloom != null) facts.push(`${text.daysToBloom}: ${seed.daysToBloom}`);
  if (seed.daysToHarvest != null) facts.push(`${text.daysToHarvest}: ${seed.daysToHarvest}`);
  const personal = archived ? text.packetArchived : text.ownedSeed;
  const quantity = text.quantity[user.quantityLevel || "unknown"];
  const packageStatus = text.seedStatus[user.packageStatus || "unknown"];
  return `<section class="seed-inventory-card"><div><p class="eyebrow">🌰 ${escapeHtml(personal)}</p><h3>${escapeHtml(seed.packetName)}</h3><p>${escapeHtml(seed.brand)}${seed.line ? ` · ${escapeHtml(seed.line)}` : ""}${seed.packetWeight ? ` · ${escapeHtml(seed.packetWeight)}` : ""}</p></div>${!archived ? `<div class="seed-facts"><span>${escapeHtml(packageStatus)}</span><span>${escapeHtml(quantity)}</span>${user.storageLocation ? `<span>${escapeHtml(user.storageLocation)}</span>` : ""}</div>` : ""}${facts.length ? `<div class="seed-facts">${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>` : ""}<small>${escapeHtml(text.packetEvidence)}</small>${seed.note ? `<small>${escapeHtml(seed.note)}</small>` : ""}<button type="button" class="inventory-jump" data-seed-open="${escapeAttribute(plantId)}">🌰 ${escapeHtml(text.openInSeeds)} →</button></section>`;
}

function getAllSeedRecords() {
  return [...Object.values(state.seedInventory), ...state.customSeeds];
}

function seedRecordId(seed) {
  return seed.id || seed.plantId;
}

function getSeedById(seedId) {
  return getAllSeedRecords().find((seed) => seedRecordId(seed) === seedId) || null;
}

function isSeedActive(seedId) {
  const seed = state.seedInventory[seedId] || getSeedById(seedId);
  if (!seed) return false;
  return !state.seedUserState[seedRecordId(seed)]?.archived;
}

function mergeSeedRecord(seed) {
  const id = seedRecordId(seed);
  const user = state.seedUserState[id] || {};
  return {
    ...seed,
    id,
    packageStatus: user.packageStatus || "unknown",
    quantityLevel: user.quantityLevel || "unknown",
    storageLocation: user.storageLocation || "",
    purchaseYear: user.purchaseYear || "",
    lastGerminationTestAt: user.lastGerminationTestAt || "",
    lastGerminationResultPct: user.lastGerminationResultPct ?? "",
    userNotes: user.notes || "",
    archived: Boolean(user.archived),
    isCustom: Boolean(seed.id),
  };
}

function getFilteredSeeds() {
  return getAllSeedRecords().map(mergeSeedRecord).filter((seed) => {
    if (state.seedFilter === "removed") {
      if (!seed.archived) return false;
    } else if (seed.archived) {
      return false;
    }
    if (state.seedFilter === "opened" && seed.packageStatus !== "opened") return false;
    if (state.seedFilter === "unopened" && seed.packageStatus !== "unopened") return false;
    if (state.seedFilter === "low" && !["low", "almost_empty"].includes(seed.quantityLevel)) return false;
    if (state.seedFilter === "unset" && seed.packageStatus !== "unknown" && seed.quantityLevel !== "unknown" && seed.storageLocation) return false;
    const plant = seed.plantId ? state.plants.find((item) => item.id === seed.plantId) : null;
    const haystack = [seed.packetName, seed.brand, seed.line, ...(seed.aliases || []), plant?.name, plant?.spanishName, seed.storageLocation].filter(Boolean).join(" ").toLowerCase();
    return !state.seedQuery || haystack.includes(state.seedQuery);
  });
}

function renderSeeds() {
  const text = ui[state.language];
  const seeds = getFilteredSeeds();
  refs.seedGrid.innerHTML = "";
  refs.seedResultCount.textContent = `${seeds.length} ${seeds.length === 1 ? text.seedPackage : text.seedPackages}`;
  if (!seeds.length) {
    refs.seedGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.noSeedMatches)}</div>`;
    return;
  }
  seeds.forEach((seed) => {
    const plant = seed.plantId ? state.plants.find((item) => item.id === seed.plantId) : null;
    const emoji = plant?.emoji || "🌰";
    const statusLabel = seed.archived ? text.seedFilters.removed : text.seedStatus[seed.packageStatus];
    const quantityLabel = text.quantity[seed.quantityLevel];
    const locationLabel = seed.storageLocation || text.locationUnset;
    const article = document.createElement("article");
    article.className = "seed-card";
    article.innerHTML = `<button class="seed-card-main" type="button"><span class="seed-card-emoji">${emoji}</span><span class="seed-card-copy"><h4>${escapeHtml(seed.packetName)}</h4><p>${escapeHtml(seed.brand || text.brand)}${seed.line ? ` · ${escapeHtml(seed.line)}` : ""}</p><span class="seed-status-row"><span class="seed-status-chip ${seed.packageStatus !== "unknown" ? "defined" : ""}">${escapeHtml(statusLabel)}</span><span class="seed-status-chip ${["low", "almost_empty"].includes(seed.quantityLevel) ? "low" : seed.quantityLevel !== "unknown" ? "defined" : ""}">${escapeHtml(quantityLabel)}</span><span class="seed-status-chip ${seed.storageLocation ? "defined" : ""}">⌂ ${escapeHtml(locationLabel)}</span></span></span><span class="seed-card-arrow">→</span></button><div class="seed-card-footer"><small>${seed.isCustom ? escapeHtml(text.localOnly) : escapeHtml(seed.packetWeight || seed.collection || text.packetEvidence)}</small>${plant ? `<button class="seed-link-button" type="button">${escapeHtml(text.viewGuide)} ↗</button>` : ""}</div>`;
    article.querySelector(".seed-card-main").addEventListener("click", () => openSeedEditor(seed.id));
    article.querySelector(".seed-link-button")?.addEventListener("click", (event) => {
      event.stopPropagation();
      switchView("guide");
      openPlant(plant);
    });
    refs.seedGrid.append(article);
  });
}

function openSeedEditor(seedId) {
  state.activeSeedId = seedId || "__new__";
  refs.seedDetail.innerHTML = buildSeedEditor(seedId);
  bindSeedEditor(seedId);
  refs.seedDialog.showModal();
  refs.seedDialog.scrollTop = 0;
}

function buildSeedEditor(seedId) {
  const text = ui[state.language];
  const seed = seedId ? getSeedById(seedId) : null;
  const merged = seed ? mergeSeedRecord(seed) : null;
  const isCustom = Boolean(seed?.id);
  const isNew = !seed;
  const title = isNew ? text.newSeed : text.editSeed;
  const packetPanel = seed && !isCustom ? buildPacketEvidencePanel(seed) : "";
  const nameValue = seed?.packetName || "";
  const brandValue = seed?.brand || "";
  const packageStatus = merged?.packageStatus || "unknown";
  const quantityLevel = merged?.quantityLevel || "unknown";
  const storageLocation = merged?.storageLocation || "";
  const purchaseYear = merged?.purchaseYear || "";
  const germDate = merged?.lastGerminationTestAt || "";
  const germResult = merged?.lastGerminationResultPct ?? "";
  const notes = merged?.userNotes || "";
  const archived = merged?.archived || false;
  const plant = seed?.plantId ? state.plants.find((item) => item.id === seed.plantId) : null;

  const identityFields = isNew || isCustom ? `<div class="seed-form-grid"><div class="seed-field"><label for="seedName">${escapeHtml(text.plantVariety)}</label><input id="seedName" name="seedName" value="${escapeAttribute(nameValue)}" autocomplete="off" required /></div><div class="seed-field"><label for="seedBrand">${escapeHtml(text.brand)}</label><input id="seedBrand" name="seedBrand" value="${escapeAttribute(brandValue)}" autocomplete="off" /></div></div><div id="duplicateHint" class="duplicate-hint"></div>` : "";

  return `<div class="seed-editor-header"><p class="eyebrow">GARDEN LIBRARY · SEEDS</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text.personalStateNote)}</p></div>${packetPanel}<form id="seedForm" class="seed-form">${identityFields}<div class="seed-form-grid"><div class="seed-field"><label for="packageStatus">${escapeHtml(text.packageStatus)}</label><select id="packageStatus" name="packageStatus">${selectOptions(text.seedStatus, packageStatus)}</select></div><div class="seed-field"><label for="quantityLevel">${escapeHtml(text.quantityLevel)}</label><select id="quantityLevel" name="quantityLevel">${selectOptions(text.quantity, quantityLevel)}</select></div><div class="seed-field full"><label for="storageLocation">${escapeHtml(text.storageLocation)}</label><input id="storageLocation" name="storageLocation" value="${escapeAttribute(storageLocation)}" placeholder="${escapeAttribute(text.optional)}" /></div><div class="seed-field"><label for="purchaseYear">${escapeHtml(text.purchaseYear)}</label><input id="purchaseYear" name="purchaseYear" type="number" min="1900" max="2100" value="${escapeAttribute(purchaseYear)}" placeholder="${escapeAttribute(text.optional)}" /></div><div class="seed-field"><label for="germinationTest">${escapeHtml(text.germinationTestDate)}</label><input id="germinationTest" name="germinationTest" type="date" value="${escapeAttribute(germDate)}" /></div><div class="seed-field"><label for="germinationResult">${escapeHtml(text.germinationResult)}</label><input id="germinationResult" name="germinationResult" type="number" min="0" max="100" value="${escapeAttribute(germResult)}" placeholder="${escapeAttribute(text.optional)}" /></div><div class="seed-field full"><label for="seedNotes">${escapeHtml(text.notes)}</label><textarea id="seedNotes" name="seedNotes" placeholder="${escapeAttribute(text.optional)}">${escapeHtml(notes)}</textarea></div></div>${isCustom ? `<p class="seed-form-note">${escapeHtml(text.customSeedNote)}</p>` : `<p class="seed-form-note">${escapeHtml(text.localOnly)}</p>`}<div class="seed-form-actions"><div>${seed ? archived ? `<button id="restoreSeed" class="seed-action-button secondary" type="button">${escapeHtml(text.restoreInventory)}</button>` : `<button id="removeSeed" class="seed-danger-button" type="button">${escapeHtml(isCustom ? text.deleteCustom : text.removeInventory)}</button>` : ""}</div><div>${plant ? `<button id="editorGuideLink" class="seed-action-button secondary" type="button">${escapeHtml(text.viewGuide)}</button>` : ""}<button id="cancelSeed" class="seed-action-button secondary" type="button">${escapeHtml(text.cancel)}</button><button class="seed-action-button" type="submit">${escapeHtml(text.save)}</button></div></div></form>`;
}

function buildPacketEvidencePanel(seed) {
  const text = ui[state.language];
  const facts = [];
  if (seed.line) facts.push(seed.line);
  if (seed.packetWeight) facts.push(seed.packetWeight);
  if (seed.collection) facts.push(seed.collection);
  if (seed.germinationRatePct != null) facts.push(`${text.germinationRate}: ${seed.germinationRatePct}%`);
  if (seed.purityPct != null) facts.push(`${text.purity}: ${seed.purityPct}%`);
  if (seed.approxSeedCount != null) facts.push(`${text.seedCount}: ${seed.approxSeedCount}`);
  return `<section class="packet-evidence-panel"><strong>${escapeHtml(seed.packetName)}</strong><p>${escapeHtml(seed.brand)}${facts.length ? ` · ${escapeHtml(facts.join(" · "))}` : ""}</p><small>${escapeHtml(text.packetEvidence)}. ${escapeHtml(text.personalStateNote)}</small></section>`;
}

function bindSeedEditor(seedId) {
  const text = ui[state.language];
  const form = refs.seedDetail.querySelector("#seedForm");
  const seed = seedId ? getSeedById(seedId) : null;
  const nameInput = refs.seedDetail.querySelector("#seedName");
  const duplicateHint = refs.seedDetail.querySelector("#duplicateHint");

  const refreshDuplicateHint = () => {
    if (!nameInput || !duplicateHint) return;
    const duplicate = findDuplicateSeed(nameInput.value, seedId);
    duplicateHint.classList.toggle("visible", Boolean(duplicate));
    duplicateHint.textContent = duplicate ? `${text.duplicateWarning}${duplicate.packetName} · ${duplicate.brand || ""}` : "";
  };
  nameInput?.addEventListener("input", refreshDuplicateHint);
  refreshDuplicateHint();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSeedEditor(seedId, form);
  });
  refs.seedDetail.querySelector("#cancelSeed")?.addEventListener("click", () => refs.seedDialog.close());
  refs.seedDetail.querySelector("#removeSeed")?.addEventListener("click", () => removeSeed(seedId));
  refs.seedDetail.querySelector("#restoreSeed")?.addEventListener("click", () => restoreSeed(seedId));
  refs.seedDetail.querySelector("#editorGuideLink")?.addEventListener("click", () => {
    const plant = seed?.plantId ? state.plants.find((item) => item.id === seed.plantId) : null;
    if (!plant) return;
    refs.seedDialog.close();
    switchView("guide");
    openPlant(plant);
  });
}

function saveSeedEditor(seedId, form) {
  const data = new FormData(form);
  let id = seedId;
  let seed = id ? getSeedById(id) : null;
  if (!seed) {
    const packetName = String(data.get("seedName") || "").trim();
    if (!packetName) {
      form.querySelector("#seedName")?.focus();
      return;
    }
    id = `custom-${Date.now()}`;
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
    purchaseYear: String(data.get("purchaseYear") || "").trim(),
    lastGerminationTestAt: String(data.get("germinationTest") || ""),
    lastGerminationResultPct: data.get("germinationResult") === "" ? "" : Number(data.get("germinationResult")),
    notes: String(data.get("seedNotes") || "").trim(),
    archived: false,
  };
  persistSeedLabState();
  refs.seedDialog.close();
  renderSeeds();
  renderPlants();
}

function removeSeed(seedId) {
  const seed = getSeedById(seedId);
  if (!seed) return;
  if (seed.id) {
    state.customSeeds = state.customSeeds.filter((item) => item.id !== seedId);
    delete state.seedUserState[seedId];
  } else {
    state.seedUserState[seedId] = { ...(state.seedUserState[seedId] || {}), archived: true };
  }
  persistSeedLabState();
  refs.seedDialog.close();
  renderSeeds();
  renderPlants();
}

function restoreSeed(seedId) {
  state.seedUserState[seedId] = { ...(state.seedUserState[seedId] || {}), archived: false };
  persistSeedLabState();
  refs.seedDialog.close();
  state.seedFilter = "all";
  buildSeedFilters();
  renderSeeds();
  renderPlants();
}

function findDuplicateSeed(value, editingId) {
  const normalized = normalizeSeedName(value);
  if (!normalized) return null;
  return getAllSeedRecords().map(mergeSeedRecord).find((seed) => !seed.archived && seed.id !== editingId && normalizeSeedName(seed.packetName) === normalized) || null;
}

function normalizeSeedName(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function persistSeedLabState() {
  localStorage.setItem("gardenLabsSeedStateV1", JSON.stringify(state.seedUserState));
  localStorage.setItem("gardenLabsCustomSeedsV1", JSON.stringify(state.customSeeds));
}

function selectOptions(labels, selected) {
  return Object.entries(labels).map(([value, label]) => `<option value="${escapeAttribute(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function buildNeighborGuide(plantId) {
  const profile = state.neighborData.profiles?.[plantId];
  if (!profile) return "";
  const text = ui[state.language];
  const ranked = state.plants
    .filter((other) => other.id !== plantId && state.neighborData.profiles?.[other.id])
    .map((other) => scoreNeighbor(plantId, other.id))
    .sort((a, b) => b.score - a.score);
  const good = ranked.filter((item) => item.score >= 2).slice(0, 4);
  const separate = [...ranked].sort((a, b) => a.score - b.score).filter((item) => item.score <= -2).slice(0, 4);
  return `<section class="neighbor-guide"><div class="neighbor-heading"><div><p class="eyebrow">↔ ${escapeHtml(text.neighbors)}</p><h3>${escapeHtml(text.goodNeighbors)} / ${escapeHtml(text.separateNeighbors)}</h3></div><p>${escapeHtml(text.neighborsNote)}</p></div><div class="neighbor-columns"><div class="neighbor-column good"><h4>✓ ${escapeHtml(text.goodNeighbors)}</h4>${good.length ? good.map((item) => buildNeighborItem(item)).join("") : `<p class="muted">${escapeHtml(text.noStrongGood)}</p>`}</div><div class="neighbor-column separate"><h4>↔ ${escapeHtml(text.separateNeighbors)}</h4>${separate.length ? separate.map((item) => buildNeighborItem(item)).join("") : `<p class="muted">${escapeHtml(text.noStrongBad)}</p>`}</div></div><p class="neighbor-disclaimer">${escapeHtml(text.neighborDisclaimer)}</p></section>`;
}

function scoreNeighbor(aId, bId) {
  const a = state.neighborData.profiles[aId];
  const b = state.neighborData.profiles[bId];
  let score = 0;
  const reasons = [];
  let basis = "system";
  const explicit = (state.neighborData.meta?.researchPairs || []).find((pair) => (pair.a === aId && pair.b === bId) || (pair.a === bId && pair.b === aId));
  if (explicit) {
    score += 4;
    basis = "research";
    reasons.push(state.language === "es" ? "Existe una relación de companion planting respaldada por Extension." : "An Extension source supports this companion relationship.");
  }
  if (a.climate === b.climate) {
    score += 2;
    reasons.push(state.language === "es" ? "Prefieren una temporada térmica parecida." : "They prefer a similar temperature season.");
  } else if (a.climate === "moderate" || b.climate === "moderate") score += 1;
  else {
    score -= 2;
    reasons.push(state.language === "es" ? "Uno es de clima cálido y el otro de clima fresco." : "One is warm-season and the other cool-season.");
  }
  const nutrientGap = Math.abs(a.nutrient - b.nutrient);
  if (nutrientGap === 0) score += 1;
  if (nutrientGap >= 2) {
    score -= 2;
    reasons.push(state.language === "es" ? "La demanda de nutrientes es muy distinta para compartir un depósito pequeño." : "Their nutrient demand is very different for a small shared reservoir.");
  }
  const heightGap = Math.abs(a.height - b.height);
  if (heightGap >= 2) {
    score -= 2;
    reasons.push(state.language === "es" ? "La diferencia de altura aumenta el riesgo de sombra." : "The height gap increases shading risk.");
  }
  if (a.spread >= 4 || b.spread >= 4) {
    score -= 2;
    reasons.push(state.language === "es" ? "Una de las plantas ocupa muchísimo espacio lateral." : "One plant has a very large horizontal footprint.");
  } else if (Math.max(a.spread, b.spread) >= 3 && Math.min(a.spread, b.spread) <= 1) score -= 1;
  if (a.root <= 2 && b.root <= 2 && Math.abs(a.root - b.root) <= 1) score += 1;
  if ((a.traits.includes("giant") || b.traits.includes("giant")) && !(a.traits.includes("giant") && b.traits.includes("giant"))) score -= 2;
  if ((a.traits.includes("ornamental-only") && b.traits.includes("edible")) || (b.traits.includes("ornamental-only") && a.traits.includes("edible"))) {
    score -= 1;
    reasons.push(state.language === "es" ? "Conviene separar un ornamental no comestible de zonas de cosecha culinaria." : "Keeping a non-edible ornamental away from culinary harvest zones is cleaner and safer.");
  }
  const roleA = state.neighborData.meta?.beneficialRoles?.[aId];
  const roleB = state.neighborData.meta?.beneficialRoles?.[bId];
  if ((roleA && b.traits.includes("edible")) || (roleB && a.traits.includes("edible"))) {
    score += 1;
    if (basis !== "research") basis = "nearby";
    reasons.push(state.language === "es" ? "Puede aportar valor cerca en exterior por polinizadores o insectos benéficos." : "It can be useful nearby outdoors for pollinators or beneficial insects.");
  }
  if (!reasons.length) reasons.push(state.language === "es" ? "Compatibilidad calculada por tamaño, raíces y demanda del cultivo." : "Compatibility is calculated from size, roots and crop demand.");
  return { plant: state.plants.find((plant) => plant.id === bId), score, reasons: reasons.slice(0, 2), basis, explicit };
}

function buildNeighborItem(item) {
  const text = ui[state.language];
  const plant = item.plant;
  const primaryName = state.language === "es" ? plant.spanishName : plant.name;
  const label = item.basis === "research" ? text.researchPair : item.basis === "nearby" ? text.nearbyRole : text.systemPair;
  const source = item.explicit ? state.sources[item.explicit.sourceId] : null;
  return `<article class="neighbor-item"><div class="neighbor-name"><span>${plant.emoji}</span><strong>${escapeHtml(primaryName)}</strong></div><p>${escapeHtml(item.reasons.join(" "))}</p><div class="neighbor-meta"><span>${escapeHtml(label)}</span>${source ? `<a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher)} ↗</a>` : ""}</div></article>`;
}

function buildVisualGuide(plantId) {
  const items = state.visuals[plantId] || [];
  if (!items.length) return "";
  const text = ui[state.language];
  const cards = items.map((item) => buildVisualCard(item)).join("");
  return `<section class="visual-guide"><div class="visual-guide-heading"><div><p class="eyebrow">${escapeHtml(text.externalReference)}</p><h3>${escapeHtml(text.visualGuide)}</h3></div><p>${escapeHtml(text.visualGuideNote)}</p></div><div class="visual-grid">${cards}</div></section>`;
}

function buildVisualCard(item) {
  const text = ui[state.language];
  const localizedTitle = item.title?.[state.language] || item.title?.en || "";
  const localizedDescription = item.description?.[state.language] || item.description?.en || "";
  const mediaLabel = text[`media_${item.mediaType}`] || item.mediaType;
  const actionLabel = text.actions[item.action] || item.action;
  const rightsLabel = item.rightsStatus === "review_before_production" ? text.rightsReview : text.sourceLinkOnly;
  const placeholder = `<div class="visual-placeholder" aria-hidden="true"><span>${visualIcons[item.mediaType] || "↗"}</span><small>${escapeHtml(mediaLabel)}</small></div>`;
  const media = item.thumbnailUrl
    ? `${placeholder}<img class="visual-thumb" src="${escapeAttribute(item.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="this.previousElementSibling.style.display='none'" onerror="this.remove()" />`
    : placeholder;
  return `<article class="visual-card"><a class="visual-media" href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noreferrer">${media}<span class="visual-action">${escapeHtml(actionLabel)}</span></a><div class="visual-card-body"><div class="visual-meta"><span>${escapeHtml(mediaLabel)}</span><span>·</span><span>${escapeHtml(item.sourceName)}</span></div><h4>${escapeHtml(localizedTitle)}</h4><p>${escapeHtml(localizedDescription)}</p><div class="visual-credit">${escapeHtml(item.credit || item.sourceName)}</div><div class="visual-card-footer"><span class="rights-note">${escapeHtml(rightsLabel)}</span><a href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(text.openSource)} ↗</a></div></div></article>`;
}

function buildSection(section, key, open = false) {
  const text = ui[state.language];
  const className = evidenceClasses[section.evidenceType] || evidenceClasses.needs_validation;
  const evidenceLabel = section.evidenceType === "source_backed" ? text.sourceBacked : section.evidenceType === "garden_adaptation" ? text.gardenAdaptation : text.needsValidation;
  const confidence = text[`confidence_${section.confidence}`] || section.confidence || text.confidence_pending;
  const items = (section.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const warnings = (section.avoid || []).map((item) => `<li><strong>${escapeHtml(text.avoid)}:</strong> ${escapeHtml(item)}</li>`).join("");
  const sourceLinks = (section.sourceIds || []).map((id) => state.sources[id]).filter(Boolean).map((source) => `<a class="source-link" href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher)} · ${escapeHtml(source.title)}</a>`).join("");
  return `<details class="section-card" ${open ? "open" : ""}><summary><span class="section-icon">${sectionIcons[key]}</span><span><h3>${escapeHtml(text.sections[key])}</h3><span class="section-subtitle">${escapeHtml(section.short)}</span></span></summary><div class="section-body"><p>${escapeHtml(section.guidance)}</p>${items ? `<ul>${items}</ul>` : ""}${warnings ? `<ul>${warnings}</ul>` : ""}${section.context ? `<p><strong>${escapeHtml(text.context)}:</strong> ${escapeHtml(section.context)}</p>` : ""}<div class="evidence-row"><span class="evidence-chip ${className}">● ${escapeHtml(evidenceLabel)}</span><span class="evidence-chip">${escapeHtml(text.confidence)}: ${escapeHtml(confidence)}</span></div>${sourceLinks ? `<div class="source-links">${sourceLinks}</div>` : ""}</div></details>`;
}

function readLocalJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function escapeAttribute(value = "") { return escapeHtml(value); }
function registerServiceWorker() { if (!window.GROW_GUIDE_DISABLE_SW && "serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {}); }

let deferredInstallPrompt;
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt = event; refs.installButton.hidden = false; });
refs.installButton.addEventListener("click", async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; refs.installButton.hidden = true; });

init().catch((error) => {
  console.error(error);
  const text = ui[state.language];
  refs.resultCount.textContent = text.unavailable;
  refs.plantGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.loadError)}</div>`;
  refs.seedResultCount.textContent = text.unavailable;
  refs.seedGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.loadError)}</div>`;
});
