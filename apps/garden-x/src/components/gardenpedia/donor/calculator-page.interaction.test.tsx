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
  afterEach(() => cleanup());

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
    await user.type(screen.getByLabelText(/^Liters remaining/), "3");
    await user.type(screen.getByLabelText(/^Water added/), "1");
    await user.type(screen.getByLabelText(/^EC you measured/), "0.80");
    await user.clear(screen.getByRole("textbox", { name: "Target EC" }));
    await user.type(screen.getByRole("textbox", { name: "Target EC" }), "1.20");
    await user.click(screen.getByText("More settings", { exact: true }));
    await user.click(screen.getByRole("button", { name: /^µS\/cm$/ }));
    expect((screen.getByLabelText(/^EC you measured/) as HTMLInputElement).value).toBe("800");
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

    await user.click(screen.getByRole("tab", { name: "Correct" }));
    await user.type(screen.getByLabelText(/^Liters remaining/), "4");
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1.20",
    );
    await user.type(screen.getByLabelText(/^EC you measured/), "0.80");
    await waitFor(() => expect(screen.getAllByText("FloraMicro").length).toBeGreaterThan(0));

    await user.click(screen.getByRole("tab", { name: "Top up" }));
    await user.type(screen.getByLabelText(/^Reservoir capacity/), "4");
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1.20",
    );
    await user.clear(screen.getByLabelText(/^Liters remaining/));
    await user.type(screen.getByLabelText(/^Liters remaining/), "3.0");
    await user.type(screen.getByLabelText(/^Water added/), "0.25");
    await user.clear(screen.getByLabelText(/^EC you measured/));
    await user.type(screen.getByLabelText(/^EC you measured/), "0.80");
    await waitFor(() => expect(screen.getAllByText("FloraMicro").length).toBeGreaterThan(0));
  });
});
