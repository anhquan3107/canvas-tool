import { BrowserWindow, screen, ipcMain } from "electron";
import { getWindowActionTarget } from "./window-action-targets";

interface DragSession {
  window: BrowserWindow;
  startCursorX: number;
  startCursorY: number;
  startBounds: Electron.Rectangle;
  lastDisplayId: number;
  timerId: ReturnType<typeof setInterval> | null;
}

const POLL_INTERVAL_MS = 1000 / 120; // ~120 Hz polling

let activeSession: DragSession | null = null;

const pollAndApplyDrag = () => {
  if (!activeSession) return;
  const { window: win } = activeSession;

  if (win.isDestroyed()) {
    stopDrag();
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);

  // DPI boundary jump detection
  if (display.id !== activeSession.lastDisplayId) {
    activeSession.lastDisplayId = display.id;
    activeSession.startCursorX = cursor.x;
    activeSession.startCursorY = cursor.y;
    // Resync bounds to actual window bounds in case of DPI change
    activeSession.startBounds = win.getBounds();
    return;
  }

  const dx = cursor.x - activeSession.startCursorX;
  const dy = cursor.y - activeSession.startCursorY;

  const nextX = activeSession.startBounds.x + dx;
  const nextY = activeSession.startBounds.y + dy;

  const current = win.getBounds();
  if (current.x === nextX && current.y === nextY) {
    return;
  }

  win.setBounds({
    x: nextX,
    y: nextY,
    width: activeSession.startBounds.width,
    height: activeSession.startBounds.height,
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
    const display = screen.getDisplayNearestPoint(cursor);

    activeSession = {
      window: targetWindow,
      startCursorX: cursor.x,
      startCursorY: cursor.y,
      startBounds: targetWindow.getBounds(),
      lastDisplayId: display.id,
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
