// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { CareSessionGardenList, type CareSessionGardenItem } from "./care-session-garden-list";

function Harness() {
  const initial: CareSessionGardenItem[] = [
    { id: "garden-a", name: "Garden A", plantCount: 2 },
    { id: "garden-b", name: "Garden B", plantCount: 3 },
    { id: "garden-c", name: "Garden C", plantCount: 1 },
  ];
  const [gardens, setGardens] = useState(initial);
  const [selected, setSelected] = useState(["garden-a", "garden-b", "garden-c"]);
  return (
    <CareSessionGardenList
      gardens={gardens}
      selectedIds={selected}
      selectedLabel="Selected"
      notSelectedLabel="Not selected"
      reorderLabel="Drag to reorder"
      plantsLabel="plants"
      onToggle={(id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
      onReorder={(fromId, toId) => setGardens((current) => {
        const next = [...current];
        const from = next.findIndex((item) => item.id === fromId);
        const to = next.findIndex((item) => item.id === toId);
        const [moved] = next.splice(from, 1);
        if (moved) next.splice(to, 0, moved);
        return next;
      })}
    />
  );
}

describe("Care Session garden ordering on pointer/touch devices", () => {
  afterEach(cleanup);

  it("reorders by the handle with touch pointer events and keeps the order after rerender", () => {
    const elementFromPoint = vi.fn(() => document.querySelector<HTMLElement>('[data-care-garden-id="garden-a"]'));
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: elementFromPoint });
    render(<Harness />);
    const handle = screen.getByRole("button", { name: "Drag to reorder: Garden C" });
    fireEvent.pointerDown(handle, { pointerId: 7, pointerType: "touch", isPrimary: true, button: 0, clientY: 90 });
    fireEvent.pointerMove(handle, { pointerId: 7, pointerType: "touch", isPrimary: true, clientY: 30 });

    const list = handle.closest("[data-care-garden-id]")?.parentElement;
    expect([...list!.querySelectorAll<HTMLElement>("[data-care-garden-id]")].map((row) => row.dataset.careGardenId)).toEqual([
      "garden-c", "garden-a", "garden-b",
    ]);
    expect(elementFromPoint).toHaveBeenCalled();
    delete (document as Document & { elementFromPoint?: typeof elementFromPoint }).elementFromPoint;
  });

  it("keeps scrolling outside the handle and deselection/reselection controls working", () => {
    render(<Harness />);
    const handle = screen.getByRole("button", { name: "Drag to reorder: Garden A" });
    const row = handle.closest<HTMLElement>("[data-care-garden-id]")!;
    expect(handle.className).toContain("touch-none");
    expect(row.className).not.toContain("touch-none");

    const checkbox = screen.getByRole("checkbox", { name: "Selected: Garden B" });
    fireEvent.click(checkbox);
    expect(screen.getByRole("checkbox", { name: "Not selected: Garden B" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Not selected: Garden B" }));
    expect(screen.getByRole("checkbox", { name: "Selected: Garden B" })).toBeTruthy();
  });
});
