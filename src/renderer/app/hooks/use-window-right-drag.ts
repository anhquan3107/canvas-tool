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

/**
 * Get the current cursor position in DIP (logical pixels).
 *
 * IMPORTANT: We must NOT convert to screen pixels here. The main process
 * drag loop (main-process-drag.ts) works entirely in DIP:
 *   - screen.getCursorScreenPoint() returns DIP
 *   - win.getBounds() / win.setBounds() operate in DIP
 *
 * If we converted to screen pixels here, the start position stored by the
 * renderer would be in a different coordinate space than the cursor positions
 * read by the main process polling loop, causing the window to move at a
 * different rate than the cursor (drift that accumulates on every move).
 */
const getPointerScreenPosition = (event: PointerEvent) => {
  // Primary: ask the main process for the cursor position in DIP.
  try {
    const cursorDipPoint = window.desktopApi.window.getCursorScreenPointSync();
    if (isFinitePosition(cursorDipPoint)) {
      return cursorDipPoint;
    }
  } catch {
    // Fall back to renderer pointer coordinates below.
  }

  // Fallback: use the renderer's own event coordinates (already in DIP/CSS pixels).
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

export const useWindowRightDrag = (options?: WindowDragOptions) => {
  const enableLeftWindowDrag = options?.enableLeftWindowDrag ?? false;

  useEffect(() => {
    const gestureState = getWindowRightMouseGestureState();
    let dragToken = 0;
    let dragState: DragState | null = null;

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

    const clearDrag = () => {
      if (dragState?.moved) {
        try {
          window.desktopApi.window.stopDrag();
        } catch {}
      }
      releasePointerCapture();
      dragState = null;
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

      const token = ++dragToken;
      const button = leftDragTarget ? 0 : 2;
      const buttonMask = button === 0 ? 1 : 2;
      const captureTarget = isElement(event.target) ? event.target : null;

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
        ready: false,
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

      // Use screen-space delta only for the drag-threshold check.
      const screenDeltaX = pointerScreenPosition.x - dragState.startScreenX;
      const screenDeltaY = pointerScreenPosition.y - dragState.startScreenY;
      if (!dragState.moved && Math.hypot(screenDeltaX, screenDeltaY) < DRAG_THRESHOLD) {
        return;
      }

      dragState.moved = true;

      if (!dragState.ready) {
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

      dragState.lastScreenX = pointerScreenPosition.x;
      dragState.lastScreenY = pointerScreenPosition.y;
    };

    const handlePointerUp = () => {
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
      clearDrag();
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
  }, [enableLeftWindowDrag]);
};
