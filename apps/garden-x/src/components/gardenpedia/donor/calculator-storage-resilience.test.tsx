// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: unknown }) => children,
  DialogContent: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  DialogDescription: ({ children }: { children: unknown }) => <p>{children as never}</p>,
  DialogHeader: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  DialogTitle: ({ children }: { children: unknown }) => <h2>{children as never}</h2>,
}));

import { CalculatorPage } from "./calculator-page-v1";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Calculator local-storage resilience", () => {
  it("keeps the public calculator usable when private-browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable", "SecurityError");
    });

    render(<CalculatorPage language="en" initialPlantId="genovese-basil" />);

    const saveButton = screen.getByRole("button", { name: "Save as system" });
    fireEvent.click(saveButton);

    const name = screen.getByRole("textbox", { name: "System name" });
    fireEvent.change(name, { target: { value: "Basil test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen
        .getAllByRole("alert")
        .some((alert) =>
          alert.textContent?.includes(
            "Could not save on this device. Your configuration is still open.",
          ),
        ),
    ).toBe(true);
    expect(screen.getByRole("textbox", { name: "System name" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save as system" })).toBeTruthy();
  });
});
