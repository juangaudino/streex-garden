// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { isAskKeyboardOpen, useAskVisualViewport } from "./ask-visual-viewport";

type VisualViewportMock = EventTarget & { height: number };

function Harness() {
  const viewport = useAskVisualViewport(true);
  return (
    <>
      <input aria-label="Ask Garden" />
      <output>{`${viewport.height ?? "none"}:${viewport.keyboardOpen ? "open" : "closed"}`}</output>
    </>
  );
}

describe("Ask Garden visual viewport", () => {
  afterEach(() => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  });

  it("detects the iOS keyboard from the focused editor and visual viewport shrink", () => {
    expect(isAskKeyboardOpen({ layoutHeight: 844, visualHeight: 430, editableFocused: true })).toBe(true);
    expect(isAskKeyboardOpen({ layoutHeight: 844, visualHeight: 430, editableFocused: false })).toBe(false);
    expect(isAskKeyboardOpen({ layoutHeight: 844, visualHeight: 780, editableFocused: true })).toBe(false);
  });

  it("tracks a visual viewport resize while the Ask Garden composer is focused", () => {
    const visualViewport = new EventTarget() as VisualViewportMock;
    visualViewport.height = 844;
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: visualViewport });
    render(<Harness />);

    const input = screen.getByLabelText("Ask Garden");
    input.focus();
    expect(screen.getByText("844:closed")).toBeTruthy();

    act(() => {
      visualViewport.height = 430;
      fireEvent(visualViewport, new Event("resize"));
    });

    expect(screen.getByText("430:open")).toBeTruthy();
  });
});
