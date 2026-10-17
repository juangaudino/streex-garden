// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildDonorPlantDetail, findCanonicalEntry } from "./canonical-adapter";
import { DonorPlantDetailPage } from "./plant-detail";

describe("Plant Detail nutrient evidence presentation", () => {
  afterEach(() => cleanup());

  it("does not show a generic EC target for fenugreek when crop evidence is insufficient", () => {
    const entry = findCanonicalEntry("common-fenugreek-trigonella-foenum-graecum");
    expect(entry).toBeDefined();
    render(<DonorPlantDetailPage detail={buildDonorPlantDetail(entry!, "en")} language="en" />);

    expect(
      screen.getByRole("heading", { name: "No crop-specific nutrient target available" }),
    ).toBeTruthy();
    expect(screen.getByText("Insufficient evidence")).toBeTruthy();
    expect(screen.queryByText(/target ec 1(?:\.0)?[–-]1\.6/i)).toBeNull();
    expect(screen.queryByText(/estimated ec/i)).toBeNull();
  });

  it("renders the same evidence boundary in Spanish", () => {
    const entry = findCanonicalEntry("common-fenugreek-trigonella-foenum-graecum");
    expect(entry).toBeDefined();
    render(<DonorPlantDetailPage detail={buildDonorPlantDetail(entry!, "es")} language="es" />);

    expect(
      screen.getByRole("heading", { name: "Guía nutritiva no disponible para esta identidad" }),
    ).toBeTruthy();
    expect(screen.getByText("Evidencia insuficiente")).toBeTruthy();
    expect(screen.queryByText(/EC objetivo\s*1(?:\.0)?[–-]1\.6/i)).toBeNull();
  });

  it("preserves the embedded calculator for a crop with applicable evidence", () => {
    const entry = findCanonicalEntry("genovese-basil");
    expect(entry).toBeDefined();
    render(<DonorPlantDetailPage detail={buildDonorPlantDetail(entry!, "es")} language="es" />);

    expect(screen.getByRole("heading", { name: "Calculadora de mezcla nutritiva" })).toBeTruthy();
    expect(screen.queryByText("Evidencia insuficiente")).toBeNull();
  });
});
