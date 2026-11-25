// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: unknown }) => children,
  DialogContent: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  DialogDescription: ({ children }: { children: unknown }) => <p>{children as never}</p>,
  DialogHeader: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  DialogTitle: ({ children }: { children: unknown }) => <h2>{children as never}</h2>,
}));

import { CalculatorPage } from "./calculator-page-v1";

afterEach(cleanup);

describe("Calculator plant-stage guidance", () => {
  it("keeps public profile cues collapsed and presents their provenance when opened", () => {
    render(<CalculatorPage language="en" initialPlantId="genovese-basil" />);

    const disclosure = screen.getByText("Profile cues to help identify the stage");
    const details = disclosure.closest("details");
    expect(details?.open).toBe(false);
    expect(screen.getByText(/The stage selected above drives the calculation/)).toBeTruthy();

    fireEvent.click(disclosure);

    expect(details?.open).toBe(true);
    expect(
      screen.getByText(/Days since sowing do not confirm a stage or change the dose/),
    ).toBeTruthy();
    expect(screen.getByText(/NC State Extension describes Genovese/)).toBeTruthy();
    expect(screen.getAllByText("Source-backed").length).toBeGreaterThan(0);
    expect(
      within(details!)
        .getAllByRole("link")
        .every((link) => link.getAttribute("href")?.startsWith("https://")),
    ).toBe(true);
  });

  it("explains that days are contextual in Spanish and do not replace the chosen stage", () => {
    render(<CalculatorPage language="es" initialPlantId="genovese-basil" />);

    expect(
      screen.getByText(/Los días se guardan como referencia y no cambian la etapa ni la dosis/),
    ).toBeTruthy();
  });

  it("shows the lettuce transplant-age cue without selecting a phenological stage", () => {
    render(<CalculatorPage language="en" initialPlantId="bibb-lettuce" />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Days since sowing of Bibb Lettuce" }), {
      target: { value: "17" },
    });

    expect(screen.getByText(/typical transplant window/i)).toBeTruthy();
    expect(screen.getAllByText(/3–4 true leaves/i).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("combobox")
        .some((select) => (select as HTMLSelectElement).value === "UNSPECIFIED"),
    ).toBe(true);
  });

  it("shows published holy-basil age windows only as confirmation cues", () => {
    render(<CalculatorPage language="es" initialPlantId="tulsi-holy-basil-ocimum-tenuiflorum" />);

    fireEvent.change(screen.getByRole("spinbutton", { name: /Días desde la siembra de/ }), {
      target: { value: "18" },
    });

    expect(screen.getByText(/sitúa sus plántulas aproximadamente en esta ventana/i)).toBeTruthy();
    expect(
      screen
        .getAllByRole("combobox")
        .some((select) => (select as HTMLSelectElement).value === "UNSPECIFIED"),
    ).toBe(true);
  });

  it("offers both reported Zinnia EC treatments as explicit user targets", () => {
    render(<CalculatorPage language="en" initialPlantId="zinnia-lilliput-mixed" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    fireEvent.click(screen.getByText("View cultivation sources"));

    expect(screen.getByRole("button", { name: /1\.40 mS\/cm/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /2\.80 mS\/cm/ }));

    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "2.8",
    );
  });

  it("offers the two directly reported NFT Marigold treatments without making a range", () => {
    render(<CalculatorPage language="en" initialPlantId="marigold-jolly-jester" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    fireEvent.click(screen.getByText("View cultivation sources"));

    expect(screen.getAllByRole("button", { name: /1\.50 mS\/cm/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /3\.00 mS\/cm/ }));

    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "3",
    );
  });

  it("offers each reported Epazote and Papalo treatment as a manual target choice", () => {
    const { unmount } = render(<CalculatorPage language="en" initialPlantId="epazote" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    fireEvent.click(screen.getByText("View cultivation sources"));
    for (const value of ["1.00", "1.50", "2.00"]) {
      expect(screen.getByRole("button", { name: new RegExp(`${value} mS/cm`) })).toBeTruthy();
    }

    unmount();
    render(<CalculatorPage language="en" initialPlantId="papalo-porophyllum-ruderale" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    fireEvent.click(screen.getByText("View cultivation sources"));
    for (const value of ["1.00", "1.50", "2.00", "2.50"]) {
      expect(screen.getByRole("button", { name: new RegExp(`${value} mS/cm`) })).toBeTruthy();
    }
  });

  it("offers the three reported Culantro nutrient-solution treatments as user choices", () => {
    render(<CalculatorPage language="en" initialPlantId="culantro" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    fireEvent.click(screen.getByText("View cultivation sources"));
    for (const value of ["1.00", "1.50", "2.00"]) {
      expect(screen.getByRole("button", { name: new RegExp(`${value} mS/cm`) })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: /2\.00 mS\/cm/ }));
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "2",
    );
  });

  it("shows only lower reported Komatsuna study choices and retains the damage warning", () => {
    render(<CalculatorPage language="en" initialPlantId="lady-murasaki-komatsuna" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    fireEvent.click(screen.getByText("View cultivation sources"));
    expect(screen.getByRole("button", { name: /1\.00 mS\/cm/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /1\.20 mS\/cm/ })).toBeTruthy();
    expect(screen.getByText(/leaf cupping above 1\.2/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /1\.60 mS\/cm/ })).toBeNull();
  });
});
