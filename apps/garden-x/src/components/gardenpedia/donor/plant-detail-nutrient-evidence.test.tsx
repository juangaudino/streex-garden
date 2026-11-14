// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { buildDonorPlantDetail, findCanonicalEntry } from "./canonical-adapter";
import { DonorPlantDetailPage } from "./plant-detail";

describe("Plant Detail nutrient evidence presentation", () => {
  afterEach(() => cleanup());

  it("does not show a generic EC target for epazote when crop evidence is insufficient", () => {
    const entry = findCanonicalEntry("epazote");
    expect(entry).toBeDefined();
    render(<DonorPlantDetailPage detail={buildDonorPlantDetail(entry!, "en")} language="en" />);

    expect(
      screen.getByRole("heading", { name: "Nutrient mixing calculator" }),
    ).toBeTruthy();
    expect(screen.getByText("Insufficient evidence")).toBeTruthy();
    expect(screen.queryByText(/target ec 1(?:\.0)?[–-]1\.6/i)).toBeNull();
    expect(screen.queryByText(/estimated ec/i)).toBeNull();
  });

  it("renders the same evidence boundary in Spanish", () => {
    const entry = findCanonicalEntry("epazote");
    expect(entry).toBeDefined();
    render(<DonorPlantDetailPage detail={buildDonorPlantDetail(entry!, "es")} language="es" />);

    expect(
      screen.getByRole("heading", { name: "Calculadora de mezcla nutritiva" }),
    ).toBeTruthy();
    expect(screen.getByText("Evidencia insuficiente")).toBeTruthy();
    expect(screen.queryByText(/EC objetivo\s*1(?:\.0)?[–-]1\.6/i)).toBeNull();
  });

  it("opens the canonical calculator instead of the legacy nutrient calculator", async () => {
    const entry = findCanonicalEntry("genovese-basil");
    expect(entry).toBeDefined();
    const open = vi.fn();
    render(<DonorPlantDetailPage detail={buildDonorPlantDetail(entry!, "es")} language="es" onOpenCalculator={open} />);

    expect(screen.getByRole("heading", { name: "Calculadora de mezcla nutritiva" })).toBeTruthy();
    expect(screen.queryByText("Evidencia insuficiente")).toBeNull();
    expect(screen.queryByText(/40% menos de concentrado/i)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Abrir calculadora" }));
    expect(open).toHaveBeenCalledOnce();
  });
});
