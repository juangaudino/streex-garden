import { useEffect, useState } from "react";

const KEYBOARD_HEIGHT_THRESHOLD = 120;

export function isAskKeyboardOpen({
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

export function useAskVisualViewport(enabled: boolean) {
  const [viewport, setViewport] = useState<{ height: number | null; keyboardOpen: boolean }>({
    height: null,
    keyboardOpen: false,
  });

  useEffect(() => {
    if (!enabled) return;

    const visualViewport = window.visualViewport;
    const update = () => {
      const visualHeight = visualViewport?.height ?? window.innerHeight;
      const activeElement = document.activeElement;
      const editableFocused = Boolean(
        activeElement?.matches?.("input, textarea, [contenteditable='true'], [role='textbox']"),
      );
      setViewport({
        height: visualHeight,
        keyboardOpen: isAskKeyboardOpen({
          layoutHeight: window.innerHeight,
          visualHeight,
          editableFocused,
        }),
      });
    };
    const updateAfterFocusChange = () => window.requestAnimationFrame(update);

    update();
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", updateAfterFocusChange);
    document.addEventListener("focusout", updateAfterFocusChange);

    return () => {
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", updateAfterFocusChange);
      document.removeEventListener("focusout", updateAfterFocusChange);
    };
  }, [enabled]);

  return viewport;
}
