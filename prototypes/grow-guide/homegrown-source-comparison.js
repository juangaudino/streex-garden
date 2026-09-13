(() => {
  const DATA_URL = "./data/homegrown-manufacturer-guidance.json";
  const PLANT_BY_NAME = new Map([
    ["genovese basil", "genovese-basil"],
    ["albahaca genovesa", "genovese-basil"],
    ["cilantro", "cilantro"],
    ["rosemary", "rosemary"],
    ["romero", "rosemary"],
    ["red romaine lettuce", "red-romaine-lettuce"],
    ["lechuga romana roja", "red-romaine-lettuce"],
    ["buttercrunch lettuce", "buttercrunch-lettuce"],
    ["lechuga buttercrunch", "buttercrunch-lettuce"],
    ["black seeded simpson", "black-seeded-simpson"],
    ["lechuga black seeded simpson", "black-seeded-simpson"],
  ]);

  const STATUS_BY_PLANT = {
    "genovese-basil": "matches",
    cilantro: "differs",
    rosemary: "adds",
    "red-romaine-lettuce": "matches",
    "buttercrunch-lettuce": "adds",
    "black-seeded-simpson": "matches",
  };

  const COPY = {
    es: {
      eyebrow: "COMPARACIÓN DE FUENTES",
      title: "Home Grown · Guía del fabricante",
      garden: "Garden actual",
      manufacturer: "Home Grown",
      provenance: "Procedencia",
      openHint: "Ver comparación",
      statuses: { matches: "Coincide", adds: "Complementa", differs: "Difiere" },
      summaries: {
        "genovese-basil": "Coincide en germinación, altura de cosecha y corte sobre nodo.",
        cilantro: "Difiere en germinación y spacing según el contexto; la cosecha es casi coincidente.",
        rosemary: "Coincide en luz y germinación general; añade estratificación aún no promovida.",
        "red-romaine-lettuce": "Coincide en cosecha por hojas o cabeza; el rango térmico del fabricante es más amplio.",
        "buttercrunch-lettuce": "Coincide en modo de cosecha y añade contexto de tolerancia relativa al calor.",
        "black-seeded-simpson": "Coincide en hábito loose-leaf y cosecha repetida de hojas externas.",
      },
      topics: {
        germination: "Germinación",
        "harvest/pruning structure": "Cosecha / poda estructural",
        "harvest cue": "Punto de cosecha",
        "spacing/thinning": "Espaciado / raleo",
        "light for germination": "Luz para germinar",
        "cold stratification": "Estratificación fría",
        "harvest modes": "Modos de cosecha",
        "germination temperature": "Temperatura de germinación",
        "heat tolerance": "Tolerancia al calor",
        "growth form": "Forma de crecimiento",
        "repeat harvest": "Cosecha repetida",
      },
      resolutions: {
        corroborates: "Coincide con la guía actual; se conserva como corroboración del fabricante.",
        near_match: "Los rangos son compatibles; no se considera un conflicto.",
        material_conflict: "Difieren materialmente; Garden conserva ambos valores con su contexto.",
        context_conflict: "Difieren por contexto o método; no se convierte en una regla del pod.",
        manufacturer_only_candidate: "Dato exclusivo del fabricante; no se promueve todavía a la guía principal.",
        context_difference: "El fabricante da un rango más amplio; Garden conserva su formulación óptima actual.",
        manufacturer_context: "Contexto útil de variedad; no elimina las advertencias actuales de Garden.",
      },
    },
    en: {
      eyebrow: "SOURCE COMPARISON",
      title: "Home Grown · Manufacturer guidance",
      garden: "Current Garden",
      manufacturer: "Home Grown",
      provenance: "Provenance",
      openHint: "View comparison",
      statuses: { matches: "Matches", adds: "Adds context", differs: "Differs" },
      summaries: {
        "genovese-basil": "Matches on germination, harvest height and node-based cutting.",
        cilantro: "Differs on germination and spacing by context; harvest cue is a near-match.",
        rosemary: "Matches on light and broad germination guidance; adds stratification not yet promoted.",
        "red-romaine-lettuce": "Matches on leaf vs head harvest; manufacturer temperature range is broader.",
        "buttercrunch-lettuce": "Matches on harvest mode and adds relative heat-tolerance context.",
        "black-seeded-simpson": "Matches on loose-leaf habit and repeated outer-leaf harvesting.",
      },
      topics: {},
      resolutions: {},
    },
  };

  let guidance = null;
  let injecting = false;

  function normalize(value = "") {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function currentLanguage() {
    return document.querySelector("[data-language].active")?.dataset.language === "en" ? "en" : "es";
  }

  function activePilotPlantId(detail) {
    const title = normalize(detail.querySelector(".detail-title h2")?.textContent || detail.querySelector("h2")?.textContent || "");
    return PLANT_BY_NAME.get(title) || null;
  }

  function topicLabel(topic, language) {
    if (language === "en") return topic.replace(/(^|\s|\/)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
    return COPY.es.topics[topic] || topic;
  }

  function resolutionText(row, language) {
    if (language === "en") return row.resolution || "Context preserved; no automatic overwrite.";
    return COPY.es.resolutions[row.status] || "Se conserva el contexto de ambas fuentes sin sobrescritura automática.";
  }

  function statusTone(status) {
    return status === "differs" ? "difference" : status === "adds" ? "supplement" : "agreement";
  }

  function buildComparison(plantId, record, language) {
    const text = COPY[language];
    const status = STATUS_BY_PLANT[plantId] || "adds";
    const rows = (record.reconciliation || []).slice(0, 3);
    const locator = (record.sourceLocators || [])[0] || "Home Grown grow guide";

    const details = document.createElement("details");
    details.className = `manufacturer-source-comparison ${statusTone(status)}`;
    details.dataset.plantId = plantId;
    details.innerHTML = `
      <summary class="manufacturer-source-summary">
        <div class="manufacturer-source-summary-copy">
          <p class="eyebrow">${escapeHtml(text.eyebrow)}</p>
          <div class="manufacturer-source-title-row">
            <h3>${escapeHtml(text.title)}</h3>
            <span class="manufacturer-source-chip ${statusTone(status)}">${escapeHtml(text.statuses[status])}</span>
          </div>
          <p class="manufacturer-source-summary-line">${escapeHtml(text.summaries[plantId] || "")}</p>
        </div>
        <span class="manufacturer-source-open">${escapeHtml(text.openHint)} <span aria-hidden="true">⌄</span></span>
      </summary>
      <div class="manufacturer-source-body">
        <div class="manufacturer-source-rows">
          ${rows.map((row) => `
            <article class="manufacturer-source-row">
              <h4>${escapeHtml(topicLabel(row.topic, language))}</h4>
              <div class="manufacturer-source-values">
                <div><span>${escapeHtml(text.garden)}</span><strong>${escapeHtml(row.gardenValue || "—")}</strong></div>
                <div><span>${escapeHtml(text.manufacturer)}</span><strong>${escapeHtml(row.homeGrownValue || "—")}</strong></div>
              </div>
              <p>${escapeHtml(resolutionText(row, language))}</p>
            </article>
          `).join("")}
        </div>
        <div class="manufacturer-source-provenance">
          <span>${escapeHtml(text.provenance)}</span>
          <strong>${escapeHtml(locator)}</strong>
        </div>
      </div>
    `;
    return details;
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function inject() {
    if (!guidance || injecting) return;
    const detail = document.querySelector("#plantDetail");
    if (!detail || !detail.children.length) return;

    const plantId = activePilotPlantId(detail);
    const existing = detail.querySelector(".manufacturer-source-comparison");

    if (!plantId || !guidance.pilotPlants?.[plantId]) {
      existing?.remove();
      return;
    }

    const language = currentLanguage();
    if (existing?.dataset.plantId === plantId && existing.dataset.language === language) return;

    injecting = true;
    existing?.remove();
    const comparison = buildComparison(plantId, guidance.pilotPlants[plantId], language);
    comparison.dataset.language = language;
    const quickFacts = detail.querySelector(".quick-facts");
    if (quickFacts) quickFacts.insertAdjacentElement("afterend", comparison);
    else detail.querySelector(".detail-hero")?.insertAdjacentElement("afterend", comparison);
    injecting = false;
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) return;
      guidance = await response.json();
    } catch {
      return;
    }

    const detail = document.querySelector("#plantDetail");
    if (!detail) return;
    new MutationObserver(() => queueMicrotask(inject)).observe(detail, { childList: true, subtree: true });
    document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => setTimeout(inject, 0)));
    inject();
  }

  init();
})();
