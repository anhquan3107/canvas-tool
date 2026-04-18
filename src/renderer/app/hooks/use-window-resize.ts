import { useEffect } from "react";
import type { AppWindowBounds, AppWindowPosition } from "@shared/types/ipc";

const MIN_RESIZE_EDGE = 160;

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type ResizeMode = "frame" | "live";

type UseWindowResizeOptions = {
  mode?: ResizeMode;
};

type ResizeState = {
  pointerId: number;
  direction: ResizeDirection;
  startScreenX: number;
  startScreenY: number;
  startBounds: AppWindowBounds;
  latestBounds: AppWindowBounds;
};

const hasWest = (direction: ResizeDirection) => direction.includes("w");
const hasEast = (direction: ResizeDirection) => direction.includes("e");
const hasNorth = (direction: ResizeDirection) => direction.includes("n");
const hasSouth = (direction: ResizeDirection) => direction.includes("s");

const getResizedBounds = (
  startBounds: AppWindowBounds,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
): AppWindowBounds => {
  const startLeft = startBounds.x;
  const startTop = startBounds.y;
  const startRight = startBounds.x + startBounds.width;
  const startBottom = startBounds.y + startBounds.height;

  let nextLeft = startLeft;
  let nextTop = startTop;
  let nextRight = startRight;
  let nextBottom = startBottom;

  if (hasWest(direction)) {
    nextLeft = Math.min(startLeft + deltaX, startRight - MIN_RESIZE_EDGE);
  }

  if (hasEast(direction)) {
    nextRight = Math.max(startRight + deltaX, startLeft + MIN_RESIZE_EDGE);
  }

  if (hasNorth(direction)) {
    nextTop = Math.min(startTop + deltaY, startBottom - MIN_RESIZE_EDGE);
  }

  if (hasSouth(direction)) {
    nextBottom = Math.max(startBottom + deltaY, startTop + MIN_RESIZE_EDGE);
  }

  return {
    x: Math.round(nextLeft),
    y: Math.round(nextTop),
    width: Math.round(nextRight - nextLeft),
    height: Math.round(nextBottom - nextTop),
  };
};

const getSynchronousBounds = () => {
  try {
    return window.desktopApi.window.getBoundsSync();
  } catch {
    return null;
  }
};

const isFinitePosition = (
  value: AppWindowPosition | null,
): value is AppWindowPosition =>
  value !== null && isFiniteNumber(value.x) && isFiniteNumber(value.y);

const isFiniteBounds = (
  value: AppWindowBounds | null,
): value is AppWindowBounds =>
  value !== null &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.width) &&
  isFiniteNumber(value.height);

const isSameBounds = (left: AppWindowBounds, right: AppWindowBounds) =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeWindowBounds = (value: AppWindowBounds | null) => {
  if (!isFiniteBounds(value)) {
    return null;
  }

  return {
    x: Math.round(value.x),
    y: Math.round(value.y),
    width: Math.max(1, Math.round(value.width)),
    height: Math.max(1, Math.round(value.height)),
  };
};

const dipPointToScreenPoint = (point: AppWindowPosition | null) => {
  if (!isFinitePosition(point)) {
    return null;
  }

  try {
    const nextPoint = window.desktopApi.window.dipToScreenPointSync(point);
    return isFinitePosition(nextPoint) ? nextPoint : point;
  } catch {
    return point;
  }
};

const dipBoundsToScreenBounds = (bounds: AppWindowBounds | null) => {
  if (!isFiniteBounds(bounds)) {
    return null;
  }

  try {
    const nextBounds = window.desktopApi.window.dipToScreenRectSync(bounds);
    return normalizeWindowBounds(nextBounds) ?? normalizeWindowBounds(bounds);
  } catch {
    return normalizeWindowBounds(bounds);
  }
};

const screenBoundsToDipBounds = (bounds: AppWindowBounds | null) => {
  if (!isFiniteBounds(bounds)) {
    return null;
  }

  try {
    const nextBounds = window.desktopApi.window.screenToDipRectSync(bounds);
    return normalizeWindowBounds(nextBounds) ?? normalizeWindowBounds(bounds);
  } catch {
    return normalizeWindowBounds(bounds);
  }
};

const getPointerScreenPosition = (event: PointerEvent) => {
  try {
    const cursorDipPoint = window.desktopApi.window.getCursorScreenPointSync();
    const cursorScreenPoint = dipPointToScreenPoint(cursorDipPoint);
    if (isFinitePosition(cursorScreenPoint)) {
      return cursorScreenPoint;
    }
  } catch {
    // Fall back to renderer pointer coordinates below.
  }

  const fallbackDipPoint = {
    x: isFiniteNumber(event.screenX) ? event.screenX : window.screenX + event.clientX,
    y: isFiniteNumber(event.screenY) ? event.screenY : window.screenY + event.clientY,
  };

  if (!isFinitePosition(fallbackDipPoint)) {
    return null;
  }

  return dipPointToScreenPoint(fallbackDipPoint);
};

export const useWindowResize = (
  enabled: boolean,
  options?: UseWindowResizeOptions,
) => {
  const mode = options?.mode ?? "frame";

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let resizeState: ResizeState | null = null;
    let pendingBounds: AppWindowBounds | null = null;
    let frameId: number | null = null;
    let lastAppliedBounds: AppWindowBounds | null = null;

    const applyResize = (nextBounds: AppWindowBounds) => {
      if (lastAppliedBounds && isSameBounds(lastAppliedBounds, nextBounds)) {
        return;
      }

      lastAppliedBounds = nextBounds;
      try {
        window.desktopApi.window.setBoundsImmediate(nextBounds);
      } catch {
        void window.desktopApi.window.setBounds(nextBounds).catch(() => null);
      }
    };

    const flushResize = () => {
      frameId = null;
      if (!pendingBounds) {
        return;
      }

      const nextBounds = pendingBounds;
      pendingBounds = null;
      applyResize(nextBounds);

      if (pendingBounds && frameId === null) {
        frameId = window.requestAnimationFrame(flushResize);
      }
    };

    const queueResize = (nextBounds: AppWindowBounds) => {
      pendingBounds = nextBounds;
      if (frameId === null) {
        frameId = window.requestAnimationFrame(flushResize);
      }
    };

    const clearResizeState = () => {
      resizeState = null;
      pendingBounds = null;
      lastAppliedBounds = null;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const rawDirection = target.dataset.windowResize;
      if (!rawDirection) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      const direction = rawDirection as ResizeDirection;
      const startBoundsDip = getSynchronousBounds();
      const startBounds = dipBoundsToScreenBounds(startBoundsDip);
      if (!startBounds) {
        return;
      }

      const pointerScreenPosition = getPointerScreenPosition(event);
      if (!pointerScreenPosition) {
        return;
      }

      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort here.
      }

      resizeState = {
        pointerId: event.pointerId,
        direction,
        startScreenX: pointerScreenPosition.x,
        startScreenY: pointerScreenPosition.y,
        startBounds,
        latestBounds: startBounds,
      };
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeState || event.pointerId !== resizeState.pointerId) {
        return;
      }

      const pointerScreenPosition = getPointerScreenPosition(event);
      if (!pointerScreenPosition) {
        return;
      }

      const deltaX = pointerScreenPosition.x - resizeState.startScreenX;
      const deltaY = pointerScreenPosition.y - resizeState.startScreenY;
      const nextBounds = getResizedBounds(
        resizeState.startBounds,
        resizeState.direction,
        deltaX,
        deltaY,
      );
      const nextDipBounds = screenBoundsToDipBounds(nextBounds);
      if (!nextDipBounds) {
        return;
      }

      if (mode === "live") {
        resizeState = {
          ...resizeState,
          latestBounds: nextBounds,
        };
        applyResize(nextDipBounds);
      } else {
        resizeState = {
          ...resizeState,
          latestBounds: nextBounds,
        };
        queueResize(nextDipBounds);
      }

      event.preventDefault();
    };

    const handlePointerFinish = (event: PointerEvent) => {
      if (!resizeState || event.pointerId !== resizeState.pointerId) {
        return;
      }

      if (mode === "live") {
        const latestDipBounds = screenBoundsToDipBounds(resizeState.latestBounds);
        if (latestDipBounds) {
          applyResize(latestDipBounds);
        }
      } else {
        const latestDipBounds = screenBoundsToDipBounds(resizeState.latestBounds);
        if (latestDipBounds) {
          queueResize(latestDipBounds);
        }
      }
      resizeState = null;
      event.preventDefault();
    };

    const handleWindowBlur = () => {
      clearResizeState();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerFinish, true);
    window.addEventListener("pointercancel", handlePointerFinish, true);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerFinish, true);
      window.removeEventListener("pointercancel", handlePointerFinish, true);
      window.removeEventListener("blur", handleWindowBlur);
      clearResizeState();
    };
  }, [enabled, mode]);
};
