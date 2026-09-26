(() => {
  const ENDPOINT = "/api/gardenpedia/machines";
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
  const language = () => document.documentElement.lang === "en" ? "en" : "es";
  const copy = {
    en: { title: "My Machines", intro: "Your Garden X systems, with public model specifications kept separate from each private unit.", unit: "MY UNIT", noModel: "No linked public model", custom: "Custom Garden X system", garden: "Garden", positions: "Positions", status: "Status", active: "Active", inactive: "Inactive", modelSpecs: "Public model specifications", source: "Model source", empty: "No Garden X system instances are available for this account.", unavailable: "Canonical machine data is temporarily unavailable.", synced: "Garden X system instances", loading: "Connecting to Garden X…", modelUnknown: "This unit has no proven Gardenpedia model link." },
    es: { title: "Mis máquinas", intro: "Tus sistemas de Garden X, con las especificaciones públicas del modelo separadas de cada unidad privada.", unit: "MI UNIDAD", noModel: "Sin modelo público vinculado", custom: "Sistema personalizado de Garden X", garden: "Jardín", positions: "Posiciones", status: "Estado", active: "Activo", inactive: "Inactivo", modelSpecs: "Especificaciones públicas del modelo", source: "Fuente del modelo", empty: "Esta cuenta no tiene instancias de sistemas disponibles en Garden X.", unavailable: "Los datos canónicos de máquinas no están disponibles temporalmente.", synced: "Instancias de sistemas de Garden X", loading: "Conectando con Garden X…", modelUnknown: "Esta unidad no tiene un vínculo demostrado a un modelo Gardenpedia." },
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

  function render() {
    const grid = $("#machineGrid");
    if (!grid || !catalog) return;
    const t = copy[language()];
    const note = $("#machineStorageNote");
    if (note) note.textContent = t[mode] || t.unavailable;
    $("#machineResultCount").textContent = `${instances.length} ${t.title.toLocaleLowerCase()}`;
    if (mode === "error") {
      grid.innerHTML = `<div class="empty-state">${t.unavailable}</div>`;
      return;
    }
    if (!instances.length) {
      grid.innerHTML = `<div class="empty-state">${t.empty}</div>`;
      return;
    }
    grid.innerHTML = instances.map((instance, index) => {
      const definition = model(instance);
      const brand = definition?.brand || t.custom;
      const name = instance.name || definition?.name || t.custom;
      const modelName = definition?.model || t.noModel;
      const pods = instance.positions ?? definition?.pods;
      return `<article class="machine-card"><button class="machine-card-button" type="button" data-machine-index="${index}"><div class="machine-photo machine-${escapeHtml(definition?.color || "gray")}"><span>${escapeHtml(brand)}</span>${pods ? `<strong>${escapeHtml(pods)}</strong><small>${definition?.pods ? "PODS" : escapeHtml(t.positions.toUpperCase())}</small>` : ""}</div><div><p class="machine-brand">${escapeHtml(instance.gardenName || t.garden)}</p><h4>${escapeHtml(name)}</h4><p class="muted">${escapeHtml(modelName)}</p><p class="muted">${escapeHtml(instance.gardenName || "")} · ${escapeHtml(statusLabel(instance, t))}</p></div><span class="machine-card-arrow">→</span></button></article>`;
    }).join("");
    grid.querySelectorAll("[data-machine-index]").forEach((button) => button.addEventListener("click", () => {
      open(instances[Number(button.dataset.machineIndex)]);
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
    detail.innerHTML = `<div class="machine-detail-head"><div class="machine-photo machine-${escapeHtml(definition?.color || "gray")}"><span>${escapeHtml(definition?.brand || t.custom)}</span>${definition?.pods ? `<strong>${escapeHtml(definition.pods)}</strong><small>PODS</small>` : ""}</div><div><p class="eyebrow">${escapeHtml(t.unit)}</p><h2>${escapeHtml(instance.name || definition?.name || t.custom)}</h2><p>${escapeHtml(definition?.model || t.noModel)}</p></div></div><section class="machine-evolution"><div class="machine-now-grid"><div class="machine-now-card"><span>${escapeHtml(t.garden)}</span><strong>${escapeHtml(instance.gardenName || "—")}</strong></div><div class="machine-now-card"><span>${escapeHtml(t.positions)}</span><strong>${escapeHtml(instance.positions ?? "—")}</strong></div><div class="machine-now-card"><span>${escapeHtml(t.status)}</span><strong>${escapeHtml(statusLabel(instance, t))}</strong></div></div></section>${definition ? `<section class="machine-evolution-panel"><h3>${escapeHtml(t.modelSpecs)}</h3><div class="machine-specs">${specs}</div><p class="machine-source"><a href="${escapeHtml(definition.referenceUrl || definition.purchaseUrl || "#")}" target="_blank" rel="noreferrer">${escapeHtml(t.source)} ↗</a></p></section>` : `<section class="machine-evolution-panel"><h3>${escapeHtml(t.modelSpecs)}</h3>${specs}</section>`}`;
    $("#machineDialog")?.showModal();
  }

  async function load() {
    const t = copy[language()];
    const tab = $("#machinesTab");
    const session = await window.GARDEN_X_AUTH?.getSession?.();
    if (!session?.user?.id) {
      if (tab) tab.hidden = true;
      return;
    }
    catalog = await fetch("./data/machine-inventory-v1.json").then((response) => response.json());
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store" });
      if (!response.ok) throw new Error(`machine list ${response.status}`);
      const result = await response.json();
      instances = Array.isArray(result.instances) ? result.instances : [];
      mode = "synced";
      if (tab) tab.hidden = false;
    } catch (error) {
      console.warn("Gardenpedia could not load canonical Garden X systems", error);
      instances = [];
      mode = "error";
    }
    render();
    $("#machinesTab")?.addEventListener("click", () => setMachineView(true));
    ["#guideTab", "#seedsTab"].forEach((selector) => $(selector)?.addEventListener("click", () => setMachineView(false)));
    document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => setTimeout(render, 0)));
    if (localStorage.getItem("gardenpediaPublicLibraryView") === "machines") setMachineView(true);
  }

  function setMachineView(on) {
    const machines = $("#machinesSurface");
    if (!machines) return;
    machines.hidden = !on;
    if (on) {
      $("#guideSurface").hidden = true;
      $("#seedsSurface").hidden = true;
      $("#machinesTab").classList.add("active");
      $("#machinesTab").setAttribute("aria-pressed", "true");
      [$("#guideTab"), $("#seedsTab")].forEach((button) => {
        button.classList.remove("active"); button.setAttribute("aria-pressed", "false");
      });
      localStorage.setItem("gardenpediaPublicLibraryView", "machines");
      const t = copy[language()];
      $("#productEyebrow").textContent = "GARDENPEDIA · MACHINES";
      $("#productTitle").textContent = t.title;
      const intro = $("#machinesSurface .surface-intro p:last-child");
      if (intro) intro.textContent = t.intro;
    } else {
      $("#machinesTab")?.classList.remove("active");
      $("#machinesTab")?.setAttribute("aria-pressed", "false");
    }
  }

  window.GardenMachinesV1 = { load, render };
  let started = false;
  const start = () => { if (!started) { started = true; load(); } };
  if (window.GARDENPEDIA_READY) start();
  else window.addEventListener("gardenpedia:ready", start, { once: true });
})();
