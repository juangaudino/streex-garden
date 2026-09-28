(() => {
  const ENDPOINT = "/api/gardenpedia/machines";
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
  const language = () => document.documentElement.lang === "en" ? "en" : "es";
  const copy = {
    en: { title: "My Machines", intro: "Your Garden X systems, with public model specifications kept separate from each private unit.", unit: "MY UNIT", noModel: "No linked public model", custom: "Custom Garden X system", garden: "Garden", positions: "Positions", status: "Status", active: "Active", inactive: "Inactive", modelSpecs: "Public model specifications", source: "Model source", empty: "No Garden X system instances are available for this account.", unavailable: "Canonical machine data is temporarily unavailable.", synced: "Garden X system instances", loading: "Connecting to Garden X…", signInRequired: "Sign in to Garden X to see your private machines.", modelUnknown: "This unit has no proven Gardenpedia model link.", instances: "instances", locations: "locations", customLabel: "Custom" },
    es: { title: "Mis máquinas", intro: "Tus sistemas de Garden X, con las especificaciones públicas del modelo separadas de cada unidad privada.", unit: "MI UNIDAD", noModel: "Sin modelo público vinculado", custom: "Sistema personalizado de Garden X", garden: "Jardín", positions: "Posiciones", status: "Estado", active: "Activo", inactive: "Inactivo", modelSpecs: "Especificaciones públicas del modelo", source: "Fuente del modelo", empty: "Esta cuenta no tiene instancias de sistemas disponibles en Garden X.", unavailable: "Los datos canónicos de máquinas no están disponibles temporalmente.", synced: "Instancias de sistemas de Garden X", loading: "Conectando con Garden X…", signInRequired: "Inicia sesión en Garden X para ver tus máquinas privadas.", modelUnknown: "Esta unidad no tiene un vínculo demostrado a un modelo Gardenpedia.", instances: "instancias", locations: "ubicaciones", customLabel: "Personalizado" },
  };

  let catalog = null;
  let instances = [];
  let mode = "loading";

  function model(instance) {
    return catalog?.models?.find((item) => item.id === instance.modelId) || null;
  }

  function statusLabel(instance, t) {
    return instance.status === "active" ? t.active : t.inactive;
  }

  function groupedInstances() {
    const groups = new Map();
    instances.forEach((instance) => {
      const key = instance.modelId || `custom:${instance.id}`;
      const existing = groups.get(key);
      if (existing) existing.instances.push(instance);
      else groups.set(key, { ...instance, instances: [instance] });
    });
    return [...groups.values()];
  }

  function render() {
    const grid = $("#machineGrid");
    if (!grid || !catalog) return;
    const t = copy[language()];
    const note = $("#machineStorageNote");
    if (note) note.textContent = t[mode] || t.unavailable;
    const groups = groupedInstances();
    $("#machineResultCount").textContent = `${instances.length} ${t.instances}`;
    if (mode === "error") {
      grid.innerHTML = `<div class="empty-state">${t.unavailable}</div>`;
      return;
    }
    if (mode === "signed_out") {
      grid.innerHTML = `<div class="empty-state">${t.signInRequired}</div>`;
      return;
    }
    if (!instances.length) {
      grid.innerHTML = `<div class="empty-state">${t.empty}</div>`;
      return;
    }
    grid.innerHTML = groups.map((instance, index) => {
      const definition = model(instance);
      const brand = definition?.brand || t.custom;
      const name = instance.name || definition?.name || t.custom;
      const modelName = definition?.model || t.noModel;
      const pods = definition?.pods ?? instance.positions;
      const locations = instance.instances.map((item) => item.gardenName || item.name).filter(Boolean).join(" · ");
      return `<article class="machine-card"><button class="machine-card-button" type="button" data-machine-index="${index}"><div class="machine-photo machine-${escapeHtml(definition?.color || "gray")}"><span>${escapeHtml(brand)}</span>${pods ? `<strong>${escapeHtml(instance.instances.length > 1 ? instance.instances.length : pods)}</strong><small>${escapeHtml(instance.instances.length > 1 ? t.instances : (definition?.pods ? "PODS" : t.positions.toUpperCase()))}</small>` : ""}</div><div><p class="machine-brand">${escapeHtml(definition ? t.title : t.customLabel)}</p><h4>${escapeHtml(definition?.name || name)}</h4><p class="muted">${escapeHtml(modelName)}</p><p class="muted">${escapeHtml(locations || t.custom)}</p></div><span class="machine-card-arrow">→</span></button></article>`;
    }).join("");
    grid.querySelectorAll("[data-machine-index]").forEach((button) => button.addEventListener("click", () => {
      open(groups[Number(button.dataset.machineIndex)]);
    }));
  }

  function open(instance) {
    const definition = model(instance);
    const t = copy[language()];
    const detail = $("#machineDetail");
    if (!detail) return;
    const specs = definition ? [
      definition.pods != null ? `<span><b>${escapeHtml(t.positions)}</b> ${escapeHtml(definition.pods)}</span>` : "",
      definition.tankLiters != null ? `<span><b>${escapeHtml(language() === "en" ? "Tank" : "Tanque")}</b> ${escapeHtml(typeof definition.tankLiters === "object" ? `${definition.tankLiters.min}–${definition.tankLiters.max}` : definition.tankLiters)} L</span>` : "",
      definition.color ? `<span><b>${escapeHtml(language() === "en" ? "Color" : "Color")}</b> ${escapeHtml(definition.color)}</span>` : "",
      definition.light ? `<span><b>${escapeHtml(language() === "en" ? "Lighting" : "Iluminación")}</b> ${escapeHtml(definition.light.watts ? `${definition.light.watts} W` : (definition.light.modes || []).join(" / ") || "—")}</span>` : "",
    ].filter(Boolean).join("") : `<p class="muted">${escapeHtml(t.modelUnknown)}</p>`;
    const ownedLocations = (instance.instances || [instance]).map((item) => item.gardenName || item.name).filter(Boolean).join(" · ");
    detail.innerHTML = `<div class="machine-detail-head"><div class="machine-photo machine-${escapeHtml(definition?.color || "gray")}"><span>${escapeHtml(definition?.brand || t.custom)}</span>${definition?.pods ? `<strong>${escapeHtml(definition.pods)}</strong><small>PODS</small>` : ""}</div><div><p class="eyebrow">${escapeHtml(t.unit)}</p><h2>${escapeHtml(definition?.name || instance.name || t.custom)}</h2><p>${escapeHtml(definition?.model || t.noModel)}</p></div></div><section class="machine-evolution"><div class="machine-now-grid"><div class="machine-now-card"><span>${escapeHtml(t.locations)}</span><strong>${escapeHtml(ownedLocations || "—")}</strong></div><div class="machine-now-card"><span>${escapeHtml(t.positions)}</span><strong>${escapeHtml(instance.positions ?? definition?.pods ?? "—")}</strong></div><div class="machine-now-card"><span>${escapeHtml(t.status)}</span><strong>${escapeHtml(statusLabel(instance, t))}</strong></div></div></section>${definition ? `<section class="machine-evolution-panel"><h3>${escapeHtml(t.modelSpecs)}</h3><div class="machine-specs">${specs}</div><p class="machine-source"><a href="${escapeHtml(definition.referenceUrl || definition.purchaseUrl || "#")}" target="_blank" rel="noreferrer">${escapeHtml(t.source)} ↗</a></p></section>` : `<section class="machine-evolution-panel"><h3>${escapeHtml(t.modelSpecs)}</h3>${specs}</section>`}`;
    $("#machineDialog")?.showModal();
  }

  async function load() {
    const t = copy[language()];
    const session = await window.GARDEN_X_AUTH?.getSession?.();
    if (!session?.user?.id) {
      catalog = { models: [] };
      instances = [];
      mode = "signed_out";
      render();
      return;
    }
    catalog = await fetch("./data/machine-inventory-v1.json").then((response) => response.json());
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store" });
      if (!response.ok) throw new Error(`machine list ${response.status}`);
      const result = await response.json();
      instances = Array.isArray(result.instances) ? result.instances : [];
      mode = "synced";
    } catch (error) {
      console.warn("Gardenpedia could not load canonical Garden X systems", error);
      instances = [];
      mode = "error";
    }
    render();
    document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => setTimeout(render, 0)));
  }

  window.GardenMachinesV1 = { load, render };
  let started = false;
  const start = () => { if (!started) { started = true; load(); } };
  if (window.GARDENPEDIA_READY) start();
  else window.addEventListener("gardenpedia:ready", start, { once: true });
})();
