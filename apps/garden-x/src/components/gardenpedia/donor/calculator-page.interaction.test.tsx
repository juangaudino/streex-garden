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
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1.20",
    );
    await user.type(screen.getByLabelText(/^EC you measured/), "0.80");
    await waitFor(() => expect(screen.getAllByText("FloraMicro").length).toBeGreaterThan(0));

    await user.click(screen.getByRole("tab", { name: "Top up" }));
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1.20",
    );
    await user.type(screen.getByLabelText(/^Liters remaining/), "3.0");
    await user.type(screen.getByLabelText(/^Water added/), "0.25");
    await user.clear(screen.getByLabelText(/^EC you measured/));
    await user.type(screen.getByLabelText(/^EC you measured/), "0.80");
    await waitFor(() => expect(screen.getAllByText("FloraMicro").length).toBeGreaterThan(0));
  });
});
