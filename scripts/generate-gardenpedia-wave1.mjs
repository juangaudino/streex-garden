import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = path.join(root, "labs", "gardenpedia", "data");
const taxonomyPath = path.join(root, "labs", "gardenpedia", "taxonomy", "reconciliation-v1.json");
const accessed = "2026-10-01";

const sources = [
  ["kew-powo-wave1", "Royal Botanic Gardens, Kew", "Plants of the World Online", "https://powo.science.kew.org/", "botanical_taxonomy", "taxonomy reconciliation input; verify individual taxon pages before publication"],
  ["usda-plants-wave1", "USDA NRCS", "PLANTS Database", "https://plants.usda.gov/home", "botanical_taxonomy", "taxonomy reconciliation input; not runtime evidence"],
  ["johnnys-arugula-wave1", "University of Wisconsin Extension", "Arugula, Eruca sativa", "https://hort.extension.wisc.edu/articles/arugula/", "university_extension", "arugula crop-level sowing, harvest and problems; not named-cultivar proof"],
  ["johnnys-kale-wave1", "Johnny's Selected Seeds", "Kale — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/kale/", "grower_reference", "kale crop-level guidance; not named-cultivar proof"],
  ["johnnys-chard-wave1", "Johnny's Selected Seeds", "Swiss chard — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/swiss-chard/", "grower_reference", "Swiss chard crop-level guidance; not named-cultivar proof"],
  ["johnnys-brassicas-wave1", "Johnny's Selected Seeds", "Brassica crops — growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/broccoli/", "grower_reference", "broccoli and related Brassica crop context; scope must stay crop/type-level"],
  ["johnnys-cucumber-wave1", "Johnny's Selected Seeds", "Cucumber — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/cucumbers/", "grower_reference", "cucumber crop-level sowing, support and harvest guidance"],
  ["johnnys-carrots-wave1", "Johnny's Selected Seeds", "Carrots — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/carrots/", "grower_reference", "carrot crop-level direct sowing and harvest guidance; includes Nantes type context"],
  ["johnnys-beets-wave1", "Johnny's Selected Seeds", "Beets — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/beets/", "grower_reference", "beet crop-level sowing and root harvest guidance"],
  ["johnnys-turnips-wave1", "Johnny's Selected Seeds", "Turnips — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/turnips/", "grower_reference", "turnip crop-level sowing and root harvest guidance"],
  ["johnnys-onions-wave1", "Johnny's Selected Seeds", "Onions — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/onions/", "grower_reference", "onion crop-level sowing and bulb development guidance"],
  ["johnnys-leeks-wave1", "Johnny's Selected Seeds", "Leeks — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/leeks/", "grower_reference", "leek crop-level sowing, blanching and harvest context"],
  ["johnnys-beans-wave1", "Johnny's Selected Seeds", "Beans — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/beans/", "grower_reference", "bean crop-level direct sowing and harvest guidance"],
  ["johnnys-peas-wave1", "Johnny's Selected Seeds", "Peas — crop growing information", "https://prod-na02.johnnyseeds.com/growers-library/vegetable-library/peas/", "grower_reference", "pea crop-level sowing, support and harvest guidance"],
  ["johnnys-lemon-balm-wave1", "Johnny's Selected Seeds", "Lemon Balm — Key Growing Information", "https://www.johnnyseeds.com/growers-library/herbs/lemon-balm/lemon-balm-key-growing-information.html", "grower_reference", "lemon balm crop-level herb guidance; exact product cultivar not asserted"],
  ["johnnys-nasturtium-wave1", "University of Maryland Extension", "Nasturtium", "https://extension.umd.edu/resource/nasturtium", "university_extension", "nasturtium crop-level ornamental guidance"],
  ["johnnys-calendula-wave1", "Utah State University Extension", "How to Grow Calendula in Your Garden", "https://extension.usu.edu/yardandgarden/research/calendula-in-the-garden", "university_extension", "calendula crop-level flowering guidance; culinary use remains source-scoped"],
  ["johnnys-borage-wave1", "University of Maryland Extension", "Borage", "https://extension.umd.edu/resource/borage", "university_extension", "borage crop-level herb/flower guidance"],
  ["johnnys-chamomile-wave1", "University of Wisconsin Extension", "German Chamomile, Matricaria chamomilla", "https://hort.extension.wisc.edu/articles/chamomile-matricaria-chamomilla/", "university_extension", "German chamomile crop-level herb/flower guidance"],
];

const identities = [
  ["arugula", "Arugula", "Rúcula", "Eruca vesicaria", "Arugula / roquette", "leafy greens", "🥗", "rosette", "johnnys-arugula-wave1"],
  ["kale-dwarf-blue-curled", "Dwarf Blue Curled Kale", "Col rizada enana azul rizada", "Brassica oleracea", "Dwarf blue curled type", "leafy greens", "🥬", "rosette", "johnnys-kale-wave1"],
  ["swiss-chard-rainbow", "Rainbow Swiss Chard", "Acelga arcoíris", "Beta vulgaris", "Rainbow type", "leafy greens", "🌈", "rosette", "johnnys-chard-wave1"],
  ["bok-choy", "Bok Choy", "Bok choy", "Brassica rapa", "Bok choy type", "leafy greens", "🥬", "rosette", "johnnys-brassicas-wave1"],
  ["baby-spinach", "Baby Spinach", "Espinaca baby", "Spinacia oleracea", "Baby-leaf type", "leafy greens", "🥬", "rosette", "usu-spinach"],
  ["roma-tomato", "Roma Tomato", "Tomate Roma", "Solanum lycopersicum", "Roma type", "fruits", "🍅", "bushy", "johnnys-tomato"],
  ["beefsteak-tomato", "Beefsteak Tomato", "Tomate beefsteak", "Solanum lycopersicum", "Beefsteak type", "fruits", "🍅", "spreading", "johnnys-tomato"],
  ["yellow-pear-tomato", "Yellow Pear Tomato", "Tomate pera amarilla", "Solanum lycopersicum", "Yellow pear type", "fruits", "🍐", "spreading", "johnnys-tomato"],
  ["jalapeno-pepper", "Jalapeño Pepper", "Pimiento jalapeño", "Capsicum annuum", "Jalapeño type", "fruits", "🌶️", "bushy", "usu-peppers"],
  ["cayenne-pepper", "Cayenne Pepper", "Pimiento cayena", "Capsicum annuum", "Cayenne type", "fruits", "🌶️", "upright", "usu-peppers"],
  ["cucumber-marketmore", "Marketmore Cucumber", "Pepino Marketmore", "Cucumis sativus", "Marketmore type", "fruits", "🥒", "trailing", "johnnys-cucumber-wave1"],
  ["bush-cucumber", "Bush Cucumber", "Pepino de mata", "Cucumis sativus", "Bush type", "fruits", "🥒", "bushy", "johnnys-cucumber-wave1"],
  ["broccoli-calabrese", "Calabrese Broccoli", "Brócoli calabrés", "Brassica oleracea", "Calabrese type", "vegetables", "🥦", "upright", "johnnys-brassicas-wave1"],
  ["cauliflower-snowball", "Snowball Cauliflower", "Coliflor Snowball", "Brassica oleracea", "Snowball type", "vegetables", "🥦", "rosette", "johnnys-brassicas-wave1"],
  ["carrot-nantes", "Nantes Carrot", "Zanahoria Nantes", "Daucus carota", "Nantes type", "root vegetables", "🥕", "rosette", "johnnys-carrots-wave1"],
  ["beet-detroit-dark-red", "Detroit Dark Red Beet", "Remolacha Detroit Dark Red", "Beta vulgaris", "Detroit Dark Red type", "root vegetables", "🫜", "rosette", "johnnys-beets-wave1"],
  ["turnip-purple-top-white-globe", "Purple Top White Globe Turnip", "Nabo Purple Top White Globe", "Brassica rapa", "Purple Top White Globe type", "root vegetables", "🫜", "rosette", "johnnys-turnips-wave1"],
  ["yellow-onion", "Yellow Onion", "Cebolla amarilla", "Allium cepa", "Yellow bulb onion type", "alliums", "🧅", "upright", "johnnys-onions-wave1"],
  ["leek-american-flag", "American Flag Leek", "Puerro American Flag", "Allium ampeloprasum", "American Flag type", "alliums", "🧅", "upright", "johnnys-leeks-wave1"],
  ["bush-bean-blue-lake", "Blue Lake Bush Bean", "Frijol de mata Blue Lake", "Phaseolus vulgaris", "Blue Lake bush type", "vegetables", "🫘", "bushy", "johnnys-beans-wave1"],
  ["snap-pea-oregon-sugar-pod", "Oregon Sugar Pod Snap Pea", "Guisante tirabeque Oregon Sugar Pod", "Pisum sativum", "Oregon Sugar Pod type", "vegetables", "🫛", "trailing", "johnnys-peas-wave1"],
  ["flat-leaf-parsley", "Flat-Leaf Parsley", "Perejil de hoja plana", "Petroselinum crispum", "Flat-leaf type", "herbs", "🌿", "rosette", "johnnys-parsley"],
  ["lemon-balm", "Lemon Balm", "Toronjil", "Melissa officinalis", "Lemon balm", "herbs", "🌿", "bushy", "johnnys-lemon-balm-wave1"],
  ["santo-cilantro", "Santo Cilantro", "Cilantro Santo", "Coriandrum sativum", "Santo", "herbs", "🌿", "bushy", "johnnys-cilantro-seed"],
  ["lemon-thyme", "Lemon Thyme", "Tomillo limón", "Thymus citriodorus", "Lemon thyme type", "herbs", "🌿", "mounded", "johnnys-thyme"],
  ["nasturtium-empress-of-india", "Empress of India Nasturtium", "Capuchina Empress of India", "Tropaeolum majus", "Empress of India", "flowers", "🌺", "trailing", "johnnys-nasturtium-wave1"],
  ["calendula-pacific-beauty", "Pacific Beauty Calendula", "Caléndula Pacific Beauty", "Calendula officinalis", "Pacific Beauty", "flowers", "🌼", "mounded", "johnnys-calendula-wave1"],
  ["borage-blue", "Blue Borage", "Borraja azul", "Borago officinalis", "Blue flower type", "flowers", "💙", "upright", "johnnys-borage-wave1"],
  ["german-chamomile", "German Chamomile", "Manzanilla alemana", "Matricaria chamomilla", "German chamomile", "herbs", "🌼", "mounded", "johnnys-chamomile-wave1"],
];

const sourceRecords = sources.map(([id, publisher, title, url, type, scope]) => ({ id, publisher, title, url, type, tier: ["botanical_taxonomy", "university_extension"].includes(type) ? 1 : 2, scope, accessed, license: null, provenance: "Gardenpedia Labs Wave 1 source registry", claimKinds: ["identity", "cultivation", "seedling"] }));

const sourceById = new Map(sourceRecords.map((source) => [source.id, source]));
const existingSourceIds = new Set([
  "johnnys-tomato", "usu-peppers", "okstate-ecph-b1", "usu-spinach", "johnnys-parsley", "johnnys-cilantro-seed", "johnnys-thyme", "umn-seed-storage", "johnnys-seed-starting",
]);

function evidence(sourceIds, taxon, note) {
  return [{ sourceIds, evidenceType: "source_backed", confidence: "medium", taxonomicScope: { level: "species", taxon }, note }];
}

function section(short, guidance, sourceIds, evidenceType = "source_backed", confidence = "medium") {
  return { short, guidance, evidenceType, confidence, sourceIds };
}

function compatibility(d, sourceIds) {
  const hydroEvidence = d.hydro ? evidence(d.hydro.sources, d.scientificName, d.hydro.note) : undefined;
  return {
    profileVersion: 1,
    hydroponicSuitability: d.hydro ? { status: d.hydro.status, ...(d.hydro.status === "known" || d.hydro.status === "compatible" ? { evidence: hydroEvidence } : { reason: d.hydro.note }) } : { status: "unknown", reason: "Wave 1 did not establish crop-specific system suitability for this identity." },
    growthHabits: { status: "known", value: [d.habit], evidence: evidence(sourceIds, d.scientificName, "Crop/type-level growth habit; not a named-cultivar measurement.") },
    matureSize: { height: { status: "unknown", reason: "No identity-specific mature height was accepted for this type in Wave 1." }, spread: { status: "unknown", reason: "No identity-specific mature spread was accepted for this type in Wave 1." } },
    spacing: { status: "unknown", reason: "Field spacing is not converted into a universal Garden system position rule." },
    light: { status: "known", value: [{ phase: "growing", requirement: { kind: d.light || "full_sun" } }], evidence: evidence(sourceIds, d.scientificName, "Crop-level light context; exact system response remains context-dependent.") },
  };
}

function makePlant(row) {
  const [id, name, spanishName, scientificName, variety, category, emoji, habit, sourceId] = row;
  const d = { id, name, spanishName, scientificName, variety, category, emoji, habit, sourceId, light: ["lemon-balm", "german-chamomile"].includes(id) ? "partial_sun" : "full_sun" };
  const hydro = ["arugula", "baby-spinach"].includes(id) ? { status: "pending", note: "Crop-level hydroponic performance is plausible but this Wave 1 identity has no accepted system-specific evidence." } : null;
  d.hydro = hydro;
  const src = [sourceId];
  const fruiting = ["roma-tomato", "beefsteak-tomato", "yellow-pear-tomato", "jalapeno-pepper", "cayenne-pepper", "cucumber-marketmore", "bush-cucumber"].includes(id);
  const flowers = ["nasturtium-empress-of-india", "calendula-pacific-beauty", "borage-blue", "german-chamomile"].includes(id);
  const root = ["carrot-nantes", "beet-detroit-dark-red", "turnip-purple-top-white-globe", "yellow-onion", "leek-american-flag"].includes(id);
  const sections = {
    identity: section(`${name} identity is resolved at ${scientificName} and ${variety} type scope`, `${name} is published as a useful horticultural type. Wave 1 does not promote a generic crop guide into named-cultivar certainty.`, src),
    pruning: section(fruiting ? "Manage structure without assuming a universal pruning rule" : flowers ? "Shape only when the plant's growth habit calls for it" : "Manage by harvest and visible crowding", fruiting ? "Keep healthy foliage and use support or shaping only when the actual plant architecture requires it; standard field practice is not automatically a compact-system rule." : flowers ? "Deadheading or light shaping may be useful for the documented ornamental type, but the exact response remains source- and plant-dependent." : "Use selective harvest, thinning, or removal of damaged tissue as the visible plant requires. Do not turn field spacing into a fixed pod count.", src, "garden_adaptation", "medium"),
    harvest: section(root ? "Harvest the usable root or basal structure at the crop stage" : flowers ? "Harvest or enjoy flowers as an ornamental crop" : fruiting ? "Harvest by crop maturity cues, not a fixed calendar promise" : "Harvest selectively while preserving the growing point", root ? `The ${variety} type is managed toward its edible root, bulb, or pseudostem. The exact harvest date depends on temperature, planting method, and the actual plant.` : flowers ? "Wave 1 treats this identity primarily as ornamental. Culinary use is not inferred without identity-specific edible-flower evidence." : fruiting ? "Use firmness, color, size, and plant condition as the harvest signals. Source calendars remain crop/type references rather than guarantees for every system." : "Remove usable leaves or stems cleanly and preserve enough active tissue for continued growth when the crop supports repeat harvest.", src, flowers ? "source_backed" : "garden_adaptation", "medium"),
    problems: section("Watch the few problems that change management", root ? "Irregular moisture, compaction, and temperature can change root or bulb development. Record the visible symptom and growing context before assigning a cause." : flowers ? "Watch for stress, poor airflow, and flower loss. Do not diagnose a disease from a single visual symptom." : "Heat, moisture stress, crowding, and poor airflow can change growth. Use the source-backed crop context plus actual observations before choosing an intervention.", src, "source_backed", "medium"),
  };
  if (fruiting) sections.flowering = section("Flowering and fruit set are useful lifecycle events", "Record first flowers, fruit set, and any flower drop as separate observations. Do not suppress productive flowering by copying leaf-herb care rules.", src, "garden_adaptation", "medium");
  if (root) sections.thinning = section("Thin or separate according to the intended harvest form", "Root and bulb crops need enough space for the intended edible structure. Use visible crowding and the crop guide rather than a universal Garden system count.", src, "garden_adaptation", "medium");
  if (d.hydro) sections.hydroponics = section("Hydroponic evidence remains explicitly pending", d.hydro.note, [], "needs_validation", "pending");
  return { id, name, spanishName, scientificName, variety, category, emoji, guideCompletion: 68, tags: [id, name.toLowerCase(), spanishName.toLowerCase(), scientificName.toLowerCase(), variety.toLowerCase()], summary: `${name} is a Wave 1 baseline identity with useful crop/type guidance. Exact cultivar performance, system response, and dimensions remain scoped to the cited evidence.`, metrics: [], sections, compatibilityProfile: compatibility({ scientificName, habit, hydro }, src) };
}

function fact(key, labelEn, labelEs, valueEn, valueEs, noteEn, noteEs, evidenceType, confidence, sourceIds) {
  return { key, label: { en: labelEn, es: labelEs }, value: { en: valueEn, es: valueEs }, note: { en: noteEn, es: noteEs }, evidenceType, confidence, sourceIds };
}

function makeSeedProfile(row) {
  const [id, name, spanishName, scientificName, variety, category, emoji, habit, sourceId] = row;
  const cropSource = sourceId;
  const item = (textEn, textEs, evidenceType = "source_backed", confidence = "medium", sourceIds = [cropSource]) => ({ text: { en: textEn, es: textEs }, evidenceType, confidence, sourceIds });
  const sectionV0 = (key, titleEn, titleEs, shortEn, shortEs, guidanceEn, guidanceEs, items, evidenceType = "source_backed", confidence = "medium", sourceIds = [cropSource]) => ({ key, title: { en: titleEn, es: titleEs }, icon: { sowing: "🌱", germination: "⏳", afterEmergence: "🌿", transition: "🪴", handling: "📦", troubleshooting: "⚠️" }[key], short: { en: shortEn, es: shortEs }, guidance: { en: guidanceEn, es: guidanceEs }, items, evidenceType, confidence, sourceIds });
  return {
    plantIdentityId: id,
    label: { en: "SEED PROFILE", es: "PERFIL DE SEMILLA" },
    summary: { en: `A seed-to-established-plant path for ${name}. Crop-level evidence is kept separate from exact cultivar or system claims.`, es: `Un recorrido desde la semilla hasta una planta establecida de ${spanishName}. La evidencia del cultivo se mantiene separada de las afirmaciones exactas de cultivar o sistema.` },
    quickFacts: [
      fact("germination", "Germination", "Germinación", "Crop-specific range pending", "Rango específico del cultivo pendiente", "Do not turn a general crop window into a packet guarantee", "No conviertas una ventana general del cultivo en garantía del paquete", "needs_validation", "pending", []),
      fact("temperature", "Germination temperature", "Temperatura de germinación", "Use the crop guide range", "Usa el rango de la guía del cultivo", "Exact packet conditions are not resolved in Wave 1", "Las condiciones exactas del paquete no están resueltas en Wave 1", "source_backed", "medium", [cropSource]),
      fact("depth", "Sowing depth", "Profundidad de siembra", "Follow the crop-specific guide", "Sigue la guía específica del cultivo", "Packet depth should win when the actual packet is available", "La profundidad del paquete debe prevalecer cuando el paquete real esté disponible", "source_backed", "medium", [cropSource, "johnnys-seed-starting"]),
      fact("seedType", "Seed form", "Forma de la semilla", "Packet form not verified", "Forma del paquete no verificada", "Pelleted, treated, or coated status needs the actual packet", "El estado peletizado, tratado o recubierto requiere el paquete real", "needs_validation", "pending", []),
    ],
    sections: [
      sectionV0("sowing", "Sowing", "Siembra", "Start with a clean, evenly moist medium", "Empieza con un medio limpio y uniformemente húmedo", `Use the ${name} crop guide for sowing method and depth. Do not convert outdoor spacing into a Garden position count.`, `Usa la guía del cultivo ${spanishName} para el método y la profundidad. No conviertas la separación exterior en un número de posiciones de Garden.`, [item("Keep the seed at the crop-appropriate depth and label the identity separately from related cultivars.", "Mantén la semilla a la profundidad apropiada del cultivo y etiqueta la identidad por separado de cultivares relacionados.")]),
      sectionV0("germination", "Germination", "Germinación", "Use temperature and moisture as the first checks", "Usa temperatura y humedad como primeras comprobaciones", `The reviewed ${name} evidence supports crop-level conditions but not a guaranteed packet-specific day count. Keep the medium moist without chronic saturation.`, `La evidencia revisada de ${spanishName} respalda condiciones a nivel de cultivo, pero no un número de días garantizado para el paquete. Mantén el medio húmedo sin saturación crónica.`, [item("Light/dark requirement and exact emergence window: needs validation.", "Requisito de luz/oscuridad y ventana exacta de emergencia: requiere validación.", "needs_validation", "pending", [])], "source_backed", "medium", [cropSource]),
      sectionV0("afterEmergence", "After emergence", "Después de emerger", "Protect the young root zone and compare vigor", "Protege la zona radicular joven y compara el vigor", "After emergence, preserve even moisture, adequate light, and airflow. Reduce competition only when visible crowding changes the seedling's development.", "Después de emerger, conserva humedad uniforme, luz suficiente y circulación de aire. Reduce la competencia solo cuando el amontonamiento visible cambie el desarrollo.", [item("Cut unwanted crowded seedlings at the base when pulling would disturb the plant being kept.", "Corta en la base las plántulas sobrantes cuando arrancarlas pueda alterar la planta conservada.", "garden_adaptation", "medium", [cropSource])]),
      sectionV0("transition", "Ready for the next stage", "Lista para la siguiente etapa", "Move by visible establishment, not only by days", "Avanza por establecimiento visible, no solo por días", "A stable root zone, active growth, and the first true leaves are better transition signals than an invented universal calendar. The mature plant profile begins after this checkpoint.", "Una zona radicular estable, crecimiento activo y las primeras hojas verdaderas son mejores señales que un calendario universal inventado. El perfil de planta madura empieza después de este punto.", [item("Treat the packet's transplant instructions as identity-specific when they are available.", "Trata las instrucciones de trasplante del paquete como específicas de la identidad cuando estén disponibles.")]),
      sectionV0("handling", "Seed handling & storage", "Manejo y almacenamiento", "Keep seed dry, cool, sealed, and identified", "Mantén la semilla seca, fresca, sellada e identificada", "Store the packet under the general vegetable-seed guidance already accepted by Gardenpedia. No identity-specific longevity value is asserted in this Wave 1 baseline.", "Almacena el paquete según la guía general de semillas de hortalizas ya aceptada por Gardenpedia. Este perfil base de Wave 1 no afirma una duración específica de viabilidad.", [item("Identity-specific longevity and treatment status: needs validation.", "Longevidad específica de la identidad y estado de tratamiento: requiere validación.", "needs_validation", "pending", [])], "source_backed", "medium", ["umn-seed-storage"]),
      sectionV0("troubleshooting", "Common germination problems", "Problemas comunes de germinación", "Diagnose the medium and environment before the identity", "Diagnostica el medio y el entorno antes que la identidad", "If emergence is slow, check temperature, moisture, seed depth, age, and airflow before treating the packet as failed. A related cultivar is not a substitute diagnosis.", "Si la emergencia es lenta, revisa temperatura, humedad, profundidad, edad de la semilla y circulación de aire antes de considerar fallido el paquete. Un cultivar relacionado no sustituye el diagnóstico.", [item("Exact failure thresholds for this identity: needs validation.", "Umbrales exactos de fallo para esta identidad: requieren validación.", "needs_validation", "pending", [])], "source_backed", "medium", [cropSource]),
    ],
  };
}

const plants = identities.map(makePlant);
const spanishSectionCopy = {
  identity: ["Identidad y alcance", "Garden publica esta identidad en el alcance de especie y tipo hortícola documentado, sin convertir una guía general en certeza de cultivar."],
  pruning: ["Manejo según porte y observación", "Ajusta la poda, la cosecha o la eliminación de tejido dañado según el porte real y la evidencia del cultivo. No copies una regla de campo como regla universal del sistema."],
  harvest: ["Cosecha según la etapa del cultivo", "Usa señales visibles de desarrollo y condición de la planta. Los calendarios de la fuente son referencias del cultivo, no promesas para cada sistema."],
  problems: ["Observa las señales que cambian el manejo", "Vigila calor, humedad, hacinamiento y circulación de aire. Registra primero el síntoma y el contexto antes de asignar una causa."],
  flowering: ["Registra floración y cuajado", "Anota botones, primeras flores, cuajado o caída floral como eventos separados. No suprimas una etapa productiva sin evidencia específica."],
  thinning: ["Ralea según la forma de cosecha", "Reduce la competencia cuando el amontonamiento visible perjudique el desarrollo. La separación exterior no se convierte automáticamente en número de posiciones de Garden."],
  hydroponics: ["Compatibilidad hidropónica pendiente", "La evidencia hidropónica específica para esta identidad sigue pendiente en Wave 1. No copies objetivos de otra especie o cultivar."],
};
const translations = Object.fromEntries(plants.map((plant) => [plant.id, {
  summary: `Identidad base de Wave 1 para ${plant.spanishName}. La guía mantiene separadas la evidencia del cultivo, el cultivar y la respuesta del sistema.`,
  sections: Object.fromEntries(Object.keys(plant.sections).map((key) => [key, {
    short: spanishSectionCopy[key]?.[0] || "Orientación con evidencia acotada",
    guidance: spanishSectionCopy[key]?.[1] || `Garden conserva esta orientación en el alcance de la evidencia disponible para ${plant.spanishName}.`,
  }])),
}]));

const seedProfiles = { schemaVersion: "gardenpedia_seed_profile_v0", scope: "published-seed-grown-identities", profiles: Object.fromEntries(identities.map((row) => [row[0], makeSeedProfile(row)])) };
const taxonomy = {
  schemaVersion: "gardenpedia_taxonomy_reconciliation_v1",
  status: "research-input",
  publicationBoundary: "human-approval-required",
  records: identities.map((row) => ({ plantIdentityId: row[0], acceptedScientificName: row[3], synonyms: [], family: null, genus: row[3].split(" ")[0], species: row[3], cultivar: row[4], horticulturalType: row[4], status: "candidate-reconciled", confidence: "medium", sourceIds: ["kew-powo-wave1", "usda-plants-wave1"], conflicts: [] })),
};

for (const [file, value] of [
  ["sources-expansion-wave-1.json", sourceRecords],
  ["plants-expansion-wave-1.json", plants],
  ["translations-expansion-wave-1-es.json", translations],
  ["seed-profiles-expansion-wave-1.json", seedProfiles],
]) fs.writeFileSync(path.join(dataDir, file), `${JSON.stringify(value, null, 2)}\n`);
fs.writeFileSync(taxonomyPath, `${JSON.stringify(taxonomy, null, 2)}\n`);
console.log(JSON.stringify({ plants: plants.length, sources: sourceRecords.length, seedProfiles: Object.keys(seedProfiles.profiles).length }));
