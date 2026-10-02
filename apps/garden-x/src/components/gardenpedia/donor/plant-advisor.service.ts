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

/** Heurística local solo para el demo: puntúa el catálogo por palabras clave. */
function simulateLocalAdvisorResponse(request: AdvisorRequest): AdvisorResponse {
  const text = normalize(request.query);
  const wantsLowLight = /(poca luz|sombra|interior|sin sol|ventana)/.test(text);
  const wantsEasy = /(facil|principiante|resistente|sin experiencia|olvido)/.test(text);
  const wantsHerbs = /(hierba|aromatic|albahaca|menta|cocina|infusion)/.test(text);
  const wantsLeaves = /(hoja|ensalada|lechuga|verde)/.test(text);
  const wantsHydro = /(hidropon|aerogarden|uruq|encimera|pods)/.test(text);
  const wantsOwned =
    /(tengo semilla|inventario|mis semillas)/.test(text) ||
    request.activeFilters?.inventory === "owned";

  const scored = plants
    .map((plant) => {
      let score = 55;
      const reasons: string[] = [];

      if (wantsLowLight) {
        if (plant.light === "baja") {
          score += 24;
          reasons.push("prospera con luz escasa");
        } else if (plant.light === "media") {
          score += 12;
          reasons.push("acepta luz moderada de interior");
        } else {
          score -= 18;
        }
      }
      if (wantsHerbs && plant.category === "herbs") {
        score += 18;
        reasons.push("aromática de uso continuo en cocina");
      }
      if (wantsLeaves && (plant.category === "leafy greens" || plant.category === "vegetables")) {
        score += 18;
        reasons.push("follaje comestible de ciclo corto");
      }
      if (wantsHydro && (plant.category === "herbs" || plant.category === "leafy greens")) {
        score += 14;
        reasons.push("porte compacto apto para sistemas de mesa");
      }
      if (wantsEasy && plant.sourceCount >= 2) {
        score += 10;
        reasons.push("tiene más de una fuente canónica asociada");
      }
      if (wantsOwned) reasons.push("el estado de inventario privado se revisa solo en Mi jardín");
      if (request.activeFilters?.category && request.activeFilters.category !== "all") {
        if (plant.category === request.activeFilters.category) score += 8;
        else score -= 10;
      }

      const recommendation: PlantRecommendation = {
        plantId: plant.id,
        score: clamp(score),
        reason: reasons.length
          ? capitalize(reasons.slice(0, 2).join(" y "))
          : `Opción equilibrada del catálogo con ${plant.sourceCount} fuentes canónicas asociadas.`,
      };
      return recommendation;
    })
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((item) => item.score >= 62).slice(0, 4);

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

function clamp(value: number) {
  return Math.max(0, Math.min(99, Math.round(value)));
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("es") + value.slice(1);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
