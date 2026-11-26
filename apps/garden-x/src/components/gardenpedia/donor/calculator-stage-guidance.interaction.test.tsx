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
    expect(screen.getByText(/Age may show a published reference/)).toBeTruthy();

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

  it("explains how age references can inform stage confirmation in Spanish", () => {
    render(<CalculatorPage language="es" initialPlantId="genovese-basil" />);

    expect(screen.getByText(/La edad puede mostrar una referencia publicada/)).toBeTruthy();
  });

  it("shows the lettuce transplant-age cue without selecting a phenological stage", () => {
    render(<CalculatorPage language="en" initialPlantId="bibb-lettuce" />);

    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Days since sowing of Bibb Lettuce" }),
      { target: { value: "17" } },
    );

    expect(screen.getByText(/typical transplant window/i)).toBeTruthy();
    expect(screen.getAllByText(/3–4 true leaves/i).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("combobox")
        .some((select) => (select as HTMLSelectElement).value === "UNSPECIFIED"),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Confirm stage: seedling" }));
    expect((screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement).value).toBe(
      "SEEDLING",
    );
  });

  it("lets growers explicitly choose an unspecified-stage range as a manual EC target", () => {
    render(<CalculatorPage language="en" initialPlantId="genovese-basil" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Stage of Genovese Basil" }), {
      target: { value: "VEGETATIVE" },
    });

    const generalReference = screen.getByText("View general EC reference").closest("details");
    expect(generalReference?.open).toBe(false);
    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByText("View general EC reference"));

    expect(
      within(generalReference!).getByText(/does not say it applies to the selected stage/i),
    ).toBeTruthy();
    fireEvent.click(
      within(generalReference!).getByRole("button", {
        name: /Use lower bound as my manual target: 1\.00 mS\/cm/i,
      }),
    );

    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1",
    );
  });

  it("keeps the manual general-range selection bilingual", () => {
    render(<CalculatorPage language="es" initialPlantId="genovese-basil" />);

    fireEvent.click(screen.getByRole("tab", { name: "Por EC" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Etapa de Albahaca genovesa" }), {
      target: { value: "VEGETATIVE" },
    });
    fireEvent.click(screen.getByText("Ver referencia general de EC"));

    fireEvent.click(
      screen.getByRole("button", {
        name: /Usar límite inferior como mi objetivo manual: 1\.00 mS\/cm/i,
      }),
    );

    expect((screen.getByRole("textbox", { name: "EC objetivo" }) as HTMLInputElement).value).toBe(
      "1",
    );
  });

  it("converts the chosen manual range bound when the display unit is µS/cm", () => {
    render(<CalculatorPage language="en" initialPlantId="genovese-basil" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Stage of Genovese Basil" }), {
      target: { value: "VEGETATIVE" },
    });
    fireEvent.click(screen.getByText("View general EC reference"));
    fireEvent.click(screen.getByText("More settings"));
    fireEvent.click(screen.getByRole("button", { name: "µS/cm" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: /Use lower bound as my manual target: 1000 µS\/cm/i,
      }),
    );

    expect((screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement).value).toBe(
      "1000",
    );
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

  it("shows the primary DFT day-14 observation and keeps stage confirmation manual", () => {
    render(<CalculatorPage language="en" initialPlantId="tulsi-holy-basil-ocimum-tenuiflorum" />);

    fireEvent.change(screen.getByRole("spinbutton", { name: /Days since sowing of/ }), {
      target: { value: "14" },
    });

    expect(screen.getByText(/controlled DFT study of 12 holy-basil accessions/i)).toBeTruthy();
    expect((screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement).value).toBe(
      "UNSPECIFIED",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm stage: seedling" }));
    expect((screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement).value).toBe(
      "SEEDLING",
    );
  });

  it("shows Komatsuna's measured leaf-development timeline without changing stage or dose", () => {
    const { container } = render(
      <CalculatorPage language="en" initialPlantId="lady-murasaki-komatsuna" />,
    );
    const resultRegion = container.querySelector('[aria-live="polite"]');
    const resultBeforeAgeEntry = resultRegion?.textContent;

    fireEvent.change(screen.getByRole("spinbutton", { name: /Days since sowing of/ }), {
      target: { value: "14" },
    });

    expect(
      screen.getByText(/around day 14 about 80% of seedlings had two true leaves/i),
    ).toBeTruthy();
    expect((screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement).value).toBe(
      "UNSPECIFIED",
    );
    expect(resultRegion?.textContent).toBe(resultBeforeAgeEntry);
    fireEvent.click(screen.getByRole("button", { name: "Confirm stage: seedling" }));
    expect((screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement).value).toBe(
      "SEEDLING",
    );
  });

  it("keeps a Texas A&M zinnia transplant-time cue separate from the selected plant stage", () => {
    render(<CalculatorPage language="en" initialPlantId="zinnia-lilliput-mixed" />);
    fireEvent.change(screen.getByRole("spinbutton", { name: /Days since sowing of/ }), {
      target: { value: "28" },
    });

    expect(screen.getByText(/Texas A&M estimates 3–5 weeks/i)).toBeTruthy();
    expect((screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement).value).toBe(
      "UNSPECIFIED",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm stage: seedling" }));
    expect((screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement).value).toBe(
      "SEEDLING",
    );
  });

  it("offers the user's basil transplant-age cue without treating it as hydroponic dose evidence", () => {
    render(<CalculatorPage language="en" initialPlantId="genovese-basil" />);
    fireEvent.change(screen.getByRole("spinbutton", { name: /Days since sowing of/ }), {
      target: { value: "42" },
    });

    expect(screen.getByText(/WVU Extension gives 6 weeks/i)).toBeTruthy();
    const stage = screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement;
    expect(stage.value).toBe("UNSPECIFIED");
    fireEvent.click(screen.getByRole("button", { name: "Confirm stage: seedling" }));
    expect(stage.value).toBe("SEEDLING");
  });

  it("explains when no published age window applies instead of silently treating days as a stage", () => {
    render(<CalculatorPage language="es" initialPlantId="epazote" />);
    fireEvent.change(screen.getByRole("spinbutton", { name: /Días desde la siembra de/ }), {
      target: { value: "20" },
    });

    expect(screen.getByText(/No hay una ventana de edad publicada que coincida/i)).toBeTruthy();
    expect(
      (screen.getByRole("combobox", { name: "Etapa de Epazote" }) as HTMLSelectElement).value,
    ).toBe("UNSPECIFIED");
  });

  it("shows the sourced Epazote morphology cue without applying a stage from day count", () => {
    render(<CalculatorPage language="en" initialPlantId="epazote" />);
    fireEvent.change(screen.getByRole("spinbutton", { name: /Days since sowing of/ }), {
      target: { value: "30" },
    });

    const stage = screen.getByRole("combobox", { name: "Stage of Epazote" }) as HTMLSelectElement;
    expect(stage.value).toBe("UNSPECIFIED");
    const disclosure = screen.getByText("Reference for observing this plant");
    fireEvent.click(disclosure);
    expect(screen.getByText(/about 30 days.*second pair of leaves/i)).toBeTruthy();
    expect(screen.getByText(/unit for conductivity is ambiguous/i)).toBeTruthy();
    expect(stage.value).toBe("UNSPECIFIED");
  });

  it("shows shared hydroponic seedling criteria for spinach and requires confirmation", () => {
    render(<CalculatorPage language="en" initialPlantId="seaside-f1-spinach" />);
    fireEvent.change(screen.getByRole("spinbutton", { name: /Days since sowing of/ }), {
      target: { value: "15" },
    });

    expect(screen.getAllByText(/3–5 true leaves and visible roots/i).length).toBeGreaterThan(0);
    const stage = screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement;
    expect(stage.value).toBe("UNSPECIFIED");
    fireEvent.click(screen.getByRole("button", { name: "Confirm stage: seedling" }));
    expect(stage.value).toBe("SEEDLING");
  });

  it("shows cilantro bolting morphology without assigning an age-derived stage", () => {
    render(<CalculatorPage language="en" initialPlantId="cilantro" />);
    const disclosure = screen.getByText("Reference for observing this plant");
    fireEvent.click(disclosure);
    expect(screen.getByText(/young cilantro leaves as broad and flat/i)).toBeTruthy();
    expect((screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement).value).toBe(
      "UNSPECIFIED",
    );
  });

  it("lets the grower confirm a source-backed age cue without auto-changing stage or dose", () => {
    render(<CalculatorPage language="en" initialPlantId="tulsi-holy-basil-ocimum-tenuiflorum" />);
    const age = screen.getByRole("spinbutton", { name: /Days since sowing of/ });
    fireEvent.change(age, { target: { value: "18" } });

    const stage = screen.getByRole("combobox", { name: /Stage of/ }) as HTMLSelectElement;
    expect(stage.value).toBe("UNSPECIFIED");
    fireEvent.click(screen.getByRole("button", { name: "Confirm stage: seedling" }));
    expect(stage.value).toBe("SEEDLING");
    expect(screen.getByText(/if none applies, the calculation will say so/i)).toBeTruthy();
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

  it("offers applicable Erecta-context manual choices without making a range", () => {
    render(<CalculatorPage language="en" initialPlantId="marigold-jolly-jester" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    fireEvent.click(screen.getByText("View cultivation sources"));

    const options150 = screen.getAllByRole("button", { name: /1\.50 mS\/cm/ });
    expect(options150).toHaveLength(2);
    expect(options150.map((button) => button.getAttribute("aria-label"))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Bangladesh Agricultural Research Council"),
        expect.stringContaining("International Society for Horticultural Science"),
      ]),
    );
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

  it("shows every reported Komatsuna NFT treatment only as a manual choice", () => {
    render(<CalculatorPage language="en" initialPlantId="lady-murasaki-komatsuna" />);

    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    const target = screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement;
    expect(target.value).toBe("");
    fireEvent.click(screen.getByText("View cultivation sources"));
    for (const value of ["1.00", "1.20", "1.40", "1.60", "1.80"]) {
      expect(screen.getByRole("button", { name: new RegExp(value + " mS/cm") })).toBeTruthy();
    }
    expect(screen.getByText(/leaf cupping and distortion increased above 1\.2/i)).toBeTruthy();
    expect(target.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /1\.20 mS\/cm/ }));
    expect(target.value).toBe("1.2");
  });

  it("labels Monterey Strawberry study EC choices by observed growth stage without auto-targeting", () => {
    render(<CalculatorPage language="en" initialPlantId="monterey-strawberry" />);
    fireEvent.click(screen.getByRole("tab", { name: "By EC" }));
    const target = screen.getByRole("textbox", { name: "Target EC" }) as HTMLInputElement;
    expect(target.value).toBe("");
    fireEvent.click(screen.getByText("View cultivation sources"));

    const vegetative = screen.getByRole("button", {
      name: /Monterey Strawberry.*vegetative growth.*0\.90 mS\/cm/i,
    });
    const fruiting = screen.getByRole("button", {
      name: /Monterey Strawberry.*fruiting.*1\.30 mS\/cm/i,
    });
    expect(vegetative).toBeTruthy();
    expect(fruiting).toBeTruthy();
    expect(target.value).toBe("");

    fireEvent.click(fruiting);
    expect(target.value).toBe("1.3");
    expect(screen.getByText("Your target")).toBeTruthy();
  });
});
