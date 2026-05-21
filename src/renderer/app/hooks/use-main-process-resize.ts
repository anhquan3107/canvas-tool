/**
 * Main-process-driven window resize hook for the main application window.
 *
 * Instead of calculating bounds in the renderer and calling setBounds via IPC
 * on every pointermove (which causes jitter from IPC latency), this hook:
 *
 *  1. Detects pointerdown on a `[data-window-resize]` element
 *  2. Sends a single synchronous "resize:start" IPC to the main process
 *  3. The main process polls the cursor and applies setBounds directly
 *  4. On pointerup, sends "resize:stop" to end the polling loop
 *
 * This eliminates ALL IPC during the drag — the main process does everything.
 */
import { useEffect } from "react";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const useMainProcessResize = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;

    let activePointerId: number | null = null;
    let activeTarget: HTMLElement | null = null;

    const onDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const dir = target.dataset.windowResize as ResizeDirection | undefined;
      if (!dir || e.button !== 0) return;

      // Tell the main process to start polling.
      try {
        window.desktopApi.window.startResize(dir);
      } catch {
        return;
      }

      activePointerId = e.pointerId;
      activeTarget = target;

      try {
        target.setPointerCapture(e.pointerId);
      } catch { /**/ }

      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (activePointerId === null || e.pointerId !== activePointerId) return;
      // The main process is doing all the work — just prevent default.
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      if (activePointerId === null || e.pointerId !== activePointerId) return;

      try {
        window.desktopApi.window.stopResize();
      } catch { /**/ }

      if (activeTarget) {
        try {
          activeTarget.releasePointerCapture(e.pointerId);
        } catch { /**/ }
      }

      activePointerId = null;
      activeTarget = null;
      e.preventDefault();
    };

    const onBlur = () => {
      if (activePointerId !== null) {
        try {
          window.desktopApi.window.stopResize();
        } catch { /**/ }
        activePointerId = null;
        activeTarget = null;
      }
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("blur", onBlur);
      if (activePointerId !== null) {
        try { window.desktopApi.window.stopResize(); } catch { /**/ }
        activePointerId = null;
        activeTarget = null;
      }
    };
  }, [enabled]);
};
