// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { CalculatorPage } from "./calculator-page-v1";

vi.mock("@/components/ui/dialog", () => {
  const Passthrough = ({ children }: { children: ReactNode }) => children;
  return {
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? children : null,
    DialogContent: Passthrough,
    DialogDescription: Passthrough,
    DialogHeader: Passthrough,
    DialogTitle: Passthrough,
  };
});

describe("Calculator real control interactions", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps carnivorous plants out of the nutrient picker", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Pinguicula");
    expect(screen.queryByRole("option", { name: /Pinguicula/i })).toBeNull();
  });

  it("explains the individual reported ranges when shared crops have no common range", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    for (const name of ["Bibb Lettuce", "Cherry Tomato"]) {
      await user.click(screen.getByRole("button", { name: "Add plant" }));
      await user.type(screen.getByPlaceholderText("Search plant…"), name);
      await user.click(screen.getByText(name, { exact: true }).closest("button")!);
    }
    expect(screen.getByText(/reported ranges do not overlap/i)).toBeTruthy();
    expect(screen.getByText(/Bibb Lettuce: 1\.20–1\.80 mS\/cm/)).toBeTruthy();
    expect(screen.getByText(/Cherry Tomato: 2\.00–4\.00 mS\/cm/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Oklahoma State University Extension" })
        .getAttribute("href"),
    ).toContain("extension.okstate.edu");
  });

  it("visibly identifies a plant without applicable EC evidence", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Cascading Petunia");
    await user.click(screen.getByRole("option", { name: /Cascading Petunia/ }));
    expect(screen.getByRole("alert").textContent).toMatch(
      /not enough applicable EC evidence.*Cascading Petunia/i,
    );
  });

  it("makes manual EC entry clear when the selected plant lacks a crop range", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Cascading Petunia");
    await user.click(screen.getByRole("option", { name: /Cascading Petunia/ }));
    await user.click(screen.getByRole("tab", { name: "By EC" }));
    expect(screen.getByText(/enter the EC you want to use/i)).toBeTruthy();
    const target = screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement;
    expect(target.value).toBe("");
    await user.type(target, "1.2");
    expect(target.value).toBe("1.2");
  });

  it("preserves actual amounts already entered when the calibration sample volume changes", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Genovese Basil/ }));
    await user.click(screen.getByRole("tab", { name: "By EC" }));
    await user.type(screen.getByLabelText(/^Source-water EC/), "0.20");
    const micro = screen.getByLabelText(/^FloraMicro/) as HTMLInputElement;
    await user.clear(micro);
    await user.type(micro, "1.23");
    const sample = screen.getByLabelText(/^Actual sample volume/) as HTMLInputElement;
    await user.clear(sample);
    await user.type(sample, "2");
    expect(micro.value).toBe("1.23");
  });

  it("does not prefill tiny positive calibration doses as zero", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Genovese Basil/ }));
    await user.click(screen.getByRole("tab", { name: "By EC" }));
    await user.type(screen.getByLabelText(/^Source-water EC/), "0.20");
    const sample = screen.getByLabelText(/^Actual sample volume/);
    await user.clear(sample);
    await user.type(sample, "0.001");
    await user.type(screen.getByLabelText(/^EC before adding nutrients/), "0.20");
    await user.type(screen.getByLabelText(/^EC after mixing/), "1.00");
    for (const name of ["FloraMicro", "FloraGro", "FloraBloom"]) {
      expect((screen.getByLabelText(new RegExp(`^${name}`)) as HTMLInputElement).value).toBe("");
    }
    expect((screen.getByRole("button", { name: "Save calibration" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers optional first-calibration guidance in both languages", async () => {
    const user = userEvent.setup();
    const view = render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Genovese Basil/ }));
    await user.click(screen.getByRole("tab", { name: "By EC" }));
    await user.type(screen.getByLabelText(/^Source-water EC/), "0.20");
    await user.click(screen.getByText("First calibration?"));
    expect(screen.getByText(/actual sample volume and measure its EC/)).toBeTruthy();
    view.unmount();
    window.localStorage.clear();
    render(<CalculatorPage language="es" />);
    await user.click(screen.getByRole("button", { name: "Añadir planta" }));
    await user.type(screen.getByPlaceholderText("Buscar planta…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Albahaca genovesa/i }));
    await user.click(screen.getByRole("tab", { name: "Por EC" }));
    await user.type(screen.getByLabelText(/^EC del agua de origen/), "0.20");
    await user.click(screen.getByText("¿Primera calibración?"));
    expect(screen.getByText(/volumen real de la muestra y mide su EC/)).toBeTruthy();
  });

  it("accepts a small single-plant volume and calculates planned water to capacity", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    const volume = screen.getByLabelText("Reservoir volume") as HTMLInputElement;
    await user.clear(volume);
    await user.type(volume, "0.25");
    expect(volume.value).toBe("0.25");
    await user.click(screen.getByRole("tab", { name: "Top up" }));
    await user.type(screen.getByLabelText(/^Reservoir capacity/), "3.5");
    await user.type(screen.getByLabelText(/^Liters before top-up/), "2.5");
    await user.click(screen.getByRole("button", { name: "Calculate water to capacity" }));
    expect((screen.getByLabelText(/^Water to add/) as HTMLInputElement).value).toBe("1");
  });

  it("keeps a seedling indication with a saved local system", async () => {
    const user = userEvent.setup();
    const first = render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Genovese Basil/ }));
    await user.selectOptions(screen.getByLabelText("Stage of Genovese Basil"), "MIXED");
    await user.click(screen.getByRole("button", { name: "Save as system" }));
    await user.type(screen.getByRole("textbox", { name: "System name" }), "Seedlings");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    first.unmount();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByText("Seedlings", { exact: true }));
    expect((screen.getByLabelText("Stage of Genovese Basil") as HTMLSelectElement).value).toBe(
      "MIXED",
    );
  });

  it("saves and restores different observed stages for two plants of the same variety", async () => {
    const user = userEvent.setup();
    const view = render(<CalculatorPage language="en" />);
    await user.selectOptions(screen.getByLabelText("Growing system"), "KRATKY");
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Bibb Lettuce");
    await user.click(screen.getByRole("option", { name: /Bibb Lettuce/ }));
    expect(screen.getByText(/no verified system-specific range/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.selectOptions(screen.getByLabelText("Stage of Bibb Lettuce"), "VEGETATIVE");
    await user.click(screen.getByText("Other stages of this plant?"));
    await user.click(screen.getByRole("checkbox", { name: "Seedling" }));
    expect(screen.getByRole("alert").textContent).toMatch(/not enough applicable EC evidence/i);
    await user.click(screen.getByRole("button", { name: "Save as system" }));
    await user.type(screen.getByRole("textbox", { name: "System name" }), "Mixed lettuce");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    view.unmount();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByText("Mixed lettuce", { exact: true }));
    expect((screen.getByLabelText("Growing system") as HTMLSelectElement).value).toBe("KRATKY");
    expect((screen.getByLabelText("Stage of Bibb Lettuce") as HTMLSelectElement).value).toBe(
      "VEGETATIVE",
    );
    await user.click(screen.getByText("Other stages of this plant?"));
    expect((screen.getByRole("checkbox", { name: "Seedling" }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("shows the sourced sowing-age reference without converting days into a stage or dose", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Genovese Basil/ }));
    await user.type(screen.getByLabelText("Days since sowing of Genovese Basil"), "15");
    expect(screen.getByText(/Published germination reference: 5–10 days/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Genovese Basil Seed" }).getAttribute("href")).toMatch(
      /^https:/,
    );
    expect((screen.getByLabelText("Stage of Genovese Basil") as HTMLSelectElement).value).toBe(
      "UNSPECIFIED",
    );
    await user.click(screen.getByText("Reference for observing this plant"));
    expect(screen.getByText(/not a hydroponic dose/i)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "University of Minnesota Extension" }).getAttribute("href"),
    ).toContain("extension.umn.edu");
    expect(screen.getByText(/not a confirmed stage or dose/)).toBeTruthy();
  });

  it("offers crop-specific lettuce stage context without assigning a stage from age", async () => {
    const user = userEvent.setup();
    const view = render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Bibb Lettuce");
    await user.click(screen.getByRole("option", { name: /Bibb Lettuce/ }));
    await user.type(screen.getByLabelText("Days since sowing of Bibb Lettuce"), "15");
    await user.click(screen.getByText("Reference for observing this plant"));
    expect(screen.getByText(/3–4 true leaves and roots visible/i)).toBeTruthy();
    expect(screen.getByText(/not a confirmed stage or a dose/i)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "University of Kentucky Center for Crop Diversification" })
        .getAttribute("href"),
    ).toContain("ccd.uky.edu");
    expect((screen.getByLabelText("Stage of Bibb Lettuce") as HTMLSelectElement).value).toBe(
      "UNSPECIFIED",
    );
    view.unmount();
    render(<CalculatorPage language="es" />);
    await user.click(screen.getByRole("button", { name: "Añadir planta" }));
    await user.type(screen.getByPlaceholderText("Buscar planta…"), "Bibb Lettuce");
    await user.click(screen.getByRole("option", { name: /Lechuga Bibb/i }));
    await user.click(screen.getByText("Referencia para observar esta planta"));
    expect(screen.getByText(/3–4 hojas verdaderas y raíces visibles/i)).toBeTruthy();
  });

  it("offers measured AeroGarden calibration to an anonymous visitor before EC dosing", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Genovese Basil/ }));
    await user.click(screen.getByRole("button", { name: "AeroGarden" }));
    await user.click(screen.getByRole("tab", { name: "By EC" }));
    await user.type(screen.getByLabelText(/^Source-water EC/), "0.20");
    expect(screen.getByRole("button", { name: "Calibrate this product" })).toBeTruthy();
    await user.type(screen.getByLabelText(/^EC before adding nutrients/), "0.20");
    await user.type(screen.getByLabelText(/^EC after mixing/), "1.00");
    const amount = screen.getByLabelText(/^Liquid Plant Food/);
    expect((amount as HTMLInputElement).value).toBe("");
    await user.clear(amount);
    await user.type(amount, "4");
    await user.click(screen.getByRole("button", { name: "Save calibration" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Add to the reservoir" })).toBeTruthy(),
    );
    expect(screen.getAllByText("Liquid Plant Food").length).toBeGreaterThan(0);
  });

  it("uses the manufacturer's 3- and 12-pod feeding sequences", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "AeroGarden" }));
    await user.click(screen.getByRole("button", { name: "3 pods" }));
    expect(screen.getByText("4.00", { exact: true })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "12 pods" }));
    expect(screen.getByText("16.00", { exact: true })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Feeding event"), "feeding-3");
    expect(screen.getByText("24.00", { exact: true })).toBeTruthy();
  });

  it("can calculate for an anonymous visitor when browser storage is unavailable", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Genovese Basil/ }));
    await user.click(screen.getByRole("tab", { name: "By EC" }));
    await user.type(screen.getByLabelText(/^Source-water EC/), "0.20");
    await user.type(screen.getByLabelText(/^EC before adding nutrients/), "0.20");
    await user.type(screen.getByLabelText(/^EC after mixing/), "1.00");
    await user.click(screen.getByRole("button", { name: "Save calibration" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Add to the reservoir" })).toBeTruthy(),
    );
    expect(screen.getByRole("alert").textContent).toContain("in memory only");
  });

  it("calibrates an identified A+B product using the user's actual component doses", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Genovese Basil/ }));
    await user.click(screen.getByRole("button", { name: "A + B" }));
    await user.type(screen.getByLabelText("A+B manufacturer"), "Test manufacturer");
    await user.type(screen.getByLabelText("Exact A+B product name"), "Test product");
    await user.type(screen.getByLabelText("Exact formulation or version"), "V1");
    await user.click(screen.getByRole("tab", { name: "By EC" }));
    await user.type(screen.getByLabelText(/^Source-water EC/), "0.20");
    await user.type(screen.getByLabelText(/^EC before adding nutrients/), "0.20");
    await user.type(screen.getByLabelText(/^EC after mixing/), "1.00");
    const a = screen.getByLabelText(/^Part A/);
    const b = screen.getByLabelText(/^Part B/);
    expect((a as HTMLInputElement).value).toBe("");
    expect((b as HTMLInputElement).value).toBe("");
    await user.type(a, "4");
    await user.type(b, "2");
    await user.click(screen.getByRole("button", { name: "Save calibration" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Add to the reservoir" })).toBeTruthy(),
    );
    await user.clear(screen.getByLabelText("Exact formulation or version"));
    await user.type(screen.getByLabelText("Exact formulation or version"), "V2");
    expect(screen.getByRole("button", { name: "Calibrate this product" })).toBeTruthy();
  });

  it("keeps a shared-tank warning while calculating an explicitly chosen EC with calibrated A+B", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    for (const name of ["Bibb Lettuce", "Cherry Tomato"]) {
      await user.click(screen.getByRole("button", { name: "Add plant" }));
      await user.type(screen.getByPlaceholderText("Search plant…"), name);
      await user.click(screen.getByText(name, { exact: true }).closest("button")!);
    }
    expect(screen.getByText(/reported ranges do not overlap/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "A + B" }));
    await user.type(screen.getByLabelText("A+B manufacturer"), "Test manufacturer");
    await user.type(screen.getByLabelText("Exact A+B product name"), "Test product");
    await user.type(screen.getByLabelText("Exact formulation or version"), "V1");
    await user.click(screen.getByRole("tab", { name: "By EC" }));
    await user.type(screen.getByLabelText(/^Source-water EC/), "0.20");
    await user.type(screen.getByRole("textbox", { name: "Target EC" }), "1.20");
    await user.type(screen.getByLabelText(/^EC before adding nutrients/), "0.20");
    await user.type(screen.getByLabelText(/^EC after mixing/), "1.00");
    await user.type(screen.getByLabelText(/^Part A/), "4");
    await user.type(screen.getByLabelText(/^Part B/), "2");
    await user.click(screen.getByRole("button", { name: "Save calibration" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Add to the reservoir" })).toBeTruthy(),
    );
    expect(screen.getByText(/reported ranges do not overlap/i)).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1.20",
    );
    expect(screen.getAllByText("Part A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Part B").length).toBeGreaterThan(0);
  });

  it("restores target, mode, measured state, source water, equipment and actual calibration after reload", async () => {
    const user = userEvent.setup();
    const first = render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Genovese Basil");
    await user.click(screen.getByRole("option", { name: /Genovese Basil/ }));
    await user.click(screen.getByRole("tab", { name: "By EC" }));
    await user.clear(screen.getByLabelText(/^Source-water EC/));
    await user.type(screen.getByLabelText(/^Source-water EC/), "0.20");
    await user.click(screen.getByRole("button", { name: "Calibrate this product" }));
    await user.type(screen.getByLabelText(/^EC before adding nutrients/), "0.20");
    await user.type(screen.getByLabelText(/^EC after mixing/), "1.10");
    for (const [component, dose] of [
      ["FloraMicro", "4"],
      ["FloraGro", "3"],
      ["FloraBloom", "2"],
    ]) {
      const field = screen.getByLabelText(new RegExp(`^${component}`));
      await user.clear(field);
      await user.type(field, dose!);
    }
    await user.click(screen.getByRole("button", { name: "Save calibration" }));
    await user.click(screen.getByRole("tab", { name: "Correct" }));
    await user.type(screen.getByLabelText(/^Liters remaining/), "4");
    const target = screen.getByRole("textbox", { name: "Target EC" });
    await user.clear(target);
    await user.type(target, "1.00");
    await user.type(screen.getByLabelText(/^EC you measured/), "0.80");
    await user.click(screen.getByText("More settings", { exact: true }));
    const resolution = screen.getByLabelText(/^Dosing resolution/);
    await user.clear(resolution);
    await user.type(resolution, "0.1");
    await user.click(screen.getByRole("button", { name: "Save as system" }));
    await user.type(screen.getByRole("textbox", { name: "System name" }), "Complete configuration");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    const saved = JSON.parse(window.localStorage.getItem("gardenpedia.calculator.systems.v1")!)[0];
    expect(saved).toMatchObject({
      mode: "adjust",
      userTarget: 1,
      currentEc: 0.8,
      currentLiters: 4,
      dosingResolutionMl: 0.1,
      liters: 4,
      water: { ec: 0.2 },
      crops: { "genovese-basil": 1 },
    });
    expect(saved.calibrationObservations[0].componentDosesMl).toEqual({
      micro: 4,
      gro: 3,
      bloom: 2,
    });
    first.unmount();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByText("Complete configuration", { exact: true }));
    expect(screen.getByRole("tab", { name: "Correct" }).getAttribute("aria-selected")).toBe("true");
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1",
    );
    expect((screen.getByLabelText(/^EC you measured/) as HTMLInputElement).value).toBe("0.8");
    expect(screen.queryByText("To calculate I need")).toBeNull();
    expect(screen.getByRole("heading", { name: "Add to the reservoir" })).toBeTruthy();
  });

  it("persists full Top Up state and converts measured EC when changing units", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);
    await user.click(screen.getByRole("tab", { name: "Top up" }));
    await user.type(screen.getByLabelText(/^Reservoir capacity/), "4");
    await user.type(screen.getByLabelText(/^Liters before top-up/), "3");
    await user.type(screen.getByLabelText(/^Water to add/), "1");
    await user.type(screen.getByLabelText(/^EC before top-up/), "0.80");
    await user.clear(screen.getByRole("textbox", { name: "Target EC" }));
    await user.type(screen.getByRole("textbox", { name: "Target EC" }), "1.20");
    await user.click(screen.getByText("More settings", { exact: true }));
    await user.click(screen.getByRole("button", { name: /^µS\/cm$/ }));
    expect((screen.getByLabelText(/^EC before top-up/) as HTMLInputElement).value).toBe("800");
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1200",
    );
    await user.click(screen.getByRole("button", { name: "Save as system" }));
    await user.type(screen.getByRole("textbox", { name: "System name" }), "Top up state");
    await user.click(screen.getByRole("button", { name: /^Save$/ }));
    const saved = JSON.parse(window.localStorage.getItem("gardenpedia.calculator.systems.v1")!)[0];
    expect(saved).toMatchObject({
      mode: "topup",
      userTarget: 1.2,
      currentEc: 0.8,
      currentLiters: 3,
      capacityLiters: 4,
      waterAdded: 1,
      unit: "uS",
    });
  });

  it("keeps 0.20 EC intact and completes calibration, By EC, Correct, and Top Up", async () => {
    const user = userEvent.setup();
    render(<CalculatorPage language="en" />);

    await user.click(screen.getByRole("button", { name: "Add plant" }));
    await user.type(screen.getByPlaceholderText("Search plant…"), "Bibb Lettuce");
    await user.click(screen.getByRole("option", { name: /Bibb Lettuce/i }));
    await user.click(screen.getByRole("tab", { name: "By EC" }));

    const sourceEc = screen.getByLabelText(/^Source-water EC/);
    await user.clear(sourceEc);
    await user.type(sourceEc, "0.20");
    expect((sourceEc as HTMLInputElement).value).toBe("0.20");
    expect(screen.getByText(/mS\/cm · 0\.20/)).toBeTruthy();

    const target = screen.getByRole("textbox", { name: "Target EC" });
    expect((target as HTMLInputElement).value).toBe("1.35");
    await user.clear(target);
    await user.type(target, "1.20");
    expect((target as HTMLInputElement).value).toBe("1.20");

    await user.click(screen.getByRole("button", { name: "Calibrate this product" }));
    await user.type(screen.getByLabelText(/^EC before adding nutrients/), "0.20");
    await user.type(screen.getByLabelText(/^EC after mixing/), "1.00");
    expect((screen.getByLabelText(/^FloraMicro/) as HTMLInputElement).value).not.toBe("");
    expect((screen.getByLabelText(/^FloraGro/) as HTMLInputElement).value).not.toBe("");
    expect((screen.getByLabelText(/^FloraBloom/) as HTMLInputElement).value).not.toBe("");
    await user.click(screen.getByRole("button", { name: "Save calibration" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save calibration" })).toBeNull(),
    );

    await user.clear(sourceEc);
    await user.click(screen.getByRole("tab", { name: "Correct" }));
    await user.type(screen.getByLabelText(/^Liters remaining/), "4");
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1.20",
    );
    await user.type(screen.getByLabelText(/^EC you measured/), "0.80");
    await waitFor(() => expect(screen.getAllByText("FloraMicro").length).toBeGreaterThan(0));
    await user.clear(screen.getByLabelText(/^EC you measured/));
    await user.type(screen.getByLabelText(/^EC you measured/), "1.50");
    expect(screen.getByText(/Measure the dilution water EC before calculating dilution/i)).toBeTruthy();
    await user.type(screen.getByLabelText(/^Source-water EC/), "0.20");
    await user.clear(screen.getByLabelText(/^EC you measured/));
    await user.type(screen.getByLabelText(/^EC you measured/), "0.80");
    await user.click(screen.getByText("More settings", { exact: true }));
    await user.type(screen.getByLabelText(/^Reservoir capacity/), "4");
    expect(screen.getByText(/next nutrient dose would exceed reservoir capacity/i)).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Top up" }));
    await user.clear(screen.getByLabelText(/^Reservoir capacity/));
    await user.type(screen.getByLabelText(/^Reservoir capacity/), "4");
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1.20",
    );
    await user.clear(screen.getByLabelText(/^Liters before top-up/));
    await user.type(screen.getByLabelText(/^Liters before top-up/), "3.0");
    await user.type(screen.getByLabelText(/^Water to add/), "0.25");
    await user.clear(screen.getByLabelText(/^EC before top-up/));
    await user.type(screen.getByLabelText(/^EC before top-up/), "0.80");
    await waitFor(() => expect(screen.getAllByText("FloraMicro").length).toBeGreaterThan(0));
    await user.click(screen.getByRole("button", { name: "Calculate water to capacity" }));
    const plannedWater = Number((screen.getByLabelText(/^Water to add/) as HTMLInputElement).value);
    expect(plannedWater).toBeGreaterThan(0);
    expect(plannedWater).toBeLessThan(1);
    expect(plannedWater * 1000).toBeCloseTo(Math.round(plannedWater * 1000));
    expect(screen.getByText("Replacement water").closest("li")?.textContent).toContain(
      String(plannedWater),
    );
    expect(screen.getByRole("status").textContent).toMatch(
      /leaves room for the calibrated nutrients/i,
    );
    expect(screen.getAllByText("FloraMicro").length).toBeGreaterThan(0);
  });
});
