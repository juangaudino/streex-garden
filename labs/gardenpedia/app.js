const state = {
  plants: [],
  sources: {},
  translations: {},
  visuals: {},
  seedInventory: {},
  seedPackages: [],
  accountMode: "signed_out",
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
  selectedSeedIdentityId: null,
  requests: [],
  curatorQueue: [],
  isCurator: false,
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
  identityRequestForm: document.querySelector("#identityRequestForm"),
  identityRequestInput: document.querySelector("#identityRequestInput"),
  identityRequestMatches: document.querySelector("#identityRequestMatches"),
  identityRequestStatus: document.querySelector("#identityRequestStatus"),
  myRequestList: document.querySelector("#myRequestList"),
  curatorQueue: document.querySelector("#curatorQueue"),
};

const ui = {
  en: {
    prototype: "GARDENPEDIA · SHARED KNOWLEDGE", title: "Gardenpedia", labStatus: "Garden X account", install: "Install",
    kicker: "Curated Garden knowledge, connected to your account.",
    heroTitle: "Shared growing knowledge and your personal inventory, without mixing their facts.",
    heroBody: "Gardenpedia provides curated identities and growing guidance. My Seeds and My Machines show the private items in your Garden X account.",
    labProofExperiment: "Curated knowledge", labProofUserZero: "Your Garden X account", labProofSeparation: "Separate sources of truth",
    guideTab: "Guide", seedsTab: "Seeds", guideEyebrow: "GARDEN LIBRARY · GUIDE", guideTitle: "Grow Guide", guideIntro: "Structured knowledge for knowing when, where and how much to intervene in each crop.",
    seedsEyebrow: "GARDENPEDIA · MY SEEDS", seedsTitle: "My seeds", seedsIntro: "Your private seed packages, linked to shared Gardenpedia identities when you confirm a match.",
    evidenceLegend: "Evidence legend", sourceBacked: "Source-backed", gardenAdaptation: "Garden adaptation", needsValidation: "Needs validation",
    searchPlaceholder: "Search basil, albahaca, lettuce, Jolly Jester…", filterLabel: "Guide filters", library: "GARDENPEDIA LIBRARY", version: "43 identities · ES/EN",
    requestEyebrow: "GARDENPEDIA · REQUEST", requestTitle: "What would you like to add?", requestSubtitle: "Search published identities first. Choose a match or request research.", requestPlaceholder: "Plant, variety or seed…", requestUseIdentity: "Use this identity", requestDifferentIdentity: "None of these? Request this identity", myRequests: "My Gardenpedia requests", noRequests: "No requests yet.", curatorReview: "Curator review", curatorIntro: "Research drafts are suggestions. Review evidence before approval.", refreshStatus: "Refresh status", research: "Research", researching: "Researching…", review: "Review proposal", approve: "Approve", reject: "Reject", returnResearch: "Return for research", exportBundle: "Download publication bundle", openPublicationWorkflow: "Open publication workflow", publicationReference: "Publication pull request URL", markPublishing: "Track publication", markPublicationFailed: "Record publication issue", publicationFailureNote: "Describe the validation or publication issue", publicationFailureRequired: "Add a short issue note before recording it.", publicationStarted: "Publication is being tracked.", publicationHelp: "Download the approved bundle, run the versioned publication workflow, then merge its pull request after review. The public catalog sync marks it published.", status_requested: "Requested", status_researching: "Researching", status_research_failed: "Could not document yet", status_proposal_ready: "Ready to review", status_needs_revision: "Needs another review", status_approved: "Approved", status_publishing: "Publishing", status_declined: "Not moving forward", status_published: "Published", status_in_review: "Ready to review", status_rejected: "Needs review", status_not_started: "Not started", status_bundle_ready: "Bundle ready", status_publication_failed: "Publication needs attention", status_publication_published: "Published", identityHeading: "Identity", growGuideHeading: "Grow Guide", compatibilityHeading: "Compatibility", sourcesHeading: "Sources / Evidence", unknownHeading: "Unknown / pending", curatorOnly: "Curator access required.", deletePackage: "Delete package", confirmDeletePackage: "Delete this seed package? This cannot be undone.", noLibraryMatchRequest: "No catalog match. Request this plant or variety from Gardenpedia.", requestSent: "Request sent to Gardenpedia.", requestFailed: "Could not send the request. Sign in to your Garden X account and try again.",
    allPlants: "All", plant: "variety", plants: "varieties", guide: "guide", noMatches: "No variety matches that search yet.", unavailable: "Guide unavailable", loadError: "The prototype data could not be loaded.", close: "Close guide", avoid: "Avoid", context: "Context", confidence: "Confidence",
    confidence_high: "high", confidence_medium: "medium", confidence_pending: "pending",
    visualGuide: "Visual guide", visualGuideNote: "External references selected for the action itself — not decorative plant photos.", openSource: "Open source", sourceLinkOnly: "Open at source", rightsReview: "Rights review before production", externalReference: "External reference",
    media_photo: "Photo", media_diagram: "Diagram", media_video: "Video", media_guide: "Guide",
    actions: { thinning: "Thinning", pruning: "Pruning", harvest: "Harvest", flowering: "Flowering", hydroponics: "Hydroponics" },
    categories: { herbs: "herbs", "leafy greens": "leafy greens", fruiting: "fruiting", flowers: "flowers", alliums: "alliums", "root vegetables": "root vegetables" },
    sections: { identity: "Identity", germination: "Germination", thinning: "Thinning", pruning: "Pruning", harvest: "Harvest", flowering: "Flowering / bolting", hydroponics: "Hydroponics", problems: "Common issues" },
    ownedSeed: "In your seed inventory", packetArchived: "Packet documented · removed from active inventory", packet: "Packet", germinationRate: "Packet germination rate", purity: "Purity", seedCount: "Approx. seeds", daysToBloom: "Days to bloom", daysToHarvest: "Days to harvest", packetEvidence: "Inventory fact from your packet photo", openInSeeds: "Open in Seeds",
    neighbors: "Neighbors", neighborsNote: "Garden scores real growing compatibility first. A traditional companion claim is only promoted when a credible source supports it.", goodNeighbors: "Good neighbors", separateNeighbors: "Better separate", noStrongGood: "No strong positive matches yet.", noStrongBad: "No strong separation flags yet.", researchPair: "Research-backed companion pair", systemPair: "System-fit inference", nearbyRole: "Useful nearby outdoors", neighborDisclaimer: "‘Better separate’ usually means poor light / space / root / nutrient fit — not that one plant chemically harms the other.", shareSystem:"Can share a system", manageSpacing:"Compatible with spacing management", keepSeparate:"Prefer separate systems / zones", outdoorNearby:"Keep nearby outdoors",
    addSeed: "+ Add seed", seedSearchPlaceholder: "Search tomato, basil, Ferry-Morse…", seedInventoryEyebrow: "MY PRIVATE INVENTORY", seedStorageNote: "Private packages synced with your Garden X account", seedPackage: "package", seedPackages: "packages", noSeedMatches: "No seed packages match this view.", signInRequired: "Sign in to Garden X to see your private seed packages.", seedStorageError: "Your seed packages could not be loaded. Try again before changing your inventory.", legacyImportTitle: "Personal inventory found on this device", legacyImportBody: "Import the saved Garden X/Garden Labs inventory into your account. Existing local data will remain on this device.", importLegacy: "Import existing inventory", importingLegacy: "Importing…", identitySuggestions: "Gardenpedia matches — choose one to link", noIdentityMatch: "No catalog match. You can keep this package unresolved.", requestToGardenpedia: "Request to Gardenpedia", requestSent: "Request sent to Gardenpedia.", privatePackage: "Private package", selectedIdentity: "Linked identity", unresolvedPackage: "Unresolved identity", saveError: "Could not save. Your package has not been changed.",
    seedFilters: { all: "All", opened: "Opened", unopened: "Unopened", low: "Low inventory", unset: "Needs status", removed: "Removed" },
    seedStatus: { opened: "Opened", unopened: "Unopened", unknown: "Not set" },
    quantity: { full: "Full", high: "High", medium: "Medium", low: "Low", almost_empty: "Almost empty", unknown: "Not set" },
    locationUnset: "Location not set", viewGuide: "View guide", editSeed: "Edit package", newSeed: "Add seed package", personalState: "Private package details", personalStateNote: "These details belong to your package and do not change Gardenpedia knowledge.",
    plantVariety: "Plant / variety", brand: "Brand", packageStatus: "Package status", quantityLevel: "Approx. quantity", storageLocation: "Storage location", purchaseYear: "Purchase year", germinationTestDate: "Last germination test", germinationResult: "Germination result %", notes: "Notes", optional: "Optional", save: "Save", cancel: "Cancel", removeInventory: "Remove from inventory", restoreInventory: "Restore to inventory", deleteCustom: "Delete seed", customSeedNote: "Custom Lab seed. It has no Grow Guide link until identity is reconciled.", duplicateWarning: "Possible duplicate already in inventory: ", requiredName: "Plant / variety is required.", localOnly: "Stored locally in Garden Labs on this device.",
  },
  es: {
    prototype: "GARDENPEDIA · CONOCIMIENTO COMPARTIDO", title: "Gardenpedia", labStatus: "Cuenta Garden X", install: "Instalar",
    kicker: "Conocimiento curado de Garden, conectado con tu cuenta.",
    heroTitle: "Conocimiento de cultivo e inventario personal, sin mezclar sus datos.",
    heroBody: "Gardenpedia aporta identidades y guías de cultivo curadas. Mis semillas y Mis máquinas muestran los elementos privados de tu cuenta Garden X.",
    labProofExperiment: "Conocimiento curado", labProofUserZero: "Tu cuenta Garden X", labProofSeparation: "Fuentes de verdad separadas",
    guideTab: "Guía", seedsTab: "Semillas", guideEyebrow: "GARDEN LIBRARY · GUÍA", guideTitle: "Grow Guide", guideIntro: "Conocimiento estructurado para saber cuándo, dónde y cuánto intervenir en cada cultivo.",
    seedsEyebrow: "GARDENPEDIA · MIS SEMILLAS", seedsTitle: "Mis semillas", seedsIntro: "Paquetes privados de tu cuenta, vinculados a identidades Gardenpedia cuando confirmas una coincidencia.",
    evidenceLegend: "Leyenda de evidencia", sourceBacked: "Respaldado por fuente", gardenAdaptation: "Adaptación de Garden", needsValidation: "Necesita validación",
    searchPlaceholder: "Busca albahaca, basil, lechuga, Jolly Jester…", filterLabel: "Filtros de la guía", library: "BIBLIOTECA GARDENPEDIA", version: "43 identidades · ES/EN",
    requestEyebrow: "GARDENPEDIA · SOLICITUD", requestTitle: "¿Qué quieres agregar?", requestSubtitle: "Busca primero las identidades publicadas. Elige una coincidencia o solicita investigación.", requestPlaceholder: "Planta, variedad o semilla…", requestUseIdentity: "Usar esta identidad", requestDifferentIdentity: "¿No es ninguna? Solicitar esta identidad", myRequests: "Mis solicitudes a Gardenpedia", noRequests: "Todavía no hay solicitudes.", curatorReview: "Revisión de curaduría", curatorIntro: "Los borradores de investigación son propuestas. Revisa la evidencia antes de aprobar.", refreshStatus: "Actualizar estado", research: "Investigar", researching: "Investigando…", review: "Revisar propuesta", approve: "Aprobar", reject: "Rechazar", returnResearch: "Devolver para investigar", exportBundle: "Descargar paquete de publicación", openPublicationWorkflow: "Abrir flujo de publicación", publicationReference: "URL del pull request de publicación", markPublishing: "Registrar publicación", markPublicationFailed: "Registrar problema de publicación", publicationFailureNote: "Describe el problema de validación o publicación", publicationFailureRequired: "Escribe una nota breve antes de registrarlo.", publicationStarted: "Se está siguiendo la publicación.", publicationHelp: "Descarga el paquete aprobado, ejecuta el flujo de publicación versionado y revisa su pull request antes de fusionarlo. La sincronización del catálogo marcará la identidad como publicada.", status_requested: "Solicitado", status_researching: "Investigando", status_research_failed: "No se pudo documentar todavía", status_proposal_ready: "Listo para revisar", status_needs_revision: "Requiere otra revisión", status_approved: "Aprobado", status_publishing: "Publicando", status_declined: "No continuará", status_published: "Publicado", status_in_review: "Listo para revisar", status_rejected: "Requiere revisión", status_not_started: "Sin iniciar", status_bundle_ready: "Paquete listo", status_publication_failed: "La publicación requiere atención", status_publication_published: "Publicado", identityHeading: "Identidad", growGuideHeading: "Grow Guide", compatibilityHeading: "Compatibilidad", sourcesHeading: "Fuentes / evidencia", unknownHeading: "Desconocido / pendiente", curatorOnly: "Se requiere acceso de curador.", deletePackage: "Eliminar paquete", confirmDeletePackage: "¿Eliminar este paquete de semillas? No se puede deshacer.", noLibraryMatchRequest: "No hay coincidencia en el catálogo. Solicita esta planta o variedad a Gardenpedia.", requestSent: "Solicitud enviada a Gardenpedia.", requestFailed: "No se pudo enviar. Inicia sesión en Garden X y vuelve a intentarlo.",
    allPlants: "Todas", plant: "variedad", plants: "variedades", guide: "ficha", noMatches: "Todavía no hay una variedad que coincida con esa búsqueda.", unavailable: "Guía no disponible", loadError: "No se pudieron cargar los datos del prototipo.", close: "Cerrar guía", avoid: "Evitar", context: "Contexto", confidence: "Confianza",
    confidence_high: "alta", confidence_medium: "media", confidence_pending: "pendiente",
    visualGuide: "Guía visual", visualGuideNote: "Referencias externas elegidas por la acción que enseñan, no como fotos decorativas de la planta.", openSource: "Abrir fuente", sourceLinkOnly: "Ver en la fuente", rightsReview: "Revisar derechos antes de producción", externalReference: "Referencia externa",
    media_photo: "Foto", media_diagram: "Diagrama", media_video: "Video", media_guide: "Guía",
    actions: { thinning: "Raleo", pruning: "Poda", harvest: "Cosecha", flowering: "Floración", hydroponics: "Hidroponía" },
    categories: { herbs: "hierbas", "leafy greens": "hojas verdes", fruiting: "cultivos de fruto", flowers: "flores", alliums: "alliums", "root vegetables": "raíces" },
    sections: { identity: "Identidad", germination: "Germinación", thinning: "Raleo", pruning: "Poda", harvest: "Cosecha", flowering: "Floración / espigado", hydroponics: "Hidroponía", problems: "Problemas comunes" },
    ownedSeed: "En tu inventario de semillas", packetArchived: "Sobre documentado · retirado del inventario activo", packet: "Sobre", germinationRate: "Germinación del sobre", purity: "Pureza", seedCount: "Semillas aprox.", daysToBloom: "Días a floración", daysToHarvest: "Días a cosecha", packetEvidence: "Dato de inventario leído de tu foto del sobre", openInSeeds: "Abrir en Semillas",
    neighbors: "Vecinas", neighborsNote: "Garden prioriza compatibilidad real de cultivo. Una asociación tradicional solo sube de nivel cuando una fuente confiable la respalda.", goodNeighbors: "Buenas vecinas", separateNeighbors: "Mejor separar", noStrongGood: "Todavía no hay coincidencias positivas fuertes.", noStrongBad: "No hay alertas fuertes de separación.", researchPair: "Pareja respaldada por investigación", systemPair: "Inferencia por compatibilidad del sistema", nearbyRole: "Útil cerca en exterior", neighborDisclaimer: "‘Mejor separar’ normalmente significa mala combinación de luz / espacio / raíces / nutrientes; no que una planta envenene químicamente a la otra.", shareSystem:"Pueden compartir sistema", manageSpacing:"Compatibles manejando el espacio", keepSeparate:"Preferir sistemas / zonas separadas", outdoorNearby:"Mantener cerca en exterior",
    addSeed: "+ Añadir semilla", seedSearchPlaceholder: "Busca tomate, basil, Ferry-Morse…", seedInventoryEyebrow: "MI INVENTARIO PRIVADO", seedStorageNote: "Paquetes privados sincronizados con tu cuenta Garden X", seedPackage: "paquete", seedPackages: "paquetes", noSeedMatches: "No hay paquetes que coincidan con esta vista.", signInRequired: "Inicia sesión en Garden X para ver tus paquetes privados de semillas.", seedStorageError: "No se pudieron cargar tus paquetes. Vuelve a intentarlo antes de cambiar el inventario.", legacyImportTitle: "Hay inventario personal guardado en este dispositivo", legacyImportBody: "Importa el inventario existente de Garden X/Garden Labs a tu cuenta. Los datos locales permanecerán en este dispositivo.", importLegacy: "Importar inventario existente", importingLegacy: "Importando…", identitySuggestions: "Coincidencias en Gardenpedia — elige una para vincular", noIdentityMatch: "No hay coincidencia en el catálogo. Puedes conservar el paquete sin resolver.", requestToGardenpedia: "Solicitar a Gardenpedia", requestSent: "Solicitud enviada a Gardenpedia.", privatePackage: "Paquete privado", selectedIdentity: "Identidad vinculada", unresolvedPackage: "Identidad sin resolver", saveError: "No se pudo guardar. El paquete no se modificó.",
    seedFilters: { all: "Todas", opened: "Abiertas", unopened: "Sin abrir", low: "Poco inventario", unset: "Sin definir", removed: "Retiradas" },
    seedStatus: { opened: "Abierto", unopened: "Sin abrir", unknown: "Sin definir" },
    quantity: { full: "Full", high: "High", medium: "Medium", low: "Low", almost_empty: "Almost empty", unknown: "Sin definir" },
    locationUnset: "Ubicación sin definir", viewGuide: "Ver guía", editSeed: "Editar paquete", newSeed: "Añadir paquete de semillas", personalState: "Detalles del paquete privado", personalStateNote: "Estos datos pertenecen a tu paquete y no modifican el conocimiento de Gardenpedia.",
    plantVariety: "Planta / variedad", brand: "Marca", packageStatus: "Estado del paquete", quantityLevel: "Cantidad aproximada", storageLocation: "Ubicación", purchaseYear: "Año de compra", germinationTestDate: "Último test de germinación", germinationResult: "Resultado germinación %", notes: "Notas", optional: "Opcional", save: "Guardar", cancel: "Cancelar", removeInventory: "Quitar del inventario", restoreInventory: "Restaurar al inventario", deleteCustom: "Eliminar semilla", customSeedNote: "Semilla añadida en el Lab. No tiene vínculo a Grow Guide hasta reconciliar su identidad.", duplicateWarning: "Posible duplicado ya en inventario: ", requiredName: "Planta / variedad es obligatorio.", localOnly: "Guardado localmente en Garden Labs en este dispositivo.",
  },
};

const sectionIcons = { identity: "🔬", germination: "🌱", thinning: "✂️", pruning: "🌿", harvest: "🥬", flowering: "🌸", hydroponics: "💧", problems: "⚠️" };
const evidenceClasses = { source_backed: "source-backed", garden_adaptation: "garden-adaptation", needs_validation: "needs-validation" };
const visualIcons = { photo: "📷", diagram: "✂️", video: "▶", guide: "📖" };

async function init() {
  if (window.GARDEN_LABS_STORAGE_HYDRATE) await window.GARDEN_LABS_STORAGE_HYDRATE(state);
  if (window.GARDEN_HARVEST_USE?.load) await window.GARDEN_HARVEST_USE.load();
  const [pilotPlantResponse, currentPlantResponse, ownedPlantResponse, requestPlantResponse, sourceResponse, currentSourceResponse, ownedSourceResponse, requestSourceResponse, spanishResponse, ownedSpanishResponse, requestSpanishResponse, visualsResponse, inventoryResponse, neighborResponse] = await Promise.all([
    fetch(assetUrl("data/plants.json")),
    fetch(assetUrl("data/plants-current-gardens.json")),
    fetch(assetUrl("data/plants-owned-seeds.json")),
    fetch(assetUrl("data/plants-requests.json")),
    fetch(assetUrl("data/sources.json")),
    fetch(assetUrl("data/sources-current-gardens.json")),
    fetch(assetUrl("data/sources-owned-seeds.json")),
    fetch(assetUrl("data/sources-requests.json")),
    fetch(assetUrl("data/translations-es.json")),
    fetch(assetUrl("data/translations-owned-seeds-es.json")),
    fetch(assetUrl("data/translations-requests-es.json")),
    fetch(assetUrl("data/visuals.json")),
    fetch(assetUrl("data/seed-inventory.json")),
    fetch(assetUrl("data/neighbor-profiles.json")),
  ]);

  state.plants = [...await pilotPlantResponse.json(), ...await currentPlantResponse.json(), ...await ownedPlantResponse.json(), ...await requestPlantResponse.json()];
  const sources = [...await sourceResponse.json(), ...await currentSourceResponse.json(), ...await ownedSourceResponse.json(), ...await requestSourceResponse.json()];
  state.sources = Object.fromEntries(sources.map((source) => [source.id, source]));
  state.translations = { ...await spanishResponse.json(), ...await ownedSpanishResponse.json(), ...await requestSpanishResponse.json() };
  state.visuals = await visualsResponse.json();
  const inventory = await inventoryResponse.json();
  state.seedInventory = Object.fromEntries(inventory.items.map((item) => [item.plantId, item]));
  state.neighborData = await neighborResponse.json();
  if (state.accountMode === "signed_out" && refs.seedsTab) refs.seedsTab.hidden = true;
  if (state.accountMode === "ready" && refs.seedsTab) refs.seedsTab.hidden = false;
  bindEvents();
  applyLanguage();
  switchView(state.view, false);
  void loadGardenpediaWorkflow();
  const requestedPlantId = decodeURIComponent(window.location.hash.replace(/^#/, "")).trim();
  const requestedPlant = state.plants.find((plant) => plant.id === requestedPlantId);
  if (requestedPlant) requestAnimationFrame(() => openPlant(requestedPlant));
  window.GARDENPEDIA_READY = true;
  window.dispatchEvent(new Event("gardenpedia:ready"));
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
  refs.identityRequestInput?.addEventListener("input", renderIdentityRequestMatches);
  refs.identityRequestForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitIdentityRequest();
  });
  document.querySelector("#refreshGardenpediaWorkflow")?.addEventListener("click", refreshGardenpediaWorkflow);
  refs.detail.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-seed-open]");
    if (!jump) return;
    const seedId = jump.dataset.seedOpen;
    refs.dialog.close();
    switchView("seeds");
    openSeedEditor(seedId);
  });
}

function renderIdentityRequestMatches() {
  const input = refs.identityRequestInput;
  const target = refs.identityRequestMatches;
  if (!input || !target) return;
  const query = input.value.trim();
  const matches = window.GardenpediaIdentityResolver?.search(query, state.plants) || [];
  target.innerHTML = matches.slice(0, 6).map((plant) => {
    const identity = window.GardenpediaIdentityResolver.describe(plant);
    const aliases = identity.aliases.slice(0, 3).join(" · ");
    return `<button type="button" class="identity-candidate" data-library-identity="${escapeAttribute(plant.id)}"><strong>${escapeHtml(identity.displayName)}</strong><span>${escapeHtml([identity.cultivar, identity.species, aliases].filter(Boolean).join(" · "))}</span><small>${escapeHtml(ui[state.language].requestUseIdentity)}</small></button>`;
  }).join("");
  target.querySelectorAll("[data-library-identity]").forEach((button) => button.addEventListener("click", () => {
    const plant = state.plants.find((item) => item.id === button.dataset.libraryIdentity);
    if (plant) openPlant(plant);
  }));
  if (query && !window.GardenpediaIdentityResolver?.exactMatch(query, state.plants)) {
    target.insertAdjacentHTML("beforeend", `<p class="seed-form-note">${escapeHtml(ui[state.language].noIdentityMatch)}</p><button type="button" class="seed-action-button secondary" id="requestDifferentIdentity">${escapeHtml(ui[state.language].requestDifferentIdentity)}</button>`);
    target.querySelector("#requestDifferentIdentity")?.addEventListener("click", () => submitIdentityRequest());
  }
}

async function submitIdentityRequest() {
  const query = refs.identityRequestInput?.value.trim();
  if (!query || !refs.identityRequestStatus) return;
  const hasExactMatch = window.GardenpediaIdentityResolver?.exactMatch(query, state.plants) || false;
  if (hasExactMatch) {
    refs.identityRequestStatus.textContent = ui[state.language].identitySuggestions;
    return;
  }
  try {
    await window.GARDENPEDIA_ACCOUNT.createRequest(query);
    refs.identityRequestStatus.textContent = ui[state.language].requestSent;
    refs.identityRequestInput.value = "";
    refs.identityRequestMatches.innerHTML = "";
    await refreshGardenpediaWorkflow();
  } catch (error) {
    console.warn("Gardenpedia request could not be created", error);
    refs.identityRequestStatus.textContent = ui[state.language].requestFailed;
  }
}

async function loadGardenpediaWorkflow() {
  if (!window.GARDENPEDIA_ACCOUNT || state.accountMode !== "ready") {
    const details = document.querySelector("#myRequestDetails");
    if (details) details.hidden = true;
    return;
  }
  try {
    const [requests, curator] = await Promise.all([
      window.GARDENPEDIA_ACCOUNT.listRequests(),
      window.GARDENPEDIA_ACCOUNT.curatorStatus(),
    ]);
    state.requests = Array.isArray(requests.requests) ? requests.requests : [];
    state.isCurator = curator.isCurator === true;
    document.querySelector("#myRequestDetails").hidden = false;
    document.querySelector("#curatorReviewDetails").hidden = !state.isCurator;
    if (state.isCurator) {
      const queue = await window.GARDENPEDIA_ACCOUNT.curatorQueue();
      state.curatorQueue = Array.isArray(queue.requests) ? queue.requests : [];
    }
    renderGardenpediaWorkflow();
  } catch (error) {
    console.warn("Gardenpedia request status unavailable", error);
  }
}

async function refreshGardenpediaWorkflow() {
  const button = document.querySelector("#refreshGardenpediaWorkflow");
  if (button) button.disabled = true;
  try {
    // This public GET refreshes the deployment-synced catalog cache; no private rows are returned.
    await fetch("/api/garden-library/catalog", { cache: "no-store" });
    await loadGardenpediaWorkflow();
  } finally {
    if (button) button.disabled = false;
  }
}

function statusText(status, publicationStatus) {
  const text = ui[state.language];
  const publicationProgress = ["publishing", "publication_failed", "published"].includes(publicationStatus);
  const key = publicationProgress ? `status_publication_${publicationStatus}` : `status_${status}`;
  return text[key] || text[`status_${status}`] || status;
}

function renderGardenpediaWorkflow() {
  const text = ui[state.language];
  if (refs.myRequestList) {
    refs.myRequestList.innerHTML = state.requests.length ? state.requests.map((request) => {
      const proposal = request.proposals?.[0];
      return `<article class="request-card"><div class="request-card-heading"><h4>${escapeHtml(request.requestedText)}</h4><span class="request-status">${escapeHtml(statusText(request.status, proposal?.publicationStatus))}</span></div>${proposal?.candidateIdentity?.scientificName ? `<p>${escapeHtml(proposal.candidateIdentity.scientificName)}${proposal.candidateIdentity.cultivar ? ` · ${escapeHtml(proposal.candidateIdentity.cultivar)}` : ""}</p>` : ""}</article>`;
    }).join("") : `<p class="muted">${escapeHtml(text.noRequests)}</p>`;
  }
  if (!refs.curatorQueue) return;
  refs.curatorQueue.innerHTML = state.curatorQueue.map((request) => {
    const proposal = request.proposals?.[0];
    const research = ["requested", "research_failed", "needs_revision"].includes(request.status)
      ? `<button class="seed-action-button" type="button" data-research-request="${escapeAttribute(request.id)}">${escapeHtml(text.research)}</button>` : "";
    return `<article class="request-card"><div class="request-card-heading"><h4>${escapeHtml(request.requestedText)}</h4><span class="request-status">${escapeHtml(statusText(request.status, proposal?.publicationStatus))}</span></div>${research}${proposal ? buildProposalReview(request, proposal) : ""}</article>`;
  }).join("") || `<p class="muted">${escapeHtml(text.noRequests)}</p>`;
  refs.curatorQueue.querySelectorAll("[data-research-request]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true; button.textContent = text.researching;
    try { await window.GARDENPEDIA_ACCOUNT.researchRequest(button.dataset.researchRequest); await loadGardenpediaWorkflow(); }
    catch (error) { console.warn("Gardenpedia research failed", error); button.disabled = false; button.textContent = text.research; }
  }));
  refs.curatorQueue.querySelectorAll("[data-proposal-decision]").forEach((button) => button.addEventListener("click", async () => {
    const proposalId = button.dataset.proposalId;
    button.disabled = true;
    try {
      if (button.dataset.proposalDecision === "approve") await window.GARDENPEDIA_ACCOUNT.approveProposal(proposalId);
      else await window.GARDENPEDIA_ACCOUNT.reviewProposal(proposalId, button.dataset.proposalDecision, refs.curatorQueue.querySelector(`[data-review-note="${proposalId}"]`)?.value || "");
      await loadGardenpediaWorkflow();
    } catch (error) { console.warn("Gardenpedia review action failed", error); button.disabled = false; }
  }));
  refs.curatorQueue.querySelectorAll("[data-export-proposal]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const bundle = await window.GARDENPEDIA_ACCOUNT.exportPublicationBundle(button.dataset.exportProposal);
      downloadPublicationBundle(bundle);
      await loadGardenpediaWorkflow();
    } catch (error) { console.warn("Publication bundle export failed", error); button.disabled = false; }
  }));
  refs.curatorQueue.querySelectorAll("[data-publishing-proposal]").forEach((button) => button.addEventListener("click", async () => {
    const proposalId = button.dataset.publishingProposal;
    const input = refs.curatorQueue.querySelector(`[data-publication-reference="${proposalId}"]`);
    try { await window.GARDENPEDIA_ACCOUNT.publicationStarted(proposalId, input.value.trim()); await loadGardenpediaWorkflow(); }
    catch (error) { console.warn("Could not record publication pull request", error); input.setCustomValidity(text.publicationReference); input.reportValidity(); }
  }));
  refs.curatorQueue.querySelectorAll("[data-publication-failed]").forEach((button) => button.addEventListener("click", async () => {
    const proposalId = button.dataset.publicationFailed;
    const input = refs.curatorQueue.querySelector(`[data-publication-error="${proposalId}"]`);
    const note = input.value.trim();
    if (!note) { input.setCustomValidity(text.publicationFailureRequired); input.reportValidity(); return; }
    input.setCustomValidity("");
    button.disabled = true;
    try { await window.GARDENPEDIA_ACCOUNT.publicationFailed(proposalId, note); await loadGardenpediaWorkflow(); }
    catch (error) { console.warn("Could not record publication issue", error); button.disabled = false; }
  }));
}

function buildProposalReview(request, proposal) {
  const text = ui[state.language];
  const data = proposal.proposedData || {};
  const plant = data.plant || {};
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const sections = plant.sections || {};
  const evidence = Object.entries(sections).map(([key, section]) => `<li><strong>${escapeHtml(text.sections[key] || key)}</strong>: ${escapeHtml(section.short || section.guidance || "")}</li>`).join("");
  const profile = plant.compatibilityProfile || data.compatibilityProfile;
  const unknowns = data.unknowns || [];
  const sourceList = sources.map((source) => `<li><a href="${escapeAttribute(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || source.url)}</a><span> · ${escapeHtml(source.publisher || new URL(source.url).hostname)}</span></li>`).join("");
  const actions = proposal.reviewStatus === "in_review"
    ? `<textarea data-review-note="${escapeAttribute(proposal.id)}" rows="2" maxlength="1000" placeholder="${escapeAttribute(text.optional)}"></textarea><button class="seed-action-button" data-proposal-decision="approve" data-proposal-id="${escapeAttribute(proposal.id)}" type="button">${escapeHtml(text.approve)}</button><button class="seed-action-button secondary" data-proposal-decision="revise" data-proposal-id="${escapeAttribute(proposal.id)}" type="button">${escapeHtml(text.returnResearch)}</button><button class="seed-danger-button" data-proposal-decision="reject" data-proposal-id="${escapeAttribute(proposal.id)}" type="button">${escapeHtml(text.reject)}</button>`
    : proposal.reviewStatus === "approved" && proposal.publicationStatus !== "published"
      ? `<button class="seed-action-button" type="button" data-export-proposal="${escapeAttribute(proposal.id)}">${escapeHtml(text.exportBundle)}</button><p class="seed-form-note">${escapeHtml(text.publicationHelp)}</p><a class="seed-action-button secondary" href="https://github.com/juangaudino/streex-garden/actions/workflows/gardenpedia-publication.yml" target="_blank" rel="noopener noreferrer">${escapeHtml(text.openPublicationWorkflow)}</a><input data-publication-reference="${escapeAttribute(proposal.id)}" type="url" maxlength="300" value="${escapeAttribute(proposal.publicationReference || "")}" placeholder="${escapeAttribute(text.publicationReference)}"/><button class="seed-action-button secondary" type="button" data-publishing-proposal="${escapeAttribute(proposal.id)}">${escapeHtml(text.markPublishing)}</button><textarea data-publication-error="${escapeAttribute(proposal.id)}" rows="2" maxlength="1000" placeholder="${escapeAttribute(text.publicationFailureNote)}"></textarea><button class="seed-danger-button" type="button" data-publication-failed="${escapeAttribute(proposal.id)}">${escapeHtml(text.markPublicationFailed)}</button>`
      : "";
  return `<article class="proposal-review-card"><p class="eyebrow">${escapeHtml(text.review)} · ${escapeHtml(proposal.contractName)} ${escapeHtml(proposal.contractVersion)}</p><h4>${escapeHtml(plant.name || proposal.candidateIdentity?.name || request.requestedText)}</h4><p>${escapeHtml([plant.scientificName || proposal.candidateIdentity?.scientificName, plant.variety || proposal.candidateIdentity?.cultivar].filter(Boolean).join(" · "))}</p><span class="request-status">${escapeHtml(statusText(proposal.reviewStatus, proposal.publicationStatus))}</span><details><summary>${escapeHtml(text.identityHeading)}</summary><p>${escapeHtml(plant.summary || "")}</p><p>${escapeHtml(proposal.candidateIdentity?.identityNote || "")}</p></details><details><summary>${escapeHtml(text.growGuideHeading)}</summary><ul>${evidence}</ul></details><details><summary>${escapeHtml(text.compatibilityHeading)}</summary><pre>${escapeHtml(JSON.stringify(profile || {}, null, 2))}</pre></details><details><summary>${escapeHtml(text.unknownHeading)}</summary><pre>${escapeHtml(JSON.stringify(unknowns, null, 2))}</pre></details><details><summary>${escapeHtml(text.sourcesHeading)} · ${sources.length}</summary><ul class="source-list">${sourceList}</ul></details>${proposal.publicationError ? `<p class="proposal-error" role="alert">${escapeHtml(proposal.publicationError)}</p>` : ""}<div class="proposal-actions">${actions}</div></article>`;
}

function downloadPublicationBundle(bundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gardenpedia-proposal-${bundle.proposalId}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
  document.querySelector("#seedsSurface .surface-intro h2")?.replaceChildren(document.createTextNode(text.seedsTitle));
  const seedIntro = document.querySelector("#seedsSurface .surface-intro p:last-child");
  if (seedIntro) seedIntro.textContent = text.seedsIntro;
  refs.addSeedButton.textContent = text.addSeed;
  document.querySelector("#seedsSurface .surface-intro .eyebrow")?.replaceChildren(document.createTextNode(text.seedsEyebrow));
  document.querySelector("#seedsSurface .seed-section-heading .eyebrow")?.replaceChildren(document.createTextNode(text.seedInventoryEyebrow));
  document.querySelector("#seedsSurface .seed-section-heading .muted")?.replaceChildren(document.createTextNode(text.seedStorageNote));
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
  state.view = view === "seeds" && state.accountMode !== "signed_out" ? "seeds" : "guide";
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
  const matched = state.query && window.GardenpediaIdentityResolver
    ? new Set(window.GardenpediaIdentityResolver.search(state.query, state.plants))
    : null;
  return state.plants.filter((plant) => {
    const categoryMatch = state.category === "all" || plant.category === state.category;
    return categoryMatch && (!state.query || (matched ? matched.has(plant) : false));
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
  const qualityOverview = document.querySelector("#qualityOverview");
  if (qualityOverview && window.GARDEN_KNOWLEDGE) qualityOverview.innerHTML = window.GARDEN_KNOWLEDGE.overview(state.plants, state.language);
  if (!plants.length) {
    refs.plantGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.noMatches)}${state.query ? `<p>${escapeHtml(text.noLibraryMatchRequest)}</p><button type="button" class="seed-action-button secondary" id="requestLibraryIdentity">${escapeHtml(text.requestToGardenpedia)}</button><p id="libraryRequestResult" role="status" aria-live="polite"></p>` : ""}</div>`;
    refs.plantGrid.querySelector("#requestLibraryIdentity")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await window.GARDENPEDIA_ACCOUNT.createRequest(state.query);
        refs.plantGrid.querySelector("#libraryRequestResult").textContent = text.requestSent;
      } catch (error) {
        console.warn("Gardenpedia request could not be created", error);
        button.disabled = false;
        refs.plantGrid.querySelector("#libraryRequestResult").textContent = text.requestFailed;
      }
    });
    return;
  }
  plants.forEach((plant) => {
    const localized = getLocalizedPlant(plant);
    const primaryName = state.language === "es" ? (plant.spanishName || plant.name) : plant.name;
    const secondaryName = state.language === "es" ? (plant.spanishName ? plant.name : "") : plant.spanishName;
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
  const harvestUse = window.GARDEN_HARVEST_USE?.render?.(plant.id, state.language) || "";
  const growTimeline = window.GARDEN_KNOWLEDGE?.timeline?.(plant, state.language) || "";
  const evidenceHealth = window.GARDEN_KNOWLEDGE?.health?.(plant, state.language) || "";
  const sections = Object.keys(sectionIcons).filter((key) => localized.sections?.[key]).map((key) => buildSection(localized.sections[key], key, false)).join("");
  return `<section class="detail-hero"><div class="detail-icon">${plant.emoji}</div><div class="detail-title"><p class="plant-spanish">${escapeHtml(secondaryName)}</p><h2>${escapeHtml(primaryName)}</h2><p class="scientific">${escapeHtml(plant.scientificName)}</p></div><p class="detail-summary">${escapeHtml(localized.summary)}</p></section>${seedCard}<section class="quick-facts">${metrics}</section>${growTimeline}${evidenceHealth}${harvestUse}${neighbors}${visuals}<section class="guide-stack">${sections}</section>`;
}

function buildSeedInventoryCard(plantId) {
  const seed = state.seedInventory[plantId];
  const text = ui[state.language];
  const packages = state.seedPackages.filter((item) => item.libraryPlantId === plantId && !item.archived);
  if (!seed && !packages.length) return "";
  const user = state.seedUserState[plantId] || {};
  const facts = [];
  if (seed) {
    if (seed.germinationRatePct != null) facts.push(`${text.germinationRate}: ${seed.germinationRatePct}%`);
    if (seed.purityPct != null) facts.push(`${text.purity}: ${seed.purityPct}%`);
    if (seed.approxSeedCount != null) facts.push(`${text.seedCount}: ${seed.approxSeedCount}`);
    if (seed.daysToBloom != null) facts.push(`${text.daysToBloom}: ${seed.daysToBloom}`);
    if (seed.daysToHarvest != null) facts.push(`${text.daysToHarvest}: ${seed.daysToHarvest}`);
  }
  const packageCards = packages.map((item) => `<div class="seed-facts"><strong>${escapeHtml(item.seedName)}</strong><span>${escapeHtml(text.seedStatus[item.packageStatus] || text.seedStatus.unknown)}</span><span>${escapeHtml(text.quantity[item.quantityLevel] || text.quantity.unknown)}</span>${item.storageLocation ? `<span>${escapeHtml(item.storageLocation)}</span>` : ""}</div>`).join("");
  const evidence = seed ? `<h3>${escapeHtml(seed.packetName)}</h3><p>${escapeHtml(seed.brand || "")}${seed.packetWeight ? ` · ${escapeHtml(seed.packetWeight)}` : ""}</p>${facts.length ? `<div class="seed-facts">${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div><small>${escapeHtml(text.packetEvidence)}</small>` : ""}` : "";
  return `<section class="seed-inventory-card"><div><p class="eyebrow">🌰 ${escapeHtml(text.ownedSeed)}</p>${evidence}${packageCards}</div><button type="button" class="inventory-jump" data-seed-open="${escapeAttribute(plantId)}">🌰 ${escapeHtml(text.openInSeeds)} →</button></section>`;
}

function getAllSeedRecords() {
  return state.seedPackages.map((item) => ({
    id: item.id, plantId: item.libraryPlantId || null, libraryPlantId: item.libraryPlantId || null,
    packetName: item.seedName, brand: item.brand || "", packageStatus: item.packageStatus || "unknown",
    quantityLevel: item.quantityLevel || "unknown", storageLocation: item.storageLocation || "",
    purchaseYear: item.purchaseYear || "", lastGerminationTestAt: item.germinationTestDate || "",
    lastGerminationResultPct: item.germinationResultPct ?? "", userNotes: item.notes || "",
    archived: Boolean(item.archived), isCustom: true, canonicalPackage: true,
  }));
}

function seedRecordId(seed) {
  return seed.id || seed.plantId;
}

function getSeedById(seedId) {
  return getAllSeedRecords().find((seed) => seedRecordId(seed) === seedId) || null;
}

function isSeedActive(seedId) {
  return state.seedPackages.some((seed) => seed.libraryPlantId === seedId && !seed.archived);
}

function mergeSeedRecord(seed) {
  if (seed.canonicalPackage) return seed;
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
  const notice = document.querySelector("#seedAccountNotice");
  if (state.accountMode === "signed_out") {
    if (refs.seedsTab) refs.seedsTab.hidden = true;
    if (notice) { notice.hidden = false; notice.textContent = text.signInRequired; }
    refs.seedGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.signInRequired)}</div>`;
    refs.seedResultCount.textContent = "0";
    return;
  }
  if (state.accountMode === "error") {
    if (notice) { notice.hidden = false; notice.textContent = text.seedStorageError; }
    refs.seedGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.seedStorageError)}</div>`;
    refs.seedResultCount.textContent = "—";
    return;
  }
  renderSeedAccountNotice();
  const seeds = getFilteredSeeds();
  refs.seedGrid.innerHTML = "";
  refs.seedResultCount.textContent = `${seeds.length} ${seeds.length === 1 ? text.seedPackage : text.seedPackages}`;
  if (!seeds.length) {
    refs.seedGrid.innerHTML = `<div class="empty-state">${escapeHtml(text.noSeedMatches)}</div>`;
    return;
  }
  seeds.forEach((seed) => {
    const plant = seed.libraryPlantId ? state.plants.find((item) => item.id === seed.libraryPlantId) : null;
    const emoji = plant?.emoji || "🌰";
    const statusLabel = seed.archived ? text.seedFilters.removed : text.seedStatus[seed.packageStatus];
    const quantityLabel = text.quantity[seed.quantityLevel];
    const locationLabel = seed.storageLocation || text.locationUnset;
    const article = document.createElement("article");
    article.className = "seed-card";
    article.innerHTML = `<button class="seed-card-main" type="button"><span class="seed-card-emoji">${emoji}</span><span class="seed-card-copy"><h4>${escapeHtml(seed.packetName)}</h4><p>${escapeHtml(seed.brand || text.privatePackage)}${plant ? ` · ${escapeHtml(plant.name)}` : ` · ${escapeHtml(text.unresolvedPackage)}`}</p><span class="seed-status-row"><span class="seed-status-chip ${seed.packageStatus !== "unknown" ? "defined" : ""}">${escapeHtml(statusLabel)}</span><span class="seed-status-chip ${["low", "almost_empty"].includes(seed.quantityLevel) ? "low" : seed.quantityLevel !== "unknown" ? "defined" : ""}">${escapeHtml(quantityLabel)}</span><span class="seed-status-chip ${seed.storageLocation ? "defined" : ""}">⌂ ${escapeHtml(locationLabel)}</span></span></span><span class="seed-card-arrow">→</span></button><div class="seed-card-footer"><small>${escapeHtml(text.privatePackage)}</small>${plant ? `<button class="seed-link-button" type="button">${escapeHtml(text.viewGuide)} ↗</button>` : ""}</div>`;
    article.querySelector(".seed-card-main").addEventListener("click", () => openSeedEditor(seed.id));
    article.querySelector(".seed-link-button")?.addEventListener("click", (event) => {
      event.stopPropagation();
      switchView("guide");
      openPlant(plant);
    });
    refs.seedGrid.append(article);
  });
}

function renderSeedAccountNotice() {
  const notice = document.querySelector("#seedAccountNotice");
  if (!notice) return;
  const text = ui[state.language];
  const importedKey = `gardenpediaSeedLegacyImported:${state.accountUserId || "account"}`;
  const shouldShow = state.accountMode === "ready" && window.GARDENPEDIA_ACCOUNT?.hasLocalLegacyData?.() && !localStorage.getItem(importedKey);
  notice.hidden = !shouldShow;
  if (!shouldShow) return;
  notice.innerHTML = `<strong>${escapeHtml(text.legacyImportTitle)}</strong><p>${escapeHtml(text.legacyImportBody)}</p><button type="button" class="seed-action-button" id="importLegacySeeds">${escapeHtml(text.importLegacy)}</button>`;
  notice.querySelector("#importLegacySeeds").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = text.importingLegacy;
    try {
      const result = await window.GARDENPEDIA_ACCOUNT.reconcileLegacy();
      state.seedPackages = result?.inventory?.packages || [];
      localStorage.setItem(importedKey, "true");
      renderSeeds();
      renderPlants();
    } catch (error) {
      console.warn("Seed inventory reconciliation failed", error);
      button.disabled = false;
      button.textContent = text.importLegacy;
      notice.insertAdjacentHTML("beforeend", `<p role="alert">${escapeHtml(text.saveError)}</p>`);
    }
  });
}

function openSeedEditor(seedId) {
  state.activeSeedId = seedId || "__new__";
  const existing = seedId ? getSeedById(seedId) : null;
  state.selectedSeedIdentityId = existing?.libraryPlantId || existing?.plantId || null;
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

  const identityFields = `<div class="seed-form-grid"><div class="seed-field"><label for="seedName">${escapeHtml(text.plantVariety)}</label><input id="seedName" name="seedName" value="${escapeAttribute(nameValue)}" autocomplete="off" required /></div><div class="seed-field"><label for="seedBrand">${escapeHtml(text.brand)}</label><input id="seedBrand" name="seedBrand" value="${escapeAttribute(brandValue)}" autocomplete="off" /></div></div><input id="libraryPlantId" name="libraryPlantId" type="hidden" value="${escapeAttribute(state.selectedSeedIdentityId || "")}" /><div id="identityResolver" class="identity-resolver"></div><div id="duplicateHint" class="duplicate-hint"></div>`;

  return `<div class="seed-editor-header"><p class="eyebrow">GARDENPEDIA · MY SEEDS</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text.personalStateNote)}</p></div>${packetPanel}<form id="seedForm" class="seed-form">${identityFields}<div class="seed-form-grid"><div class="seed-field"><label for="packageStatus">${escapeHtml(text.packageStatus)}</label><select id="packageStatus" name="packageStatus">${selectOptions(text.seedStatus, packageStatus)}</select></div><div class="seed-field"><label for="quantityLevel">${escapeHtml(text.quantityLevel)}</label><select id="quantityLevel" name="quantityLevel">${selectOptions(text.quantity, quantityLevel)}</select></div><div class="seed-field full"><label for="storageLocation">${escapeHtml(text.storageLocation)}</label><input id="storageLocation" name="storageLocation" value="${escapeAttribute(storageLocation)}" placeholder="${escapeAttribute(text.optional)}" /></div><div class="seed-field"><label for="purchaseYear">${escapeHtml(text.purchaseYear)}</label><input id="purchaseYear" name="purchaseYear" type="number" min="1900" max="2100" value="${escapeAttribute(purchaseYear)}" placeholder="${escapeAttribute(text.optional)}" /></div><div class="seed-field"><label for="germinationTest">${escapeHtml(text.germinationTestDate)}</label><input id="germinationTest" name="germinationTest" type="date" value="${escapeAttribute(germDate)}" /></div><div class="seed-field"><label for="germinationResult">${escapeHtml(text.germinationResult)}</label><input id="germinationResult" name="germinationResult" type="number" min="0" max="100" value="${escapeAttribute(germResult)}" placeholder="${escapeAttribute(text.optional)}" /></div><div class="seed-field full"><label for="seedNotes">${escapeHtml(text.notes)}</label><textarea id="seedNotes" name="seedNotes" placeholder="${escapeAttribute(text.optional)}">${escapeHtml(notes)}</textarea></div></div><p class="seed-form-note">${escapeHtml(text.personalStateNote)}</p><p id="seedSaveError" role="alert" hidden></p><div class="seed-form-actions"><div>${seed ? `${archived ? `<button id="restoreSeed" class="seed-action-button secondary" type="button">${escapeHtml(text.restoreInventory)}</button>` : `<button id="removeSeed" class="seed-action-button secondary" type="button">${escapeHtml(text.removeInventory)}</button>`}<button id="deleteSeed" class="seed-danger-button" type="button">${escapeHtml(text.deletePackage)}</button>` : ""}</div><div>${plant ? `<button id="editorGuideLink" class="seed-action-button secondary" type="button">${escapeHtml(text.viewGuide)}</button>` : ""}<button id="cancelSeed" class="seed-action-button secondary" type="button">${escapeHtml(text.cancel)}</button><button class="seed-action-button" type="submit">${escapeHtml(text.save)}</button></div></div></form>`;
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
  const resolver = refs.seedDetail.querySelector("#identityResolver");
  const identityInput = refs.seedDetail.querySelector("#libraryPlantId");

  const renderIdentityMatches = () => {
    if (!nameInput || !resolver) return;
    const candidates = window.GardenpediaIdentityResolver?.search(nameInput.value, state.plants) || [];
    const selected = identityInput?.value || "";
    const linked = state.plants.find((plant) => plant.id === selected);
    const heading = candidates.length ? `<p class="eyebrow">${escapeHtml(text.identitySuggestions)}</p>` : `<p>${escapeHtml(text.noIdentityMatch)}</p>`;
    const options = candidates.slice(0, 6).map((plant) => `<button type="button" class="identity-candidate ${plant.id === selected ? "selected" : ""}" data-identity-id="${escapeAttribute(plant.id)}"><strong>${escapeHtml(plant.name || plant.commonName || plant.id)}</strong><span>${escapeHtml([plant.cultivar || plant.variety, plant.scientificName].filter(Boolean).join(" · "))}</span></button>`).join("");
    const exactMatch = window.GardenpediaIdentityResolver?.exactMatch(nameInput.value, state.plants) || false;
    const request = exactMatch ? "" : `<button type="button" class="seed-action-button secondary" id="requestToGardenpedia">${escapeHtml(text.requestToGardenpedia)}</button>`;
    resolver.innerHTML = `${linked ? `<p class="identity-selected">${escapeHtml(text.selectedIdentity)}: ${escapeHtml(linked.name || linked.commonName || linked.id)} <button type="button" id="clearSeedIdentity">×</button></p>` : ""}${nameInput.value.trim() ? `${heading}<div class="identity-candidate-list">${options}</div>${request}` : ""}<p id="gardenpediaRequestResult" class="seed-form-note" aria-live="polite"></p>`;
    resolver.querySelectorAll("[data-identity-id]").forEach((button) => button.addEventListener("click", () => {
      identityInput.value = button.dataset.identityId;
      state.selectedSeedIdentityId = button.dataset.identityId;
      renderIdentityMatches();
    }));
    resolver.querySelector("#clearSeedIdentity")?.addEventListener("click", () => {
      identityInput.value = "";
      state.selectedSeedIdentityId = null;
      renderIdentityMatches();
    });
    resolver.querySelector("#requestToGardenpedia")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await window.GARDENPEDIA_ACCOUNT.createRequest(nameInput.value.trim());
        resolver.querySelector("#gardenpediaRequestResult").textContent = text.requestSent;
      } catch (error) {
        console.warn("Gardenpedia request could not be created", error);
        button.disabled = false;
        resolver.querySelector("#gardenpediaRequestResult").textContent = text.saveError;
      }
    });
  };

  const refreshDuplicateHint = () => {
    if (!nameInput || !duplicateHint) return;
    const duplicate = findDuplicateSeed(nameInput.value, seedId);
    duplicateHint.classList.toggle("visible", Boolean(duplicate));
    duplicateHint.textContent = duplicate ? `${text.duplicateWarning}${duplicate.packetName} · ${duplicate.brand || ""}` : "";
  };
  nameInput?.addEventListener("input", () => {
    const selected = state.plants.find((plant) => plant.id === identityInput?.value);
    if (selected && !window.GardenpediaIdentityResolver?.exactMatch(nameInput.value, [selected])) {
      identityInput.value = "";
      state.selectedSeedIdentityId = null;
    }
    refreshDuplicateHint();
    renderIdentityMatches();
  });
  refreshDuplicateHint();
  renderIdentityMatches();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSeedEditor(seedId, form);
  });
  refs.seedDetail.querySelector("#cancelSeed")?.addEventListener("click", () => refs.seedDialog.close());
  refs.seedDetail.querySelector("#removeSeed")?.addEventListener("click", () => removeSeed(seedId));
  refs.seedDetail.querySelector("#deleteSeed")?.addEventListener("click", () => deleteSeed(seedId));
  refs.seedDetail.querySelector("#restoreSeed")?.addEventListener("click", () => restoreSeed(seedId));
  refs.seedDetail.querySelector("#editorGuideLink")?.addEventListener("click", () => {
    const plant = seed?.plantId ? state.plants.find((item) => item.id === seed.plantId) : null;
    if (!plant) return;
    refs.seedDialog.close();
    switchView("guide");
    openPlant(plant);
  });
}

async function saveSeedEditor(seedId, form) {
  const data = new FormData(form);
  const packetName = String(data.get("seedName") || "").trim();
  if (!packetName) { form.querySelector("#seedName")?.focus(); return; }
  const saveButton = form.querySelector('button[type="submit"]');
  const error = form.querySelector("#seedSaveError");
  if (saveButton) saveButton.disabled = true;
  if (error) error.hidden = true;
  try {
    const current = seedId ? getSeedById(seedId) : null;
    await window.GARDENPEDIA_ACCOUNT.savePackage({
      id: current?.id || null,
      libraryPlantId: String(data.get("libraryPlantId") || "") || null,
      seedName: packetName,
      brand: String(data.get("seedBrand") || "").trim() || null,
      packageStatus: String(data.get("packageStatus") || "unknown"),
      quantityLevel: String(data.get("quantityLevel") || "unknown"),
      storageLocation: String(data.get("storageLocation") || "").trim() || null,
      purchaseYear: String(data.get("purchaseYear") || "").trim() || null,
      germinationTestDate: String(data.get("germinationTest") || "") || null,
      germinationResultPct: data.get("germinationResult") === "" ? null : Number(data.get("germinationResult")),
      notes: String(data.get("seedNotes") || "").trim() || null,
      archived: current?.archived === true,
    });
    const refreshed = await window.GARDENPEDIA_ACCOUNT.reloadPackages();
    state.seedPackages = Array.isArray(refreshed.packages) ? refreshed.packages : [];
    refs.seedDialog.close();
    renderSeeds();
    renderPlants();
  } catch (saveError) {
    console.warn("Canonical seed package save failed", saveError);
    if (error) { error.textContent = ui[state.language].saveError; error.hidden = false; }
    if (saveButton) saveButton.disabled = false;
  }
}

async function removeSeed(seedId) {
  const seed = getSeedById(seedId);
  if (!seed) return;
  await updateSeedPackageArchived(seed, true);
}

async function deleteSeed(seedId) {
  const seed = getSeedById(seedId);
  if (!seed || !window.confirm(ui[state.language].confirmDeletePackage)) return;
  try {
    await window.GARDENPEDIA_ACCOUNT.deletePackage(seed.id);
    const refreshed = await window.GARDENPEDIA_ACCOUNT.reloadPackages();
    state.seedPackages = Array.isArray(refreshed.packages) ? refreshed.packages : [];
    refs.seedDialog.close();
    renderSeeds(); renderPlants();
  } catch (error) {
    console.warn("Canonical seed package delete failed", error);
    const message = refs.seedDetail.querySelector("#seedSaveError");
    if (message) { message.textContent = ui[state.language].saveError; message.hidden = false; }
  }
}

async function restoreSeed(seedId) {
  const seed = getSeedById(seedId);
  if (!seed) return;
  await updateSeedPackageArchived(seed, false);
}

async function updateSeedPackageArchived(seed, archived) {
  try {
    await window.GARDENPEDIA_ACCOUNT.savePackage({
      id: seed.id, libraryPlantId: seed.libraryPlantId || null, seedName: seed.packetName,
      brand: seed.brand || null, packageStatus: seed.packageStatus || "unknown",
      quantityLevel: seed.quantityLevel || "unknown", storageLocation: seed.storageLocation || null,
      purchaseYear: seed.purchaseYear || null, germinationTestDate: seed.lastGerminationTestAt || null,
      germinationResultPct: seed.lastGerminationResultPct === "" ? null : seed.lastGerminationResultPct,
      notes: seed.userNotes || null, archived,
    });
    const result = await window.GARDENPEDIA_ACCOUNT.reloadPackages();
    state.seedPackages = Array.isArray(result.packages) ? result.packages : [];
    refs.seedDialog.close();
    if (!archived) state.seedFilter = "all";
    buildSeedFilters();
    renderSeeds();
    renderPlants();
  } catch (error) {
    console.warn("Canonical seed package update failed", error);
    const notice = document.querySelector("#seedAccountNotice");
    if (notice) { notice.hidden = false; notice.textContent = ui[state.language].saveError; }
  }
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
  // Existing localStorage is preserved for explicit reconciliation only.
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
    reasons.push(state.language === "es" ? "Comparten una preferencia térmica similar." : "They share a similar temperature preference.");
  } else if (a.climate === "moderate" || b.climate === "moderate") {
    score += 1;
    reasons.push(state.language === "es" ? "Sus rangos térmicos pueden solaparse con manejo." : "Their temperature ranges can overlap with management.");
  }
  else {
    score -= 2;
    reasons.push(state.language === "es" ? "Uno es de clima cálido y el otro de clima fresco." : "One is warm-season and the other cool-season.");
  }
  const nutrientGap = Math.abs(a.nutrient - b.nutrient);
  if (nutrientGap === 0) { score += 1; reasons.push(state.language === "es" ? "Tienen una demanda de nutrientes parecida." : "They have similar nutrient demand."); }
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
  if (a.root <= 2 && b.root <= 2 && Math.abs(a.root - b.root) <= 1) { score += 1; reasons.push(state.language === "es" ? "El volumen de raíces es compatible en sistemas compactos." : "Their root volume is compatible in compact systems."); }
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
  const placement = basis === "nearby" ? "outdoor" : score <= -2 ? "separate" : (a.spread >= 3 || b.spread >= 3 || a.height >= 3 || b.height >= 3) ? "spacing" : "shared";
  return { plant: state.plants.find((plant) => plant.id === bId), score, reasons: reasons.slice(0, 3), basis, explicit, placement };
}

function buildNeighborItem(item) {
  const text = ui[state.language];
  const plant = item.plant;
  const primaryName = state.language === "es" ? plant.spanishName : plant.name;
  const label = item.basis === "research" ? text.researchPair : item.basis === "nearby" ? text.nearbyRole : text.systemPair;
  const action = item.placement === "outdoor" ? text.outdoorNearby : item.placement === "separate" ? text.keepSeparate : item.placement === "spacing" ? text.manageSpacing : text.shareSystem;
  const source = item.explicit ? state.sources[item.explicit.sourceId] : null;
  return `<article class="neighbor-item"><div class="neighbor-name"><span>${plant.emoji}</span><strong>${escapeHtml(primaryName)}</strong></div><p>${escapeHtml(item.reasons.join(" "))}</p><div class="neighbor-meta"><strong>${escapeHtml(action)}</strong><span>${escapeHtml(label)}</span>${source ? `<a href="${escapeAttribute(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.publisher)} ↗</a>` : ""}</div></article>`;
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
