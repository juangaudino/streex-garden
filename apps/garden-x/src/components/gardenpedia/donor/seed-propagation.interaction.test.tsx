// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import { buildSeedLibraryCards, filterSeedLibraryCards } from "./seed-library-adapter";
import { SeedLibraryView } from "./seed-profile";

afterEach(cleanup);

describe("public Seeds / Propagation discovery", () => {
  it("explains propagation evidence classes and shows counts from the canonical catalog", async () => {
    const user = userEvent.setup();
    const cards = buildSeedLibraryCards("en");
    const activeCatalogSize = gardenLibraryManifest.entries.filter(
      (entry) => entry.status === "active",
    ).length;
    const seedCount = cards.filter((card) => card.hasSeedProfile).length;
    const vegetativeCount = cards.filter(
      (card) => card.propagationClass === "vegetative_preferred",
    ).length;
    const insufficientCount = cards.filter(
      (card) => card.propagationClass === "insufficient_documentation",
    ).length;

    expect(cards).toHaveLength(activeCatalogSize);
    expect(filterSeedLibraryCards(cards, { mode: "propagation" })).toHaveLength(activeCatalogSize);
    expect(
      filterSeedLibraryCards(cards, { mode: "seeds" }).every((card) => card.hasSeedProfile),
    ).toBe(true);

    render(<SeedLibraryView language="en" />);
    await user.click(screen.getByRole("button", { name: "All propagation" }));

    expect(screen.getByText(/A pending state does not mean a route is impossible/)).toBeTruthy();
    expect(screen.getByText(`${seedCount} Seed Profiles`)).toBeTruthy();
    expect(screen.getByText(`${vegetativeCount} Vegetative preferred`)).toBeTruthy();
    expect(screen.getByText(`${insufficientCount} Insufficient evidence`)).toBeTruthy();
    expect(screen.getByRole("option", { name: "Insufficient evidence" })).toBeTruthy();
  });

  it("keeps the expanded propagation directory searchable in Spanish", async () => {
    render(<SeedLibraryView language="es" />);
    fireEvent.click(screen.getByRole("button", { name: "Toda propagación" }));
    expect(screen.getByRole("option", { name: "Ornamentales" })).toBeTruthy();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar por nombre, alias o nombre científico" }),
      { target: { value: "cast-iron plant" } },
    );
    expect(screen.getByRole("heading", { name: "Aspidistra" })).toBeTruthy();
    expect(screen.getByText("Cast-Iron Plant")).toBeTruthy();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar por nombre, alias o nombre científico" }),
      { target: { value: "mungo" } },
    );

    expect(screen.getByText("Frijol mungo")).toBeTruthy();
    expect(screen.getByText("Vigna radiata")).toBeTruthy();
  });
});
