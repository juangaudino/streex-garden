const state = {
  plants: [],
  sources: {},
  query: "",
  category: "all",
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
};

const sectionMeta = {
  germination: { icon: "🌱", title: "Germination" },
  thinning: { icon: "✂️", title: "Thinning" },
  pruning: { icon: "🌿", title: "Pruning" },
  harvest: { icon: "🥬", title: "Harvest" },
  flowering: { icon: "🌸", title: "Flowering / bolting" },
  hydroponics: { icon: "💧", title: "Hydroponics" },
  problems: { icon: "⚠️", title: "Common issues" },
};

const evidenceLabels = {
  source_backed: ["Source-backed", "source-backed"],
  garden_adaptation: ["Garden adaptation", "garden-adaptation"],
  needs_validation: ["Needs validation", "needs-validation"],
};

async function init() {
  const [pilotPlantResponse, currentPlantResponse, sourceResponse, currentSourceResponse] = await Promise.all([
    fetch("./data/plants.json"),
    fetch("./data/plants-current-gardens.json"),
    fetch("./data/sources.json"),
    fetch("./data/sources-current-gardens.json"),
  ]);

  const pilotPlants = await pilotPlantResponse.json();
  const currentPlants = await currentPlantResponse.json();
  state.plants = [...pilotPlants, ...currentPlants];

  const baseSources = await sourceResponse.json();
  const currentSources = await currentSourceResponse.json();
  const sources = [...baseSources, ...currentSources];
  state.sources = Object.fromEntries(sources.map((source) => [source.id, source]));

  buildFilters();
  renderPlants();
  bindEvents();
  registerServiceWorker();
}

function bindEvents() {
  refs.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderPlants();
  });

  refs.closeDialog.addEventListener("click", () => refs.dialog.close());

  refs.dialog.addEventListener("click", (event) => {
    if (event.target === refs.dialog) refs.dialog.close();
  });
}

function buildFilters() {
  const categories = ["all", ...new Set(state.plants.map((plant) => plant.category))];
  refs.categoryFilters.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = `filter-chip ${category === state.category ? "active" : ""}`;
    button.type = "button";
    button.textContent = category === "all" ? "All plants" : category;
    button.addEventListener("click", () => {
      state.category = category;
      [...refs.categoryFilters.children].forEach((chip) => chip.classList.toggle("active", chip === button));
      renderPlants();
    });
    refs.categoryFilters.append(button);
  });
}

function getFilteredPlants() {
  return state.plants.filter((plant) => {
    const categoryMatch = state.category === "all" || plant.category === state.category;
    const haystack = [
      plant.name,
      plant.spanishName,
      plant.scientificName,
      plant.variety,
      ...(plant.tags || []),
    ].join(" ").toLowerCase();
    const queryMatch = !state.query || haystack.includes(state.query);
    return categoryMatch && queryMatch;
  });
}

function renderPlants() {
  const plants = getFilteredPlants();
  refs.plantGrid.innerHTML = "";
  refs.resultCount.textContent = `${plants.length} ${plants.length === 1 ? "plant" : "plants"}`;

  if (!plants.length) {
    refs.plantGrid.innerHTML = `<div class="empty-state">No plant matches that search yet.</div>`;
    return;
  }

  plants.forEach((plant) => {
    const fragment = refs.cardTemplate.content.cloneNode(true);
    fragment.querySelector(".plant-emoji").textContent = plant.emoji;
    fragment.querySelector(".category-pill").textContent = plant.category;
    fragment.querySelector(".plant-spanish").textContent = plant.spanishName;
    fragment.querySelector(".plant-name").textContent = plant.name;
    fragment.querySelector(".plant-scientific").textContent = plant.scientificName;
    fragment.querySelector(".guide-status").textContent = `${plant.guideCompletion}% guide`;
    fragment.querySelector(".plant-card-button").addEventListener("click", () => openPlant(plant));
    refs.plantGrid.append(fragment);
  });
}

function openPlant(plant) {
  refs.detail.innerHTML = buildPlantDetail(plant);
  refs.dialog.showModal();
  refs.dialog.scrollTop = 0;
}

function buildPlantDetail(plant) {
  const metrics = (plant.metrics || []).map((metric) => `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(metric.label)}</div>
      <div class="metric-value">${escapeHtml(metric.value)}</div>
      ${metric.note ? `<div class="metric-note">${escapeHtml(metric.note)}</div>` : ""}
    </div>
  `).join("");

  const sections = Object.entries(sectionMeta)
    .filter(([key]) => plant.sections?.[key])
    .map(([key, meta], index) => buildSection(plant.sections[key], meta, index === 0))
    .join("");

  return `
    <section class="detail-hero">
      <div class="detail-icon">${plant.emoji}</div>
      <div class="detail-title">
        <p class="plant-spanish">${escapeHtml(plant.spanishName)}</p>
        <h2>${escapeHtml(plant.name)}</h2>
        <p class="scientific">${escapeHtml(plant.scientificName)}</p>
      </div>
      <p class="detail-summary">${escapeHtml(plant.summary)}</p>
    </section>
    <section class="quick-facts">${metrics}</section>
    <section class="guide-stack">${sections}</section>
  `;
}

function buildSection(section, meta, open = false) {
  const [label, className] = evidenceLabels[section.evidenceType] || evidenceLabels.needs_validation;
  const items = (section.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const warnings = (section.avoid || []).map((item) => `<li><strong>Avoid:</strong> ${escapeHtml(item)}</li>`).join("");
  const sourceLinks = (section.sourceIds || [])
    .map((id) => state.sources[id])
    .filter(Boolean)
    .map((source) => `<a class="source-link" href="${source.url}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher)} · ${escapeHtml(source.title)}</a>`)
    .join("");

  return `
    <details class="section-card" ${open ? "open" : ""}>
      <summary>
        <span class="section-icon">${meta.icon}</span>
        <span>
          <h3>${meta.title}</h3>
          <span class="section-subtitle">${escapeHtml(section.short)}</span>
        </span>
      </summary>
      <div class="section-body">
        <p>${escapeHtml(section.guidance)}</p>
        ${items ? `<ul>${items}</ul>` : ""}
        ${warnings ? `<ul>${warnings}</ul>` : ""}
        ${section.context ? `<p><strong>Context:</strong> ${escapeHtml(section.context)}</p>` : ""}
        <div class="evidence-row">
          <span class="evidence-chip ${className}">● ${label}</span>
          <span class="evidence-chip">Confidence: ${escapeHtml(section.confidence || "pending")}</span>
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
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
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
  refs.resultCount.textContent = "Guide unavailable";
  refs.plantGrid.innerHTML = `<div class="empty-state">The prototype data could not be loaded.</div>`;
});
