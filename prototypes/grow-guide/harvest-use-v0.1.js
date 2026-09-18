(() => {
  const DATA_URL = "./data/harvest-use-v0.1.json";
  let data = null;
  let loadPromise = null;
  const esc = (value = "") => String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const attr = esc;
  const pick = (value, lang) => value?.[lang] || value?.en || "";

  const labels = {
    en: {
      eyebrow: "AFTER HARVEST · HARVEST USE",
      title: "What can you do with it now?",
      edible: "Edible part",
      best: "Best use",
      quick: "Quick uses",
      sources: "Sources",
      safety: "Food-safety note",
      statuses: { best: "Best choice", good: "Good option", possible: "Possible", avoid: "Not recommended" }
    },
    es: {
      eyebrow: "DESPUÉS DE COSECHAR · HARVEST USE",
      title: "¿Qué puedes hacer ahora?",
      edible: "Parte comestible",
      best: "Mejor uso",
      quick: "Usos rápidos",
      sources: "Fuentes",
      safety: "Nota de seguridad alimentaria",
      statuses: { best: "Mejor opción", good: "Buena opción", possible: "Posible", avoid: "No recomendado" }
    }
  };

  async function load() {
    if (data) return data;
    if (!loadPromise) {
      loadPromise = fetch(DATA_URL).then((response) => {
        if (!response.ok) throw new Error("Harvest Use data unavailable");
        return response.json();
      }).then((json) => (data = json));
    }
    return loadPromise;
  }

  function sourceLinks(ids = [], lang = "en") {
    if (!data) return "";
    const text = labels[lang] || labels.en;
    const links = ids.map((id) => data.sources?.[id]).filter(Boolean)
      .map((source) => `<a href="${attr(source.url)}" target="_blank" rel="noreferrer">${esc(source.publisher)} ↗</a>`).join("");
    return links ? `<div class="harvest-method-sources"><span>${esc(text.sources)}</span>${links}</div>` : "";
  }

  function methodCard(method, lang) {
    const text = labels[lang] || labels.en;
    const steps = (method.steps?.[lang] || method.steps?.en || []).map((step) => `<li>${esc(step)}</li>`).join("");
    return `<article class="harvest-method-card ${attr(method.status)}">
      <div class="harvest-method-top">
        <span class="harvest-method-icon" aria-hidden="true">${esc(method.icon || "•")}</span>
        <div><span class="harvest-status ${attr(method.status)}">${esc(text.statuses[method.status] || method.status)}</span><h4>${esc(pick(method.title, lang))}</h4></div>
      </div>
      <p class="harvest-method-summary">${esc(pick(method.summary, lang))}</p>
      ${steps ? `<ol class="harvest-steps">${steps}</ol>` : ""}
      ${method.note ? `<p class="harvest-method-note">${esc(pick(method.note, lang))}</p>` : ""}
      ${sourceLinks(method.sourceIds, lang)}
    </article>`;
  }

  function render(plantId, lang = "en") {
    if (!data) {
      load().then(() => {
        const active = window.state?.activePlantId;
        if (active && typeof window.openPlant === "function") {
          const plant = window.state?.plants?.find?.((item) => item.id === active);
          if (plant) window.openPlant(plant);
        }
      }).catch(() => {});
      return "";
    }
    const record = data.plants?.[plantId];
    if (!record) return "";
    const text = labels[lang] || labels.en;
    const quickUses = (record.quickUses?.[lang] || record.quickUses?.en || []).map((item) => `<span>${esc(item)}</span>`).join("");
    const methods = (record.methods || []).map((method) => methodCard(method, lang)).join("");
    return `<section class="harvest-use">
      <div class="harvest-use-heading">
        <div><p class="eyebrow">${esc(text.eyebrow)}</p><h3>${esc(text.title)}</h3></div>
        <span class="harvest-use-version">V0.1 · Source-backed</span>
      </div>
      <div class="harvest-best">
        <div class="harvest-fact"><span>${esc(text.edible)}</span><strong>${esc(pick(record.edibleParts, lang))}</strong></div>
        <div class="harvest-fact primary"><span>${esc(text.best)}</span><strong>${esc(pick(record.bestUse, lang))}</strong></div>
      </div>
      ${quickUses ? `<div class="harvest-quick"><span>${esc(text.quick)}</span><div>${quickUses}</div></div>` : ""}
      <div class="harvest-method-grid">${methods}</div>
      ${record.safetyNote ? `<aside class="harvest-safety"><strong>⚠ ${esc(text.safety)}</strong><p>${esc(pick(record.safetyNote, lang))}</p></aside>` : ""}
    </section>`;
  }

  window.GARDEN_HARVEST_USE = { load, render, get data() { return data; } };
  load().catch((error) => console.warn("[Garden Labs] Harvest Use:", error));
})();