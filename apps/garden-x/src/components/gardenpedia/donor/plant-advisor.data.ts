import type { QuickQueryPreset } from "./plant-advisor.types";

/** Prompt starters only. Results are always calculated from the canonical catalog. */
export const ADVISOR_PRESETS: QuickQueryPreset[] = [
  {
    id: "beginner",
    badge: "🌿",
    title: "Principiante sin experiencia",
    query: "No tengo experiencia cultivando y quiero algo fácil para empezar.",
  },
  {
    id: "low-light",
    badge: "☀️",
    title: "Poca luz / interior",
    query: "Tengo poca luz y quiero cultivar en interior.",
  },
  {
    id: "continuous-harvest",
    badge: "✂️",
    title: "Cosecha continua",
    query: "Quiero cosechar hojas frescas cada semana sin arrancar la planta entera.",
  },
  {
    id: "compact-hydro",
    badge: "💧",
    title: "Hidroponía compacta",
    query: "Tengo un sistema hidropónico pequeño en la encimera.",
  },
];
