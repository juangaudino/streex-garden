// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { shouldHideMobileNavigation, useGardenMobileViewport } from "./mobile-viewport";

function Harness() {
  const viewport = useGardenMobileViewport();
  return (
    <>
      <input aria-label="Shared editor" />
      <output>{viewport.keyboardOpen ? "open" : "closed"}</output>
    </>
  );
}

describe("shared Garden mobile viewport", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-garden-keyboard");
    document.documentElement.style.cssText = "";
  });

  it("hides keyboard-sensitive shell space for any focused editable control", () => {
    render(<Harness />);

    const input = screen.getByLabelText("Shared editor");
    expect(screen.getByText("closed")).toBeTruthy();
    expect(document.documentElement.dataset.gardenKeyboard).toBe("closed");

    act(() => {
      input.focus();
    });

    expect(screen.getByText("open")).toBeTruthy();
    expect(document.documentElement.dataset.gardenKeyboard).toBe("open");

    act(() => {
      input.blur();
    });

    expect(screen.getByText("closed")).toBeTruthy();
    expect(document.documentElement.dataset.gardenKeyboard).toBe("closed");
  });

  it("does not install visual viewport dimensions or keyboard offsets", () => {
    render(<Harness />);
    act(() => screen.getByLabelText("Shared editor").focus());

    expect(document.documentElement.style.cssText).toBe("");
    expect(document.documentElement.dataset.gardenKeyboard).toBe("open");
  });

  it("hides the fixed mobile navigation before it can cover an Ask composer", () => {
    expect(shouldHideMobileNavigation(true, false)).toBe(true);
    expect(shouldHideMobileNavigation(true, true)).toBe(true);
    expect(shouldHideMobileNavigation(false, true)).toBe(true);
    expect(shouldHideMobileNavigation(false, false)).toBe(false);
  });
});
