import { BrowserWindow, screen, ipcMain } from "electron";
import { notifyWindowBoundsChanged } from "./window-bounds-listeners";
import { getWindowActionTarget } from "./window-action-targets";
import { getWindowMotionPollIntervalMs } from "./window-motion-rate";

interface DragSession {
  window: BrowserWindow;
  startCursorX: number;
  startCursorY: number;
  startBoundsX: number;
  startBoundsY: number;
  startBoundsWidth: number;
  startBoundsHeight: number;
  lastAppliedX: number;
  lastAppliedY: number;
  timerId: ReturnType<typeof setInterval> | null;
}

let activeSession: DragSession | null = null;

export const isMainProcessDragActive = (window: BrowserWindow) =>
  activeSession?.window === window;

/**
 * All coordinates here are in DIP (logical pixels).
 * - screen.getCursorScreenPoint() returns DIP
 * - win.getBounds() / win.setBounds() operate in DIP
 * No coordinate conversion is needed in the main process.
 *
 * We store startBounds at drag-start and compute position purely as:
 *   newPos = startBounds + (currentCursor - startCursor)
 *
 * We never re-read win.getBounds() mid-drag because the OS may report
 * stale/lagging values during rapid movement, which would corrupt the
 * anchor point and cause cumulative drift. We only read current bounds as a
 * guard so Windows DPI changes cannot silently resize the window during moves.
 */
const pollAndApplyDrag = () => {
  if (!activeSession) return;
  const { window: win } = activeSession;

  if (win.isDestroyed()) {
    stopDrag();
    return;
  }

  const cursor = screen.getCursorScreenPoint();

  const dx = cursor.x - activeSession.startCursorX;
  const dy = cursor.y - activeSession.startCursorY;

  const nextX = Math.round(activeSession.startBoundsX + dx);
  const nextY = Math.round(activeSession.startBoundsY + dy);

  const currentBounds = win.getBounds();
  if (
    nextX === activeSession.lastAppliedX &&
    nextY === activeSession.lastAppliedY &&
    currentBounds.width === activeSession.startBoundsWidth &&
    currentBounds.height === activeSession.startBoundsHeight
  ) {
    return;
  }

  const nextBounds = {
    x: nextX,
    y: nextY,
    width: activeSession.startBoundsWidth,
    height: activeSession.startBoundsHeight,
  };

  try {
    win.setBounds(nextBounds, false);
  } catch {
    stopDrag();
    return;
  }
  activeSession.lastAppliedX = nextX;
  activeSession.lastAppliedY = nextY;
  notifyWindowBoundsChanged(win);
};

const stopDrag = () => {
  if (!activeSession) return;
  if (activeSession.timerId !== null) {
    clearInterval(activeSession.timerId);
  }
  activeSession = null;
};

export const registerMainProcessDrag = (window: BrowserWindow) => {
  ipcMain.on("drag:start", (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const targetWindow = getWindowActionTarget(senderWindow ?? window);

    if (!targetWindow || targetWindow.isDestroyed() || targetWindow.isMaximized()) {
      event.returnValue = false;
      return;
    }

    stopDrag();

    const cursor = screen.getCursorScreenPoint();
    const bounds = targetWindow.getBounds();

    activeSession = {
      window: targetWindow,
      startCursorX: cursor.x,
      startCursorY: cursor.y,
      startBoundsX: bounds.x,
      startBoundsY: bounds.y,
      startBoundsWidth: bounds.width,
      startBoundsHeight: bounds.height,
      lastAppliedX: bounds.x,
      lastAppliedY: bounds.y,
      timerId: setInterval(pollAndApplyDrag, getWindowMotionPollIntervalMs()),
    };

    event.returnValue = true;
  });

  ipcMain.on("drag:stop", (event) => {
    if (activeSession) {
      pollAndApplyDrag();
    }
    stopDrag();
    event.returnValue = true;
  });

  window.on("closed", () => {
    stopDrag();
  });
};
