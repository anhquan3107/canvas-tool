import { BrowserWindow, screen, ipcMain } from "electron";
import { getWindowActionTarget } from "./window-action-targets";

interface DragSession {
  window: BrowserWindow;
  startCursorX: number;
  startCursorY: number;
  startBoundsX: number;
  startBoundsY: number;
  startBoundsWidth: number;
  startBoundsHeight: number;
  timerId: ReturnType<typeof setInterval> | null;
}

const POLL_INTERVAL_MS = 1000 / 120; // ~120 Hz polling

let activeSession: DragSession | null = null;

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
 * anchor point and cause cumulative drift.
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

  win.setBounds({
    x: nextX,
    y: nextY,
    width: activeSession.startBoundsWidth,
    height: activeSession.startBoundsHeight,
  });
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
      timerId: setInterval(pollAndApplyDrag, POLL_INTERVAL_MS),
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
