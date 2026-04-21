import { useEffect } from "react";
import type {
  AppWindowBounds,
  AppWindowPosition,
  AppWindowSize,
} from "@shared/types/ipc";

const MIN_RESIZE_EDGE = 160;

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ResizeState = {
  pointerId: number;
  direction: ResizeDirection;
  startDipX: number;
  startDipY: number;
  minimumSize: AppWindowSize;
  startBounds: AppWindowBounds;
  latestBounds: AppWindowBounds;
};

const hasWest = (d: ResizeDirection) => d.includes("w");
const hasEast = (d: ResizeDirection) => d.includes("e");
const hasNorth = (d: ResizeDirection) => d.includes("n");
const hasSouth = (d: ResizeDirection) => d.includes("s");

/**
 * Anchor-edge model. Axes are fully independent — no cross-axis coupling.
 *
 * Handle | Pinned           | Moving
 * -------+------------------+------------------
 * se     | top, left        | right, bottom
 * sw     | top, right       | left, bottom
 * ne     | bottom, left     | right, top
 * nw     | bottom, right    | left, top
 * e      | top,left,bottom  | right
 * w      | top,right,bottom | left
 * s      | top,left,right   | bottom
 * n      | bottom,left,right| top
 *
 * IMPORTANT: always pass (startBounds, totalDelta) — never (latestBounds, stepDelta).
 * Passing latestBounds accumulates floating-point error into x/y, causing the
 * window-position jitter visible on every handle that moves the top-left corner.
 */
const getResizedBounds = (
  startBounds: AppWindowBounds,
  minimumSize: AppWindowSize,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
): AppWindowBounds => {
  const minWidth = Math.max(MIN_RESIZE_EDGE, minimumSize.width);
  const minHeight = Math.max(MIN_RESIZE_EDGE, minimumSize.height);

  // ── Horizontal ────────────────────────────────────────────────────────────
  // CRITICAL: round width FIRST, then derive x from rounded width.
  // Rounding x and width separately causes (Math.round(x) + Math.round(width))
  // to differ from the integer anchor by ±1px, making the pinned edge oscillate.
  let x: number;
  let width: number;

  if (hasEast(direction)) {
    // Left edge (x) is the anchor — it never changes.
    width = Math.max(minWidth, Math.round(startBounds.width + deltaX));
    x = startBounds.x; // anchor: exact integer, never touched
  } else if (hasWest(direction)) {
    // Right edge is the anchor: right = startBounds.x + startBounds.width (integer).
    const right = startBounds.x + startBounds.width;
    width = Math.max(minWidth, Math.round(startBounds.width - deltaX));
    x = right - width; // derived after rounding → right edge always = right exactly
  } else {
    // Pure N/S: horizontal axis completely unchanged.
    x = startBounds.x;
    width = startBounds.width;
  }

  // ── Vertical ──────────────────────────────────────────────────────────────
  let y: number;
  let height: number;

  if (hasSouth(direction)) {
    // Top edge (y) is the anchor — it never changes.
    height = Math.max(minHeight, Math.round(startBounds.height + deltaY));
    y = startBounds.y; // anchor: exact integer, never touched
  } else if (hasNorth(direction)) {
    // Bottom edge is the anchor: bottom = startBounds.y + startBounds.height (integer).
    const bottom = startBounds.y + startBounds.height;
    height = Math.max(minHeight, Math.round(startBounds.height - deltaY));
    y = bottom - height; // derived after rounding → bottom edge always = bottom exactly
  } else {
    // Pure E/W: vertical axis completely unchanged.
    y = startBounds.y;
    height = startBounds.height;
  }

  return { x, y, width, height };
};

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const isFinitePosition = (
  v: { x: number; y: number } | null | undefined,
): v is AppWindowPosition =>
  v != null && isFiniteNumber(v.x) && isFiniteNumber(v.y);

const getSynchronousBounds = (): AppWindowBounds | null => {
  try {
    return window.desktopApi.window.getBoundsSync();
  } catch {
    return null;
  }
};

const getSynchronousMinimumSize = (): AppWindowSize | null => {
  try {
    const minimumSize = window.desktopApi.window.getMinimumSizeSync();
    if (
      minimumSize &&
      isFiniteNumber(minimumSize.width) &&
      isFiniteNumber(minimumSize.height)
    ) {
      return minimumSize;
    }
  } catch {
    return null;
  }

  return null;
};

/**
 * Cursor position in the same coordinate space as getBoundsSync().
 *
 * Keep this aligned with the stable whole-window drag path. Applying an extra
 * screenToDip conversion here can make west-edge drags oscillate because that
 * path continuously updates the window origin (`x`) while resizing.
 */
const getCursorDip = (event: PointerEvent): AppWindowPosition | null => {
  try {
    const cursor = window.desktopApi.window.getCursorScreenPointSync();
    if (isFinitePosition(cursor)) {
      return cursor;
    }
  } catch {
    // fall through to event-based fallback
  }

  const fallbackX = isFiniteNumber(event.screenX)
    ? event.screenX
    : window.screenX + event.clientX;
  const fallbackY = isFiniteNumber(event.screenY)
    ? event.screenY
    : window.screenY + event.clientY;
  return isFiniteNumber(fallbackX) && isFiniteNumber(fallbackY)
    ? { x: fallbackX, y: fallbackY }
    : null;
};

const isSameBounds = (a: AppWindowBounds, b: AppWindowBounds) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;



export const useWindowResize = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;

    let state: ResizeState | null = null;
    let lastApplied: AppWindowBounds | null = null;

    const apply = (b: AppWindowBounds) => {
      if (lastApplied && isSameBounds(lastApplied, b)) return;
      lastApplied = b;
      try {
        window.desktopApi.window.setBoundsImmediate(b);
      } catch {
        void window.desktopApi.window.setBounds(b).catch(() => null);
      }
    };


    const clear = () => {
      state = null;
      lastApplied = null;
    };

    const onDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const dir = target.dataset.windowResize as ResizeDirection | undefined;
      if (!dir || e.button !== 0) return;

      const startBounds = getSynchronousBounds();
      if (!startBounds) return;
      const minimumSize = getSynchronousMinimumSize() ?? {
        width: MIN_RESIZE_EDGE,
        height: MIN_RESIZE_EDGE,
      };
      const cursor = getCursorDip(e);
      if (!cursor) return;

      try { target.setPointerCapture(e.pointerId); } catch { /**/ }

      state = {
        pointerId: e.pointerId,
        direction: dir,
        startDipX: cursor.x,
        startDipY: cursor.y,
        minimumSize,
        startBounds,
        latestBounds: startBounds,
      };
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (!state || e.pointerId !== state.pointerId) return;
      const cursor = getCursorDip(e);
      if (!cursor) return;

      // Total delta from the drag-start cursor position.
      // Using total delta (not step delta) means bounds are always derived from
      // the fixed startBounds anchor, so opposite edges never drift regardless
      // of mode. apply() is called immediately (no RAF queue) to eliminate the
      // 1-frame lag that caused the "opposite edge drifts then snaps" artifact.
      const dx = cursor.x - state.startDipX;
      const dy = cursor.y - state.startDipY;
      const next = getResizedBounds(
        state.startBounds,
        state.minimumSize,
        state.direction,
        dx,
        dy,
      );

      state = {
        ...state,
        latestBounds: next,
      };

      // apply() skips the IPC call when bounds haven't changed (isSameBounds),
      // so there is no redundant work even if pointermove fires rapidly.
      apply(next);
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      if (!state || e.pointerId !== state.pointerId) return;
      apply(state.latestBounds);

      state = null;
      e.preventDefault();
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    window.addEventListener("blur", clear);

    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, [enabled]);
};
