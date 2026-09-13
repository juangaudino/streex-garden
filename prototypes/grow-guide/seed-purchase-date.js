// Garden Labs V0.7.2 — exact purchase date experiment.
// Keeps any legacy purchaseYear value untouched until User Zero supplies a full date.

ui.en.purchaseDate = "Purchase date";
ui.es.purchaseDate = "Fecha de compra";
ui.en.legacyPurchaseYear = "Previously saved year";
ui.es.legacyPurchaseYear = "Año guardado anteriormente";
ui.en.version = "V0.7.2 · 29 guides · ES/EN · visual + neighbors + inventory";
ui.es.version = "V0.7.2 · 29 guías · ES/EN · visual + vecinas + inventario";

mergeSeedRecord = function mergeSeedRecord(seed) {
  const id = seedRecordId(seed);
  const user = state.seedUserState[id] || {};
  return {
    ...seed,
    id,
    packageStatus: user.packageStatus || "unknown",
    quantityLevel: user.quantityLevel || "unknown",
    storageLocation: user.storageLocation || "",
    purchaseDate: user.purchaseDate || "",
    purchaseYear: user.purchaseYear || "",
    lastGerminationTestAt: user.lastGerminationTestAt || "",
    lastGerminationResultPct: user.lastGerminationResultPct ?? "",
    userNotes: user.notes || "",
    archived: Boolean(user.archived),
    isCustom: Boolean(seed.id),
  };
};

buildSeedEditor = function buildSeedEditor(seedId) {
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
  const purchaseDate = merged?.purchaseDate || "";
  const legacyPurchaseYear = !purchaseDate ? merged?.purchaseYear || "" : "";
  const germDate = merged?.lastGerminationTestAt || "";
  const germResult = merged?.lastGerminationResultPct ?? "";
  const notes = merged?.userNotes || "";
  const archived = merged?.archived || false;
  const plant = seed?.plantId ? state.plants.find((item) => item.id === seed.plantId) : null;

  const identityFields = isNew || isCustom ? `<div class="seed-form-grid"><div class="seed-field"><label for="seedName">${escapeHtml(text.plantVariety)}</label><input id="seedName" name="seedName" value="${escapeAttribute(nameValue)}" autocomplete="off" required /></div><div class="seed-field"><label for="seedBrand">${escapeHtml(text.brand)}</label><input id="seedBrand" name="seedBrand" value="${escapeAttribute(brandValue)}" autocomplete="off" /></div></div><div id="duplicateHint" class="duplicate-hint"></div>` : "";
  const legacyYearHint = legacyPurchaseYear ? `<small class="seed-form-note">${escapeHtml(text.legacyPurchaseYear)}: ${escapeHtml(legacyPurchaseYear)} · ${escapeHtml(text.optional)}</small>` : "";

  return `<div class="seed-editor-header"><p class="eyebrow">GARDEN LIBRARY · SEEDS</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text.personalStateNote)}</p></div>${packetPanel}<form id="seedForm" class="seed-form">${identityFields}<div class="seed-form-grid"><div class="seed-field"><label for="packageStatus">${escapeHtml(text.packageStatus)}</label><select id="packageStatus" name="packageStatus">${selectOptions(text.seedStatus, packageStatus)}</select></div><div class="seed-field"><label for="quantityLevel">${escapeHtml(text.quantityLevel)}</label><select id="quantityLevel" name="quantityLevel">${selectOptions(text.quantity, quantityLevel)}</select></div><div class="seed-field full"><label for="storageLocation">${escapeHtml(text.storageLocation)}</label><input id="storageLocation" name="storageLocation" value="${escapeAttribute(storageLocation)}" placeholder="${escapeAttribute(text.optional)}" /></div><div class="seed-field"><label for="purchaseDate">${escapeHtml(text.purchaseDate)}</label><input id="purchaseDate" name="purchaseDate" type="date" value="${escapeAttribute(purchaseDate)}" />${legacyYearHint}</div><div class="seed-field"><label for="germinationTest">${escapeHtml(text.germinationTestDate)}</label><input id="germinationTest" name="germinationTest" type="date" value="${escapeAttribute(germDate)}" /></div><div class="seed-field"><label for="germinationResult">${escapeHtml(text.germinationResult)}</label><input id="germinationResult" name="germinationResult" type="number" min="0" max="100" value="${escapeAttribute(germResult)}" placeholder="${escapeAttribute(text.optional)}" /></div><div class="seed-field full"><label for="seedNotes">${escapeHtml(text.notes)}</label><textarea id="seedNotes" name="seedNotes" placeholder="${escapeAttribute(text.optional)}">${escapeHtml(notes)}</textarea></div></div>${isCustom ? `<p class="seed-form-note">${escapeHtml(text.customSeedNote)}</p>` : `<p class="seed-form-note">${escapeHtml(text.localOnly)}</p>`}<div class="seed-form-actions"><div>${seed ? archived ? `<button id="restoreSeed" class="seed-action-button secondary" type="button">${escapeHtml(text.restoreInventory)}</button>` : `<button id="removeSeed" class="seed-danger-button" type="button">${escapeHtml(isCustom ? text.deleteCustom : text.removeInventory)}</button>` : ""}</div><div>${plant ? `<button id="editorGuideLink" class="seed-action-button secondary" type="button">${escapeHtml(text.viewGuide)}</button>` : ""}<button id="cancelSeed" class="seed-action-button secondary" type="button">${escapeHtml(text.cancel)}</button><button class="seed-action-button" type="submit">${escapeHtml(text.save)}</button></div></div></form>`;
};

saveSeedEditor = function saveSeedEditor(seedId, form) {
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
    purchaseDate: String(data.get("purchaseDate") || ""),
    lastGerminationTestAt: String(data.get("germinationTest") || ""),
    lastGerminationResultPct: data.get("germinationResult") === "" ? "" : Number(data.get("germinationResult")),
    notes: String(data.get("seedNotes") || "").trim(),
    archived: false,
  };
  persistSeedLabState();
  refs.seedDialog.close();
  renderSeeds();
  renderPlants();
};
