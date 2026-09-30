import { useEffect, useState } from "react";

const KEYBOARD_HEIGHT_THRESHOLD = 120;
const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true'], [role='textbox']";

export type GardenMobileViewport = {
  height: number | null;
  offsetTop: number;
  keyboardInset: number;
  keyboardOpen: boolean;
};

const initialViewport: GardenMobileViewport = {
  height: null,
  offsetTop: 0,
  keyboardInset: 0,
  keyboardOpen: false,
};

export function isGardenKeyboardOpen({
  layoutHeight,
  visualHeight,
  editableFocused,
}: {
  layoutHeight: number;
  visualHeight: number;
  editableFocused: boolean;
}) {
  return editableFocused && layoutHeight - visualHeight > KEYBOARD_HEIGHT_THRESHOLD;
}

export function readGardenMobileViewport(): GardenMobileViewport {
  const visualViewport = window.visualViewport;
  const layoutHeight = window.innerHeight;
  const height = Math.max(0, visualViewport?.height ?? layoutHeight);
  const offsetTop = Math.max(0, visualViewport?.offsetTop ?? 0);
  const activeElement = document.activeElement;
  const editableFocused = Boolean(activeElement?.matches?.(EDITABLE_SELECTOR));

  return {
    height,
    offsetTop,
    keyboardInset: Math.max(0, layoutHeight - height - offsetTop),
    keyboardOpen: isGardenKeyboardOpen({ layoutHeight, visualHeight: height, editableFocused }),
  };
}

function applyViewportVariables(viewport: GardenMobileViewport) {
  const root = document.documentElement;
  if (viewport.height === null) {
    root.style.removeProperty("--garden-visual-viewport-height");
  } else {
    root.style.setProperty("--garden-visual-viewport-height", `${viewport.height}px`);
  }
  root.style.setProperty("--garden-visual-viewport-offset-top", `${viewport.offsetTop}px`);
  root.style.setProperty("--garden-keyboard-inset", `${viewport.keyboardInset}px`);
  root.dataset.gardenKeyboard = viewport.keyboardOpen ? "open" : "closed";
}

/**
 * Shared mobile viewport ownership for the authenticated Garden X shell.
 * Screens must consume the CSS variables/data attribute this hook publishes;
 * they must not create their own visualViewport listeners or keyboard reserve.
 */
export function useGardenMobileViewport() {
  const [viewport, setViewport] = useState<GardenMobileViewport>(initialViewport);

  useEffect(() => {
    const visualViewport = window.visualViewport;

    const update = () => {
      const next = readGardenMobileViewport();
      applyViewportVariables(next);
      setViewport((current) =>
        current.height === next.height &&
        current.offsetTop === next.offsetTop &&
        current.keyboardInset === next.keyboardInset &&
        current.keyboardOpen === next.keyboardOpen
          ? current
          : next,
      );
    };
    const scheduleUpdate = update;

    update();
    visualViewport?.addEventListener("resize", scheduleUpdate);
    visualViewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    document.addEventListener("focusin", scheduleUpdate);
    document.addEventListener("focusout", scheduleUpdate);

    return () => {
      visualViewport?.removeEventListener("resize", scheduleUpdate);
      visualViewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      document.removeEventListener("focusin", scheduleUpdate);
      document.removeEventListener("focusout", scheduleUpdate);
      const root = document.documentElement;
      root.style.removeProperty("--garden-visual-viewport-height");
      root.style.removeProperty("--garden-visual-viewport-offset-top");
      root.style.removeProperty("--garden-keyboard-inset");
      delete root.dataset.gardenKeyboard;
    };
  }, []);

  return viewport;
}
