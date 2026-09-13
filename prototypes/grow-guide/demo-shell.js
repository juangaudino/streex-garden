const demoRefs = {
  shell: document.querySelector("#demoShell"),
  frame: document.querySelector("#demoDeviceFrame"),
  deviceButtons: [...document.querySelectorAll("[data-device]")],
  deviceLabel: document.querySelector("#demoDeviceLabel"),
  openFrameless: document.querySelector("#openFrameless"),
  returnToDemo: document.querySelector("#returnToDemo"),
  guideTab: document.querySelector("#guideTab"),
  seedsTab: document.querySelector("#seedsTab"),
  productEyebrow: document.querySelector("#productEyebrow"),
  productTitle: document.querySelector("#productTitle"),
  languageButtons: [...document.querySelectorAll("[data-language]")],
};

const shellCopy = {
  es: {
    studio: "PROTOTYPE STUDIO · 01",
    state: "PROTOTIPO INTERACTIVO · DATOS DE DEMOSTRACIÓN",
    mode: "Modo",
    open: "Abrir sin marco",
    library: "Library",
    seeds: "Seeds",
    libraryEyebrow: "GARDEN LABS · LIBRARY",
    seedsEyebrow: "GARDEN LABS · SEEDS",
    libraryTitle: "Garden Library",
    seedsTitle: "Seeds",
  },
  en: {
    studio: "PROTOTYPE STUDIO · 01",
    state: "INTERACTIVE PROTOTYPE · DEMO DATA",
    mode: "Mode",
    open: "Open without frame",
    library: "Library",
    seeds: "Seeds",
    libraryEyebrow: "GARDEN LABS · LIBRARY",
    seedsEyebrow: "GARDEN LABS · SEEDS",
    libraryTitle: "Garden Library",
    seedsTitle: "Seeds",
  },
};

const deviceNames = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };

function currentLanguage() {
  const stored = localStorage.getItem("growGuideLanguage");
  return stored === "en" ? "en" : "es";
}

function currentLabView() {
  return localStorage.getItem("gardenLabsLibraryView") === "seeds" ? "seeds" : "guide";
}

function applyShellLanguage() {
  const language = currentLanguage();
  const text = shellCopy[language];
  const studio = document.querySelector("[data-i18n='demoStudio']");
  const state = document.querySelector("[data-i18n='demoState']");
  const mode = document.querySelector("[data-i18n='demoMode']");
  const open = document.querySelector("[data-i18n='openFrameless']");
  if (studio) studio.textContent = text.studio;
  if (state) state.textContent = text.state;
  if (mode) mode.textContent = text.mode;
  if (open) open.textContent = text.open;

  // Lab projects keep product names stable across languages.
  if (demoRefs.guideTab) {
    demoRefs.guideTab.removeAttribute("data-i18n");
    demoRefs.guideTab.textContent = text.library;
  }
  if (demoRefs.seedsTab) {
    demoRefs.seedsTab.removeAttribute("data-i18n");
    demoRefs.seedsTab.textContent = text.seeds;
  }
  updateProductHeader();
}

function updateProductHeader() {
  const language = currentLanguage();
  const text = shellCopy[language];
  const view = currentLabView();
  if (demoRefs.productEyebrow) demoRefs.productEyebrow.textContent = view === "seeds" ? text.seedsEyebrow : text.libraryEyebrow;
  if (demoRefs.productTitle) demoRefs.productTitle.textContent = view === "seeds" ? text.seedsTitle : text.libraryTitle;
}

function setDevice(device) {
  const next = deviceNames[device] ? device : "mobile";
  localStorage.setItem("gardenLabsDemoDevice", next);
  demoRefs.frame?.setAttribute("data-device", next);
  demoRefs.deviceButtons.forEach((button) => {
    const active = button.dataset.device === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (demoRefs.deviceLabel) demoRefs.deviceLabel.textContent = deviceNames[next];
}

function setFrameless(frameless) {
  document.body.classList.toggle("demo-frameless", frameless);
  if (demoRefs.returnToDemo) demoRefs.returnToDemo.hidden = !frameless;
  if (frameless) {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

demoRefs.deviceButtons.forEach((button) => {
  button.addEventListener("click", () => setDevice(button.dataset.device));
});

demoRefs.openFrameless?.addEventListener("click", () => setFrameless(true));
demoRefs.returnToDemo?.addEventListener("click", () => setFrameless(false));

[demoRefs.guideTab, demoRefs.seedsTab].forEach((button) => {
  button?.addEventListener("click", () => {
    // app.js owns the actual surface switch; this only updates the Lab shell label.
    window.setTimeout(updateProductHeader, 0);
  });
});

demoRefs.languageButtons.forEach((button) => {
  button.addEventListener("click", () => window.setTimeout(applyShellLanguage, 0));
});

setDevice(localStorage.getItem("gardenLabsDemoDevice") || "mobile");
applyShellLanguage();
window.setTimeout(updateProductHeader, 0);
