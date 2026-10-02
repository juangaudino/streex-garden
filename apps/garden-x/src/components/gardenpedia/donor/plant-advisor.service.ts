import { ADVISOR_PRESETS } from "./plant-advisor.data";
import { donorPlants as plants } from "./canonical-adapter";
import type { AdvisorRequest, AdvisorResponse, PlantRecommendation } from "./plant-advisor.types";

/**
 * Única puerta de salida del asesor. Hoy resuelve todo en local (modo demo).
 *
 * MIGRACIÓN A BACKEND PROPIO (Vercel / Supabase / OpenAI):
 * sustituye el cuerpo por la llamada a tu endpoint, conservando la firma:
 *
 *   const res = await fetch("/api/advisor", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(request),
 *   });
 *   if (!res.ok) throw new Error("advisor_unavailable");
 *   return (await res.json()) as AdvisorResponse;
 */
export async function getPlantRecommendations(request: AdvisorRequest): Promise<AdvisorResponse> {
  await delay(900);

  const normalized = normalize(request.query);
  if (!normalized) throw new Error("empty_query");

  const preset =
    ADVISOR_PRESETS.find((item) => normalize(item.query) === normalized) ??
    ADVISOR_PRESETS.find((item) => normalize(item.title) === normalized);
  if (preset) return simulateLocalAdvisorResponse({ ...request, query: preset.query });

  return simulateLocalAdvisorResponse(request);
}

/**
 * Deterministic local matching against canonical attributes.
 *
 * The score is not a probability or an agronomic success prediction. It is
 * simply matched requested, evidence-backed criteria / requested criteria.
 */
function simulateLocalAdvisorResponse(request: AdvisorRequest): AdvisorResponse {
  const text = normalize(request.query);
  const requestsUnmodeledLight = /(poca luz|sombra|interior|sin sol|ventana)/.test(text);
  const wantsEasy = /(facil|principiante|resistente|sin experiencia|olvido)/.test(text);
  const wantsHerbs = /(hierba|aromatic|albahaca|menta|cocina|infusion)/.test(text);
  const wantsLeaves = /(hoja|ensalada|lechuga|verde)/.test(text);
  const wantsHydro = /(hidropon|aerogarden|uruq|encimera|pods)/.test(text);
  const wantsFlowers = /(flor|ornamental|poliniz)/.test(text);
  const wantsFruit = /(fruto|tomate|pimiento|pepper|fruit)/.test(text);
  const wantsCompact = /(compact|pequeñ|enano|poco espacio|encimera|small)/.test(text);
  const wantsOwned =
    /(tengo semilla|inventario|mis semillas)/.test(text) ||
    request.activeFilters?.inventory === "owned";

  if (requestsUnmodeledLight) {
    return {
      query: request.query,
      summary:
        "El catálogo distingue exposición exterior, pero todavía no publica una clasificación comparable de intensidad de luz interior.",
      cultivationAdvice:
        "No se asignó una planta por suponer que sol parcial equivale a poca luz interior. Revisa la ficha y el sistema de iluminación real.",
      recommendations: [],
    };
  }

  const scored = plants
    .map((plant) => {
      if (
        wantsHydro &&
        plant.hydroponicSuitability !== "compatible" &&
        plant.hydroponicSuitability !== "conditional"
      ) {
        return null;
      }
      const reasons: string[] = [];
      let criteria = 0;
      let matches = 0;

      if (wantsHerbs) {
        criteria += 1;
        if (plant.categoryKey === "herbs") {
          matches += 1;
          reasons.push("pertenece a la categoría de hierbas del catálogo");
        }
      }
      if (wantsLeaves) {
        criteria += 1;
        if (
          plant.categoryKey === "leafy greens" ||
          (plant.harvestable && plant.categoryKey === "vegetables")
        ) {
          matches += 1;
          reasons.push("tiene una categoría o uso de hoja respaldado por el catálogo");
        }
      }
      if (wantsHydro) {
        criteria += 1;
        if (
          plant.hydroponicSuitability === "compatible" ||
          plant.hydroponicSuitability === "conditional"
        ) {
          matches += 1;
          reasons.push(
            plant.hydroponicSuitability === "compatible"
              ? "compatibilidad hidropónica respaldada"
              : "compatibilidad hidropónica condicional",
          );
        }
      }
      if (wantsFlowers) {
        criteria += 1;
        if (plant.categoryKey === "flowers") {
          matches += 1;
          reasons.push("pertenece a la categoría de flores del catálogo");
        }
      }
      if (wantsFruit) {
        criteria += 1;
        if (plant.categoryKey === "fruits") {
          matches += 1;
          reasons.push("pertenece a la categoría de frutos del catálogo");
        }
      }
      if (wantsCompact) {
        criteria += 1;
        if (plant.growthHabits.includes("compact") || plant.growthHabits.includes("mounded")) {
          matches += 1;
          reasons.push("tiene un hábito compacto o amontonado documentado");
        }
      }
      if (wantsOwned) reasons.push("el inventario privado se revisa solo en Mi jardín");
      if (request.activeFilters?.category && request.activeFilters.category !== "all") {
        criteria += 1;
        if (plant.categoryKey === request.activeFilters.category) matches += 1;
      }

      const score = criteria ? Math.round((matches / criteria) * 100) : 0;

      const recommendation: PlantRecommendation = {
        plantId: plant.id,
        score,
        reason: reasons.length
          ? capitalize(reasons.slice(0, 2).join(" y "))
          : wantsEasy
            ? "La facilidad de cultivo no está establecida como un atributo canónico; no se usa para subir esta recomendación."
            : "No hay una coincidencia canónica explícita para las condiciones indicadas.",
      };
      return recommendation;
    })
    .filter((recommendation): recommendation is PlantRecommendation => Boolean(recommendation))
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((item) => item.score > 0).slice(0, 4);

  return {
    query: request.query,
    summary: top.length
      ? "Interpretamos tus condiciones de luz, espacio y objetivo de cosecha, y comparamos las identidades del catálogo público."
      : "No encontramos una coincidencia clara con esas condiciones.",
    cultivationAdvice: top.length
      ? "Revisa la ficha de cada variedad para confirmar pH, temperatura y ventana de cosecha antes de sembrar."
      : "Indica cuántas horas de luz tienes, si cultivarás en interior o exterior y el espacio disponible.",
    recommendations: top,
  };
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
