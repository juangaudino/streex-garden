// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { isGardenKeyboardOpen, useGardenMobileViewport } from "./mobile-viewport";

type VisualViewportMock = EventTarget & { height: number; offsetTop: number };

function Harness() {
  const viewport = useGardenMobileViewport();
  return (
    <>
      <input aria-label="Shared editor" />
      <output>{`${viewport.height ?? "none"}:${viewport.keyboardOpen ? "open" : "closed"}`}</output>
    </>
  );
}

describe("shared Garden mobile viewport", () => {
  afterEach(() => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
    document.documentElement.removeAttribute("data-garden-keyboard");
    document.documentElement.style.cssText = "";
  });

  it("requires an editable focus before treating a visual viewport shrink as a keyboard", () => {
    expect(
      isGardenKeyboardOpen({ layoutHeight: 844, visualHeight: 430, editableFocused: true }),
    ).toBe(true);
    expect(
      isGardenKeyboardOpen({ layoutHeight: 844, visualHeight: 430, editableFocused: false }),
    ).toBe(false);
    expect(
      isGardenKeyboardOpen({ layoutHeight: 844, visualHeight: 780, editableFocused: true }),
    ).toBe(false);
  });

  it("publishes one root viewport contract for open and dismissed keyboard states", () => {
    const visualViewport = new EventTarget() as VisualViewportMock;
    visualViewport.height = 844;
    visualViewport.offsetTop = 0;
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: visualViewport });
    render(<Harness />);

    const input = screen.getByLabelText("Shared editor");
    expect(screen.getByText("844:closed")).toBeTruthy();
    expect(document.documentElement.dataset.gardenKeyboard).toBe("closed");
    expect(document.documentElement.style.getPropertyValue("--garden-visual-viewport-height")).toBe(
      "844px",
    );

    act(() => {
      input.focus();
      visualViewport.height = 430;
      fireEvent(visualViewport, new Event("resize"));
      fireEvent(window, new Event("resize"));
    });

    expect(screen.getByText("430:open")).toBeTruthy();
    expect(document.documentElement.dataset.gardenKeyboard).toBe("open");
    expect(document.documentElement.style.getPropertyValue("--garden-keyboard-inset")).toBe(
      "414px",
    );

    act(() => {
      visualViewport.height = 844;
      fireEvent(visualViewport, new Event("resize"));
      input.blur();
      fireEvent(window, new Event("resize"));
    });

    expect(screen.getByText("844:closed")).toBeTruthy();
    expect(document.documentElement.dataset.gardenKeyboard).toBe("closed");
    expect(document.documentElement.style.getPropertyValue("--garden-keyboard-inset")).toBe("0px");
  });
});
