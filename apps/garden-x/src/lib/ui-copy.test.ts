import { describe, expect, it } from "vitest";
import { localizeKnownError, ui } from "./ui-copy";

describe("Garden X interface copy", () => {
  it("keeps the core interface terms aligned in English and Spanish", () => {
    expect(ui("en", "saveGarden")).toBe("Save garden");
    expect(ui("es", "saveGarden")).toBe("Guardar jardín");
    expect(ui("en", "systemLayout")).toBe("System layout");
    expect(ui("es", "systemLayout")).toBe("Distribución del sistema");
  });

  it("localizes recoverable errors without exposing backend wording", () => {
    expect(localizeKnownError(new Error("Position already has a current plant"), "es", "fallback")).toBe(
      ui("es", "positionUnavailable"),
    );
    expect(localizeKnownError(new Error("unexpected internal failure"), "es", "fallback")).toBe("fallback");
  });

  it("keeps product names and botanical identity available in both locales", () => {
    expect(ui("en", "gardenLabs")).toBe("Garden Labs");
    expect(ui("es", "gardenLabs")).toBe("Garden Labs");
    expect(ui("en", "scientificName")).toBe("Scientific name");
    expect(ui("es", "scientificName")).toBe("Nombre científico");
  });

  it("keeps AI Check chrome localized and compact", () => {
    expect(ui("en", "groundedIn")).toBe("What this analysis is grounded in");
    expect(ui("es", "groundedIn")).toBe("En qué se basa este análisis");
    expect(ui("en", "aiThinning")).toBe("Thinning");
    expect(ui("es", "aiThinning")).toBe("Raleo");
    expect(ui("es", "keepGoing")).toBe("Seguir explorando");
  });
});
