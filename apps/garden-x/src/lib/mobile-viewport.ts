import { useEffect, useState } from "react";

const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true'], [role='textbox']";

export type GardenMobileViewport = {
  editableFocused: boolean;
  keyboardOpen: boolean;
};

const initialViewport: GardenMobileViewport = {
  editableFocused: false,
  keyboardOpen: false,
};

export function readGardenMobileViewport(): GardenMobileViewport {
  const activeElement = document.activeElement;
  const editableFocused = Boolean(activeElement?.matches?.(EDITABLE_SELECTOR));
  return { editableFocused, keyboardOpen: editableFocused };
}

function applyKeyboardState(viewport: GardenMobileViewport) {
  document.documentElement.dataset.gardenKeyboard = viewport.keyboardOpen ? "open" : "closed";
}

/**
 * Shared mobile keyboard state for the authenticated Garden X shell.
 *
 * iOS owns viewport sizing and visual panning. Garden only owns the policy
 * that an active editor temporarily hides the app navigation and removes its
 * normal bottom reserve. Screens must not add viewport-height calculations,
 * visualViewport listeners, or keyboard offsets of their own.
 */
export function useGardenMobileViewport() {
  const [viewport, setViewport] = useState<GardenMobileViewport>(initialViewport);

  useEffect(() => {
    const update = () => {
      const next = readGardenMobileViewport();
      applyKeyboardState(next);
      setViewport((current) => (
        current.editableFocused === next.editableFocused && current.keyboardOpen === next.keyboardOpen
          ? current
          : next
      ));
    };

    update();
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);

    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      delete document.documentElement.dataset.gardenKeyboard;
    };
  }, []);

  return viewport;
}
