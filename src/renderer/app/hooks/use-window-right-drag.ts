import { useEffect } from "react";

const DRAG_THRESHOLD = 5;
const CONTEXT_MENU_SUPPRESS_MS = 700;

type RightMouseGestureState = {
  isRightMouseDown: boolean;
  isDragging: boolean;
  pointerType: string | null;
  startX: number;
  startY: number;
  suppressCurrentContextMenu: boolean;
  suppressContextMenuUntil: number;
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

const getNativeCursorScreenPosition = () => {
  try {
    const point = window.desktopApi.window.getCursorScreenPointSync();
    if (!isFiniteNumber(point?.x) || !isFiniteNumber(point?.y)) {
      return null;
    }

    return point;
  } catch {
    return null;
  }
};

const isFinitePosition = (
  value: { x: number; y: number } | null,
): value is { x: number; y: number } =>
  value !== null && isFiniteNumber(value.x) && isFiniteNumber(value.y);

const MIN_NATIVE_WINDOW_COORD = -2147483648;
const MAX_NATIVE_WINDOW_COORD = 2147483647;

const isWindowsPointerCoordinatePlatform = () =>
  /win/i.test(
    ((navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.platform ?? ""),
  );

const getPointerScreenPosition = (event: PointerEvent) => {
  const fallbackX = window.screenX + event.clientX;
  const fallbackY = window.screenY + event.clientY;
  // Keep coordinates in the same DIP space as BrowserWindow bounds on Windows.
  const preferFallback =
    event.pointerType === "pen" || isWindowsPointerCoordinatePlatform();
  const x =
    preferFallback || !isFiniteNumber(event.screenX) ? fallbackX : event.screenX;
  const y =
    preferFallback || !isFiniteNumber(event.screenY) ? fallbackY : event.screenY;

  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return null;
  }

  return { x, y };
};

const getPointerScreenPositionForWindow = (
  event: PointerEvent,
  windowPosition: { x: number; y: number } | null,
) => {
  const nativeCursorPosition = getNativeCursorScreenPosition();
  if (nativeCursorPosition) {
    return nativeCursorPosition;
  }

  if (event.pointerType === "pen" || isWindowsPointerCoordinatePlatform()) {
    return getPointerScreenPosition(event);
  }

  if (!isFinitePosition(windowPosition)) {
    return getPointerScreenPosition(event);
  }

  const x = windowPosition.x + event.clientX;
  const y = windowPosition.y + event.clientY;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return null;
  }

  return { x, y };
};

const normalizeWindowPosition = (value: { x: number; y: number } | null) => {
  if (!isFinitePosition(value)) {
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
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    return null;
  }

  return { x, y };
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

const getImmediateWindowPosition = () => {
  try {
    return window.desktopApi.window.getPositionSync();
  } catch {
    return null;
  }
};

const getCachedWindowPosition = async (
  cachedPosition: { x: number; y: number } | null,
) => {
  if (isFinitePosition(cachedPosition)) {
    return cachedPosition;
  }

  const immediatePosition = getImmediateWindowPosition();
  if (isFinitePosition(immediatePosition)) {
    return immediatePosition;
  }

  const nextPosition = await window.desktopApi.window.getPosition();
  return isFinitePosition(nextPosition) ? nextPosition : null;
};

export const useWindowRightDrag = () => {
  useEffect(() => {
    const gestureState = getWindowRightMouseGestureState();
    let dragToken = 0;
    let dragState:
      | {
          token: number;
          button: 0 | 2;
          buttonMask: 1 | 2;
          pointerId: number;
          captureTarget: HTMLElement | null;
          startScreenX: number;
          startScreenY: number;
          windowX: number;
          windowY: number;
          lastScreenX: number;
          lastScreenY: number;
          ready: boolean;
          moved: boolean;
        }
      | null = null;
    let cachedWindowPosition: { x: number; y: number } | null = null;
    let pendingMove: { x: number; y: number } | null = null;
    let moveFrame: number | null = null;
    const scheduleMove = () => {
      if (moveFrame === null) {
        moveFrame = window.requestAnimationFrame(flushMove);
      }
    };

    const flushMove = () => {
      moveFrame = null;
      const nextMove = normalizeWindowPosition(pendingMove);
      if (!nextMove) {
        pendingMove = null;
        return;
      }
      pendingMove = null;
      cachedWindowPosition = nextMove;
      try {
        window.desktopApi.window.setPositionImmediate(nextMove);
      } catch {
        void window.desktopApi.window.setPosition(nextMove).catch(() => null);
      }

      if (pendingMove && moveFrame === null) {
        moveFrame = window.requestAnimationFrame(flushMove);
      }
    };

    const flushPendingMoveImmediately = () => {
      const nextMove = normalizeWindowPosition(pendingMove);
      pendingMove = null;

      if (moveFrame !== null) {
        window.cancelAnimationFrame(moveFrame);
        moveFrame = null;
      }

      if (!nextMove) {
        return;
      }

      cachedWindowPosition = nextMove;
      try {
        window.desktopApi.window.setPositionImmediate(nextMove);
      } catch {
        void window.desktopApi.window.setPosition(nextMove).catch(() => null);
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

    const clearDrag = (cancelQueuedMove: boolean) => {
      releasePointerCapture();
      dragState = null;
      if (cancelQueuedMove) {
        pendingMove = null;
      }
      if (cancelQueuedMove && moveFrame !== null) {
        window.cancelAnimationFrame(moveFrame);
        moveFrame = null;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const leftDragTarget =
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

      flushPendingMoveImmediately();

      const token = ++dragToken;
      const button = event.button === 0 ? 0 : 2;
      const captureTarget = isElement(event.target) ? event.target : null;
      const initialPosition = getImmediateWindowPosition() ?? cachedWindowPosition;
      cachedWindowPosition = isFinitePosition(initialPosition)
        ? initialPosition
        : null;
      const pointerScreenPosition = getPointerScreenPositionForWindow(
        event,
        cachedWindowPosition,
      );
      if (!pointerScreenPosition) {
        return;
      }

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
        buttonMask: button === 0 ? 1 : 2,
        pointerId: event.pointerId,
        captureTarget,
        startScreenX: pointerScreenPosition.x,
        startScreenY: pointerScreenPosition.y,
        windowX: cachedWindowPosition?.x ?? 0,
        windowY: cachedWindowPosition?.y ?? 0,
        lastScreenX: pointerScreenPosition.x,
        lastScreenY: pointerScreenPosition.y,
        ready: cachedWindowPosition !== null,
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

      if (cachedWindowPosition) {
        return;
      }

      void getCachedWindowPosition(cachedWindowPosition).then((position) => {
        if (token !== dragToken || dragState?.token !== token) {
          return;
        }

        if (!isFinitePosition(position)) {
          return;
        }

        cachedWindowPosition = position;
        dragState = {
          ...dragState,
          windowX: position.x,
          windowY: position.y,
          ready: true,
        };

        const deltaX = dragState.lastScreenX - dragState.startScreenX;
        const deltaY = dragState.lastScreenY - dragState.startScreenY;
        if (dragState.moved) {
          pendingMove = {
            x: position.x + deltaX,
            y: position.y + deltaY,
          };
          dragState = {
            ...dragState,
            windowX: pendingMove.x,
            windowY: pendingMove.y,
          };
          cachedWindowPosition = pendingMove;
          scheduleMove();
        }
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

      const pointerScreenPosition = getPointerScreenPositionForWindow(event, {
        x: dragState.windowX,
        y: dragState.windowY,
      });
      if (!pointerScreenPosition) {
        return;
      }

      const deltaX = pointerScreenPosition.x - dragState.startScreenX;
      const deltaY = pointerScreenPosition.y - dragState.startScreenY;
      if (
        !dragState.moved &&
        Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD
      ) {
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
      if (!dragState.ready) {
        dragState = {
          ...dragState,
          lastScreenX: pointerScreenPosition.x,
          lastScreenY: pointerScreenPosition.y,
        };
        return;
      }

      const stepDeltaX = pointerScreenPosition.x - dragState.lastScreenX;
      const stepDeltaY = pointerScreenPosition.y - dragState.lastScreenY;
      const nextMove = {
        x: dragState.windowX + stepDeltaX,
        y: dragState.windowY + stepDeltaY,
      };

      if (!isFinitePosition(nextMove)) {
        return;
      }

      dragState = {
        ...dragState,
        lastScreenX: pointerScreenPosition.x,
        lastScreenY: pointerScreenPosition.y,
        windowX: nextMove.x,
        windowY: nextMove.y,
      };
      cachedWindowPosition = nextMove;
      pendingMove = {
        x: nextMove.x,
        y: nextMove.y,
      };
      scheduleMove();
    };

    const handlePointerUp = () => {
      if (pendingMove) {
        scheduleMove();
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

    const initialCachedPosition = getImmediateWindowPosition();
    cachedWindowPosition = isFinitePosition(initialCachedPosition)
      ? initialCachedPosition
      : null;
    if (!cachedWindowPosition) {
      void window.desktopApi.window
        .getPosition()
        .then((position) => {
          cachedWindowPosition = isFinitePosition(position) ? position : null;
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
  }, []);
};
