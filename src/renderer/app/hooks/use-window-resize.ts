import { useEffect } from "react";
import type { AppWindowBounds } from "@shared/types/ipc";

const MIN_RESIZE_EDGE = 160;
const DEFAULT_MAX_STEP_DELTA = 48;

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type ResizeMode = "frame" | "live";

type UseWindowResizeOptions = {
  mode?: ResizeMode;
  maxStepDelta?: number;
};

type ResizeState = {
  pointerId: number;
  direction: ResizeDirection;
  startScreenX: number;
  startScreenY: number;
  lastScreenX: number;
  lastScreenY: number;
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
    nextLeft = startLeft + deltaX;
  }

  if (hasEast(direction)) {
    nextRight = startRight + deltaX;
  }

  if (hasNorth(direction)) {
    nextTop = startTop + deltaY;
  }

  if (hasSouth(direction)) {
    nextBottom = startBottom + deltaY;
  }

  if (nextRight - nextLeft < MIN_RESIZE_EDGE) {
    if (hasWest(direction)) {
      nextLeft = nextRight - MIN_RESIZE_EDGE;
    } else {
      nextRight = nextLeft + MIN_RESIZE_EDGE;
    }
  }

  if (nextBottom - nextTop < MIN_RESIZE_EDGE) {
    if (hasNorth(direction)) {
      nextTop = nextBottom - MIN_RESIZE_EDGE;
    } else {
      nextBottom = nextTop + MIN_RESIZE_EDGE;
    }
  }

  return {
    x: Math.round(nextLeft),
    y: Math.round(nextTop),
    width: Math.max(MIN_RESIZE_EDGE, Math.round(nextRight - nextLeft)),
    height: Math.max(MIN_RESIZE_EDGE, Math.round(nextBottom - nextTop)),
  };
};

const getSynchronousBounds = () => {
  try {
    return window.desktopApi.window.getBoundsSync();
  } catch {
    return null;
  }
};

const isSameBounds = (left: AppWindowBounds, right: AppWindowBounds) =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

const clampStepDelta = (value: number, maxStepDelta: number) =>
  Math.max(-maxStepDelta, Math.min(maxStepDelta, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isWindowsPointerCoordinatePlatform = () =>
  /win/i.test(
    ((navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.platform ?? ""),
  );

const getPointerScreenPosition = (event: PointerEvent) => {
  const fallbackX = window.screenX + event.clientX;
  const fallbackY = window.screenY + event.clientY;
  const preferFallback = isWindowsPointerCoordinatePlatform();
  const x =
    preferFallback || !isFiniteNumber(event.screenX) ? fallbackX : event.screenX;
  const y =
    preferFallback || !isFiniteNumber(event.screenY) ? fallbackY : event.screenY;

  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return null;
  }

  return { x, y };
};

export const useWindowResize = (
  enabled: boolean,
  options?: UseWindowResizeOptions,
) => {
  const mode = options?.mode ?? "frame";
  const maxStepDelta = Math.max(1, options?.maxStepDelta ?? DEFAULT_MAX_STEP_DELTA);

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
      const startBounds = getSynchronousBounds();
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
        lastScreenX: pointerScreenPosition.x,
        lastScreenY: pointerScreenPosition.y,
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

      if (mode === "live") {
        const stepDeltaX = clampStepDelta(
          pointerScreenPosition.x - resizeState.lastScreenX,
          maxStepDelta,
        );
        const stepDeltaY = clampStepDelta(
          pointerScreenPosition.y - resizeState.lastScreenY,
          maxStepDelta,
        );

        if (stepDeltaX === 0 && stepDeltaY === 0) {
          return;
        }

        const baseBounds = resizeState.latestBounds;
        const nextBounds = getResizedBounds(
          baseBounds,
          resizeState.direction,
          stepDeltaX,
          stepDeltaY,
        );

        resizeState = {
          ...resizeState,
          lastScreenX: pointerScreenPosition.x,
          lastScreenY: pointerScreenPosition.y,
          latestBounds: nextBounds,
        };
        applyResize(nextBounds);
      } else {
        const deltaX = pointerScreenPosition.x - resizeState.startScreenX;
        const deltaY = pointerScreenPosition.y - resizeState.startScreenY;
        const nextBounds = getResizedBounds(
          resizeState.startBounds,
          resizeState.direction,
          deltaX,
          deltaY,
        );

        resizeState = {
          ...resizeState,
          latestBounds: nextBounds,
          lastScreenX: pointerScreenPosition.x,
          lastScreenY: pointerScreenPosition.y,
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
  }, [enabled, mode, maxStepDelta]);
};
