import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = path.join(root, "labs", "gardenpedia", "data");
const taxonomyPath = path.join(root, "labs", "gardenpedia", "taxonomy", "reconciliation-v1.json");
const accessed = "2026-10-01";

const sourceRows = [
  ["umn-asian-brassicas-wave2", "University of Minnesota Extension", "Brassica Bonanza: Asian greens and brassicas", "https://blog-fruit-vegetable-ipm.extension.umn.edu/2021/03/2021-considerations-brassica-bonanza.html", "university_extension", 1, "Asian brassica crop context for mizuna, tatsoi and mustard greens; not named-cultivar proof", ["identity", "cultivation", "harvest"]],
  ["umn-fall-greens-wave2", "University of Minnesota Extension", "Planting vegetables for fall harvest", "https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/planting-vegetables-in-midsummer-for-fall-harvest", "university_extension", 1, "cool-season greens and harvest context; crop-level only", ["cultivation", "harvest", "problems"]],
  ["usu-brassica-varietal-wave2", "Utah State University Extension", "Brassica varietal selection", "https://extension.usu.edu/vegetableguide/brassica/varietal-selection", "university_extension", 1, "Brassica crop and variety context; does not prove each catalog type's performance", ["identity", "cultivation", "harvest"]],
  ["usu-kohlrabi-wave2", "Utah State University Extension", "How to Grow Kohlrabi in Your Garden", "https://extension.usu.edu/yardandgarden/research/kohlrabi-in-the-garden", "university_extension", 1, "kohlrabi crop-level temperature, spacing and harvest context", ["cultivation", "harvest", "problems"]],
  ["usu-water-vegetables-wave2", "Utah State University Extension", "Water Recommendations for Vegetables", "https://extension.usu.edu/yardandgarden/research/water-recommendations-for-vegetables", "university_extension", 1, "vegetable moisture and stress context; not cultivar-specific", ["cultivation", "problems"]],
  ["usu-vegetable-varieties-wave2", "Utah State University Extension", "Home Vegetable Garden Variety Recommendations", "https://extension.usu.edu/yardandgarden/research/home-vegetable-garden-variety-recommendations-for-utah", "university_extension", 1, "variety and crop context for common vegetables; regional guidance", ["identity", "cultivation", "harvest"]],
  ["usu-harvest-storage-wave2", "Utah State University Extension", "Harvest and Storage of Vegetables and Fruits", "https://extension.usu.edu/yardandgarden/research/harvest-and-storage-of-vegetables-and-fruits", "university_extension", 1, "crop-level harvest and storage context", ["harvest", "cultivation"]],
  ["johnnys-tomato-variety-wave2", "Johnny's Selected Seeds", "3 Ways to Choose the Best Tomato Varieties", "https://www.johnnyseeds.com/growers-library/vegetables/tomatoes/3-ways-to-choose-the-best-tomatoes.html", "grower_reference", 2, "tomato growth-habit and type terminology; not a universal cultivar measurement", ["identity", "cultivation", "support"]],
  ["johnnys-tomato-catalog-wave2", "Johnny's Selected Seeds", "Tomato seed varieties", "https://prod-na02.johnnyseeds.com/vegetables/tomatoes/", "grower_reference", 2, "product/catalog identity context for named tomato types; product facts stay product-scoped", ["identity", "cultivar"]],
  ["johnnys-sun-gold-wave2", "Johnny's Selected Seeds", "Sun Gold F1 Tomato Seed", "https://www.johnnyseeds.com/vegetables/tomatoes/cherry-tomatoes/sun-gold-f1-tomato-seed-770.53.html", "product_reference", 2, "Sun Gold identity and product-specific growing facts; not all tomato evidence", ["identity", "cultivar", "seedling"]],
  ["johnnys-pepper-catalog-wave2", "Johnny's Selected Seeds", "Pepper seed varieties", "https://www.johnnyseeds.com/vegetables/peppers/?sz=72", "grower_reference", 2, "pepper type and named-product identity context; not universal cultivar performance", ["identity", "cultivar"]],
  ["johnnys-flower-guide-wave2", "Johnny's Selected Seeds", "Flower Growing Guide", "https://www.johnnyseeds.com/on/demandware.static/-/Library-Sites-JSSSharedLibrary/default/dw377bb4f5/assets/information/flower-growing-guide.pdf", "grower_reference", 2, "flower seed starting and crop timing context for cosmos, zinnia and viola", ["identity", "seedling", "cultivation"]],
  ["johnnys-viola-wave2", "Johnny's Selected Seeds", "Viola/Pansy Key Growing Information", "https://www.johnnyseeds.com/growers-library/flowers/viola-pansy/viola-pansy-key-growing-information.html", "grower_reference", 2, "viola/pansy crop-level growth and flowering guidance", ["cultivation", "flowering", "harvest"]],
  ["johnnys-zinnia-wave2", "Johnny's Selected Seeds", "Zinnia Production", "https://www.johnnyseeds.com/on/demandware.static/-/Library-Sites-JSSSharedLibrary/default/dw3e9f4bd5/assets/information/8273-zinnia-production.pdf", "grower_reference", 2, "zinnia production and disease context; not named-cultivar proof", ["cultivation", "flowering", "problems"]],
  ["illinois-summer-savory-wave2", "University of Illinois Extension", "Summer Savory", "https://extension.illinois.edu/herbs/savory-summer", "university_extension", 1, "species-specific summer savory seed, habit, harvest and use guidance", ["identity", "seedling", "cultivation", "harvest"]],
  ["illinois-herbs-wave2", "University of Illinois Extension", "Growing Herbs", "https://extension.illinois.edu/herbs/growing", "university_extension", 1, "general culinary herb container and maintenance context; not cultivar-specific", ["cultivation", "harvest", "problems"]],
  ["usu-anise-hyssop-wave2", "Utah State University Extension", "Long-blooming perennials: anise hyssop", "https://extension.usu.edu/news_sections/gardening/long-blooming-perennials.pdf", "university_extension", 1, "anise hyssop horticultural context; species/cultivar scope remains explicit", ["identity", "cultivation", "flowering"]],
];

const identities = [
  ["mizuna", "Mizuna", "Mizuna", "Brassica rapa", "Mizuna type", "leafy greens", "🥬", "rosette", ["umn-asian-brassicas-wave2", "umn-fall-greens-wave2"]],
  ["tatsoi", "Tatsoi", "Tatsoi", "Brassica rapa", "Tatsoi type", "leafy greens", "🥬", "rosette", ["umn-asian-brassicas-wave2", "umn-fall-greens-wave2"]],
  ["mustard-greens", "Mustard Greens", "Hojas de mostaza", "Brassica juncea", "Mustard green type", "leafy greens", "🥬", "rosette", ["umn-asian-brassicas-wave2", "umn-fall-greens-wave2"]],
  ["collard-greens", "Collard Greens", "Col berza", "Brassica oleracea", "Collard type", "leafy greens", "🥬", "rosette", ["usu-brassica-varietal-wave2", "umn-fall-greens-wave2"]],
  ["red-cabbage", "Red Cabbage", "Col lombarda", "Brassica oleracea", "Red cabbage type", "vegetables", "🥬", "rosette", ["usu-brassica-varietal-wave2", "johnnys-brassicas-wave1"]],
  ["brussels-sprouts", "Brussels Sprouts", "Coles de Bruselas", "Brassica oleracea", "Brussels sprouts type", "vegetables", "🥦", "upright", ["usu-brassica-varietal-wave2", "johnnys-brassicas-wave1"]],
  ["kohlrabi", "Kohlrabi", "Colinabo", "Brassica oleracea", "Kohlrabi type", "vegetables", "🥦", "upright", ["usu-kohlrabi-wave2", "usu-brassica-varietal-wave2"]],
  ["patio-tomato", "Patio Tomato", "Tomate de patio", "Solanum lycopersicum", "Patio tomato type", "fruits", "🍅", "bushy", ["johnnys-tomato-variety-wave2", "johnnys-tomato-catalog-wave2"]],
  ["sun-gold-tomato", "Sun Gold Tomato", "Tomate Sun Gold", "Solanum lycopersicum", "Sun Gold F1", "fruits", "🍅", "spreading", ["johnnys-sun-gold-wave2", "johnnys-tomato-variety-wave2"]],
  ["supersweet-100-tomato", "Supersweet 100 Tomato", "Tomate Supersweet 100", "Solanum lycopersicum", "Supersweet 100 F1", "fruits", "🍅", "spreading", ["johnnys-tomato-catalog-wave2", "johnnys-tomato-variety-wave2"]],
  ["celebrity-tomato", "Celebrity Tomato", "Tomate Celebrity", "Solanum lycopersicum", "Celebrity type", "fruits", "🍅", "bushy", ["johnnys-tomato-catalog-wave2", "johnnys-tomato-variety-wave2"]],
  ["mini-bell-pepper", "Mini Bell Pepper", "Pimiento mini dulce", "Capsicum annuum", "Mini sweet pepper type", "fruits", "🫑", "bushy", ["usu-peppers", "johnnys-pepper-catalog-wave2"]],
  ["poblano-pepper", "Poblano Pepper", "Pimiento poblano", "Capsicum annuum", "Poblano type", "fruits", "🌶️", "bushy", ["usu-peppers", "johnnys-pepper-catalog-wave2"]],
  ["serrano-pepper", "Serrano Pepper", "Pimiento serrano", "Capsicum annuum", "Serrano type", "fruits", "🌶️", "bushy", ["usu-peppers", "johnnys-pepper-catalog-wave2"]],
  ["shishito-pepper", "Shishito Pepper", "Pimiento shishito", "Capsicum annuum", "Shishito type", "fruits", "🌶️", "bushy", ["usu-peppers", "johnnys-pepper-catalog-wave2"]],
  ["habanero-pepper", "Habanero Pepper", "Pimiento habanero", "Capsicum chinense", "Habanero type", "fruits", "🌶️", "bushy", ["usu-peppers", "johnnys-pepper-catalog-wave2"]],
  ["french-breakfast-radish", "French Breakfast Radish", "Rábano French Breakfast", "Raphanus sativus", "French Breakfast type", "root vegetables", "🫜", "rosette", ["johnnys-radish", "usu-vegetable-varieties-wave2"]],
  ["daikon-radish", "Daikon Radish", "Rábano daikon", "Raphanus sativus", "Daikon type", "root vegetables", "🫜", "rosette", ["johnnys-radish", "usu-vegetable-varieties-wave2"]],
  ["golden-beet", "Golden Beet", "Remolacha dorada", "Beta vulgaris", "Golden beet type", "root vegetables", "🫜", "rosette", ["johnnys-beets-wave1", "usu-vegetable-varieties-wave2"]],
  ["parsnip", "Parsnip", "Chirivía", "Pastinaca sativa", "Parsnip type", "root vegetables", "🥕", "rosette", ["usu-vegetable-varieties-wave2", "usu-water-vegetables-wave2"]],
  ["red-onion", "Red Onion", "Cebolla roja", "Allium cepa", "Red bulb onion type", "alliums", "🧅", "upright", ["johnnys-onions-wave1", "usu-vegetable-varieties-wave2"]],
  ["bush-bean-royal-burgundy", "Royal Burgundy Bush Bean", "Frijol de mata Royal Burgundy", "Phaseolus vulgaris", "Royal Burgundy bush type", "vegetables", "🫘", "bushy", ["johnnys-beans-wave1", "usu-water-vegetables-wave2"]],
  ["sugar-snap-pea", "Sugar Snap Pea", "Guisante de azúcar", "Pisum sativum", "Sugar snap type", "vegetables", "🫛", "trailing", ["johnnys-peas-wave1", "usu-water-vegetables-wave2"]],
  ["yellow-squash", "Yellow Squash", "Calabaza amarilla", "Cucurbita pepo", "Yellow summer squash type", "vegetables", "🎃", "spreading", ["johnnys-zucchini", "usu-water-vegetables-wave2"]],
  ["pickling-cucumber", "Pickling Cucumber", "Pepino para encurtir", "Cucumis sativus", "Pickling cucumber type", "fruits", "🥒", "trailing", ["johnnys-cucumber-wave1", "usu-water-vegetables-wave2"]],
  ["marjoram", "Sweet Marjoram", "Mejorana", "Origanum majorana", "Sweet marjoram", "herbs", "🌿", "mounded", ["illinois-herbs-wave2", "psu-herb-companions"]],
  ["summer-savory", "Summer Savory", "Ajedrea de verano", "Satureja hortensis", "Summer savory", "herbs", "🌿", "mounded", ["illinois-summer-savory-wave2", "illinois-herbs-wave2"]],
  ["anise-hyssop", "Anise Hyssop", "Hisopo anisado", "Agastache foeniculum", "Anise hyssop", "herbs", "🌿", "upright", ["usu-anise-hyssop-wave2", "illinois-herbs-wave2"]],
  ["cosmos-sensation", "Sensation Cosmos", "Cosmos Sensation", "Cosmos bipinnatus", "Sensation type", "flowers", "🌸", "upright", ["johnnys-flower-guide-wave2"]],
  ["french-marigold", "French Marigold", "Caléndula francesa", "Tagetes patula", "French marigold type", "flowers", "🌼", "mounded", ["ncsu-tagetes-patula", "johnnys-marigold"]],
  ["zinnia-state-fair", "State Fair Zinnia", "Zinnia State Fair", "Zinnia elegans", "State Fair type", "flowers", "🌸", "upright", ["johnnys-zinnia-wave2", "johnnys-flower-guide-wave2"]],
  ["viola-pansy", "Viola / Pansy", "Pensamiento / viola", "Viola × wittrockiana", "Pansy type", "flowers", "🌸", "mounded", ["johnnys-viola-wave2", "johnnys-flower-guide-wave2"]],
  ["celosia-plumosa", "Plumosa Celosia", "Celosia plumosa", "Celosia argentea", "Plumosa type", "flowers", "🌺", "upright", ["johnnys-flower-guide-wave2", "johnnys-zinnia-wave2"]],
  ["rutabaga", "Rutabaga", "Colinabo sueco", "Brassica napus", "Rutabaga type", "root vegetables", "🫜", "rosette", ["usu-vegetable-varieties-wave2", "johnnys-turnips-wave1"]],
  ["broccoli-raab", "Broccoli Raab", "Brócoli raab", "Brassica rapa", "Broccoli raab type", "vegetables", "🥦", "upright", ["umn-asian-brassicas-wave2", "usu-brassica-varietal-wave2"]],
  ["endive", "Endive", "Escarola", "Cichorium endivia", "Endive type", "leafy greens", "🥬", "rosette", ["umn-fall-greens-wave2", "usu-vegetable-varieties-wave2"]],
];

const sourceRecords = sourceRows.map(([id, publisher, title, url, type, tier, scope, claimKinds]) => ({
  id, publisher, title, url, type, tier, scope, accessed, license: null,
  provenance: "Gardenpedia Labs Wave 2 source registry", claimKinds,
}));
function evidence(sourceIds, taxon, note) {
  return [{ sourceIds, evidenceType: "source_backed", confidence: "medium", taxonomicScope: { level: "species", taxon }, note }];
}

function section(short, guidance, sourceIds, evidenceType = "source_backed", confidence = "medium") {
  return { short, guidance, evidenceType, confidence, sourceIds };
}

function compatibility({ scientificName, habit, sourceIds, hydro }) {
  return {
    profileVersion: 1,
    hydroponicSuitability: hydro ? { status: "pending", reason: "Wave 2 does not establish identity-specific hydroponic performance for this crop/type." } : { status: "unknown", reason: "No identity-specific hydroponic evidence was accepted in Wave 2." },
    growthHabits: { status: "known", value: [habit], evidence: evidence(sourceIds, scientificName, "Crop/type-level growth habit; not a universal named-cultivar measurement.") },
    matureSize: { height: { status: "unknown", reason: "Identity-specific mature height remains unresolved." }, spread: { status: "unknown", reason: "Identity-specific mature spread remains unresolved." } },
    spacing: { status: "unknown", reason: "Field spacing is not converted into a universal Garden system position rule." },
    light: { status: "known", value: [{ phase: "growing", requirement: { kind: "full_sun" } }], evidence: evidence(sourceIds, scientificName, "Crop-level light context; system response remains context-dependent.") },
  };
}

function makePlant(row) {
  const [id, name, spanishName, scientificName, variety, category, emoji, habit, sourceIds] = row;
  const fruiting = ["patio-tomato", "sun-gold-tomato", "supersweet-100-tomato", "celebrity-tomato", "mini-bell-pepper", "poblano-pepper", "serrano-pepper", "shishito-pepper", "habanero-pepper", "yellow-squash", "pickling-cucumber"].includes(id);
  const flowers = category === "flowers";
  const roots = category === "root vegetables" || ["red-onion"].includes(id);
  const leafy = category === "leafy greens";
  const hydro = ["mizuna", "tatsoi", "mustard-greens", "endive"].includes(id);
  const sections = {
    identity: section(`${name} is resolved at ${scientificName} and ${variety} type scope`, `${name} is published as a practical horticultural type. Crop evidence is not promoted into unsupported named-cultivar certainty.`, sourceIds),
    pruning: section(fruiting ? "Manage structure without assuming a universal pruning rule" : flowers ? "Shape and deadhead according to the flower type" : "Manage by harvest, thinning, and visible crowding", fruiting ? "Use support or shaping only when the actual plant architecture needs it; compact, determinate, and vining habits are not interchangeable." : flowers ? "Deadhead or shape when the documented flower habit benefits from it, while preserving the plant's natural form." : "Use selective harvest, thinning, or removal of damaged tissue as the plant requires. Do not turn field spacing into a fixed pod count.", sourceIds, "garden_adaptation", "medium"),
    harvest: section(roots ? "Harvest the usable root or basal structure at the crop stage" : flowers ? "Harvest or enjoy flowers as an ornamental crop" : fruiting ? "Harvest by maturity cues, not a fixed calendar promise" : "Harvest selectively while preserving active growth", roots ? "Manage toward the edible root or bulb. Exact timing depends on temperature, planting method, and the actual plant." : flowers ? "Wave 2 treats this identity primarily as ornamental; culinary use is not inferred without identity-specific edible-flower evidence." : fruiting ? "Use firmness, color, size, and plant condition as harvest signals. Source calendars remain crop/type references rather than guarantees." : "Remove usable leaves or stems cleanly and preserve enough active tissue for continued growth where repeat harvest is supported.", sourceIds, flowers ? "source_backed" : "garden_adaptation", "medium"),
    problems: section("Watch the problems that change management", roots ? "Irregular moisture, compaction, and temperature can change root or bulb development. Record the visible symptom and context before assigning a cause." : flowers ? "Watch stress, poor airflow, and flower loss. Do not diagnose a disease from a single visual symptom." : "Heat, moisture stress, crowding, and poor airflow can change growth. Use crop context plus actual observations before choosing an intervention.", sourceIds, "source_backed", "medium"),
  };
  if (fruiting) sections.flowering = section("Flowering and fruit set are useful lifecycle events", "Record first flowers, fruit set, and flower drop as separate observations. Do not apply leaf-herb care rules to fruiting crops.", sourceIds, "garden_adaptation", "medium");
  if (roots || leafy) sections.thinning = section("Thin or separate according to the intended harvest form", "Reduce competition when visible crowding changes the intended edible structure or leaf quality. Outdoor spacing is not a universal Garden system count.", sourceIds, "garden_adaptation", "medium");
  if (hydro) sections.hydroponics = section("Hydroponic suitability remains pending", "No identity-specific Wave 2 evidence establishes system compatibility. Do not infer it from plant size or from another crop.", [], "needs_validation", "pending");
  return { id, name, spanishName, scientificName, variety, category, emoji, guideCompletion: 68, tags: [id, name.toLowerCase(), spanishName.toLowerCase(), scientificName.toLowerCase(), variety.toLowerCase()], summary: `${name} is a Wave 2 baseline identity with crop/type guidance. Exact cultivar performance, system response, and dimensions remain scoped to the cited evidence.`, metrics: [], sections, compatibilityProfile: compatibility({ scientificName, habit, sourceIds, hydro }) };
}

function fact(key, labelEn, labelEs, valueEn, valueEs, noteEn, noteEs, evidenceType, confidence, sourceIds) {
  return { key, label: { en: labelEn, es: labelEs }, value: { en: valueEn, es: valueEs }, note: { en: noteEn, es: noteEs }, evidenceType, confidence, sourceIds };
}

function makeSeedProfile(row) {
  const [id, name, spanishName, scientificName, variety, category, emoji, habit, sourceIds] = row;
  const cropSource = sourceIds[0];
  const item = (textEn, textEs, evidenceType = "source_backed", confidence = "medium", ids = [cropSource]) => ({ text: { en: textEn, es: textEs }, evidenceType, confidence, sourceIds: ids });
  const sectionV0 = (key, titleEn, titleEs, shortEn, shortEs, guidanceEn, guidanceEs, items, evidenceType = "source_backed", confidence = "medium", ids = [cropSource]) => ({ key, title: { en: titleEn, es: titleEs }, icon: { sowing: "🌱", germination: "⏳", afterEmergence: "🌿", transition: "🪴", handling: "📦", troubleshooting: "⚠️" }[key], short: { en: shortEn, es: shortEs }, guidance: { en: guidanceEn, es: guidanceEs }, items, evidenceType, confidence, sourceIds: ids });
  return {
    plantIdentityId: id,
    label: { en: "SEED PROFILE", es: "PERFIL DE SEMILLA" },
    summary: { en: `A seed-to-established-plant path for ${name}. Crop-level evidence is kept separate from exact cultivar or system claims.`, es: `Un recorrido desde la semilla hasta una planta establecida de ${spanishName}. La evidencia del cultivo se mantiene separada de las afirmaciones exactas de cultivar o sistema.` },
    quickFacts: [
      fact("germination", "Germination", "Germinación", "Crop-specific range pending", "Rango específico del cultivo pendiente", "Do not turn a general crop window into a packet guarantee", "No conviertas una ventana general del cultivo en garantía del paquete", "needs_validation", "pending", []),
      fact("temperature", "Germination temperature", "Temperatura de germinación", "Use the crop guide range", "Usa el rango de la guía del cultivo", "Exact packet conditions are not resolved in Wave 2", "Las condiciones exactas del paquete no están resueltas en Wave 2", "source_backed", "medium", sourceIds),
      fact("depth", "Sowing depth", "Profundidad de siembra", "Follow the crop-specific guide", "Sigue la guía específica del cultivo", "Packet depth should win when the actual packet is available", "La profundidad del paquete debe prevalecer cuando el paquete real esté disponible", "source_backed", "medium", [...sourceIds, "johnnys-seed-starting"]),
      fact("seedType", "Seed form", "Forma de la semilla", "Packet form not verified", "Forma del paquete no verificada", "Pelleted, treated, or coated status needs the actual packet", "El estado peletizado, tratado o recubierto requiere el paquete real", "needs_validation", "pending", []),
    ],
    sections: [
      sectionV0("sowing", "Sowing", "Siembra", "Start with a clean, evenly moist medium", "Empieza con un medio limpio y uniformemente húmedo", `Use the ${name} crop guide for method and depth. Do not convert outdoor spacing into a Garden position count.`, `Usa la guía del cultivo ${spanishName} para el método y la profundidad. No conviertas la separación exterior en un número de posiciones de Garden.`, [item("Keep the seed at the crop-appropriate depth and label the identity separately from related types.", "Mantén la semilla a la profundidad apropiada del cultivo y etiqueta la identidad por separado de tipos relacionados.")]),
      sectionV0("germination", "Germination", "Germinación", "Use temperature and moisture as the first checks", "Usa temperatura y humedad como primeras comprobaciones", `The reviewed ${name} evidence supports crop-level conditions but not a guaranteed packet-specific day count. Keep the medium moist without chronic saturation.`, `La evidencia revisada de ${spanishName} respalda condiciones a nivel de cultivo, pero no un número de días garantizado para el paquete. Mantén el medio húmedo sin saturación crónica.`, [item("Light/dark requirement and exact emergence window: needs validation.", "Requisito de luz/oscuridad y ventana exacta de emergencia: requiere validación.", "needs_validation", "pending", [])], "source_backed", "medium", sourceIds),
      sectionV0("afterEmergence", "After emergence", "Después de emerger", "Protect the young root zone and compare vigor", "Protege la zona radicular joven y compara el vigor", "After emergence, preserve even moisture, adequate light, and airflow. Reduce competition only when visible crowding changes seedling development.", "Después de emerger, conserva humedad uniforme, luz suficiente y circulación de aire. Reduce la competencia solo cuando el amontonamiento visible cambie el desarrollo.", [item("Cut unwanted crowded seedlings at the base when pulling would disturb the plant being kept.", "Corta en la base las plántulas sobrantes cuando arrancarlas pueda alterar la planta conservada.", "garden_adaptation", "medium", sourceIds)]),
      sectionV0("transition", "Ready for the next stage", "Lista para la siguiente etapa", "Move by visible establishment, not only by days", "Avanza por establecimiento visible, no solo por días", "A stable root zone, active growth, and true leaves are better transition signals than an invented universal calendar. The mature plant profile begins after this checkpoint.", "Una zona radicular estable, crecimiento activo y hojas verdaderas son mejores señales que un calendario universal inventado. El perfil de planta madura empieza después de este punto.", [item("Treat packet transplant instructions as identity-specific when available.", "Trata las instrucciones de trasplante del paquete como específicas de la identidad cuando estén disponibles.")]),
      sectionV0("handling", "Seed handling & storage", "Manejo y almacenamiento", "Keep seed dry, cool, sealed, and identified", "Mantén la semilla seca, fresca, sellada e identificada", "Store the packet under the general vegetable-seed guidance already accepted by Gardenpedia. No identity-specific longevity value is asserted in this Wave 2 baseline.", "Almacena el paquete según la guía general de semillas ya aceptada por Gardenpedia. Este perfil base de Wave 2 no afirma una duración específica de viabilidad.", [item("Identity-specific longevity and treatment status: needs validation.", "Longevidad específica de la identidad y estado de tratamiento: requiere validación.", "needs_validation", "pending", [])], "source_backed", "medium", ["umn-seed-storage"]),
      sectionV0("troubleshooting", "Common germination problems", "Problemas comunes de germinación", "Diagnose the medium and environment before the identity", "Diagnostica el medio y el entorno antes que la identidad", "If emergence is slow, check temperature, moisture, seed depth, age, and airflow before treating the packet as failed. A related type is not a substitute diagnosis.", "Si la emergencia es lenta, revisa temperatura, humedad, profundidad, edad de la semilla y circulación de aire antes de considerar fallido el paquete. Un tipo relacionado no sustituye el diagnóstico.", [item("Exact failure thresholds for this identity: needs validation.", "Umbrales exactos de fallo para esta identidad: requieren validación.", "needs_validation", "pending", [])], "source_backed", "medium", sourceIds),
    ],
  };
}

const plants = identities.map(makePlant);
const sectionCopy = {
  identity: ["Identidad y alcance", "Garden publica esta identidad en el alcance de especie y tipo hortícola documentado, sin convertir una guía general en certeza de cultivar."],
  pruning: ["Manejo según porte y observación", "Ajusta la poda, la cosecha o la eliminación de tejido dañado según el porte real y la evidencia del cultivo."],
  harvest: ["Cosecha según la etapa del cultivo", "Usa señales visibles de desarrollo y condición de la planta. Los calendarios son referencias del cultivo, no promesas para cada sistema."],
  problems: ["Observa las señales que cambian el manejo", "Vigila calor, humedad, hacinamiento y circulación de aire. Registra primero el síntoma y el contexto antes de asignar una causa."],
  flowering: ["Registra floración y cuajado", "Anota botones, primeras flores, cuajado o caída floral como eventos separados. No suprimas una etapa productiva sin evidencia específica."],
  thinning: ["Ralea según la forma de cosecha", "Reduce la competencia cuando el amontonamiento visible perjudique el desarrollo. La separación exterior no se convierte automáticamente en número de posiciones de Garden."],
  hydroponics: ["Compatibilidad hidropónica pendiente", "La evidencia específica para esta identidad sigue pendiente. No copies objetivos de otra especie o cultivar."],
};
const translations = Object.fromEntries(plants.map((plant) => [plant.id, { summary: `Identidad base de Wave 2 para ${plant.spanishName}. La guía mantiene separadas la evidencia del cultivo, el cultivar y la respuesta del sistema.`, sections: Object.fromEntries(Object.keys(plant.sections).map((key) => [key, { short: sectionCopy[key][0], guidance: sectionCopy[key][1] }])) }]));
const seedProfiles = { schemaVersion: "gardenpedia_seed_profile_v0", scope: "published-seed-grown-identities", profiles: Object.fromEntries(identities.map((row) => [row[0], makeSeedProfile(row)])) };

const familyByGenus = { Brassica: "Brassicaceae", Solanum: "Solanaceae", Capsicum: "Solanaceae", Raphanus: "Brassicaceae", Beta: "Amaranthaceae", Pastinaca: "Apiaceae", Allium: "Amaryllidaceae", Phaseolus: "Fabaceae", Pisum: "Fabaceae", Cucurbita: "Cucurbitaceae", Cucumis: "Cucurbitaceae", Origanum: "Lamiaceae", Satureja: "Lamiaceae", Agastache: "Lamiaceae", Cosmos: "Asteraceae", Tagetes: "Asteraceae", Zinnia: "Asteraceae", Viola: "Violaceae", Celosia: "Amaranthaceae", Cichorium: "Asteraceae" };
const existingTaxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
const newTaxonomy = identities.map((row) => {
  const [id, , , scientificName, variety] = row;
  const parts = scientificName.split(" ");
  return { plantIdentityId: id, acceptedScientificName: scientificName, synonyms: [], family: familyByGenus[parts[0]] || null, genus: parts[0], species: parts.slice(1).join(" "), cultivar: /type$|type /i.test(variety) ? null : variety, horticulturalType: variety, status: "candidate-reconciled", confidence: "medium", sourceIds: ["kew-powo-wave1", "usda-plants-wave1"], conflicts: [] };
});
const newIds = new Set(newTaxonomy.map((record) => record.plantIdentityId));
const taxonomy = { ...existingTaxonomy, records: [...existingTaxonomy.records.filter((record) => !newIds.has(record.plantIdentityId)), ...newTaxonomy] };

for (const [file, value] of [["sources-expansion-wave-2.json", sourceRecords], ["plants-expansion-wave-2.json", plants], ["translations-expansion-wave-2-es.json", translations], ["seed-profiles-expansion-wave-2.json", seedProfiles]]) fs.writeFileSync(path.join(dataDir, file), `${JSON.stringify(value, null, 2)}\n`);
fs.writeFileSync(taxonomyPath, `${JSON.stringify(taxonomy, null, 2)}\n`);
console.log(JSON.stringify({ plants: plants.length, sources: sourceRecords.length, seedProfiles: Object.keys(seedProfiles.profiles).length, taxonomyRecords: taxonomy.records.length }));
