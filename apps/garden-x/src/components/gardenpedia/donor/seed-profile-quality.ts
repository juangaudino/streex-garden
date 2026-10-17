const TEMPLATE_SUMMARY =
  /^A seed-to-established-plant path for .+\. Crop-level evidence is kept separate from exact cultivar or system claims\.$/;
const TEMPLATE_SUMMARY_ES =
  /^Un recorrido desde la semilla hasta una planta establecida de .+\. La evidencia del cultivo se mantiene separada de las afirmaciones exactas de cultivar o sistema\.$/;

export type SeedProfileContentLevel = "crop_level_baseline" | "editorial_profile";

export function seedProfileContentLevel(summary: string): SeedProfileContentLevel {
  return TEMPLATE_SUMMARY.test(summary.trim()) || TEMPLATE_SUMMARY_ES.test(summary.trim())
    ? "crop_level_baseline"
    : "editorial_profile";
}

export function seedProfileSummaryForDisplay(summary: string, language: "en" | "es"): string {
  if (seedProfileContentLevel(summary) !== "crop_level_baseline") return summary;
  return language === "es"
    ? "Esta es una guía base a nivel de cultivo. Consulta la fuente enlazada para método, profundidad y temperatura; aquí no se establecen instrucciones del paquete ni ventana de emergencia."
    : "This is a crop-level baseline. Use the linked crop guide for method, depth, and temperature; packet-specific instructions and an emergence window are not established here.";
}
