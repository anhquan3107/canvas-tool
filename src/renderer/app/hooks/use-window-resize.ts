import { useEffect } from "react";
import type { AppWindowBounds, AppWindowPosition } from "@shared/types/ipc";

const MIN_RESIZE_EDGE = 160;
const MIN_NATIVE_WINDOW_COORD = -2147483648;
const MAX_NATIVE_WINDOW_COORD = 2147483647;

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type ResizeMode = "frame" | "live";

type UseWindowResizeOptions = {
  mode?: ResizeMode;
};

type ResizeState = {
  pointerId: number;
  direction: ResizeDirection;
  captureTarget: HTMLElement | null;
  lastScreenX: number;
  lastScreenY: number;
  latestBounds: AppWindowBounds;
};

const hasWest = (direction: ResizeDirection) => direction.includes("w");
const hasEast = (direction: ResizeDirection) => direction.includes("e");
const hasNorth = (direction: ResizeDirection) => direction.includes("n");
const hasSouth = (direction: ResizeDirection) => direction.includes("s");

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isFinitePosition = (
  value: { x: number; y: number } | null,
): value is { x: number; y: number } =>
  value !== null && isFiniteNumber(value.x) && isFiniteNumber(value.y);

const isFiniteBounds = (
  value: AppWindowBounds | null,
): value is AppWindowBounds =>
  value !== null &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.width) &&
  isFiniteNumber(value.height);

const normalizeWindowBounds = (value: AppWindowBounds | null) => {
  if (!isFiniteBounds(value)) {
    return null;
  }

  const x = Math.max(
    MIN_NATIVE_WINDOW_COORD,
    Math.min(MAX_NATIVE_WINDOW_COORD, Math.round(value.x)),
  );
  const y = Math.max(
    MIN_NATIVE_WINDOW_COORD,
    Math.min(MAX_NATIVE_WINDOW_COORD, Math.round(value.y)),
  );
  const width = Math.max(1, Math.round(value.width));
  const height = Math.max(1, Math.round(value.height));

  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height)
  ) {
    return null;
  }

  return { x, y, width, height };
};

const getResizedBounds = (
  startBounds: AppWindowBounds,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
): AppWindowBounds => {
  const startRight = startBounds.x + startBounds.width;
  const startBottom = startBounds.y + startBounds.height;

  let nextLeft = startBounds.x;
  let nextTop = startBounds.y;
  let nextRight = startRight;
  let nextBottom = startBottom;

  if (hasWest(direction)) {
    nextLeft = Math.min(startBounds.x + deltaX, startRight - MIN_RESIZE_EDGE);
  }

  if (hasEast(direction)) {
    nextRight = Math.max(startRight + deltaX, startBounds.x + MIN_RESIZE_EDGE);
  }

  if (hasNorth(direction)) {
    nextTop = Math.min(startBounds.y + deltaY, startBottom - MIN_RESIZE_EDGE);
  }

  if (hasSouth(direction)) {
    nextBottom = Math.max(
      startBottom + deltaY,
      startBounds.y + MIN_RESIZE_EDGE,
    );
  }

  return {
    x: Math.round(nextLeft),
    y: Math.round(nextTop),
    width: Math.round(nextRight - nextLeft),
    height: Math.round(nextBottom - nextTop),
  };
};

const getSynchronousBounds = (): AppWindowBounds | null => {
  try {
    return normalizeWindowBounds(window.desktopApi.window.getBoundsSync());
  } catch {
    return null;
  }
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

const isSameBounds = (left: AppWindowBounds, right: AppWindowBounds) =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

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

  const fallbackX = window.screenX + event.clientX;
  const fallbackY = window.screenY + event.clientY;
  const fallbackDipPoint = {
    x: isFiniteNumber(event.screenX) ? event.screenX : fallbackX,
    y: isFiniteNumber(event.screenY) ? event.screenY : fallbackY,
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

    const releasePointerCapture = () => {
      if (!resizeState?.captureTarget) {
        return;
      }

      try {
        if (resizeState.captureTarget.hasPointerCapture(resizeState.pointerId)) {
          resizeState.captureTarget.releasePointerCapture(resizeState.pointerId);
        }
      } catch {
        // Ignore failed pointer-capture cleanup.
      }
    };

    const applyResize = (nextScreenBounds: AppWindowBounds) => {
      const nextBounds = screenBoundsToDipBounds(nextScreenBounds);
      if (!nextBounds) {
        return nextScreenBounds;
      }

      if (lastAppliedBounds && isSameBounds(lastAppliedBounds, nextBounds)) {
        return dipBoundsToScreenBounds(lastAppliedBounds) ?? nextScreenBounds;
      }

      try {
        const actualBounds = normalizeWindowBounds(
          window.desktopApi.window.setBoundsSync(nextBounds),
        );
        lastAppliedBounds = actualBounds ?? nextBounds;
      } catch {
        lastAppliedBounds = getSynchronousBounds() ?? nextBounds;
        try {
          window.desktopApi.window.setBoundsImmediate(nextBounds);
        } catch {
          void window.desktopApi.window.setBounds(nextBounds).catch(() => null);
        }
      }

      return dipBoundsToScreenBounds(lastAppliedBounds) ?? nextScreenBounds;
    };

    const flushResize = () => {
      frameId = null;
      if (!pendingBounds) {
        return;
      }

      const nextBounds = pendingBounds;
      pendingBounds = null;
      const appliedBounds = applyResize(nextBounds);
      if (resizeState) {
        resizeState = {
          ...resizeState,
          latestBounds: appliedBounds,
        };
      }

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
      releasePointerCapture();
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

      const captureTarget = target instanceof HTMLElement ? target : null;
      try {
        captureTarget?.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort here.
      }

      resizeState = {
        pointerId: event.pointerId,
        direction,
        captureTarget,
        lastScreenX: pointerScreenPosition.x,
        lastScreenY: pointerScreenPosition.y,
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

      const deltaX = pointerScreenPosition.x - resizeState.lastScreenX;
      const deltaY = pointerScreenPosition.y - resizeState.lastScreenY;
      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      const nextBounds = getResizedBounds(
        resizeState.latestBounds,
        resizeState.direction,
        deltaX,
        deltaY,
      );

      if (mode === "live") {
        const appliedBounds = applyResize(nextBounds);
        resizeState = {
          ...resizeState,
          lastScreenX: pointerScreenPosition.x,
          lastScreenY: pointerScreenPosition.y,
          latestBounds: appliedBounds,
        };
      } else {
        resizeState = {
          ...resizeState,
          lastScreenX: pointerScreenPosition.x,
          lastScreenY: pointerScreenPosition.y,
          latestBounds: nextBounds,
        };
        queueResize(nextBounds);
      }

      event.preventDefault();
    };

    const handlePointerFinish = (event: PointerEvent) => {
      if (!resizeState || event.pointerId !== resizeState.pointerId) {
        return;
      }

      if (mode === "live") {
        applyResize(resizeState.latestBounds);
      } else {
        queueResize(resizeState.latestBounds);
      }
      releasePointerCapture();
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
