// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./plant-advisor-drawer", () => ({
  PlantAdvisorDrawer: () => null,
}));

import { GardenLibrary } from "./explore";

afterEach(cleanup);

describe("Gardenpedia mobile Library hierarchy", () => {
  it("keeps the catalog counts compact and exposes category filters on demand", () => {
    render(<GardenLibrary language="en" diagnosticOnly />);

    expect(screen.getAllByText("501 public profiles").length).toBeGreaterThan(0);
    expect(screen.getByText("328 Seed Profiles V0")).toBeTruthy();
    expect(screen.queryByText("Garden X public")).toBeNull();
    expect(screen.queryByText("Light")).toBeNull();

    const filterDisclosure = document.querySelector<HTMLDetailsElement>(
      ".gardenpedia-filter-disclosure",
    );
    expect(filterDisclosure?.open).toBe(false);
    expect(filterDisclosure).not.toBeNull();

    fireEvent.click(within(filterDisclosure!).getByText("Filters · All"));
    expect(filterDisclosure?.open).toBe(true);
    fireEvent.click(within(filterDisclosure!).getByRole("button", { name: "Herbs" }));

    expect(screen.getByRole("heading", { name: /\d+ identities/ })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 4 }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: /calabaza bellota/i })).toBeNull();
  });

  it("keeps evidence health available in a closed mobile disclosure in both languages", () => {
    const { rerender } = render(<GardenLibrary language="en" diagnosticOnly />);
    let evidenceDisclosure = document.querySelector<HTMLDetailsElement>(
      ".gardenpedia-evidence-disclosure",
    );

    expect(evidenceDisclosure?.open).toBe(false);
    expect(within(evidenceDisclosure!).getByText("Knowledge Quality Map")).toBeTruthy();

    fireEvent.click(within(evidenceDisclosure!).getByText("Catalog quality and sources"));
    expect(evidenceDisclosure?.open).toBe(true);

    rerender(<GardenLibrary language="es" diagnosticOnly />);
    evidenceDisclosure = document.querySelector<HTMLDetailsElement>(
      ".gardenpedia-evidence-disclosure",
    );
    expect(within(evidenceDisclosure!).getByText("Calidad y fuentes del catálogo")).toBeTruthy();
    expect(within(evidenceDisclosure!).getByText("Mapa de calidad del conocimiento")).toBeTruthy();
  });
});
