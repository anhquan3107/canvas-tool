import { useEffect } from "react";

const DRAG_THRESHOLD = 5;
const CONTEXT_MENU_SUPPRESS_MS = 700;

type RightMouseGestureState = {
  isRightMouseDown: boolean;
  isDragging: boolean;
  startX: number;
  startY: number;
  suppressCurrentContextMenu: boolean;
  suppressContextMenuUntil: number;
};

const getRightMouseGestureState = () => {
  const targetWindow = window as Window & {
    __canvasToolRightMouseGesture?: RightMouseGestureState;
  };

  if (!targetWindow.__canvasToolRightMouseGesture) {
    targetWindow.__canvasToolRightMouseGesture = {
      isRightMouseDown: false,
      isDragging: false,
      startX: 0,
      startY: 0,
      suppressCurrentContextMenu: false,
      suppressContextMenuUntil: 0,
    };
  }

  return targetWindow.__canvasToolRightMouseGesture;
};

const isElement = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement;

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

const getCachedWindowPosition = async (
  cachedPosition: { x: number; y: number } | null,
) => {
  if (cachedPosition) {
    return cachedPosition;
  }

  return window.desktopApi.window.getPosition();
};

export const useWindowRightDrag = () => {
  useEffect(() => {
    const gestureState = getRightMouseGestureState();
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
    let moveInFlight = false;
    const scheduleMove = () => {
      if (moveFrame === null) {
        moveFrame = window.requestAnimationFrame(flushMove);
      }
    };

    const flushMove = () => {
      moveFrame = null;
      if (!pendingMove || moveInFlight) {
        return;
      }

      const nextMove = pendingMove;
      pendingMove = null;
      cachedWindowPosition = nextMove;
      moveInFlight = true;
      void window.desktopApi.window
        .setPosition(nextMove)
        .catch(() => null)
        .finally(() => {
          moveInFlight = false;
          if (pendingMove && moveFrame === null) {
            moveFrame = window.requestAnimationFrame(flushMove);
          }
        });
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
      if (event.pointerType === "pen") {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const leftDragTarget =
        event.button === 0 &&
        isElement(event.target) &&
        event.target.closest("[data-window-left-drag='true']") &&
        !isInteractiveTarget(event.target);
      const rightDragTarget = event.button === 2;

      if (!leftDragTarget && !rightDragTarget) {
        return;
      }

      const token = ++dragToken;
      const button = event.button === 0 ? 0 : 2;
      const captureTarget = isElement(event.target) ? event.target : null;
      const initialPosition = cachedWindowPosition;

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
        startScreenX: event.screenX,
        startScreenY: event.screenY,
        windowX: initialPosition?.x ?? 0,
        windowY: initialPosition?.y ?? 0,
        lastScreenX: event.screenX,
        lastScreenY: event.screenY,
        ready: initialPosition !== null,
        moved: false,
      };

      if (button === 2) {
        gestureState.isRightMouseDown = true;
        gestureState.isDragging = false;
        gestureState.startX = event.clientX;
        gestureState.startY = event.clientY;
        gestureState.suppressCurrentContextMenu = false;
      }

      if (initialPosition) {
        return;
      }

      void getCachedWindowPosition(cachedWindowPosition).then((position) => {
        if (token !== dragToken || dragState?.token !== token) {
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
      if (event.pointerType === "pen") {
        return;
      }

      if (!dragState || (event.buttons & dragState.buttonMask) === 0) {
        return;
      }

      const deltaX = event.screenX - dragState.startScreenX;
      const deltaY = event.screenY - dragState.startScreenY;
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
          lastScreenX: event.screenX,
          lastScreenY: event.screenY,
        };
        return;
      }

      const stepDeltaX = event.screenX - dragState.lastScreenX;
      const stepDeltaY = event.screenY - dragState.lastScreenY;
      const nextMove = {
        x: dragState.windowX + stepDeltaX,
        y: dragState.windowY + stepDeltaY,
      };

      dragState = {
        ...dragState,
        lastScreenX: event.screenX,
        lastScreenY: event.screenY,
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
      if (pendingMove && !moveInFlight) {
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
      }
      dragToken += 1;
      clearDrag(false);
    };

    const handleContextMenu = (event: MouseEvent) => {
      const shouldSuppressForCurrentInteraction =
        gestureState.suppressCurrentContextMenu;
      const shouldSuppressForActiveDrag =
        gestureState.isRightMouseDown && gestureState.isDragging;
      const shouldSuppressForRecentDrag =
        performance.now() <= gestureState.suppressContextMenuUntil;

      if (
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

    void window.desktopApi.window
      .getPosition()
      .then((position) => {
        cachedWindowPosition = position;
      })
      .catch(() => null);

    gestureState.isRightMouseDown = false;
    gestureState.isDragging = false;
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
      gestureState.suppressCurrentContextMenu = false;
      gestureState.suppressContextMenuUntil = 0;
      clearDrag(true);
    };
  }, []);
};
