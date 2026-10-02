/**
 * Contrato compartido entre la interfaz y el backend del asesor.
 *
 * Al migrar a infraestructura propia (Vercel + Supabase + OpenAI), el endpoint
 * debe devolver exactamente `AdvisorResponse`. La UI no conoce nada más.
 */

export interface PlantRecommendation {
  /** id existente en el catálogo (src/data/plants.json o tabla equivalente). */
  plantId: string;
  /** afinidad 0-100. */
  score: number;
  /** justificación agronómica breve. */
  reason: string;
}

export interface AdvisorRequest {
  query: string;
  language?: "en" | "es";
  activeFilters?: {
    category?: string;
    light?: string;
    /** @deprecated Kept for callers from the previous two-axis pass. */
    indoorLight?: string;
    outdoorExposure?: string;
    inventory?: string;
  };
}

export interface AdvisorResponse {
  query: string;
  summary: string;
  cultivationAdvice: string;
  recommendations: PlantRecommendation[];
}

export interface QuickQueryPreset {
  id: string;
  badge: string;
  title: string;
  query: string;
  /** Optional donor/demo response; canonical advisor ignores it. */
  response?: AdvisorResponse;
}
