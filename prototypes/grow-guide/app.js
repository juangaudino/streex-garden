const state = {
  plants: [],
  sources: {},
  translations: {},
  visuals: {},
  seedInventory: {},
  neighborData: { meta: {}, profiles: {} },
  query: "",
  category: "all",
  language: localStorage.getItem("growGuideLanguage") || "es",
  activePlantId: null,
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
};

const ui = {
  en: {
    prototype: "GARDEN X · PROTOTYPE", title: "Grow Guide", install: "Install",
    kicker: "Knowledge that knows its limits.",
    heroTitle: "Know what to do with the plant in front of you.",
    heroBody: "Structured guidance for thinning, pruning, harvesting and hydroponic care — with evidence kept separate from Garden adaptations.",
    evidenceLegend: "Evidence legend", sourceBacked: "Source-backed", gardenAdaptation: "Garden adaptation", needsValidation: "Needs validation",
    searchPlaceholder: "Search basil, albahaca, lettuce, Jolly Jester…", filterLabel: "Guide filters", library: "USER ZERO SEED LIBRARY", version: "V0.5 · 29 owned seeds · ES/EN · visual + neighbors",
    allPlants: "All seeds", plant: "seed variety", plants: "seed varieties", guide: "guide", noMatches: "No seed variety matches that search yet.", unavailable: "Guide unavailable", loadError: "The prototype data could not be loaded.", close: "Close guide", avoid: "Avoid", context: "Context", confidence: "Confidence",
    confidence_high: "high", confidence_medium: "medium", confidence_pending: "pending",
    visualGuide: "Visual guide", visualGuideNote: "External references selected for the action itself — not decorative plant photos.", openSource: "Open source", sourceLinkOnly: "Open at source", rightsReview: "Rights review before production", externalReference: "External reference",
    media_photo: "Photo", media_diagram: "Diagram", media_video: "Video", media_guide: "Guide",
    actions: { thinning: "Thinning", pruning: "Pruning", harvest: "Harvest", flowering: "Flowering", hydroponics: "Hydroponics" },
    categories: { herbs: "herbs", "leafy greens": "leafy greens", fruiting: "fruiting", flowers: "flowers", alliums: "alliums", "root vegetables": "root vegetables" },
    sections: { germination: "Germination", thinning: "Thinning", pruning: "Pruning", harvest: "Harvest", flowering: "Flowering / bolting", hydroponics: "Hydroponics", problems: "Common issues" },
    ownedSeed: "In your seed collection", packet: "Packet", germinationRate: "Packet germination rate", purity: "Purity", seedCount: "Approx. seeds", daysToBloom: "Days to bloom", daysToHarvest: "Days to harvest", packetEvidence: "Inventory fact from your packet photo",
    neighbors: "Neighbors", neighborsNote: "Garden scores real growing compatibility first. A traditional companion claim is only promoted when a credible source supports it.", goodNeighbors: "Good neighbors", separateNeighbors: "Better separate", noStrongGood: "No strong positive matches yet.", noStrongBad: "No strong separation flags yet.", researchPair: "Research-backed companion pair", systemPair: "System-fit inference", nearbyRole: "Useful nearby outdoors", neighborDisclaimer: "‘Better separate’ usually means poor light / space / root / nutrient fit — not that one plant chemically harms the other.",
  },
  es: {
    prototype: "GARDEN X · PROTOTIPO", title: "Grow Guide", install: "Instalar",
    kicker: "Conocimiento que sabe dónde están sus límites.",
    heroTitle: "Sabe qué hacer con la planta que tienes delante.",
    heroBody: "Guía estructurada para raleo, poda, cosecha y manejo hidropónico, manteniendo la evidencia separada de las adaptaciones de Garden.",
    evidenceLegend: "Leyenda de evidencia", sourceBacked: "Respaldado por fuente", gardenAdaptation: "Adaptación de Garden", needsValidation: "Necesita validación",
    searchPlaceholder: "Busca albahaca, basil, lechuga, Jolly Jester…", filterLabel: "Filtros de la guía", library: "BIBLIOTECA DE SEMILLAS USER ZERO", version: "V0.5 · 29 semillas disponibles · ES/EN · visual + vecinas",
    allPlants: "Todas", plant: "variedad", plants: "variedades", guide: "ficha", noMatches: "Todavía no hay una variedad que coincida con esa búsqueda.", unavailable: "Guía no disponible", loadError: "No se pudieron cargar los datos del prototipo.", close: "Cerrar guía", avoid: "Evitar", context: "Contexto", confidence: "Confianza",
    confidence_high: "alta", confidence_medium: "media", confidence_pending: "pendiente",
    visualGuide: "Guía visual", visualGuideNote: "Referencias externas elegidas por la acción que enseñan, no como fotos decorativas de la planta.", openSource: "Abrir fuente", sourceLinkOnly: "Ver en la fuente", rightsReview: "Revisar derechos antes de producción", externalReference: "Referencia externa",
    media_photo: "Foto", media_diagram: "Diagrama", media_video: "Video", media_guide: "Guía",
    actions: { thinning: "Raleo", pruning: "Poda", harvest: "Cosecha", flowering: "Floración", hydroponics: "Hidroponía" },
    categories: { herbs: "hierbas", "leafy greens": "hojas verdes", fruiting: "cultivos de fruto", flowers: "flores", alliums: "alliums", "root vegetables": "raíces" },
    sections: { germination: "Germinación", thinning: "Raleo", pruning: "Poda", harvest: "Cosecha", flowering: "Floración / espigado", hydroponics: "Hidroponía", problems: "Problemas comunes" },
    ownedSeed: "Disponible en tus semillas", packet: "Sobre", germinationRate: "Germinación del sobre", purity: "Pureza", seedCount: "Semillas aprox.", daysToBloom: "Días a floración", daysToHarvest: "Días a cosecha", packetEvidence: "Dato de inventario leído de tu foto del sobre",
    neighbors: "Vecinas", neighborsNote: "Garden prioriza compatibilidad real de cultivo. Una asociación tradicional solo sube de nivel cuando una fuente confiable la respalda.", goodNeighbors: "Buenas vecinas", separateNeighbors: "Mejor separar", noStrongGood: "Todavía no hay coincidencias positivas fuertes.", noStrongBad: "No hay alertas fuertes de separación.", researchPair: "Pareja respaldada por investigación", systemPair: "Inferencia por compatibilidad del sistema", nearbyRole: "Útil cerca en exterior", neighborDisclaimer: "‘Mejor separar’ normalmente significa mala combinación de luz / espacio / raíces / nutrientes; no que una planta envenene químicamente a la otra.",
  },
};

const sectionIcons = { germination: "🌱", thinning: "✂️", pruning: "🌿", harvest: "🥬", flowering: "🌸", hydroponics: "💧", problems: "⚠️" };
const evidenceClasses = { source_backed: "source-backed", garden_adaptation: "garden-adaptation", needs_validation: "needs-validation" };
const visualIcons = { photo: "📷", diagram: "✂️", video: "▶", guide: "📖" };

async function init() {
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
  registerServiceWorker();
}

function bindEvents() {
  refs.searchInput.addEventListener("input", (event) => { state.query = event.target.value.trim().toLowerCase(); renderPlants(); });
  refs.closeDialog.addEventListener("click", () => refs.dialog.close());
  refs.dialog.addEventListener("close", () => { state.activePlantId = null; });
  refs.dialog.addEventListener("click", (event) => { if (event.target === refs.dialog) refs.dialog.close(); });
  refs.languageButtons.forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.language)));
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
  refs.searchInput.closest(".controls")?.setAttribute("aria-label", text.filterLabel);
  document.querySelector(".trust-legend")?.setAttribute("aria-label", text.evidenceLegend);
  refs.closeDialog.setAttribute("aria-label", text.close);
  refs.languageButtons.forEach((button) => { const active = button.dataset.language === state.language; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
  buildFilters(); renderPlants();
  if (state.activePlantId) { const activePlant = state.plants.find((plant) => plant.id === state.activePlantId); if (activePlant) refs.detail.innerHTML = buildPlantDetail(activePlant); }
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
  const text = ui[state.language]; const plants = getFilteredPlants(); refs.plantGrid.innerHTML = "";
  refs.resultCount.textContent = `${plants.length} ${plants.length === 1 ? text.plant : text.plants}`;
  if (!plants.length) { refs.plantGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.noMatches)}</div>`; return; }
  plants.forEach((plant) => {
    const localized = getLocalizedPlant(plant); const primaryName = state.language === "es" ? plant.spanishName : plant.name; const secondaryName = state.language === "es" ? plant.name : plant.spanishName;
    const fragment = refs.cardTemplate.content.cloneNode(true);
    fragment.querySelector(".plant-emoji").textContent = plant.emoji;
    fragment.querySelector(".category-pill").textContent = text.categories[plant.category] || plant.category;
    fragment.querySelector(".plant-spanish").textContent = secondaryName;
    fragment.querySelector(".plant-name").textContent = primaryName;
    fragment.querySelector(".plant-scientific").textContent = plant.scientificName;
    fragment.querySelector(".guide-status").textContent = state.seedInventory[plant.id] ? `🌱 ${localized.guideCompletion}% ${text.guide}` : `${localized.guideCompletion}% ${text.guide}`;
    fragment.querySelector(".plant-card-button").addEventListener("click", () => openPlant(plant));
    refs.plantGrid.append(fragment);
  });
}

function openPlant(plant) { state.activePlantId = plant.id; refs.detail.innerHTML = buildPlantDetail(plant); refs.dialog.showModal(); refs.dialog.scrollTop = 0; }

function buildPlantDetail(plant) {
  const localized = getLocalizedPlant(plant); const primaryName = state.language === "es" ? plant.spanishName : plant.name; const secondaryName = state.language === "es" ? plant.name : plant.spanishName;
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
  const facts = [];
  if (seed.germinationRatePct != null) facts.push(`${text.germinationRate}: ${seed.germinationRatePct}%`);
  if (seed.purityPct != null) facts.push(`${text.purity}: ${seed.purityPct}%`);
  if (seed.approxSeedCount != null) facts.push(`${text.seedCount}: ${seed.approxSeedCount}`);
  if (seed.daysToBloom != null) facts.push(`${text.daysToBloom}: ${seed.daysToBloom}`);
  if (seed.daysToHarvest != null) facts.push(`${text.daysToHarvest}: ${seed.daysToHarvest}`);
  return `<section class="seed-inventory-card"><div><p class="eyebrow">🌱 ${escapeHtml(text.ownedSeed)}</p><h3>${escapeHtml(seed.packetName)}</h3><p>${escapeHtml(seed.brand)}${seed.line ? ` · ${escapeHtml(seed.line)}` : ""}${seed.packetWeight ? ` · ${escapeHtml(seed.packetWeight)}` : ""}</p></div>${facts.length ? `<div class="seed-facts">${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>` : ""}<small>${escapeHtml(text.packetEvidence)}</small>${seed.note ? `<small>${escapeHtml(seed.note)}</small>` : ""}</section>`;
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
  const a = state.neighborData.profiles[aId]; const b = state.neighborData.profiles[bId];
  let score = 0; const reasons = []; let basis = "system";
  const explicit = (state.neighborData.meta?.researchPairs || []).find((pair) => (pair.a === aId && pair.b === bId) || (pair.a === bId && pair.b === aId));
  if (explicit) { score += 4; basis = "research"; reasons.push(state.language === "es" ? "Existe una relación de companion planting respaldada por Extension." : "An Extension source supports this companion relationship."); }

  if (a.climate === b.climate) { score += 2; reasons.push(state.language === "es" ? "Prefieren una temporada térmica parecida." : "They prefer a similar temperature season."); }
  else if (a.climate === "moderate" || b.climate === "moderate") score += 1;
  else { score -= 2; reasons.push(state.language === "es" ? "Uno es de clima cálido y el otro de clima fresco." : "One is warm-season and the other cool-season."); }

  const nutrientGap = Math.abs(a.nutrient - b.nutrient);
  if (nutrientGap === 0) score += 1;
  if (nutrientGap >= 2) { score -= 2; reasons.push(state.language === "es" ? "La demanda de nutrientes es muy distinta para compartir un depósito pequeño." : "Their nutrient demand is very different for a small shared reservoir."); }

  const heightGap = Math.abs(a.height - b.height);
  if (heightGap >= 2) { score -= 2; reasons.push(state.language === "es" ? "La diferencia de altura aumenta el riesgo de sombra." : "The height gap increases shading risk."); }
  if (a.spread >= 4 || b.spread >= 4) { score -= 2; reasons.push(state.language === "es" ? "Una de las plantas ocupa muchísimo espacio lateral." : "One plant has a very large horizontal footprint."); }
  else if (Math.max(a.spread, b.spread) >= 3 && Math.min(a.spread, b.spread) <= 1) score -= 1;
  if (a.root <= 2 && b.root <= 2 && Math.abs(a.root - b.root) <= 1) score += 1;
  if ((a.traits.includes("giant") || b.traits.includes("giant")) && !(a.traits.includes("giant") && b.traits.includes("giant"))) score -= 2;
  if ((a.traits.includes("ornamental-only") && b.traits.includes("edible")) || (b.traits.includes("ornamental-only") && a.traits.includes("edible"))) { score -= 1; reasons.push(state.language === "es" ? "Conviene separar un ornamental no comestible de zonas de cosecha culinaria." : "Keeping a non-edible ornamental away from culinary harvest zones is cleaner and safer."); }

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
  const text = ui[state.language]; const plant = item.plant;
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
  const media = item.thumbnailUrl
    ? `<img class="visual-thumb" src="${escapeAttribute(item.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.visual-media').classList.add('visual-media--failed');this.remove();" />`
    : `<div class="visual-placeholder" aria-hidden="true"><span>${visualIcons[item.mediaType] || "↗"}</span><small>${escapeHtml(mediaLabel)}</small></div>`;
  return `<article class="visual-card"><a class="visual-media" href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noreferrer">${media}<span class="visual-action">${escapeHtml(actionLabel)}</span></a><div class="visual-card-body"><div class="visual-meta"><span>${escapeHtml(mediaLabel)}</span><span>·</span><span>${escapeHtml(item.sourceName)}</span></div><h4>${escapeHtml(localizedTitle)}</h4><p>${escapeHtml(localizedDescription)}</p><div class="visual-credit">${escapeHtml(item.credit || item.sourceName)}</div><div class="visual-card-footer"><span class="rights-note">${escapeHtml(rightsLabel)}</span><a href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(text.openSource)} ↗</a></div></div></article>`;
}

function buildSection(section, key, open = false) {
  const text = ui[state.language]; const className = evidenceClasses[section.evidenceType] || evidenceClasses.needs_validation;
  const evidenceLabel = section.evidenceType === "source_backed" ? text.sourceBacked : section.evidenceType === "garden_adaptation" ? text.gardenAdaptation : text.needsValidation;
  const confidence = text[`confidence_${section.confidence}`] || section.confidence || text.confidence_pending;
  const items = (section.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const warnings = (section.avoid || []).map((item) => `<li><strong>${escapeHtml(text.avoid)}:</strong> ${escapeHtml(item)}</li>`).join("");
  const sourceLinks = (section.sourceIds || []).map((id) => state.sources[id]).filter(Boolean).map((source) => `<a class="source-link" href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher)} · ${escapeHtml(source.title)}</a>`).join("");
  return `<details class="section-card" ${open ? "open" : ""}><summary><span class="section-icon">${sectionIcons[key]}</span><span><h3>${escapeHtml(text.sections[key])}</h3><span class="section-subtitle">${escapeHtml(section.short)}</span></span></summary><div class="section-body"><p>${escapeHtml(section.guidance)}</p>${items ? `<ul>${items}</ul>` : ""}${warnings ? `<ul>${warnings}</ul>` : ""}${section.context ? `<p><strong>${escapeHtml(text.context)}:</strong> ${escapeHtml(section.context)}</p>` : ""}<div class="evidence-row"><span class="evidence-chip ${className}">● ${escapeHtml(evidenceLabel)}</span><span class="evidence-chip">${escapeHtml(text.confidence)}: ${escapeHtml(confidence)}</span></div>${sourceLinks ? `<div class="source-links">${sourceLinks}</div>` : ""}</div></details>`;
}

function escapeHtml(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttribute(value = "") { return escapeHtml(value); }
function registerServiceWorker() { if (!window.GROW_GUIDE_DISABLE_SW && "serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {}); }

let deferredInstallPrompt;
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt = event; refs.installButton.hidden = false; });
refs.installButton.addEventListener("click", async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; refs.installButton.hidden = true; });

init().catch((error) => { console.error(error); const text = ui[state.language]; refs.resultCount.textContent = text.unavailable; refs.plantGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.loadError)}</div>`; });
