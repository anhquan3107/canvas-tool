import { useEffect } from "react";
import type { AppWindowBounds } from "@shared/types/ipc";

const MIN_RESIZE_EDGE = 160;

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type ResizeState = {
  pointerId: number;
  direction: ResizeDirection;
  aspectRatio: number;
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
  aspectRatio: number,
  deltaX: number,
  deltaY: number,
): AppWindowBounds => {
  const widthFromHorizontal =
    startBounds.width +
    (hasEast(direction) ? deltaX : 0) -
    (hasWest(direction) ? deltaX : 0);
  const widthFromVertical =
    startBounds.width +
    ((hasSouth(direction) ? deltaY : 0) -
      (hasNorth(direction) ? deltaY : 0)) *
      aspectRatio;
  const shouldPreferHorizontal =
    (hasEast(direction) || hasWest(direction)) &&
    (!hasNorth(direction) && !hasSouth(direction)
      ? true
      : Math.abs(widthFromHorizontal - startBounds.width) >=
        Math.abs(widthFromVertical - startBounds.width));
  const nextWidthRaw = shouldPreferHorizontal
    ? widthFromHorizontal
    : widthFromVertical;
  const nextWidth = Math.max(MIN_RESIZE_EDGE, Math.round(nextWidthRaw));
  const nextHeight = Math.max(
    MIN_RESIZE_EDGE,
    Math.round(nextWidth / Math.max(0.0001, aspectRatio)),
  );

  let x = startBounds.x;
  let y = startBounds.y;

  if (hasWest(direction)) {
    x = startBounds.x + (startBounds.width - nextWidth);
  } else if (!hasEast(direction)) {
    x = startBounds.x + Math.round((startBounds.width - nextWidth) / 2);
  }

  if (hasNorth(direction)) {
    y = startBounds.y + (startBounds.height - nextHeight);
  } else if (!hasSouth(direction)) {
    y = startBounds.y + Math.round((startBounds.height - nextHeight) / 2);
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: nextWidth,
    height: nextHeight,
  };
};

const getSynchronousBounds = () => {
  try {
    return window.desktopApi.window.getBoundsSync();
  } catch {
    return null;
  }
};

export const useWindowResize = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let resizeState: ResizeState | null = null;
    let pendingBounds: AppWindowBounds | null = null;
    let frameId: number | null = null;

    const flushResize = () => {
      frameId = null;
      if (!pendingBounds) {
        return;
      }

      const nextBounds = pendingBounds;
      pendingBounds = null;
      try {
        window.desktopApi.window.setBoundsImmediate(nextBounds);
      } catch {
        void window.desktopApi.window.setBounds(nextBounds).catch(() => null);
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
      resizeState = null;
      pendingBounds = null;
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

      const direction = rawDirection as ResizeDirection;
      const startBounds = getSynchronousBounds();
      if (!startBounds) {
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
        aspectRatio:
          startBounds.width / Math.max(1, startBounds.height),
        startScreenX: event.screenX,
        startScreenY: event.screenY,
        startBounds,
        latestBounds: startBounds,
      };
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeState || event.pointerId !== resizeState.pointerId) {
        return;
      }

      const deltaX = event.screenX - resizeState.startScreenX;
      const deltaY = event.screenY - resizeState.startScreenY;
      const nextBounds = getResizedBounds(
        resizeState.startBounds,
        resizeState.direction,
        resizeState.aspectRatio,
        deltaX,
        deltaY,
      );

      resizeState = {
        ...resizeState,
        latestBounds: nextBounds,
      };
      queueResize(nextBounds);
      event.preventDefault();
    };

    const handlePointerFinish = (event: PointerEvent) => {
      if (!resizeState || event.pointerId !== resizeState.pointerId) {
        return;
      }

      queueResize(resizeState.latestBounds);
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
  }, [enabled]);
};
