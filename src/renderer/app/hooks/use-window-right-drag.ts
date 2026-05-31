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

type WindowDragMode = "auto" | "main-process" | "renderer";

type WindowDragOptions = {
  enableLeftWindowDrag?: boolean;
  mode?: WindowDragMode;
  preferNativeMacLeftDrag?: boolean;
  useRendererDragOnMac?: boolean;
};

type DragState = {
  token: number;
  button: 0 | 2;
  buttonMask: 1 | 2;
  pointerId: number;
  captureTarget: Element | null;
  startScreenX: number;
  startScreenY: number;
  lastScreenX: number;
  lastScreenY: number;
  startWindowX: number;
  startWindowY: number;
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

const isElement = (target: EventTarget | null): target is Element =>
  target instanceof Element;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isFinitePosition = (
  value: { x: number; y: number } | null,
): value is { x: number; y: number } =>
  value !== null && isFiniteNumber(value.x) && isFiniteNumber(value.y);

const getNavigatorPlatform = () => {
  try {
    const navigatorWithUAData = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    return navigatorWithUAData.userAgentData?.platform ?? navigator.platform ?? "";
  } catch {
    return "";
  }
};

const isMacPlatform = () => /mac/i.test(getNavigatorPlatform());

const getResolvedDragMode = (mode: WindowDragMode | undefined) => {
  if (mode && mode !== "auto") {
    return mode;
  }

  return "main-process";
};

const isTypingTarget = (target: EventTarget | null) => {
  if (!isElement(target)) {
    return false;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
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

const isLeftWindowDragTarget = (target: EventTarget | null) =>
  isElement(target) &&
  Boolean(target.closest("[data-window-left-drag='true']")) &&
  !isInteractiveTarget(target);

const getPointerScreenPosition = (event: PointerEvent) => {
  try {
    const cursorDipPoint = window.desktopApi.window.getCursorScreenPointSync();
    if (isFinitePosition(cursorDipPoint)) {
      return cursorDipPoint;
    }
  } catch {
    // Fall back to renderer pointer coordinates below.
  }

  const fallbackX = isFiniteNumber(event.screenX)
    ? event.screenX
    : window.screenX + event.clientX;
  const fallbackY = isFiniteNumber(event.screenY)
    ? event.screenY
    : window.screenY + event.clientY;

  if (!isFiniteNumber(fallbackX) || !isFiniteNumber(fallbackY)) {
    return null;
  }

  return { x: fallbackX, y: fallbackY };
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

export const useWindowRightDrag = (options?: WindowDragOptions) => {
  const enableLeftWindowDrag = options?.enableLeftWindowDrag ?? false;
  const macPlatform = isMacPlatform();
  const preferNativeMacLeftDrag =
    options?.preferNativeMacLeftDrag === true && macPlatform;
  const requestedMode = getResolvedDragMode(options?.mode);
  const mode =
    (options?.mode === undefined || options.mode === "auto") &&
    options?.useRendererDragOnMac === true &&
    macPlatform
      ? "renderer"
      : requestedMode;

  useEffect(() => {
    const gestureState = getWindowRightMouseGestureState();
    let dragToken = 0;
    let dragState: DragState | null = null;
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
      const nextMove = pendingMove;
      pendingMove = null;

      if (!isFinitePosition(nextMove)) {
        return;
      }

      cachedWindowPosition = nextMove;
      try {
        window.desktopApi.window.setPositionImmediate(nextMove);
      } catch {
        void window.desktopApi.window.setPosition(nextMove).catch(() => null);
      }
    };

    const flushPendingMoveImmediately = () => {
      const nextMove = pendingMove;
      pendingMove = null;

      if (moveFrame !== null) {
        window.cancelAnimationFrame(moveFrame);
        moveFrame = null;
      }

      if (!isFinitePosition(nextMove)) {
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

    const clearDrag = (cancelQueuedMove = true) => {
      if (mode === "main-process" && dragState?.moved) {
        try {
          window.desktopApi.window.stopDrag();
        } catch {}
      }

      releasePointerCapture();
      dragState = null;

      if (mode === "renderer" && cancelQueuedMove) {
        pendingMove = null;
      }
      if (mode === "renderer" && cancelQueuedMove && moveFrame !== null) {
        window.cancelAnimationFrame(moveFrame);
        moveFrame = null;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const leftDragTarget =
        !preferNativeMacLeftDrag &&
        enableLeftWindowDrag &&
        event.button === 0 &&
        (event.buttons & 1) === 1 &&
        isLeftWindowDragTarget(event.target);
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

      if (mode === "renderer") {
        flushPendingMoveImmediately();
      }

      const token = ++dragToken;
      const button = leftDragTarget ? 0 : 2;
      const buttonMask = button === 0 ? 1 : 2;
      const captureTarget = isElement(event.target) ? event.target : null;
      const initialPosition =
        mode === "renderer"
          ? getImmediateWindowPosition() ?? cachedWindowPosition
          : null;

      if (mode === "renderer") {
        cachedWindowPosition = isFinitePosition(initialPosition)
          ? initialPosition
          : null;
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
        buttonMask,
        pointerId: event.pointerId,
        captureTarget,
        startScreenX: pointerScreenPosition.x,
        startScreenY: pointerScreenPosition.y,
        lastScreenX: pointerScreenPosition.x,
        lastScreenY: pointerScreenPosition.y,
        startWindowX: cachedWindowPosition?.x ?? 0,
        startWindowY: cachedWindowPosition?.y ?? 0,
        ready: mode === "renderer" && cachedWindowPosition !== null,
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

      if (mode !== "renderer" || cachedWindowPosition) {
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
          startWindowX: position.x,
          startWindowY: position.y,
          ready: true,
        };

        const deltaX = dragState.lastScreenX - dragState.startScreenX;
        const deltaY = dragState.lastScreenY - dragState.startScreenY;
        if (dragState.moved) {
          pendingMove = {
            x: position.x + deltaX,
            y: position.y + deltaY,
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
        clearDrag();
        return;
      }

      const pointerScreenPosition = getPointerScreenPosition(event);
      if (!pointerScreenPosition) {
        return;
      }

      const screenDeltaX = pointerScreenPosition.x - dragState.startScreenX;
      const screenDeltaY = pointerScreenPosition.y - dragState.startScreenY;
      if (!dragState.moved && Math.hypot(screenDeltaX, screenDeltaY) < DRAG_THRESHOLD) {
        return;
      }

      dragState.moved = true;

      if (mode === "main-process" && !dragState.ready) {
        dragState.ready = true;
        try {
          window.desktopApi.window.startDrag();
        } catch {}
      }

      if (dragState.button === 2) {
        gestureState.isDragging = true;
        gestureState.suppressCurrentContextMenu = true;
        gestureState.suppressContextMenuUntil =
          performance.now() + CONTEXT_MENU_SUPPRESS_MS;
      }

      event.preventDefault();

      if (mode === "renderer" && !dragState.ready) {
        dragState = {
          ...dragState,
          lastScreenX: pointerScreenPosition.x,
          lastScreenY: pointerScreenPosition.y,
        };
        return;
      }

      if (mode === "renderer") {
        const totalDeltaX = pointerScreenPosition.x - dragState.startScreenX;
        const totalDeltaY = pointerScreenPosition.y - dragState.startScreenY;
        const nextMove = {
          x: dragState.startWindowX + totalDeltaX,
          y: dragState.startWindowY + totalDeltaY,
        };

        if (!isFinitePosition(nextMove)) {
          return;
        }

        dragState = {
          ...dragState,
          lastScreenX: pointerScreenPosition.x,
          lastScreenY: pointerScreenPosition.y,
        };
        cachedWindowPosition = nextMove;
        pendingMove = nextMove;
        scheduleMove();
        return;
      }

      dragState.lastScreenX = pointerScreenPosition.x;
      dragState.lastScreenY = pointerScreenPosition.y;
    };

    const handlePointerUp = () => {
      if (mode === "renderer" && pendingMove) {
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
      clearDrag();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerUp, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("blur", handleWindowBlur);

    if (mode === "renderer") {
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
      clearDrag();
    };
  }, [enableLeftWindowDrag, mode, preferNativeMacLeftDrag]);
};
