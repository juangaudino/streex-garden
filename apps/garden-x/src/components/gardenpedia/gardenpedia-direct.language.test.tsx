// @vitest-environment jsdom
import { act, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GardenpediaDirect } from "./gardenpedia-direct";

vi.mock("./donor/explore", async () => {
  const React = await import("react");
  return {
    GardenLibrary: ({
      language,
      onLanguageChange,
    }: {
      language: "en" | "es";
      onLanguageChange: (language: "en" | "es") => void;
    }) =>
      React.createElement(
        "div",
        null,
        React.createElement("output", { "data-testid": "language" }, language),
        React.createElement("button", { onClick: () => onLanguageChange("en") }, "EN"),
      ),
  };
});

describe("Gardenpedia language hydration", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("hydrates deterministically, then restores and persists the saved language", async () => {
    window.localStorage.setItem(
      "garden-x-preferences",
      JSON.stringify({ language: "es", measurementSystem: "imperial" }),
    );
    const props = { search: { view: "library" as const }, onNavigate: vi.fn() };
    const markup = renderToString(createElement(GardenpediaDirect, props));
    expect(markup).toContain(">en</output>");

    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.append(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(container, createElement(GardenpediaDirect, props));
    });

    expect(container.querySelector('[data-testid="language"]')?.textContent).toBe("es");
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration|did not match/i);

    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(JSON.parse(window.localStorage.getItem("garden-x-preferences") || "{}")).toEqual({
      language: "en",
      measurementSystem: "imperial",
    });

    await act(async () => root?.unmount());
  });
});
