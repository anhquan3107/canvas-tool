import { useEffect } from "react";
import type { AppWindowBounds, AppWindowPosition } from "@shared/types/ipc";

const DRAG_THRESHOLD = 5;
const CONTEXT_MENU_SUPPRESS_MS = 700;
const MIN_NATIVE_WINDOW_COORD = -2147483648;
const MAX_NATIVE_WINDOW_COORD = 2147483647;

type RightMouseGestureState = {
  isRightMouseDown: boolean;
  isDragging: boolean;
  pointerType: string | null;
  startX: number;
  startY: number;
  suppressCurrentContextMenu: boolean;
  suppressContextMenuUntil: number;
};

type WindowDragOptions = {
  enableLeftWindowDrag?: boolean;
};

type DragState = {
  token: number;
  button: 0 | 2;
  buttonMask: 1 | 2;
  pointerId: number;
  captureTarget: HTMLElement | null;
  startScreenX: number;
  startScreenY: number;
  lastScreenX: number;
  lastScreenY: number;
  startBounds: AppWindowBounds;
  ready: boolean;
  moved: boolean;
};

export const getWindowRightMouseGestureState = () => {
  const targetWindow = window as Window & {
    __canvasToolRightMouseGesture?: RightMouseGestureState;
  };

  if (!targetWindow.__canvasToolRightMouseGesture) {
    targetWindow.__canvasToolRightMouseGesture = {
      isRightMouseDown: false,
      isDragging: false,
      pointerType: null,
      startX: 0,
      startY: 0,
      suppressCurrentContextMenu: false,
      suppressContextMenuUntil: 0,
    };
  }

  return targetWindow.__canvasToolRightMouseGesture;
};

const isSupportedRightDragPointerType = (pointerType: string) =>
  pointerType === "mouse" || pointerType === "pen";

const isElement = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement;

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

const isTypingTarget = (target: EventTarget | null) => {
  if (!isElement(target)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

const isInteractiveTarget = (target: EventTarget | null) => {
  if (!isElement(target)) {
    return false;
  }

  if (isTypingTarget(target)) {
    return true;
  }

  return Boolean(
    target.closest(
      "button, a, summary, [role='button'], [data-window-no-drag='true']",
    ),
  );
};

const getImmediateWindowBounds = () => {
  try {
    return window.desktopApi.window.getBoundsSync();
  } catch {
    return null;
  }
};

const getCachedWindowBounds = async (
  cachedBounds: AppWindowBounds | null,
) => {
  if (isFiniteBounds(cachedBounds)) {
    return cachedBounds;
  }

  const immediateBounds = getImmediateWindowBounds();
  if (isFiniteBounds(immediateBounds)) {
    return immediateBounds;
  }

  const nextBounds = await window.desktopApi.window.getBounds();
  return isFiniteBounds(nextBounds) ? nextBounds : null;
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

export const useWindowRightDrag = (options?: WindowDragOptions) => {
  const enableLeftWindowDrag = options?.enableLeftWindowDrag ?? false;

  useEffect(() => {
    const gestureState = getWindowRightMouseGestureState();
    let dragToken = 0;
    let dragState: DragState | null = null;
    let cachedWindowBounds: AppWindowBounds | null = null;
    let pendingBounds: AppWindowBounds | null = null;
    let frameId: number | null = null;

    const scheduleBounds = () => {
      if (frameId === null) {
        frameId = window.requestAnimationFrame(flushBounds);
      }
    };

    const flushBounds = () => {
      frameId = null;
      const nextBounds = normalizeWindowBounds(pendingBounds);
      if (!nextBounds) {
        pendingBounds = null;
        return;
      }

      pendingBounds = null;
      cachedWindowBounds = nextBounds;
      try {
        window.desktopApi.window.setBoundsImmediate(nextBounds);
      } catch {
        void window.desktopApi.window.setBounds(nextBounds).catch(() => null);
      }

      if (pendingBounds && frameId === null) {
        frameId = window.requestAnimationFrame(flushBounds);
      }
    };

    const flushPendingBoundsImmediately = () => {
      const nextBounds = normalizeWindowBounds(pendingBounds);
      pendingBounds = null;

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }

      if (!nextBounds) {
        return;
      }

      cachedWindowBounds = nextBounds;
      try {
        window.desktopApi.window.setBoundsImmediate(nextBounds);
      } catch {
        void window.desktopApi.window.setBounds(nextBounds).catch(() => null);
      }
    };

    const releasePointerCapture = () => {
      if (!dragState?.captureTarget) {
        return;
      }

      try {
        if (dragState.captureTarget.hasPointerCapture(dragState.pointerId)) {
          dragState.captureTarget.releasePointerCapture(dragState.pointerId);
        }
      } catch {
        // Ignore failed pointer-capture cleanup.
      }
    };

    const clearDrag = (cancelQueuedBounds: boolean) => {
      releasePointerCapture();
      dragState = null;
      if (cancelQueuedBounds) {
        pendingBounds = null;
      }
      if (cancelQueuedBounds && frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const leftDragTarget =
        enableLeftWindowDrag &&
        event.button === 0 &&
        (event.buttons & 1) === 1 &&
        isElement(event.target) &&
        event.target.closest("[data-window-left-drag='true']") &&
        !isInteractiveTarget(event.target);
      const rightDragTarget =
        event.button === 2 &&
        (event.buttons & 2) === 2 &&
        isSupportedRightDragPointerType(event.pointerType);

      if (!leftDragTarget && !rightDragTarget) {
        return;
      }

      const pointerScreenPosition = getPointerScreenPosition(event);
      if (!pointerScreenPosition) {
        return;
      }

      flushPendingBoundsImmediately();

      const token = ++dragToken;
      const button = leftDragTarget ? 0 : 2;
      const buttonMask = button === 0 ? 1 : 2;
      const captureTarget = isElement(event.target) ? event.target : null;
      const initialBoundsDip = getImmediateWindowBounds() ?? cachedWindowBounds;
      cachedWindowBounds = isFiniteBounds(initialBoundsDip)
        ? initialBoundsDip
        : null;
      const initialBoundsScreen = dipBoundsToScreenBounds(initialBoundsDip);

      if (captureTarget) {
        try {
          captureTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture can fail on some targets; drag still works without it.
        }
      }

      dragState = {
        token,
        button,
        buttonMask,
        pointerId: event.pointerId,
        captureTarget,
        startScreenX: pointerScreenPosition.x,
        startScreenY: pointerScreenPosition.y,
        lastScreenX: pointerScreenPosition.x,
        lastScreenY: pointerScreenPosition.y,
        startBounds:
          initialBoundsScreen ?? { x: 0, y: 0, width: 0, height: 0 },
        ready: initialBoundsScreen !== null,
        moved: false,
      };

      if (button === 2) {
        gestureState.isRightMouseDown = true;
        gestureState.isDragging = false;
        gestureState.pointerType = event.pointerType;
        gestureState.startX = event.clientX;
        gestureState.startY = event.clientY;
        gestureState.suppressCurrentContextMenu = false;
      }

      if (initialBoundsScreen) {
        return;
      }

      void getCachedWindowBounds(cachedWindowBounds).then((boundsDip) => {
        if (token !== dragToken || dragState?.token !== token) {
          return;
        }

        const boundsScreen = dipBoundsToScreenBounds(boundsDip);
        if (!boundsScreen) {
          return;
        }

        cachedWindowBounds = boundsDip;
        dragState = {
          ...dragState,
          startBounds: boundsScreen,
          ready: true,
        };

        if (!dragState.moved) {
          return;
        }

        const deltaX = dragState.lastScreenX - dragState.startScreenX;
        const deltaY = dragState.lastScreenY - dragState.startScreenY;
        const nextScreenBounds = {
          ...boundsScreen,
          x: boundsScreen.x + deltaX,
          y: boundsScreen.y + deltaY,
        };
        const nextDipBounds = screenBoundsToDipBounds(nextScreenBounds);
        if (!nextDipBounds) {
          return;
        }

        cachedWindowBounds = nextDipBounds;
        pendingBounds = nextDipBounds;
        scheduleBounds();
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragState || (event.buttons & dragState.buttonMask) === 0) {
        return;
      }

      if (
        dragState.button === 2 &&
        !isSupportedRightDragPointerType(event.pointerType)
      ) {
        dragToken += 1;
        gestureState.isRightMouseDown = false;
        gestureState.isDragging = false;
        gestureState.pointerType = null;
        gestureState.suppressCurrentContextMenu = false;
        clearDrag(true);
        return;
      }

      const pointerScreenPosition = getPointerScreenPosition(event);
      if (!pointerScreenPosition) {
        return;
      }

      const deltaX = pointerScreenPosition.x - dragState.startScreenX;
      const deltaY = pointerScreenPosition.y - dragState.startScreenY;
      if (!dragState.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) {
        return;
      }

      dragState.moved = true;
      if (dragState.button === 2) {
        gestureState.isDragging = true;
        gestureState.suppressCurrentContextMenu = true;
        gestureState.suppressContextMenuUntil =
          performance.now() + CONTEXT_MENU_SUPPRESS_MS;
      }
      event.preventDefault();

      dragState = {
        ...dragState,
        lastScreenX: pointerScreenPosition.x,
        lastScreenY: pointerScreenPosition.y,
      };

      if (!dragState.ready) {
        return;
      }

      const nextScreenBounds = {
        ...dragState.startBounds,
        x: dragState.startBounds.x + deltaX,
        y: dragState.startBounds.y + deltaY,
      };
      const nextDipBounds = screenBoundsToDipBounds(nextScreenBounds);

      if (!nextDipBounds) {
        return;
      }

      cachedWindowBounds = nextDipBounds;
      pendingBounds = nextDipBounds;
      scheduleBounds();
    };

    const handlePointerUp = () => {
      if (pendingBounds) {
        scheduleBounds();
      }

      if (dragState?.moved && dragState.button === 2) {
        gestureState.suppressCurrentContextMenu = true;
        gestureState.suppressContextMenuUntil =
          performance.now() + CONTEXT_MENU_SUPPRESS_MS;
      }
      if (dragState?.button === 2) {
        gestureState.isRightMouseDown = false;
        gestureState.isDragging = false;
        gestureState.pointerType = null;
      }
      dragToken += 1;
      clearDrag(false);
    };

    const handleContextMenu = (event: MouseEvent) => {
      const shouldSuppressWhileRightPointerDown = gestureState.isRightMouseDown;
      const shouldSuppressForCurrentInteraction =
        gestureState.suppressCurrentContextMenu;
      const shouldSuppressForActiveDrag =
        gestureState.isRightMouseDown && gestureState.isDragging;
      const shouldSuppressForRecentDrag =
        performance.now() <= gestureState.suppressContextMenuUntil;

      if (
        !shouldSuppressWhileRightPointerDown &&
        !shouldSuppressForCurrentInteraction &&
        !shouldSuppressForActiveDrag &&
        !shouldSuppressForRecentDrag
      ) {
        return;
      }

      event.preventDefault();
    };

    const handleWindowBlur = () => {
      gestureState.isRightMouseDown = false;
      gestureState.isDragging = false;
      gestureState.pointerType = null;
      gestureState.suppressCurrentContextMenu = false;
      dragToken += 1;
      clearDrag(true);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerUp, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("blur", handleWindowBlur);

    const initialCachedBounds = getImmediateWindowBounds();
    cachedWindowBounds = isFiniteBounds(initialCachedBounds)
      ? initialCachedBounds
      : null;
    if (!cachedWindowBounds) {
      void window.desktopApi.window
        .getBounds()
        .then((bounds) => {
          cachedWindowBounds = isFiniteBounds(bounds) ? bounds : null;
        })
        .catch(() => null);
    }

    gestureState.isRightMouseDown = false;
    gestureState.isDragging = false;
    gestureState.pointerType = null;
    gestureState.suppressCurrentContextMenu = false;
    gestureState.suppressContextMenuUntil = 0;

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerUp, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("blur", handleWindowBlur);
      gestureState.isRightMouseDown = false;
      gestureState.isDragging = false;
      gestureState.pointerType = null;
      gestureState.suppressCurrentContextMenu = false;
      gestureState.suppressContextMenuUntil = 0;
      clearDrag(true);
    };
  }, [enableLeftWindowDrag]);
};
