import { useLayoutEffect, type RefObject } from "react";

export const useDialogInitialFocus = (
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
) => {
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const frameId = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && container.contains(activeElement)) {
        return;
      }

      const explicitTarget = container.querySelector<HTMLElement>(
        "[autofocus], [data-dialog-autofocus='true']",
      );

      if (explicitTarget && !explicitTarget.hasAttribute("disabled")) {
        explicitTarget.focus();
        return;
      }

      container.focus();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [containerRef, enabled]);
};
