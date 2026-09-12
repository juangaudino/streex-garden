const state = {
  plants: [],
  sources: {},
  translations: {},
  query: "",
  category: "all",
  language: localStorage.getItem("growGuideLanguage") || "es",
  activePlantId: null,
};

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
    prototype: "GARDEN X · PROTOTYPE",
    title: "Grow Guide",
    install: "Install",
    kicker: "Knowledge that knows its limits.",
    heroTitle: "Know what to do with the plant in front of you.",
    heroBody: "Structured guidance for thinning, pruning, harvesting and hydroponic care — with evidence kept separate from Garden adaptations.",
    evidenceLegend: "Evidence legend",
    sourceBacked: "Source-backed",
    gardenAdaptation: "Garden adaptation",
    needsValidation: "Needs validation",
    searchPlaceholder: "Search basil, albahaca, lettuce…",
    filterLabel: "Guide filters",
    library: "USER ZERO LIBRARY",
    version: "V0.3 · 17 current crops · ES/EN",
    allPlants: "All plants",
    plant: "plant",
    plants: "plants",
    guide: "guide",
    noMatches: "No plant matches that search yet.",
    unavailable: "Guide unavailable",
    loadError: "The prototype data could not be loaded.",
    close: "Close guide",
    avoid: "Avoid",
    context: "Context",
    confidence: "Confidence",
    confidence_high: "high",
    confidence_medium: "medium",
    confidence_pending: "pending",
    categories: { herbs: "herbs", "leafy greens": "leafy greens", fruiting: "fruiting" },
    sections: {
      germination: "Germination",
      thinning: "Thinning",
      pruning: "Pruning",
      harvest: "Harvest",
      flowering: "Flowering / bolting",
      hydroponics: "Hydroponics",
      problems: "Common issues",
    },
  },
  es: {
    prototype: "GARDEN X · PROTOTIPO",
    title: "Grow Guide",
    install: "Instalar",
    kicker: "Conocimiento que sabe dónde están sus límites.",
    heroTitle: "Sabe qué hacer con la planta que tienes delante.",
    heroBody: "Guía estructurada para raleo, poda, cosecha y manejo hidropónico, manteniendo la evidencia separada de las adaptaciones de Garden.",
    evidenceLegend: "Leyenda de evidencia",
    sourceBacked: "Respaldado por fuente",
    gardenAdaptation: "Adaptación de Garden",
    needsValidation: "Necesita validación",
    searchPlaceholder: "Busca albahaca, basil, lechuga…",
    filterLabel: "Filtros de la guía",
    library: "BIBLIOTECA USER ZERO",
    version: "V0.3 · 17 cultivos actuales · ES/EN",
    allPlants: "Todas",
    plant: "planta",
    plants: "plantas",
    guide: "ficha",
    noMatches: "Todavía no hay una planta que coincida con esa búsqueda.",
    unavailable: "Guía no disponible",
    loadError: "No se pudieron cargar los datos del prototipo.",
    close: "Cerrar guía",
    avoid: "Evitar",
    context: "Contexto",
    confidence: "Confianza",
    confidence_high: "alta",
    confidence_medium: "media",
    confidence_pending: "pendiente",
    categories: { herbs: "hierbas", "leafy greens": "hojas verdes", fruiting: "cultivos de fruto" },
    sections: {
      germination: "Germinación",
      thinning: "Raleo",
      pruning: "Poda",
      harvest: "Cosecha",
      flowering: "Floración / espigado",
      hydroponics: "Hidroponía",
      problems: "Problemas comunes",
    },
  },
};

const sectionIcons = {
  germination: "🌱",
  thinning: "✂️",
  pruning: "🌿",
  harvest: "🥬",
  flowering: "🌸",
  hydroponics: "💧",
  problems: "⚠️",
};

const evidenceClasses = {
  source_backed: "source-backed",
  garden_adaptation: "garden-adaptation",
  needs_validation: "needs-validation",
};

async function init() {
  const [pilotPlantResponse, currentPlantResponse, sourceResponse, currentSourceResponse, spanishResponse] = await Promise.all([
    fetch("./data/plants.json"),
    fetch("./data/plants-current-gardens.json"),
    fetch("./data/sources.json"),
    fetch("./data/sources-current-gardens.json"),
    fetch("./data/translations-es.json"),
  ]);

  state.plants = [...await pilotPlantResponse.json(), ...await currentPlantResponse.json()];
  const sources = [...await sourceResponse.json(), ...await currentSourceResponse.json()];
  state.sources = Object.fromEntries(sources.map((source) => [source.id, source]));
  state.translations = await spanishResponse.json();

  bindEvents();
  applyLanguage();
  registerServiceWorker();
}

function bindEvents() {
  refs.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderPlants();
  });

  refs.closeDialog.addEventListener("click", () => refs.dialog.close());
  refs.dialog.addEventListener("close", () => { state.activePlantId = null; });
  refs.dialog.addEventListener("click", (event) => {
    if (event.target === refs.dialog) refs.dialog.close();
  });

  refs.languageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.language));
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

  refs.translatable.forEach((element) => {
    const key = element.dataset.i18n;
    if (text[key]) element.textContent = text[key];
  });

  refs.searchInput.placeholder = text.searchPlaceholder;
  refs.searchInput.closest(".controls")?.setAttribute("aria-label", text.filterLabel);
  document.querySelector(".trust-legend")?.setAttribute("aria-label", text.evidenceLegend);
  refs.closeDialog.setAttribute("aria-label", text.close);

  refs.languageButtons.forEach((button) => {
    const active = button.dataset.language === state.language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  buildFilters();
  renderPlants();

  if (state.activePlantId) {
    const activePlant = state.plants.find((plant) => plant.id === state.activePlantId);
    if (activePlant) refs.detail.innerHTML = buildPlantDetail(activePlant);
  }
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
    button.addEventListener("click", () => {
      state.category = category;
      buildFilters();
      renderPlants();
    });
    refs.categoryFilters.append(button);
  });
}

function getFilteredPlants() {
  return state.plants.filter((plant) => {
    const categoryMatch = state.category === "all" || plant.category === state.category;
    const haystack = [plant.name, plant.spanishName, plant.scientificName, plant.variety, ...(plant.tags || [])].join(" ").toLowerCase();
    return categoryMatch && (!state.query || haystack.includes(state.query));
  });
}

function getLocalizedPlant(plant) {
  if (state.language !== "es") return plant;
  const translated = state.translations[plant.id] || {};
  const sections = {};
  Object.entries(plant.sections || {}).forEach(([key, section]) => {
    sections[key] = { ...section, ...(translated.sections?.[key] || {}) };
  });
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
    fragment.querySelector(".guide-status").textContent = `${localized.guideCompletion}% ${text.guide}`;
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

  const metrics = (localized.metrics || []).map((metric) => `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(metric.label)}</div>
      <div class="metric-value">${escapeHtml(metric.value)}</div>
      ${metric.note ? `<div class="metric-note">${escapeHtml(metric.note)}</div>` : ""}
    </div>
  `).join("");

  const sections = Object.keys(sectionIcons)
    .filter((key) => localized.sections?.[key])
    .map((key, index) => buildSection(localized.sections[key], key, index === 0))
    .join("");

  return `
    <section class="detail-hero">
      <div class="detail-icon">${plant.emoji}</div>
      <div class="detail-title">
        <p class="plant-spanish">${escapeHtml(secondaryName)}</p>
        <h2>${escapeHtml(primaryName)}</h2>
        <p class="scientific">${escapeHtml(plant.scientificName)}</p>
      </div>
      <p class="detail-summary">${escapeHtml(localized.summary)}</p>
    </section>
    <section class="quick-facts">${metrics}</section>
    <section class="guide-stack">${sections}</section>
  `;
}

function buildSection(section, key, open = false) {
  const text = ui[state.language];
  const className = evidenceClasses[section.evidenceType] || evidenceClasses.needs_validation;
  const evidenceLabel = section.evidenceType === "source_backed" ? text.sourceBacked : section.evidenceType === "garden_adaptation" ? text.gardenAdaptation : text.needsValidation;
  const confidence = text[`confidence_${section.confidence}`] || section.confidence || text.confidence_pending;
  const items = (section.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const warnings = (section.avoid || []).map((item) => `<li><strong>${escapeHtml(text.avoid)}:</strong> ${escapeHtml(item)}</li>`).join("");
  const sourceLinks = (section.sourceIds || [])
    .map((id) => state.sources[id])
    .filter(Boolean)
    .map((source) => `<a class="source-link" href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher)} · ${escapeHtml(source.title)}</a>`)
    .join("");

  return `
    <details class="section-card" ${open ? "open" : ""}>
      <summary>
        <span class="section-icon">${sectionIcons[key]}</span>
        <span>
          <h3>${escapeHtml(text.sections[key])}</h3>
          <span class="section-subtitle">${escapeHtml(section.short)}</span>
        </span>
      </summary>
      <div class="section-body">
        <p>${escapeHtml(section.guidance)}</p>
        ${items ? `<ul>${items}</ul>` : ""}
        ${warnings ? `<ul>${warnings}</ul>` : ""}
        ${section.context ? `<p><strong>${escapeHtml(text.context)}:</strong> ${escapeHtml(section.context)}</p>` : ""}
        <div class="evidence-row">
          <span class="evidence-chip ${className}">● ${escapeHtml(evidenceLabel)}</span>
          <span class="evidence-chip">${escapeHtml(text.confidence)}: ${escapeHtml(confidence)}</span>
        </div>
        ${sourceLinks ? `<div class="source-links">${sourceLinks}</div>` : ""}
      </div>
    </details>
  `;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

let deferredInstallPrompt;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  refs.installButton.hidden = false;
});

refs.installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  refs.installButton.hidden = true;
});

init().catch((error) => {
  console.error(error);
  const text = ui[state.language];
  refs.resultCount.textContent = text.unavailable;
  refs.plantGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.loadError)}</div>`;
});
