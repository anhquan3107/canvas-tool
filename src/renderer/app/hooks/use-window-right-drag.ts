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
  // Screen-space coords used only for DRAG_THRESHOLD check.
  startScreenX: number;
  startScreenY: number;
  lastScreenX: number;
  lastScreenY: number;
  /**
   * Window bounds in DIP at drag-start.
   */
  startBoundsDip: AppWindowBounds;
  /**
   * Cursor DIP position from the PREVIOUS frame.
   * We use step delta (current - last) instead of total delta (current - start)
   * so that any per-frame DIP coordinate discontinuity at a monitor boundary
   * only causes a tiny single-frame correction rather than the full oscillation
   * that total-delta produces when the DIP scale flips between frames.
   */
  lastCursorDipX: number;
  lastCursorDipY: number;
  // Original DIP size, never changes during drag.
  startDipWidth: number;
  startDipHeight: number;
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

      // Capture cursor position in DIP at drag-start.
      // getCursorScreenPointSync returns DIP coordinates (Electron normalises them).
      let startCursorDip: { x: number; y: number } | null = null;
      try {
        const c = window.desktopApi.window.getCursorScreenPointSync();
        if (isFinitePosition(c)) startCursorDip = c;
      } catch {
        // Fall back: will use screen-space delta as approximation.
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
        startBoundsDip: initialBoundsDip ?? { x: 0, y: 0, width: 0, height: 0 },
        lastCursorDipX: startCursorDip?.x ?? 0,
        lastCursorDipY: startCursorDip?.y ?? 0,
        startDipWidth: initialBoundsDip?.width ?? 0,
        startDipHeight: initialBoundsDip?.height ?? 0,
        ready: isFiniteBounds(initialBoundsDip) && startCursorDip !== null,
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

      if (isFiniteBounds(initialBoundsDip) && startCursorDip !== null) {
        return;
      }

      // Async fallback: bounds not available synchronously.
      void getCachedWindowBounds(cachedWindowBounds).then((boundsDip) => {
        if (token !== dragToken || dragState?.token !== token) {
          return;
        }
        if (!isFiniteBounds(boundsDip)) {
          return;
        }

        // Get current DIP cursor position for the async catch-up.
        let curCursorDip: { x: number; y: number } | null = null;
        try {
          const c = window.desktopApi.window.getCursorScreenPointSync();
          if (isFinitePosition(c)) curCursorDip = c;
        } catch {
          // ignore
        }

        cachedWindowBounds = boundsDip;
        dragState = {
          ...dragState,
          startBoundsDip: boundsDip,
          lastCursorDipX: curCursorDip?.x ?? dragState.lastCursorDipX,
          lastCursorDipY: curCursorDip?.y ?? dragState.lastCursorDipY,
          startDipWidth: boundsDip.width,
          startDipHeight: boundsDip.height,
          ready: true,
        };

        if (!dragState.moved || !curCursorDip) {
          return;
        }

        // No movement yet to catch up — lastCursorDip is already at current pos.
        // The next pointermove will compute the first step delta correctly.
        cachedWindowBounds = boundsDip;
        pendingBounds = boundsDip;
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

      // Use screen-space delta only for the drag-threshold check.
      const screenDeltaX = pointerScreenPosition.x - dragState.startScreenX;
      const screenDeltaY = pointerScreenPosition.y - dragState.startScreenY;
      if (!dragState.moved && Math.hypot(screenDeltaX, screenDeltaY) < DRAG_THRESHOLD) {
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

      // Get current cursor position in DIP (single IPC call).
      let currentCursorDip: { x: number; y: number } | null = null;
      try {
        const c = window.desktopApi.window.getCursorScreenPointSync();
        if (isFinitePosition(c)) currentCursorDip = c;
      } catch {
        // ignore
      }

      if (!currentCursorDip) {
        return;
      }

      // Step delta: movement since the previous frame in DIP space.
      const stepDipDeltaX = currentCursorDip.x - dragState.lastCursorDipX;
      const stepDipDeltaY = currentCursorDip.y - dragState.lastCursorDipY;

      // ── DPI boundary jump detection ────────────────────────────────────────
      // At a monitor boundary, getCursorScreenPointSync() snaps to the new
      // monitor's DIP scale in a single frame (e.g. 100%→125% flips ~384 DIP).
      // Normal mouse movement at 60fps never exceeds ~30–40 DIP/frame even at
      // top competitive speeds. Anything above MAX_NORMAL_STEP_DIP means the
      // DIP coordinate space just changed, not the cursor moved that far.
      //
      // When detected: re-anchor cursor and window to the new coordinate space
      // without moving the window. The next frame resumes normally.
      const MAX_NORMAL_STEP_DIP = 100;
      if (
        Math.abs(stepDipDeltaX) > MAX_NORMAL_STEP_DIP ||
        Math.abs(stepDipDeltaY) > MAX_NORMAL_STEP_DIP
      ) {
        // Read actual window bounds after Electron's DPI adjustment.
        const actualBounds = getImmediateWindowBounds();
        if (isFiniteBounds(actualBounds)) {
          cachedWindowBounds = actualBounds;
        }
        dragState = {
          ...dragState,
          lastCursorDipX: currentCursorDip.x,
          lastCursorDipY: currentCursorDip.y,
        };
        return; // Skip this frame — next frame works correctly from new anchor.
      }
      // ── End DPI boundary detection ─────────────────────────────────────────

      // Accumulate from the last known good DIP bounds (updated every frame).
      const baseBounds = cachedWindowBounds ?? dragState.startBoundsDip;
      const nextDipBounds = normalizeWindowBounds({
        x: baseBounds.x + stepDipDeltaX,
        y: baseBounds.y + stepDipDeltaY,
        width: dragState.startDipWidth,
        height: dragState.startDipHeight,
      });

      if (!nextDipBounds) {
        return;
      }

      dragState = {
        ...dragState,
        lastCursorDipX: currentCursorDip.x,
        lastCursorDipY: currentCursorDip.y,
      };

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
