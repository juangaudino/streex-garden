// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomSystemLayoutEditor } from "./custom-system-layout-editor";
import type { Garden } from "@/lib/garden-data";

const mocks = vi.hoisted(() => ({
  updateCustomSystemLayout: vi.fn(),
}));

vi.mock("@/lib/garden-store", () => ({
  useGarden: () => ({
    language: "en",
    updateCustomSystemLayout: mocks.updateCustomSystemLayout,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function gardenFixture(): Garden {
  return {
    id: "kratky-garden",
    name: "Kratky’s",
    kind: "hydroponic",
    cover: "",
    place: "",
    note: "",
    machine: { name: "Leaf Cabinet", pods: 8 },
    gardenpediaModelId: null,
    backendPositions: Array.from({ length: 8 }, (_, index) => ({
      id: `position-${index + 1}`,
      number: index + 1,
      active: true,
      levelNumber: 1,
      rowNumber: Math.floor(index / 4) + 1,
      columnNumber: (index % 4) + 1,
    })),
    systemLayoutLevels: [{
      levelNumber: 1,
      rows: 2,
      columns: 4,
      activeCells: Array.from({ length: 8 }, (_, index) => ({
        row: Math.floor(index / 4) + 1,
        column: (index % 4) + 1,
      })),
    }],
  };
}

describe("CustomSystemLayoutEditor production capacity flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateCustomSystemLayout.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it("allows 8→16 capacity, exposes the resized 4×4 candidates, and submits the selected layout", () => {
    render(<CustomSystemLayoutEditor garden={gardenFixture()} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Capacity" }), { target: { value: "16" } });
    fireEvent.click(screen.getByRole("button", { name: "Increase Rows" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Rows" }));

    for (const cell of ["3:1", "3:2", "3:3", "3:4", "4:1", "4:2", "4:3", "4:4"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Position ${cell}.*inactive position`) }));
    }

    expect(screen.getByText(/4 rows × 4 columns · 16 \/ 16 active positions/)).toBeTruthy();
    const save = screen.getByRole("button", { name: "Save layout" });
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);

    expect(mocks.updateCustomSystemLayout).toHaveBeenCalledWith(
      "kratky-garden",
      [{
        rows: 4,
        columns: 4,
        activeCells: Array.from({ length: 16 }, (_, index) => ({
          row: Math.floor(index / 4) + 1,
          column: (index % 4) + 1,
        })),
      }],
      16,
    );
  });
});
